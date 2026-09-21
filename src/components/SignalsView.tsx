import { intelligence } from "../data/intelligence";
import { tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";

/**
 * §40 Signals and §41 "what most people will miss".
 *
 * Every signal shows the numbers that triggered it. The non-obvious panel is
 * allowed to be empty — under §41 an empty result means nothing crossed the
 * bar, which is a real answer. The criteria and the closest near-misses are
 * shown so an empty panel reads as a finding rather than a fault.
 */

const SEVERITY_COLOR: Record<string, string> = {
  high: categoryColors.heatmaps.text,
  medium: categoryColors.india.text,
  low: tokens.textHint,
};

const TYPE_LABEL: Record<string, string> = {
  theme_acceleration: "Acceleration",
  cross_sector_convergence: "Convergence",
  autonomy_progression: "Autonomy",
  dependency_bottleneck: "Bottleneck",
  structural_shift: "Structural",
  formation_slowdown: "Slowdown",
};

export function SignalsView({ onSelectTheme }: { onSelectTheme: (id: string) => void }) {
  const { signals, nonObvious, transitions } = intelligence;
  const insights = nonObvious?.insights ?? [];
  const nearMisses = nonObvious?.nearMisses ?? [];
  const criteria = nonObvious?.criteria;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>
      <Card title="Signals" subtitle={`${signals.length} changes worth noticing`} bodyStyle={{ overflowY: "auto", padding: "4px 10px 10px" }}>
        {signals.map((s, i) => (
          // One line per signal. The explanation underneath used to carry the
          // arithmetic that fired it ("Delta-squared-S of 2.32pp across 20
          // companies"), which is the evidence, not the finding — thirty of
          // those stacked is a wall nobody reads. It moves to the hover.
          <div
            key={`${s.type}-${i}`}
            onClick={() => s.themes?.[0] && onSelectTheme(s.themes[0])}
            title={s.explanation}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderBottom: `1px solid ${tokens.borderDefault}`,
              cursor: s.themes?.[0] ? "pointer" : "default",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = tokens.rowHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                background: SEVERITY_COLOR[s.severity] ?? tokens.textHint,
              }}
            />
            <span
              style={{
                fontSize: 13.5, fontWeight: 600, color: tokens.textPrimary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}
            >
              {s.title}
            </span>
            <span
              style={{
                fontSize: 11, fontWeight: 600, color: tokens.textMuted,
                background: tokens.sunken, border: `1px solid ${tokens.borderDefault}`,
                borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {TYPE_LABEL[s.type] ?? s.type}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: tokens.textHint, padding: "10px 10px 0", lineHeight: 1.5 }}>
          Hover a row for the numbers behind it. Click one to open its theme.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateRows: "minmax(0, auto) 1fr", gap: 8, minHeight: 0 }}>
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
