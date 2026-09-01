import raw from "./intelligence.json";

export interface MomentumComponent {
  label: string;
  raw?: number;
  weight: number;
  effectiveWeight?: number;
  contribution?: number;
  available?: false;
  reason?: string;
}

export interface Momentum {
  score: number;
  components: Record<string, MomentumComponent>;
  evidenceBasis: {
    availableWeight: number;
    redistributedWeight: number;
    formulaVersion: string;
  };
  derivatives: { level: number; growth: number; acceleration: number };
}

export interface Theme {
  id: string;
  label: string;
  terms: string[];
  size: number;
  companySlugs: string[];
  examples: { name: string; one_liner: string | null }[];
  batches: Record<string, number>;
  counts: number[];
  shares: number[];
  momentum: Momentum;
  sectors: string[];
  autonomyMean: number | null;
  capabilityDemand: Record<string, number>;
  competition: number;
}

export interface DimensionShift {
  id: string;
  label: string;
  poles: [string, string];
  from: { batch: string; n: number; bShare: number | null };
  to: { batch: string; n: number; bShare: number | null };
  deltaPct: number | null;
}

export interface Matrix {
  rows: string[];
  cols: string[];
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  cells: Record<string, number>;
  total: number;
  empty: { row: string; col: string; observed: number; expected: number; emptiness: number }[];
}

export interface DependencyGap {
  id: string;
  label: string;
  demand: number;
  demandRecent: number;
  supply: number;
  ratio: number;
  gapScore: number;
}

export interface Intelligence {
  generatedAt: string;
  versions: Record<string, string>;
  batchOrder: string[];
  momentumBatches: string[];
  themeParams: Record<string, unknown>;
  themesUnassigned: number;
  themes: Theme[];
  dimensionShift: DimensionShift[];
  momentumFormula: {
    version: string;
    components: { id: string; label: string; weight: number; available: boolean; description?: string; unavailableReason?: string }[];
  };
  matrices: { sectorAutonomy: Matrix; sectorStack: Matrix };
  dependencyGaps: DependencyGap[];
  laborMap: {
    roles: string[];
    industries: string[];
    roleTotals: Record<string, number>;
    industryTotals: Record<string, number>;
    cells: Record<string, { count: number; autonomy: number | null; examples: string[] }>;
  };
  infrastructureMap: {
    id: string;
    label: string;
    supplyCount: number;
    suppliers: { name: string; one_liner: string | null }[];
    dependentThemes: { id: string; label: string; dependents: number; momentum: number }[];
  }[];
  physicalMap: {
    id: string;
    label: string;
    count: number;
    industries: Record<string, number>;
    examples: { name: string; one_liner: string | null }[];
  }[];
  transitions: {
    themeId: string;
    themeLabel: string;
    from: number;
    to: number;
    move: number;
    direction: "ascending" | "descending";
    fromLabel: string;
    toLabel: string;
    companiesObserved: number;
    windows: number;
  }[];
  signals: {
    type: string;
    severity: "high" | "medium" | "low";
    confidence: number;
    title: string;
    explanation: string;
    evidence: Record<string, unknown>;
    themes: string[];
    detectedAt: string;
  }[];
  velocity: {
    slug: string;
    name: string;
    batch: string;
    archetype: string;
    archetypeLabel: string;
    standingScore: number | null;
    components: Record<string, { available: boolean; latest?: number; percentileInArchetype?: number; observations?: number; reason?: string }>;
    growth: Record<string, number | null> | null;
    growthAvailable: boolean;
    metricsResolved: number;
  }[];
  observationMeta: { total: number; dates: string[]; resolved: number };
  nonObvious: {
    insights: { kind: string; title: string; explanation: string; evidence: Record<string, unknown> }[];
    nearMisses: { theme: string; capability: string; share: number; ratio: number; momentum: number; failed: string }[];
    criteria: { minDependencyShare: number; minGapRatio: number; minMomentum: number; maxCompetition: number; note: string };
  };
}

export const intelligence = raw as unknown as Intelligence;

/** Themes ranked by momentum, optionally filtered to those with real history. */
export function topThemes(limit = 12): Theme[] {
  return intelligence.themes.slice(0, limit);
}

/**
 * §37 White Space Radar quadrants. Momentum on one axis, competition on the
 * other. The quadrant is an interpretation aid, not a verdict — a theme in
 * "Attack" is a place to look, not a recommendation.
 */
export type Quadrant = "attack" | "crowded" | "early" | "low";

export function quadrantOf(theme: Theme, medianCompetition: number): Quadrant {
  const highMomentum = theme.momentum.score >= 60;
  const highCompetition = theme.competition >= medianCompetition;
  if (highMomentum && !highCompetition) return "attack";
  if (highMomentum && highCompetition) return "crowded";
  if (!highMomentum && !highCompetition) return "early";
  return "low";
}

export const QUADRANT_LABELS: Record<Quadrant, { label: string; hint: string }> = {
  attack: { label: "Attack", hint: "Rising fast, still few companies — investigate first" },
  crowded: { label: "Validated but crowded", hint: "Rising fast, already contested" },
  early: { label: "Early / uncertain", hint: "Quiet on both axes — too soon to tell" },
  low: { label: "Low attractiveness", hint: "Contested without momentum behind it" },
};

export function medianCompetition(): number {
  const sorted = intelligence.themes.map((t) => t.competition).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Layers of the World Stack (§30), ordered top of stack to bottom. */
export const STACK_LAYERS = [
  { id: "operators", label: "AI-Native Operators" },
  { id: "operating_systems", label: "Vertical Operating Systems" },
  { id: "applications", label: "Applications" },
  { id: "infrastructure", label: "AI / Agent Infrastructure" },
  { id: "data", label: "Data" },
  { id: "intelligence", label: "Intelligence" },
  { id: "foundational", label: "Foundational Supply" },
];

export const PHYSICAL_LAYERS = [
  { id: "physical_systems", label: "Physical Systems / Robotics" },
  { id: "physical_intelligence", label: "Physical Intelligence Infrastructure" },
];
