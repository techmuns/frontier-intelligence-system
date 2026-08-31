// Transition detector (§26) and market signal detection (§40–§41).
//
// §41 is the hard constraint here: "Do not generate generic commentary.
// Require supporting quantitative evidence." So every signal produced by this
// file carries the numbers that triggered it, and a signal is only emitted
// when a threshold is crossed — never as narration over whatever the data
// happens to look like.

/**
 * §26 Transition detector.
 *
 * A theme's centre of gravity on the autonomy ladder either moves or it does
 * not. Comparing the mean autonomy of a theme's early cohorts against its
 * recent ones says whether the category is climbing tool → copilot → agent →
 * workflow → employee → department → company.
 */
export function detectTransitions(themes, { minPerWindow = 3, minMove = 0.4 } = {}) {
  const transitions = [];

  for (const theme of themes) {
    const series = theme.autonomyByBatch ?? [];
    const known = series.filter((s) => s.mean !== null && s.n >= minPerWindow);
    if (known.length < 4) continue; // not enough history to claim movement

    const half = Math.floor(known.length / 2);
    const early = known.slice(0, half);
    const late = known.slice(half);

    const earlyMean = avg(early.map((s) => s.mean));
    const lateMean = avg(late.map((s) => s.mean));
    const move = lateMean - earlyMean;
    if (Math.abs(move) < minMove) continue;

    transitions.push({
      themeId: theme.id,
      themeLabel: theme.label,
      from: round2(earlyMean),
      to: round2(lateMean),
      move: round2(move),
      direction: move > 0 ? "ascending" : "descending",
      fromLabel: LADDER[Math.round(earlyMean)] ?? "Unknown",
      toLabel: LADDER[Math.round(lateMean)] ?? "Unknown",
      companiesObserved: known.reduce((s, x) => s + x.n, 0),
      windows: known.length,
    });
  }

  return transitions.sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
}

const LADDER = [
  "Information",
  "Copilot",
  "Task Agent",
  "Workflow Owner",
  "Digital Employee",
  "Department",
  "AI-Native Company",
];

/**
 * §40 Signal detection.
 *
 * Each detector is a rule with an explicit threshold. A signal carries its
 * type, severity, the evidence that produced it and an explanation, so it can
 * be traced back to the numbers rather than trusted.
 */
