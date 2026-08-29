import { useMemo, useState } from "react";
import type { Company } from "../data/companies";
import { allBatches, allIndustries } from "../data/companies";
import { tokens, categoryColors } from "../lib/theme";
import { EmptyState } from "./StatePanels";

type SortKey = "name" | "batch" | "industry" | "team_size";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 14;

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${tokens.borderDefault}`,
  background: "#ffffff",
  color: tokens.textSecondary,
};

export function CompanyTable({ companies }: { companies: Company[] }) {
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const batches = useMemo(() => allBatches(companies), [companies]);
  const industries = useMemo(() => allIndustries(companies), [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = companies.filter((c) => {
      if (batch !== "all" && c.batch !== batch) return false;
      if (industry !== "all" && c.industry !== industry) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.one_liner ?? "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "team_size") {
        av = a.team_size ?? 0;
        bv = b.team_size ?? 0;
      } else {
        av = (a[sortKey] ?? "") as string;
        bv = (b[sortKey] ?? "") as string;
      }
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [companies, search, batch, industry, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function headerCell(label: string, key: SortKey, width: string) {
    const active = sortKey === key;
    return (
      <th
        onClick={() => toggleSort(key)}
        style={{
          textAlign: "left",
          padding: "8px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: active ? tokens.primaryText : tokens.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.3,
          cursor: "pointer",
          userSelect: "none",
          width,
          whiteSpace: "nowrap",
        }}
      >
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", flexShrink: 0 }}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search companies…"
          style={{ ...selectStyle, flex: "1 1 160px", minWidth: 140 }}
        />
        <select
          value={batch}
          onChange={(e) => {
            setBatch(e.target.value);
            setPage(0);
          }}
          style={selectStyle}
        >
          <option value="all">All batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={industry}
          onChange={(e) => {
            setIndustry(e.target.value);
            setPage(0);
          }}
          style={selectStyle}
        >
          <option value="all">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No companies match these filters" hint="Try clearing the search or filters." />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${tokens.borderDefault}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, background: tokens.cardHeader, zIndex: 1 }}>
              <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                {headerCell("Company", "name", "22%")}
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
                  Description
                </th>
                {headerCell("Batch", "batch", "13%")}
                {headerCell("Industry", "industry", "16%")}
                {headerCell("Team", "team_size", "7%")}
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", width: "8%" }}>
                  Hiring
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.slug} style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: tokens.textPrimary }}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: tokens.textPrimary, textDecoration: "none" }}
                    >
                      {c.name}
                    </a>
                  </td>
                  <td style={{ padding: "8px 10px", color: tokens.textSecondary, maxWidth: 320 }}>
                    {c.one_liner ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: tokens.textSecondary, whiteSpace: "nowrap" }}>{c.batch}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.industry && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: categoryColors.analytics.text,
                          background: categoryColors.analytics.bg,
                          border: `1px solid ${categoryColors.analytics.border}`,
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        {c.industry}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", color: tokens.textSecondary }}>{c.team_size ?? "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.isHiring ? (
                      <span style={{ color: categoryColors.tools.text, fontWeight: 700, fontSize: 11 }}>Yes</span>
                    ) : (
                      <span style={{ color: tokens.textHint, fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: tokens.textHint,
          flexShrink: 0,
        }}
      >
        <span>
          {filtered.length.toLocaleString()} companies · page {clampedPage + 1} of {pageCount}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            style={pagerButtonStyle(clampedPage === 0)}
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
            style={pagerButtonStyle(clampedPage >= pageCount - 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function pagerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    border: `1px solid ${tokens.borderDefault}`,
    background: disabled ? "#f9fafb" : "#ffffff",
    color: disabled ? tokens.textHint : tokens.textSecondary,
    cursor: disabled ? "default" : "pointer",
  };
}
