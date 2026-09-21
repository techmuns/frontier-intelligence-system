import { intelligence } from "../data/intelligence";
import { tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";

/**
 * Where software crossed from helping a person to doing the task itself.
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
  const { transitions } = intelligence;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
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
