// White space as matrix completion (§24) and second-order dependency gaps (§25).
//
// §24 is explicit that an empty cell is NOT automatically an opportunity, so
// this file deliberately stops at "unusually empty, and here is the shape of
// the emptiness". Judging *why* a cell is empty (no buyer, regulation,
// technically impossible, incumbent lock-in) needs evidence this system does
// not have; the UI presents empty cells as questions to investigate, not
// answers. Calling them opportunities would be exactly the false confidence
// §24 warns against.

/**
 * Sparse matrix over two dimensions, with the marginals needed to judge
 * whether a cell is empty because the row is dead or because the cell itself
 * is genuinely unserved.
 */
export function buildMatrix(companies, rowOf, colOf) {
  const cells = new Map(); // "row||col" -> count
  const rowTotals = new Map();
  const colTotals = new Map();

  for (const c of companies) {
    const row = rowOf(c);
    const col = colOf(c);
    if (!row || !col) continue; // unknown dimension: omitted, never bucketed as "other"
    const key = `${row}||${col}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    rowTotals.set(row, (rowTotals.get(row) ?? 0) + 1);
    colTotals.set(col, (colTotals.get(col) ?? 0) + 1);
  }

  const rows = [...rowTotals.keys()].sort((a, b) => rowTotals.get(b) - rowTotals.get(a));
  const cols = [...colTotals.keys()].sort((a, b) => colTotals.get(b) - colTotals.get(a));

  return {
    rows,
    cols,
    rowTotals: Object.fromEntries(rowTotals),
    colTotals: Object.fromEntries(colTotals),
    cells: Object.fromEntries(cells),
    total: companies.length,
  };
}

/**
 * Cells that are emptier than the row and column marginals predict.
 *
 * Expected count under independence = (row total × col total) / grand total.
 * A cell far below its expectation is "unusually empty" — which is a question,
 * not a verdict. Only rows and columns with enough mass to have an expectation
 * worth testing are considered, so a one-company row cannot generate spurious
 * "gaps" everywhere.
 */
export function findEmptyCells(matrix, { minExpected = 1.5, limit = 24 } = {}) {
  const out = [];
  for (const row of matrix.rows) {
    for (const col of matrix.cols) {
      const observed = matrix.cells[`${row}||${col}`] ?? 0;
      const expected = (matrix.rowTotals[row] * matrix.colTotals[col]) / matrix.total;
      if (expected < minExpected) continue;
      if (observed >= expected) continue;
      out.push({
        row,
        col,
        observed,
        expected: Math.round(expected * 10) / 10,
        // How far below expectation, normalised. 1 = completely empty.
        emptiness: Math.round((1 - observed / expected) * 100) / 100,
      });
    }
  }
  return out.sort((a, b) => b.emptiness * b.expected - a.emptiness * a.expected).slice(0, limit);
}

/**
 * Dependency gap (§25) — the second-order question.
 *
 * When many companies in growing application clusters all need the same
 * capability, whoever supplies that capability is positioned to capture value.
 * So compare:
 *
 *   demand  = how many companies require the capability, weighted by how fast
 *             their part of the market is forming
 *   supply  = how many companies actually provide it
 *
 * A high demand-to-supply ratio is a candidate second-order opportunity. This
 * works for any capability list, not just today's AI ones — §25's requirement
 * that it generalise to future markets.
 */
export function dependencyGaps(companies, { recentBatches = [] } = {}) {
  const demand = new Map();
  const supply = new Map();
  const demandRecent = new Map();
  const labels = new Map();

  for (const c of companies) {
    const dims = c.dimensions;
    if (!dims) continue;
    const isRecent = recentBatches.includes(c.batch);

    for (const dep of dims.dependsOn ?? []) {
      labels.set(dep.id, dep.label);
      demand.set(dep.id, (demand.get(dep.id) ?? 0) + 1);
      if (isRecent) demandRecent.set(dep.id, (demandRecent.get(dep.id) ?? 0) + 1);
    }
    for (const sup of dims.supplies ?? []) {
      labels.set(sup.id, sup.label);
      supply.set(sup.id, (supply.get(sup.id) ?? 0) + 1);
    }
  }

  const gaps = [];
  for (const [id, label] of labels) {
    const d = demand.get(id) ?? 0;
    const s = supply.get(id) ?? 0;
    if (d < 5) continue; // too little demand to call anything a gap

    // +1 smoothing: a capability with zero suppliers should rank highly but
    // not divide by zero into meaninglessness.
    const ratio = d / (s + 1);
    gaps.push({
      id,
      label,
      demand: d,
      demandRecent: demandRecent.get(id) ?? 0,
      supply: s,
      ratio: Math.round(ratio * 10) / 10,
      // Normalised for display; the raw counts are kept so the number is
      // always auditable back to companies.
      gapScore: Math.min(100, Math.round(ratio * 4)),
    });
  }

  return gaps.sort((a, b) => b.ratio - a.ratio);
}

export const WHITESPACE_VERSION = "whitespace@1";
