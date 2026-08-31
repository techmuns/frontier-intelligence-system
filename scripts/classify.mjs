// Classification rules for the bundled datasets.
//
// Extracted from build-data.mjs so they can be tested without triggering the
// build script's network fetches. This is the single source of truth: the
// build bakes the results into the data files, and the UI only reads them.

// A batch materially smaller than its neighbours is still being announced.
// Its low count is an artifact of timing, not a real decline.
export const PARTIAL_BATCH_THRESHOLD = 100;

// Below this, a batch's tags are too sparse to read a share from.
export const LOW_TAG_COVERAGE = 0.5;

// YC files robotics companies under whichever vertical they serve — "Robotics
// for Space R&D" lands in Aviation & Space, "Robots that run autonomous depots"
// in Energy — so the Manufacturing-and-Robotics label alone undercounts them by
// roughly a third.
//
// Only unambiguous physical nouns belong here. "Autonomous" is deliberately
// excluded: it describes software agents as often as machines, and including it
// halved precision (33% vs 51%) for almost no extra recall.
export const ROBOTICS_RE =
  /\b(robot|robots|robotic|robotics|drone|drones|humanoid|actuator|actuators|gripper|manipulator|teleoperat\w*)\b/i;

// Tags are the only place YC records "AI", and tag coverage swings between 23%
// and 99% per batch — a tag-derived share tracks YC's bookkeeping more than the
// market. One-liners are populated for essentially every company.
export const AI_RE =
  /\b(ai|a\.i\.|artificial intelligence|llm|llms|agent|agents|agentic|machine learning|gpt|neural|foundation model\w*|world model\w*|copilot|chatbot)\b/i;

function hasAiTag(company) {
  return (company.tags ?? []).some((t) => /^(ai|artificial intelligence)$/i.test(t));
}

export function isRoboticsLabelled(company) {
  return (company.subindustry ?? "").includes("Manufacturing and Robotics");
}

export function isRobotics(company) {
  if (isRoboticsLabelled(company)) return true;
  // one_liner only. long_description matches companies that merely mention
  // robots as a customer ("global upload acceleration for 1GB-100TB files").
  return ROBOTICS_RE.test(company.one_liner ?? "");
}

export function isAI(company) {
  if (hasAiTag(company)) return true;
  return AI_RE.test(company.one_liner ?? "");
}

export { hasAiTag };

/** Country from YC's free-text "City, Region, Country" location, which
 *  sometimes carries a "; Remote" suffix. */
export function countryOf(location) {
  if (!location) return "Unknown";
  const country = location.split(",").pop()?.split(";")[0]?.trim();
  return country || "Unknown";
}

// Spring and Summer both start with "S", so a single-letter code collides and
// renders two different batches with the same axis label.
const SEASON_CODE = { Winter: "W", Spring: "Sp", Summer: "Su", Fall: "F" };

export function shortBatchLabel(batch) {
  const [season = "", year = ""] = batch.split(" ");
  return `${SEASON_CODE[season] ?? season.slice(0, 2)}${year.slice(2)}`;
}
