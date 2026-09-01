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
  topSubindustries,
  topCountries,
  teamSizeDistribution,
  medianTeamSize,
  teamSizeReportedCount,
  allIndustries,
  DATASET_SOURCE,
} from "./data/companies";
import {
  industryShareSeries,
  subindustryShareSeries,
  roboticsSeries,
  aiSeries,
  aiMethodComparison,
  biggestIndustryShifts,
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
import { FrontierRadar } from "./components/FrontierRadar";
import { WorldStack } from "./components/WorldStack";
import { WhiteSpace } from "./components/WhiteSpace";
import { ThemeExplorer } from "./components/ThemeExplorer";
import { SignalsView } from "./components/SignalsView";
import { MapsView } from "./components/MapsView";
import { VelocityView } from "./components/VelocityView";

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

  type Page = "radar" | "stack" | "themes" | "maps" | "signals" | "whitespace" | "velocity" | "companies" | "trends" | "method";
  const [page, setPage] = useState<Page>("radar");
  const [chartView, setChartView] = useState<"snapshot" | "trends" | "composition" | "method">("snapshot");
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  function openTheme(id: string) {
    setSelectedThemeId(id);
    setPage("themes");
  }
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
  // The headline finding: YC's mix rotated out of Fintech and into Industrials.
  // AI share is deliberately not the lead chart — it saturated around 80% by
  // 2024 and no longer separates one batch from another.
  const rotation = useMemo(() => industryShareSeries(["Industrials", "Fintech"]), []);
  // What actually drove that: robotics and defense, while climate faded.
  const insideIndustrials = useMemo(
    () =>
      subindustryShareSeries([
        { key: "Robotics", source: "Industrials -> Manufacturing and Robotics" },
        { key: "Defense", source: "Industrials -> Defense" },
        { key: "Climate", source: "Industrials -> Climate" },
      ]),
    [],
  );
  // YC scatters robotics across verticals, so its own label undercounts it.
  const robotics = useMemo(() => roboticsSeries(), []);
  const ai = useMemo(() => aiSeries(), []);
  const aiMethod = useMemo(() => aiMethodComparison(), []);
  const subindustryChartData: BarDatum[] = useMemo(
    () =>
      topSubindustries(companies, 5).map((s) => ({
        name: truncateLabel(s.name),
        fullName: s.name,
        value: s.count,
      })),
    [],
  );
  const shifts = useMemo(() => biggestIndustryShifts("winter-2022", "summer-2026", 6), []);

  // Headline for the KPI row. Uses Summer 2026 — the most recent batch that is
  // fully announced — rather than the newest, which is still filling and would
  // read as a swing that hasn't actually happened.
  const industrialsShift = useMemo(() => {
    const from = trends.find((b) => b.slug === "winter-2022");
    const to = trends.find((b) => b.slug === "summer-2026");
    if (!from || !to || from.total === 0 || to.total === 0) return null;
    return {
      fromPct: Math.round(((from.industries["Industrials"] ?? 0) / from.total) * 100),
      toPct: Math.round(((to.industries["Industrials"] ?? 0) / to.total) * 100),
    };
  }, []);

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
          <StatTile
            label="Physical shift"
            value={industrialsShift ? `${industrialsShift.fromPct}% → ${industrialsShift.toPct}%` : "—"}
            category="heatmaps"
            hint="Industrials share, W22 → Su26"
          />
        </div>

        {/* Page navigation (§51 — few, deep views rather than many shallow ones) */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap" }}>
          {([
            ["radar", "Radar"],
            ["stack", "World Stack"],
            ["themes", "Themes"],
            ["maps", "Maps"],
            ["signals", "Signals"],
            ["whitespace", "White Space"],
            ["velocity", "Velocity"],
            ["companies", "Companies"],
            ["trends", "Trends"],
            ["method", "Method"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 11px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${page === key ? tokens.primaryBorder : tokens.borderDefault}`,
                background: page === key ? tokens.primaryLight : "#ffffff",
                color: page === key ? tokens.primaryText : tokens.textMuted,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {page === "radar" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <FrontierRadar onSelectTheme={openTheme} />
          </div>
        )}

        {page === "stack" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <WorldStack onSelectLayer={() => setPage("companies")} />
          </div>
        )}

        {page === "themes" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ThemeExplorer selectedId={selectedThemeId} onSelect={setSelectedThemeId} />
          </div>
        )}

        {page === "maps" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <MapsView />
          </div>
        )}

        {page === "signals" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <SignalsView onSelectTheme={openTheme} />
          </div>
        )}

        {page === "velocity" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <VelocityView />
          </div>
        )}

        {page === "whitespace" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <WhiteSpace onSelectTheme={openTheme} />
          </div>
        )}

        {page === "trends" && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {([
              ["snapshot", "Snapshot"],
              ["trends", "2022 →"],
              ["composition", "Composition"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChartView(key)}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${chartView === key ? tokens.primaryBorder : tokens.borderDefault}`,
                  background: chartView === key ? "#ffffff" : "transparent",
                  color: chartView === key ? tokens.primaryText : tokens.textHint,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Charts row — Trends and Method pages */}
        {(page === "trends" || page === "method") && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr 1fr",
            gap: 8,
            flexShrink: 0,
            height: 210,
          }}
        >
          {page === "trends" && chartView === "snapshot" && (
            <>
              <Card title="Companies by batch" subtitle="Current cohorts">
                <BarChartCard data={batchChartData} layout="vertical" height={170} valueLabel="companies" />
              </Card>
              <Card title="Top industries" subtitle="By company count">
                <BarChartCard data={industryChartData} layout="horizontal" height={170} valueLabel="companies" />
              </Card>
              <Card title="Top subindustries" subtitle="By company count">
                <BarChartCard data={subindustryChartData} layout="horizontal" height={170} valueLabel="companies" />
              </Card>
            </>
          )}

          {page === "trends" && chartView === "trends" && (
            <>
              <Card title="The rotation" subtitle="Industrials vs Fintech, % of batch">
                <TrendChart
                  data={rotation}
                  series={[
                    { key: "Industrials", label: "Industrials" },
                    { key: "Fintech", label: "Fintech" },
                  ]}
                  height={170}
                />
              </Card>
              <Card title="What's driving it" subtitle="Inside Industrials, % of batch">
                <TrendChart
                  data={insideIndustrials}
                  series={[
                    { key: "Robotics", label: "Mfg & Robotics" },
                    { key: "Defense", label: "Defense" },
                    { key: "Climate", label: "Climate" },
                  ]}
                  height={170}
                />
              </Card>
              <Card title="AI is now table stakes" subtitle="% of batch, from one-liners">
                <TrendChart data={ai} series={[{ key: "AI share", label: "AI" }]} height={170} />
              </Card>
            </>
          )}

          {page === "method" && (
            <>
              <Card title="Why not tags" subtitle="AI share measured two ways">
                <TrendChart
                  data={aiMethod}
                  series={[
                    { key: "From one-liners", label: "One-liners" },
                    { key: "From YC tags", label: "YC tags" },
                    { key: "Tag coverage", label: "Tag coverage" },
                  ]}
                  height={170}
                />
              </Card>
              <Card title="Robotics, undercounted" subtitle="YC's label vs actual, % of batch">
                <TrendChart
                  data={robotics}
                  series={[
                    { key: "Corrected", label: "Actual" },
                    { key: "YC label", label: "YC label" },
                  ]}
                  height={170}
                />
              </Card>
              <Card title="How things are counted" subtitle="Classification rules">
                <div style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5, height: 170, overflowY: "auto" }}>
                  <p style={{ margin: "0 0 7px" }}>
                    <strong>AI / robotics</strong> counted from each company's own one-line pitch, not YC tags —
                    tag coverage swings between 23% and 99% per batch, so a tag-based share tracks YC's
                    bookkeeping more than the market.
                  </p>
                  <p style={{ margin: "0 0 7px" }}>
                    <strong>Robotics</strong> also counts YC's "Manufacturing and Robotics" label, since YC files
                    many robotics companies under the vertical they serve instead.
                  </p>
                  <p style={{ margin: "0 0 7px" }}>
                    <strong>Ambiguous words excluded</strong> — "autonomous" describes software agents as often as
                    machines, and including it halved precision.
                  </p>
                  <p style={{ margin: 0, color: tokens.textHint }}>
                    Partial batches are flagged, never smoothed. Unknown values are omitted rather than counted
                    as zero. Rules live in <code>scripts/build-data.mjs</code>.
                  </p>
                </div>
              </Card>
            </>
          )}

          {page === "trends" && chartView === "composition" && (
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
        )}

        {/* Company explorer + signals — Companies and Trends pages */}
        {(page === "companies" || page === "trends") && (
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
        )}

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
