// The front page. Plain English, no jargon, no section numbers, no invented
// scores — six things the data actually says, each as a sentence and two
// numbers you can compare at a glance.
//
// This exists because the rest of the dashboard was built for whoever wrote
// the spec: columns labelled Δ²S and COS, scores out of 100 that nobody
// defined, tabs called "White Space" and "World Stack". All of that is real
// analysis, but it answers questions in its own private language. A reader
// who opens this should learn what changed in about fifteen seconds without
// being taught any vocabulary first.
//
// Every number here is computed from the same datasets the detailed tabs use,
// so this is a plainer view of the same truth, not a simplified second one.

import { useMemo } from "react";
import { trends } from "../data/trends";
import { intelligence } from "../data/intelligence";
import { tokens, categoryColors } from "../lib/theme";

const FROM_SLUG = "winter-2022";
// Summer 2026 rather than the newest batch: the two after it are still being
// announced, so their counts are timing rather than a real change.
const TO_SLUG = "summer-2026";

interface Finding {
  headline: string;
  detail: string;
  fromLabel: string;
  toLabel: string;
  from: number;
  to: number;
  /** Bar scale — shares use 100, counts use their own max. */
  scale: number;
  unit: string;
  color: { bg: string; text: string; border: string };
}

function share(batchSlug: string, pick: (b: (typeof trends)[number]) => number): number {
  const b = trends.find((x) => x.slug === batchSlug);
  if (!b || !b.total) return 0;
  return Math.round((pick(b) / b.total) * 100);
}

function useFindings(): Finding[] {
  return useMemo(() => {
    const from = trends.find((b) => b.slug === FROM_SLUG);
    const to = trends.find((b) => b.slug === TO_SLUG);
    const industry = (b: typeof from, key: string) => (b?.total ? Math.round(((b.industries[key] ?? 0) / b.total) * 100) : 0);

    const autonomy = intelligence.dimensionShift.find((d) => d.id === "copilot_vs_autonomous");
    const biggestGap = intelligence.dependencyGaps[0];

    return [
      {
        headline: "Startups moved from money to machines",
        detail:
          "Fintech was the biggest category in 2022. Industrials have taken its place.",
        fromLabel: "Fintech, 2022",
        toLabel: "Industrials, today",
        from: industry(from, "Fintech"),
        to: industry(to, "Industrials"),
        scale: 100,
        unit: "% of the batch",
        color: categoryColors.heatmaps,
      },
      {
        headline: "Saying you are an AI company no longer means anything",
        detail:
          "When almost everyone claims it, the claim stops telling you who is different.",
        fromLabel: "2022",
        toLabel: "Today",
        from: share(FROM_SLUG, (b) => b.aiTotal),
        to: share(TO_SLUG, (b) => b.aiTotal),
        scale: 100,
        unit: "% describe themselves as AI",
        color: categoryColors.markets,
      },
      {
        headline: "Robots stopped being rare",
        detail:
          "One in fifty built something physical in 2022. Now it is one in eight.",
        fromLabel: "2022",
        toLabel: "Today",
        from: share(FROM_SLUG, (b) => b.roboticsTotal),
        to: share(TO_SLUG, (b) => b.roboticsTotal),
        scale: 100,
        unit: "% build physical robots",
        color: categoryColors.tools,
      },
      {
        headline: "Software stopped helping and started doing the work",
        detail:
          "Products used to assist a person. Now most do the task and report back.",
        fromLabel: "2022",
        toLabel: "Today",
        from: autonomy?.from.bShare ? Math.round(autonomy.from.bShare * 100) : 0,
        to: autonomy?.to.bShare ? Math.round(autonomy.to.bShare * 100) : 0,
        scale: 100,
        unit: "% work on their own, not as an assistant",
        color: categoryColors.analytics,
      },
      {
        headline: "Teams got much smaller",
        detail:
          "Two people now attempt what used to need a department.",
        fromLabel: "2022",
        toLabel: "Today",
        from: from?.medianTeamSize ?? 0,
        to: to?.medianTeamSize ?? 0,
        scale: Math.max(from?.medianTeamSize ?? 1, to?.medianTeamSize ?? 1),
        unit: "people in a typical team",
        color: categoryColors.india,
      },
      {
        headline: "Everyone is building on top of the same few things",
        detail: `${biggestGap?.demand ?? 0} companies need ${(biggestGap?.label ?? "").toLowerCase()}. ${biggestGap?.supply ?? 0} build it.`,
        fromLabel: "Need it",
        toLabel: "Build it",
        from: biggestGap?.demand ?? 0,
        to: biggestGap?.supply ?? 0,
        scale: biggestGap?.demand ?? 1,
        unit: "companies",
        color: categoryColors.crypto,
      },
    ];
  }, []);
}

function Bar({ value, scale, color, muted }: { value: number; scale: number; color: string; muted?: boolean }) {
  const pct = scale ? Math.max(2, Math.min(100, (value / scale) * 100)) : 0;
  return (
    <div
      style={{
        height: 30,
        background: tokens.cardBodyBg,
        borderRadius: 6,
        border: `1px solid ${tokens.borderDefault}`,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: color, opacity: muted ? 0.35 : 0.9 }} />
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <div
      style={{
        background: tokens.cardBackground,
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: 12,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 0,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.textPrimary, lineHeight: 1.3 }}>{f.headline}</div>
        <div style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 1.55, marginTop: 5 }}>{f.detail}</div>
      </div>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: tokens.textMuted }}>{f.fromLabel}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: tokens.textMuted }}>{f.from}</span>
          </div>
          <Bar value={f.from} scale={f.scale} color={f.color.text} muted />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: tokens.textSecondary, fontWeight: 600 }}>{f.toLabel}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: f.color.text, letterSpacing: -0.5 }}>{f.to}</span>
          </div>
          <Bar value={f.to} scale={f.scale} color={f.color.text} />
        </div>
        <div style={{ fontSize: 11, color: tokens.textHint }}>{f.unit}</div>
      </div>
    </div>
  );
}

export function OverviewView() {
  const findings = useFindings();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: tokens.textPrimary }}>
          What changed in startups over four years
        </div>
        <div style={{ fontSize: 13, color: tokens.textMuted, marginTop: 3 }}>
          Comparing every company Y Combinator funded in early 2022 against the most recent finished
          batch. Six things stand out.
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "1fr 1fr",
          gap: 10,
          overflowY: "auto",
        }}
      >
        {findings.map((f) => (
          <FindingCard key={f.headline} f={f} />
        ))}
      </div>

      <div style={{ flexShrink: 0, fontSize: 12, color: tokens.textHint, lineHeight: 1.5 }}>
        A count of what was actually funded — what is being <em>started</em>, never what is working.
      </div>
    </div>
  );
}
