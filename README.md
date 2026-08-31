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

```bash
npm run data   # re-pulls and rewrites both files
npm test       # confirm the invariants still hold
```

This is manual and the data will go stale until it's run. Counts shift slightly between
runs because YC's API refreshes daily.

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

## Architecture

```
scripts/
  classify.mjs      Classification rules — single source of truth, unit-tested
  build-data.mjs    Fetches YC data, applies classification, writes both datasets
worker/
  index.ts          Serves static assets + the /api news proxy
src/
  lib/sdk.ts        Munshot SDK client (verbatim from the skill)
  lib/theme.ts      Design tokens (verbatim from the skill's ui-standards)
  lib/news.ts       news_search datasource wrapper
  hooks/            useHostContext (verbatim from the skill)
  data/             Bundled datasets + typed accessors and series helpers
  components/       Presentational only
  Dashboard.tsx     Layout, view switching, host request handlers
tests/              Unit tests for classification and derived series
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
  where tags were at least YC's own classification.
- **The dataset is a static snapshot**, refreshed only when `npm run data` is run.
- **The host embed is unverified.** The SDK handshake, real per-user tokens, and ticker
  auto-population cannot be tested outside the real Munshot host.
