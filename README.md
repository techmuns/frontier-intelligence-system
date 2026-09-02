# Frontier — Technology Market Intelligence

A Munshot embedded dashboard tracking where technology is moving, using Y Combinator's
public company directory as the first signal source.

The headline finding it currently surfaces: YC's mix rotated **out of Fintech (23% → 7%)
and into Industrials (6% → 23%)** between Winter 2022 and Summer 2026 — driven almost
entirely by robotics and defense, while climate faded out.

---

## Quick start

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # typechecks app + worker, then builds to dist/
npm run data     # re-pull the YC datasets (see "Refreshing the data")
```

## Deploying

Cloudflare Workers, wired to this repo via Workers Builds — pushing to `main`
redeploys. `wrangler.jsonc` holds the config; `npm run build` is the build command
and `./dist` the asset directory.

To deploy by hand:

```bash
npm run build && npx wrangler deploy
```

---

## How it runs inside Munshot

Per `.claude/skills/dashboard-skill/reference/auth-standards.md`, this dashboard runs
as an **iframe inside the Munshot host** and receives identity from it. It has no login
of its own by design.

- `src/lib/sdk.ts` — the SDK client, created once at module load so its message
  listener is live before `host:init` can arrive. **Never call `sdk.ready()`**; the SDK
  sends `dashboard:ready` itself once it knows the channel id. Calling it manually
  races the handshake and the connection silently never completes.
- `src/hooks/useHostContext.ts` — reads context via `getContext()` and re-syncs on
  every host message.
- Both files are copied verbatim from the skill. Change `DASHBOARD_ID` / `DASHBOARD_NAME`
  and nothing else.

The host supplies `session.token` (a JWT) and `market.selectedTicker`. Every API call
sends `Authorization: Bearer ${session.token}`.

### Token precedence

Opened outside the Munshot host, no token ever arrives — so the dashboard sits on
"Waiting for session…" forever. That is correct behaviour, not a bug. Two fallbacks
exist purely so it can be exercised before the host embed lands:

1. **Real host session** — always wins.
2. **Test mode** — the `⚙ Test mode` control in the header takes a token and ticker by
   hand. Per-browser only, never deployed. Hides itself once a real session appears.
3. **Worker proxy** — `/api/news-search` injects the `MUNS_TOKEN` Worker secret
   server-side (see `worker/index.ts`). Used only when neither of the above exists.

> The deployed URL is public, so anyone who finds it can invoke the proxy.
> **Rotate `MUNS_TOKEN` once the host embed is live** and this path is no longer needed.

---

## Data

Two bundled datasets, split by size, both produced by `scripts/build-data.mjs` from
[yc-oss/api](https://github.com/yc-oss/api) — a daily mirror of YC's public Algolia index.

| File | Contents | Why |
| --- | --- | --- |
| `src/data/yc-companies.json` | Full records, current batches (~650) | Powers the explorer and detail view |
| `src/data/yc-trends.json` | Per-batch aggregates, 16 batches back to Winter 2022 | Momentum needs a baseline; aggregates keep ~3k companies from bloating the bundle |

### Refreshing the data

Automatic. `.github/workflows/refresh-data.yml` re-pulls both datasets **every Monday**
(and on demand via *Actions → Refresh YC data → Run workflow*), then commits only if
something actually changed. That push triggers a Workers Builds redeploy, so the live
dashboard updates itself.

Weekly rather than daily because YC's API refreshes daily but batch composition moves
slowly — daily runs would mostly produce commit noise.

**The test suite gates the commit.** If YC changes their API shape, or a batch arrives
in a state that breaks an invariant, the workflow fails and nothing is committed — the
dashboard keeps serving the last known-good data rather than quietly publishing
something wrong. Verified by simulating three failure modes (label exceeding the
corrected count, a batch reporting more AI companies than it has companies, and the
history being truncated); each is caught.

To do it by hand:

```bash
npm run data   # re-pulls and rewrites both files
npm test       # confirm the invariants still hold
```

Counts shift slightly between runs because YC's API refreshes daily.

### External signals (§44 adapters)

`npm run enrich` collects observations from free, keyless public sources and
**appends** them to `src/data/observations.json` — never overwrites. One run is
a snapshot; successive runs are a series, which is what makes growth and
acceleration computable (§21). The weekly workflow runs this automatically.

| Adapter | Signal | Cost | Matched on | Coverage |
| --- | --- | --- | --- | --- |
| Tranco | Daily web rank | Free, no key | Exact domain | ~16% — seed-stage domains sit outside the top-1M |
| Hacker News | Mentions, points | Free, no key | Exact domain | ~100% (zero is a real reading) |
| ~~Greenhouse / Lever~~ | ~~Open roles~~ | Free, no key | Guessed slug | **Disabled — misattributes** (see below) |
| GitHub | Org stars, repos | Free (5k/hr with token) | Org website verified against domain | **Currently 0 — needs a valid token** |

**Entity resolution is the hard part, not the sources.** Matching companies by
NAME produces garbage — searching SEC filings for "Clay" returns 1,755 hits
including *California BanCorp*, and "Perplexity" returns SPV vehicles rather
than the company. Matching on the company's **domain**, which YC provides,
returns the real thing. So every adapter joins on domain where it can; the two
that cannot (jobs by slug, GitHub by org name) carry lower confidence and
verify what they can — the GitHub adapter accepts an org only if its profile
website resolves to the company's domain.

A failed lookup is recorded as `null` (unknown), never as zero.

**The jobs adapter is disabled, and why matters.** Open roles would be a good
free proxy for headcount growth, but neither Greenhouse nor Lever can be looked
up by domain, so the board slug has to be guessed — and short names collide.
Measured against real data: *Clara* (YC, 9 people, askclara.com) matched a
Brazilian company advertising 117 roles in São Paulo; *Nex* (YC, 5 people,
nex.ai) matched a Hong Kong company with 44. Those are not missing values,
which would be harmless — they are confident numbers attached to the wrong
company, which is worse than no signal. The adapter stays in the tree behind
`enabled: false` and switches on if board ownership can ever be verified rather
than guessed.

**A failed lookup must never become data, and that was a real bug.** A
`GITHUB_TOKEN` that was *present but invalid* returned 401 for every call. The
adapter could not tell that apart from "this company has no GitHub org", so it
wrote **1,318 null readings** into the observation store. A null is supposed to
mean *we looked and it genuinely is not there*; recording *we never looked* the
same way turned a broken credential into the finding that no YC company does
open source — and nothing about the data looked wrong.

The adapter now proves it can read GitHub before collecting anything, and
collects **nothing at all** if it cannot: no token, a rejected token, or too
little rate-limit budget to finish. If GitHub starts refusing part-way through
a run, the whole run is discarded rather than half-kept, because the companies
after the failure would be nulls meaning "we stopped looking". The 1,318 bad
rows have been purged. Guarded by tests, including one that confirms both the
preflight and mid-run guards independently hold the behaviour.

The weekly Action passes the `GITHUB_TOKEN` that Actions mints automatically,
so this runs at full rate in CI at no cost and no-ops locally. That wiring was
missing until now, which is the immediate reason GitHub coverage is 0 — the
step ran without a token every week and skipped itself.

**Deliberately not used:** Crunchbase and PitchBook (paid), Product Hunt
(OAuth-only now), SEC EDGAR Form D (free and official, but name-only matching
would fabricate funding events — revisit if a domain-based resolution path
appears).

---

## The research layer (Cloudflare D1) — optional

Every classification on this dashboard is produced by keyword rules. That is defensible
only if a human who disagrees can overrule one **and have the dashboard show the
corrected value**. The research layer is that: a D1 database holding human corrections,
notes, and an audit trail, layered over the build-time data at read time.

**It is off until you switch it on, and the dashboard works fully without it.** The
Worker treats a missing `DB` binding as "research features unavailable" rather than an
error, and the Research tab shows the setup commands instead of a broken form. That is
deliberate — a D1 outage should degrade one panel, not the site.

```bash
npx wrangler d1 create frontier-db
# paste the printed database_id into wrangler.jsonc and uncomment the d1_databases block
npx wrangler d1 migrations apply frontier-db --remote
npx wrangler secret put ADMIN_TOKEN     # writes stay disabled without this
```

`ADMIN_TOKEN` is required, not optional. The deployed URL is public, so an unguarded
write endpoint would let anyone rewrite the classifications the dashboard reports.
**With no token configured the API is read-only** — it fails closed rather than
defaulting to open.

### Nothing is ever updated in place

Every table in `migrations/0001_init.sql` is append-only, and "current state" is the
latest row. A correction does not erase the verdict it replaces; a retraction does not
erase evidence that the correction was once made. This is what makes it possible to ask
later what the dataset looked like at a past date, and to reproduce a past ranking with
the formula that generated it — neither is possible once history has been overwritten.

| Table | Holds |
| --- | --- |
| `classification_overrides` | A human correcting a machine verdict, with reason and author |
| `theme_edits` | Rename / merge / split / approve on discovered themes; superseded, never deleted |
| `research_notes` | Free-text context that isn't a field correction |
| `metric_observations` | The observation history, queryable rather than only diffable in git |
| `score_history` | Scores tagged with the formula version that produced them |
| `audit_log` | Every write, including retractions |

### Only six fields can be overridden

`src/data/overrides.ts` holds the allowlist — `isAI`, `isRobotics`, `industry`,
`subindustry`, `stackPosition`, `autonomy`. An override naming anything else is
**ignored and shown as ignored**, never applied.

That matters more than it looks. Without the allowlist, an override with a typo
(`is_ai`) would be accepted by the API, written to the audit log, and change nothing —
indistinguishable from a correction that worked. The same applies to values: `"maybe"`
for a boolean is rejected rather than coerced, because `Boolean("false")` is `true` and
`Number("high")` is `NaN`, and either would apply a value nobody typed. All of it is
unit-tested, including the case where two corrections to the same field disagree (the
newest wins).

An override cannot invent structure it does not have: correcting `stackPosition` on a
company the classifier never placed on the stack is a no-op, not a fabricated dimension.

---

## Measurement decisions

These matter more than the code. Two traps in this dataset produce confident, completely
false conclusions, and both are guarded by tests.

### Tags are not used for measurement

Tag coverage swings between **23% and 99%** per batch depending on how far YC has got
with tagging. A tag-derived share therefore tracks YC's bookkeeping rather than the
market — measured that way, AI appeared to **collapse from 65% to 13% and recover**,
which is entirely an artifact of missing data.

AI and robotics are instead classified from each company's **one-line pitch**, which is
populated for essentially every company. The Method tab in the UI shows both
measurements with tag coverage overlaid, so the choice is auditable rather than asserted.

### Robotics is scattered across verticals

YC files robotics companies under whichever industry they serve — "Robotics for Space
R&D" under Aviation & Space, "Robots that run autonomous depots" under Energy. Counting
only the `Manufacturing and Robotics` label undercounts robotics by roughly a third, so
a company counts if **either** YC labelled it **or** its one-liner names a physical robot.

Two constraints, both settled by testing rather than assumption:

- **"Autonomous" is excluded.** It describes software agents as often as machines;
  including it halved precision (33% → 51%) for almost no extra recall.
- **One-liners only, never long descriptions.** The long text matches companies that
  merely mention robots as customers ("global upload acceleration for 1GB-100TB files").

### Most companies have no external signal

172 of 659 companies resolve anything from an external source. The other 487
show **—** in the Velocity table, never 0. A seed-stage company nobody has
posted about on Hacker News and whose domain sits outside the top 1M is not a
company performing badly, and a 0 would say the second thing. The score column
is greyed with the reason on hover, and the coverage is stated in the panel
header rather than left to be inferred from a table of zeros.

### Partial batches

A batch under 100 companies is still being announced. Its low count is timing, not
decline, and it is flagged everywhere it appears. **Fall 2026 (24) and Winter 2027 (1)
are too small to read** — sharp moves at the right edge of any chart are noise.
Summer 2026 is the newest batch worth quoting.

### General rules

- Unknowns are omitted, never counted as zero (an unreported team size is not a team of none).
- Batches with no data yield gaps in a line, not fabricated zeros.
- Everything is sourced and dated in the footer.

---

## Layout

Sized for a full browser window, not a widget. The first version used 9-11px
type throughout and fixed row caps, which on a real screen put every tab's
content in the top third and left the rest blank. Three rules now hold it
together, verified by screenshotting every tab rather than by eye:

- **One type scale**, `type` in `src/lib/theme.ts`. Body text is 13px, not 9px.
  The skill's `ui-standards.md` specifies colour only, so sizing is this
  project's decision to make and to keep in one place.
- **Cards fill their column.** Where a card holds few items — the five
  directional axes, the stack bands — the items share the height instead of
  stacking at the top. Where it holds a table, the table stretches.
- **Row caps are set by what fits, not by what is convenient.** A theme now
  carries 18 example companies rather than 4, because the panel showing them
  is a full column tall.

Where a column still ends early it is because the data ends there — the
physical stack has two layers, and §41 has no qualifying insights. Those are
findings, not layout bugs, and are labelled as such.

## Architecture

```
scripts/
  classify.mjs      Classification rules — single source of truth, unit-tested
  build-data.mjs    Fetches YC data, applies classification, writes both datasets
  enrich.mjs        Runs the external adapters, appends to the observation store
