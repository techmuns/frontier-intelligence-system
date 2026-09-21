// The page frame: sidebar on the left, header across the top, one scrolling
// content canvas. Everything below the header is the page's own business.
//
// Only the canvas scrolls. The sidebar and header stay put, so navigation is
// always one click away no matter how far down a table someone has read.

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { tokens } from "../../lib/theme";
import { Sidebar, type NavItem } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import type { ThemeMode } from "../../hooks/useThemeMode";

/** Below this the sidebar shows icons only rather than squeezing the canvas. */
const COLLAPSE_AT = 1100;

interface AppShellProps<T extends string> {
  items: NavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  query: string;
  onQuery: (q: string) => void;
  cohort: string;
  mode: ThemeMode;
  onToggleTheme: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function AppShell<T extends string>({
  items, active, onSelect, query, onQuery, cohort, mode, onToggleTheme, headerRight, children,
}: AppShellProps<T>) {
  const [collapsed, setCollapsed] = useState(() => (typeof window !== "undefined" ? window.innerWidth < COLLAPSE_AT : false));

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < COLLAPSE_AT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      id="dashboard-main"
      data-dashboard-capture-root="true"
      style={{ height: "100%", display: "flex", background: tokens.pageBackground, color: tokens.textPrimary }}
    >
      <Sidebar items={items} active={active} onSelect={onSelect} collapsed={collapsed} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopHeader
          query={query}
          onQuery={onQuery}
          cohort={cohort}
          mode={mode}
          onToggleTheme={onToggleTheme}
          right={headerRight}
        />
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, padding: "20px 24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Page title + one line of context. Used once at the top of each page. */
export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexShrink: 0 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 750, letterSpacing: -0.3, color: tokens.textPrimary }}>{title}</h1>
        {subtitle && <p style={{ margin: "3px 0 0", fontSize: 13, color: tokens.textMuted }}>{subtitle}</p>}
      </div>
      {right && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

/** Compact segmented control for switching views inside a page. */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 9,
        background: tokens.sunken,
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 7,
              cursor: "pointer",
              border: "none",
              fontFamily: "inherit",
              background: on ? tokens.cardBackground : "transparent",
              color: on ? tokens.primaryText : tokens.textMuted,
              boxShadow: on ? "0 1px 2px rgba(15,23,42,.06)" : "none",
              transition: "background .14s ease, color .14s ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
