// Hacker News adapter (§44).
//
// Free, keyless, and — critically — searchable by URL, so companies are joined
// on their exact domain rather than their name. Name matching is what makes
// this class of enrichment produce garbage: "Clay" as a name returns hundreds
// of unrelated entities, while clay.com as a domain returns that company's
// actual posts, including its funding announcement.
//
// Two signals come out of this:
//   hn_mentions  — how often the company's own domain is posted (attention)
//   hn_points    — total points across those posts (weighted attention)

import { observation, domainOf, throttledMap } from "./index.mjs";

const API = "https://hn.algolia.com/api/v1/search";

export const HN_MENTIONS = "hn_mentions";
export const HN_POINTS = "hn_points";

async function fetchDomainStories(domain) {
  try {
    const url = `${API}?query=${encodeURIComponent(domain)}&restrictSearchableAttributes=url&hitsPerPage=50`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = await res.json();
    const hits = Array.isArray(body?.hits) ? body.hits : [];

    // Algolia matches the domain as a substring of the URL, so "clay.com"
    // also matches "kelly-clay.com". Confirm the hostname really is the
    // company's domain (or a subdomain of it) before counting it.
    const exact = hits.filter((h) => {
      if (!h.url) return false;
      try {
        const host = new URL(h.url).hostname.replace(/^www\./, "").toLowerCase();
        return host === domain || host.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    });

    return {
      mentions: exact.length,
      points: exact.reduce((sum, h) => sum + (h.points ?? 0), 0),
    };
  } catch {
    return null;
  }
}

export async function collect(companies, { limit = Infinity } = {}) {
  const targets = companies
    .map((c) => ({ company: c, domain: domainOf(c) }))
    .filter((t) => t.domain)
    .slice(0, limit);

  const nested = await throttledMap(
    targets,
    async ({ company, domain }) => {
      const hit = await fetchDomainStories(domain);
      const base = {
        companySlug: company.slug,
        source: "hackernews",
        sourceUrl: `https://hn.algolia.com/?query=${domain}&type=story`,
        confidence: hit ? 0.65 : 0.3,
        method: "domain-exact",
      };
      // Zero mentions is a real measurement, not a missing one — the lookup
      // succeeded and found nothing. Only a failed lookup yields null.
      return [
        observation({ ...base, metric: HN_MENTIONS, value: hit ? hit.mentions : null }),
        observation({ ...base, metric: HN_POINTS, value: hit ? hit.points : null }),
      ];
    },
    { concurrency: 3, delayMs: 200 },
  );

  return nested.flat();
}

export const ADAPTER = {
  id: "hackernews",
  label: "Hacker News attention",
  metrics: [HN_MENTIONS, HN_POINTS],
  lowerIsBetter: false,
  collect,
};
