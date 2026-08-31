import { describe, it, expect } from "vitest";
import {
  trends,
  tagShareSeries,
  industryShareSeries,
  aiSeries,
  aiMethodComparison,
  roboticsSeries,
  biggestIndustryShifts,
  isLowCoverage,
  tagCoverage,
} from "../src/data/trends";
import {
  companies,
  companiesByBatch,
  teamSizeDistribution,
  teamSizeReportedCount,
  medianTeamSize,
  topSubindustries,
  topCountries,
} from "../src/data/companies";

describe("bundled trend data", () => {
  it("covers a real historical baseline, oldest first", () => {
    expect(trends.length).toBeGreaterThanOrEqual(16);
    expect(trends[0].batch).toBe("Winter 2022");
    expect(trends.at(-1)!.batch).toBe("Winter 2027");
  });

  it("never reports more classified companies than exist in the batch", () => {
    for (const b of trends) {
      expect(b.taggedCount).toBeLessThanOrEqual(b.total);
      expect(b.aiTotal).toBeLessThanOrEqual(b.total);
      expect(b.roboticsTotal).toBeLessThanOrEqual(b.total);
      expect(b.hiring).toBeLessThanOrEqual(b.total);
    }
  });

  it("counts at least as many robotics companies as YC labels", () => {
    // The corrected count is a superset of YC's label by construction.
    for (const b of trends) {
      expect(b.roboticsTotal).toBeGreaterThanOrEqual(b.roboticsLabelled);
    }
  });

  it("counts at least as many AI companies as the AI tag alone", () => {
    for (const b of trends) {
      expect(b.aiTotal).toBeGreaterThanOrEqual(b.aiTagged);
    }
  });

  it("flags batches that are still filling", () => {
    const bySlug = Object.fromEntries(trends.map((b) => [b.slug, b]));
    expect(bySlug["winter-2027"].partial).toBe(true); // barely started
    expect(bySlug["winter-2022"].partial).toBe(false); // long complete
  });
});

describe("tag coverage handling", () => {
  it("identifies the batches whose tags are too sparse to read a share from", () => {
    const bySlug = Object.fromEntries(trends.map((b) => [b.slug, b]));
    // These two are ~23% tagged — the artifact that made AI look like it
    // collapsed when measured from tags.
    expect(isLowCoverage(bySlug["winter-2026"])).toBe(true);
    expect(isLowCoverage(bySlug["spring-2026"])).toBe(true);
    expect(isLowCoverage(bySlug["summer-2026"])).toBe(false);
  });

  it("measures tag share against the tagged subset, not the batch total", () => {
    const series = tagShareSeries(["AI", "Artificial Intelligence"]);
    const w26 = series.find((s) => s.batch === "Winter 2026")!;
    const source = trends.find((b) => b.slug === "winter-2026")!;
    // Dividing by total would give a far smaller number and imply a collapse.
    const againstTotal = (source.topTags.filter((t) => /^(ai|artificial intelligence)$/i.test(t.name))
      .reduce((s, t) => s + t.count, 0) / source.total) * 100;
    expect(w26.value).toBeGreaterThan(againstTotal);
    expect(w26.lowCoverage).toBe(true);
  });

  it("returns a gap, not a fabricated zero, when nothing is tagged", () => {
    const series = tagShareSeries(["AI"]);
    for (const point of series) {
      const source = trends.find((b) => b.batch === point.batch)!;
      if (source.taggedCount === 0) expect(point.value).toBeNull();
    }
  });
});

