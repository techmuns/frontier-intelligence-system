// Builds the India AI-services funding dataset.
//
//   node scripts/build-india.mjs [--months 12]
//
// Writes src/data/india-deals.json — every Indian startup funding round
// published in the window, with its investors, plus the AI-services
// classification and the investor-level rollup the page reads.
//
// Nothing here invents a figure. Every deal carries the URL of the Inc42
// roundup it was parsed out of, and any deal whose round size was not
// disclosed keeps a null amount rather than a zero, so totals stay honest
// about what they exclude.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fetchDeals } from "./adapters/inc42.mjs";
import { classifyDeal, rollUpInvestors, summarise } from "./india.mjs";

const args = process.argv.slice(2);
const monthsArg = args.indexOf("--months");
const months = monthsArg >= 0 ? Number(args[monthsArg + 1]) : 12;
const OUT = new URL("../src/data/india-deals.json", import.meta.url);

const since = new Date();
since.setUTCMonth(since.getUTCMonth() - months);
const sinceIso = since.toISOString().slice(0, 10);

console.log(`Collecting Indian funding deals since ${sinceIso}…`);

const raw = await fetchDeals({ sinceIso, log: (m) => console.log(m) });
console.log(`\n${raw.length} deals in window.`);

// Re-use the cached previous run for any week the archive no longer lists, so
// a roundup falling off the tag page cannot silently shrink the history.
let merged = raw;
if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, "utf8"));
  const seen = new Set(raw.map((d) => `${d.name.toLowerCase()}|${d.date}`));
  const carried = (prev.deals ?? []).filter(
    (d) => d.date >= sinceIso && !seen.has(`${d.name.toLowerCase()}|${d.date}`),
  );
  if (carried.length) console.log(`Carried ${carried.length} deals forward from the previous build.`);
  merged = [...raw, ...carried].sort((a, b) => (a.date < b.date ? 1 : -1));
}

const deals = merged.map(classifyDeal);
const investors = rollUpInvestors(deals);
const summary = summarise(deals, investors, { sinceIso, months });

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString().slice(0, 10),
      windowStart: sinceIso,
      windowMonths: months,
      source: "Inc42 Funding Galore weekly roundups",
      sourceUrl: "https://inc42.com/tag/funding-galore/",
      summary,
      investors,
      deals,
    },
    null,
    1,
  ),
);

console.log(`\nWrote ${deals.length} deals, ${investors.length} investors.`);
console.log(`AI: ${summary.aiDeals} deals · AI-services: ${summary.serviceDeals} deals`);
