import { intelligence, topThemes } from "../data/intelligence";
import { tokens, categoryColors, chartColorRotation } from "../lib/theme";
import { Card } from "./Card";

/**
 * §29 Frontier Radar — answer the market in ~30 seconds.
 *
 * Order matters here: the directional shifts come first because they answer
 * "where is the world moving" without the reader having to interpret anything;
 * themes follow as the specific evidence.
 */

function ShiftBar({ shift }: { shift: (typeof intelligence.dimensionShift)[number] }) {
  const delta = shift.deltaPct;
  if (delta === null || shift.to.bShare === null || shift.from.bShare === null) {
    return (
      <div style={{ fontSize: 11, color: tokens.textHint }}>
        {shift.label} — not enough classified companies to compare
      </div>
    );
  }

  const toPct = shift.to.bShare * 100;
  const moving = delta >= 0;
  // Colour by direction of travel, not by good/bad — neither pole is better.
  const accent = moving ? categoryColors.heatmaps.text : categoryColors.markets.text;

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: tokens.textSecondary, fontWeight: 600 }}>{shift.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
          {moving ? "+" : ""}
          {delta}pt → {shift.poles[1]}
        </span>
      </div>
      {/* Track shows where the mix sits now; the marker shows where it started,
          so the size of the move is visible rather than asserted. */}
      <div style={{ position: "relative", height: 7, background: tokens.cardBodyBg, borderRadius: 999, border: `1px solid ${tokens.borderDefault}` }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, toPct)}%`, background: accent, borderRadius: 999, opacity: 0.85 }} />
        <div
          title={`${shift.from.batch}: ${(shift.from.bShare * 100).toFixed(0)}%`}
          style={{
            position: "absolute",
            left: `${Math.min(100, shift.from.bShare * 100)}%`,
            top: -2,
            width: 2,
            height: 11,
            background: tokens.textPrimary,
            opacity: 0.55,
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: tokens.textHint, marginTop: 2 }}>
        {shift.poles[0]} ← → {shift.poles[1]} · {(shift.from.bShare * 100).toFixed(0)}% → {toPct.toFixed(0)}%
      </div>
    </div>
  );
}

export function FrontierRadar({ onSelectTheme }: { onSelectTheme: (id: string) => void }) {
  const themes = topThemes(8);
  const gaps = intelligence.dependencyGaps.slice(0, 6);
  const shifts = intelligence.dimensionShift;
  const firstBatch = shifts[0]?.from.batch;
  const lastBatch = shifts[0]?.to.batch;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>
      <Card title="Where the world is moving" subtitle={firstBatch ? `${firstBatch} → ${lastBatch}` : undefined} bodyStyle={{ overflowY: "auto" }}>
        {shifts.map((s) => (
          <ShiftBar key={s.id} shift={s} />
        ))}
        <div style={{ fontSize: 9, color: tokens.textHint, marginTop: 4, lineHeight: 1.45 }}>
          Share of companies classified on each axis. Companies the classifier could not place on an
          axis are excluded rather than assigned a side.
        </div>
      </Card>

      <Card title="Top emerging themes" subtitle="Discovered, not predefined · ranked by momentum" bodyStyle={{ overflowY: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: tokens.cardHeader, zIndex: 1 }}>
            <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
              {["Theme", "Mom.", "Δ²S", "Cos", "Sectors"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: "6px 8px",
                    fontSize: 9,
                    fontWeight: 700,
                    color: tokens.textMuted,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {themes.map((t, i) => {
              const accel = t.momentum.derivatives.acceleration * 100;
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  style={{ borderBottom: `1px solid ${tokens.borderDefault}`, cursor: "pointer" }}
                >
                  <td style={{ padding: "6px 8px", color: tokens.textPrimary, fontWeight: 600 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: chartColorRotation[i % chartColorRotation.length], marginRight: 6 }} />
                    {t.label}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: tokens.primaryText }}>
                    {t.momentum.score}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: accel >= 0 ? categoryColors.tools.text : categoryColors.heatmaps.text }}>
                    {accel >= 0 ? "+" : ""}
                    {accel.toFixed(1)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: tokens.textSecondary }}>{t.size}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: tokens.textSecondary }}>{t.sectors.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 9, color: tokens.textHint, padding: "6px 8px", lineHeight: 1.45 }}>
          Δ²S = change in the rate of share growth (§19) — acceleration before scale. Click a theme
          for its component breakdown.
        </div>
      </Card>

      <Card title="What they'll all need next" subtitle="§25 second-order dependency gaps" bodyStyle={{ overflowY: "auto" }}>
        {gaps.map((g, i) => (
          <div key={g.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: tokens.textPrimary }}>{g.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: chartColorRotation[i % chartColorRotation.length] }}>
                {g.ratio}×
              </span>
            </div>
            <div style={{ fontSize: 9, color: tokens.textHint }}>
              {g.demand} companies depend on it · {g.supply} supply it
            </div>
          </div>
        ))}
        <div style={{ fontSize: 9, color: tokens.textHint, marginTop: 4, lineHeight: 1.45 }}>
          Demand-to-supply ratio across all {intelligence.batchOrder.length} cohorts. A high ratio is
          a question worth asking, not a verified opportunity — both sides are inferred from company
          descriptions.
        </div>
      </Card>
    </div>
  );
}
