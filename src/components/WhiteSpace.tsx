import { useMemo, useState } from "react";
import {
  intelligence,
  medianCompetition,
  quadrantOf,
  QUADRANT_LABELS,
  type Quadrant,
} from "../data/intelligence";
import { chart, tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";

/** One hue per quadrant, so the four boxes are told apart without reading. */
const QUADRANT_COLORS: Record<Quadrant, string> = {
  attack: chart.growth,
  crowded: chart.infrastructure,
  early: chart.ai,
  low: tokens.textHint,
};

export function WhiteSpace({ onSelectTheme }: { onSelectTheme: (id: string) => void }) {
  const [matrixKey, setMatrixKey] = useState<"sectorAutonomy" | "sectorStack">("sectorStack");
  const matrix = intelligence.matrices[matrixKey];
  const median = useMemo(() => medianCompetition(), []);

  const grouped = useMemo(() => {
    const out: Record<Quadrant, typeof intelligence.themes> = { attack: [], crowded: [], early: [], low: [] };
    for (const t of intelligence.themes) out[quadrantOf(t, median)].push(t);
    for (const key of Object.keys(out) as Quadrant[]) {
      out[key].sort((a, b) => b.momentum.score - a.momentum.score);
    }
    return out;
  }, [median]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>
      <Card
        title="Themes by momentum and competition"
        subtitle="Prompts to look into, not verdicts"
        bodyStyle={{ overflowY: "auto", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 6, flex: 1, minHeight: 0 }}>
          {(["attack", "crowded", "early", "low"] as Quadrant[]).map((q) => (
            <div key={q} style={{ border: `1px solid ${tokens.borderDefault}`, borderRadius: 8, padding: 9, background: tokens.cardBackground, overflowY: "auto", minHeight: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: QUADRANT_COLORS[q], marginBottom: 1 }}>
                {QUADRANT_LABELS[q].label}
                <span style={{ color: tokens.textHint, fontWeight: 600 }}> · {grouped[q].length}</span>
              </div>
              <div style={{ fontSize: 11, color: tokens.textHint, marginBottom: 5 }}>{QUADRANT_LABELS[q].hint}</div>
              {grouped[q].slice(0, 12).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  style={{ fontSize: 12, color: tokens.textSecondary, cursor: "pointer", padding: "2px 0", borderTop: `1px solid ${tokens.borderDefault}` }}
                >
                  <span style={{ fontWeight: 700, color: tokens.primaryText }}>{t.momentum.score}</span>{" "}
                  {t.label} <span style={{ color: tokens.textHint }}>({t.competition})</span>
                </div>
              ))}
              {grouped[q].length === 0 && (
                <div style={{ fontSize: 11, color: tokens.textHint }}>None</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 7, lineHeight: 1.5 }}>
          Split at the median of {intelligence.themes.length} themes ({median} companies). Nothing
          here says how valuable a theme is.
        </div>
      </Card>

      <Card
        title="Unusually empty cells"
        subtitle="Far fewer companies than their row and column sizes imply"
        bodyStyle={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {([
            ["sectorStack", "Sector × Stack"],
            ["sectorAutonomy", "Sector × Autonomy"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMatrixKey(key)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 11px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${matrixKey === key ? tokens.primaryBorder : tokens.borderDefault}`,
                background: matrixKey === key ? tokens.primaryLight : tokens.cardBackground,
                color: matrixKey === key ? tokens.primaryText : tokens.textMuted,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {matrix.empty.length === 0 ? (
          <div style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 1.6 }}>
            Nothing here is emptier than chance would predict.
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {matrix.empty.slice(0, 14).map((e) => {
              // Bar length is the shortfall, so the biggest hole reads longest.
              const shortfall = Math.max(0, e.expected - e.observed);
              const width = (shortfall / (matrix.empty[0].expected - matrix.empty[0].observed)) * 100;
              return (
                <div
                  key={`${e.row}||${e.col}`}
                  title={`${e.z} standard deviations below expectation`}
                  style={{ padding: "8px 2px", borderBottom: `1px solid ${tokens.borderDefault}` }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.textPrimary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.row} × {e.col}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: categoryColors.heatmaps.text, whiteSpace: "nowrap" }}>
                      {e.observed}
                    </span>
                    <span style={{ fontSize: 12, color: tokens.textHint, whiteSpace: "nowrap" }}>
                      of {Math.round(e.expected)} expected
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: tokens.sunken, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(3, width)}%`, height: "100%", background: categoryColors.heatmaps.text, opacity: 0.85 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: tokens.textHint, lineHeight: 1.5, flexShrink: 0 }}>
          A gap is a <strong>question, not an opportunity</strong> — it may be impossible, illegal,
          or already served by someone bigger.
        </div>
      </Card>
    </div>
  );
}
