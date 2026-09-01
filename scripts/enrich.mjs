#!/usr/bin/env node
//
// Runs the external adapters and APPENDS their observations to
// src/data/observations.json (§4, §21, §44).
//
// Append, never overwrite. That is the whole point: a single snapshot can only
// say what is, whereas an accumulating series is what makes growth and
// acceleration computable. Each weekly run adds a new dated layer, and history
// lives in git — no database to provision, and every past value stays
// inspectable in the repo's own history.
//
// Run: node scripts/enrich.mjs [--limit N]

import { readFile, writeFile } from "node:fs/promises";
import { ADAPTER as tranco } from "./adapters/tranco.mjs";
import { ADAPTER as hackernews } from "./adapters/hackernews.mjs";

const ADAPTERS = [tranco, hackernews];
const STORE = "src/data/observations.json";

// One value per company per metric per day. Re-running on the same day
// replaces that day's reading rather than stacking duplicates, so a retry
// after a failure does not distort the series.
function dayKey(o) {
  return `${o.companySlug}|${o.metric}|${o.observedAt.slice(0, 10)}`;
}

async function loadStore() {
  try {
    const raw = await readFile(STORE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      observations: parsed.observations ?? [],
      runs: parsed.runs ?? [],
    };
  } catch {
    return { observations: [], runs: [] };
  }
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  const companies = JSON.parse(await readFile("src/data/yc-companies.json", "utf8"));
  const store = await loadStore();
  console.log(`Loaded ${store.observations.length} existing observations from ${store.runs.length} prior runs.`);

  const fresh = [];
  for (const adapter of ADAPTERS) {
    const started = Date.now();
    process.stdout.write(`  ${adapter.id}… `);
    const observations = await adapter.collect(companies, { limit });
    const found = observations.filter((o) => o.value !== null).length;
    fresh.push(...observations);
    console.log(`${observations.length} observations, ${found} resolved (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }

  // Merge: today's readings win, everything older is preserved.
  const byKey = new Map(store.observations.map((o) => [dayKey(o), o]));
  for (const o of fresh) byKey.set(dayKey(o), o);
  const merged = [...byKey.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  const runs = [
    ...store.runs,
    {
      at: new Date().toISOString(),
      adapters: ADAPTERS.map((a) => a.id),
      collected: fresh.length,
      resolved: fresh.filter((o) => o.value !== null).length,
    },
  ].slice(-52); // a year of weekly runs is plenty of provenance

  await writeFile(STORE, JSON.stringify({ runs, observations: merged }));

  const dates = [...new Set(merged.map((o) => o.observedAt.slice(0, 10)))];
  console.log(`\nStored ${merged.length} observations across ${dates.length} distinct date(s).`);
  if (dates.length < 2) {
    console.log("Only one date so far — growth and acceleration need at least two runs before they mean anything.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
