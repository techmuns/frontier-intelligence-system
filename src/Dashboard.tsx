import { useEffect, useMemo, useRef } from "react";
import { toBlob } from "html-to-image";
import { sdk } from "./lib/sdk";
import { useHostContext } from "./hooks/useHostContext";
import { tokens, categoryColors } from "./lib/theme";
import {
  companies,
  companiesByBatch,
  topIndustries,
  topTags,
  allIndustries,
  DATASET_SOURCE,
} from "./data/companies";
import { StatTile } from "./components/StatTile";
import { Card } from "./components/Card";
import { BarChartCard, type BarDatum } from "./components/BarChartCard";
import { CompanyTable } from "./components/CompanyTable";
import { SignalsPanel } from "./components/SignalsPanel";

function truncateLabel(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

export function Dashboard() {
  const { session, ticker, tickerCompany } = useHostContext();

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
    selection: {},
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
          {ticker ? (
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
              {tickerCompany ?? ticker}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: tokens.textHint }}>No ticker selected</span>
          )}
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
          <Card title="Companies by batch" subtitle="Formation trend">
            <BarChartCard data={batchChartData} layout="vertical" height={170} valueLabel="companies" />
          </Card>
          <Card title="Top industries" subtitle="By company count">
            <BarChartCard data={industryChartData} layout="horizontal" height={170} valueLabel="companies" />
          </Card>
          <Card title="Top tags" subtitle="Founders' own words">
            <BarChartCard data={tagChartData} layout="horizontal" height={170} valueLabel="companies" />
          </Card>
        </div>

        {/* Main row: table + signals — the primary surface, gets the remaining space */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 8 }}>
          <Card title="Company explorer" subtitle={`${companies.length} companies · search, filter, sort`} bodyStyle={{ display: "flex", minHeight: 0 }}>
            <CompanyTable companies={companies} />
          </Card>
          <Card title="Live signals" subtitle="Recent news via Munshot news search" bodyStyle={{ display: "flex", minHeight: 0 }}>
            <SignalsPanel token={session.token} ticker={ticker} tickerCompany={tickerCompany} topTheme={topTheme} />
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
