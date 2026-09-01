// External data adapters (§44).
//
// Every adapter returns NORMALIZED OBSERVATIONS in one shape, so the core
// model never couples to a provider. Adding GitHub, funding or headcount later
// means writing one more adapter that returns the same shape — nothing
// downstream changes.
//
// An observation is a fact at a point in time (§4): value + observed_at +
// source + confidence + method. Nothing is ever overwritten; a refresh appends,
// which is what makes velocity computable later.

/**
 * @typedef {Object} Observation
 * @property {string} companySlug  YC slug — the join key into our own data
 * @property {string} metric       e.g. "web_rank", "hn_mentions"
 * @property {number|null} value   null = looked up, genuinely absent (§45)
 * @property {string} observedAt   ISO timestamp
 * @property {string} source       adapter id
 * @property {string} sourceUrl    where a human can verify it
 * @property {number} confidence   0-1
 * @property {string} method       how it was obtained
 */

export function observation({ companySlug, metric, value, source, sourceUrl, confidence, method }) {
  return {
    companySlug,
    metric,
    value: typeof value === "number" && Number.isFinite(value) ? value : null,
    observedAt: new Date().toISOString(),
    source,
    sourceUrl,
    confidence,
    method,
  };
}

/**
 * Domain from a company website.
 *
 * This is the entity-resolution key, and getting it exact matters more than
 * anything else in this file. Matching companies by NAME produces garbage:
 * searching SEC filings for "Clay" returns 1,755 results including California
 * BanCorp. The domain is unique to the company, so every adapter here joins on
 * it rather than on a name.
 */
export function domainOf(company) {
  const url = company.website;
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Politeness delay — these are free public APIs and should be treated as such. */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run an async mapper over items with bounded concurrency and a delay, so a
 * few hundred lookups stay well inside what a free endpoint tolerates.
 */
export async function throttledMap(items, mapper, { concurrency = 4, delayMs = 120 } = {}) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...(await Promise.all(batch.map(mapper))));
    if (i + concurrency < items.length) await sleep(delayMs);
  }
  return results;
}
