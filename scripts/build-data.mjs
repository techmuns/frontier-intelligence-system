#!/usr/bin/env node
//
// Builds the dashboard's bundled datasets from the public YC API
// (yc-oss/api, a daily mirror of YC's public Algolia index).
//
// Produces two files, deliberately split by size:
//
//   src/data/yc-companies.json  — full records, current batches only. Powers
//                                 the company explorer and detail view.
//   src/data/yc-trends.json     — per-batch aggregates for a much longer
//                                 history. Powers the momentum/trend charts.
//                                 Aggregates instead of full records keeps
//                                 ~3k companies from bloating the bundle.
//
// Run: node scripts/build-data.mjs

import { writeFile } from "node:fs/promises";
import {
  PARTIAL_BATCH_THRESHOLD,
  isAI,
  isRobotics,
  isRoboticsLabelled,
  hasAiTag,
} from "./classify.mjs";
import { classifyCompany, CLASSIFIER_VERSION, INDUSTRY_TERMS } from "./dimensions.mjs";
import { discoverThemes, THEME_ENGINE_VERSION } from "./themes.mjs";
import { scoreTheme, MOMENTUM_FORMULA } from "./momentum.mjs";
import { buildMatrix, findEmptyCells, dependencyGaps, WHITESPACE_VERSION } from "./whitespace.mjs";
import { detectTransitions, detectSignals, findNonObvious, SIGNALS_VERSION } from "./signals.mjs";
import { computeVelocity, VELOCITY_VERSION } from "./velocity.mjs";
import { readFile } from "node:fs/promises";

const API = "https://yc-oss.github.io/api/batches";

// Full company records are bundled for these (the batches the explorer shows).
const CURRENT_BATCHES = [
  "winter-2026",
  "spring-2026",
  "summer-2026",
  "fall-2026",
  "winter-2027",
];

// Aggregates are computed for this longer window, oldest first, to give the
// trend charts a real baseline. Momentum is meaningless without one.
const TREND_BATCHES = [
  "winter-2022",
  "summer-2022",
  "winter-2023",
  "summer-2023",
  "winter-2024",
  "summer-2024",
  "fall-2024",
  "winter-2025",
  "spring-2025",
  "summer-2025",
  "fall-2025",
  "winter-2026",
  "spring-2026",
  "summer-2026",
  "fall-2026",
  "winter-2027",
];

// Fields kept in the bundled full records — everything the UI actually reads.
const FIELDS = [
  "id", "name", "slug", "website", "all_locations", "one_liner",
  "long_description", "team_size", "industry", "subindustry", "industries",
  "tags", "top_company", "isHiring", "nonprofit", "batch", "status", "stage",
  "launched_at", "url",
];

// Classification rules and thresholds live in ./classify.mjs so they can be
// unit-tested without triggering this script's network fetches.

async function fetchBatch(slug) {
  const res = await fetch(`${API}/${slug}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${slug}: HTTP ${res.status}`);
  return res.json();
}

