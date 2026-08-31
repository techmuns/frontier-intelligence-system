import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs module, shared with the build script
import { isAI, isRobotics, isRoboticsLabelled, countryOf, shortBatchLabel } from "../scripts/classify.mjs";

const company = (over: Record<string, unknown> = {}) => ({
  one_liner: "",
  long_description: "",
  subindustry: "",
  tags: [],
  ...over,
});

describe("isRobotics", () => {
  it("counts YC's own Manufacturing and Robotics label", () => {
    expect(isRobotics(company({ subindustry: "Industrials -> Manufacturing and Robotics" }))).toBe(true);
  });

  // The reason this rule exists: YC files robotics companies under whichever
  // vertical they serve, so the label alone undercounts them by ~a third.
  it.each([
    ["Robotics for Space R&D", "Industrials -> Aviation and Space"],
    ["Robots that run autonomous depots for autonomous fleets.", "Industrials -> Energy"],
    ["CV and robotics to automate quality inspection in fish farms", "Industrials -> Climate"],
    ["Your robot chef", "Consumer -> Consumer Electronics"],
    ["Submarine drones for defense", "Industrials -> Defense"],
  ])("catches %j that YC filed under %j", (one_liner, subindustry) => {
    const c = company({ one_liner, subindustry });
    expect(isRoboticsLabelled(c)).toBe(false); // YC does not call it robotics
    expect(isRobotics(c)).toBe(true); // but we do
  });

  // "Autonomous" describes software agents as often as machines. Including it
  // halved precision, so it must not match on its own.
  it.each([
    "Autonomous OS for healthcare",
    "AI Agents That Run Hotel Operations.",
    "The Forward-Deployed AI Research Engineer",
    "Building AGI that can innovate.",
  ])("does not treat software autonomy as robotics: %j", (one_liner) => {
    expect(isRobotics(company({ one_liner }))).toBe(false);
  });

  // Matching the long description pulls in companies that merely mention
  // robots as a customer.
  it("ignores robots mentioned only in the long description", () => {
    const c = company({
      one_liner: "Global upload acceleration for 1GB-100TB files.",
      long_description: "Our customers include robotics and drone companies.",
    });
    expect(isRobotics(c)).toBe(false);
  });
});

describe("isAI", () => {
  it("counts YC's AI tag when present", () => {
    expect(isAI(company({ tags: ["Artificial Intelligence"] }))).toBe(true);
    expect(isAI(company({ tags: ["AI"] }))).toBe(true);
  });

  // The point of one-liner matching: it works when tags are missing, which is
  // most of some batches.
  it.each([
    "World models for robot evals and training.",
    "Multimodal foundation models to predict uncollected patient biology",
    "Datadog for Agent Reliability",
    "The AI data analyst for consumer brands",
    "Multilingual voice agents that outperform humans",
  ])("detects AI from the one-liner with no tags: %j", (one_liner) => {
    expect(isAI(company({ one_liner, tags: [] }))).toBe(true);
  });

  it("does not match unrelated companies", () => {
    expect(isAI(company({ one_liner: "Robotic arms that pick and pack your orders." }))).toBe(false);
    expect(isAI(company({ one_liner: "Counter Drone Systems." }))).toBe(false);
  });

  it("does not match 'ai' inside a longer word", () => {
    expect(isAI(company({ one_liner: "Email campaigns that retain customers" }))).toBe(false);
    expect(isAI(company({ one_liner: "Paid media for brands" }))).toBe(false);
  });
});

describe("countryOf", () => {
  it("takes the country from YC's City, Region, Country format", () => {
    expect(countryOf("London, England, United Kingdom")).toBe("United Kingdom");
    expect(countryOf("San Francisco, CA, USA")).toBe("USA");
  });

  it("strips the Remote suffix so it doesn't split one country in two", () => {
    expect(countryOf("San Francisco, CA, USA; Remote")).toBe("USA");
  });

  it("represents a missing location explicitly rather than guessing", () => {
    expect(countryOf(null)).toBe("Unknown");
    expect(countryOf("")).toBe("Unknown");
  });
});

describe("shortBatchLabel", () => {
  // Spring and Summer both start with S — a one-letter code renders two
  // different batches with the same axis label.
  it("distinguishes Spring from Summer", () => {
    expect(shortBatchLabel("Spring 2025")).toBe("Sp25");
    expect(shortBatchLabel("Summer 2025")).toBe("Su25");
    expect(shortBatchLabel("Spring 2025")).not.toBe(shortBatchLabel("Summer 2025"));
  });

  it("abbreviates the other seasons", () => {
    expect(shortBatchLabel("Winter 2026")).toBe("W26");
    expect(shortBatchLabel("Fall 2026")).toBe("F26");
  });
});