migrations/
  0001_init.sql     D1 schema — append-only throughout
worker/
  index.ts          Static assets + the /api news proxy + the research API
src/
  lib/sdk.ts        Munshot SDK client (verbatim from the skill)
  lib/theme.ts      Design tokens (verbatim from the skill's ui-standards)
  lib/news.ts       news_search datasource wrapper
  lib/research.ts   Research API client — degrades to "unavailable", never throws
  hooks/            useHostContext (verbatim), useResearch (overrides + status)
  data/             Bundled datasets, typed accessors, override application
  components/       Presentational only
  Dashboard.tsx     Layout, view switching, host request handlers
tests/              Unit tests for classification, derived series and overrides
```

Classification runs **once**, at build time, and is baked into the data as
`isAI` / `isRobotics`. The UI never re-implements the rules, so the two datasets
cannot drift apart.

Only datasources registered in the skill's `datasource-registry.md` are called —
currently `news_search` (`POST https://fastapi.muns.io/tools/news-search`).

---

## Known limitations

- **This measures company formation, not outcomes.** There is no funding, traction, or
  survival data, so it shows what is being *founded*, never what is *working*. Most of
  the momentum/velocity/whitespace ideas in the original brief need a data source that
  does not exist here yet.
- **Classification is keyword-based.** Defensible and tested, but it is a judgment call
  where tags were at least YC's own classification. The research layer above exists so a
  human can overrule it on the record; nobody has, so every value currently shown is the
  classifier's own.
- **The dataset refreshes weekly**, so intra-week changes at YC are not reflected.
- **The host embed is unverified.** The SDK handshake, real per-user tokens, and ticker
  auto-population cannot be tested outside the real Munshot host.
