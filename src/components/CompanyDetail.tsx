import { useEffect, useState } from "react";
import type { Company } from "../data/companies";
import { fetchNewsSignals, type NewsResult } from "../lib/news";
import { tokens, categoryColors } from "../lib/theme";
import { EmptyState, ErrorState, LoadingState, WaitingForSession } from "./StatePanels";

interface CompanyDetailProps {
  company: Company;
  token: string | null;
  onClose: () => void;
  useProxy?: boolean;
}

type Status = "idle" | "loading" | "error" | "empty" | "ready";

function Badge({ text, category }: { text: string; category: keyof typeof categoryColors }) {
  const c = categoryColors[category];
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function CompanyDetail({ company, token, onClose, useProxy = false }: CompanyDetailProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<NewsResult[]>([]);
  const [error, setError] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!token && !useProxy) return;
    const ctrl = new AbortController();
    setStatus("loading");
    fetchNewsSignals(token, `${company.name} funding OR product news`, ctrl.signal, useProxy).then((res) => {
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
      setResults(res.results.slice(0, 8));
      setStatus("ready");
    });
    return () => ctrl.abort();
  }, [token, company.slug, company.name, retryTick, useProxy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
        <div>
          <a
            href={company.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 17, fontWeight: 700, color: tokens.textPrimary, textDecoration: "none" }}
          >
            {company.name}
          </a>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              style={{ display: "block", fontSize: 13, color: tokens.primaryText, textDecoration: "none", marginTop: 2 }}
            >
              {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.textMuted,
            background: "#ffffff",
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: 6,
            padding: "3px 8px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ✕ Close
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
        {company.industry && <Badge text={company.industry} category="analytics" />}
        <Badge text={company.batch} category="sector" />
        {company.stage && <Badge text={company.stage} category="markets" />}
        {company.isHiring && <Badge text="Hiring" category="tools" />}
        {company.nonprofit && <Badge text="Nonprofit" category="heatmaps" />}
      </div>

      <div style={{ flexShrink: 0, fontSize: 14, color: tokens.textSecondary, lineHeight: 1.4 }}>
        {company.long_description || company.one_liner || "No description available."}
      </div>

      <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
        <div>
          <div style={{ color: tokens.textHint, fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Team size</div>
          <div style={{ color: tokens.textPrimary, fontWeight: 600 }}>{company.team_size ?? "Unknown"}</div>
        </div>
        <div>
          <div style={{ color: tokens.textHint, fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Location</div>
          <div style={{ color: tokens.textPrimary, fontWeight: 600 }}>{company.all_locations ?? "Unknown"}</div>
        </div>
      </div>

      {company.tags.length > 0 && (
        <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {company.tags.slice(0, 8).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                color: tokens.textMuted,
                background: tokens.cardBodyBg,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: tokens.textPrimary, borderTop: `1px solid ${tokens.borderDefault}`, paddingTop: 8 }}>
        Live signals for {company.name}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {!token && !useProxy ? (
          <WaitingForSession />
        ) : status === "loading" || status === "idle" ? (
          <LoadingState label="Fetching company signals…" />
        ) : status === "error" ? (
          <ErrorState message={error || "Signal fetch failed"} onRetry={() => setRetryTick((t) => t + 1)} />
        ) : status === "empty" ? (
          <EmptyState message="No recent signals found" hint="No matching coverage yet for this company." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                  padding: "7px 9px",
                  background: "#ffffff",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary, lineHeight: 1.3 }}>
                  {r.title ?? "Untitled"}
                </div>
                {r.source && (
                  <div style={{ fontSize: 12, color: tokens.textHint, marginTop: 2 }}>{r.source}</div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
