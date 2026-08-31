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
      <Card title="Signals" subtitle={`${signals.length} detected · §40`} bodyStyle={{ overflowY: "auto" }}>
        {signals.map((s, i) => (
          <div
            key={`${s.type}-${i}`}
            onClick={() => s.themes?.[0] && onSelectTheme(s.themes[0])}
            style={{
              borderLeft: `3px solid ${SEVERITY_COLOR[s.severity] ?? tokens.textHint}`,
              paddingLeft: 8,
              marginBottom: 8,
              cursor: s.themes?.[0] ? "pointer" : "default",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textPrimary }}>{s.title}</span>
              <span style={{ fontSize: 9, color: tokens.textHint, whiteSpace: "nowrap" }}>
                {TYPE_LABEL[s.type] ?? s.type} · conf {s.confidence}
              </span>
            </div>
            <div style={{ fontSize: 10, color: tokens.textSecondary, lineHeight: 1.45 }}>{s.explanation}</div>
          </div>
        ))}
      </Card>

      <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 8, minHeight: 0 }}>
        <Card title="What most people will miss" subtitle="§41 · intersections, not commentary" bodyStyle={{ overflowY: "auto" }}>
          {insights.length > 0 ? (
            insights.map((n, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textPrimary }}>{n.title}</div>
                <div style={{ fontSize: 10, color: tokens.textSecondary, lineHeight: 1.45 }}>{n.explanation}</div>
              </div>
            ))
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textSecondary, marginBottom: 4 }}>
                Nothing crossed the bar this cycle.
              </div>
              <div style={{ fontSize: 10, color: tokens.textHint, lineHeight: 1.5, marginBottom: 8 }}>
                An insight qualifies only where two independent signals intersect — a theme with
                momentum ≥ {criteria?.minMomentum} that also has ≥{" "}
                {Math.round((criteria?.minDependencyShare ?? 0.2) * 100)}% of its companies leaning on a
                capability with a ≥ {criteria?.minGapRatio}× supply gap, or a theme climbing the autonomy
                ladder while still below the {criteria?.maxCompetition}-company median. Loosening that
                until something appears would be manufacturing the finding.
              </div>
              {nearMisses.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", marginBottom: 3 }}>
                    Closest near-misses
                  </div>
                  {nearMisses.map((n, i) => (
                    <div key={i} style={{ fontSize: 10, color: tokens.textSecondary, padding: "2px 0" }}>
                      {n.theme} / {n.capability} —{" "}
                      <span style={{ color: tokens.textHint }}>
                        {Math.round(n.share * 100)}% depend, {n.ratio}× gap, momentum {n.momentum} · failed on{" "}
                        {n.failed}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Card>

        <Card title="Transitions" subtitle="§26 · autonomy centre of gravity" bodyStyle={{ overflowY: "auto" }}>
          {transitions.length === 0 && (
            <div style={{ fontSize: 10, color: tokens.textHint }}>
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
                <span style={{ fontSize: 11, fontWeight: 600, color: tokens.textPrimary }}>{t.themeLabel}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: t.direction === "ascending" ? categoryColors.tools.text : categoryColors.heatmaps.text,
                  }}
                >
                  {t.move > 0 ? "+" : ""}
                  {t.move}
                </span>
              </div>
              <div style={{ fontSize: 10, color: tokens.textSecondary }}>
                {t.fromLabel} → {t.toLabel}
              </div>
              <div style={{ fontSize: 9, color: tokens.textHint }}>
                {t.companiesObserved} companies across {t.windows} cohorts
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
