import { useEffect, useMemo, useRef, useState } from "react";
import type { Company } from "../data/companies";
import {
  allBatches,
  allCountries,
  allIndustries,
  allSubindustries,
  countryOf,
  displayDomain,
  subindustryOf,
} from "../data/companies";
import { tokens, categoryColors } from "../lib/theme";
import { EmptyState } from "./StatePanels";

type SortKey = "name" | "batch" | "industry" | "country";
type SortDir = "asc" | "desc";

/**
 * Rows rendered before the reader has scrolled, and how many more arrive each
 * time they reach the bottom.
 *
 * The table used to page in blocks of fourteen behind Prev/Next buttons, which
 * meant fifty-one clicks to see the list. It now grows as you scroll. The
 * window exists so the DOM stays small as the dataset grows — every batch adds
 * companies, and rendering all of them on load would get slower every month.
 */
const PAGE_SIZE = 40;

const selectStyle: React.CSSProperties = {
  fontSize: 14,
  padding: "9px 10px",
  borderRadius: 6,
  border: `1px solid ${tokens.borderDefault}`,
  background: tokens.cardBackground,
  color: tokens.textSecondary,
};

interface CompanyTableProps {
  companies: Company[];
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
  /** Seeded from the global header search. */
  initialSearch?: string;
}

export function CompanyTable({ companies, selectedSlug, onSelect, initialSearch = "" }: CompanyTableProps) {
  const [search, setSearch] = useState(initialSearch);
  const [batch, setBatch] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [subindustry, setSubindustry] = useState("all");
  const [country, setCountry] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Follow the header field while the reader is typing in it. Kept in local
  // state rather than driven straight from the prop so the table's own box
  // still works on its own once they start editing it here.
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const batches = useMemo(() => allBatches(companies), [companies]);
  const industries = useMemo(() => allIndustries(companies), [companies]);
  const subindustries = useMemo(() => allSubindustries(companies, industry), [companies, industry]);
  const countries = useMemo(() => allCountries(companies), [companies]);

  // Changing the industry can strip the chosen subindustry of its parent, which
  // would filter to nothing with no visible cause. Drop it instead.
  useEffect(() => {
    if (subindustry !== "all" && !subindustries.includes(subindustry)) setSubindustry("all");
  }, [subindustries, subindustry]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = companies.filter((c) => {
      if (batch !== "all" && c.batch !== batch) return false;
      if (industry !== "all" && c.industry !== industry) return false;
      if (subindustry !== "all" && subindustryOf(c) !== subindustry) return false;
      if (country !== "all" && countryOf(c.all_locations) !== country) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.one_liner ?? "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      const av = sortKey === "country" ? countryOf(a.all_locations) : ((a[sortKey] ?? "") as string);
      const bv = sortKey === "country" ? countryOf(b.all_locations) : ((b[sortKey] ?? "") as string);
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [companies, search, batch, industry, subindustry, country, sortKey, sortDir]);

  // Any change to the result set starts the window over, and scrolls back to
  // the top — otherwise a filter applied halfway down leaves the reader
  // looking at blank space below a short list.
  useEffect(() => {
    setVisible(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [search, batch, industry, subindustry, country, sortKey, sortDir]);

  // Grow the window when the sentinel below the last row comes into view.
  useEffect(() => {
    const node = sentinelRef.current;
    const root = scrollRef.current;
    if (!node || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => (v >= filtered.length ? v : v + PAGE_SIZE));
        }
      },
      { root, rootMargin: "300px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [filtered.length]);

  const rows = filtered.slice(0, visible);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function headerCell(label: string, key: SortKey, width?: string) {
    const active = sortKey === key;
    return (
      <th
        onClick={() => toggleSort(key)}
        style={{
          textAlign: "left",
          padding: "8px 10px",
          fontSize: 13,
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          style={{ ...selectStyle, flex: "1 1 160px", minWidth: 140 }}
        />
        <select value={batch} onChange={(e) => setBatch(e.target.value)} style={selectStyle}>
          <option value="all">All batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={selectStyle}>
          <option value="all">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          value={subindustry}
          onChange={(e) => setSubindustry(e.target.value)}
          style={selectStyle}
          disabled={subindustries.length === 0}
          title={industry === "all" ? "Narrows within the chosen industry" : `Inside ${industry}`}
        >
          <option value="all">{industry === "all" ? "All sub-industries" : `All of ${industry}`}</option>
          {subindustries.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle}>
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No companies match these filters" hint="Try clearing the search or filters." />
      ) : (
        <div
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${tokens.borderDefault}`, borderRadius: 8 }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ position: "sticky", top: 0, background: tokens.cardHeader, zIndex: 1 }}>
              <tr style={{ borderBottom: `1px solid ${tokens.borderDefault}` }}>
                {headerCell("Company", "name", "20%")}
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 13, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase" }}>
                  Description
                </th>
                {headerCell("Batch", "batch", "12%")}
                {headerCell("Industry", "industry", "15%")}
                {headerCell("Country", "country", "10%")}
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 13, fontWeight: 700, color: tokens.textMuted, textTransform: "uppercase", width: "14%" }}>
                  Website
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const domain = displayDomain(c.website);
                return (
                  <tr
                    key={c.slug}
                    onClick={() => onSelect?.(c.slug)}
                    style={{
                      borderBottom: `1px solid ${tokens.borderDefault}`,
                      cursor: onSelect ? "pointer" : "default",
                      background: c.slug === selectedSlug ? tokens.primaryLight : "transparent",
                    }}
                  >
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: tokens.textPrimary }}>
                      <a href={c.url} target="_blank" rel="noreferrer" style={{ color: tokens.textPrimary, textDecoration: "none" }}>
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
                            fontSize: 13,
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
                    <td style={{ padding: "8px 10px", color: tokens.textSecondary, whiteSpace: "nowrap" }}>
                      {countryOf(c.all_locations)}
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {domain ? (
                        <a
                          href={c.website!}
                          target="_blank"
                          rel="noreferrer"
                          // The row's own click handler must not swallow the link.
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: tokens.primaryText, textDecoration: "none" }}
                          title={c.website!}
                        >
                          {domain}
                        </a>
                      ) : (
                        <span style={{ color: tokens.textHint }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 13, color: tokens.textHint, flexShrink: 0 }}>
        {filtered.length === companies.length
          ? `${filtered.length.toLocaleString()} companies`
          : `${filtered.length.toLocaleString()} of ${companies.length.toLocaleString()} companies`}
        {visible < filtered.length && ` · showing ${rows.length.toLocaleString()}, scroll for more`}
      </div>
    </div>
  );
}
