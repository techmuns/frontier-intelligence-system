import { useState } from "react";
import { tokens } from "../lib/theme";

interface TestModePanelProps {
  active: boolean; // true once the real Munshot host has supplied a token — panel hides
  devToken: string | null;
  devTicker: string | null;
  onApply: (token: string | null, ticker: string | null) => void;
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "4px 7px",
  borderRadius: 6,
  border: `1px solid ${tokens.borderDefault}`,
  background: tokens.cardBackground,
  color: tokens.textSecondary,
  width: 150,
};

/**
 * Is this a context where the developer affordance should be offered at all?
 *
 * It used to show on every production page load, so anyone being shown the
 * dashboard met a "⚙ Test mode" chip in the header and reasonably asked
 * whether they were looking at test data. The panel is still needed — it is
 * the only way to supply a token when running outside the Munshot iframe — so
 * it is gated rather than deleted: the dev server, an explicit ?dev=1, or a
 * token already entered in this session.
 */
function devAffordanceVisible(devToken: string | null): boolean {
  if (devToken) return true; // already in use — never strand someone inside it
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has("dev");
  } catch {
    return false;
  }
}

// Standalone preview helper — NOT part of the Munshot auth model. Real host
// context (session.token from the SDK) always wins; this only fills the gap
// while testing outside the Munshot iframe, before this dashboard is embedded.
export function TestModePanel({ active, devToken, devTicker, onApply }: TestModePanelProps) {
  const [open, setOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState(devToken ?? "");
  const [tickerInput, setTickerInput] = useState(devTicker ?? "");

  if (active) return null; // a real host session arrived — no need for this anymore
  if (!devAffordanceVisible(devToken)) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: tokens.textHint,
          background: "transparent",
          border: `1px dashed ${tokens.borderDefault}`,
          borderRadius: 6,
          padding: "3px 8px",
          cursor: "pointer",
        }}
      >
        {devToken ? "⚙ Test mode: on" : "⚙ Test mode"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 10,
            background: tokens.cardBackground,
            border: `1px solid ${tokens.borderDefault}`,
            borderRadius: 8,
            padding: 10,
            width: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, color: tokens.textHint, lineHeight: 1.4 }}>
            Standalone preview only — not used once a real Munshot session connects.
          </div>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Bearer token"
            style={inputStyle}
          />
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            placeholder="Ticker (e.g. AAPL)"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            <button
              onClick={() => {
                onApply(tokenInput.trim() || null, tickerInput.trim() || null);
                setOpen(false);
              }}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                background: tokens.primary,
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
            <button
              onClick={() => {
                setTokenInput("");
                setTickerInput("");
                onApply(null, null);
                setOpen(false);
              }}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: tokens.textMuted,
                background: tokens.cardBackground,
                border: `1px solid ${tokens.borderDefault}`,
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
