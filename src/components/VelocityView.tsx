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
    () => (archetype === "all" ? velocity : velocity.filter((v) => v.archetypeLabel === archetype)).slice(0, 120),
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
        subtitle={`${withSignal} of ${velocity.length} companies have any public trace`}
        bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 7 }}
      >
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
          {["all", ...archetypes].map((a) => (
            <button
              key={a}
              onClick={() => setArchetype(a)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${archetype === a ? tokens.primaryBorder : tokens.borderDefault}`,
                background: archetype === a ? tokens.primaryLight : tokens.cardBackground,
                color: archetype === a ? tokens.primaryText : tokens.textMuted,
              }}
            >
              {a === "all" ? "All archetypes" : a}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${tokens.borderDefault}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: tokens.cardHeader, zIndex: 1 }}>
              <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                {["Company", "Archetype", "Score", "HN pts", "Web rank"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i > 1 ? "right" : "left",
                      padding: "9px 10px",
                      fontSize: 11,
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
                    <td style={{ padding: "9px 10px", fontWeight: 600, color: tokens.textPrimary }}>{v.name}</td>
                    <td style={{ padding: "9px 10px", color: tokens.textHint, fontSize: 12 }}>{v.archetypeLabel}</td>
                    <td
                      style={{
                        padding: "9px 10px",
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
                    <td style={{ padding: "9px 10px", textAlign: "right", color: tokens.textSecondary }}>
                      {hn?.available ? hn.latest : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: tokens.textSecondary }}>
                      {web?.available ? web.latest?.toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="How this is measured" subtitle="And what it cannot tell you yet" bodyStyle={{ overflowY: "auto" }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: categoryColors.crypto.text, marginBottom: 3 }}>
              This is standing, not yet velocity
            </div>
            <div style={{ fontSize: 12.5, color: tokens.textSecondary, lineHeight: 1.55 }}>
              These are today's positions. Growth needs two readings and there{" "}
              {(observationMeta?.dates?.length ?? 0) === 1 ? "is 1" : `are ${observationMeta?.dates?.length ?? 0}`}
              {" "}so far — the weekly refresh adds one each run.
            </div>
          </div>
        )}

        {/* Four short statements. This was six paragraphs that still carried
            spec section numbers into the interface ("§20 forbids comparing
            unlike businesses"), which is a note to the author, not to a
            reader. */}
        <div style={{ fontSize: 12.5, color: tokens.textSecondary, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <strong style={{ color: tokens.textPrimary }}>Like is compared with like.</strong> A
            developer-tools company is scored against other developer-tools companies, robotics
            against robotics — never against each other.
          </div>
          <div>
            <strong style={{ color: tokens.textPrimary }}>The score is a ranking, not a rating.</strong>{" "}
            99 means near the top of its own kind, not that the company is excellent.
          </div>
          <div
            title={`${withSignal} of ${velocity.length} companies resolved something from an external source.`}
            style={{
              padding: "10px 12px", borderRadius: 9,
              background: tokens.sunken, border: `1px solid ${tokens.borderDefault}`,
            }}
          >
            <strong style={{ color: tokens.textPrimary }}>Most companies show “—”, not a score.</strong>{" "}
            {velocity.length - withSignal} of {velocity.length} have left no public trace yet. That is
            unknown, not bad — scoring them 0 would say the second thing.
          </div>
          <div style={{ color: tokens.textHint }}>
            From daily website rankings and Hacker News, matched on each company's own web address.
            Funding, revenue and headcount have no free source, so they are absent rather than
            guessed.
          </div>
        </div>

      </Card>
    </div>
  );
}