export function detectSignals({ themes, transitions, dependencyGaps, dimensionShift, batchOrder }) {
  const signals = [];
  const add = (s) => signals.push({ ...s, detectedAt: new Date().toISOString() });

  // --- Theme acceleration: share growth is itself increasing ---
  for (const t of themes) {
    const accel = t.momentum.derivatives.acceleration;
    if (accel > 0.01 && t.size >= 8) {
      add({
        type: "theme_acceleration",
        severity: accel > 0.02 ? "high" : "medium",
        confidence: 0.6,
        title: `${t.label} is accelerating`,
        explanation: `Share of cohort is not merely rising but rising faster: Δ²S of ${(accel * 100).toFixed(2)}pp across ${t.size} companies.`,
        evidence: { acceleration: accel, momentum: t.momentum.score, companies: t.size },
        themes: [t.id],
      });
    }
  }

  // --- Cross-sector replication: the same pattern in unrelated industries ---
  // §22's logic — several independent companies converging is stronger
  // evidence than one, and across unrelated sectors stronger still.
  for (const t of themes) {
    if (t.sectors.length >= 5 && t.size >= 10) {
      add({
        type: "cross_sector_convergence",
        severity: "medium",
        confidence: 0.65,
        title: `${t.label} is replicating across ${t.sectors.length} sectors`,
        explanation: `${t.size} companies across unrelated industries (${t.sectors.slice(0, 5).join(", ")}) are converging on the same pattern.`,
        evidence: { sectors: t.sectors, companies: t.size },
        themes: [t.id],
      });
    }
  }

  // --- Autonomy progression ---
  for (const tr of transitions.filter((x) => x.direction === "ascending").slice(0, 6)) {
    add({
      type: "autonomy_progression",
      severity: tr.move > 0.8 ? "high" : "medium",
      confidence: 0.55,
      title: `${tr.themeLabel}: ${tr.fromLabel} → ${tr.toLabel}`,
      explanation: `Mean autonomy moved ${tr.move > 0 ? "+" : ""}${tr.move} levels across ${tr.windows} cohorts (${tr.companiesObserved} companies observed).`,
      evidence: tr,
      themes: [tr.themeId],
    });
  }

  // --- Dependency bottleneck: demand far outstripping supply ---
  for (const g of dependencyGaps.filter((x) => x.ratio >= 8 && x.demand >= 30).slice(0, 6)) {
    add({
      type: "dependency_bottleneck",
      severity: g.ratio >= 20 ? "high" : "medium",
      confidence: 0.5,
      title: `${g.label} is a bottleneck`,
      explanation: `${g.demand} companies depend on ${g.label.toLowerCase()} while only ${g.supply} supply it — a ${g.ratio}× gap.`,
      evidence: { demand: g.demand, supply: g.supply, ratio: g.ratio },
      themes: [],
    });
  }

  // --- Structural shift on a stable primitive axis ---
  for (const s of dimensionShift) {
    if (s.deltaPct === null || Math.abs(s.deltaPct) < 10) continue;
    add({
      type: "structural_shift",
      severity: Math.abs(s.deltaPct) > 25 ? "high" : "medium",
      confidence: 0.7,
      title: `${s.label}: ${s.deltaPct > 0 ? "+" : ""}${s.deltaPct}pt toward ${s.poles[1]}`,
      explanation: `Between ${s.from.batch} and ${s.to.batch} the mix moved from ${(s.from.bShare * 100).toFixed(0)}% to ${(s.to.bShare * 100).toFixed(0)}% ${s.poles[1]}, across ${s.to.n} classified companies.`,
      evidence: s,
      themes: [],
    });
  }

  // --- Sudden slowdown in formation ---
  // Deliberately checks the most recent COMPLETE cohorts. Reading a drop off
  // a partially-announced batch is the §16 trap, and it would fire this
  // detector on every single theme every time a new batch opened.
  for (const t of themes) {
    const counts = t.counts.slice(0, batchOrder.length);
    const recent = counts.slice(-3, -1); // exclude the newest, likely partial
    const prior = counts.slice(-6, -3);
    if (prior.length < 2 || avg(prior) < 3) continue;
    const drop = 1 - avg(recent) / avg(prior);
    if (drop > 0.6) {
      add({
        type: "formation_slowdown",
        severity: "medium",
        confidence: 0.45,
        title: `${t.label} formation is slowing`,
        explanation: `New companies per cohort fell ${(drop * 100).toFixed(0)}% versus the preceding three cohorts (${avg(prior).toFixed(1)} → ${avg(recent).toFixed(1)}).`,
        evidence: { priorMean: round2(avg(prior)), recentMean: round2(avg(recent)), drop: round2(drop) },
        themes: [t.id],
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return signals.sort((a, b) => order[a.severity] - order[b.severity] || b.confidence - a.confidence);
}

/**
 * §41 "What most people will miss".
 *
 * Deliberately narrow. An insight qualifies only when two independent signals
 * point at the same thing — a theme that is accelerating AND under-supplied on
 * a capability it depends on, for instance. A single signal is just a signal;
 * the non-obvious part is the intersection.
 */
export function findNonObvious({ themes, dependencyGaps, transitions }) {
  const insights = [];
  const gapById = new Map(dependencyGaps.map((g) => [g.label, g]));

  // Thresholds are set RELATIVE to the observed distribution rather than as
  // fixed magic numbers. Absolute cut-offs are arbitrary — and worse, tuning
  // them until an insight appears is manufacturing the finding, which is
  // exactly what §41 rules out. "Uncrowded" therefore means below the median
  // theme size in this dataset, and dependency intensity is a share of the
  // theme rather than a raw count, so a small theme is not penalised for
  // being small.
  const sizes = themes.map((t) => t.competition).sort((a, b) => a - b);
  const medianSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const MIN_DEPENDENCY_SHARE = 0.2; // a fifth of the theme leans on it
  const MIN_GAP_RATIO = 5;

  for (const t of themes) {
    // Rising, but resting on a capability almost nobody supplies.
    const demands = Object.entries(t.capabilityDemand).sort((a, b) => b[1] - a[1]);
    for (const [label, count] of demands.slice(0, 4)) {
      const gap = gapById.get(label);
      if (!gap || gap.ratio < MIN_GAP_RATIO) continue;
      if (t.size === 0 || count / t.size < MIN_DEPENDENCY_SHARE) continue;
      if (t.momentum.score < 55) continue;
      insights.push({
        kind: "underbuilt_dependency",
        title: `${t.label} is scaling on top of thin ${label.toLowerCase()} infrastructure`,
        explanation: `${count} of the ${t.size} companies in this theme (${Math.round((count / t.size) * 100)}%) depend on ${label.toLowerCase()}, and the theme scores ${t.momentum.score} on momentum — but across all cohorts only ${gap.supply} companies supply that capability against ${gap.demand} that need it (${gap.ratio}×).`,
        evidence: { theme: t.id, themeMomentum: t.momentum.score, dependents: count, supply: gap.supply, ratio: gap.ratio },
      });
      break; // one per theme; the strongest dependency is the point
    }
  }

  // A theme climbing the autonomy ladder while still uncrowded is the
  // "before it becomes obvious" case the whole system is built to find.
  for (const tr of transitions.filter((x) => x.direction === "ascending")) {
    const theme = themes.find((t) => t.id === tr.themeId);
    if (!theme || theme.competition > medianSize) continue;
    insights.push({
      kind: "quiet_autonomy_climb",
      title: `${tr.themeLabel} is climbing the autonomy ladder while still small`,
      explanation: `Mean autonomy moved ${tr.fromLabel} → ${tr.toLabel} (${tr.move > 0 ? "+" : ""}${tr.move} levels) across ${tr.windows} cohorts, yet only ${theme.competition} companies occupy the theme — below the ${medianSize}-company median.`,
      evidence: { theme: tr.themeId, move: tr.move, competition: theme.competition },
    });
  }

  // Near-misses are returned alongside, so an empty result is informative
  // rather than blank. "Nothing qualified" is a legitimate answer under §41,
  // but the reader should be able to see what came closest and judge the bar
  // for themselves — otherwise an empty panel looks like a broken one.
  const nearMisses = [];
  for (const t of themes) {
    for (const [label, count] of Object.entries(t.capabilityDemand)) {
      const gap = gapById.get(label);
      if (!gap || t.size === 0) continue;
      const share = count / t.size;
      const qualifies = gap.ratio >= MIN_GAP_RATIO && share >= MIN_DEPENDENCY_SHARE && t.momentum.score >= 55;
      if (qualifies || gap.ratio < MIN_GAP_RATIO) continue;
      nearMisses.push({
        theme: t.label,
        capability: label,
        share: Math.round(share * 100) / 100,
        ratio: gap.ratio,
        momentum: t.momentum.score,
        failed: share < MIN_DEPENDENCY_SHARE ? "dependency share" : "theme momentum",
      });
    }
  }
  nearMisses.sort((a, b) => b.share - a.share);

  return {
    insights: insights.slice(0, 10),
    nearMisses: nearMisses.slice(0, 6),
    criteria: {
      minDependencyShare: MIN_DEPENDENCY_SHARE,
      minGapRatio: MIN_GAP_RATIO,
      minMomentum: 55,
      maxCompetition: medianSize,
      note: "Thresholds are relative to the observed distribution. An empty result means nothing crossed the bar — not that the engine failed.",
    },
  };
}

function avg(xs) {
  const v = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

export const SIGNALS_VERSION = "signals@1";
