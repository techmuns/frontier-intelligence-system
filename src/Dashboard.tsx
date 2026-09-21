import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { sdk } from "./lib/sdk";
import { useHostContext } from "./hooks/useHostContext";
import { checkProxyAvailable } from "./lib/news";
import { tokens, categoryColors } from "./lib/theme";
import {
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
  aiSeries,
  biggestIndustryShifts,
} from "./data/trends";
import { TrendChart } from "./components/TrendChart";
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
import { ChangeInsights } from "./components/SignalsView";
import { MapsView, DependencyMap } from "./components/MapsView";
import { ResearchView } from "./components/ResearchView";
import { OverviewView } from "./components/OverviewView";
import { MethodView } from "./components/MethodView";
import { IndiaView } from "./components/IndiaView";
import { india, indiaSummary, usd } from "./data/india";
import { useResearch } from "./hooks/useResearch";
import { useThemeMode } from "./hooks/useThemeMode";
import { AppShell, Segmented } from "./components/shell/AppShell";
import { icons, type NavItem } from "./components/shell/Sidebar";
import { MetricRow, metricIcons, type Metric } from "./components/shell/MetricCard";

const DEV_TOKEN_KEY = "frontier.devToken";
const DEV_TICKER_KEY = "frontier.devTicker";

function truncateLabel(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

export function Dashboard() {
  const { session, ticker, tickerCompany } = useHostContext();

  // Human corrections (§47) layered over the build-time classification. Falls
  // back to the bundled data when no research database is bound, so every
  // aggregate below reads the same list whether or not D1 exists.
  const research = useResearch();
  const companies = research.companies;

  const { mode, toggle: toggleTheme } = useThemeMode();
  // One global search box in the header. It drives the company explorer and
  // sends the reader there, because "find a company" is the only thing anyone
  // wants to search for in this dataset.
  const [search, setSearch] = useState("");

  // The Research tab is only offered when a database is actually bound.
  // Showing a permanently-empty tab that explains how to provision one would
  // make a complete dashboard look unfinished to everyone who is not setting
  // it up; it appears by itself the moment one exists.
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

  type Page =
    | "overview"
    | "radar"
    | "stack"
    | "themes"
    | "maps"
    | "depends"
    | "whitespace"
    | "companies"
    | "trends"
    | "india"
    | "method"
    | "research";
  const [page, setPage] = useState<Page>("overview");

  // Navigation is grouped by the QUESTION each view answers, not by the order
  // the analysis was built in.
  //
  // Eleven flat tabs was the problem, and hiding seven of them behind a "more"
  // toggle only moved it — unfolding still gave you eleven flat tabs. So the
  // seven deeper views are now filed under the three questions they actually
  // answer, as sub-tabs. Nothing is dropped; a reader just meets three
  // questions instead of seven unrelated nouns, and only opens the one they
  // are asking.
  const SECTIONS: { id: string; label: string; pages: [Page, string][] }[] = [
    { id: "overview", label: "Overview", pages: [["overview", "Overview"]] },
    { id: "companies", label: "Companies", pages: [["companies", "Companies"]] },
    { id: "trends", label: "Over time", pages: [["trends", "Over time"]] },
    {
      id: "build",
      label: "What they build",
      pages: [
        ["themes", "Groups of similar companies"],
        ["stack", "Where they sit in the market"],
      ],
    },
    {
      id: "changing",
      label: "What's changing",
      // One page. "Shifts worth noticing" was mostly theme accelerations,
      // which the themes table under "What they build" already carries in its
      // Speeding up column. "Who has traction" ranked companies on external
      // attention that 75% of them do not have, so most rows read "—"; it was
      // a leaderboard of the few companies someone had posted about.
      pages: [["radar", "Directions"]],
    },
    {
      id: "needs",
      label: "What they depend on",
      pages: [
        ["maps", "Jobs becoming software"],
        ["depends", "What they're built on"],
        ["whitespace", "Gaps nobody fills"],
      ],
    },
    // An eighth section, added against the seven-item rule on purpose. This is
    // a different question with a different dataset behind it — Indian funding
    // rounds, not YC companies — so filing it under an existing section would
    // have buried it inside a page whose numbers it shares nothing with.
    { id: "india", label: "Who's funding it", pages: [["india", "Who's funding it"]] },
    { id: "method", label: "How it's counted", pages: [["method", "How it's counted"]] },
    ...(research.status.database
      ? [{ id: "research", label: "Research", pages: [["research", "Research"]] as [Page, string][] }]
      : []),
  ];

  const activeSection = SECTIONS.find((sec) => sec.pages.some(([key]) => key === page)) ?? SECTIONS[0];

  type SectionId = (typeof SECTIONS)[number]["id"];

  // The sidebar carries these seven and nothing else — no search, settings,
  // exports or account rows. They are the same seven sections as before, in
  // the same order; only their presentation moved.
  const NAV: NavItem<SectionId>[] = [
    { id: "overview", label: "Overview", icon: icons.overview },
    { id: "companies", label: "Companies", icon: icons.companies },
    { id: "trends", label: "Over time", icon: icons.overTime },
    { id: "build", label: "What they build", icon: icons.build },
    { id: "changing", label: "What's changing", icon: icons.changing },
    { id: "needs", label: "What they depend on", icon: icons.depend },
    { id: "india", label: "Who's funding it", icon: icons.funding },
    { id: "method", label: "How it's counted", icon: icons.counted },
  ];
  const [chartView, setChartView] = useState<"snapshot" | "trends" | "composition" | "method">("snapshot");
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  function openTheme(id: string) {
    setSelectedThemeId(id);
    setPage("themes");
  }
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedCompany = useMemo(
    () => (selectedSlug ? companies.find((c) => c.slug === selectedSlug) ?? null : null),
    [companies, selectedSlug],
  );

  const batchCounts = useMemo(() => companiesByBatch(companies), [companies]);
  const industries = useMemo(() => topIndustries(companies, 5), [companies]);
  const tags = useMemo(() => topTags(companies, 5), [companies]);
  const industryCount = useMemo(() => allIndustries(companies).length, [companies]);
  const hiringCount = useMemo(() => companies.filter((c) => c.isHiring).length, [companies]);
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
  const ai = useMemo(() => aiSeries(), []);
  const subindustryChartData: BarDatum[] = useMemo(
    () =>
      topSubindustries(companies, 5).map((s) => ({
        name: truncateLabel(s.name),
        fullName: s.name,
        value: s.count,
      })),
    [companies],
  );
  const shifts = useMemo(() => biggestIndustryShifts("winter-2022", "summer-2026", 6), []);

  // --- Composition view (current batches) ---
  const countryData: BarDatum[] = useMemo(
    () => topCountries(companies, 6).map((c) => ({ name: truncateLabel(c.name), fullName: c.name, value: c.count })),
    [companies],
  );
  const teamSizeData: BarDatum[] = useMemo(
    () => teamSizeDistribution(companies).map((t) => ({ name: t.name, value: t.count })),
    [companies],
  );
  const teamMedian = useMemo(() => medianTeamSize(companies), [companies]);
  const teamReported = useMemo(() => teamSizeReportedCount(companies), [companies]);

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

  const cohort = `${batchCounts[0]?.batch ?? ""} – ${batchCounts[batchCounts.length - 1]?.batch ?? ""}`.replace(/ 20/g, " '");

  // The metric row describes whatever the page is about. "Who's funding it"
  // runs on a different dataset — Indian funding rounds, not YC companies — so
  // leaving "704 companies across 5 batches" above it would caption the page
  // with four numbers that have nothing to do with anything on screen.
  const metrics: Metric[] =
    page === "india"
      ? [
          { label: "Investors", value: String(indiaSummary.serviceInvestors), hint: `backing AI services · ${indiaSummary.windowMonths} months`, category: "markets", icon: metricIcons.companies },
          { label: "Rounds", value: String(indiaSummary.serviceDeals), hint: `of ${indiaSummary.totalDeals} Indian rounds`, category: "sector", icon: metricIcons.batches },
          { label: "Raised", value: usd(indiaSummary.serviceRoundValueUsdMn), hint: `${indiaSummary.serviceDisclosedDeals} rounds disclosed a size`, category: "analytics", icon: metricIcons.industries },
          { label: "Median round", value: usd(indiaSummary.medianServiceRoundUsdMn), hint: `${indiaSummary.serviceCompanies} companies funded`, category: "tools", icon: metricIcons.hiring },
        ]
      : [
          { label: "Companies", value: companies.length.toLocaleString(), hint: "5 recent batches", category: "markets", icon: metricIcons.companies },
          { label: "Batches", value: String(batchCounts.length), hint: "2 still filling", category: "sector", icon: metricIcons.batches },
          { label: "Industries", value: String(industryCount), hint: "broad categories", category: "analytics", icon: metricIcons.industries },
          { label: "Hiring now", value: `${Math.round((hiringCount / companies.length) * 100)}%`, hint: `${hiringCount} advertising jobs`, category: "tools", icon: metricIcons.hiring },
        ];

  return (
    <AppShell
      items={NAV}
      active={activeSection.id as SectionId}
      onSelect={(id) => {
        const sec = SECTIONS.find((x) => x.id === id);
        if (sec) setPage(sec.pages[0][0]);
      }}
      query={search}
      onQuery={setSearch}
      cohort={page === "india" ? `Last ${indiaSummary.windowMonths} months` : cohort}
      mode={mode}
      onToggleTheme={toggleTheme}
      headerRight={
        <>
          {effectiveTicker && (
            <span
              style={{
                fontSize: 12, fontWeight: 700, color: tokens.primaryText,
                background: tokens.primaryLight, border: `1px solid ${tokens.primaryBorder}`,
                borderRadius: 8, padding: "6px 11px", whiteSpace: "nowrap",
              }}
            >
              {effectiveTickerCompany ?? effectiveTicker}
            </span>
          )}
          <TestModePanel active={!!session.token} devToken={devToken} devTicker={devTicker} onApply={applyDevOverride} />
        </>
      }
    >
      <MetricRow metrics={metrics} />

      {/* Sub-views inside a section. The sidebar is the only place the seven
          sections appear; these are the views within the current one. */}
      {activeSection.pages.length > 1 && (
        <div style={{ flexShrink: 0 }}>
          <Segmented
            options={activeSection.pages}
            value={page}
            onChange={setPage}
          />
        </div>
      )}

        {page === "overview" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <OverviewView />
          </div>
        )}

        {page === "research" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResearchView
              status={research.status}
              companies={companies}
              overrides={research.overrides}
              applied={research.applied}
              ignored={research.ignored}
              loading={research.loading}
              onReload={research.reload}
            />
          </div>
        )}

        {page === "radar" && (
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
            <FrontierRadar onSelectTheme={openTheme} />
            <ChangeInsights onSelectTheme={openTheme} />
          </div>
        )}

        {page === "stack" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <WorldStack companies={companies} onSelectLayer={() => setPage("companies")} />
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

        {page === "depends" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <DependencyMap />
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
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${chartView === key ? tokens.primaryBorder : tokens.borderDefault}`,
                  background: chartView === key ? tokens.cardBackground : "transparent",
                  color: chartView === key ? tokens.primaryText : tokens.textHint,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {page === "india" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <IndiaView query={search} />
          </div>
        )}

        {page === "method" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <MethodView />
          </div>
        )}

        {/* Charts row — Trends page */}
        {page === "trends" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
          {page === "trends" && chartView === "snapshot" && (
            <>
              <Card title="Companies by batch" subtitle="Current cohorts">
                <BarChartCard data={batchChartData} layout="vertical" height="100%" valueLabel="companies" />
              </Card>
              <Card title="Top industries" subtitle="By company count">
                <BarChartCard data={industryChartData} layout="horizontal" height="100%" valueLabel="companies" />
              </Card>
              <Card title="Top subindustries" subtitle="By company count">
                <BarChartCard data={subindustryChartData} layout="horizontal" height="100%" valueLabel="companies" />
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
                  height="100%"
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
                  height="100%"
                />
              </Card>
              <Card title="AI is now table stakes" subtitle="% of batch, from one-liners">
                <TrendChart data={ai} series={[{ key: "AI share", label: "AI" }]} height="100%" />
              </Card>
            </>
          )}

          {page === "trends" && chartView === "composition" && (
            <>
              <Card title="Team size" subtitle={`${teamReported} of ${companies.length} reported · median ${teamMedian ?? "—"}`}>
                <BarChartCard data={teamSizeData} layout="vertical" height="100%" valueLabel="companies" />
              </Card>
              <Card title="Where they're based" subtitle="By country">
                <BarChartCard data={countryData} layout="horizontal" height="100%" valueLabel="companies" />
              </Card>
              <Card title="Biggest industry shifts" subtitle="Winter 2022 → Summer 2026">
                <BarChartCard
                  data={shifts.map((s) => ({
                    name: truncateLabel(s.name, 14),
                    fullName: `${s.name}: ${s.fromPct}% → ${s.toPct}%`,
                    value: s.delta,
                  }))}
                  layout="horizontal"
                  height="100%"
                  valueLabel="pt change"
                />
              </Card>
            </>
          )}
        </div>
        )}

        {/* Company explorer + signals — Companies and Trends pages */}
        {page === "companies" && (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 8 }}>
          <Card
            title="Company explorer"
            subtitle={`${companies.length} companies · click a row for detail`}
            bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            <CompanyTable companies={companies} selectedSlug={selectedSlug} onSelect={setSelectedSlug} initialSearch={search} />
          </Card>
          <Card
            title={selectedCompany ? selectedCompany.name : "Live signals"}
            subtitle={selectedCompany ? "Company detail" : "Recent news via Munshot news search"}
            bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0 }}
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

      {/* Footer / provenance. The India page is a different dataset with a
          different caveat, so it cites its own source rather than YC's. */}
      <div style={{ flexShrink: 0, fontSize: 12, color: tokens.textHint, display: "flex", justifyContent: "space-between", gap: 16 }}>
        {page === "india" ? (
          <>
            <span>
              Source:{" "}
              <a href={india.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                {india.source}
              </a>{" "}
              · captured {india.generatedAt}
            </span>
            <span style={{ color: categoryColors.crypto.text }}>
              {indiaSummary.serviceUndisclosedDeals} of {indiaSummary.serviceDeals} rounds published no size — counted
              as bets, excluded from totals.
            </span>
          </>
        ) : (
          <>
            <span>
              Source: {DATASET_SOURCE.label} · captured {DATASET_SOURCE.capturedAt}
            </span>
            <span style={{ color: categoryColors.crypto.text }}>
              Fall '26 and Winter '27 batches are still filling — treat their counts as partial, not decline.
            </span>
          </>
        )}
      </div>
    </AppShell>
  );
}