function countBy(companies, getKeys) {
  const counts = new Map();
  for (const c of companies) {
    for (const key of getKeys(c)) {
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function topN(counts, n) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

async function main() {
  console.log("Fetching batches…");
  const byBatch = new Map();
  for (const slug of [...new Set([...CURRENT_BATCHES, ...TREND_BATCHES])]) {
    byBatch.set(slug, await fetchBatch(slug));
    process.stdout.write(`  ${slug}: ${byBatch.get(slug).length}\n`);
  }

  // --- Full records for the current batches ---
  const seen = new Set();
  const companies = [];
  for (const slug of CURRENT_BATCHES) {
    for (const c of byBatch.get(slug)) {
      if (seen.has(c.slug)) continue; // dedupe by YC slug
      seen.add(c.slug);
      // Classification is resolved here, once, so the UI never re-implements
      // these rules and the two datasets can't drift apart.
      companies.push(withDimensions({
        ...Object.fromEntries(FIELDS.map((f) => [f, c[f] ?? null])),
        isAI: isAI(c),
        isRobotics: isRobotics(c),
      }));
    }
  }

  // --- Per-batch aggregates across the longer history ---
  // Shares are computed against each batch's own observed total, so a
  // partially-announced batch is still comparable on composition even
  // though its absolute count is not.
  const trends = TREND_BATCHES.map((slug) => {
    const list = byBatch.get(slug);
    const total = list.length;
    const industries = countBy(list, (c) => [c.industry]);
    const tags = countBy(list, (c) => c.tags ?? []);
    const teamSizes = list.map((c) => c.team_size).filter((n) => typeof n === "number" && n > 0);

    // Tag coverage varies wildly by batch — some recent batches have >75% of
    // companies with no tags at all, because YC hasn't finished tagging them.
    // Tag share MUST therefore be measured against the tagged subset, not the
    // batch total: dividing by total makes an untagged batch look like a
    // collapse in whatever the tag measures, which is a data artifact, not a
    // market movement. taggedCount is carried through so the UI can say how
    // thin the evidence is rather than quietly implying a trend.
    const taggedCount = list.filter((c) => (c.tags ?? []).length > 0).length;

    // Subindustry is where the actual rotation shows up — a flat "Industrials"
    // share hides that its composition changed completely. YC formats these as
    // "Parent -> Child"; keep the full label so children of different parents
    // can't collide (e.g. Energy appears under more than one).
    const subindustries = countBy(list, (c) => [c.subindustry]);

    return {
      slug,
      batch: list[0]?.batch ?? slug,
      total,
      partial: total < PARTIAL_BATCH_THRESHOLD,
      taggedCount,
      hiring: list.filter((c) => c.isHiring).length,
      medianTeamSize: median(teamSizes),
      industries: Object.fromEntries(industries),
      subindustries: Object.fromEntries(subindustries),
      // Both are carried so the UI can show what YC's own taxonomy reports
      // alongside the corrected count, rather than silently replacing one
      // with the other.
      roboticsLabelled: list.filter(isRoboticsLabelled).length,
      roboticsTotal: list.filter(isRobotics).length,
      // Same pairing for AI: what tags alone report, and the corrected count.
      aiTagged: list.filter(hasAiTag).length,
      aiTotal: list.filter(isAI).length,
      topTags: topN(tags, 25),
    };
  });

  // --- Intelligence layer (§6-§11 dimensions, §12 themes, §18 momentum,
  // §24-§25 white space). Runs over EVERY batch, not just the current ones:
  // momentum is meaningless without the historical baseline.
  const allCompanies = [];
  const seenAll = new Set();
  for (const slug of TREND_BATCHES) {
    for (const c of byBatch.get(slug)) {
      if (seenAll.has(c.slug)) continue;
      seenAll.add(c.slug);
      allCompanies.push({ ...c, dimensions: classifyCompany(c) });
    }
  }
  console.log(`\nClassified ${allCompanies.length} companies across ${TREND_BATCHES.length} batches.`);

  // Company velocity needs the observation store the adapters populate
  // (scripts/enrich.mjs). Absent, velocity is simply unavailable rather than
  // fabricated — the dashboard says so.
  let observations = [];
  try {
    observations = JSON.parse(await readFile("src/data/observations.json", "utf8")).observations ?? [];
  } catch {
    console.log("No observation store yet — run `npm run enrich` to populate company velocity.");
  }

  const intelligence = buildIntelligence(allCompanies, trends, companies, observations);

  await writeFile("src/data/yc-companies.json", JSON.stringify(companies));
  await writeFile("src/data/yc-trends.json", JSON.stringify(trends));
  await writeFile("src/data/intelligence.json", JSON.stringify(intelligence));

  console.log(`\nWrote ${companies.length} full company records.`);
  console.log(`Wrote aggregates for ${trends.length} batches (${trends.reduce((s, t) => s + t.total, 0)} companies observed).`);
  console.log(`Wrote ${intelligence.themes.length} discovered themes, ${intelligence.dependencyGaps.length} dependency gaps.`);
}

// Attach dimension classification to the bundled current-batch records too,
// so the company detail view can show them without re-running the rules.
function withDimensions(company) {
  return { ...company, dimensions: classifyCompany(company) };
}

function buildIntelligence(allCompanies, trends, currentCompanies, observations) {
  const batchOrder = trends.map((t) => t.batch);
  const totalsByBatch = Object.fromEntries(trends.map((t) => [t.batch, t.total]));
  const recentBatches = batchOrder.slice(-4);

  // Momentum is computed only over cohorts big enough for a share to be
  // meaningful. A 1-company batch gives whatever theme it lands in a 100%
  // share, which detonates the second derivative and floats noise to the top
  // of the rankings — the §16 partial-batch trap arriving via a derivative.
  const MIN_COHORT_FOR_MOMENTUM = 50;
  const momentumBatches = trends
    .filter((t) => t.total >= MIN_COHORT_FOR_MOMENTUM)
    .map((t) => t.batch);

  // --- §12 Dynamic themes, discovered from company text ---
  const { themes, unassigned, params } = discoverThemes(allCompanies, { maxThemes: 40 });
  const bySlug = new Map(allCompanies.map((c) => [c.slug, c]));

  // --- §18/§19 Momentum per theme, over the full batch history ---
  const scored = themes.map((theme) => {
    const members = theme.companySlugs.map((s) => bySlug.get(s)).filter(Boolean);

    // Full history for display, but only the sound cohorts for scoring.
    const counts = batchOrder.map((b) => members.filter((m) => m.batch === b).length);
    const shares = batchOrder.map((b, i) => (totalsByBatch[b] ? counts[i] / totalsByBatch[b] : 0));

    const scoringCounts = momentumBatches.map((b) => members.filter((m) => m.batch === b).length);
    const scoringShares = momentumBatches.map((b, i) => scoringCounts[i] / totalsByBatch[b]);

    const autonomyByBatch = momentumBatches.map((b) => {
      const levels = members
        .filter((m) => m.batch === b)
        .map((m) => m.dimensions.autonomy.level)
        .filter((l) => l !== null);
      return levels.length ? levels.reduce((a, x) => a + x, 0) / levels.length : null;
    });

    const sectors = new Set(members.map((m) => m.industry).filter(Boolean));

    const momentum = scoreTheme({
      shares: scoringShares,
      counts: scoringCounts,
      autonomy: autonomyByBatch,
      sectorCount: sectors.size,
    });

    // Capability demand for this theme drives §25.
    const capabilityDemand = {};
    for (const m of members) {
      for (const dep of m.dimensions.dependsOn ?? []) {
        capabilityDemand[dep.label] = (capabilityDemand[dep.label] ?? 0) + 1;
      }
    }

    return {
      ...theme,
      // Kept for §26: the transition detector needs per-cohort autonomy with
      // sample sizes, so it can ignore windows too thin to claim movement.
      autonomyByBatch: momentumBatches.map((b, i) => {
        const inBatch = members.filter((m) => m.batch === b);
        const levels = inBatch.map((m) => m.dimensions.autonomy.level).filter((l) => l !== null);
        return { batch: b, n: levels.length, mean: levels.length ? levels.reduce((a, x) => a + x, 0) / levels.length : null };
      }),
      counts,
      shares: shares.map((s) => Math.round(s * 10000) / 10000),
      momentum,
      sectors: [...sectors],
      autonomyMean: avgOf(members.map((m) => m.dimensions.autonomy.level)),
      capabilityDemand,
      // Competition proxy: how many companies already occupy the theme.
      competition: members.length,
    };
  }).sort((a, b) => b.momentum.score - a.momentum.score);

  // --- §6-§11 Dimension distributions, current vs earliest cohort ---
  const dimensionShift = buildDimensionShift(allCompanies, batchOrder);

  // --- §24 White space matrices ---
  const industryOf = (c) => c.industry ?? null;
  const autonomyOf = (c) => (c.dimensions.autonomy.level !== null ? `L${c.dimensions.autonomy.level} ${c.dimensions.autonomy.label}` : null);
  const stackOf = (c) => c.dimensions.stackPosition.label;

  const sectorAutonomy = buildMatrix(allCompanies, industryOf, autonomyOf);
  const sectorStack = buildMatrix(allCompanies, industryOf, stackOf);

  // §32 — human role × industry, valued by company count and mean autonomy.
  const laborMap = buildLaborMap(allCompanies);

  const gaps = dependencyGaps(allCompanies, { recentBatches });
  const transitions = detectTransitions(scored);
  const nonObvious = findNonObvious({ themes: scored, dependencyGaps: gaps, transitions });
  const signals = detectSignals({
    themes: scored,
    transitions,
    dependencyGaps: gaps,
    dimensionShift,
    batchOrder,
  });

  return {
    generatedAt: new Date().toISOString(),
    versions: {
      classifier: CLASSIFIER_VERSION,
      themes: THEME_ENGINE_VERSION,
      momentum: MOMENTUM_FORMULA.version,
      whitespace: WHITESPACE_VERSION,
      signals: SIGNALS_VERSION,
      velocity: VELOCITY_VERSION,
    },
    batchOrder,
    themeParams: params,
    momentumBatches,
    themesUnassigned: unassigned,
    themes: scored,
    dimensionShift,
    momentumFormula: MOMENTUM_FORMULA,
    matrices: {
      sectorAutonomy: { ...sectorAutonomy, empty: findEmptyCells(sectorAutonomy) },
      sectorStack: { ...sectorStack, empty: findEmptyCells(sectorStack) },
    },
    dependencyGaps: gaps,
    // §32 Digital Labor Map — which jobs are becoming software.
    laborMap,
    // §34 Infrastructure Map — capabilities, and which themes lean on each.
    infrastructureMap: buildInfrastructureMap(allCompanies, scored),
    // §35 Physical AI Map — the physical chain, by industry.
    physicalMap: buildPhysicalMap(allCompanies),
    // §26 / §40 / §41
    transitions,
    signals,
    nonObvious,
    // §20-§22 Company velocity, from the adapter observation store.
    velocity: computeVelocity(currentCompanies, observations)
      .filter((v) => v.standingScore !== null)
      .sort((a, b) => b.standingScore - a.standingScore),
    observationMeta: {
      total: observations.length,
      dates: [...new Set(observations.map((o) => o.observedAt.slice(0, 10)))].sort(),
      resolved: observations.filter((o) => o.value !== null).length,
    },
  };
}

/** §29 "where is the world moving" — the big directional splits, earliest
 *  full cohort vs most recent full cohort. */
function buildDimensionShift(allCompanies, batchOrder) {
  const first = batchOrder[0];
  // Last batch big enough to be worth comparing (partial cohorts are noise).
  const last = [...batchOrder].reverse().find((b) => allCompanies.filter((c) => c.batch === b).length >= 100);

  const axes = [
    { id: "infra_vs_app", label: "Infrastructure vs Application", a: "Infrastructure", b: "Application",
      test: (c) => ["foundational", "intelligence", "data", "infrastructure"].includes(c.dimensions.stackPosition.layer) ? "Infrastructure"
        : ["applications", "operating_systems", "operators"].includes(c.dimensions.stackPosition.layer) ? "Application" : null },
    { id: "horiz_vs_vert", label: "Horizontal vs Vertical", a: "Horizontal", b: "Vertical",
      test: (c) => c.dimensions.stackPosition.id === "horizontal_application" ? "Horizontal"
        : c.dimensions.stackPosition.id === "vertical_application" ? "Vertical" : null },
    { id: "digital_vs_physical", label: "Digital vs Physical", a: "Digital", b: "Physical",
      test: (c) => c.dimensions.physicality.value === "Digital" ? "Digital"
        : c.dimensions.physicality.value === "Physical" ? "Physical" : null },
    { id: "copilot_vs_autonomous", label: "Copilot vs Autonomous", a: "Copilot", b: "Autonomous",
      test: (c) => { const l = c.dimensions.autonomy.level; return l === null ? null : l <= 1 ? "Copilot" : l >= 3 ? "Autonomous" : null; } },
    { id: "software_vs_operator", label: "Software vs AI-Native Operator", a: "Software", b: "Operator",
      test: (c) => c.dimensions.stackPosition.id === "ai_native_operator" ? "Operator"
        : c.dimensions.stackPosition.layer === "applications" ? "Software" : null },
  ];

  return axes.map((axis) => {
    const at = (batch) => {
      const pool = allCompanies.filter((c) => c.batch === batch);
      const labelled = pool.map(axis.test).filter(Boolean);
      const bCount = labelled.filter((x) => x === axis.b).length;
      return { batch, n: labelled.length, bShare: labelled.length ? bCount / labelled.length : null };
    };
    const from = at(first);
    const to = at(last);
    return {
      id: axis.id,
      label: axis.label,
      poles: [axis.a, axis.b],
      from,
      to,
      deltaPct: from.bShare !== null && to.bShare !== null
        ? Math.round((to.bShare - from.bShare) * 1000) / 10
        : null,
    };
  });
}

/** §32 — roles as rows, industries as columns. A cell carries both how many
 *  companies target that job in that industry and how far up the autonomy
 *  ladder they sit, because "crowded" and "being fully replaced" are
 *  different facts about the same job. */
function buildLaborMap(allCompanies) {
  const cells = new Map();
  const roleTotals = new Map();
  const industryTotals = new Map();

  for (const c of allCompanies) {
    const role = c.dimensions.humanRole;
    if (!role?.id) continue;
    const industry = c.industry ?? c.dimensions.inferredIndustry?.label;
    if (!industry) continue;

    const key = `${role.label}||${industry}`;
    const cell = cells.get(key) ?? { count: 0, autonomySum: 0, autonomyN: 0, examples: [] };
    cell.count += 1;
    const lvl = c.dimensions.autonomy.level;
    if (lvl !== null) {
      cell.autonomySum += lvl;
      cell.autonomyN += 1;
    }
    if (cell.examples.length < 3) cell.examples.push(c.name);
    cells.set(key, cell);

    roleTotals.set(role.label, (roleTotals.get(role.label) ?? 0) + 1);
    industryTotals.set(industry, (industryTotals.get(industry) ?? 0) + 1);
  }

  return {
    roles: [...roleTotals.keys()].sort((a, b) => roleTotals.get(b) - roleTotals.get(a)),
    industries: [...industryTotals.keys()].sort((a, b) => industryTotals.get(b) - industryTotals.get(a)),
    roleTotals: Object.fromEntries(roleTotals),
    industryTotals: Object.fromEntries(industryTotals),
    cells: Object.fromEntries(
      [...cells.entries()].map(([k, v]) => [k, {
        count: v.count,
        autonomy: v.autonomyN ? Math.round((v.autonomySum / v.autonomyN) * 10) / 10 : null,
        examples: v.examples,
      }]),
    ),
  };
}

/** §34 — infrastructure broken into capabilities rather than one "AI infra"
 *  bucket, with the application themes that depend on each. */
function buildInfrastructureMap(allCompanies, themes) {
  const byCapability = new Map();

  for (const c of allCompanies) {
    for (const sup of c.dimensions.supplies ?? []) {
      const entry = byCapability.get(sup.id) ?? { id: sup.id, label: sup.label, suppliers: [], dependentThemes: [] };
      if (entry.suppliers.length < 5) entry.suppliers.push({ name: c.name, one_liner: c.one_liner });
      entry.supplyCount = (entry.supplyCount ?? 0) + 1;
      byCapability.set(sup.id, entry);
    }
  }

  for (const theme of themes) {
    for (const [label, count] of Object.entries(theme.capabilityDemand)) {
      const match = [...byCapability.values()].find((e) => e.label === label);
      if (match && count >= 3) {
        match.dependentThemes.push({ id: theme.id, label: theme.label, dependents: count, momentum: theme.momentum.score });
      }
    }
  }

  return [...byCapability.values()]
    .map((e) => ({
      ...e,
      supplyCount: e.supplyCount ?? 0,
      dependentThemes: e.dependentThemes.sort((a, b) => b.dependents - a.dependents).slice(0, 5),
    }))
    .sort((a, b) => b.dependentThemes.length - a.dependentThemes.length);
}

/** §35 — the physical chain, and which industries each stage shows up in. */
function buildPhysicalMap(allCompanies) {
  const CHAIN = [
    { id: "physical_data", label: "Physical Data" },
    { id: "simulation", label: "Simulation" },
    { id: "world_model", label: "World Models" },
    { id: "sensing", label: "Sensing" },
    { id: "control", label: "Control" },
    { id: "actuator", label: "Actuators" },
    { id: "robot", label: "Robots" },
    { id: "fleet", label: "Autonomous Fleets" },
  ];

  return CHAIN.map((stage) => {
    const members = allCompanies.filter((c) =>
      (c.dimensions.physicalCapabilities ?? []).some((p) => p.id === stage.id),
    );
    const industries = {};
    for (const m of members) {
      const ind = m.industry ?? m.dimensions.inferredIndustry?.label;
      if (ind) industries[ind] = (industries[ind] ?? 0) + 1;
    }
    return {
      ...stage,
      count: members.length,
      industries,
      examples: members.slice(0, 18).map((m) => ({ name: m.name, one_liner: m.one_liner })),
    };
  });
}

function avgOf(values) {
  const v = values.filter((x) => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
