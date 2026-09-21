// Design tokens.
//
// Every value is a `var(--…)` reference into src/styles/theme.css rather than a
// literal colour. That indirection is the whole dark-mode mechanism: components
// keep writing `color: tokens.textPrimary` exactly as before, and setting one
// attribute on <html> repaints all of them. No component knows which theme is
// active, and none needed rewriting to gain a second one.
//
// The category hues come from the skill's ui-standards and are unchanged. Only
// their backgrounds and borders vary by theme; the hue a reader learns to
// associate with a category stays put.

export const categoryColors = {
  markets: { bg: "var(--cat-markets-bg)", text: "var(--c-blue)", border: "var(--cat-markets-border)" },
  crypto: { bg: "var(--cat-crypto-bg)", text: "var(--c-orange)", border: "var(--cat-crypto-border)" },
  analytics: { bg: "var(--cat-analytics-bg)", text: "var(--c-violet)", border: "var(--cat-analytics-border)" },
  tools: { bg: "var(--cat-tools-bg)", text: "var(--c-green)", border: "var(--cat-tools-border)" },
  india: { bg: "var(--cat-india-bg)", text: "var(--c-amber)", border: "var(--cat-india-border)" },
  heatmaps: { bg: "var(--cat-heatmaps-bg)", text: "var(--c-pink)", border: "var(--cat-heatmaps-border)" },
  sector: { bg: "var(--cat-sector-bg)", text: "var(--c-teal)", border: "var(--cat-sector-border)" },
} as const;

export type CategoryKey = keyof typeof categoryColors;

/**
 * Semantic chart colours. A hue means the same thing on every page, so a
 * reader learns the vocabulary once.
 */
export const chart = {
  ai: "var(--c-blue)",
  shift: "var(--c-pink)",
  secondary: "var(--c-teal)",
  infrastructure: "var(--c-orange)",
  autonomy: "var(--c-violet)",
  growth: "var(--c-green)",
  support: "var(--c-amber)",
  /** Context lines and bars that are deliberately not the point. */
  neutral: "var(--c-neutral)",
} as const;

/**
 * Fixed assignment order for multi-series charts, NEVER cycled or reshuffled.
 *
 * Verified with the dataviz skill's validator against both surfaces. The
 * obvious order (blue, pink, green, amber, violet, orange, teal) FAILS: green
 * and pink land adjacent at ΔE 2.7 under deuteranopia, which is the classic
 * red/green collision. This order passes on white and on the dark navy.
 * Re-run `validate_palette.js` before changing it.
 */
export const chartColorRotation: string[] = [
  chart.ai,
  chart.shift,
  chart.secondary,
  chart.infrastructure,
  chart.autonomy,
  chart.growth,
  chart.support,
];

// Type scale. Changing a step here moves the whole dashboard together rather
// than leaving components to drift apart.
export const type = {
  micro: 11,
  small: 12,
  body: 13,
  title: 14,
  heading: 17,
  statLabel: 12,
  stat: 32,
} as const;

export const tokens = {
  primary: "var(--accent)",
  primaryLight: "var(--accent-soft)",
  primaryBorder: "var(--accent-border)",
  primaryText: "var(--accent-text)",
  pageBackground: "var(--bg)",
  cardBackground: "var(--surface)",
  cardHeader: "var(--surface)",
  cardBodyBg: "var(--surface-2)",
  headerBar: "var(--header-bg)",
  sidebarBg: "var(--sidebar-bg)",
  borderDefault: "var(--border)",
  borderStrong: "var(--border-strong)",
  borderHover: "var(--accent-border)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textHint: "var(--text-hint)",
  errorRed: "var(--error)",
  errorBg: "var(--error-bg)",
  grid: "var(--grid)",
  tooltipBg: "var(--tooltip-bg)",
  tooltipShadow: "var(--tooltip-shadow)",
  rowHover: "var(--row-hover)",
  sunken: "var(--surface-sunken)",
} as const;

/**
 * Sequential heatmap fill for a 0-1 intensity, in stepped form.
 *
 * Each theme defines its own steps (see theme.css). A translucent tint of the
 * accent — the original approach in both matrices — vanishes on a dark
 * surface, and reusing the light ramp there inverts it, making the emptiest
 * cells the brightest. Both ramps therefore run low → high away from their own
 * surface.
 */
export const HEAT_STEPS = 6;

export function heatFill(intensity: number): string {
  if (!Number.isFinite(intensity) || intensity <= 0) return "var(--heat-0)";
  const i = Math.min(HEAT_STEPS - 1, Math.floor(intensity * HEAT_STEPS));
  return `var(--heat-${i})`;
}

/** Ink that stays legible on whichever step `heatFill` returned. */
export function heatInk(intensity: number): string {
  return intensity > 0.62 ? "#ffffff" : tokens.textSecondary;
}
