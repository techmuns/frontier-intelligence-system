import { useMemo, useState } from "react";
import { intelligence, type Theme } from "../data/intelligence";
import { tokens, categoryColors, chartColorRotation } from "../lib/theme";
import { Card } from "./Card";
import { TrendChart } from "./TrendChart";
import { shortBatchLabel } from "../data/trends";

/**
 * §36 Theme Explorer — a theme's definition, evidence, history, momentum
 * breakdown, dependencies and example companies in one view.
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

  const history = useMemo(() => {
    if (!theme) return [];
    return intelligence.batchOrder.map((batch, i) => ({
      batch,
      label: shortBatchLabel(batch),
      "Share of cohort": Math.round((theme.shares[i] ?? 0) * 1000) / 10,
      count: theme.counts[i] ?? 0,
    }));
  }, [theme]);

  if (!theme) return null;

  const capabilities = Object.entries(theme.capabilityDemand).sort((a, b) => b[1] - a[1]).slice(0, 16);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.3fr 1fr", gap: 8, height: "100%", minHeight: 0 }}>
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
            background: "#ffffff",
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

      <Card title={theme.label} subtitle={`${theme.size} companies · ${theme.sectors.length} sectors`} bodyStyle={{ overflowY: "auto" }}>
        <div style={{ fontSize: 12, color: tokens.textHint, marginBottom: 6 }}>
          Defined by the terms that distinguish it: {theme.terms.join(", ")}
        </div>

        <div style={{ marginBottom: 8 }}>
          <TrendChart data={history} series={[{ key: "Share of cohort", label: "Share of cohort" }]} height={200} />
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textPrimary, marginBottom: 3 }}>
          Companies in this theme
        </div>
        {theme.examples.map((e) => (
          <div key={e.name} style={{ fontSize: 12, color: tokens.textSecondary, padding: "3px 0", borderBottom: `1px solid ${tokens.borderDefault}` }}>
            <strong style={{ color: tokens.textPrimary }}>{e.name}</strong> — {e.one_liner ?? "—"}
          </div>
        ))}

        <div style={{ fontSize: 11, color: tokens.textHint, marginTop: 6, lineHeight: 1.45, flexShrink: 0 }}>
          Themes are discovered by clustering company descriptions, not defined in advance — a
          category nobody has named yet appears here on its own once enough companies describe it.
        </div>
      </Card>

      <Card title="Momentum breakdown" subtitle="§18 · every component shown" bodyStyle={{ overflowY: "auto" }}>
        <MomentumBreakdown theme={theme} />

        {capabilities.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 7, borderTop: `1px solid ${tokens.borderDefault}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", marginBottom: 4 }}>
              What this theme depends on
            </div>
            {capabilities.map(([label, count]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: tokens.textSecondary, padding: "1px 0" }}>
                <span>{label}</span>
                <span style={{ color: tokens.textHint }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
