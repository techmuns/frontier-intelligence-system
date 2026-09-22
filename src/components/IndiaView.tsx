// "Who's funding it in India" — the investors, and the bets they made.
//
// Two panels, deliberately. The leaderboard answers "which firms are active",
// the panel beside it answers "in what". Adding a trend chart would make this
// the third thing competing for the same screen, which is the exact complaint
// that got the chart removed from "What they build".
//
// One number on this page needs care. A round's size belongs to the round, not
// to each firm in it: six investors in a $100 Mn round did not put in $100 Mn
// each, and the split is not published anywhere. So the money column is
// labelled "rounds joined" and never "capital deployed", and the page total is
// the sum of the rounds themselves, each counted once.

import { useMemo, useState } from "react";
import { indiaInvestors, indiaSummary, shortDate, usd, type IndiaInvestor } from "../data/india";
import { chart, tokens } from "../lib/theme";
import { Card } from "./Card";
import { InsightStrip, type Insight } from "./shell/InsightStrip";

const STAGE_COLOR: Record<string, string> = {
  "Pre-seed": chart.support,
  Seed: chart.growth,
  "Pre-Series A": chart.secondary,
  "Series A": chart.ai,
  "Series B": chart.autonomy,
  "Series C": chart.shift,
  "Series D+": chart.shift,
  Other: chart.neutral,
};

function StageBar({ stages, total }: { stages: { stage: string; count: number }[]; total: number }) {
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: tokens.cardBodyBg }}>
      {stages.map((s) => (
        <div
          key={s.stage}
          title={`${s.count} × ${s.stage}`}
          style={{ width: `${(s.count / total) * 100}%`, background: STAGE_COLOR[s.stage] ?? chart.neutral }}
        />
      ))}
    </div>
  );
}

