// Indian startup funding deals, from Inc42's weekly "Funding Galore" roundups.
//
// Why this source: there is no free funding API. Crunchbase's v4 endpoint
// returns 401 without a paid key, OpenVC blocks automated clients with 403,
// and Tracxn, VCCEdge and Venture Intelligence are all licensed products.
// Inc42 publishes one roundup article a week, and each one embeds a real
// HTML table with the columns we need — date, company, sector, subsector,
// business model, round size, round type and the full investor list. So this
// is a table parse, not prose extraction: no model reads the article, and a
// change in Inc42's wording cannot silently corrupt a number.
//
// Every deal keeps the URL of the article it came from, so any figure on the
// dashboard can be traced back to a published source.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ARCHIVE = "https://inc42.com/tag/funding-galore/page";
const UA = "frontier-intelligence-system/1.0 (internal market research; contact tech@muns.io)";

// Inc42 is a publisher, not an API, and it rate-limits: a request a second
// earns a 429 after about thirty articles. Two and a half seconds, serially,
// gets a full year through without one.
const POLITE_DELAY_MS = 2500;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Articles never change once published, so a fetched one is cached on disk.
// A re-run then costs nothing and, more importantly, a 429 part-way through a
// build does not throw away the fifty articles already collected.
const CACHE_DIR = process.env.INC42_CACHE ?? join(tmpdir(), "inc42-cache");
const cachePath = (url) => join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".html");

async function get(url, { cache = true } = {}) {
  const file = cachePath(url);
  if (cache && existsSync(file)) return readFileSync(file, "utf8");

  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      // The delay lives here rather than in the caller so a cache hit costs
      // nothing: a re-run of a fully cached year finishes in milliseconds.
      await sleep(POLITE_DELAY_MS);
      res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
    } catch (err) {
      if (attempt === 4) throw err;
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.status === 404) return null;
    if (res.status === 429 || res.status === 503) {
      // Respect Retry-After when it is sent; otherwise wait out the window.
      const retry = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retry) && retry > 0 ? retry * 1000 : RATE_LIMIT_BACKOFF_MS * (attempt + 1);
      process.stdout.write(`  rate-limited, waiting ${Math.round(wait / 1000)}s…\n`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      if (attempt === 4) throw new Error(`HTTP ${res.status} for ${url}`);
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    if (cache) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(file, text);
    }
    return text;
  }
  throw new Error(`gave up on ${url}`);
}

/** Strip tags and entities from one table cell. */
function cellText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;|&#039;|&#39;/g, "'")
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/g, "-")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&[a-z]+;|&#[0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) =>
    [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1])),
  );
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "7 Sep 2026" and "7 Sep 2026 *" (the asterisk marks a late-reported deal). */
export function parseDealDate(raw) {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(raw || "");
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  const d = new Date(Date.UTC(+m[3], month, +m[1]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * "$100 Mn", "$1.2 Bn", "$178 K", "Undisclosed" -> millions of USD, or null.
 * Returning null rather than 0 matters: a deal with an undisclosed size is not
 * a deal worth nothing, and totals must not silently absorb it.
 */
export function parseAmountUsdMn(raw) {
  const s = (raw || "").replace(/,/g, "").trim();
  const m = /\$\s*([0-9]+(?:\.[0-9]+)?)\s*(bn|billion|mn|million|k|thousand)?/i.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "mn").toLowerCase();
  if (unit.startsWith("b")) return n * 1000;
  if (unit.startsWith("k") || unit.startsWith("t")) return n / 1000;
  return n;
}

/**
 * The investor cell is a human-written list: "A, B, and C", "A, B & others",
 * sometimes with a trailing note. Split it, then drop the entries that name no
 * firm — an unnamed angel is not an investor we can attribute a bet to.
 */
// "Angle" is Inc42's own recurring typo for "angel"; it appears often enough
// that leaving it out would seed the leaderboard with a phantom firm.
const NOT_A_FIRM =
  /^(others?|existing|undisclosed|unnamed|n\/?a|[-—–]|(existing\s+|multiple\s+|several\s+|other\s+)*(angel|angle|family\s+office|investor|participant)s?(\s+(investors?|offices?))?)$/i;

export function parseInvestors(raw) {
  const cleaned = (raw || "")
    .replace(/\s+and\s+/gi, ", ")
    .replace(/\s*&\s*(?=[A-Z])/g, ", ")
    .replace(/\(.*?\)/g, " ");
  return [
    ...new Set(
      cleaned
        .split(/[,;]+/)
        .map((s) => s.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, ""))
        .filter((s) => s.length > 1 && !NOT_A_FIRM.test(s)),
    ),
  ];
}

/** Inc42 writes an unknown round type as a dash; that is absence, not a value. */
const blankIfDash = (s) => {
  const v = (s || "").trim();
  return /^[-—–]$/.test(v) ? "" : v;
};

const HEADER_HINTS = ["name", "sector", "investor"];

/** The deal table is the one whose header row names a company and an investor. */
function findDealTable(html) {
  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows = parseRows(t[0]);
    if (rows.length < 2) continue;
    const head = rows[0].map((c) => c.toLowerCase());
    if (HEADER_HINTS.every((h) => head.some((c) => c.includes(h)))) return rows;
  }
  return null;
}

