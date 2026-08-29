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
