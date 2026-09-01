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

// Set when GitHub stops answering mid-run. The run's results are then thrown
// away wholesale rather than kept: the companies processed before the failure
// are fine, but the ones after would be nulls that mean "we stopped looking".
let authFailedMidRun = false;

/** Find the org whose profile website matches the company's domain. */
async function resolveOrg(company, domain) {
  if (authFailedMidRun) return null;
  const query = encodeURIComponent(`${company.name} type:org`);
  try {
    const res = await fetch(`${API}/search/users?q=${query}&per_page=5`, { headers: headers() });
    if (res.status === 401 || res.status === 403) {
      authFailedMidRun = true;
      return null;
    }
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

/**
 * Confirms the credentials actually work before collecting anything.
 *
 * This exists because of a real failure. A GITHUB_TOKEN that was present but
 * invalid made every lookup return 401, which the collector below could not
 * distinguish from "this company has no GitHub org" — so it wrote 1,318 null
 * readings into the observation store. A null is supposed to mean "we looked
 * and it genuinely is not there" (§45). Recording "we never looked" the same
 * way turns a broken credential into a finding: that no YC company has open
 * source. Nothing about the data would have looked wrong.
 *
 * So the adapter now proves it can read GitHub first, and collects NOTHING at
 * all if it cannot. No observations beats wrong observations.
 */
async function credentialsUsable() {
  if (!process.env.GITHUB_TOKEN) {
    console.log("    (skipped — no GITHUB_TOKEN; 60 req/hr unauthenticated is too low for this many companies)");
    return false;
  }
  try {
    const res = await fetch(`${API}/rate_limit`, { headers: headers() });
    if (res.status === 401) {
      console.log("    (skipped — GITHUB_TOKEN was rejected: 401 Bad credentials. Recording nothing rather than nulls.)");
      return false;
    }
    if (!res.ok) {
      console.log(`    (skipped — GitHub rate_limit check returned HTTP ${res.status})`);
      return false;
    }
    const core = (await res.json())?.resources?.core;
    // Verification costs up to ~2 requests per candidate org. Starting a run
    // that will exhaust the budget partway through produces nulls for whatever
    // is left in the list, which is the same lie in a smaller quantity.
    if ((core?.remaining ?? 0) < 500) {
      console.log(`    (skipped — only ${core?.remaining ?? 0} GitHub requests left this hour; a partial run would record nulls)`);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`    (skipped — could not reach GitHub: ${err.message})`);
    return false;
  }
}

export async function collect(companies, { limit = Infinity } = {}) {
  authFailedMidRun = false;
  if (!(await credentialsUsable())) return [];

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

  if (authFailedMidRun) {
    console.log("    (discarded — GitHub started rejecting requests part-way through; a partial run would record nulls)");
    return [];
  }

  return nested.flat();
}

export const ADAPTER = {
  id: "github",
  label: "GitHub open-source adoption",
  metrics: [GH_STARS, GH_REPOS],
  lowerIsBetter: false,
  collect,
};
