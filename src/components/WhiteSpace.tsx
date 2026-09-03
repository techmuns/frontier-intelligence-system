import { useMemo, useState } from "react";
import {
  intelligence,
  medianCompetition,
  quadrantOf,
  QUADRANT_LABELS,
  type Quadrant,
} from "../data/intelligence";
import { tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";

/**
 * §24 matrix completion, §25 dependency gaps, §37 white-space quadrants.
 *
 * The spec is emphatic that an empty cell is not automatically an opportunity
 * (§24), so nothing here is labelled an opportunity. Cells are presented as
 * "emptier than expected" with the expectation shown, and the reasons a cell
 * might legitimately be empty are stated on screen so the reader supplies the
 * judgement the data cannot.
 */

const QUADRANT_COLORS: Record<Quadrant, string> = {
  attack: categoryColors.tools.text,
  crowded: categoryColors.india.text,
  early: categoryColors.markets.text,
  low: tokens.textHint,
};

function Heatmap({ matrix, title }: { matrix: typeof intelligence.matrices.sectorAutonomy; title: string }) {
  const rows = matrix.rows.slice(0, 14);
  const cols = matrix.cols.slice(0, 10);
  const max = Math.max(...Object.values(matrix.cells), 1);

  return (
    <div style={{ overflowX: "auto", flex: 1, minHeight: 0, display: "flex" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%", height: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "3px 6px", color: tokens.textMuted, fontWeight: 700, fontSize: 11 }}>
              {title}
            </th>
            {cols.map((c) => (
              <th
                key={c}
                style={{ padding: "3px 4px", color: tokens.textMuted, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis" }}
                title={c}
              >
                {c.length > 12 ? `${c.slice(0, 11)}…` : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td style={{ padding: "3px 6px", color: tokens.textSecondary, whiteSpace: "nowrap", fontWeight: 600 }} title={r}>
                {r.length > 20 ? `${r.slice(0, 19)}…` : r}
              </td>
              {cols.map((c) => {
                const n = matrix.cells[`${r}||${c}`] ?? 0;
                const expected = (matrix.rowTotals[r] * matrix.colTotals[c]) / matrix.total;
                // Emptiness is only meaningful where enough mass exists to
                // expect something in the first place.
                const notable = expected >= 1.5 && n < expected * 0.35;
                return (
                  <td
                    key={c}
                    title={`${r} × ${c}\nobserved ${n}, expected ${expected.toFixed(1)}`}
                    style={{
                      padding: "3px 4px",
                      textAlign: "center",
                      background: n === 0 ? "transparent" : `rgba(79,70,229,${0.08 + (n / max) * 0.62})`,
                      color: n / max > 0.5 ? "#ffffff" : tokens.textSecondary,
                      border: notable ? `1px dashed ${categoryColors.heatmaps.text}` : `1px solid ${tokens.borderDefault}`,
                      minWidth: 30,
                    }}
                  >
                    {n || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WhiteSpace({ onSelectTheme }: { onSelectTheme: (id: string) => void }) {
  const [matrixKey, setMatrixKey] = useState<"sectorAutonomy" | "sectorStack">("sectorAutonomy");
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
            <div key={q} style={{ border: `1px solid ${tokens.borderDefault}`, borderRadius: 8, padding: 9, background: "#ffffff", overflowY: "auto", minHeight: 0 }}>
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
          Competition is the count of companies already in the theme; the split is the median across
          all {intelligence.themes.length} themes ({median}). There is no funding or traction data
          here, so "economic prize" from §37 is deliberately absent rather than estimated.
        </div>
      </Card>

      <Card
        title="Unusually empty cells"
        subtitle="Combinations almost nobody is trying"
        bodyStyle={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {([
            ["sectorAutonomy", "Sector × Autonomy"],
            ["sectorStack", "Sector × Stack"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMatrixKey(key)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${matrixKey === key ? tokens.primaryBorder : tokens.borderDefault}`,
                background: matrixKey === key ? tokens.primaryLight : "#ffffff",
                color: matrixKey === key ? tokens.primaryText : tokens.textMuted,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <Heatmap matrix={matrix} title={matrixKey === "sectorAutonomy" ? "Sector \\ Autonomy" : "Sector \\ Stack"} />

        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textPrimary, marginBottom: 3 }}>
            Emptier than expected
          </div>
          {matrix.empty.slice(0, 16).map((e) => (
            <div key={`${e.row}||${e.col}`} style={{ fontSize: 12, color: tokens.textSecondary, padding: "2px 0" }}>
              <span style={{ color: categoryColors.heatmaps.text, fontWeight: 700 }}>{e.observed}</span>
              <span style={{ color: tokens.textHint }}> vs {e.expected} expected · </span>
              {e.row} × {e.col}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: tokens.textHint, lineHeight: 1.5, borderTop: `1px solid ${tokens.borderDefault}`, paddingTop: 6, flexShrink: 0 }}>
          An empty cell is a <strong>question, not an opportunity</strong> (§24). It may be overlooked —
          or technically impossible, illegal, served by an incumbent, or simply have no buyer. This
          system has no evidence to tell those apart, so it does not try.
        </div>
      </Card>
    </div>
  );
}
