// Top bar: one search field, the cohort the data covers, and the theme toggle.
//
// Nothing else goes here. The search is global because "find a company" is the
// one thing a reader wants from any page, and it is the only control that earns
// permanent screen space.

import { tokens, type } from "../../lib/theme";
import type { ThemeMode } from "../../hooks/useThemeMode";

interface TopHeaderProps {
  query: string;
  onQuery: (q: string) => void;
  /** e.g. "Winter '26 – Winter '27" — what the current numbers cover. */
  cohort: string;
  mode: ThemeMode;
  onToggleTheme: () => void;
  /** Host session state, shown only because the embed genuinely needs it. */
  right?: React.ReactNode;
}

export function TopHeader({ query, onQuery, cohort, mode, onToggleTheme, right }: TopHeaderProps) {
  return (
    <header
      style={{
        flexShrink: 0,
        height: 58,
        background: tokens.headerBar,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
      }}
    >
      <div style={{ position: "relative", flex: 1, maxWidth: 520 }}>
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.textHint, pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search companies, industries, topics…"
          style={{
            width: "100%",
            height: 36,
            padding: "0 12px 0 34px",
            borderRadius: 9,
            border: `1px solid ${tokens.borderDefault}`,
            background: tokens.cardBodyBg,
            color: tokens.textPrimary,
            fontSize: type.body,
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = tokens.primary)}
          onBlur={(e) => (e.currentTarget.style.borderColor = tokens.borderDefault)}
        />
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <span
          title="The batches these numbers cover"
          style={{
            fontSize: type.small,
            fontWeight: 600,
            color: tokens.textMuted,
            background: tokens.cardBodyBg,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: 8,
            padding: "6px 11px",
            whiteSpace: "nowrap",
          }}
        >
          {cohort}
        </span>
        {right}
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}

export function ThemeToggle({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  const dark = mode === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      style={{
        width: 36,
        height: 36,
        display: "grid",
        placeItems: "center",
        borderRadius: 9,
        cursor: "pointer",
        border: `1px solid ${tokens.borderDefault}`,
        background: tokens.cardBodyBg,
        color: tokens.textMuted,
        transition: "color .14s ease, border-color .14s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = tokens.primaryText;
        e.currentTarget.style.borderColor = tokens.primaryBorder;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = tokens.textMuted;
        e.currentTarget.style.borderColor = tokens.borderDefault;
      }}
    >
      {dark ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
