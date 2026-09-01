// Company Velocity (§20–§22).
//
// §20 is explicit that companies must NOT all be compared on the same metrics:
// a developer-tools company and a robotics company succeed at different things,
// so an archetype is assigned first and every company is scored only against
// its own archetype.
//
// What this can and cannot do today, stated plainly rather than papered over:
//   - CAN score current standing (attention, web presence) as a percentile
//     within archetype.
//   - CANNOT yet compute growth or acceleration, which is what §21 actually
//     wants. Those need two or more observation dates. Until the store has
//     them, growth is reported as unavailable rather than as zero — a company
//     with no history is not a company with flat history.

export const ARCHETYPES = [
  {
    id: "developer_oss",
    label: "Developer / Open Source",
    // Ordered before the others: a dev-tools company is often also B2B, and
    // the developer signals (stars, downloads) are the meaningful ones.
    test: (c) =>
      /\b(developers?|engineers?|sdk|api|open[- ]source|codebase|cli|library|framework)\b/i.test(
        `${c.one_liner ?? ""} ${c.long_description ?? ""}`,
      ),
    metrics: ["github_stars", "hn_points", "hn_mentions", "web_rank"],
  },
  {
    id: "robotics_deeptech",
    label: "Robotics / Deep Tech",
    test: (c) => c.isRobotics || ["physical_systems", "physical_intelligence", "foundational"].includes(c.dimensions?.stackPosition.layer),
    metrics: ["hn_points", "web_rank"],
  },
  {
    id: "biotech_science",
    label: "Biotech / Science",
    test: (c) => /\b(biotech|drug|clinical|therapeut\w*|protein|molecul\w*|assay|wetlab|patients?)\b/i.test(`${c.one_liner ?? ""} ${c.long_description ?? ""}`),
    metrics: ["hn_points", "web_rank"],
  },
  {
    id: "consumer",
    label: "Consumer",
    test: (c) => c.industry === "Consumer" || /\b(consumers?|app for (you|people)|personal|social)\b/i.test(c.one_liner ?? ""),
    metrics: ["web_rank", "hn_mentions"],
  },
  {
    id: "enterprise_saas",
    label: "Enterprise SaaS / AI",
    test: () => true, // fallback — the majority of this cohort
    metrics: ["hn_points", "web_rank"],
  },
];

export function archetypeOf(company) {
  return ARCHETYPES.find((a) => a.test(company)) ?? ARCHETYPES[ARCHETYPES.length - 1];
}

/** Latest value per company per metric, plus the full dated series. */
export function indexObservations(observations) {
  const byCompany = new Map();
  for (const o of observations) {
    if (o.value === null) continue;
    const entry = byCompany.get(o.companySlug) ?? {};
    const series = entry[o.metric] ?? [];
    series.push({ at: o.observedAt, value: o.value });
    entry[o.metric] = series;
    byCompany.set(o.companySlug, entry);
  }
  for (const entry of byCompany.values()) {
    for (const metric of Object.keys(entry)) {
      entry[metric].sort((a, b) => a.at.localeCompare(b.at));
    }
  }
  return byCompany;
}

/** Percentile of a value within a population (0-100). */
function percentile(value, population, lowerIsBetter = false) {
  if (population.length === 0) return null;
  const below = population.filter((p) => (lowerIsBetter ? p > value : p < value)).length;
  return Math.round((below / population.length) * 100);
}

// Tranco rank is inverted — rank 1 is the largest site — so a lower number is
// a better result. Getting this backwards would rank the biggest companies
// last, so it is declared per metric rather than assumed.
const LOWER_IS_BETTER = new Set(["web_rank"]);

export function computeVelocity(companies, observations) {
  const index = indexObservations(observations);
  const dates = new Set(observations.map((o) => o.observedAt.slice(0, 10)));
  const hasHistory = dates.size >= 2;

  // Build per-archetype populations first, so each company is ranked against
  // its own kind rather than the whole cohort (§20).
  const populations = new Map();
  const enriched = companies.map((c) => {
    const archetype = archetypeOf(c);
    const metrics = index.get(c.slug) ?? {};
    for (const metric of archetype.metrics) {
      const series = metrics[metric];
      if (!series?.length) continue;
      const key = `${archetype.id}|${metric}`;
      const pop = populations.get(key) ?? [];
      pop.push(series.at(-1).value);
      populations.set(key, pop);
    }
    return { company: c, archetype, metrics };
  });

  return enriched.map(({ company, archetype, metrics }) => {
    const components = {};
    const scores = [];

    for (const metric of archetype.metrics) {
      const series = metrics[metric];
      if (!series?.length) {
        components[metric] = { available: false, reason: "no observation resolved for this company" };
        continue;
      }
      const latest = series.at(-1).value;
      const pop = populations.get(`${archetype.id}|${metric}`) ?? [];
      const pct = percentile(latest, pop, LOWER_IS_BETTER.has(metric));
      components[metric] = {
        available: true,
        latest,
        percentileInArchetype: pct,
        observations: series.length,
      };
      if (pct !== null) scores.push(pct);
    }

    // §21 wants growth and acceleration. They need at least two dated
    // readings; reporting zero before then would state flatness we have not
    // observed, so they stay explicitly unavailable.
    const growth = hasHistory ? computeGrowth(metrics, archetype.metrics) : null;

    return {
      slug: company.slug,
      name: company.name,
      batch: company.batch,
      archetype: archetype.id,
      archetypeLabel: archetype.label,
      // Standing, not velocity — named honestly. It becomes a velocity score
      // once the growth components below have data.
      standingScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      components,
      growth,
      growthAvailable: hasHistory,
      metricsResolved: scores.length,
    };
  });
}

function computeGrowth(metrics, wanted) {
  const out = {};
  for (const metric of wanted) {
    const series = metrics[metric];
    if (!series || series.length < 2) {
      out[metric] = null;
      continue;
    }
    const first = series[0].value;
    const last = series.at(-1).value;
    if (!first) {
      out[metric] = null;
      continue;
    }
    const change = (last - first) / Math.abs(first);
    out[metric] = Math.round((LOWER_IS_BETTER.has(metric) ? -change : change) * 1000) / 10;
  }
  return out;
}

export const VELOCITY_VERSION = "velocity@1";
