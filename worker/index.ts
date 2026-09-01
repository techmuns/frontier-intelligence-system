// Cloudflare Worker entry point.
//
// Serves the built static dashboard, plus:
//   - a server-side proxy for the Munshot news datasource
//   - a D1-backed research API (§47 admin, §4 temporal, §13 ontology edits)
//
// D1 is OPTIONAL. If the binding is absent the dashboard still works
// completely — it simply reports that research features are unavailable rather
// than erroring. That keeps the deployment working before anyone provisions a
// database, and means a D1 outage degrades the admin layer rather than the
// whole site.

export interface Env {
  ASSETS: Fetcher;
  MUNS_TOKEN?: string;
  /** Optional. Bind with `npx wrangler d1 create frontier-db` (see README). */
  DB?: D1Database;
  /** Required for any write. Without it the API is read-only. */
  ADMIN_TOKEN?: string;
}

const FASTAPI_BASE = "https://fastapi.muns.io";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Munshot news proxy (testing aid — see README on rotating MUNS_TOKEN)
// ---------------------------------------------------------------------------

async function handleNewsSearch(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.MUNS_TOKEN) {
    return json({ error: "Proxy token not configured. Set the MUNS_TOKEN secret on this Worker." }, 503);
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
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return json({ error: `Upstream request failed: ${(err as Error).message}` }, 502);
  }
}

// ---------------------------------------------------------------------------
// Research API (§47)
// ---------------------------------------------------------------------------

/**
 * Writes require ADMIN_TOKEN as a bearer header.
 *
 * The deployed URL is public, so an unguarded write endpoint would let anyone
 * rewrite the classifications the dashboard reports. If no ADMIN_TOKEN is
 * configured the API stays READ-ONLY rather than defaulting to open — failing
 * closed is the only safe default for a public origin.
 */
function authorizeWrite(request: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN) {
    return json({ error: "Writes are disabled: no ADMIN_TOKEN configured on this Worker." }, 503);
  }
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  // Length check first so the comparison below is only reached for same-length
  // candidates; avoids leaking length via early exit on the loop.
  if (token.length !== env.ADMIN_TOKEN.length) {
    return json({ error: "Unauthorized" }, 401);
  }
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ env.ADMIN_TOKEN.charCodeAt(i);
  }
  return diff === 0 ? null : json({ error: "Unauthorized" }, 401);
}

function requireDb(env: Env): D1Database | Response {
  if (!env.DB) {
    return json(
      {
        error: "No database bound.",
        hint: "Run `npx wrangler d1 create frontier-db`, add the binding to wrangler.jsonc, then `npx wrangler d1 migrations apply frontier-db --remote`.",
        available: false,
      },
      503,
    );
  }
  return env.DB;
}

async function audit(db: D1Database, action: string, entityType: string, entityId: string, detail: string, author: string) {
  await db
    .prepare("INSERT INTO audit_log (action, entity_type, entity_id, detail, author) VALUES (?, ?, ?, ?, ?)")
    .bind(action, entityType, entityId, detail, author)
    .run();
}

