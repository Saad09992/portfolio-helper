# Deploying to Cloudflare Workers

Plan for moving this app off the Docker/VPS setup (`Dockerfile`, `deploy/Caddyfile`,
ngrok) and onto Cloudflare Workers.

**Status:** deployed and live at
`https://psx-portfolio.saadofficial0999.workers.dev`. This document describes the
migration as built; see [What changed during implementation](#what-changed-during-implementation)
for where reality diverged from the original plan.

---

## Verdict

Deployable, but not as-is. The HTTP layer ports cleanly — `hono` runs natively on
Workers and `zod` is pure JS. Three things do not survive the move:

| Concern | Today | Blocker | Resolution |
|---|---|---|---|
| Portfolio storage | `better-sqlite3` on `data/portfolio.sqlite` | Native N-API binding; no filesystem on Workers | **D1** |
| Static SPA | `@hono/node-server/serve-static` + `fs` reads | No `fs` | **Workers Assets** |
| Daily snapshot | `setTimeout` loop in `startScheduler()` | No long-lived process | **Cron Triggers** |

The scrapers (`scrape-util.mjs`, `sarmaaya.mjs`, `psx-index.mjs`, `fetchQuote` in
`api.mjs`) are plain `fetch` + regex with an `AbortController` timeout. All of that
is Workers-native and needs no changes — *provided* the upstream hosts accept
Cloudflare egress, which is what Step 0 verifies.

---

## Cloudflare features used

| Feature | Purpose | Plan |
|---|---|---|
| **Workers** | Runs the Hono app — `fetch` handler for `/api/*`, `scheduled` handler for the daily sync | Free tier viable; see [CPU and subrequests](#cpu-and-subrequest-limits) |
| **D1** | Portfolio database, replacing `data/portfolio.sqlite` | Free. DB is ~100 KB — nowhere near any tier limit |
| **Workers Assets** | Serves the built `dist/` SPA, with `not_found_handling: "single-page-application"` for client routing | Free, unmetered static requests |
| **Cron Triggers** | Fires the daily snapshot at 23:59 PKT | Free |
| **Cloudflare Access** (Zero Trust) | Real auth in front of the whole Worker; replaces the bearer token | Free up to 50 users |
| **Secrets Store / `wrangler secret`** | Any remaining runtime config | Free |

Explicitly *not* used:

- **Durable Objects** — the only thing that would want one is `serializeSave()`,
  and a D1 `batch()` is already atomic, so it is unnecessary. See
  [Write serialization](#write-serialization).
- **Workers KV** — D1 covers storage; a second store would only add a consistency
  seam.
- **R2** — nothing binary to hold.

---

## Architecture

**Now**

```
ngrok ──> Caddy :80 ──> Docker container :3000 (node server/index.mjs)
                          ├── Hono ── /api/*         (in-process)
                          ├── serve-static ─ dist/    (fs)
                          ├── better-sqlite3 ─ /data/portfolio.sqlite  (volume)
                          └── setTimeout scheduler
```

**After**

```
     Worker  (psx-portfolio.saadofficial0999.workers.dev)
       ├── fetch()     ── Hono
       │                    ├── /api/auth/*   session cookie issue / verify
       │                    ├── /api/*        gated on that cookie, fails closed
       │                    └── env.DB        (D1)
       ├── assets      ── dist/client         (Workers Assets, SPA fallback)
       └── scheduled() ── runDailySync()      (Cron Trigger, 59 18 * * * UTC)
                            └── bypasses the HTTP gate entirely
```

---

## Workstreams

### 1. D1 migration — the bulk of the work

`server/portfolio-db.mjs` (325 lines) is written against better-sqlite3's
**synchronous** API. D1 is **async**. This is the change that ripples furthest.

| better-sqlite3 | D1 |
|---|---|
| `db.prepare(sql).get(...)` | `await stmt.bind(...).first()` |
| `db.prepare(sql).all(...)` | `(await stmt.bind(...).all()).results` |
| `db.prepare(sql).run(...)` | `await stmt.bind(...).run()` |
| `db.transaction(fn)` then `tx()` | `await db.batch([...stmts])` — atomic |
| `db.exec("A; B; C;")` | One statement per `prepare`; batch them |
| `db.pragma("journal_mode = WAL")` | N/A — D1 manages this |
| Named params `@id` | Positional `?` only |

Consequences that are easy to miss:

- **Named parameters are not supported.** Every `insHolding.run({id, ticker, ...})`
  call in `saveBundle()` becomes positional `.bind(id, ticker, ...)`. Argument
  order now matters and is silent when wrong — worth a test per table.
- **`loadBundle()` and `saveBundle()` become `async`.** That propagates to every
  caller: all five routes in `api.mjs`, plus `runDailySync()` in `cron.mjs`.
- **The module-level `cached` connection singleton in `getPortfolioDb()` disappears.**
  D1 arrives per-request as `env.DB`; it must be threaded through instead of
  imported. Same for `dbPath` / `portfolioDbPath` arguments throughout.
- **The multi-statement `db.exec("DELETE FROM payouts; DELETE FROM holdings; ...")`
  at the top of `saveBundle()` splits** into one prepared statement per table,
  prepended to the same `batch()` — which preserves the existing
  delete-then-reinsert atomicity.

#### Keeping the tests runnable

`portfolio-db.test.mjs`, `cron.test.mjs`, and `portfolio-compute.test.mjs` run
today under plain `vitest` against better-sqlite3. Pointing them at D1 means
adopting `@cloudflare/vitest-pool-workers` and running them inside workerd.

Recommended instead: define a thin async adapter — `query`, `first`, `run`,
`batch` — with two implementations, one wrapping D1 and one wrapping
better-sqlite3. `portfolio-db.mjs` targets the adapter only. Tests keep using
fast in-process SQLite; production uses D1. This also keeps `vite.config.ts`'s
dev middleware working (see [Local development](#local-development)).

#### Schema and data

`server/migrations.mjs` hand-rolls versioning via a `schema_version` table.
D1 has this built in — migrations become numbered SQL files:

```
migrations/
  0001_stocks_sectors.sql      # from MIGRATIONS v1
  0002_portfolio_tables.sql    # from MIGRATIONS v2
  0003_ledger_fee_config.sql   # from MIGRATIONS v3
```

The `up()` bodies are already plain `CREATE TABLE IF NOT EXISTS` DDL, so this is
mostly mechanical extraction. `runMigrations()` and the `schema_version` table
are then deleted.

> **Checkpoint the WAL before exporting**, as hygiene:
>
> ```sh
> sqlite3 data/portfolio.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"
> ```
>
> The 4.2 MB `data/portfolio.sqlite-wal` sidecar looks alarming next to the 100 KB
> main file, but WAL size is a high-water mark that SQLite reuses rather than
> truncates — it does not imply unflushed data. Running the checkpoint here moved
> **0 frames**, confirming the main file was already current. Do it anyway before
> any dump: it costs nothing and removes the ambiguity.

### 2. Worker entry point

`server/index.mjs` is replaced. It currently does six things that all change:
`serve()` from `@hono/node-server`, a `dist/` existence check, `serveStatic`, an
`existsSync`/`readFileSync` SPA fallback, `startScheduler()`, and SIGINT/SIGTERM
handlers. On Workers:

```js
export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runDailySync({ db: env.DB }));
  },
};
```

Static serving and the SPA fallback are handled by the Assets binding
declaratively — no route code at all. `process.env.*` becomes `env.*`.

The API-miss guard (`app.all("/api/*", ...)` → 404 JSON, `index.mjs:47`) must
stay and must still precede asset handling, or a wrong-method API call falls
through to `index.html`.

### 3. Cron Trigger

```jsonc
"triggers": { "crons": ["59 18 * * *"] }   // 23:59 PKT — PKT is UTC+5, no DST
```

`runDailySync()` ports over essentially unchanged. `startScheduler()`,
`msUntilNextRun()`, `catchUp()`, and the SIGINT handling are all deleted.

**The stale-retry path is dead code and does not need porting.** Both routes into
`STALE_RETRY_MS` sit behind `afterSnapshotTime()`, which requires ≥23:59 PKT and
therefore `hour === 23`; `withinStaleRetryWindow()` requires `hour < 23`. The two
conditions are mutually exclusive, so `scheduleIn(STALE_RETRY_MS, ...)` is
unreachable today. Current effective behavior is a single daily attempt, which is
exactly what one Cron Trigger gives.

If retry-on-stale is actually wanted, it should be designed deliberately — e.g.
`"*/5 14-18 * * *"` UTC with the freshness check short-circuiting once a snapshot
for the PKT date already exists.

Cron invocations do **not** pass through Cloudflare Access, so gating the app does
not break the scheduler.

### 4. Stock list → static JSON

`/api/psx/stocks` (`api.mjs:120`) opens `data/psx-stocks.db` read-only on every
request just to run one `stocks ⋈ sectors` join. A second D1 database for 57 KB of
never-changing reference data is not worth it.

Export it once to `public/psx-stocks.json`; Vite copies `public/` into `dist/`, so
Assets serves it. Keep the endpoint and back it with `env.ASSETS.fetch()` so the
frontend contract is unchanged. `better-sqlite3` then has no remaining production
caller, and `scripts/fetch-stocks.mjs` becomes a build-time-only tool.

### 5. Auth

Per `AUTH.md`, `VITE_PSX_API_TOKEN` is baked into the JS bundle at build time and
`apiFetch()` in `src/services/api-url.ts` sends it as a bearer header. Anyone who
loads the page can read that token out of devtools. Behind a private ngrok URL that
is obscure-but-contained; on a public Workers URL it is an open API.

Cloudflare Access replaces it with a real identity gate — Google/email login, free
up to 50 users, enforced at the edge before the Worker runs. Once it is enforcing:

- delete the `PSX_API_TOKEN` middleware (`index.mjs:36-42`)
- delete the `TOKEN` constant and header logic in `api-url.ts`
- drop `VITE_PSX_API_TOKEN` from the build
- rewrite `AUTH.md`

Do these **after** Access is verified working, not before — otherwise there is a
window where the app is deployed with no gate at all.

---

## Local development

`vite.config.ts` currently mounts the real Hono app as dev middleware via
`getRequestListener`, importing `server/api.mjs` directly — which pulls in
better-sqlite3 and both `.db` paths. After the migration this breaks, because the
routes need a D1 binding.

Two options:

1. **`@cloudflare/vite-plugin`** — runs the Worker in workerd inside Vite, with a
   local D1 (SQLite under `.wrangler/state/`). Highest fidelity; local behavior
   matches production including bindings and the `scheduled` handler.
2. **Keep the current middleware**, backed by the better-sqlite3 adapter from
   workstream 1. Less setup, but dev no longer exercises the real Worker runtime.

Option 1 is recommended precisely because the D1 async seam is where bugs will
hide.

---

## Limits worth knowing

### CPU and subrequest limits

- **CPU time** is 10 ms/invocation on free, 30 s on paid. This measures *compute*,
  not wall-clock — time blocked on `fetch` does not count. The scrapers are almost
  entirely I/O wait, so even the free tier is fine.
- **Subrequests** are capped at **50 per invocation on free**, 1000 on paid.
  `runDailySync()` issues one `fetchQuoteResilient()` per non-cash holding, each up
  to 2 attempts (`withRetry`) plus a sarmaaya fallback — worst case **3 subrequests
  per holding**, plus one for KSE100.

  Measured against the current portfolio: **2 non-cash holdings (PSO, SYS) → 7
  subrequests worst case**, against a ceiling of 50. Comfortably clear. The free
  tier only becomes a problem past ~16 holdings, at which point the options are the
  $5/mo Workers Paid plan or chunking the sync across several cron firings.

- **D1 storage** is far above what this needs — the database is ~100 KB.

### Cost

**Free tier covers this outright** — single user, ~100 KB database, one cron firing
per day, 7 subrequests against a ceiling of 50. No paid plan needed at current
scale. The realistic future trigger for the $5/mo Workers Paid plan is the
subrequest ceiling above, not storage or request volume.

---

## Runbook

### Step 0: egress probe (gate)

Everything downstream assumes `dps.psx.com.pk` and `sarmaaya.pk` serve Cloudflare
egress the same content they serve your VPS. They may geo-block or bot-block CF IPs.
This is verified *before* the migration, not after.

A throwaway probe Worker is already written in the session scratchpad under
`probe/`. It re-uses the exact anchors from the real parsers, so a pass means the
real scrapers pass. `wrangler dev` cannot answer this — local dev egresses from
your own IP. It must actually deploy.

```sh
cd <scratchpad>/probe
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy
curl -s https://psx-egress-probe.<subdomain>.workers.dev | jq .verdict
env -u CLOUDFLARE_API_TOKEN npx wrangler delete psx-egress-probe
```

Expected pass: `{"dpsQuote": true, "dpsEod": true, "sarmaaya": true}`. A
`challenged: true` in any result means Cloudflare-managed bot protection on the
upstream — the plan changes materially (a proxy hop or keeping the VPS for scraping).

> The `env -u CLOUDFLARE_API_TOKEN` prefix is deliberate: an unidentified
> `CLOUDFLARE_API_TOKEN` is present in the shell environment and overrides
> `wrangler login`. Dropping it per-command forces wrangler to use OAuth
> credentials.

### Step 1: create resources

```sh
env -u CLOUDFLARE_API_TOKEN npx wrangler d1 create psx-portfolio
# copy the returned database_id into wrangler.jsonc
```

### Step 2: `wrangler.jsonc`

```jsonc
{
  "name": "psx-portfolio",
  "main": "worker/index.mjs",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "psx-portfolio", "database_id": "<from step 1>" }
  ],
  "triggers": { "crons": ["59 18 * * *"] },
  "observability": { "enabled": true }
}
```

### Step 3: schema + data

```sh
env -u CLOUDFLARE_API_TOKEN npx wrangler d1 migrations apply psx-portfolio --remote

sqlite3 data/portfolio.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"   # see warning above
node scripts/export-to-d1.mjs > /tmp/seed.sql                      # to be written
env -u CLOUDFLARE_API_TOKEN npx wrangler d1 execute psx-portfolio --remote --file=/tmp/seed.sql
```

Verify before trusting it:

```sh
env -u CLOUDFLARE_API_TOKEN npx wrangler d1 execute psx-portfolio --remote \
  --command "SELECT (SELECT COUNT(*) FROM holdings) AS h, (SELECT COUNT(*) FROM transactions) AS t, (SELECT COUNT(*) FROM portfolio_history) AS ph"
```

Compare against the same query run locally against the checkpointed file.

### Step 4: deploy

```sh
npm run build
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy
```

### Step 5: Cloudflare Access

Zero Trust dashboard → Access → Applications → Self-hosted, pointed at the Worker
hostname. Policy: allow your email. Verify an incognito window gets the login
prompt, **then** strip the bearer token (workstream 5).

### Step 6: verify the cron

```sh
env -u CLOUDFLARE_API_TOKEN npx wrangler tail psx-portfolio
```

Confirm a `[psx:cron] synced:` line the following day. Note that `runDailySync()`
returns `{ran: false, reason: "outside-window"}` unless it is genuinely past
23:59 PKT, so a manual mid-day trigger is expected to no-op rather than fail.

---

## Rollback

The Docker path stays intact throughout — `Dockerfile`, `docker-compose.yml`, and
`deploy/Caddyfile` are untouched by this work. Rollback is repointing DNS/ngrok at
the VPS. The one-way door is *data*: once writes land in D1, the local
`portfolio.sqlite` starts drifting. Export D1 back to SQLite before abandoning the
Workers path.

---

## Open questions

1. **Egress** — Step 0 gates everything. Unanswered until wrangler is authed.
   This is the only open item that can change the plan.

Resolved during planning:

- ~~Holding count vs. the subrequest ceiling~~ — 2 non-cash holdings, 7 subrequests
  worst case. Free tier is fine.
- ~~Stale quote data~~ — both held tickers return current data
  (`PSO` and `SYS`, `asOf` today). The 19-month-stale reading seen on `ENGRO` during
  planning is a dead symbol, not a parser fault; ENGRO is not in the portfolio. No
  impact on the cron freshness gate.

---

## What changed during implementation

Recorded because each of these was discovered by testing rather than reasoning,
and the plan above still reads as originally written in places.

### The egress probe failed, and reshaped the source chain

`dps.psx.com.pk` is **not usable from Cloudflare Workers**. Its two dynamic
endpoints — `/timeseries/eod/KSE100` and `/company/<ticker>`, the only two used —
return `error code: 520` from CF egress, while its own homepage serves fine from
the same colo. Measured: 0/30 successes on the SIN colo, later failing on MCT
too. From the VPS: 0/12 failures. Retries do not help, because the failure is
per-colo rather than per-request, and a cron trigger cannot choose its colo.

Consequences:

- **Quotes** needed no change. `fetchQuoteResilient()` already falls back to
  sarmaaya, which is healthy from CF and parses correctly for the held tickers.
- **KSE100 had no fallback at all** and would simply have stopped working.
  `fetchKse100()` now falls back to the `www.psx.com.pk` home page, which
  server-renders the index table with stable ids (`curIndex`, `percentchange`,
  and a `cahnge` typo matched verbatim). `parsePsxIndexPage()` covers it.
- dps is deliberately kept as the *primary* in both chains. It fails fast (~700ms
  per 520, not a timeout) and costs 2 of the 50-subrequest budget, in exchange for
  resuming automatically if it ever recovers.

The fallback carries no `series`, unlike the dps timeseries. Nothing consumes it:
`/api/psx/benchmark?history` has no caller, and `fetchBenchmark()` reads only
`current`. Called out so a future series consumer is not surprised.

### The freshness gate would have silently stopped snapshotting

`quoteFreshness()` marks a quote stale unless `asOf >= 15:30 PKT`. That assumes a
per-trade timestamp, which is what dps reports. Sarmaaya instead reports a single
shared refresh stamp — observed **identical to the millisecond** across different
tickers. With dps unreachable, every nightly run would have classified all quotes
stale and skipped, visible only as history that quietly stopped growing.

`runDailySync()` now relaxes the gate when **every** quote came from a fallback
source, logs loudly which rule applied, and reports it as `freshnessRule` in the
result. `server/cron-sync.test.mjs` covers all branches.

**Known gap, deliberate:** a *mixed* run (one primary quote, one fallback) stays
strict. The shared-stamp justification does not apply when a trustworthy
timestamp is present. Given dps fails wholesale rather than per-ticker, mixed
runs should not occur — but if they did, that run would skip.

### Cloudflare Access turned out to be unavailable

Self-hosted Access applications attach to a hostname on a zone in the account;
`*.workers.dev` is not one, and there is no custom domain here. Replaced with a
password login and an HMAC-signed `HttpOnly` session cookie — see `AUTH.md` for
the full design, including why `PBKDF2_ITERATIONS` is 50,000 rather than the
recommended 210,000 (the free plan's 10ms CPU ceiling).

That CPU limit produced the migration's most misleading bug: the KDF was killed
mid-derivation, a catch-all turned the failure into `false`, and every correct
password came back as a plain 401. `verifyPassword()` now lets derivation
failures propagate so an outage reports 503 instead of impersonating a wrong
password, with a regression test that mocks `deriveBits` into failing.

### The Node path was kept, not deleted

The plan called for `server/index.mjs` to be replaced. It was ported instead,
onto the sqlite adapter — the rollback section promised the Docker path stays
runnable, and deleting the entry would have made that false. `Dockerfile`,
`docker-compose.yml` and `deploy/Caddyfile` are untouched.

### Build layout moved

`@cloudflare/vite-plugin` emits the client bundle to `dist/client` and a
deployable worker config to `dist/psx_portfolio/wrangler.json`. So:

- deploys run `wrangler deploy -c dist/psx_portfolio/wrangler.json` (`npm run cf:deploy`)
- `server/index.mjs` serves from `dist/client`
- `npm run build` cleans `dist/` first — stale artifacts from a previous build
  would otherwise be uploaded as live assets
- the plugin is skipped under Vitest, which rejects its Node externals

### Assets intercept navigation before the Worker

With `not_found_handling: "single-page-application"`, the asset layer handles
navigation-style requests before the Worker sees them. That is why SPA deep links
work, and also why `wrangler dev --test-scheduled`'s `/__scheduled` hook is
unreachable — it is swallowed by the SPA fallback. The scheduled path is covered
by `server/cron-sync.test.mjs` instead.

## Verification performed

| Check | Result |
|---|---|
| Full test suite | 270 passing, 20 files |
| D1 row parity vs. local SQLite | Exact across all 7 tables |
| Save → load round-trip through D1 | Byte-identical |
| SPA, deep link, static asset | 200 |
| API unauthenticated / bad cookie / forged cookie | 401 |
| Login wrong password | 401 |
| Login correct password → API → logout → API | 200 → 200 → 200 → 401 |
| Cookie flags | `HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` |
| Cron trigger registered | `schedule: 59 18 * * *` |

Still unverified, and only time can: **the first live cron firing at 23:59 PKT.**
Watch it with `npm run cf:tail` and expect a `[psx:cron] synced:` line reporting
`freshness=relaxed-fallback` while dps remains unreachable.
