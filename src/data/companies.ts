import raw from "./yc-companies.json";

export interface Company {
  id: number;
  name: string;
  slug: string;
  website: string | null;
  all_locations: string | null;
  one_liner: string | null;
  long_description: string | null;
  team_size: number | null;
  industry: string | null;
  subindustry: string | null;
  industries: string[];
  tags: string[];
  top_company: boolean;
  isHiring: boolean;
  nonprofit: boolean;
  batch: string;
  status: string;
  stage: string | null;
  launched_at: number | null;
  url: string;
}

export const companies = raw as unknown as Company[];

// Source provenance — shown in the dashboard footer per the skill's
// "show source/provenance" rule. This is a static snapshot bundled at
// build time, not a live per-render fetch.
export const DATASET_SOURCE = {
  label: "Y Combinator public company directory",
  detail:
    "Mirrored from YC's public Algolia index (yc-oss/api), filtered to Winter 2026 – Winter 2027 batches",
  capturedAt: "2026-08-29",
};

// Batches ordered chronologically (oldest → newest) for trend charts.
export const BATCH_ORDER = [
  "Winter 2026",
  "Spring 2026",
  "Summer 2026",
  "Fall 2026",
  "Winter 2027",
];

// A batch is still filling if YC hasn't finished admitting/launching it yet.
// Comparing raw counts across a complete and a partial batch is misleading —
// flag it so charts can warn instead of silently implying decline.
const FULL_BATCH_SIZE_THRESHOLD = 100;

export interface BatchCount {
  batch: string;
  count: number;
  partial: boolean;
}

export function companiesByBatch(list: Company[]): BatchCount[] {
  const counts = new Map<string, number>();
  for (const b of BATCH_ORDER) counts.set(b, 0);
  for (const c of list) counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
  return BATCH_ORDER.map((batch) => {
    const count = counts.get(batch) ?? 0;
    return { batch, count, partial: count < FULL_BATCH_SIZE_THRESHOLD };
  });
}

export interface NamedCount {
  name: string;
  count: number;
}

export function topIndustries(list: Company[], limit = 8): NamedCount[] {
  const counts = new Map<string, number>();
  for (const c of list) {
    if (!c.industry) continue;
    counts.set(c.industry, (counts.get(c.industry) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function topTags(list: Company[], limit = 10): NamedCount[] {
  const counts = new Map<string, number>();
  for (const c of list) {
    for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function allIndustries(list: Company[]): string[] {
  return [...new Set(list.map((c) => c.industry).filter((x): x is string => !!x))].sort();
}

export function allBatches(list: Company[]): string[] {
  return BATCH_ORDER.filter((b) => list.some((c) => c.batch === b));
}

/**
 * Country from a free-text location string. YC stores these as
 * "City, Region, Country", sometimes with a "; Remote" suffix, so take the
 * last comma-separated part and drop any trailing qualifier.
 */
function countryOf(location: string | null): string {
  if (!location) return "Unknown";
  const country = location.split(",").pop()?.split(";")[0]?.trim();
  return country || "Unknown";
}

export function topCountries(list: Company[], limit = 6): NamedCount[] {
  const counts = new Map<string, number>();
  for (const c of list) {
    const country = countryOf(c.all_locations);
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

const TEAM_SIZE_BUCKETS: { name: string; test: (n: number) => boolean }[] = [
  { name: "Solo", test: (n) => n === 1 },
  { name: "2", test: (n) => n === 2 },
  { name: "3–5", test: (n) => n >= 3 && n <= 5 },
  { name: "6–10", test: (n) => n >= 6 && n <= 10 },
  { name: "11–25", test: (n) => n >= 11 && n <= 25 },
  { name: "26+", test: (n) => n >= 26 },
];

/** Team-size distribution. Companies with no reported size are excluded
 *  rather than counted as zero — an unknown is not a small team. */
export function teamSizeDistribution(list: Company[]): NamedCount[] {
  const sizes = list
    .map((c) => c.team_size)
    .filter((n): n is number => typeof n === "number" && n > 0);
  return TEAM_SIZE_BUCKETS.map((b) => ({
    name: b.name,
    count: sizes.filter((n) => b.test(n)).length,
  }));
}

export function medianTeamSize(list: Company[]): number | null {
  const sizes = list
    .map((c) => c.team_size)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => a - b);
  if (sizes.length === 0) return null;
  const mid = Math.floor(sizes.length / 2);
  return sizes.length % 2 === 0 ? (sizes[mid - 1] + sizes[mid]) / 2 : sizes[mid];
}

/** How many companies actually report a team size — shown so a distribution
 *  is never read as covering the whole cohort when it doesn't. */
export function teamSizeReportedCount(list: Company[]): number {
  return list.filter((c) => typeof c.team_size === "number" && c.team_size > 0).length;
}
