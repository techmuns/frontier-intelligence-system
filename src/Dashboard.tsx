import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { sdk } from "./lib/sdk";
import { useHostContext } from "./hooks/useHostContext";
import { checkProxyAvailable } from "./lib/news";
import { tokens, categoryColors } from "./lib/theme";
import {
  companies,
  companiesByBatch,
  topIndustries,
  topTags,
  topCountries,
  teamSizeDistribution,
  medianTeamSize,
  teamSizeReportedCount,
  allIndustries,
  DATASET_SOURCE,
} from "./data/companies";
import {
  tagShareSeries,
  industryShareSeries,
  biggestIndustryShifts,
  shortBatchLabel,
  trends,
} from "./data/trends";
import { TrendChart } from "./components/TrendChart";
import { StatTile } from "./components/StatTile";
import { Card } from "./components/Card";
import { BarChartCard, type BarDatum } from "./components/BarChartCard";
import { CompanyTable } from "./components/CompanyTable";
import { SignalsPanel } from "./components/SignalsPanel";
import { CompanyDetail } from "./components/CompanyDetail";
import { TestModePanel } from "./components/TestModePanel";

const DEV_TOKEN_KEY = "frontier.devToken";
const DEV_TICKER_KEY = "frontier.devTicker";

function truncateLabel(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

export function Dashboard() {
  const { session, ticker, tickerCompany } = useHostContext();

  // Standalone preview only (see TestModePanel) — lets this dashboard be
  // exercised with real data before it's embedded in the actual Munshot
  // host. A real host session always takes priority over these.
  const [devToken, setDevToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DEV_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [devTicker, setDevTicker] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DEV_TICKER_KEY);
    } catch {
      return null;
    }
  });
  function applyDevOverride(token: string | null, tickerValue: string | null) {
    setDevToken(token);
    setDevTicker(tickerValue);
    try {
      token ? sessionStorage.setItem(DEV_TOKEN_KEY, token) : sessionStorage.removeItem(DEV_TOKEN_KEY);
      tickerValue ? sessionStorage.setItem(DEV_TICKER_KEY, tickerValue) : sessionStorage.removeItem(DEV_TICKER_KEY);
    } catch {
      // sessionStorage unavailable (e.g. restricted iframe) — in-memory state still works for this session
    }
  }
  // Server-side proxy fallback (see worker/index.ts) — testing only, and only
  // when neither a real host session nor a manually-entered token exists.
  const [proxyAvailable, setProxyAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    checkProxyAvailable().then((ok) => {
      if (!cancelled) setProxyAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveToken = session.token ?? devToken;
  const effectiveTicker = ticker ?? devTicker;
  const effectiveTickerCompany = tickerCompany ?? (devTicker ? devTicker : null);
  // Use the proxy only as a last resort — a real token always takes priority.
  const useProxy = !effectiveToken && proxyAvailable;

  const [chartView, setChartView] = useState<"snapshot" | "trends" | "composition">("snapshot");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedCompany = useMemo(
    () => (selectedSlug ? companies.find((c) => c.slug === selectedSlug) ?? null : null),
    [selectedSlug],
  );

  const batchCounts = useMemo(() => companiesByBatch(companies), []);
  const industries = useMemo(() => topIndustries(companies, 5), []);
  const tags = useMemo(() => topTags(companies, 5), []);
  const industryCount = useMemo(() => allIndustries(companies).length, []);
  const hiringCount = useMemo(() => companies.filter((c) => c.isHiring).length, []);
  const topTheme = tags[0]?.name ?? industries[0]?.name ?? "AI startups";

  const batchChartData: BarDatum[] = batchCounts.map((b) => ({
    name: b.batch.replace(" 20", " '"),
    value: b.count,
    flag: b.partial ? "Batch still filling — count not final" : undefined,
  }));
  // --- Trends view (2022 → now, from bundled per-batch aggregates) ---
  const aiShare = useMemo(() => tagShareSeries(["AI", "Artificial Intelligence"]), []);
  const industryOverTime = useMemo(
    () => industryShareSeries(["B2B", "Industrials", "Fintech", "Healthcare"]),
    [],
  );
  const batchSizeOverTime = useMemo(
    () =>
      trends.map((b) => ({
        label: shortBatchLabel(b.batch),
        batch: b.batch,
        total: b.total,
        partial: b.partial,
      })),
    [],
  );
  const shifts = useMemo(() => biggestIndustryShifts("winter-2022", "summer-2026", 6), []);

  // --- Composition view (current batches) ---
  const countryData: BarDatum[] = useMemo(
    () => topCountries(companies, 6).map((c) => ({ name: truncateLabel(c.name), fullName: c.name, value: c.count })),
    [],
  );
  const teamSizeData: BarDatum[] = useMemo(
    () => teamSizeDistribution(companies).map((t) => ({ name: t.name, value: t.count })),
    [],
  );
  const teamMedian = useMemo(() => medianTeamSize(companies), []);
  const teamReported = useMemo(() => teamSizeReportedCount(companies), []);

  const industryChartData: BarDatum[] = industries.map((i) => ({
    name: truncateLabel(i.name),
    fullName: i.name,
    value: i.count,
  }));
  const tagChartData: BarDatum[] = tags.map((t) => ({
    name: truncateLabel(t.name),
    fullName: t.name,
    value: t.count,
  }));

  // Getter pointing at current dashboard state, reassigned each render so the
  // snapshot handler always reads live values without stale closures.
  const snapshotRef = useRef<() => unknown>(() => ({}));
  snapshotRef.current = () => ({
    context: { ticker, dataset: DATASET_SOURCE },
    selection: { selectedCompanySlug: selectedSlug },
    data: {
      totalCompanies: companies.length,
      batchCounts,
      topIndustries: industries,
      topTags: tags,
      hiringCount,
    },
  });

  useEffect(() => {
    const offVisual = sdk.onRequest("dashboard.capture.visual", async () => {
      try {
        const el =
          document.querySelector("#dashboard-main") ||
          document.querySelector("[data-dashboard-capture-root='true']") ||
          document.querySelector("main");
        if (!el) throw new Error("capture root not found");
        const blob = await toBlob(el as HTMLElement, { pixelRatio: 2 });
        if (!blob) throw new Error("empty snapshot blob");
        return { visualSnapshot: blob, capturedAt: new Date().toISOString() };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    });

    const offSnapshot = sdk.onRequest("dashboard.capture.snapshot", () => {
      try {
        return snapshotRef.current();
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    });

    // DO NOT call sdk.ready() here — the SDK auto-sends dashboard:ready on
    // host:init. Calling it manually races the handshake and breaks it.

    return () => {
      offVisual();
      offSnapshot();
    };
  }, []);

  return (
    <main
      id="dashboard-main"
      data-dashboard-capture-root="true"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: tokens.pageBackground,
        color: tokens.textPrimary,
        fontFamily: "inherit",
      }}
    >
      {/* Header */}
      <header
        style={{
          flexShrink: 0,
          background: tokens.headerBar,
          borderBottom: `1px solid ${tokens.borderDefault}`,
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.3, color: tokens.textPrimary }}>
            FRONTIER
          </div>
          <div style={{ fontSize: 9, color: tokens.textHint, fontWeight: 600, letterSpacing: 0.3 }}>
            TECHNOLOGY MARKET INTELLIGENCE — YC WINTER '26 – WINTER '27
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {effectiveTicker ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: tokens.primaryText,
                background: tokens.primaryLight,
                border: `1px solid ${tokens.primaryBorder}`,
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              {effectiveTickerCompany ?? effectiveTicker}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: tokens.textHint }}>No ticker selected</span>
          )}
          <TestModePanel
            active={!!session.token}
            devToken={devToken}
            devTicker={devTicker}
            onApply={applyDevOverride}
          />
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
        {/* KPI row */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <StatTile label="Companies" value={companies.length.toLocaleString()} category="markets" hint="Winter '26 – Winter '27" />
          <StatTile label="Batches" value={String(batchCounts.length)} category="sector" hint="2 still filling" />
          <StatTile label="Industries" value={String(industryCount)} category="analytics" hint="top-level YC categories" />
          <StatTile
            label="Hiring now"
            value={`${Math.round((hiringCount / companies.length) * 100)}%`}
            category="tools"
            hint={`${hiringCount} of ${companies.length} companies`}
          />
          <StatTile label="Leading signal" value={topTheme} category="heatmaps" hint="most common tag" />
        </div>

        {/* View switcher */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {([
            ["snapshot", "Snapshot"],
            ["trends", "Trends 2022 →"],
            ["composition", "Composition"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setChartView(key)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 11px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${chartView === key ? tokens.primaryBorder : tokens.borderDefault}`,
                background: chartView === key ? tokens.primaryLight : "#ffffff",
                color: chartView === key ? tokens.primaryText : tokens.textMuted,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Charts row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr 1fr",
            gap: 8,
            flexShrink: 0,
            height: 210,
          }}
        >
          {chartView === "snapshot" && (
            <>
              <Card title="Companies by batch" subtitle="Current cohorts">
                <BarChartCard data={batchChartData} layout="vertical" height={170} valueLabel="companies" />
              </Card>
              <Card title="Top industries" subtitle="By company count">
                <BarChartCard data={industryChartData} layout="horizontal" height={170} valueLabel="companies" />
              </Card>
              <Card title="Top tags" subtitle="Founders' own words">
                <BarChartCard data={tagChartData} layout="horizontal" height={170} valueLabel="companies" />
              </Card>
            </>
          )}

          {chartView === "trends" && (
            <>
              <Card title="AI share of batch" subtitle="% of tagged companies">
                <TrendChart data={aiShare} series={[{ key: "value", label: "AI-tagged" }]} height={170} />
              </Card>
              <Card title="Industry mix over time" subtitle="% of each batch">
                <TrendChart
                  data={industryOverTime}
                  series={[
                    { key: "B2B", label: "B2B" },
                    { key: "Industrials", label: "Industrials" },
                    { key: "Fintech", label: "Fintech" },
                    { key: "Healthcare", label: "Healthcare" },
                  ]}
                  height={170}
                />
              </Card>
              <Card title="Batch size" subtitle="Companies per cohort">
                <TrendChart
                  data={batchSizeOverTime}
                  series={[{ key: "total", label: "Companies" }]}
                  height={170}
                  unit=""
                />
              </Card>
            </>
          )}

          {chartView === "composition" && (
            <>
              <Card title="Team size" subtitle={`${teamReported} of ${companies.length} reported · median ${teamMedian ?? "—"}`}>
                <BarChartCard data={teamSizeData} layout="vertical" height={170} valueLabel="companies" />
              </Card>
              <Card title="Where they're based" subtitle="By country">
                <BarChartCard data={countryData} layout="horizontal" height={170} valueLabel="companies" />
              </Card>
              <Card title="Biggest industry shifts" subtitle="Winter 2022 → Summer 2026">
                <BarChartCard
                  data={shifts.map((s) => ({
                    name: truncateLabel(s.name, 14),
                    fullName: `${s.name}: ${s.fromPct}% → ${s.toPct}%`,
                    value: s.delta,
                  }))}
                  layout="horizontal"
                  height={170}
                  valueLabel="pt change"
                />
              </Card>
            </>
          )}
        </div>

        {/* Main row: table + signals — the primary surface, gets the remaining space */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 8 }}>
          <Card title="Company explorer" subtitle={`${companies.length} companies · click a row for detail`} bodyStyle={{ display: "flex", minHeight: 0 }}>
            <CompanyTable companies={companies} selectedSlug={selectedSlug} onSelect={setSelectedSlug} />
          </Card>
          <Card
            title={selectedCompany ? selectedCompany.name : "Live signals"}
            subtitle={selectedCompany ? "Company detail" : "Recent news via Munshot news search"}
            bodyStyle={{ display: "flex", minHeight: 0 }}
          >
            {selectedCompany ? (
              <CompanyDetail
                company={selectedCompany}
                token={effectiveToken}
                useProxy={useProxy}
                onClose={() => setSelectedSlug(null)}
              />
            ) : (
              <SignalsPanel
                token={effectiveToken}
                ticker={effectiveTicker}
                tickerCompany={effectiveTickerCompany}
                topTheme={topTheme}
                useProxy={useProxy}
              />
            )}
          </Card>
        </div>

        {/* Footer / provenance */}
        <div style={{ flexShrink: 0, fontSize: 10, color: tokens.textHint, display: "flex", justifyContent: "space-between" }}>
          <span>
            Source: {DATASET_SOURCE.label} · captured {DATASET_SOURCE.capturedAt}
          </span>
          <span style={{ color: categoryColors.crypto.text }}>
            Fall '26 and Winter '27 batches are still filling — treat their counts as partial, not decline.
          </span>
        </div>
      </div>
    </main>
  );
}
