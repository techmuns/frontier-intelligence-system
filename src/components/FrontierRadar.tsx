import { intelligence, topThemes } from "../data/intelligence";
import { chart, tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";
import { InsightStrip, type Insight } from "./shell/InsightStrip";

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
      <div style={{ fontSize: 13, color: tokens.textHint }}>
        {shift.label} — not enough classified companies to compare
      </div>
    );
  }

  const toPct = shift.to.bShare * 100;
  const moving = delta >= 0;
  // Colour by direction of travel, not by good/bad — neither pole is better.
  const accent = moving ? categoryColors.heatmaps.text : categoryColors.markets.text;

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minHeight: 68 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: tokens.textSecondary, fontWeight: 600 }}>{shift.label}</span>
        <span style={{ fontSize: 16, fontWeight: 750, color: accent }}>
          {moving ? "+" : ""}
          {delta}pt → {shift.poles[1]}
        </span>
      </div>
      {/* Track shows where the mix sits now; the marker shows where it started,
          so the size of the move is visible rather than asserted. */}
      <div style={{ position: "relative", height: 18, background: tokens.cardBodyBg, borderRadius: 999, border: `1px solid ${tokens.borderDefault}` }}>
        <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, toPct)}%`, background: accent, borderRadius: 999, opacity: 0.85 }} />
        <div
          title={`${shift.from.batch}: ${(shift.from.bShare * 100).toFixed(0)}%`}
          style={{
            position: "absolute",
            left: `${Math.min(100, shift.from.bShare * 100)}%`,
            top: -2,
            width: 2,
            height: 18,
            background: tokens.textPrimary,
            opacity: 0.55,
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
        {shift.poles[0]} ← → {shift.poles[1]} · {(shift.from.bShare * 100).toFixed(0)}% → {toPct.toFixed(0)}%
      </div>
    </div>
  );
}

export function FrontierRadar({ onSelectTheme }: { onSelectTheme: (id: string) => void }) {
  const themes = topThemes(22);
  const gaps = intelligence.dependencyGaps;
  const shifts = intelligence.dimensionShift;
  const firstBatch = shifts[0]?.from.batch;
  const lastBatch = shifts[0]?.to.batch;

  // Lead with the three answers. The panels below are the evidence for them,
  // not three separate things to read and reconcile.
  const biggestShift = [...shifts]
    .filter((sh) => sh.deltaPct !== null)
    .sort((a, b) => Math.abs(b.deltaPct!) - Math.abs(a.deltaPct!))[0];
  const fastest = [...themes].sort(
    (a, b) => b.momentum.derivatives.acceleration - a.momentum.derivatives.acceleration,
  )[0];
  const tightest = gaps[0];

  const insights: Insight[] = [
    ...(biggestShift
      ? [{
          label: "Biggest direction change",
          headline: `Toward ${biggestShift.poles[1].toLowerCase()}`,
          value: `${biggestShift.deltaPct! >= 0 ? "+" : ""}${biggestShift.deltaPct}pt`,
          detail: `${biggestShift.label} · ${(biggestShift.from.bShare! * 100).toFixed(0)}% → ${(biggestShift.to.bShare! * 100).toFixed(0)}%`,
          color: chart.shift,
        }]
      : []),
    ...(fastest
      ? [{
          label: "Speeding up fastest",
          headline: fastest.label,
          value: `+${(fastest.momentum.derivatives.acceleration * 100).toFixed(1)}`,
          detail: `${fastest.size} companies · share rising faster each batch`,
          color: chart.growth,
          onClick: () => onSelectTheme(fastest.id),
        }]
      : []),
    ...(tightest
      ? [{
          label: "Tightest supply gap",
          headline: tightest.label,
          value: `${tightest.ratio}×`,
          detail: `${tightest.demand} need it · ${tightest.supply} build it`,
          color: chart.infrastructure,
        }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <InsightStrip insights={insights} />
      {/* One card, full width.
          This page used to carry three columns: the directional shifts, a
          table of emerging themes, and a dependency-gap ranking. The other two
          were other tabs' subjects — themes are the whole of "What they build"
          and dependencies are the whole of "What they depend on" — so this tab
          was showing a reader the same material twice and burying its own
          answer between them. It now shows directions and nothing else. */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <Card
        title="Where the world is moving"
        subtitle={firstBatch ? `Share of each batch, ${firstBatch} → ${lastBatch}` : undefined}
        bodyStyle={{ overflowY: "auto", display: "flex", flexDirection: "column", padding: "18px 26px", flex: 1 }}
      >
        {shifts.map((s) => (
          <ShiftBar key={s.id} shift={s} />
        ))}
        <div style={{ fontSize: 11.5, color: tokens.textHint, marginTop: 10, lineHeight: 1.5, flexShrink: 0 }}>
          Companies the classifier could not place on an axis are excluded rather than assigned a
          side. Themes are on <strong>What they build</strong>; dependencies are on{" "}
          <strong>What they depend on</strong>.
        </div>
      </Card>
      </div>
    </div>
  );
}
