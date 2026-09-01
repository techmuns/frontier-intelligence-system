-- Frontier — D1 schema (§4 temporal, §13 ontology versioning, §47 admin, §49 score versioning)
--
-- Design rule throughout: NOTHING IS EVER UPDATED IN PLACE. Every table is
-- append-only, and "current state" is derived by taking the latest row. That
-- is what §4 means by never overwriting history when a fact changes, and it is
-- what makes §42 (replay the market as it looked six months ago) and §43
-- (backtest a signal against what happened next) possible later.
--
-- The build-time JSON stays the fast path. D1 holds only what must survive a
-- rebuild: human corrections, notes, and the observation history.

-- §47 — a researcher correcting a machine classification.
-- Append-only: a correction is a new row, and the previous verdict remains
-- readable. `active` lets a correction be retracted without deleting evidence
-- that it was once made.
CREATE TABLE IF NOT EXISTS classification_overrides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL,           -- 'company' | 'theme'
  entity_id     TEXT NOT NULL,           -- company slug or theme id
  field         TEXT NOT NULL,           -- e.g. 'stackPosition', 'autonomy', 'isRobotics'
  old_value     TEXT,                    -- what the classifier said, for audit
  new_value     TEXT NOT NULL,
  reason        TEXT,
  author        TEXT NOT NULL,
  classifier_version TEXT,               -- which rules produced the old value
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_overrides_entity
  ON classification_overrides (entity_type, entity_id, field, active);

-- §12/§13 — theme edits: rename, merge, split, approve, reject.
-- A merge does not destroy the absorbed theme; it records that the two are the
-- same thing from this version onward, so historical analysis of either name
-- still resolves.
CREATE TABLE IF NOT EXISTS theme_edits (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id      TEXT NOT NULL,
  action        TEXT NOT NULL,           -- 'rename' | 'merge' | 'split' | 'approve' | 'reject' | 'relate'
  payload       TEXT NOT NULL,           -- JSON: {label} | {intoThemeId} | {relatedThemeId, kind}
  reason        TEXT,
  author        TEXT NOT NULL,
  ontology_version TEXT,                 -- §13 — which theme run this edits
  valid_from    TEXT NOT NULL DEFAULT (datetime('now')),
  valid_to      TEXT,                    -- set when superseded; never deleted
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_theme_edits ON theme_edits (theme_id, valid_to);

-- §47 — free-text research notes attached to anything.
CREATE TABLE IF NOT EXISTS research_notes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  body          TEXT NOT NULL,
  author        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_entity ON research_notes (entity_type, entity_id);

-- §4/§21 — the observation history, mirrored into D1 so it is queryable
-- rather than only diffable in git. Same append-only rule: one row per
-- company per metric per observation, forever.
CREATE TABLE IF NOT EXISTS metric_observations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_slug  TEXT NOT NULL,
  metric        TEXT NOT NULL,
  value         REAL,                    -- NULL means looked up and genuinely absent (§45)
  observed_at   TEXT NOT NULL,
  source        TEXT NOT NULL,
  source_url    TEXT,
  confidence    REAL,
  method        TEXT,
  UNIQUE (company_slug, metric, observed_at, source)
);

CREATE INDEX IF NOT EXISTS idx_obs_company ON metric_observations (company_slug, metric, observed_at);

-- §49 — score history. A score is never overwritten; a new formula version
-- produces new rows, so a past ranking can always be reproduced with the
-- formula that generated it.
CREATE TABLE IF NOT EXISTS score_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL,           -- 'theme' | 'company'
  entity_id     TEXT NOT NULL,
  score_type    TEXT NOT NULL,           -- 'momentum' | 'velocity' | 'whitespace'
  score         REAL NOT NULL,
  components    TEXT,                    -- JSON breakdown, so the score stays explainable
  formula_version TEXT NOT NULL,
  computed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores ON score_history (entity_type, entity_id, score_type, computed_at);

-- §47 — every write is logged, including retractions. The audit trail is the
-- point: an override with no record of who made it and why is not a
-- correction, it is an unexplained discrepancy.
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  detail        TEXT,
  author        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