describe("AI measurement", () => {
  it("is coverage-independent, unlike the tag-derived series", () => {
    const method = aiMethodComparison();
    const w26 = method.find((m) => m.batch === "Winter 2026")!;
    // The whole reason tags were retired: at ~23% coverage the tag line
    // craters while the one-liner line does not.
    expect(w26.tagCoverage).toBeLessThan(50);
    expect(w26["From one-liners"]!).toBeGreaterThan(w26["From YC tags"]! * 2);
  });

  it("shows saturation rather than collapse across the history", () => {
    const series = aiSeries();
    const first = series.find((s) => s.batch === "Winter 2022")!["AI share"]!;
    const late = series.find((s) => s.batch === "Summer 2026")!["AI share"]!;
    expect(first).toBeLessThan(50);
    expect(late).toBeGreaterThan(70);
  });
});

describe("share series", () => {
  it("keeps every industry share within 0-100", () => {
    const series = industryShareSeries(["B2B", "Industrials", "Fintech"]);
    for (const row of series) {
      for (const key of ["B2B", "Industrials", "Fintech"]) {
        const v = row[key] as number | null;
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("reports the robotics correction as never below YC's own label", () => {
    for (const row of roboticsSeries()) {
      if (row.Corrected !== null && row["YC label"] !== null) {
        expect(row.Corrected).toBeGreaterThanOrEqual(row["YC label"]);
      }
    }
  });

  it("ranks industry shifts by absolute movement", () => {
    const shifts = biggestIndustryShifts("winter-2022", "summer-2026", 6);
    expect(shifts.length).toBeGreaterThan(0);
    const magnitudes = shifts.map((s) => Math.abs(s.delta));
    expect([...magnitudes].sort((a, b) => b - a)).toEqual(magnitudes);
    // The headline finding should survive: Industrials up, Fintech down.
    expect(shifts.find((s) => s.name === "Industrials")!.delta).toBeGreaterThan(0);
    expect(shifts.find((s) => s.name === "Fintech")!.delta).toBeLessThan(0);
  });

  it("computes coverage as a fraction", () => {
    for (const b of trends) {
      expect(tagCoverage(b)).toBeGreaterThanOrEqual(0);
      expect(tagCoverage(b)).toBeLessThanOrEqual(1);
    }
  });
});

describe("bundled company data", () => {
  it("has records with the fields the UI reads", () => {
    expect(companies.length).toBeGreaterThan(600);
    for (const c of companies.slice(0, 50)) {
      expect(typeof c.name).toBe("string");
      expect(typeof c.slug).toBe("string");
      expect(typeof c.batch).toBe("string");
      expect(typeof c.isAI).toBe("boolean");
      expect(typeof c.isRobotics).toBe("boolean");
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = companies.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("accounts for every company in the batch breakdown", () => {
    const total = companiesByBatch(companies).reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(companies.length);
  });
});

describe("team size", () => {
  it("excludes unreported sizes rather than counting them as zero", () => {
    const reported = teamSizeReportedCount(companies);
    const distributed = teamSizeDistribution(companies).reduce((s, b) => s + b.count, 0);
    expect(distributed).toBe(reported);
    expect(reported).toBeLessThanOrEqual(companies.length);
  });

  it("puts every reported company in exactly one bucket", () => {
    const withSize = companies.filter((c) => typeof c.team_size === "number" && c.team_size > 0);
    const distributed = teamSizeDistribution(companies).reduce((s, b) => s + b.count, 0);
    expect(distributed).toBe(withSize.length);
  });

  it("reports a median within the observed range", () => {
    const sizes = companies
      .map((c) => c.team_size)
      .filter((n): n is number => typeof n === "number" && n > 0);
    const med = medianTeamSize(companies)!;
    expect(med).toBeGreaterThanOrEqual(Math.min(...sizes));
    expect(med).toBeLessThanOrEqual(Math.max(...sizes));
  });
});

describe("composition helpers", () => {
  it("strips YC's parent prefix from subindustry labels", () => {
    for (const s of topSubindustries(companies, 8)) {
      expect(s.name).not.toContain("->");
      expect(s.count).toBeGreaterThan(0);
    }
  });

  it("returns countries in descending order", () => {
    const counts = topCountries(companies, 6).map((c) => c.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});
