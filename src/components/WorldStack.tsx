import { useMemo } from "react";
import { companies } from "../data/companies";
import { STACK_LAYERS, PHYSICAL_LAYERS } from "../data/intelligence";
import { tokens, chartColorRotation } from "../lib/theme";
import { Card } from "./Card";

/**
 * §30 World Stack — the market as layers, from foundational supply up to
 * AI-native operators, with the physical stack shown separately as the spec
 * requires.
 *
 * Sized by how many companies occupy each layer, so a thin layer reads as
 * thin. That is the useful signal: where the stack is crowded and where it
 * is bare.
 */

interface LayerRow {
  id: string;
  label: string;
  count: number;
  share: number;
  examples: string[];
}

function useLayerRows(layerDefs: { id: string; label: string }[]): LayerRow[] {
  return useMemo(() => {
    const total = companies.length;
    return layerDefs.map((def) => {
      const members = companies.filter((c) => c.dimensions?.stackPosition.layer === def.id);
      return {
        id: def.id,
        label: def.label,
        count: members.length,
        share: total ? members.length / total : 0,
        examples: members.slice(0, 3).map((m) => m.name),
      };
    });
  }, [layerDefs]);
}

function StackBand({ row, index, max, onSelect }: { row: LayerRow; index: number; max: number; onSelect: (layer: string) => void }) {
  const color = chartColorRotation[index % chartColorRotation.length];
  const width = max ? Math.max(4, (row.count / max) * 100) : 0;
  return (
    <div
      onClick={() => row.count > 0 && onSelect(row.id)}
      style={{
        marginBottom: 5,
        cursor: row.count > 0 ? "pointer" : "default",
        opacity: row.count === 0 ? 0.45 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: tokens.textPrimary }}>{row.label}</span>
        <span style={{ fontSize: 10, color: tokens.textMuted }}>
          {row.count} · {(row.share * 100).toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 16, background: tokens.cardBodyBg, borderRadius: 4, border: `1px solid ${tokens.borderDefault}`, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, opacity: 0.85 }} />
      </div>
      {row.examples.length > 0 && (
        <div style={{ fontSize: 9, color: tokens.textHint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.examples.join(" · ")}
        </div>
      )}
    </div>
  );
}

export function WorldStack({ onSelectLayer }: { onSelectLayer: (layer: string) => void }) {
  const digital = useLayerRows(STACK_LAYERS);
  const physical = useLayerRows(PHYSICAL_LAYERS);
  const other = useMemo(
    () => companies.filter((c) => (c.dimensions?.stackPosition.layer ?? "other") === "other").length,
    [],
  );

  const max = Math.max(...digital.map((d) => d.count), ...physical.map((p) => p.count), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>
      <Card title="The stack" subtitle="Value chain position · current cohorts" bodyStyle={{ overflowY: "auto" }}>
        {digital.map((row, i) => (
          <StackBand key={row.id} row={row} index={i} max={max} onSelect={onSelectLayer} />
        ))}
        {other > 0 && (
          <div style={{ fontSize: 9, color: tokens.textHint, marginTop: 6, lineHeight: 1.45 }}>
            {other} companies could not be placed on the stack from their own description and are
            excluded rather than filed under a guess.
          </div>
        )}
      </Card>

      <Card title="Physical stack" subtitle="Tracked separately, per §30" bodyStyle={{ overflowY: "auto" }}>
        {physical.map((row, i) => (
          <StackBand key={row.id} row={row} index={i + 4} max={max} onSelect={onSelectLayer} />
        ))}
        <div style={{ fontSize: 9, color: tokens.textHint, marginTop: 8, lineHeight: 1.5 }}>
          The physical path — data → simulation → world models → control → hardware → robotic labour
          — is kept out of the digital stack because a robotics company is not a layer above or below
          an application; it is a different chain entirely.
        </div>
      </Card>
    </div>
  );
}
