import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs module, shared with the build script
import { findEmptyCells } from "../scripts/whitespace.mjs";

/** Builds a matrix whose margins imply a given expectation per cell. */
function matrix(cells: Record<string, number>, rows: string[], cols: string[]) {
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let total = 0;
  for (const r of rows) rowTotals[r] = 0;
  for (const c of cols) colTotals[c] = 0;
  for (const r of rows) {
    for (const c of cols) {
      const n = cells[`${r}||${c}`] ?? 0;
      rowTotals[r] += n;
      colTotals[c] += n;
      total += n;
    }
  }
  return { rows, cols, cells, rowTotals, colTotals, total };
}

describe("findEmptyCells", () => {
  // The bug this guards: the rule was `observed < expected`, so ANY shortfall
  // became a finding. Against real data that reported "37 vs 39.7 expected"
  // and "4 vs 4.9 expected" as unusually empty — 0.43 and 0.41 standard
  // deviations, which is ordinary sampling noise. One whole matrix consisted
  // of nothing but such cells.
  it("ignores a shortfall that is within sampling noise", () => {
    // Two balanced rows and columns: every cell expects 25. A cell holding 23
    // is 0.4 sd light — nothing at all.
    const m = matrix(
      { "A||X": 23, "A||Y": 27, "B||X": 27, "B||Y": 23 },
      ["A", "B"],
      ["X", "Y"],
    );
    expect(findEmptyCells(m)).toHaveLength(0);
  });

  it("reports a cell that is far below expectation", () => {
    // A row and column that are both large, yet their intersection is nearly
    // empty — the shape of a real structural gap.
    const m = matrix(
      { "A||X": 2, "A||Y": 198, "B||X": 198, "B||Y": 2 },
      ["A", "B"],
      ["X", "Y"],
    );
    const found = findEmptyCells(m);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].z).toBeGreaterThan(2);
  });

  // Ranking by emptiness x expected put big cells with trivial gaps above
  // small cells that were genuinely empty.
  it("ranks by how surprising the gap is, not how many companies it involves", () => {
    // Margins are set directly so the two gaps compete head to head:
    //   Big x Gap    expected 400, observed 340 -> 3.0 sd, emptiness x expected 60
    //   Small x Gap  expected  25, observed   0 -> 5.0 sd, emptiness x expected 25
    // The old ranking prefers the first (60 > 25); it is the less surprising
    // of the two, and it is not really a gap at all.
    const m = {
      rows: ["Big", "Small"],
      cols: ["Gap", "Rest"],
      cells: { "Big||Gap": 340, "Big||Rest": 1660, "Small||Gap": 0, "Small||Rest": 125 },
      rowTotals: { Big: 2000, Small: 125 },
      colTotals: { Gap: 425, Rest: 1785 },
      total: 2125,
    };
    const found = findEmptyCells(m);
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found[0].row).toBe("Small");
    expect(found[1].row).toBe("Big");
  });

  it("skips cells too small to say anything about", () => {
    // Expectation below the floor: one company either way proves nothing.
    const m = matrix({ "A||X": 0, "A||Y": 2, "B||X": 2, "B||Y": 2 }, ["A", "B"], ["X", "Y"]);
    expect(findEmptyCells(m)).toHaveLength(0);
  });

  it("never reports a cell that meets or beats expectation", () => {
    const m = matrix(
      { "A||X": 60, "A||Y": 40, "B||X": 40, "B||Y": 60 },
      ["A", "B"],
      ["X", "Y"],
    );
    for (const cell of findEmptyCells(m)) {
      expect(cell.observed).toBeLessThan(cell.expected);
    }
  });
});
