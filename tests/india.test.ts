import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs modules, shared with the build script
import { parseAmountUsdMn, parseInvestors, parseDealDate, parseArticle } from "../scripts/adapters/inc42.mjs";
// @ts-expect-error — plain .mjs modules, shared with the build script
import { aiLayerOf, classifyDeal, normaliseSector, normaliseStage, rollUpInvestors } from "../scripts/india.mjs";

describe("parseAmountUsdMn", () => {
  it("reads the units Inc42 actually writes", () => {
    expect(parseAmountUsdMn("$100 Mn")).toBe(100);
    expect(parseAmountUsdMn("$1.2 Bn")).toBe(1200);
    expect(parseAmountUsdMn("$178 K")).toBeCloseTo(0.178);
    expect(parseAmountUsdMn("$1,250 Mn")).toBe(1250);
  });

  it("returns null, not zero, when no size was published", () => {
    // A zero here would quietly drag every average down and make an
    // undisclosed round look like a round worth nothing.
    expect(parseAmountUsdMn("Undisclosed")).toBeNull();
    expect(parseAmountUsdMn("")).toBeNull();
    expect(parseAmountUsdMn("-")).toBeNull();
  });
});

describe("parseInvestors", () => {
  it("splits the list and drops the trailing 'and'", () => {
    expect(parseInvestors("Bertelsmann India Investments, Accel, Bain Capital Ventures, and Hara Global")).toEqual([
      "Bertelsmann India Investments",
      "Accel",
      "Bain Capital Ventures",
      "Hara Global",
    ]);
  });

  it("drops entries that name no firm", () => {
    expect(parseInvestors("Multiple angels and family offices")).toEqual([]);
    expect(parseInvestors("Peak XV Partners, Existing Angle Investors")).toEqual(["Peak XV Partners"]);
    expect(parseInvestors("ajvc, angels")).toEqual(["ajvc"]);
  });

  it("keeps a firm whose name contains an ampersand", () => {
    expect(parseInvestors("Kae Capital")).toEqual(["Kae Capital"]);
  });
});

describe("parseDealDate", () => {
  it("reads the date and ignores the late-report asterisk", () => {
    expect(parseDealDate("7 Sep 2026")).toBe("2026-09-07");
    expect(parseDealDate("7 Sep 2026 *")).toBe("2026-09-07");
    expect(parseDealDate("garbage")).toBeNull();
  });
});

describe("parseArticle", () => {
  const html = `
    <table><tr><th>Date</th><th>Name</th><th>Sector</th><th>Subsector</th>
    <th>Business Model</th><th>Funding Round Size</th><th>Funding Round Type</th><th>Investors</th></tr>
    <tr><td>7 Sep 2026</td><td>Graph AI</td><td>AI</td><td>Application Layer</td>
    <td>B2B</td><td>$13.3 Mn</td><td>Series A</td><td>Insight Partners, Bessemer Venture Partners</td></tr>
    <tr><td>8 Sep 2026</td><td>NoDate Co</td><td>AI</td><td>Application Layer</td>
    <td>B2B</td><td>Undisclosed</td><td>-</td><td>Accel</td></tr></table>`;

  it("parses the deal table into rows", () => {
    const rows = parseArticle(html, "https://example.test/a");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-09-07",
      name: "Graph AI",
      sector: "AI",
      subsector: "Application Layer",
      amountUsdMn: 13.3,
      roundType: "Series A",
      source: "https://example.test/a",
    });
    // A dash is absence, not a stage called "-".
    expect(rows[1].roundType).toBe("");
    expect(rows[1].amountUsdMn).toBeNull();
  });

  it("ignores a table that is not the deal table", () => {
    expect(parseArticle("<table><tr><td>unrelated</td></tr></table>", "u")).toEqual([]);
  });
});

describe("aiLayerOf", () => {
  it("matches the correct spelling and Inc42's typo alike", () => {
    // The whole AI-services count hangs on this: 125 of 133 AI deals are
    // labelled "Application Layer", so a regex that misses it silently
    // reports three bets instead of a hundred and nine.
    expect(aiLayerOf("Application Layer")).toBe("application");
    expect(aiLayerOf("Aplication Layer")).toBe("application");
    expect(aiLayerOf("Application layer")).toBe("application");
    expect(aiLayerOf("AI Infrastructure & Development")).toBe("infrastructure");
    expect(aiLayerOf("Foundation Model/ LLM")).toBe("foundation");
    expect(aiLayerOf("Spacetech")).toBe("");
  });
});

describe("normaliseSector", () => {
  it("folds the spelling variants Inc42 uses", () => {
    expect(normaliseSector("Cleantech")).toBe("Clean Tech");
    expect(normaliseSector("Clean Tech")).toBe("Clean Tech");
    expect(normaliseSector("Enterprisetech")).toBe("Enterprise Tech");
    expect(normaliseSector("Ecommerce***")).toBe("Ecommerce");
    expect(normaliseSector("Advanced Technology & Hardware")).toBe("Advanced Hardware");
  });
});

