// The headline metric row.
//
// Compact on purpose. These four numbers are context for whatever page you are
// on, not the page's subject, so they get one tidy line rather than four large
// tiles competing with the content below.

import { tokens, type, categoryColors, type CategoryKey } from "../../lib/theme";

export interface Metric {
  label: string;
  value: string;
  hint: string;
  category: CategoryKey;
  icon: React.ReactNode;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const metricIcons = {
  companies: (<svg width="14" height="14" viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /></svg>),
  batches: (<svg width="14" height="14" viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></svg>),
  industries: (<svg width="14" height="14" viewBox="0 0 24 24" {...stroke}><path d="M3 20V9l6 4V9l6 4V5l6 4v11z" /></svg>),
  hiring: (<svg width="14" height="14" viewBox="0 0 24 24" {...stroke}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0M18 8v6M21 11h-6" /></svg>),
};

export function MetricRow({ metrics }: { metrics: Metric[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 12, flexShrink: 0 }}>
      {metrics.map((m) => {
        const c = categoryColors[m.category];
        return (
          <div
            key={m.label}
            style={{
              background: tokens.cardBackground,
              border: `1px solid ${tokens.borderDefault}`,
              borderRadius: 11,
              padding: "12px 15px",
              display: "flex",
              alignItems: "center",
              gap: 13,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: "grid", placeItems: "center",
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              }}
            >
              {m.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: tokens.textHint }}>
                {m.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 22, fontWeight: 750, color: tokens.textPrimary, letterSpacing: -0.4, lineHeight: 1.15 }}>
                  {m.value}
                </span>
                <span
                  style={{
                    fontSize: type.small, color: tokens.textMuted,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {m.hint}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
