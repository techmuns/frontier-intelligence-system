// Applying human corrections (§47) on top of the machine classification.
//
// The classifier runs at build time and is baked into yc-companies.json. A
// researcher who disagrees with a verdict should not have to edit generated
// data or wait for a rebuild, so corrections live in D1 and are layered over
// the static records at read time.
//
// Two rules make this safe rather than a way to quietly rewrite the dataset:
//
//   1. Only fields on the allowlist below can be overridden. An override
//      naming anything else is IGNORED and reported, not applied. Without
//      that, a typo ("is_ai") would be accepted, stored, shown in the audit
//      log, and change nothing — which looks exactly like a correction that
//      worked.
//   2. Every applied override is returned alongside the data, so the UI can
//      mark a corrected value as corrected. A silent override is worse than
//      no override: it makes the dashboard disagree with its own Method tab
//      for reasons nobody can see.

import type { Company } from "./companies";

export interface OverrideRow {
  entity_type: string;
  entity_id: string;
  field: string;
  new_value: string;
  old_value?: string | null;
  reason?: string | null;
  author: string;
  created_at?: string;
}

type Kind = "boolean" | "string" | "number";

/** The fields a researcher may correct, and how their text value is parsed. */
export const OVERRIDABLE_FIELDS: Record<string, { label: string; kind: Kind }> = {
  isAI: { label: "AI classification", kind: "boolean" },
  isRobotics: { label: "Robotics classification", kind: "boolean" },
  industry: { label: "Industry", kind: "string" },
  subindustry: { label: "Subindustry", kind: "string" },
  stackPosition: { label: "Stack layer", kind: "string" },
  autonomy: { label: "Autonomy level (0-4)", kind: "number" },
};

/**
 * Values arrive from SQLite as text. A failed parse returns undefined rather
 * than a coerced default — `Number("high")` is NaN and `Boolean("false")` is
 * true, and either would apply a value nobody typed.
 */
function parseValue(kind: Kind, raw: string): boolean | string | number | undefined {
  if (kind === "boolean") {
    const v = raw.trim().toLowerCase();
    if (["true", "1", "yes"].includes(v)) return true;
    if (["false", "0", "no"].includes(v)) return false;
    return undefined;
  }
  if (kind === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  const s = raw.trim();
  return s.length ? s : undefined;
}

export interface AppliedOverride extends OverrideRow {
  value: boolean | string | number;
}

export interface OverrideResult {
  companies: Company[];
  /** Overrides that changed a real company — keyed `slug|field`. */
  applied: Map<string, AppliedOverride>;
  /** Overrides that could not be applied, with the reason why. */
  ignored: { row: OverrideRow; reason: string }[];
}

export function applyOverrides(companies: Company[], overrides: OverrideRow[]): OverrideResult {
  const applied = new Map<string, AppliedOverride>();
  const ignored: { row: OverrideRow; reason: string }[] = [];

  const companyRows = overrides.filter((o) => o.entity_type === "company");
  if (companyRows.length === 0) return { companies, applied, ignored };

  const bySlug = new Map(companies.map((c) => [c.slug, c]));

  for (const row of companyRows) {
    const spec = OVERRIDABLE_FIELDS[row.field];
    if (!spec) {
      ignored.push({ row, reason: `"${row.field}" is not an overridable field` });
      continue;
    }
    if (!bySlug.has(row.entity_id)) {
      ignored.push({ row, reason: `no company with slug "${row.entity_id}"` });
      continue;
    }
    const value = parseValue(spec.kind, row.new_value ?? "");
    if (value === undefined) {
      ignored.push({ row, reason: `"${row.new_value}" is not a valid ${spec.kind}` });
      continue;
    }
    // Rows arrive newest-first from the API; the first one wins so a later
    // correction is not undone by the one it superseded.
    const key = `${row.entity_id}|${row.field}`;
    if (!applied.has(key)) applied.set(key, { ...row, value });
  }

  if (applied.size === 0) return { companies, applied, ignored };

  // Copy only the companies that actually change, so referential equality
  // still holds for the rest and memoised views elsewhere are not invalidated.
  const touched = new Set([...applied.values()].map((a) => a.entity_id));
  const next = companies.map((c) => {
    if (!touched.has(c.slug)) return c;
    let out: Company = { ...c };
    for (const field of Object.keys(OVERRIDABLE_FIELDS)) {
      const hit = applied.get(`${c.slug}|${field}`);
      if (!hit) continue;
      out = writeField(out, field, hit.value);
    }
    return out;
  });

  return { companies: next, applied, ignored };
}

function writeField(company: Company, field: string, value: boolean | string | number): Company {
  switch (field) {
    case "isAI":
      return { ...company, isAI: value as boolean };
    case "isRobotics":
      return { ...company, isRobotics: value as boolean };
    case "industry":
      return { ...company, industry: value as string };
    case "subindustry":
      return { ...company, subindustry: value as string };
    case "stackPosition":
      // Dimensions are optional on the record; an override cannot invent the
      // rest of the shape, so it only edits a company that already has one.
      return company.dimensions
        ? {
            ...company,
            dimensions: {
              ...company.dimensions,
              stackPosition: {
                ...company.dimensions.stackPosition,
                layer: value as string,
                confidence: 1,
                evidence: "human override",
              },
            },
          }
        : company;
    case "autonomy":
      return company.dimensions
        ? {
            ...company,
            dimensions: {
              ...company.dimensions,
              autonomy: {
                ...company.dimensions.autonomy,
                level: value as number,
                confidence: 1,
                evidence: "human override",
              },
            },
          }
        : company;
    default:
      return company;
  }
}
