import { useState } from "react";
import { intelligence } from "../data/intelligence";
import { tokens, chartColorRotation } from "../lib/theme";
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
      subtitle="§32 · human role × industry"
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
              background: measure === key ? tokens.primaryLight : "#ffffff",
              color: measure === key ? tokens.primaryText : tokens.textMuted,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "3px 6px", fontSize: 11, color: tokens.textMuted }}>Role \ Industry</th>
            {industries.map((ind) => (
              <th
                key={ind}
                title={ind}
                style={{ padding: "3px 3px", fontSize: 11, color: tokens.textMuted, fontWeight: 600, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {ind.length > 10 ? `${ind.slice(0, 9)}…` : ind}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role}>
              <td style={{ padding: "3px 6px", color: tokens.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }} title={role}>
                {role.length > 22 ? `${role.slice(0, 21)}…` : role}
              </td>
              {industries.map((ind) => {
                const cell = map.cells[`${role}||${ind}`];
                if (!cell) {
                  return <td key={ind} style={{ border: `1px solid ${tokens.borderDefault}`, minWidth: 30 }} />;
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
                      padding: "3px 4px",
                      textAlign: "center",
                      border: `1px solid ${tokens.borderDefault}`,
                      background: `rgba(79,70,229,${0.06 + intensity * 0.66})`,
                      color: intensity > 0.5 ? "#ffffff" : tokens.textSecondary,
                      minWidth: 30,
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
    <Card title="Infrastructure" subtitle="§34 · capabilities, not one AI-infra bucket" bodyStyle={{ overflowY: "auto" }}>
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

function PhysicalMap() {
  const chain = intelligence.physicalMap;
  const max = Math.max(...chain.map((s) => s.count), 1);

  return (
    <Card title="Physical AI chain" subtitle="§35 · data → simulation → control → robot" bodyStyle={{ overflowY: "auto" }}>
      {chain.map((stage, i) => (
        <div key={stage.id} style={{ marginBottom: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>{stage.label}</span>
            <span style={{ fontSize: 12, color: tokens.textMuted }}>{stage.count}</span>
          </div>
          <div style={{ height: 12, background: tokens.cardBodyBg, borderRadius: 3, border: `1px solid ${tokens.borderDefault}`, overflow: "hidden" }}>
            <div
              style={{
                width: `${(stage.count / max) * 100}%`,
                height: "100%",
                background: chartColorRotation[i % chartColorRotation.length],
                opacity: 0.85,
              }}
            />
          </div>
          {Object.keys(stage.industries).length > 0 && (
            <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 1 }}>
              {Object.entries(stage.industries)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            </div>
          )}
        </div>
      ))}
      <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 4, lineHeight: 1.45 }}>
        A company appears at every stage it describes, not just one — a robotics company that also
        builds its own simulation is counted in both, because that is what owning more of the chain
        looks like.
      </div>
    </Card>
  );
}

export function MapsView() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.9fr", gap: 8, height: "100%", minHeight: 0 }}>
      <LaborMap />
      <InfrastructureMap />
      <PhysicalMap />
    </div>
  );
}
