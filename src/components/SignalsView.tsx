import { intelligence } from "../data/intelligence";
import { tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";

/**
 * The two findings about change that live nowhere else: where two independent
 * signals agree, and where software crossed from helping to doing.
 *
 * This used to also carry a list of thirty signals. Most were theme
 * accelerations ("X is accelerating"), which the themes table under "What they
 * build" already reports in its Speeding up column — and clicking one
 * navigated out of this section into that very table, which is how the
 * duplication surfaced. The list is gone; these two panels are not duplicated
 * and stay.
 *
 * The non-obvious panel is allowed to be empty: an empty result means nothing
 * crossed the bar, which is a real answer. The criteria and the closest
 * near-misses are shown so it reads as a finding rather than a fault.
 */



export function ChangeInsights({ onSelectTheme }: { onSelectTheme: (id: string) => void }) {
  const { nonObvious, transitions } = intelligence;
  const insights = nonObvious?.insights ?? [];
  const nearMisses = nonObvious?.nearMisses ?? [];
  const criteria = nonObvious?.criteria;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, display: "grid", gridTemplateRows: "minmax(0, auto) 1fr", gap: 12, minHeight: 0 }}>
        <Card title="What most people will miss" subtitle="Only where two separate signals agree" bodyStyle={{ overflowY: "auto" }}>
          {insights.length > 0 ? (
            insights.map((n, i) => (
              <div key={i} title={n.explanation} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: tokens.textPrimary, lineHeight: 1.35 }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 11.5, color: tokens.textHint, marginTop: 3 }}>
                  Hover for the numbers behind this
                </div>
              </div>
            ))
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textSecondary, marginBottom: 4 }}>
                Nothing crossed the bar this cycle.
              </div>
              <div
                title={`A theme qualifies with momentum of at least ${criteria?.minMomentum}, at least ${Math.round((criteria?.minDependencyShare ?? 0.2) * 100)}% of its companies leaning on a capability with a ${criteria?.minGapRatio}x supply gap, or rising autonomy while still under the ${criteria?.maxCompetition}-company median.`}
                style={{ fontSize: 12.5, color: tokens.textMuted, lineHeight: 1.55, marginBottom: 10 }}
              >
                Something only appears here when two separate signals agree. Loosening the bar until
                one did would be manufacturing the finding.
              </div>
              {nearMisses.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", marginBottom: 3 }}>
                    Closest near-misses
                  </div>
                  {nearMisses.map((n, i) => (
                    <div
                      key={i}
                      title={`${Math.round(n.share * 100)}% depend on it · ${n.ratio}x supply gap · momentum ${n.momentum} · fell short on ${n.failed}`}
                      style={{
                        fontSize: 12.5, color: tokens.textSecondary, padding: "5px 0",
                        borderTop: `1px solid ${tokens.borderDefault}`,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {n.theme} <span style={{ color: tokens.textHint }}>needs</span> {n.capability}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Card>

        <Card
          title="Transitions"
          subtitle="Where software moved from helping to doing"
          bodyStyle={{ overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}
        >
          {transitions.length === 0 && (
            <div style={{ fontSize: 12, color: tokens.textHint }}>
              No theme has enough cohort history to claim a movement yet.
            </div>
          )}
          {transitions.map((t) => (
            <div
              key={t.themeId}
              onClick={() => onSelectTheme(t.themeId)}
              style={{ marginBottom: 7, cursor: "pointer" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>{t.themeLabel}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: t.direction === "ascending" ? categoryColors.tools.text : categoryColors.heatmaps.text,
                  }}
                >
                  {t.move > 0 ? "+" : ""}
                  {t.move}
                </span>
              </div>
              <div style={{ fontSize: 12, color: tokens.textSecondary }}>
                {t.fromLabel} → {t.toLabel}
              </div>
              <div style={{ fontSize: 11, color: tokens.textHint }}>
                {t.companiesObserved} companies across {t.windows} cohorts
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
