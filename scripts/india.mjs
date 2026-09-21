// Classification and rollup for the India funding dataset.
//
// Two rules govern everything here:
//
// 1. The classification is Inc42's, not ours. Their table already carries a
//    sector, an AI layer (application / infrastructure / foundation model) and
//    a business model for every deal. We fold spelling variants together and
//    read those columns. We do not re-judge what a company does from its name,
//    because we have no description to judge from.
//
// 2. A round's size belongs to the round, not to each investor in it. Six
//    firms joining a $100 Mn round did not deploy $100 Mn each, and we do not
//    know the split. So an investor's money column is named for what it
//    actually is — the combined size of the rounds they joined — and never
//    presented as capital they deployed.

/** Inc42 spells several sectors more than one way; these are the same sector. */
const SECTOR_ALIASES = new Map([
  ["cleantech", "Clean Tech"],
  ["clean tech", "Clean Tech"],
  ["healthtech", "Health Tech"],
  ["health tech", "Health Tech"],
  ["enterprise tech", "Enterprise Tech"],
  ["enterprisetech", "Enterprise Tech"],
  ["enterprise services", "Enterprise Services"],
  ["advanced hardware & technology", "Advanced Hardware"],
  ["advanced technology & hardware", "Advanced Hardware"],
  ["advanced hardware & iot", "Advanced Hardware"],
  ["travel tech", "Travel Tech"],
  ["traveltech", "Travel Tech"],
  ["consumer services", "Consumer Services"],
  ["consumers services", "Consumer Services"],
  ["real estate tech", "Real Estate Tech"],
  ["proptech", "Real Estate Tech"],
  ["media & entertainment", "Media & Entertainment"],
]);

