#!/usr/bin/env node
//
// Builds the dashboard's bundled datasets from the public YC API
// (yc-oss/api, a daily mirror of YC's public Algolia index).
//
// Produces two files, deliberately split by size:
//
//   src/data/yc-companies.json  — full records, current batches only. Powers
//                                 the company explorer and detail view.
//   src/data/yc-trends.json     — per-batch aggregates for a much longer
//                                 history. Powers the momentum/trend charts.
//                                 Aggregates instead of full records keeps
//                                 ~3k companies from bloating the bundle.
//
// Run: node scripts/build-data.mjs

import { writeFile } from "node:fs/promises";

const API = "https://yc-oss.github.io/api/batches";

// Full company records are bundled for these (the batches the explorer shows).
const CURRENT_BATCHES = [
  "winter-2026",
  "spring-2026",
  "summer-2026",
  "fall-2026",
  "winter-2027",
];

// Aggregates are computed for this longer window, oldest first, to give the
// trend charts a real baseline. Momentum is meaningless without one.
const TREND_BATCHES = [
  "winter-2022",
  "summer-2022",
  "winter-2023",
  "summer-2023",
  "winter-2024",
  "summer-2024",
  "fall-2024",
  "winter-2025",
  "spring-2025",
  "summer-2025",
  "fall-2025",
  "winter-2026",
  "spring-2026",
  "summer-2026",
  "fall-2026",
  "winter-2027",
];

// Fields kept in the bundled full records — everything the UI actually reads.
const FIELDS = [
  "id", "name", "slug", "website", "all_locations", "one_liner",
  "long_description", "team_size", "industry", "subindustry", "industries",
  "tags", "top_company", "isHiring", "nonprofit", "batch", "status", "stage",
  "launched_at", "url",
];

// A batch materially smaller than its neighbours is still being announced.
// Its low count is an artifact of timing, not a real decline — the UI must
// label it so nobody reads it as a downward trend.
const PARTIAL_BATCH_THRESHOLD = 100;

// YC files robotics companies under whatever vertical they serve — "Robotics
// for Space R&D" lands in Aviation & Space, "Robots that run autonomous depots"
// in Energy, "robotics to automate quality inspection" in Climate. Counting
// only the Manufacturing-and-Robotics label therefore undercounts robotics by
// roughly a third.
//
// So a company counts as robotics if EITHER YC labelled it that way, OR its
// own one-line pitch names a physical robot. Deliberate choices here:
//   - only unambiguous physical nouns. "Autonomous" is excluded because it
//     describes software agents as often as machines, and including it halved
//     precision (33% vs 51%) for almost no extra recall.
//   - one_liner only, never long_description. The long text catches companies
//     that merely mention robots as a customer ("upload acceleration for
//     1GB-100TB files"); the one-liner is the company's own positioning.
// Hand-checked against the current 654 companies: all 53 keyword matches were
// genuine robotics/drone businesses.
const ROBOTICS_RE =
  /\b(robot|robots|robotic|robotics|drone|drones|humanoid|actuator|actuators|gripper|manipulator|teleoperat\w*)\b/i;

function isRobotics(company) {
  if ((company.subindustry ?? "").includes("Manufacturing and Robotics")) return true;
  return ROBOTICS_RE.test(company.one_liner ?? "");
}

// AI is detected the same way, and for a sharper reason: tags are the only
// place YC records "AI", and tag coverage swings between 23% and 99% by batch.
// A tag-derived AI share therefore tracks how thoroughly YC tagged a batch
// more than what the batch contains — it read as AI collapsing from 60% to
// 13% and recovering, purely from missing data. One-liners are populated for
// essentially every company, so this measures the batch instead of the
// bookkeeping. On the current 654 it finds 58% vs the tags' 35%; the extra
// matches were checked and are genuine ("World models for robot evals",
// "Multimodal foundation models", "Datadog for Agent Reliability").
const AI_RE =
  /\b(ai|a\.i\.|artificial intelligence|llm|llms|agent|agents|agentic|machine learning|gpt|neural|foundation model\w*|world model\w*|copilot|chatbot)\b/i;

