import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs module, shared with the build script
import { candidateStems, isParked, pageMatches, normalise } from "../scripts/adapters/website.mjs";

const page = (over: Record<string, unknown> = {}) => ({
  finalUrl: "https://revspot.ai/",
  title: "Revspot · AI that generates qualified pipeline",
  html: "<h1>Revspot</h1><p>AI that generates qualified pipeline.</p>",
  ...over,
});

describe("candidateStems", () => {
  it("tries the name with and without the AI suffix", () => {
    // attentive.ai and gushwork.ai are both real and spelled differently, so
    // both readings of a name ending in "AI" have to be tried.
    expect(candidateStems("Attentive AI")).toEqual(["attentiveai", "attentive"]);
    expect(candidateStems("Revspot")).toEqual(["revspot"]);
  });

  it("drops corporate suffixes", () => {
    expect(candidateStems("Finarkein Analytics Pvt Ltd")).toContain("finarkeinanalytics");
  });

  it("ignores stems too short to be a domain", () => {
    expect(candidateStems("AI")).toEqual([]);
  });
});

describe("isParked", () => {
  it("catches a parking host", () => {
    expect(isParked(page({ finalUrl: "https://daaz.com/lander/?name=mysa.in", title: "mysa.in" }))).toBe(true);
  });

  it("catches for-sale language on any host", () => {
    expect(isParked(page({ html: "<h1>mysa.in</h1><p>This domain is for sale. Make an offer.</p>" }))).toBe(true);
  });

  it("leaves a real site alone", () => {
    expect(isParked(page())).toBe(false);
  });
});

describe("pageMatches", () => {
  it("accepts a page whose title names the company", () => {
    expect(pageMatches("Revspot", page())).toBe("title");
  });

  it("rejects a parked page even though its title is the company name", () => {
    // The exact false positive this guard exists for: Mysa resolved to a
    // daaz.com lander whose title was "mysa.in", which passes a naive check.
    expect(pageMatches("Mysa", page({ finalUrl: "https://daaz.com/lander/?name=mysa.in", title: "mysa.in" }))).toBeNull();
  });

  it("rejects a redirect to an unrelated domain", () => {
    // Guessing foo.com and landing on bigcorp.com means someone else owns it,
    // whatever the page then says.
    expect(
      pageMatches("Rocketfuel", page({ finalUrl: "https://bigcorp.com/", title: "Rocketfuel is our product" })),
    ).toBeNull();
  });

  it("requires a title match for short, generic names", () => {
    // "Giga" in body text alone is far too likely to be a coincidence.
    const body = page({ finalUrl: "https://giga.in/", title: "Industrial Supplies", html: "<p>giga watt motors</p>" });
    expect(pageMatches("Giga", body)).toBeNull();
  });

  it("accepts a body match for a long, distinctive name", () => {
    const body = page({
      finalUrl: "https://gobblecube.ai/",
      title: "Home",
      html: "<p>GobbleCube helps brands win on ecommerce.</p>",
    });
    expect(pageMatches("GobbleCube", body)).toBe("body");
  });

  it("ignores names hidden in scripts rather than visible text", () => {
    const hidden = page({
      finalUrl: "https://gobblecube.ai/",
      title: "Home",
      html: "<script>var x='GobbleCube'</script><p>Unrelated page.</p>",
    });
    expect(pageMatches("GobbleCube", hidden)).toBeNull();
  });
});

describe("normalise", () => {
  it("strips punctuation and case so spellings compare", () => {
    expect(normalise("Smallest.ai")).toBe("smallestai");
    expect(normalise("WYZARD.AI")).toBe("wyzardai");
  });
});

describe("isParked — cases found by auditing real output", () => {
  const p = (title: string, finalUrl = "https://example.ai/", html = "<p>hi</p>") => ({ title, finalUrl, html });

  it("catches a sale pitch in the title", () => {
    expect(isParked(p("FireAi.ai for sale | Spaceship.com", "https://fireai.ai/"))).toBe(true);
    expect(isParked(p("justai.ai - Premium AI Domain for Sale", "https://justai.ai/"))).toBe(true);
    expect(isParked(p("ATLAS.COM | Strategic-Grade domain names", "https://atlas.com/"))).toBe(true);
  });

  it("catches a title that is only the bare domain", () => {
    // A company that shipped a product writes something in its title.
    expect(isParked(p("rocket.io", "https://rocket.io/"))).toBe(true);
    expect(isParked(p("thirdai.io", "https://thirdai.io/"))).toBe(true);
  });

  it("does not flag a real product title that happens to mention sales", () => {
    expect(isParked(p("Revspot · AI that generates qualified pipeline", "https://revspot.ai/"))).toBe(false);
    expect(isParked(p("Assessli", "https://assessli.com/"))).toBe(false);
  });
});