describe("normaliseStage", () => {
  it("does not read 'Pre-Series A' as 'Series A'", () => {
    expect(normaliseStage("Pre-Series A")).toBe("Pre-Series A");
    expect(normaliseStage("Series A")).toBe("Series A");
    expect(normaliseStage("Pre-seed")).toBe("Pre-seed");
    expect(normaliseStage("Seed")).toBe("Seed");
    expect(normaliseStage("")).toBe("Other");
  });
});

describe("classifyDeal", () => {
  const deal = (over: Record<string, unknown>) => ({
    date: "2026-01-01", name: "X", sector: "AI", subsector: "Application Layer",
    businessModel: "B2B", amountUsdMn: 1, roundType: "Seed", investors: ["A"], ...over,
  });

  it("counts application-layer B2B AI as a service company", () => {
    expect(classifyDeal(deal({})).isAIService).toBe(true);
  });

  it("excludes infrastructure and foundation models", () => {
    // These sell capability to builders, not an outcome to a buyer.
    expect(classifyDeal(deal({ subsector: "AI Infrastructure & Development" })).isAIService).toBe(false);
    expect(classifyDeal(deal({ subsector: "Foundation Model/ LLM" })).isAIService).toBe(false);
  });

  it("excludes consumer AI and non-AI sectors", () => {
    expect(classifyDeal(deal({ businessModel: "B2C" })).isAIService).toBe(false);
    expect(classifyDeal(deal({ sector: "Fintech" })).isAIService).toBe(false);
  });

  it("still marks non-service AI deals as AI", () => {
    const d = classifyDeal(deal({ businessModel: "B2C" }));
    expect(d.isAI).toBe(true);
    expect(d.isAIService).toBe(false);
  });
});

describe("rollUpInvestors", () => {
  const svc = (name: string, investors: string[], amount: number | null, date = "2026-01-01") =>
    classifyDeal({
      date, name, sector: "AI", subsector: "Application Layer", businessModel: "B2B",
      amountUsdMn: amount, roundType: "Seed", investors, source: "u",
    });

  it("folds spelling variants into one firm", () => {
    const rows = rollUpInvestors([svc("A", ["ajvc"], 1), svc("B", ["AJVC"], 2)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].bets).toBe(2);
  });

  it("keeps genuinely different funds apart", () => {
    // "Antler" and "Antler India" are separate vehicles in the source.
    const rows = rollUpInvestors([svc("A", ["Antler"], 1), svc("B", ["Antler India"], 2)]);
    expect(rows).toHaveLength(2);
  });

  it("counts an undisclosed round as a bet but not as money", () => {
    const rows = rollUpInvestors([svc("A", ["Accel"], null), svc("B", ["Accel"], 10)]);
    expect(rows[0].bets).toBe(2);
    expect(rows[0].disclosedBets).toBe(1);
    expect(rows[0].roundValueUsdMn).toBe(10);
  });

  it("gives every co-investor the whole round, and labels it as the round's size", () => {
    // Deliberate: we do not know the split, so we do not invent one. The
    // field is named roundValueUsdMn for exactly this reason, and the page
    // must never call it capital deployed.
    const rows = rollUpInvestors([svc("A", ["X", "Y"], 100)]);
    expect(rows.map((r) => r.roundValueUsdMn)).toEqual([100, 100]);
  });

  it("omits firms with no AI-services bet", () => {
    const nonService = classifyDeal({
      date: "2026-01-01", name: "C", sector: "Fintech", subsector: "", businessModel: "B2B",
      amountUsdMn: 5, roundType: "Seed", investors: ["OnlyFintech"], source: "u",
    });
    const rows = rollUpInvestors([nonService, svc("A", ["Accel"], 1)]);
    expect(rows.map((r) => r.name)).toEqual(["Accel"]);
  });

  it("reports AI share against the firm's whole deal count", () => {
    const nonAI = classifyDeal({
      date: "2026-01-01", name: "C", sector: "Fintech", subsector: "", businessModel: "B2B",
      amountUsdMn: 5, roundType: "Seed", investors: ["Accel"], source: "u",
    });
    const rows = rollUpInvestors([nonAI, svc("A", ["Accel"], 1)]);
    expect(rows[0].allDeals).toBe(2);
    expect(rows[0].aiDeals).toBe(1);
    expect(rows[0].aiShare).toBe(50);
  });

  it("ranks by bet count, then by round value", () => {
    const rows = rollUpInvestors([
      svc("A", ["Few"], 500),
      svc("B", ["Many"], 1), svc("C", ["Many"], 1),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Many", "Few"]);
  });
});
