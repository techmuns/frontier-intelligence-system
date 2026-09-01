// Tranco domain-rank adapter (§44).
//
// Tranco publishes a daily ranking of the most-visited domains, free and
// without a key. It is the closest thing to a web-traffic signal available
// publicly, and because it is a DAILY series it gives real history rather than
// a single snapshot — which is what §21 wants for growth and acceleration.
//
// Rank is inverted: rank 1 is the biggest site. So a FALLING rank number means
// growing traffic. Every consumer of this metric has to know that, so the
// adapter records it explicitly rather than leaving it to be rediscovered.

import { observation, domainOf, throttledMap } from "./index.mjs";

const API = "https://tranco-list.eu/api/ranks/domain";

export const TRANCO_METRIC = "web_rank";
export const TRANCO_LOWER_IS_BETTER = true;

async function fetchRank(domain) {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const ranks = Array.isArray(body?.ranks) ? body.ranks : [];
    if (ranks.length === 0) return null;

    // Most recent entry with an actual rank. A domain outside the list simply
    // has no rank — that is "not ranked", not "rank zero".
    const latest = ranks.find((r) => typeof r.rank === "number");
    return latest ? { rank: latest.rank, date: latest.date } : null;
  } catch {
    return null;
  }
}

export async function collect(companies, { limit = Infinity } = {}) {
  const targets = companies
    .map((c) => ({ company: c, domain: domainOf(c) }))
    .filter((t) => t.domain)
    .slice(0, limit);

  const results = await throttledMap(
    targets,
    async ({ company, domain }) => {
      const hit = await fetchRank(domain);
      return observation({
        companySlug: company.slug,
        metric: TRANCO_METRIC,
        // null when the domain is not in the list at all — recorded as an
        // explicit unknown so it is never mistaken for poor traffic.
        value: hit ? hit.rank : null,
        source: "tranco",
        sourceUrl: `https://tranco-list.eu/query?q=${domain}`,
        confidence: hit ? 0.75 : 0.3,
        method: "domain-exact",
      });
    },
    { concurrency: 4, delayMs: 150 },
  );

  return results;
}

export const ADAPTER = {
  id: "tranco",
  label: "Tranco web rank",
  metric: TRANCO_METRIC,
  lowerIsBetter: TRANCO_LOWER_IS_BETTER,
  collect,
};