function isAI(company) {
  if ((company.tags ?? []).some((t) => /^(ai|artificial intelligence)$/i.test(t))) return true;
  return AI_RE.test(company.one_liner ?? "");
}

async function fetchBatch(slug) {
  const res = await fetch(`${API}/${slug}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${slug}: HTTP ${res.status}`);
  return res.json();
}

function countBy(companies, getKeys) {
  const counts = new Map();
  for (const c of companies) {
    for (const key of getKeys(c)) {
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function topN(counts, n) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

async function main() {
  console.log("Fetching batches…");
  const byBatch = new Map();
  for (const slug of [...new Set([...CURRENT_BATCHES, ...TREND_BATCHES])]) {
    byBatch.set(slug, await fetchBatch(slug));
    process.stdout.write(`  ${slug}: ${byBatch.get(slug).length}\n`);
  }

  // --- Full records for the current batches ---
  const seen = new Set();
  const companies = [];
  for (const slug of CURRENT_BATCHES) {
    for (const c of byBatch.get(slug)) {
      if (seen.has(c.slug)) continue; // dedupe by YC slug
      seen.add(c.slug);
      // Classification is resolved here, once, so the UI never re-implements
      // these rules and the two datasets can't drift apart.
      companies.push({
        ...Object.fromEntries(FIELDS.map((f) => [f, c[f] ?? null])),
        isAI: isAI(c),
        isRobotics: isRobotics(c),
      });
    }
  }

  // --- Per-batch aggregates across the longer history ---
  // Shares are computed against each batch's own observed total, so a
  // partially-announced batch is still comparable on composition even
  // though its absolute count is not.
  const trends = TREND_BATCHES.map((slug) => {
    const list = byBatch.get(slug);
    const total = list.length;
    const industries = countBy(list, (c) => [c.industry]);
    const tags = countBy(list, (c) => c.tags ?? []);
    const teamSizes = list.map((c) => c.team_size).filter((n) => typeof n === "number" && n > 0);

    // Tag coverage varies wildly by batch — some recent batches have >75% of
    // companies with no tags at all, because YC hasn't finished tagging them.
    // Tag share MUST therefore be measured against the tagged subset, not the
    // batch total: dividing by total makes an untagged batch look like a
    // collapse in whatever the tag measures, which is a data artifact, not a
    // market movement. taggedCount is carried through so the UI can say how
    // thin the evidence is rather than quietly implying a trend.
    const taggedCount = list.filter((c) => (c.tags ?? []).length > 0).length;

    // Subindustry is where the actual rotation shows up — a flat "Industrials"
    // share hides that its composition changed completely. YC formats these as
    // "Parent -> Child"; keep the full label so children of different parents
    // can't collide (e.g. Energy appears under more than one).
    const subindustries = countBy(list, (c) => [c.subindustry]);

    return {
      slug,
      batch: list[0]?.batch ?? slug,
      total,
      partial: total < PARTIAL_BATCH_THRESHOLD,
      taggedCount,
      hiring: list.filter((c) => c.isHiring).length,
      medianTeamSize: median(teamSizes),
      industries: Object.fromEntries(industries),
      subindustries: Object.fromEntries(subindustries),
      // Both are carried so the UI can show what YC's own taxonomy reports
      // alongside the corrected count, rather than silently replacing one
      // with the other.
      roboticsLabelled: list.filter((c) => (c.subindustry ?? "").includes("Manufacturing and Robotics")).length,
      roboticsTotal: list.filter(isRobotics).length,
      // Same pairing for AI: what tags alone report, and the corrected count.
      aiTagged: list.filter((c) => (c.tags ?? []).some((t) => /^(ai|artificial intelligence)$/i.test(t))).length,
      aiTotal: list.filter(isAI).length,
      topTags: topN(tags, 25),
    };
  });

  await writeFile("src/data/yc-companies.json", JSON.stringify(companies));
  await writeFile("src/data/yc-trends.json", JSON.stringify(trends));

  console.log(`\nWrote ${companies.length} full company records.`);
  console.log(`Wrote aggregates for ${trends.length} batches (${trends.reduce((s, t) => s + t.total, 0)} companies observed).`);
}

function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
