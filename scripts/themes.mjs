// Dynamic theme discovery (spec §12).
//
// The point of §0: DO NOT ship a fixed taxonomy. Themes here are *discovered*
// from what companies actually say, so a category that does not exist today
// appears on its own as soon as enough companies describe it — no code change,
// no schema change. This is what makes §54/§55 (ingesting a company from a
// category nobody has named yet) work.
//
// Method: TF-IDF over company text, cosine similarity, then greedy
// agglomeration around the densest seeds.
//
// Honest limitation: the spec asks for embeddings and an LLM to label each
// cluster. There is no model available at build time here, so clusters are
// labelled from their most distinctive terms instead. That is weaker — labels
// read as keyword lists rather than prose — but it is genuinely unsupervised,
// and swapping in embeddings later means replacing `vectorise` alone.

const STOPWORDS = new Set(`
a about above after again against all also am an and any are aren as at be because been before being
below between both but by can cannot could couldn did didn do does doesn doing don down during each few
for from further had hadn has hasn have haven having he her here hers herself him himself his how i if
in into is isn it its itself just ll me more most mustn my myself no nor not now of off on once only or
other our ours ourselves out over own re s same shan she should shouldn so some such t than that the
their theirs them themselves then there these they this those through to too under until up ve very was
wasn we were weren what when where which while who whom why will with won would wouldn you your yours
yourself yourselves us via our using use used uses make makes making build building builds built
company companies startup startups platform platforms solution solutions product products service
services business businesses customer customers user users team teams help helps helping new first
best better fast faster easy easier get gets need needs want wants time times way ways world
one two three every any all more less most least it's we're they're don't
`.trim().split(/\s+/));

// Terms so common in this cohort they carry no information — every third
// company is "AI for X", so "ai" cannot distinguish a theme.
const UNINFORMATIVE = new Set(["ai", "artificial", "intelligence", "llm", "llms", "gpt", "model", "models", "agent", "agents", "agentic", "automate", "automated", "automation", "software", "data", "api"]);

function tokenise(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 2 && t.length < 24 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function docText(company) {
  // one_liner twice: it is the company's own positioning and much less noisy
  // than the long description, so it should dominate the vector.
  return `${company.one_liner ?? ""} ${company.one_liner ?? ""} ${company.long_description ?? ""}`;
}

/** TF-IDF vectors, L2-normalised so a dot product is cosine similarity. */
function vectorise(companies) {
  const docs = companies.map((c) => tokenise(docText(c)));

  const df = new Map();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const N = docs.length;
  return docs.map((doc) => {
    const tf = new Map();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);

    const vec = new Map();
    let norm = 0;
    for (const [term, count] of tf) {
      const seen = df.get(term) ?? 1;
      // Drop terms appearing in nearly every doc (no signal) or just one
      // (noise that cannot form a cluster).
      if (seen < 3 || seen > N * 0.25) continue;
      const weight = (1 + Math.log(count)) * Math.log(N / seen);
      const penalised = UNINFORMATIVE.has(term) ? weight * 0.15 : weight;
      vec.set(term, penalised);
      norm += penalised * penalised;
    }

    norm = Math.sqrt(norm) || 1;
    for (const [term, w] of vec) vec.set(term, w / norm);
    return vec;
  });
}

function cosine(a, b) {
  // Iterate the smaller vector — most pairs share few terms.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  for (const [term, w] of small) {
    const other = large.get(term);
    if (other) sum += w * other;
  }
  return sum;
}

/**
 * Greedy agglomeration: repeatedly take the company with the most close
 * neighbours as a seed, absorb everything similar to it, and continue.
 *
 * Chosen over k-means because the number of themes is not known in advance —
 * that is the whole point of discovering them — and over strict hierarchical
 * clustering because this runs at build time on ~650 docs and needs to stay
 * simple enough to reason about.
 */
export function discoverThemes(companies, { threshold = 0.16, minSize = 4, maxThemes = 40 } = {}) {
  const vectors = vectorise(companies);
  const n = companies.length;

  // Neighbour lists above the similarity threshold.
  const neighbours = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosine(vectors[i], vectors[j]);
      if (sim >= threshold) {
        neighbours[i].push([j, sim]);
        neighbours[j].push([i, sim]);
      }
    }
  }

  const assigned = new Set();
  const themes = [];

  while (themes.length < maxThemes) {
    // Seed = densest unassigned company.
    let seed = -1;
    let bestDegree = 0;
    for (let i = 0; i < n; i++) {
      if (assigned.has(i)) continue;
      const degree = neighbours[i].filter(([j]) => !assigned.has(j)).length;
      if (degree > bestDegree) {
        bestDegree = degree;
        seed = i;
      }
    }
    if (seed === -1 || bestDegree < minSize - 1) break;

    const members = [seed, ...neighbours[seed].filter(([j]) => !assigned.has(j)).map(([j]) => j)];
    if (members.length < minSize) {
      assigned.add(seed); // too small to be a theme; retire the seed
      continue;
    }
    for (const m of members) assigned.add(m);

    themes.push(buildTheme(members, companies, vectors));
  }

  return {
    themes,
    unassigned: companies.filter((_, i) => !assigned.has(i)).length,
    // §5/§49 — the parameters that produced this ontology, so a stored theme
    // set can be traced to how it was derived.
    params: { threshold, minSize, maxThemes, method: "tfidf-cosine-greedy" },
  };
}

function buildTheme(memberIndexes, companies, vectors) {
  // Label from the terms that carry the most weight across members. Not LLM
  // labelling as the spec asks for — see the note at the top of this file.
  const termWeight = new Map();
  for (const i of memberIndexes) {
    for (const [term, w] of vectors[i]) {
      termWeight.set(term, (termWeight.get(term) ?? 0) + w);
    }
  }

  const topTerms = [...termWeight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term]) => term);

  const members = memberIndexes.map((i) => companies[i]);

  return {
    id: topTerms.slice(0, 3).join("-") || `theme-${memberIndexes[0]}`,
    label: topTerms.slice(0, 3).map(titleCase).join(" · "),
    terms: topTerms,
    size: members.length,
    companySlugs: members.map((c) => c.slug),
    // Kept so a theme can be shown with real evidence rather than asserted.
    examples: members.slice(0, 18).map((c) => ({ name: c.name, one_liner: c.one_liner })),
    batches: countBy(members, (c) => c.batch),
  };
}

function titleCase(term) {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

function countBy(items, get) {
  const out = {};
  for (const item of items) {
    const key = get(item);
    if (key) out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export const THEME_ENGINE_VERSION = "themes@1-tfidf";
