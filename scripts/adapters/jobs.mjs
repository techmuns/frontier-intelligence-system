// Hiring adapter (§44) — Greenhouse and Lever public job boards.
//
// Open-role count is the closest free proxy for headcount growth (§20 lists
// hiring and team growth among the traction metrics). Both providers expose
// board contents publicly with no key, and a startup that is hiring hard is
// making a costly, visible commitment — which is exactly the sort of signal
// worth tracking over time.
//
// DISABLED BY DEFAULT — see `enabled` below.
//
// Entity resolution defeats this adapter. Neither provider lets you look a
// board up by domain, so the slug has to be guessed from the company's name or
// domain, and short names collide constantly with unrelated companies that got
// to the slug first. Measured against real data:
//
//   Clara  (YC, 9 people, askclara.com) -> matched a Brazilian company's board
//                                          advertising 117 roles in Sao Paulo
//   Nex    (YC, 5 people, nex.ai)       -> matched a Hong Kong company, 44 roles
//
// Those are not missing values, which would be harmless; they are confident
// numbers attached to the WRONG COMPANY, which is worse than no signal at all
// and precisely what §45 forbids. Domain-derived slugs do not fix it either:
// nex.ai still yields "nex".
//
// The code stays because the signal is genuinely valuable if resolution can be
// made sound — a provider lookup keyed on domain, or a verification step that
// confirms the board belongs to this company. Until then it stays off.

import { observation, domainOf, throttledMap } from "./index.mjs";

export const OPEN_ROLES = "open_roles";

/** Plausible board slugs, most likely first. */
function candidateSlugs(company) {
  const domain = domainOf(company);
  const fromDomain = domain ? domain.split(".")[0] : null;
  const fromName = (company.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return [...new Set([fromDomain, fromName].filter((s) => s && s.length > 2))];
}

async function tryGreenhouse(slug) {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    if (!res.ok) return null;
    const body = await res.json();
    // A board that exists but is empty is a real zero; a board that does not
    // exist is unknown. Greenhouse 404s the latter, so reaching here means
    // the board is real.
    return Array.isArray(body?.jobs) ? { count: body.jobs.length, provider: "greenhouse", slug } : null;
  } catch {
    return null;
  }
}

async function tryLever(slug) {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? { count: body.length, provider: "lever", slug } : null;
  } catch {
    return null;
  }
}

async function findBoard(company) {
  for (const slug of candidateSlugs(company)) {
    const gh = await tryGreenhouse(slug);
    if (gh) return gh;
    const lv = await tryLever(slug);
    if (lv) return lv;
  }
  return null;
}

export async function collect(companies, { limit = Infinity } = {}) {
  const targets = companies.slice(0, limit);

  return throttledMap(
    targets,
    async (company) => {
      const board = await findBoard(company);
      return observation({
        companySlug: company.slug,
        metric: OPEN_ROLES,
        value: board ? board.count : null,
        source: board ? board.provider : "jobs",
        sourceUrl: board
          ? board.provider === "greenhouse"
            ? `https://boards.greenhouse.io/${board.slug}`
            : `https://jobs.lever.co/${board.slug}`
          : "https://boards-api.greenhouse.io",
        // Lower than the domain-matched adapters on purpose: the slug is
        // inferred, so a match is plausible rather than certain.
        confidence: board ? 0.5 : 0.2,
        method: "slug-guess",
      });
    },
    { concurrency: 3, delayMs: 250 },
  );
}

export const ADAPTER = {
  id: "jobs",
  // Flipped on only once board ownership can be verified, not guessed.
  enabled: false,
  label: "Open roles (Greenhouse / Lever)",
  metric: OPEN_ROLES,
  lowerIsBetter: false,
  collect,
};
