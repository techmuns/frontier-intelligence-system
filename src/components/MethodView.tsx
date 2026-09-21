// "How it's counted".
//
// This page exists to answer one question: why should anyone believe the
// numbers on the other pages? It makes two claims, and each claim gets a
// headline, a chart that shows it, and a one-line conclusion.
//
// It used to be two unlabelled line charts — three coloured lines with no
// legend, so a reader could see that something diverged but not what — beside
// a column of rules. The charts also ran to the newest batch, which holds one
// company, so both ended in a cliff to zero that meant nothing.

import { useMemo } from "react";
import { trends, aiMethodComparison, roboticsSeries } from "../data/trends";
import { tokens } from "../lib/theme";
import { Card } from "./Card";
import { TrendChart } from "./TrendChart";

/** Batches still being announced distort any trend line; drop the tail. */
function completeOnly<T extends { partial?: boolean; total?: number }>(rows: T[]): T[] {
  const out = [...rows];
  while (out.length && (out[out.length - 1].partial || (out[out.length - 1].total ?? 0) < 50)) {
    out.pop();
  }
  return out;
}

function Claim({
  headline,
  detail,
  children,
  conclusion,
}: {
  headline: string;
  detail: string;
  children: React.ReactNode;
  conclusion: React.ReactNode;
}) {
  return (
    <Card title={headline} subtitle={detail} bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <div
        style={{
          flexShrink: 0,
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 9,
          background: tokens.sunken,
          border: `1px solid ${tokens.borderDefault}`,
          fontSize: 12.5,
          color: tokens.textSecondary,
          lineHeight: 1.55,
        }}
      >
        {conclusion}
      </div>
    </Card>
  );
}

export function MethodView() {
  const complete = useMemo(() => completeOnly(trends), []);
  const aiMethod = useMemo(() => completeOnly(aiMethodComparison()), []);
  const robotics = useMemo(() => completeOnly(roboticsSeries()), []);

  const stats = useMemo(() => {
    const full = complete.filter((b) => b.total >= 50);
    const cov = full.map((b) => Math.round((b.taggedCount / b.total) * 100));
    const labelled = full.reduce((a, b) => a + b.roboticsLabelled, 0);
    const actual = full.reduce((a, b) => a + b.roboticsTotal, 0);
    // The batch where the two AI measurements disagree most.
    let worst = { batch: "", byPitch: 0, byTag: 0, gap: -1 };
    for (const b of full) {
      const byPitch = (b.aiTotal / b.total) * 100;
      const byTag = (b.aiTagged / b.total) * 100;
      if (byPitch - byTag > worst.gap) {
        worst = { batch: b.batch, byPitch: Math.round(byPitch), byTag: Math.round(byTag), gap: byPitch - byTag };
      }
    }
    return {
      covMin: Math.min(...cov),
      covMax: Math.max(...cov),
      missedPct: actual ? Math.round((1 - labelled / actual) * 100) : 0,
      labelled,
      actual,
      worst,
      lastBatch: full[full.length - 1]?.batch ?? "",
    };
  }, [complete]);

  return (
    <div style={{ height: "100%", minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Claim
        headline="We don't use YC's own tags"
        detail="The same companies, counted two ways"
        conclusion={
          <>
            YC tags only some companies — between <strong>{stats.covMin}% and {stats.covMax}%</strong> of a
            batch. Counting from tags therefore measures YC's paperwork, not the market. In{" "}
            {stats.worst.batch} the two methods disagreed by{" "}
            <strong>{stats.worst.byPitch - stats.worst.byTag} points</strong>.
          </>
        }
      >
        <TrendChart
          data={aiMethod}
          series={[
            { key: "From one-liners", label: "From the company's own pitch" },
            { key: "From YC tags", label: "From YC's tags" },
            { key: "Tag coverage", label: "Share of batch YC tagged" },
          ]}
          height="100%"
        />
      </Claim>

      <Claim
        headline="YC's robotics label misses robotics"
        detail="Companies building physical robots, % of batch"
        conclusion={
          <>
            YC files a robotics company under whichever industry it sells to, so its own label caught{" "}
            <strong>{stats.labelled} of {stats.actual}</strong> — missing{" "}
            <strong>{stats.missedPct}%</strong>. A company counts here if YC labelled it{" "}
            <em>or</em> its own one-line pitch names a physical robot.
          </>
        }
      >
        <TrendChart
          data={robotics}
          series={[
            { key: "Corrected", label: "Actual (both methods)" },
            { key: "YC label", label: "YC's label only" },
          ]}
          height="100%"
        />
      </Claim>

    </div>
  );
}
