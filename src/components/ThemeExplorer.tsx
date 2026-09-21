import { useMemo, useState } from "react";
import { intelligence, type Theme } from "../data/intelligence";
import { chart, tokens, categoryColors, chartColorRotation } from "../lib/theme";
import { Card } from "./Card";
import { InsightStrip, type Insight } from "./shell/InsightStrip";

/**
 * What they build — the groups, and who is in the one you pick.
 *
 * This used to show four things at once: a list of themes, a share-of-cohort
 * line chart, the companies in the theme, and a full momentum breakdown. The
 * chart was the weakest of them — a twenty-company theme's share moves on one
 * or two companies joining, so its shape is mostly noise, and the list already
 * reports that movement as a number. It is gone; the page is now the groups
 * and their members.
 *
 * The momentum breakdown is the important part: §18 forbids unexplained
 * scores, so every component is shown with its contribution, and the three
 * components the spec asks for that have no data source are shown as
 * explicitly unavailable rather than quietly omitted.
 */

function MomentumBreakdown({ theme }: { theme: Theme }) {
  const entries = Object.entries(theme.momentum.components);
  const available = entries.filter(([, c]) => c.available !== false);
  const missing = entries.filter(([, c]) => c.available === false);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: tokens.primaryText, lineHeight: 1 }}>
          {theme.momentum.score}
        </span>
        <span style={{ fontSize: 12, color: tokens.textHint }}>
          / 100 · {theme.momentum.evidenceBasis.formulaVersion}
        </span>
      </div>

      {available.map(([id, c], i) => (
        <div key={id} style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: tokens.textSecondary }}>{c.label}</span>
            <span style={{ color: tokens.textMuted }}>
              {c.raw}/100 × {c.effectiveWeight} = <strong style={{ color: tokens.textPrimary }}>{c.contribution}</strong>
            </span>
          </div>
          <div style={{ height: 5, background: tokens.cardBodyBg, borderRadius: 999, overflow: "hidden", border: `1px solid ${tokens.borderDefault}` }}>
            <div style={{ width: `${c.raw ?? 0}%`, height: "100%", background: chartColorRotation[i % chartColorRotation.length] }} />
          </div>
        </div>
      ))}

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${tokens.borderDefault}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", marginBottom: 3 }}>
          Specified but unavailable
        </div>
        {missing.map(([id, c]) => (
          <div key={id} style={{ fontSize: 11, color: tokens.textHint, marginBottom: 3, lineHeight: 1.4 }}>
            <strong style={{ color: tokens.textMuted }}>{c.label}</strong> ({Math.round(c.weight * 100)}% of the
            specified formula) — {c.reason}
          </div>
        ))}
        <div style={{ fontSize: 11, color: categoryColors.crypto.text, marginTop: 4, lineHeight: 1.45 }}>
          This score is computed from {theme.momentum.evidenceBasis.availableWeight}% of the specified
          formula; the missing {theme.momentum.evidenceBasis.redistributedWeight}% is redistributed
          across the components above rather than assumed.
        </div>
      </div>
    </div>
  );
}

export function ThemeExplorer({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const themes = intelligence.themes;
  const theme = useMemo(
    () => themes.find((t) => t.id === selectedId) ?? themes[0],
    [selectedId, themes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return themes;
    return themes.filter((t) => t.label.toLowerCase().includes(q) || t.terms.some((term) => term.includes(q)));
  }, [themes, query]);


  if (!theme) return null;

  // The three tiles answer the questions a reader was previously expected to
  // work out by comparing three dense columns themselves.
  // Three tiles, three different themes. One group can top all three measures
  // at once — it currently does — and printing its name three times says less
  // than naming the runner-up on the measures it does not lead.
  const taken = new Set<string>();
  const pick = (rank: (a: Theme, b: Theme) => number) => {
    const found = [...themes].sort(rank).find((t) => !taken.has(t.id)) ?? themes[0];
    taken.add(found.id);
    return found;
  };
  const biggest = pick((a, b) => b.size - a.size);
  const fastest = pick((a, b) => b.momentum.derivatives.acceleration - a.momentum.derivatives.acceleration);
  const widest = pick((a, b) => b.sectors.length - a.sectors.length);

  const insights: Insight[] = [
    {
      label: "Biggest group",
      headline: biggest.label,
      value: String(biggest.size),
      detail: `companies · across ${biggest.sectors.length} industries`,
      color: chart.ai,
      onClick: () => onSelect(biggest.id),
    },
    {
      label: "Speeding up fastest",
      headline: fastest.label,
      value: `+${(fastest.momentum.derivatives.acceleration * 100).toFixed(1)}`,
      detail: "share is rising faster each batch",
      color: chart.growth,
      onClick: () => onSelect(fastest.id),
    },
    {
      label: "Most widely spread",
      headline: widest.label,
      value: String(widest.sectors.length),
      detail: `industries · ${widest.size} companies`,
      color: chart.autonomy,
      onClick: () => onSelect(widest.id),
    },
  ];

  const capabilities = Object.entries(theme.capabilityDemand).sort((a, b) => b[1] - a[1]).slice(0, 16);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <InsightStrip insights={insights} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "0.78fr 1.55fr", gap: 12 }}>
      <Card title="Themes" subtitle={`${themes.length} discovered`} bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 6 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter themes…"
          style={{
            fontSize: 13,
            padding: "5px 8px",
            borderRadius: 6,
            border: `1px solid ${tokens.borderDefault}`,
            background: tokens.cardBackground,
            color: tokens.textSecondary,
          }}
        />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                padding: "5px 7px",
                borderRadius: 6,
                cursor: "pointer",
                background: t.id === theme.id ? tokens.primaryLight : "transparent",
                borderBottom: `1px solid ${tokens.borderDefault}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 12, color: tokens.textPrimary, fontWeight: t.id === theme.id ? 700 : 500 }}>
                  {t.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: tokens.primaryText }}>{t.momentum.score}</span>
              </div>
              <div style={{ fontSize: 11, color: tokens.textHint }}>{t.size} companies</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={theme.label} subtitle={`All ${theme.size} companies in this group`} bodyStyle={{ overflowY: "auto" }}>
        <div style={{ fontSize: 12, color: tokens.textHint, marginBottom: 10 }}>
          Grouped by these words: {theme.terms.join(", ")}
        </div>

        {theme.examples.map((e) => (
          <div
            key={e.name}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              fontSize: 13,
              color: tokens.textSecondary,
              padding: "8px 0",
              borderBottom: `1px solid ${tokens.borderDefault}`,
            }}
          >
            <strong style={{ color: tokens.textPrimary, minWidth: 150, flexShrink: 0 }}>{e.name}</strong>
            <span style={{ minWidth: 0 }}>{e.one_liner ?? "—"}</span>
          </div>
        ))}

        <details style={{ marginTop: 12, borderTop: `1px solid ${tokens.borderDefault}`, paddingTop: 10 }}>
          <summary
            style={{
              cursor: "pointer", fontSize: 12, fontWeight: 700,
              color: tokens.textMuted, listStyle: "revert", userSelect: "none",
            }}
          >
            How this score is worked out, and what it depends on
          </summary>
          <div style={{ marginTop: 10 }}>
            <MomentumBreakdown theme={theme} />
            {capabilities.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 9, borderTop: `1px solid ${tokens.borderDefault}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                  What this theme depends on
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "2px 20px" }}>
                  {capabilities.map(([label, count]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: tokens.textSecondary, padding: "2px 0" }}>
                      <span>{label}</span>
                      <span style={{ color: tokens.textHint }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </Card>

      </div>
    </div>
  );
}
