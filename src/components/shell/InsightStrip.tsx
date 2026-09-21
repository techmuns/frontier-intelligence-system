// A page's conclusions, stated before its evidence.
//
// "What they build" and "What's changing" were three equally-weighted columns
// of dense panels. Everything was on screen and nothing was foremost, so a
// reader had to work through all three and synthesise the answer themselves.
//
// These tiles do that synthesis in the page's own data and put it first. The
// panels below stay exactly as they were — they are now the supporting detail
// for a claim the reader has already been given, rather than raw material.

import type { ReactNode } from "react";
import { tokens } from "../../lib/theme";

export interface Insight {
  /** What question this answers, e.g. "Biggest group". */
  label: string;
  /** The answer, in a few words. */
  headline: string;
  /** The number that backs it. */
  value: string;
  /** One short clause of context. */
  detail: string;
  color: string;
  onClick?: () => void;
}

export function InsightStrip({ insights, children }: { insights: Insight[]; children?: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${insights.length}, minmax(0, 1fr))`,
        gap: 12,
        flexShrink: 0,
      }}
    >
      {insights.map((ins) => (
        <button
          key={ins.label}
          onClick={ins.onClick}
          disabled={!ins.onClick}
          style={{
            textAlign: "left",
            fontFamily: "inherit",
            background: tokens.cardBackground,
            border: `1px solid ${tokens.borderDefault}`,
            // A coloured edge ties the tile to the panel it summarises without
            // painting the whole card.
            borderLeft: `3px solid ${ins.color}`,
            borderRadius: 11,
            padding: "12px 15px",
            cursor: ins.onClick ? "pointer" : "default",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            minWidth: 0,
            transition: "border-color .14s ease",
          }}
          onMouseEnter={(e) => {
            if (ins.onClick) e.currentTarget.style.borderColor = tokens.borderStrong;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = tokens.borderDefault;
            e.currentTarget.style.borderLeftColor = ins.color;
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: tokens.textHint }}>
            {ins.label}
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 19, fontWeight: 750, color: ins.color, letterSpacing: -0.3, flexShrink: 0 }}>{ins.value}</span>
            <span
              style={{
                fontSize: 13.5, fontWeight: 650, color: tokens.textPrimary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              title={ins.headline}
            >
              {ins.headline}
            </span>
          </span>
          <span
            style={{ fontSize: 12, color: tokens.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={ins.detail}
          >
            {ins.detail}
          </span>
        </button>
      ))}
      {children}
    </div>
  );
}
