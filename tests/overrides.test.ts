import { describe, it, expect } from "vitest";
import { applyOverrides, type OverrideRow } from "../src/data/overrides";
import type { Company } from "../src/data/companies";

const company = (over: Partial<Company> = {}): Company =>
  ({
    id: 1,
    name: "Acme",
    slug: "acme",
    website: null,
    all_locations: null,
    one_liner: "",
    long_description: "",
    team_size: null,
    industry: "B2B",
    subindustry: null,
    industries: [],
    tags: [],
    top_company: false,
    isHiring: false,
    nonprofit: false,
    batch: "Winter 2026",
    status: "Active",
    stage: null,
    launched_at: null,
    url: "",
    isAI: false,
    isRobotics: false,
    ...over,
  }) as Company;

const row = (over: Partial<OverrideRow> = {}): OverrideRow => ({
  entity_type: "company",
  entity_id: "acme",
  field: "isAI",
  new_value: "true",
  author: "tester",
  ...over,
});

describe("applyOverrides", () => {
  it("applies a boolean correction to the named company", () => {
    const { companies, applied } = applyOverrides([company()], [row()]);
    expect(companies[0].isAI).toBe(true);
    expect(applied.get("acme|isAI")?.value).toBe(true);
  });

  it("leaves other companies untouched and identical by reference", () => {
    const other = company({ slug: "other", name: "Other" });
    const input = [company(), other];
    const { companies } = applyOverrides(input, [row()]);
    expect(companies[1]).toBe(other);
  });

  it("returns the original array when there is nothing to apply", () => {
    const input = [company()];
    expect(applyOverrides(input, []).companies).toBe(input);
  });

  // The point of the allowlist: an override naming a field that does not exist
  // must be visibly rejected. Silently accepting it produces an audit-logged
  // "correction" that changes nothing.
  it("ignores an unknown field and says why", () => {
    const { companies, applied, ignored } = applyOverrides([company()], [row({ field: "is_ai" })]);
    expect(companies[0].isAI).toBe(false);
    expect(applied.size).toBe(0);
    expect(ignored[0].reason).toMatch(/not an overridable field/);
  });

  it("ignores an override for a company that does not exist", () => {
    const { ignored } = applyOverrides([company()], [row({ entity_id: "ghost" })]);
    expect(ignored[0].reason).toMatch(/no company with slug/);
  });

  // Boolean("false") is true and Number("high") is NaN — either would apply a
  // value nobody typed, so an unparseable value must be rejected instead.
  it("rejects a value that does not parse as the field's type", () => {
    const { ignored } = applyOverrides([company()], [row({ new_value: "maybe" })]);
    expect(ignored[0].reason).toMatch(/not a valid boolean/);
  });

  it('reads "false" as false rather than as a truthy string', () => {
    const { companies } = applyOverrides([company({ isAI: true })], [row({ new_value: "false" })]);
    expect(companies[0].isAI).toBe(false);
  });

  it("rejects a non-numeric autonomy level", () => {
    const { ignored } = applyOverrides([company()], [row({ field: "autonomy", new_value: "high" })]);
    expect(ignored[0].reason).toMatch(/not a valid number/);
  });

  // The API returns newest first. If the older row won, a correction would be
  // silently reverted by the very row it was meant to supersede.
  it("takes the newest row when the same field is corrected twice", () => {
    const rows = [
      row({ new_value: "false", created_at: "2026-02-01" }),
      row({ new_value: "true", created_at: "2026-01-01" }),
    ];
    const { companies } = applyOverrides([company({ isAI: true })], rows);
    expect(companies[0].isAI).toBe(false);
  });

  it("applies two different fields to the same company", () => {
    const rows = [row(), row({ field: "industry", new_value: "Industrials" })];
    const { companies } = applyOverrides([company()], rows);
    expect(companies[0].isAI).toBe(true);
    expect(companies[0].industry).toBe("Industrials");
  });

  it("skips theme overrides when applying to companies", () => {
    const { companies, applied, ignored } = applyOverrides(
      [company()],
      [row({ entity_type: "theme", entity_id: "theme-1" })],
    );
    expect(companies[0].isAI).toBe(false);
    expect(applied.size).toBe(0);
    expect(ignored).toHaveLength(0);
  });

  // A dimension override cannot invent the rest of the shape, so a company
  // that was never classified into the stack stays unclassified.
  it("does not fabricate dimensions for a company that has none", () => {
    const { companies } = applyOverrides(
      [company()],
      [row({ field: "stackPosition", new_value: "physical_systems" })],
    );
    expect(companies[0].dimensions).toBeUndefined();
  });

  it("rewrites a stack layer and marks it as human evidence", () => {
    const withDims = company({
      dimensions: {
        stackPosition: { id: "app", label: "Applications", layer: "applications", confidence: 0.4, evidence: "keyword" },
        autonomy: { level: 1, label: "Assistive", confidence: 0.3, evidence: null },
        businessModels: [],
        physicality: { value: "software", confidence: 0.5, evidence: null },
        physicalCapabilities: [],
        dependsOn: [],
        supplies: [],
      },
    });
    const { companies } = applyOverrides([withDims], [row({ field: "stackPosition", new_value: "physical_systems" })]);
    expect(companies[0].dimensions?.stackPosition.layer).toBe("physical_systems");
    expect(companies[0].dimensions?.stackPosition.evidence).toBe("human override");
    expect(companies[0].dimensions?.stackPosition.confidence).toBe(1);
  });

  it("accepts autonomy level 0 rather than treating it as missing", () => {
    const withDims = company({
      dimensions: {
        stackPosition: { id: "app", label: "Applications", layer: "applications", confidence: 0.4, evidence: null },
        autonomy: { level: 3, label: "Autonomous", confidence: 0.3, evidence: null },
        businessModels: [],
        physicality: { value: "software", confidence: 0.5, evidence: null },
        physicalCapabilities: [],
        dependsOn: [],
        supplies: [],
      },
    });
    const { companies } = applyOverrides([withDims], [row({ field: "autonomy", new_value: "0" })]);
    expect(companies[0].dimensions?.autonomy.level).toBe(0);
  });
});
