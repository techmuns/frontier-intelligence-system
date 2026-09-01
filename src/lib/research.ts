// Client for the Worker's research API (worker/index.ts).
//
// Every call degrades to "unavailable" rather than throwing. The research
// layer is optional infrastructure — if D1 is not bound, or the Worker is not
// in front of these files (a plain `vite preview`, say), the dashboard must
// keep working and simply not offer the feature.

import type { OverrideRow } from "../data/overrides";

export interface ResearchStatus {
  /** D1 is bound — reads will work. */
  database: boolean;
  /** ADMIN_TOKEN is set — writes will work for whoever holds it. */
  writes: boolean;
}

export interface ThemeEditRow {
  theme_id: string;
  action: string;
  payload: string;
  reason: string | null;
  author: string;
  created_at: string;
}

export interface NoteRow {
  id: number;
  entity_type: string;
  entity_id: string;
  body: string;
  author: string;
  created_at: string;
}

export interface AuditRow {
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: string | null;
  author: string;
  created_at: string;
}

const OFFLINE: ResearchStatus = { database: false, writes: false };

export async function fetchResearchStatus(): Promise<ResearchStatus> {
  try {
    const res = await fetch("/api/research-status");
    if (!res.ok) return OFFLINE;
    const body = await res.json();
    return { database: !!body?.database, writes: !!body?.writes };
  } catch {
    return OFFLINE;
  }
}

async function get<T>(path: string, key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`/api/research/${path}`);
    if (!res.ok) return fallback;
    const body = await res.json();
    return (body?.[key] as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export const fetchOverrides = () => get<OverrideRow[]>("overrides", "overrides", []);
export const fetchThemeEdits = () => get<ThemeEditRow[]>("theme-edits", "edits", []);
export const fetchNotes = (entityId?: string) =>
  get<NoteRow[]>(entityId ? `notes?entityId=${encodeURIComponent(entityId)}` : "notes", "notes", []);
export const fetchAudit = () => get<AuditRow[]>("audit", "log", []);

export type WriteResult = { ok: true } | { ok: false; error: string };

/**
 * Writes carry the admin token as a bearer header. The token is held in
 * sessionStorage for the tab only — it is a shared write credential, not a
 * user identity, so it is never persisted across browser sessions.
 */
async function post(path: string, token: string, body: unknown): Promise<WriteResult> {
  try {
    const res = await fetch(`/api/research/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) detail = String(err.error);
    } catch {
      // non-JSON error body — keep the status code
    }
    return { ok: false, error: detail };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface OverrideInput {
  entityType: "company" | "theme";
  entityId: string;
  field: string;
  oldValue?: string | null;
  newValue: string;
  reason?: string;
  author: string;
  classifierVersion?: string;
}

export const submitOverride = (token: string, input: OverrideInput) => post("overrides", token, input);

export const submitNote = (
  token: string,
  input: { entityType: string; entityId: string; note: string; author: string },
) => post("notes", token, input);

export const submitThemeEdit = (
  token: string,
  input: { themeId: string; action: string; payload?: unknown; reason?: string; author: string },
) => post("theme-edits", token, input);