function columnIndex(head, ...names) {
  for (const n of names) {
    const i = head.findIndex((c) => c.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseArticle(html, sourceUrl) {
  const rows = findDealTable(html);
  if (!rows) return [];
  const head = rows[0].map((c) => c.toLowerCase());
  const iDate = columnIndex(head, "date");
  const iName = columnIndex(head, "name", "startup", "company");
  const iSector = columnIndex(head, "sector");
  const iSub = head.findIndex((c) => c.includes("subsector") || c.includes("sub sector"));
  const iModel = columnIndex(head, "business model", "model");
  const iSize = columnIndex(head, "size", "amount");
  const iType = columnIndex(head, "round type", "type", "stage");
  const iInv = columnIndex(head, "investor");

  const out = [];
  for (const r of rows.slice(1)) {
    const name = (r[iName] || "").trim();
    if (!name || name.toLowerCase() === "name") continue;
    const date = parseDealDate(r[iDate]);
    if (!date) continue;
    // The sector column repeats inside the subsector column on some rows;
    // keep them distinct so neither is double-counted downstream.
    const sector = (r[iSector] || "").trim();
    const subsector = iSub >= 0 ? (r[iSub] || "").trim() : "";
    out.push({
      date,
      name,
      sector,
      subsector: subsector === sector ? "" : subsector,
      businessModel: iModel >= 0 ? (r[iModel] || "").trim() : "",
      amountUsdMn: parseAmountUsdMn(r[iSize]),
      amountRaw: (r[iSize] || "").trim(),
      roundType: iType >= 0 ? blankIfDash(r[iType]) : "",
      investors: parseInvestors(r[iInv]),
      source: sourceUrl,
    });
  }
  return out;
}

/** Article URLs from one archive page, in publication order. */
export function parseArchivePage(html) {
  return [
    ...new Set(
      [...html.matchAll(/https:\/\/inc42\.com\/buzz\/[a-z0-9-]*indian-startups?-raised[a-z0-9-]*\//g)].map(
        (m) => m[0],
      ),
    ),
  ];
}

/**
 * Walk the archive newest-first until every deal on a page predates the
 * window, then stop. Roundups are weekly, so a year is about 52 articles.
 */
export async function fetchDeals({ sinceIso, maxPages = 30, log = () => {} }) {
  const seen = new Set();
  const deals = [];
  let emptyStreak = 0;

  for (let page = 1; page <= maxPages; page++) {
    // The archive listing changes every week, so it is never served from cache.
    const archive = await get(`${ARCHIVE}/${page}/`, { cache: false });
    if (!archive) break;
    const urls = parseArchivePage(archive).filter((u) => !seen.has(u));
    if (urls.length === 0) break;

    let pageNewest = null;
    for (const url of urls) {
      seen.add(url);
      const html = await get(url);
      if (!html) continue;
      const rows = parseArticle(html, url);
      const kept = rows.filter((d) => d.date >= sinceIso);
      deals.push(...kept);
      const newest = rows.reduce((a, d) => (a && a > d.date ? a : d.date), null);
      if (newest && (!pageNewest || newest > pageNewest)) pageNewest = newest;
      log(`  ${url.split("/").slice(-2)[0].slice(0, 52)} — ${rows.length} deals, ${kept.length} in window`);
    }

    // Once a whole page of articles is older than the window, we are done.
    if (pageNewest && pageNewest < sinceIso) {
      emptyStreak++;
      if (emptyStreak >= 1) break;
    } else {
      emptyStreak = 0;
    }
  }

  // The same deal can appear in two roundups when it is reported late.
  const byKey = new Map();
  for (const d of deals) {
    const key = `${d.name.toLowerCase()}|${d.date}`;
    const prev = byKey.get(key);
    if (!prev || (prev.investors.length < d.investors.length)) byKey.set(key, d);
  }
  return [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}
