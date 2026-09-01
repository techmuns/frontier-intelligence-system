import { useMemo, useState } from "react";
import { intelligence } from "../data/intelligence";
import { tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";

/**
 * §38 Company Velocity.
 *
 * §20's rule is that unlike businesses must not be compared on the same
 * metrics, so every company is ranked only within its own archetype and the
 * archetype is always shown next to the score.
 *
 * The honest position on what this currently is: with one observation date it
 * measures STANDING, not velocity. Growth and acceleration need a second
 * reading, and reporting them as zero before then would assert flatness we
 * have not observed. The UI says which one it is showing.
 */

export function VelocityView() {
  const { velocity, observationMeta } = intelligence;
  const [archetype, setArchetype] = useState<string>("all");

  const archetypes = useMemo(
    () => [...new Set(velocity.map((v) => v.archetypeLabel))].sort(),
    [velocity],
  );

  const rows = useMemo(
    () => (archetype === "all" ? velocity : velocity.filter((v) => v.archetypeLabel === archetype)).slice(0, 40),
    [velocity, archetype],
  );

  const hasHistory = (observationMeta?.dates?.length ?? 0) >= 2;

  // How many companies any external source could actually say something about.
  // Without this the table reads as a ranking of 659 companies, when it is
  // really a ranking of 172 with 487 tied at the bottom for lack of evidence.
  const withSignal = useMemo(() => velocity.filter((v) => !v.noEvidence).length, [velocity]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>
      <Card
        title={hasHistory ? "Company velocity" : "Company standing"}
        subtitle={`§38 · ranked within archetype · ${withSignal} of ${velocity.length} companies have a signal`}
        bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 7 }}
      >
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
          {["all", ...archetypes].map((a) => (
            <button
              key={a}
              onClick={() => setArchetype(a)}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${archetype === a ? tokens.primaryBorder : tokens.borderDefault}`,
                background: archetype === a ? tokens.primaryLight : "#ffffff",
                color: archetype === a ? tokens.primaryText : tokens.textMuted,
              }}
            >
              {a === "all" ? "All archetypes" : a}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${tokens.borderDefault}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0, background: tokens.cardHeader, zIndex: 1 }}>
              <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                {["Company", "Archetype", "Score", "HN pts", "Web rank"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i > 1 ? "right" : "left",
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
              {rows.map((v) => {
                const hn = v.components?.hn_points;
                const web = v.components?.web_rank;
                return (
                  <tr key={v.slug} style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: tokens.textPrimary }}>{v.name}</td>
                    <td style={{ padding: "6px 8px", color: tokens.textHint, fontSize: 10 }}>{v.archetypeLabel}</td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: v.noEvidence ? tokens.textHint : tokens.primaryText,
                      }}
                      // A 0 here means nothing was found, not that the company
                      // is going nowhere. Shown greyed with the reason on hover
                      // rather than as a confident zero.
                      title={v.noEvidence ? "No external signal resolved for this company — not a measured zero" : undefined}
                    >
                      {v.noEvidence ? "—" : v.standingScore}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: tokens.textSecondary }}>
                      {hn?.available ? hn.latest : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: tokens.textSecondary }}>
                      {web?.available ? web.latest?.toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="How this is measured" subtitle="§20 · and what it is not yet" bodyStyle={{ overflowY: "auto" }}>
        {!hasHistory && (
          <div
            style={{
              border: `1px solid ${categoryColors.crypto.border}`,
              background: categoryColors.crypto.bg,
              borderRadius: 8,
              padding: 9,
              marginBottom: 9,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: categoryColors.crypto.text, marginBottom: 3 }}>
              This is standing, not yet velocity
            </div>
            <div style={{ fontSize: 10, color: tokens.textSecondary, lineHeight: 1.5 }}>
              The observation store holds {observationMeta?.dates?.length ?? 0} date
              {(observationMeta?.dates?.length ?? 0) === 1 ? "" : "s"}. Growth and acceleration (§21)
              need at least two, so they are reported as unavailable rather than as zero — a company
              with no history is not a company with flat history. The weekly refresh adds a dated
              layer each run, and these become real velocity from the second run onward.
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: tokens.textSecondary, lineHeight: 1.55 }}>
          <p style={{ margin: "0 0 7px" }}>
            <strong>Archetype first.</strong> §20 forbids comparing unlike businesses on the same
            metrics, so each company is scored only against others of its kind — a developer-tools
            company against developer-tools companies, robotics against robotics.
          </p>
          <p style={{ margin: "0 0 7px" }}>
            <strong>Score is a percentile</strong> within that archetype across the metrics available
            for it, not an absolute rating.
          </p>
          <p style={{ margin: "0 0 7px" }}>
            <strong>Web rank is inverted</strong> — rank 1 is the largest site — so a lower number
            scores higher.
          </p>
          <p style={{ margin: "0 0 7px" }}>
            <strong>Most companies have no signal at all.</strong> {withSignal} of {velocity.length}
            {" "}resolved anything from an external source; the remaining {velocity.length - withSignal} show
            {" "}<strong>—</strong> rather than 0. A seed-stage company nobody has posted about is not a
            company performing badly, and scoring it 0 would say the second thing.
          </p>
          <p style={{ margin: "0 0 7px", color: tokens.textHint }}>
            {observationMeta?.resolved?.toLocaleString()} of{" "}
            {observationMeta?.total?.toLocaleString()} observations resolved. Web rank resolves for
            roughly a sixth of companies — most seed-stage domains sit outside the top-1M list, and
            an unranked domain is recorded as unknown rather than as poor traffic.
          </p>
          <p style={{ margin: 0, color: tokens.textHint }}>
            Sources: Tranco daily domain rank, Hacker News via Algolia. Both joined on the company's
            exact domain rather than its name — name matching returns the wrong companies.
          </p>
        </div>

        <div style={{ marginTop: 9, paddingTop: 7, borderTop: `1px solid ${tokens.borderDefault}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", marginBottom: 4 }}>
            Still missing
          </div>
          <div style={{ fontSize: 10, color: tokens.textHint, lineHeight: 1.5 }}>
            ARR, headcount, funding rounds and customer counts have no free public source. Those
            parts of §20–§22 stay unavailable rather than being estimated.
            {" "}GitHub stars are collected only when a working token is present: an invalid one
            previously wrote 1,318 empty readings, which would have read as "no YC company has open
            source" rather than as a broken credential.
          </div>
        </div>
      </Card>
    </div>
  );
}