export function normaliseSector(raw) {
  // "Ecommerce***" — a footnote marker, not part of the name.
  const s = (raw || "").replace(/[*†]+$/, "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return SECTOR_ALIASES.get(s.toLowerCase()) ?? s;
}

/**
 * Inc42's own AI layer, read off the subsector column. "Aplication Layer" and
 * "Application layer" are their typo and their casing; both mean the same row.
 */
export function aiLayerOf(subsector) {
  const s = (subsector || "").toLowerCase();
  // "app?lication" covers Inc42's "Aplication Layer" typo as well as the
  // correct spelling; "apl?ication" would match neither.
  if (/app?lication/.test(s)) return "application";
  if (/infrastructure|development/.test(s)) return "infrastructure";
  if (/foundation|llm/.test(s)) return "foundation";
  return "";
}

const isB2B = (model) => /b2b/i.test(model || "");

/**
 * An "AI service company" in the sense the request meant — AI sold to another
 * business as work done, the shape of the example we were pointed at — is,
 * in this source's vocabulary, an application-layer AI company selling B2B.
 * Infrastructure and foundation-model companies sell capability to builders,
 * not an outcome to a buyer, so they are AI but not AI services.
 */
export function classifyDeal(deal) {
  const sector = normaliseSector(deal.sector);
  const isAI = sector.toLowerCase() === "ai";
  const aiLayer = isAI ? aiLayerOf(deal.subsector) : "";
  return {
    ...deal,
    sector,
    isAI,
    aiLayer,
    isAIService: isAI && aiLayer === "application" && isB2B(deal.businessModel),
    investors: deal.investors.map((n) => n.replace(/\s+/g, " ").trim()),
  };
}

/** Case and punctuation vary between articles; "ajvc" and "AJVC" are one firm. */
export const investorKey = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Of several spellings, show the one used most; ties go to the longer form. */
function preferredSpelling(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
}

const STAGE_ORDER = ["Pre-seed", "Seed", "Pre-Series A", "Series A", "Series B", "Series C", "Series D+", "Other"];

export function normaliseStage(raw) {
  const s = (raw || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return "Other";
  if (/pre-?seed/.test(s)) return "Pre-seed";
  if (/pre-?series\s*a/.test(s)) return "Pre-Series A";
  if (/seed/.test(s)) return "Seed";
  if (/series\s*a/.test(s)) return "Series A";
  if (/series\s*b/.test(s)) return "Series B";
  if (/series\s*c/.test(s)) return "Series C";
  if (/series\s*[d-z]/.test(s)) return "Series D+";
  return "Other";
}

/**
 * One row per investor, counting only their AI-services bets but keeping the
 * all-sector count beside it so a firm that made one AI bet out of forty is
 * not mistaken for an AI specialist.
 */
export function rollUpInvestors(deals) {
  const acc = new Map();

  for (const deal of deals) {
    for (const name of deal.investors) {
      const key = investorKey(name);
      if (!key) continue;
      let row = acc.get(key);
      if (!row) {
        row = {
          key,
          spellings: new Map(),
          allDeals: 0,
          serviceDeals: [],
          aiDeals: 0,
          sectors: new Map(),
        };
        acc.set(key, row);
      }
      row.spellings.set(name, (row.spellings.get(name) ?? 0) + 1);
      row.allDeals++;
      if (deal.isAI) row.aiDeals++;
      row.sectors.set(deal.sector, (row.sectors.get(deal.sector) ?? 0) + 1);
      if (deal.isAIService) row.serviceDeals.push(deal);
    }
  }

  const rows = [];
  for (const row of acc.values()) {
    if (row.serviceDeals.length === 0) continue;
    const bets = row.serviceDeals;
    const disclosed = bets.filter((d) => d.amountUsdMn != null);
    const stages = new Map();
    for (const d of bets) {
      const s = normaliseStage(d.roundType);
      stages.set(s, (stages.get(s) ?? 0) + 1);
    }
    const dates = bets.map((d) => d.date).sort();
    rows.push({
      name: preferredSpelling(row.spellings),
      key: row.key,
      // How many AI-services rounds this firm appeared in.
      bets: bets.length,
      // Rounds where a size was published. The rest are real bets with an
      // unknown size, so they are counted above but not in the money column.
      disclosedBets: disclosed.length,
      // Combined size of those rounds — NOT this firm's own cheque.
      roundValueUsdMn: Math.round(disclosed.reduce((a, d) => a + d.amountUsdMn, 0) * 10) / 10,
      medianRoundUsdMn: median(disclosed.map((d) => d.amountUsdMn)),
      allDeals: row.allDeals,
      aiDeals: row.aiDeals,
      aiShare: Math.round((row.aiDeals / row.allDeals) * 100),
      stages: STAGE_ORDER.filter((s) => stages.has(s)).map((s) => ({ stage: s, count: stages.get(s) })),
      firstBet: dates[0],
      lastBet: dates[dates.length - 1],
      companies: bets
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((d) => ({
          name: d.name,
          date: d.date,
          amountUsdMn: d.amountUsdMn,
          stage: normaliseStage(d.roundType),
          source: d.source,
        })),
    });
  }

  return rows.sort(
    (a, b) => b.bets - a.bets || b.roundValueUsdMn - a.roundValueUsdMn || a.name.localeCompare(b.name),
  );
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}

/** Month buckets, oldest first, for the one time-series on the page. */
export function monthlySeries(deals) {
  const months = new Map();
  for (const d of deals) {
    const m = d.date.slice(0, 7);
    let row = months.get(m);
    if (!row) months.set(m, (row = { month: m, all: 0, ai: 0, service: 0, serviceUsdMn: 0 }));
    row.all++;
    if (d.isAI) row.ai++;
    if (d.isAIService) {
      row.service++;
      if (d.amountUsdMn != null) row.serviceUsdMn += d.amountUsdMn;
    }
  }
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ ...r, serviceUsdMn: Math.round(r.serviceUsdMn * 10) / 10 }));
}

export function summarise(deals, investors, { sinceIso, months }) {
  const service = deals.filter((d) => d.isAIService);
  const disclosed = service.filter((d) => d.amountUsdMn != null);
  const companies = new Set(service.map((d) => d.name.toLowerCase()));
  return {
    windowStart: sinceIso,
    windowMonths: months,
    totalDeals: deals.length,
    aiDeals: deals.filter((d) => d.isAI).length,
    serviceDeals: service.length,
    serviceCompanies: companies.size,
    serviceInvestors: investors.length,
    // Sum of the rounds themselves — each round counted once, unlike the
    // per-investor column, which would double-count every co-investment.
    serviceRoundValueUsdMn: Math.round(disclosed.reduce((a, d) => a + d.amountUsdMn, 0) * 10) / 10,
    serviceDisclosedDeals: disclosed.length,
    serviceUndisclosedDeals: service.length - disclosed.length,
    medianServiceRoundUsdMn: median(disclosed.map((d) => d.amountUsdMn)),
    stages: STAGE_ORDER.map((stage) => ({
      stage,
      count: service.filter((d) => normaliseStage(d.roundType) === stage).length,
    })).filter((s) => s.count > 0),
    monthly: monthlySeries(deals),
  };
}
