// Left navigation.
//
// It holds the seven sections and NOTHING else — no search, no settings, no
// export, no account. Every extra row in a sidebar is a decision the reader has
// to make before they can start reading, and this dashboard's whole problem was
// too many of those.
//
// Below 1100px it collapses to icons only; the labels return as tooltips.

import type { ReactNode } from "react";
import { tokens, type } from "../../lib/theme";

export interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Simple line icons, drawn inline so there is no icon dependency to ship. */
export const icons = {
  overview: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  companies: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" />
    </svg>
  ),
  overTime: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <path d="M3 20V4M3 20h18" /><path d="M7 15l4-5 3 3 5-7" />
    </svg>
  ),
  build: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  ),
  changing: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
    </svg>
  ),
  depend: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="5" r="2.4" /><circle cx="5" cy="19" r="2.4" /><circle cx="19" cy="19" r="2.4" />
      <path d="M12 7.4v4.2M12 11.6L6.4 16.8M12 11.6l5.6 5.2" />
    </svg>
  ),
  funding: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8.5" /><path d="M9 8.5h6M9 11.5h6M14 8.5c0 3-1 4.4-3.2 4.4h-1L14.5 17" />
    </svg>
  ),
  counted: (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.2v.2" />
    </svg>
  ),
};

interface SidebarProps<T extends string> {
  items: NavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** Icons only — the caller decides based on viewport width. */
  collapsed: boolean;
}

export function Sidebar<T extends string>({ items, active, onSelect, collapsed }: SidebarProps<T>) {
  return (
    <nav
      aria-label="Sections"
      style={{
        width: collapsed ? 62 : 220,
        flexShrink: 0,
        background: tokens.sidebarBg,
        borderRight: `1px solid ${tokens.borderDefault}`,
        display: "flex",
        flexDirection: "column",
        padding: collapsed ? "16px 9px" : "18px 14px",
        gap: 3,
        transition: "width .18s ease",
      }}
    >
      <div style={{ padding: collapsed ? "0 0 16px" : "0 6px 18px", overflow: "hidden", whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.6, color: tokens.textPrimary }}>
          {collapsed ? "F" : "FRONTIER"}
        </div>
        {!collapsed && (
          <div style={{ fontSize: type.micro, color: tokens.textHint, marginTop: 2, letterSpacing: 0.2 }}>
            Technology Market Intelligence
          </div>
        )}
      </div>

      {items.map((item) => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={collapsed ? item.label : undefined}
            aria-current={on ? "page" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              width: "100%",
              padding: collapsed ? "10px 0" : "9px 11px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 9,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: type.body,
              fontWeight: on ? 750 : 600,
              // The active row is marked three ways — tint, ink, and a left
              // indicator — so it survives both themes and colour-blindness.
              background: on ? tokens.primaryLight : "transparent",
              color: on ? tokens.primaryText : tokens.textMuted,
              border: "1px solid transparent",
              borderLeft: on ? `2.5px solid ${tokens.primary}` : "2.5px solid transparent",
              transition: "background .14s ease, color .14s ease",
            }}
            onMouseEnter={(e) => {
              if (!on) e.currentTarget.style.background = tokens.rowHover;
            }}
            onMouseLeave={(e) => {
              if (!on) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
