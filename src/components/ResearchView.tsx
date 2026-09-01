// §47 — the research/admin layer: correct a classification, attach a note,
// read the audit trail.
//
// The dashboard's whole argument is that its classifications are auditable
// rather than asserted. That argument only holds if a human who disagrees can
// record the disagreement, with a reason and a name against it, and have the
// dashboard show the corrected value. This is that surface.
//
// It is deliberately honest about being switched off. There are three distinct
// states and they mean different things:
//   - no database   → nothing has been provisioned; nothing is stored
//   - database, no write token → history is readable, corrections are not
//   - both          → fully usable
// Collapsing those into one "unavailable" message would leave whoever set it
// up guessing which half is missing.

import { useEffect, useState } from "react";
import { tokens, categoryColors } from "../lib/theme";
import { Card } from "./Card";
import { EmptyState, LoadingState } from "./StatePanels";
import { OVERRIDABLE_FIELDS, type AppliedOverride, type OverrideRow } from "../data/overrides";
import type { Company } from "../data/companies";
import {
  fetchAudit,
  fetchNotes,
  submitNote,
  submitOverride,
  type AuditRow,
  type NoteRow,
  type ResearchStatus,
} from "../lib/research";

const ADMIN_TOKEN_KEY = "frontier.adminToken";
const AUTHOR_KEY = "frontier.author";

const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "5px 8px",
  borderRadius: 6,
  border: `1px solid ${tokens.borderDefault}`,
  background: "#ffffff",
  color: tokens.textSecondary,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: tokens.textHint,
  display: "block",
  marginBottom: 3,
};

interface ResearchViewProps {
  status: ResearchStatus;
  companies: Company[];
  overrides: OverrideRow[];
  applied: Map<string, AppliedOverride>;
  ignored: { row: OverrideRow; reason: string }[];
  loading: boolean;
  onReload: () => void;
}

