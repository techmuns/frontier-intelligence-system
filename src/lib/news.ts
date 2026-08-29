// Wraps the registered `news_search` datasource
// (.claude/skills/dashboard-skill/reference/datasource-registry.md):
//   service: fastapi -> https://fastapi.muns.io
//   POST /tools/news-search { query, country? }
//   auth: bearer_jwt (host session token)
//
// Two call paths:
//   1. Direct — the normal, production path. Uses the token the Munshot host
//      supplied via the SDK, sent as `Authorization: Bearer <token>`.
//   2. Proxy — testing only, before this dashboard is embedded in Munshot.
//      Calls this Worker's own /api/news-search, which injects a server-side
//      token. Keeps the JWT out of the browser and avoids needing CORS while
//      testing. Never used when a real host session is present.

const FASTAPI_BASE = "https://fastapi.muns.io";

export interface NewsResult {
  title?: string;
  url?: string;
  description?: string;
  source?: string;
  age?: string;
  [key: string]: unknown;
}

export type NewsSignalsResult =
  | { ok: true; results: NewsResult[] }
  | { ok: false; error: string };

/** Asks the Worker whether a server-side proxy token is configured. */
export async function checkProxyAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/proxy-status");
    if (!res.ok) return false;
    const body = await res.json();
    return !!body?.available;
  } catch {
    return false;
  }
}

function parseBody(body: any): NewsSignalsResult {
  // Per the registry: tool-level errors return HTTP 200 with the error
  // nested inside `results` — check the body, not just the status code.
  const results = Array.isArray(body?.results) ? body.results : [];
  if (results.length === 1 && results[0]?.error) {
    return { ok: false, error: String(results[0].error) };
  }
  return { ok: true, results: results as NewsResult[] };
}

export async function fetchNewsSignals(
  token: string | null,
  query: string,
  signal?: AbortSignal,
  useProxy = false,
): Promise<NewsSignalsResult> {
  if (!token && !useProxy) {
    return { ok: false, error: "No session token available" };
  }

  const url = useProxy ? "/api/news-search" : `${FASTAPI_BASE}/tools/news-search`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!useProxy && token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
      signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody?.error) detail = String(errBody.error);
      } catch {
        // non-JSON error response — keep the status-code message
      }
      return { ok: false, error: `News search failed (${detail})` };
    }

    return parseBody(await res.json());
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "aborted" };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