/** Current active overrides — the latest active row per entity+field. */
async function getOverrides(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT entity_type, entity_id, field, new_value, reason, author, created_at
         FROM classification_overrides o
        WHERE active = 1
          AND created_at = (
            SELECT MAX(created_at) FROM classification_overrides
             WHERE entity_type = o.entity_type AND entity_id = o.entity_id
               AND field = o.field AND active = 1
          )
        ORDER BY created_at DESC
        LIMIT 500`,
    )
    .all();
  return json({ available: true, overrides: results ?? [] });
}

async function postOverride(request: Request, db: D1Database): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { entityType, entityId, field, oldValue, newValue, reason, author, classifierVersion } = body ?? {};
  if (!entityType || !entityId || !field || newValue === undefined || !author) {
    return json({ error: "entityType, entityId, field, newValue and author are required" }, 400);
  }

  // Append, never update: the prior verdict stays readable (§4).
  await db
    .prepare(
      `INSERT INTO classification_overrides
         (entity_type, entity_id, field, old_value, new_value, reason, author, classifier_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(entityType, entityId, field, oldValue ?? null, String(newValue), reason ?? null, author, classifierVersion ?? null)
    .run();

  await audit(db, "override", entityType, entityId, `${field} -> ${newValue}`, author);
  return json({ ok: true });
}

async function postThemeEdit(request: Request, db: D1Database): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { themeId, action, payload, reason, author, ontologyVersion } = body ?? {};
  const allowed = ["rename", "merge", "split", "approve", "reject", "relate"];
  if (!themeId || !allowed.includes(action) || !author) {
    return json({ error: `themeId, author and action (${allowed.join("|")}) are required` }, 400);
  }

  // Supersede any prior edit of the same kind rather than deleting it, so the
  // ontology's history stays intact (§13).
  await db
    .prepare("UPDATE theme_edits SET valid_to = datetime('now') WHERE theme_id = ? AND action = ? AND valid_to IS NULL")
    .bind(themeId, action)
    .run();

  await db
    .prepare(
      `INSERT INTO theme_edits (theme_id, action, payload, reason, author, ontology_version)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(themeId, action, JSON.stringify(payload ?? {}), reason ?? null, author, ontologyVersion ?? null)
    .run();

  await audit(db, `theme:${action}`, "theme", themeId, JSON.stringify(payload ?? {}), author);
  return json({ ok: true });
}

async function getThemeEdits(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT theme_id, action, payload, reason, author, created_at
         FROM theme_edits WHERE valid_to IS NULL ORDER BY created_at DESC LIMIT 300`,
    )
    .all();
  return json({ available: true, edits: results ?? [] });
}

async function getNotes(url: URL, db: D1Database): Promise<Response> {
  const entityId = url.searchParams.get("entityId");
  const stmt = entityId
    ? db.prepare("SELECT * FROM research_notes WHERE entity_id = ? ORDER BY created_at DESC LIMIT 100").bind(entityId)
    : db.prepare("SELECT * FROM research_notes ORDER BY created_at DESC LIMIT 100");
  const { results } = await stmt.all();
  return json({ available: true, notes: results ?? [] });
}

async function postNote(request: Request, db: D1Database): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { entityType, entityId, note, author } = body ?? {};
  if (!entityType || !entityId || !note || !author) {
    return json({ error: "entityType, entityId, note and author are required" }, 400);
  }
  await db
    .prepare("INSERT INTO research_notes (entity_type, entity_id, body, author) VALUES (?, ?, ?, ?)")
    .bind(entityType, entityId, note, author)
    .run();
  await audit(db, "note", entityType, entityId, note.slice(0, 120), author);
  return json({ ok: true });
}

async function getAudit(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare("SELECT action, entity_type, entity_id, detail, author, created_at FROM audit_log ORDER BY created_at DESC LIMIT 100")
    .all();
  return json({ available: true, log: results ?? [] });
}

async function handleResearch(request: Request, env: Env, url: URL): Promise<Response> {
  const db = requireDb(env);
  if (db instanceof Response) return db;

  const route = url.pathname.replace("/api/research/", "");
  const isWrite = request.method === "POST";

  if (isWrite) {
    const denied = authorizeWrite(request, env);
    if (denied) return denied;
  }

  try {
    switch (`${request.method} ${route}`) {
      case "GET overrides":
        return await getOverrides(db);
      case "POST overrides":
        return await postOverride(request, db);
      case "GET theme-edits":
        return await getThemeEdits(db);
      case "POST theme-edits":
        return await postThemeEdit(request, db);
      case "GET notes":
        return await getNotes(url, db);
      case "POST notes":
        return await postNote(request, db);
      case "GET audit":
        return await getAudit(db);
      default:
        return json({ error: "Unknown research route" }, 404);
    }
  } catch (err) {
    // A schema that has not been migrated yet is the likeliest cause, so say so
    // rather than returning an opaque 500.
    return json(
      { error: `Database error: ${(err as Error).message}`, hint: "Have the migrations been applied?" },
      500,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/news-search") {
      return handleNewsSearch(request, env);
    }

    if (url.pathname === "/api/proxy-status") {
      return json({ available: !!env.MUNS_TOKEN });
    }

    // Lets the UI show the research panel only when it will actually work,
    // and say precisely which half is missing when it won't.
    if (url.pathname === "/api/research-status") {
      return json({
        database: !!env.DB,
        writes: !!env.ADMIN_TOKEN,
      });
    }

    if (url.pathname.startsWith("/api/research/")) {
      return handleResearch(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};
