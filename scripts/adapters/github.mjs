// GitHub adapter (§44) — open-source adoption.
//
// Free. Unauthenticated it allows 60 requests/hour, which is far too few for
// ~650 companies; with a token it is 5,000/hour. The weekly GitHub Action
// already receives a GITHUB_TOKEN automatically, so this runs at full rate in
// CI at no cost and simply skips when no token is present locally.
//
// Entity resolution, again, is the whole game. Searching GitHub for an org by
// company NAME finds the wrong org constantly — plenty of unrelated accounts
// are called "clay" or "harbor". So a candidate org is accepted only when its
// own `blog` field (the website GitHub shows on the profile) resolves to the
// company's domain. That turns a fuzzy name search into an exact domain match,
// and an org that cannot be verified this way is skipped rather than guessed.

import { observation, domainOf, throttledMap } from "./index.mjs";

export const GH_STARS = "github_stars";
export const GH_REPOS = "github_repos";

const API = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "frontier-intelligence-system",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function hostOf(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

/** Find the org whose profile website matches the company's domain. */
async function resolveOrg(company, domain) {
  const query = encodeURIComponent(`${company.name} type:org`);
  try {
    const res = await fetch(`${API}/search/users?q=${query}&per_page=5`, { headers: headers() });
    if (!res.ok) return null;
    const body = await res.json();
    for (const item of body?.items ?? []) {
      const orgRes = await fetch(`${API}/orgs/${item.login}`, { headers: headers() });
      if (!orgRes.ok) continue;
      const org = await orgRes.json();
      const orgHost = hostOf(org.blog);
      // The verification step. Without it this adapter would attach another
      // company's repositories to this one.
      if (orgHost && (orgHost === domain || orgHost.endsWith(`.${domain}`))) {
        return org;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function orgTotals(login) {
  try {
    const res = await fetch(`${API}/orgs/${login}/repos?per_page=100&sort=updated`, { headers: headers() });
    if (!res.ok) return null;
    const repos = await res.json();
    if (!Array.isArray(repos)) return null;
    return {
      stars: repos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0),
      repos: repos.length,
    };
  } catch {
    return null;
  }
}

export async function collect(companies, { limit = Infinity } = {}) {
  if (!process.env.GITHUB_TOKEN) {
    console.log("    (skipped — no GITHUB_TOKEN; 60 req/hr unauthenticated is too low for this many companies)");
    return [];
  }

  const targets = companies
    .map((c) => ({ company: c, domain: domainOf(c) }))
    .filter((t) => t.domain)
    .slice(0, limit);

  const nested = await throttledMap(
    targets,
    async ({ company, domain }) => {
      const org = await resolveOrg(company, domain);
      const totals = org ? await orgTotals(org.login) : null;
      const base = {
        companySlug: company.slug,
        source: "github",
        sourceUrl: org ? `https://github.com/${org.login}` : "https://github.com",
        confidence: totals ? 0.8 : 0.2,
        method: "org-website-verified",
      };
      return [
        observation({ ...base, metric: GH_STARS, value: totals ? totals.stars : null }),
        observation({ ...base, metric: GH_REPOS, value: totals ? totals.repos : null }),
      ];
    },
    { concurrency: 2, delayMs: 400 },
  );

  return nested.flat();
}

export const ADAPTER = {
  id: "github",
  label: "GitHub open-source adoption",
  metrics: [GH_STARS, GH_REPOS],
  lowerIsBetter: false,
  collect,
};
