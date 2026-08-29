// Cloudflare Worker entry point.
//
// Serves the built static dashboard, plus a small server-side proxy for the
// Munshot news_search datasource. The proxy exists ONLY so this dashboard can
// be exercised with real data before it is embedded in the Munshot host:
//
//   - It keeps MUNS_TOKEN server-side, so the JWT never ships in the browser
//     bundle where any visitor could read it.
//   - The browser calls this Worker on its own origin, so no CORS allowlisting
//     is needed for testing (the Worker -> Munshot call is server-to-server).
//
// Once the dashboard is embedded in Munshot, the host supplies the real
// per-user token via the SDK and the frontend stops using this path entirely.

export interface Env {
  ASSETS: Fetcher;
  MUNS_TOKEN?: string;
}

const FASTAPI_BASE = "https://fastapi.muns.io";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleNewsSearch(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!env.MUNS_TOKEN) {
    return json(
      { error: "Proxy token not configured. Set the MUNS_TOKEN secret on this Worker." },
      503,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const upstream = await fetch(`${FASTAPI_BASE}/tools/news-search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MUNS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Pass the upstream body straight through; the frontend already knows how
    // to read this datasource's shape (including its tool-level error form).
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return json({ error: `Upstream request failed: ${(err as Error).message}` }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/news-search") {
      return handleNewsSearch(request, env);
    }

    // Reports whether the proxy has a token, so the UI can show the option
    // only when it will actually work. Never returns the token itself.
    if (url.pathname === "/api/proxy-status") {
      return json({ available: !!env.MUNS_TOKEN }, 200);
    }

    return env.ASSETS.fetch(request);
  },
};
