// Loads the research layer once and hands the rest of the app a company list
// with human corrections already applied (§47).
//
// The list starts as the bundled static data and is REPLACED, not blocked, when
// overrides arrive. The dashboard therefore renders immediately on its
// build-time data and quietly upgrades — a research database that is slow or
// absent must never turn into a loading spinner over the whole dashboard.

import { useCallback, useEffect, useMemo, useState } from "react";
import { companies as staticCompanies, type Company } from "../data/companies";
import { applyOverrides, type OverrideRow, type AppliedOverride } from "../data/overrides";
import { fetchOverrides, fetchResearchStatus, type ResearchStatus } from "../lib/research";

export interface ResearchState {
  status: ResearchStatus;
  /** Static data with active overrides layered on. */
  companies: Company[];
  overrides: OverrideRow[];
  applied: Map<string, AppliedOverride>;
  ignored: { row: OverrideRow; reason: string }[];
  loading: boolean;
  reload: () => void;
}

export function useResearch(): ResearchState {
  const [status, setStatus] = useState<ResearchStatus>({ database: false, writes: false });
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchResearchStatus()
      .then(async (s) => {
        if (cancelled) return;
        setStatus(s);
        // Skip the fetch entirely when there is no database — it would only
        // return the same 503 the status call already reported.
        setOverrides(s.database ? await fetchOverrides() : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Memoised so the returned array keeps its identity between renders —
  // the views downstream key expensive aggregates off it.
  const { companies, applied, ignored } = useMemo(
    () => applyOverrides(staticCompanies, overrides),
    [overrides],
  );

  return { status, companies, overrides, applied, ignored, loading, reload };
}
