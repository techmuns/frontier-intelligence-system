import rawTrends from "./yc-trends.json";

export interface BatchTrend {
  slug: string;
  batch: string;
  total: number;
  partial: boolean;
  taggedCount: number;
  hiring: number;
  medianTeamSize: number | null;
  industries: Record<string, number>;
  subindustries: Record<string, number>;
  topTags: { name: string; count: number }[];
}

export const trends = rawTrends as unknown as BatchTrend[];

// Below this, a batch's tags are too sparse to read a share from — the number
// is reported but must be visibly marked as thin evidence, never plotted as if
// it were as solid as a fully-tagged batch.
export const LOW_COVERAGE_THRESHOLD = 0.5;

export function tagCoverage(b: BatchTrend): number {
  return b.total === 0 ? 0 : b.taggedCount / b.total;
}

export function isLowCoverage(b: BatchTrend): boolean {
  return tagCoverage(b) < LOW_COVERAGE_THRESHOLD;
}

// Spring and Summer both start with "S", so a single-letter code collides and
// renders two different batches with the same axis label.
const SEASON_CODE: Record<string, string> = {
  Winter: "W",
  Spring: "Sp",
  Summer: "Su",
  Fall: "F",
};

/** Short axis label, e.g. "Winter 2026" -> "W26", "Spring 2026" -> "Sp26". */
export function shortBatchLabel(batch: string): string {
  const [season = "", year = ""] = batch.split(" ");
  return `${SEASON_CODE[season] ?? season.slice(0, 2)}${year.slice(2)}`;
}

/**
 * Share of *tagged* companies in each batch carrying any of `tagNames`.
 *
 * Deliberately measured against the tagged subset, not the batch total: some
 * batches have most companies still untagged, and dividing by the total would
 * render that missing data as a collapse in the trend. Batches with no tagged
 * companies yield null (a gap in the line) rather than a fabricated zero.
 */
export function tagShareSeries(tagNames: string[]) {
  const wanted = new Set(tagNames.map((t) => t.toLowerCase()));
  return trends.map((b) => {
    const matched = b.topTags
      .filter((t) => wanted.has(t.name.toLowerCase()))
      .reduce((sum, t) => sum + t.count, 0);
    return {
      batch: b.batch,
      label: shortBatchLabel(b.batch),
      value: b.taggedCount === 0 ? null : Math.round((matched / b.taggedCount) * 1000) / 10,
      lowCoverage: isLowCoverage(b),
      taggedCount: b.taggedCount,
      total: b.total,
    };
  });
}

/**
 * Share of each batch in a given industry. Industry is populated for
 * essentially every company, so this one is safe to measure against the
 * batch total.
 */
export function industryShareSeries(industryNames: string[]) {
  return trends.map((b) => {
    const row: Record<string, unknown> = {
      batch: b.batch,
      label: shortBatchLabel(b.batch),
      total: b.total,
      partial: b.partial,
    };
    for (const name of industryNames) {
      row[name] = b.total === 0 ? null : Math.round(((b.industries[name] ?? 0) / b.total) * 1000) / 10;
    }
    return row;
  });
}

/**
 * Share of each batch in given subindustries, keyed by a short display label.
 * Subindustry is populated alongside industry for essentially every company,
 * so this is safe to measure against the batch total.
 */
export function subindustryShareSeries(spec: { key: string; source: string }[]) {
  return trends.map((b) => {
    const row: Record<string, unknown> = {
      batch: b.batch,
      label: shortBatchLabel(b.batch),
      total: b.total,
      partial: b.partial,
    };
    for (const { key, source } of spec) {
      row[key] = b.total === 0 ? null : Math.round(((b.subindustries[source] ?? 0) / b.total) * 1000) / 10;
    }
    return row;
  });
}

/** Industries ranked by how much their share moved between two batches. */
export function biggestIndustryShifts(fromSlug: string, toSlug: string, limit = 6) {
  const from = trends.find((b) => b.slug === fromSlug);
  const to = trends.find((b) => b.slug === toSlug);
  if (!from || !to || from.total === 0 || to.total === 0) return [];

  const names = new Set([...Object.keys(from.industries), ...Object.keys(to.industries)]);
  return [...names]
    .map((name) => {
      const fromPct = ((from.industries[name] ?? 0) / from.total) * 100;
      const toPct = ((to.industries[name] ?? 0) / to.total) * 100;
      return {
        name,
        fromPct: Math.round(fromPct * 10) / 10,
        toPct: Math.round(toPct * 10) / 10,
        delta: Math.round((toPct - fromPct) * 10) / 10,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

/** Batches with enough tag coverage to compare tag shares honestly. */
export function wellTaggedBatches(): BatchTrend[] {
  return trends.filter((b) => !isLowCoverage(b) && b.taggedCount > 0);
}
