import { useEffect, useState } from "react";
import { fetchNewsSignals, type NewsResult } from "../lib/news";
import { tokens, categoryColors } from "../lib/theme";
import { EmptyState, ErrorState, LoadingState, WaitingForSession } from "./StatePanels";

interface SignalsPanelProps {
  token: string | null;
  ticker: string | null;
  tickerCompany: string | null;
  topTheme: string;
}

type Status = "idle" | "loading" | "error" | "empty" | "ready";

export function SignalsPanel({ token, ticker, tickerCompany, topTheme }: SignalsPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<NewsResult[]>([]);
  const [error, setError] = useState<string>("");
  const [retryTick, setRetryTick] = useState(0);

  const query = ticker
    ? `${tickerCompany ?? ticker} funding OR product news`
    : `${topTheme} startups funding news`;

  useEffect(() => {
    if (!token) return; // waiting-for-session — no call yet
    const ctrl = new AbortController();
    setStatus("loading");
    fetchNewsSignals(token, query, ctrl.signal).then((res) => {
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setError(res.error);
        setStatus("error");
        return;
      }
      if (res.results.length === 0) {
        setStatus("empty");
        return;
      }
      setResults(res.results.slice(0, 6));
      setStatus("ready");
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, query, retryTick]);

  if (!token) return <WaitingForSession />;
  if (status === "loading" || status === "idle") return <LoadingState label="Fetching live signals…" />;
  if (status === "error") return <ErrorState message={error || "Signal fetch failed"} onRetry={() => setRetryTick((t) => t + 1)} />;
  if (status === "empty") return <EmptyState message="No recent signals found" hint="Try again shortly — coverage is sparse for this query." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", overflowY: "auto" }}>
      {!ticker && (
        <div style={{ fontSize: 11, color: tokens.textHint, marginBottom: 2 }}>
          No ticker selected — showing signals for the top theme ({topTheme}).
        </div>
      )}
      {results.map((r, i) => (
        <a
          key={r.url ?? i}
          href={r.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textDecoration: "none",
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: 8,
            padding: "8px 10px",
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.textPrimary, lineHeight: 1.3 }}>
            {r.title ?? "Untitled"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: categoryColors.markets.text,
                background: categoryColors.markets.bg,
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              {r.source ?? "web"}
            </span>
            {r.age && <span style={{ fontSize: 10, color: tokens.textHint }}>{r.age}</span>}
          </div>
        </a>
      ))}
    </div>
  );
}
