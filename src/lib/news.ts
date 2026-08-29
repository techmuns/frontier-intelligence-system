// Wraps the registered `news_search` datasource
// (.claude/skills/dashboard-skill/reference/datasource-registry.md):
//   service: fastapi -> https://fastapi.muns.io
//   POST /tools/news-search { query, country? }
//   auth: bearer_jwt (host session token)

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

export async function fetchNewsSignals(
  token: string,
  query: string,
  signal?: AbortSignal,
): Promise<NewsSignalsResult> {
  try {
    const res = await fetch(`${FASTAPI_BASE}/tools/news-search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!res.ok) {
      return { ok: false, error: `News search failed (HTTP ${res.status})` };
    }

    const body = await res.json();

    // Per the registry: tool-level errors return HTTP 200 with the error
    // nested inside `results` — check the body, not just the status code.
    const results = Array.isArray(body?.results) ? body.results : [];
    if (results.length === 1 && results[0]?.error) {
      return { ok: false, error: String(results[0].error) };
    }

    return { ok: true, results: results as NewsResult[] };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "aborted" };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
