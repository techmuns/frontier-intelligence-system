// Light / dark mode.
//
// Precedence: an explicit choice the reader has made, otherwise the operating
// system's preference. The choice is remembered in localStorage rather than
// sessionStorage — a display preference should survive closing the tab, unlike
// the per-tab test credentials elsewhere in this app.

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const KEY = "frontier.theme";

function systemPrefers(): ThemeMode {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function stored(): ThemeMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    // localStorage throws in a restricted iframe; fall back to the system.
    return null;
  }
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => stored() ?? systemPrefers());
  // Whether the reader has overridden the system. Only while they have not do
  // we keep following it.
  const [explicit, setExplicit] = useState(() => stored() !== null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    // Lets the browser paint form controls and scrollbars to match.
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  useEffect(() => {
    if (explicit) return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => setMode(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [explicit]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Unavailable — the choice still applies for this session.
      }
      return next;
    });
    setExplicit(true);
  }, []);

  return { mode, toggle };
}
