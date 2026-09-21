import { useState } from "react";
import { intelligence } from "../data/intelligence";
import { heatFill, heatInk, tokens, chartColorRotation } from "../lib/theme";
import { Card } from "./Card";

/**
 * §32 Digital Labor Map, §34 Infrastructure Map, §35 Physical AI Map.
 *
 * The labour map answers "which jobs are becoming software" with two values
 * per cell, because they are different facts: how many companies target that
 * job in that industry (crowding) and how far up the autonomy ladder they sit
 * (how completely the job is being replaced). Toggling between them is the
 * point — a crowded cell at autonomy 1 is a different market from a sparse
 * cell at autonomy 4.
 */

type Measure = "count" | "autonomy";

function LaborMap() {
  const [measure, setMeasure] = useState<Measure>("count");
  const map = intelligence.laborMap;
  const roles = map.roles.slice(0, 20);
  const industries = map.industries.slice(0, 12);

  const maxCount = Math.max(...Object.values(map.cells).map((c) => c.count), 1);

  return (
    <Card
      title="Which jobs are becoming software"
      subtitle="Which jobs software is starting to do"
      bodyStyle={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 7 }}
    >
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {([
          ["count", "Companies"],
          ["autonomy", "Autonomy level"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMeasure(key)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              cursor: "pointer",
              border: `1px solid ${measure === key ? tokens.primaryBorder : tokens.borderDefault}`,
              background: measure === key ? tokens.primaryLight : tokens.cardBackground,
              color: measure === key ? tokens.primaryText : tokens.textMuted,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sticky header row and first column: the matrix is wider than the
          card, and a number is meaningless once its role or industry has
          scrolled out of sight. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${tokens.borderDefault}`, borderRadius: 9 }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 13, width: "100%" }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky", top: 0, left: 0, zIndex: 3,
                  textAlign: "left", padding: "9px 11px", fontSize: 11, fontWeight: 700,
                  letterSpacing: 0.3, textTransform: "uppercase",
                  color: tokens.textMuted, background: tokens.cardBackground,
                  borderBottom: `1px solid ${tokens.borderDefault}`,
                  borderRight: `1px solid ${tokens.borderDefault}`,
                }}
              >
                Role
              </th>
              {industries.map((ind) => (
                <th
                  key={ind}
                  title={ind}
                  style={{
                    position: "sticky", top: 0, zIndex: 2,
                    padding: "9px 6px", fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                    color: tokens.textMuted, background: tokens.cardBackground,
                    borderBottom: `1px solid ${tokens.borderDefault}`,
                    maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {ind.length > 11 ? `${ind.slice(0, 10)}…` : ind}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role}>
                <td
                  title={role}
                  style={{
                    position: "sticky", left: 0, zIndex: 1,
                    padding: "8px 11px", color: tokens.textSecondary, fontWeight: 600,
                    whiteSpace: "nowrap", background: tokens.cardBackground,
                    borderRight: `1px solid ${tokens.borderDefault}`,
                    borderBottom: `1px solid ${tokens.borderDefault}`,
                  }}
                >
                  {role.length > 24 ? `${role.slice(0, 23)}…` : role}
                </td>
                {industries.map((ind) => {
                  const cell = map.cells[`${role}||${ind}`];
                  if (!cell) {
                    return (
                      <td
                        key={ind}
                        title={`${role} × ${ind}\nNo company stated enough to place here`}
                        style={{ borderBottom: `1px solid ${tokens.borderDefault}`, minWidth: 44, background: tokens.sunken }}
                      />
                    );
                  }
                  // Autonomy view uses a fixed 0-6 scale so colour means the same
                  // thing in every cell; count view scales to the busiest cell.
                  const intensity =
                    measure === "count"
                      ? cell.count / maxCount
                      : cell.autonomy === null
                        ? 0
                        : cell.autonomy / 6;
                  const display = measure === "count" ? cell.count : (cell.autonomy ?? "—");
                  return (
                    <td
                      key={ind}
                      title={`${role} × ${ind}\n${cell.count} companies\nmean autonomy ${cell.autonomy ?? "unknown"}\n${cell.examples.join(", ")}`}
                      style={{
                        padding: "8px 6px",
                        textAlign: "center",
                        fontWeight: intensity > 0.45 ? 700 : 500,
                        borderBottom: `1px solid ${tokens.borderDefault}`,
                        minWidth: 44,
                        // One hue, light to dark. The previous fill started at
                        // 6% opacity, which on a dark surface was invisible —
                        // the scale now runs over an opaque ramp instead.
                        background: heatFill(intensity),
                        color: heatInk(intensity),
                        cursor: "default",
                      }}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: tokens.textHint, lineHeight: 1.45 }}>
        Roles are inferred from what each company says it does, so a company automating no
        identifiable role is absent rather than assigned one. Autonomy is the mean ladder position
        (0 information → 6 AI-native company); "—" means no company in that cell stated enough to place it.
      </div>
    </Card>
  );
}

function InfrastructureMap() {
  const caps = intelligence.infrastructureMap.filter((c) => c.supplyCount > 0 || c.dependentThemes.length > 0);

  return (
    <Card title="Infrastructure" subtitle="What companies are built on top of" bodyStyle={{ overflowY: "auto" }}>
      {caps.slice(0, 24).map((c, i) => (
        <div key={c.id} style={{ marginBottom: 7, paddingBottom: 6, borderBottom: `1px solid ${tokens.borderDefault}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>{c.label}</span>
            <span style={{ fontSize: 12, color: chartColorRotation[i % chartColorRotation.length], fontWeight: 700 }}>
              {c.supplyCount} suppliers
            </span>
          </div>
          {c.dependentThemes.length > 0 ? (
            <div style={{ fontSize: 11, color: tokens.textHint, lineHeight: 1.4 }}>
              Depended on by: {c.dependentThemes.map((t) => `${t.label} (${t.dependents})`).join(" · ")}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: tokens.textHint }}>No theme shows concentrated demand for this yet.</div>
          )}
        </div>
      ))}
    </Card>
  );
}

export function MapsView() {
  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex" }}>
      <LaborMap />
    </div>
  );
}

/** "What they're built on" — the dependency list, given room to be read. */
export function DependencyMap() {
  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex" }}>
      <InfrastructureMap />
    </div>
  );
}
