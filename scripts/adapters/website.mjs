// Finds a company's own website, and proves it found the right one.
//
// The funding source names companies but not their sites, and no free search
// API is reachable from a build box — Crunchbase and Brave need paid or keyed
// access, and DuckDuckGo's HTML endpoints answer a scripted client with their
// homepage. So this does not search. It guesses the obvious domains, which for
// startups is nearly always right, and then VERIFIES each guess by fetching
// the page and checking it actually names the company.
//
// The verification is the whole point. A guess alone would happily send a
// reader to a parked domain or to an unrelated business that happens to own
// name.com. A guess that has been read and matched is a fact. Anything that
// cannot be verified stays null, and the UI falls back to a search rather than
// linking somewhere wrong.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Ordered by how Indian startups actually name themselves — .ai first, since
// most of these are AI companies and take the matching domain.
const TLDS = ["ai", "com", "in", "io", "co", "tech", "app"];
const TIMEOUT_MS = 9000;
const UA = "Mozilla/5.0 (compatible; frontier-intelligence-system/1.0; +market research)";

const CACHE_DIR = process.env.WEBSITE_CACHE ?? join(tmpdir(), "website-cache");
const cachePath = (key) => join(CACHE_DIR, createHash("sha1").update(key).digest("hex") + ".json");

export const normalise = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Candidate domain stems for a company name, most specific first.
 *
 * "Attentive AI" is tried as both "attentiveai" and "attentive", because a
 * company whose name ends in AI may or may not carry it into the domain —
 * attentive.ai and gushwork.ai are both real, spelled differently.
 */
export function candidateStems(name) {
  const full = normalise(name);
  const trimmed = normalise(
    (name || "").replace(/\b(ai|technologies|technology|labs|inc|pvt|ltd|limited|india)\b/gi, ""),
  );
  return [...new Set([full, trimmed].filter((s) => s.length >= 3))];
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "user-agent": UA },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
    return { finalUrl: res.url, title, html };
  } catch {
    return null;
  }
}

/** Visible text, so a match cannot come from a script blob or a meta tag. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");
}

/**
 * Domain parking dressed up as a company site.
 *
 * A parked page is the worst kind of false positive here, because it passes
 * the obvious test: its title is usually the domain name, so it "names the
 * company" perfectly. Mysa resolved to daaz.com/lander/?name=mysa.in that way.
 * Two signals catch it — the landing host no longer being the host we guessed,
 * and the for-sale language such pages all carry.
 */
const PARKED_HOSTS = /(^|\.)(daaz|sedo|afternic|dan|hugedomains|bodis|parkingcrew|above|namecheap|godaddy|undeveloped|squadhelp|brandbucket|spaceship|atom)\.[a-z.]+$/i;

// Most of these were found by auditing real output rather than imagined up
// front: fireai.ai, justai.ai, nava.ai and thirdai.io all resolved to
// "<domain> for sale | Spaceship.com", and atlas.com and aivar.com to a broker
// selling "strategic-grade domain names". Every one passed a naive name check,
// because a sale page leads with the domain it is selling.
const FOR_SALE =
  /\bfor sale\b|premium[^.]{0,30}domain|domain[^.]{0,30}(for sale|is available|may be available)|buy this domain|make an offer|inquire about this domain|strategic-grade domain|this domain (name )?is parked|brandable domain/i;

/** "www.foo.co.uk" -> "foo" — the registrable label, near enough for a check. */
function hostStem(hostname) {
  const parts = hostname.replace(/^www\./, "").split(".");
  return normalise(parts[0]);
}

export function isParked(page) {
  let host = "";
  try {
    host = new URL(page.finalUrl).hostname;
  } catch {
    return false;
  }
  if (PARKED_HOSTS.test(host)) return true;

  // The sale pitch is usually in the title, which the body scan alone missed.
  if (FOR_SALE.test(page.title)) return true;

  // A title that is exactly the bare domain — "rocket.io", "thirdai.io" — is a
  // holding page. A company that has built a product writes something else.
  if (normalise(page.title) === normalise(host.replace(/^www\./, ""))) return true;

  return FOR_SALE.test(visibleText(page.html).slice(0, 4000));
}

/**
 * Does this page belong to this company?
 *
 * A name in the <title> is strong evidence — that is the site announcing
 * itself. A name in the body only is weaker, so short names, where a
 * coincidental match is likely ("Giga", "Nava", "Mysa"), require the title.
 */
export function pageMatches(name, page) {
  if (isParked(page)) return null;

  // The page we landed on must still be the domain we guessed. A redirect to
  // an unrelated registrable domain means we guessed a name someone else
  // owns, whatever the page then says about itself.
  const stems = candidateStems(name);
  try {
    const landed = hostStem(new URL(page.finalUrl).hostname);
    if (!stems.some((s) => landed.includes(s) || s.includes(landed))) return null;
  } catch {
    return null;
  }

  const title = normalise(page.title);
  const inTitle = stems.some((s) => title.includes(s));
  if (inTitle) return "title";

  const shortest = Math.min(...stems.map((s) => s.length));
  if (shortest < 6) return null; // too generic to accept on body text alone

  // Only the top of the page. A name buried 30,000 characters down is as
  // likely to be a coincidence or a customer logo as it is to be the owner —
  // simpleai.tech matched a Chinese company that way.
  const body = normalise(visibleText(page.html).slice(0, 4000));
  return stems.some((s) => body.includes(s)) ? "body" : null;
}

/**
 * Resolve one company to a verified website, or null.
 * Results are cached on disk — including the misses, so a re-run does not
 * re-probe fourteen dead domains for every company that has no site.
 */
export async function resolveWebsite(name, { cache = true } = {}) {
  // Bump when the matching rules change, so cached misses and cached false
  // positives are re-decided rather than trusted for ever.
  const key = `v3:${normalise(name)}`;
  const file = cachePath(key);
  if (cache && existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // corrupt cache entry — fall through and resolve again
    }
  }

  let result = { name, website: null, confidence: null };
  outer: for (const tld of TLDS) {
    for (const stem of candidateStems(name)) {
      const page = await fetchPage(`https://${stem}.${tld}`);
      if (!page) continue;
      const how = pageMatches(name, page);
      if (how) {
        result = { name, website: page.finalUrl, confidence: how, title: page.title };
        break outer;
      }
    }
  }

  if (cache) {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(result));
  }
  return result;
}

/** Resolve many, a few at a time so a build does not open 100 sockets at once. */
export async function resolveAll(names, { concurrency = 6, log = () => {} } = {}) {
  const queue = [...names];
  const out = new Map();
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const name = queue.shift();
      if (name === undefined) return;
      const r = await resolveWebsite(name);
      out.set(name, r);
      log(r);
    }
  });
  await Promise.all(workers);
  return out;
}