export function IndiaView({ query }: { query: string }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const investors = indiaInvestors;
  const selected: IndiaInvestor = useMemo(
    () => investors.find((i) => i.key === selectedKey) ?? investors[0],
    [investors, selectedKey],
  );

  // The header's global search reaches this page too: typing a firm or a
  // portfolio company name narrows the leaderboard to firms that match either.
  const q = (query || filter).trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return investors;
    return investors.filter(
      (i) => i.name.toLowerCase().includes(q) || i.companies.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [investors, q]);

  const s = indiaSummary;

  // Three different firms, three different claims. Picking the same firm
  // twice would waste a tile, so each measure takes the best firm not already
  // named — the same rule the themes page uses.
  const taken = new Set<string>();
  const pick = (rank: (a: IndiaInvestor, b: IndiaInvestor) => number) => {
    const found = [...investors].sort(rank).find((i) => !taken.has(i.key)) ?? investors[0];
    taken.add(found.key);
    return found;
  };
  const busiest = pick((a, b) => b.bets - a.bets);
  const biggest = pick((a, b) => b.roundValueUsdMn - a.roundValueUsdMn);
  const mostFocused = pick((a, b) => b.aiShare - a.aiShare || b.bets - a.bets);

  const insights: Insight[] = [
    {
      label: "Most bets",
      headline: busiest.name,
      value: String(busiest.bets),
      detail: `AI-service rounds in ${s.windowMonths} months`,
      color: chart.ai,
      onClick: () => setSelectedKey(busiest.key),
    },
    {
      label: "Biggest rounds",
      headline: biggest.name,
      value: usd(biggest.roundValueUsdMn),
      detail: `across ${biggest.disclosedBets} disclosed rounds`,
      color: chart.growth,
      onClick: () => setSelectedKey(biggest.key),
    },
    {
      label: "Most AI-focused",
      headline: mostFocused.name,
      value: `${mostFocused.aiShare}%`,
      detail: `of its ${mostFocused.allDeals} Indian deals were AI`,
      color: chart.autonomy,
      onClick: () => setSelectedKey(mostFocused.key),
    },
  ];

  if (!selected) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <InsightStrip insights={insights} />

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 12 }}>
        <Card
          title="Investors"
          subtitle={`${s.serviceInvestors} firms · ${s.serviceDeals} rounds · ${usd(s.serviceRoundValueUsdMn)} total`}
          bodyStyle={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 6, padding: 0 }}
        >
          {!query && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter investors…"
              style={{
                fontSize: 13,
                margin: "8px 8px 0",
                padding: "5px 8px",
                borderRadius: 6,
                border: `1px solid ${tokens.borderDefault}`,
                background: tokens.cardBackground,
                color: tokens.textSecondary,
              }}
            />
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: tokens.cardHeader }}>
                  {["Firm", "Bets", "Rounds joined", "Stages"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 || i === 3 ? "left" : "right",
                        padding: "7px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                        color: tokens.textMuted,
                        borderBottom: `1px solid ${tokens.borderDefault}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const on = inv.key === selected.key;
                  return (
                    <tr
                      key={inv.key}
                      onClick={() => setSelectedKey(inv.key)}
                      style={{
                        cursor: "pointer",
                        background: on ? tokens.primaryLight : "transparent",
                        borderLeft: `2.5px solid ${on ? tokens.primary : "transparent"}`,
                      }}
                    >
                      <td style={{ padding: "6px 10px", borderBottom: `1px solid ${tokens.borderDefault}` }}>
                        <div style={{ fontWeight: on ? 750 : 600, color: on ? tokens.primaryText : tokens.textPrimary }}>
                          {inv.name}
                        </div>
                        <div style={{ fontSize: 11, color: tokens.textHint }}>
                          {inv.aiShare}% of its {inv.allDeals} Indian deals were AI
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "6px 10px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: tokens.primaryText,
                          borderBottom: `1px solid ${tokens.borderDefault}`,
                        }}
                      >
                        {inv.bets}
                      </td>
                      <td
                        style={{
                          padding: "6px 10px",
                          textAlign: "right",
                          color: tokens.textSecondary,
                          whiteSpace: "nowrap",
                          borderBottom: `1px solid ${tokens.borderDefault}`,
                        }}
                      >
                        {usd(inv.roundValueUsdMn)}
                      </td>
                      <td style={{ padding: "6px 10px", width: 96, borderBottom: `1px solid ${tokens.borderDefault}` }}>
                        <StageBar stages={inv.stages} total={inv.bets} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: tokens.textHint }}>No investor matches “{q}”.</div>
            )}
          </div>
        </Card>

        <Card
          title={selected.name}
          subtitle={`${selected.bets} AI-service bets · ${shortDate(selected.firstBet)} – ${shortDate(selected.lastBet)}`}
          bodyStyle={{ overflowY: "auto" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {selected.companies.map((c) => (
                <tr key={`${c.name}-${c.date}`}>
                  <td style={{ padding: "8px 0", borderBottom: `1px solid ${tokens.borderDefault}` }}>
                    {/* The company name goes to the company, not to the article.
                        We have no website for these: the source publishes one
                        for roughly one deal in eighteen, so a link map would be
                        wrong far more often than right. A search on the exact
                        name always lands somewhere correct and never sends a
                        reader to the wrong company. The article stays beside
                        it, because every figure here has to remain traceable. */}
                    <a
                      href={`https://duckduckgo.com/?q=${encodeURIComponent(`${c.name} India startup`)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontWeight: 700, color: tokens.textPrimary, textDecoration: "none" }}
                      title={`Find ${c.name}`}
                    >
                      {c.name}
                    </a>
                    <a
                      href={c.source}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginLeft: 7, fontSize: 11, color: tokens.textHint, textDecoration: "none" }}
                      title="The Inc42 roundup this deal was read from"
                    >
                      source
                    </a>
                  </td>
                  <td
                    style={{
                      padding: "8px 0",
                      textAlign: "right",
                      color: tokens.textSecondary,
                      whiteSpace: "nowrap",
                      borderBottom: `1px solid ${tokens.borderDefault}`,
                    }}
                  >
                    {c.stage}
                  </td>
                  <td
                    style={{
                      padding: "8px 0 8px 14px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: c.amountUsdMn == null ? tokens.textHint : tokens.textPrimary,
                      whiteSpace: "nowrap",
                      borderBottom: `1px solid ${tokens.borderDefault}`,
                    }}
                  >
                    {usd(c.amountUsdMn)}
                  </td>
                  <td
                    style={{
                      padding: "8px 0 8px 14px",
                      textAlign: "right",
                      color: tokens.textHint,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      borderBottom: `1px solid ${tokens.borderDefault}`,
                    }}
                  >
                    {shortDate(c.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 11.5, color: tokens.textHint, lineHeight: 1.5 }}>
            Amounts are the size of the whole round, not this firm's share — the split is not published.
            {selected.bets - selected.disclosedBets > 0 &&
              ` ${selected.bets - selected.disclosedBets} of these rounds had no published size.`}
          </div>
        </Card>
      </div>
    </div>
  );
}
