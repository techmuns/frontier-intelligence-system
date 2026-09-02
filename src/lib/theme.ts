// Design tokens copied verbatim from .claude/skills/dashboard-skill/reference/ui-standards.md
// Do not invent new colors — every color used in this dashboard must come from here.

export const categoryColors = {
  markets: { bg: "#eff6ff", text: "#2563eb", border: "#dbeafe" },
  crypto: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  analytics: { bg: "#f5f3ff", text: "#7c3aed", border: "#ede9fe" },
  tools: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  india: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  heatmaps: { bg: "#fff1f2", text: "#e11d48", border: "#fecdd3" },
  sector: { bg: "#f0fdfa", text: "#0d9488", border: "#99f6e4" },
} as const;

export type CategoryKey = keyof typeof categoryColors;

// Ordered rotation used to keep multi-series charts colorful while staying
// inside the registered palette (category "text" colors read well on white).
export const chartColorRotation: string[] = [
  categoryColors.markets.text,
  categoryColors.heatmaps.text,
  categoryColors.tools.text,
  categoryColors.india.text,
  categoryColors.analytics.text,
  categoryColors.crypto.text,
  categoryColors.sector.text,
];

// Type scale.
//
// The first version of this dashboard was sized for a small embedded widget —
// almost everything was 9-11px. Viewed full-screen that reads as unreadably
// small text crammed into the top third of the page. These are the sizes the
// UI actually uses; changing them here moves the whole dashboard together
// rather than leaving components to drift apart.
//
// Not from the skill's ui-standards, which specifies colour only.
export const type = {
  /** Table micro-labels, axis captions, provenance lines. */
  micro: 11,
  /** Secondary labels, hints, footnotes. */
  small: 12,
  /** Default body and table text. */
  body: 13,
  /** Card titles, emphasised rows. */
  title: 14,
  /** Section headings inside a card. */
  heading: 17,
  /** KPI tile labels. */
  statLabel: 12,
  /** KPI tile numbers. */
  stat: 32,
} as const;

export const tokens = {
  primary: "#4f46e5",
  primaryLight: "#eef2ff",
  primaryBorder: "#e0e7ff",
  primaryText: "#4338ca",
  pageBackground: "linear-gradient(to bottom, rgba(249,250,251,0.8), #ffffff)",
  cardBackground: "rgba(255,255,255,0.9)",
  cardHeader: "rgba(255,255,255,0.95)",
  cardBodyBg: "rgba(249,250,251,0.5)",
  headerBar: "rgba(255,255,255,0.95)",
  borderDefault: "rgba(229,231,235,0.8)",
  borderHover: "rgba(79,70,229,0.2)",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textHint: "#9ca3af",
  errorRed: "#ef4444",
  errorBg: "#fef2f2",
} as const;