export function ResearchView({
  status,
  companies,
  overrides,
  applied,
  ignored,
  loading,
  onReload,
}: ResearchViewProps) {
  const [token, setToken] = useState(() => read(ADMIN_TOKEN_KEY));
  const [author, setAuthor] = useState(() => read(AUTHOR_KEY));
  const [slug, setSlug] = useState("");
  const [field, setField] = useState<string>("isAI");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    if (!status.database) return;
    fetchAudit().then(setAudit);
    fetchNotes().then(setNotes);
  }, [status.database, loading]);

  function remember(key: string, value: string) {
    try {
      value ? sessionStorage.setItem(key, value) : sessionStorage.removeItem(key);
    } catch {
      // sessionStorage unavailable in a restricted iframe — in-memory is fine
    }
  }

  const target = companies.find((c) => c.slug === slug.trim());
  const currentValue = target ? String(readField(target, field) ?? "—") : null;

  async function saveOverride() {
    if (!target || !newValue.trim() || !author.trim()) return;
    setBusy(true);
    const res = await submitOverride(token, {
      entityType: "company",
      entityId: target.slug,
      field,
      oldValue: currentValue,
      newValue: newValue.trim(),
      reason: reason.trim() || undefined,
      author: author.trim(),
    });
    setBusy(false);
    setMessage(res.ok ? { ok: true, text: `Recorded ${field} for ${target.name}.` } : { ok: false, text: res.error });
    if (res.ok) {
      setNewValue("");
      setReason("");
      onReload();
    }
  }

  async function saveNote() {
    if (!note.trim() || !author.trim() || !slug.trim()) return;
    setBusy(true);
    const res = await submitNote(token, {
      entityType: "company",
      entityId: slug.trim(),
      note: note.trim(),
      author: author.trim(),
    });
    setBusy(false);
    setMessage(res.ok ? { ok: true, text: "Note saved." } : { ok: false, text: res.error });
    if (res.ok) {
      setNote("");
      fetchNotes().then(setNotes);
      fetchAudit().then(setAudit);
    }
  }

  if (loading) {
    return (
      <Card title="Research" subtitle="Checking availability">
        <LoadingState label="Checking research database…" />
      </Card>
    );
  }

  if (!status.database) {
    return (
      <Card title="Research layer" subtitle="Not provisioned">
        <div style={{ padding: 14, fontSize: 12, color: tokens.textSecondary, lineHeight: 1.6, overflowY: "auto", height: "100%" }}>
          <p style={{ margin: "0 0 10px" }}>
            Classifications on this dashboard are produced by keyword rules. This panel is where a
            human overrules one — with a reason and a name attached — and where those corrections are
            kept. It needs a Cloudflare D1 database, which nothing has created yet.
          </p>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: tokens.textPrimary }}>To switch it on:</p>
          <pre
            style={{
              margin: "0 0 10px",
              padding: 10,
              borderRadius: 8,
              background: "#ffffff",
              border: `1px solid ${tokens.borderDefault}`,
              fontSize: 10.5,
              lineHeight: 1.7,
              overflowX: "auto",
              color: tokens.textSecondary,
            }}
          >
{`npx wrangler d1 create frontier-db
# paste the database_id into wrangler.jsonc, uncomment the d1_databases block
npx wrangler d1 migrations apply frontier-db --remote
npx wrangler secret put ADMIN_TOKEN`}
          </pre>
          <p style={{ margin: 0, fontSize: 11, color: tokens.textHint }}>
            Everything else on this dashboard works without it — the research layer stores human
            corrections, it does not serve the data.
          </p>
        </div>
      </Card>
    );
  }

  const activeOverrides = [...applied.values()];

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minHeight: 0 }}>
      {/* Left — the editor */}
      <Card
        title="Correct a classification"
        subtitle={status.writes ? "Appended, never overwritten" : "Read-only — no write token configured"}
        bodyStyle={{ overflowY: "auto" }}
      >
        {!status.writes ? (
          <EmptyState
            message="Writes are disabled on this Worker"
            hint="Run `npx wrangler secret put ADMIN_TOKEN`, then redeploy. Until then this API is read-only by design."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Your name</label>
                <input
                  style={inputStyle}
                  value={author}
                  placeholder="who is making this call"
                  onChange={(e) => {
                    setAuthor(e.target.value);
                    remember(AUTHOR_KEY, e.target.value);
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Admin token</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={token}
                  placeholder="ADMIN_TOKEN"
                  onChange={(e) => {
                    setToken(e.target.value);
                    remember(ADMIN_TOKEN_KEY, e.target.value);
                  }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Company slug</label>
              <input
                style={inputStyle}
                value={slug}
                list="frontier-company-slugs"
                placeholder="e.g. clay"
                onChange={(e) => setSlug(e.target.value)}
              />
              <datalist id="frontier-company-slugs">
                {companies.slice(0, 800).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </datalist>
              <div style={{ fontSize: 10, marginTop: 3, color: target ? categoryColors.tools.text : tokens.textHint }}>
                {slug.trim() ? (target ? `${target.name} — ${target.batch}` : "No company with that slug") : " "}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Field</label>
                <select style={inputStyle} value={field} onChange={(e) => setField(e.target.value)}>
                  {Object.entries(OVERRIDABLE_FIELDS).map(([key, spec]) => (
                    <option key={key} value={key}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Corrected value</label>
                <input
                  style={inputStyle}
                  value={newValue}
                  placeholder={OVERRIDABLE_FIELDS[field]?.kind === "boolean" ? "true / false" : "new value"}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
            </div>

            {target && (
              <div style={{ fontSize: 10.5, color: tokens.textMuted }}>
                Currently: <strong style={{ color: tokens.textPrimary }}>{currentValue}</strong>
                {applied.has(`${target.slug}|${field}`) && (
                  <span style={{ color: categoryColors.india.text }}> · already overridden</span>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Reason</label>
              <input
                style={inputStyle}
                value={reason}
                placeholder="why the classifier is wrong here"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <button
              onClick={saveOverride}
              disabled={busy || !target || !newValue.trim() || !author.trim() || !token}
              style={buttonStyle(busy || !target || !newValue.trim() || !author.trim() || !token)}
            >
              {busy ? "Saving…" : "Record correction"}
            </button>

            <div style={{ borderTop: `1px solid ${tokens.borderDefault}`, paddingTop: 8 }}>
              <label style={labelStyle}>Research note (on the same company)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 46, resize: "vertical", fontFamily: "inherit" }}
                value={note}
                placeholder="context that isn't a field correction"
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                onClick={saveNote}
                disabled={busy || !note.trim() || !author.trim() || !slug.trim() || !token}
                style={{ ...buttonStyle(busy || !note.trim() || !author.trim() || !slug.trim() || !token), marginTop: 6 }}
              >
                Save note
              </button>
            </div>

            {message && (
              <div
                style={{
                  fontSize: 11,
                  padding: "5px 8px",
                  borderRadius: 6,
                  background: message.ok ? categoryColors.tools.bg : tokens.errorBg,
                  color: message.ok ? categoryColors.tools.text : tokens.errorRed,
                  border: `1px solid ${message.ok ? categoryColors.tools.border : tokens.errorBg}`,
                }}
              >
                {message.text}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Right — what has been recorded */}
      <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 8, minHeight: 0 }}>
        <Card
          title="Active corrections"
          subtitle={`${activeOverrides.length} applied${ignored.length ? ` · ${ignored.length} ignored` : ""}`}
          bodyStyle={{ overflowY: "auto", padding: 0 }}
        >
          {overrides.length === 0 ? (
            <EmptyState
              message="No corrections recorded"
              hint="Every classification currently shown is the classifier's own verdict."
            />
          ) : (
            <div>
              {activeOverrides.map((o) => (
                <Row
                  key={`${o.entity_id}|${o.field}`}
                  left={o.entity_id}
                  mid={`${o.field}: ${o.old_value ?? "—"} → ${String(o.value)}`}
                  right={o.author}
                  hint={o.reason ?? undefined}
                />
              ))}
              {/* An override that names an unknown field or company silently
                  does nothing, which is indistinguishable from a correction
                  that worked. Surfacing it is the only way to catch a typo. */}
              {ignored.map(({ row, reason: why }, i) => (
                <Row
                  key={`ignored-${i}`}
                  left={row.entity_id}
                  mid={`${row.field}: not applied`}
                  right={row.author}
                  hint={why}
                  tone="warn"
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Audit trail" subtitle="Every write, most recent first" bodyStyle={{ overflowY: "auto", padding: 0 }}>
          {audit.length === 0 && notes.length === 0 ? (
            <EmptyState message="Nothing recorded yet" />
          ) : (
            <div>
              {audit.map((a, i) => (
                <Row
                  key={i}
                  left={a.created_at?.slice(0, 16) ?? ""}
                  mid={`${a.action} · ${a.entity_id ?? ""}`}
                  right={a.author}
                  hint={a.detail ?? undefined}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    border: `1px solid ${disabled ? tokens.borderDefault : tokens.primaryBorder}`,
    background: disabled ? "#ffffff" : tokens.primaryLight,
    color: disabled ? tokens.textHint : tokens.primaryText,
    width: "100%",
  };
}

function Row({
  left,
  mid,
  right,
  hint,
  tone,
}: {
  left: string;
  mid: string;
  right: string;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <div
      style={{
        padding: "6px 10px",
        borderBottom: `1px solid ${tokens.borderDefault}`,
        fontSize: 11,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700, color: tone === "warn" ? categoryColors.crypto.text : tokens.textPrimary }}>
          {left}
        </span>
        <span style={{ color: tokens.textHint, fontSize: 10 }}>{right}</span>
      </div>
      <div style={{ color: tokens.textSecondary }}>{mid}</div>
      {hint && <div style={{ color: tokens.textHint, fontSize: 10 }}>{hint}</div>}
    </div>
  );
}

function readField(company: Company, field: string): unknown {
  switch (field) {
    case "stackPosition":
      return company.dimensions?.stackPosition.layer;
    case "autonomy":
      return company.dimensions?.autonomy.level;
    default:
      return (company as unknown as Record<string, unknown>)[field];
  }
}

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
