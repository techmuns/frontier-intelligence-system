// Frontier Momentum Score (spec §18–§19).
//
// Configuration-driven and versioned, per §18. Every component is reported
// separately — §18 forbids unexplained black-box scores, so the UI can always
// show what produced a number.
//
// IMPORTANT, and the reason this file is not simply the spec's formula:
// three of the seven specified components need data this system does not have.
// Company traction, external investor validation and explicit RFS signal all
// require funding/traction feeds that do not exist here. §45 forbids inventing
// them. So those components are declared, marked unavailable, and their weight
// is redistributed across the components that CAN be computed — with the
// redistribution reported, so a score is never silently based on less evidence
// than it appears.

export const MOMENTUM_FORMULA = {
  version: "momentum@1",
  components: [
    {
      id: "share_acceleration",
      label: "Cohort Share Acceleration",
      weight: 0.30,
      available: true,
      description: "How fast the theme's share of startup formation is increasing (Δ²S).",
    },
    {
      id: "entrant_velocity",
      label: "New Entrant Velocity",
      weight: 0.15,
      available: true,
      description: "Independent new companies entering in recent cohorts.",
    },
    {
      id: "autonomy_advancement",
      label: "Autonomy Advancement",
      weight: 0.15,
      available: true,
      description: "Whether the theme is climbing the autonomy ladder over time.",
    },
    {
      id: "cross_sector",
      label: "Cross-Sector Replication",
      weight: 0.10,
      available: true,
      description: "Whether the pattern appears across unrelated industries.",
    },
    {
      id: "company_traction",
      label: "Company Traction",
      weight: 0.15,
      available: false,
      unavailableReason: "No traction feed. Requires ARR/customers/usage data this system does not ingest.",
    },
    {
      id: "external_validation",
      label: "External Investor / Market Validation",
      weight: 0.10,
      available: false,
      unavailableReason: "No funding feed. Requires financing-round data this system does not ingest.",
    },
    {
      id: "rfs_signal",
      label: "Accelerator / RFS Signal",
      weight: 0.05,
      available: false,
      unavailableReason: "YC's Request-for-Startups is not published in the API this system reads.",
    },
  ],
};

/** Weight actually carried by computable components, and the scale-up applied. */
export function activeWeighting() {
  const active = MOMENTUM_FORMULA.components.filter((c) => c.available);
  const availableWeight = active.reduce((s, c) => s + c.weight, 0);
  return { active, availableWeight, scale: 1 / availableWeight };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Series helpers. All operate on the theme's share of each cohort, S(t),
 * ordered oldest → newest. §19: we want level, growth AND acceleration,
 * because acceleration before scale is the signal worth having.
 */
function deltas(series) {
  const out = [];
  for (let i = 1; i < series.length; i++) out.push(series[i] - series[i - 1]);
  return out;
}

/**
 * Score one theme.
 *
 * Callers MUST pass only cohorts large enough to produce a meaningful share.
 * A partially-announced batch of one company yields a 100% share for whatever
 * theme that company belongs to, which detonates the second derivative and
 * puts noise at the top of the rankings — the §16 trap, arriving through the
 * back door of a derivative rather than a raw count.
 *
 * @param shares      S(t): theme share of each cohort, oldest → newest, as fractions.
 * @param counts      raw company counts per cohort, oldest → newest.
 * @param autonomy    mean autonomy level per cohort (null where unknown).
 * @param sectorCount distinct industries the theme appears in.
 */
export function scoreTheme({ shares, counts, autonomy, sectorCount }) {
  const components = {};

  // --- Cohort share acceleration (Δ²S) ---
  // Rewards a theme whose share is not merely rising but rising faster. A
  // mature theme sitting flat at 10% scores near zero here by design.
  const d1 = deltas(shares);
  const d2 = deltas(d1);
  const recentAccel = d2.slice(-3);
  const meanAccel = recentAccel.length ? recentAccel.reduce((a, b) => a + b, 0) / recentAccel.length : 0;
  // 0.5pp per cohort of acceleration is treated as a strong signal.
  components.share_acceleration = clamp01(0.5 + meanAccel / 0.01);

  // --- New entrant velocity ---
  const recentCounts = counts.slice(-3);
  const priorCounts = counts.slice(-6, -3);
  const recentMean = mean(recentCounts);
  const priorMean = mean(priorCounts);
  if (priorMean > 0) {
    components.entrant_velocity = clamp01(recentMean / (priorMean * 2));
  } else {
    // No prior baseline: score on absolute recent entry instead of dividing
    // by zero, which would fabricate infinite growth.
    components.entrant_velocity = clamp01(recentMean / 10);
  }

  // --- Autonomy advancement ---
  // Is the theme's centre of gravity climbing tool → copilot → agent →
  // workflow → employee → department → company?
  const known = autonomy.filter((a) => a !== null);
  if (known.length >= 2) {
    const early = mean(known.slice(0, Math.ceil(known.length / 2)));
    const late = mean(known.slice(Math.floor(known.length / 2)));
    // A full level of movement across the window is a strong signal.
    components.autonomy_advancement = clamp01(0.5 + (late - early) / 2);
  } else {
    components.autonomy_advancement = 0.5; // no basis to move it either way
  }

  // --- Cross-sector replication ---
  // Appearing across unrelated industries is stronger evidence than depth in
  // one. Five distinct sectors is treated as full marks.
  components.cross_sector = clamp01(sectorCount / 5);

  // --- Combine, redistributing unavailable weight ---
  const { active, availableWeight, scale } = activeWeighting();
  let total = 0;
  for (const c of active) total += (components[c.id] ?? 0) * c.weight * scale;

  return {
    score: Math.round(total * 100),
    components: Object.fromEntries(
      MOMENTUM_FORMULA.components.map((c) => [
        c.id,
        c.available
          ? {
              label: c.label,
              raw: Math.round((components[c.id] ?? 0) * 100),
              weight: c.weight,
              effectiveWeight: Math.round(c.weight * scale * 100) / 100,
              contribution: Math.round((components[c.id] ?? 0) * c.weight * scale * 100),
            }
          : { label: c.label, available: false, weight: c.weight, reason: c.unavailableReason },
      ]),
    ),
    // Surfaced so the UI can state how much of the specified formula is
    // actually backed by data — never implying more evidence than exists.
    evidenceBasis: {
      availableWeight: Math.round(availableWeight * 100),
      redistributedWeight: Math.round((1 - availableWeight) * 100),
      formulaVersion: MOMENTUM_FORMULA.version,
    },
    // §19 — level, growth, acceleration reported alongside the score.
    derivatives: {
      level: round4(shares.at(-1) ?? 0),
      growth: round4(d1.at(-1) ?? 0),
      acceleration: round4(d2.at(-1) ?? 0),
    },
  };
}

function mean(xs) {
  const valid = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}
