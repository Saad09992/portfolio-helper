# API authentication & PSX upstream usage

This app exposes an HTTP server (`server/index.mjs`) that serves the built React
SPA and a small set of `/api/*` endpoints. When the server is reachable from the
public internet (e.g. via an ngrok or Caddy tunnel), the `/api/*` surface must be
gated with a bearer token — otherwise any URL guesser can read or overwrite
`portfolio.json` and burn upstream PSX bandwidth.

## How the token gate works

- The check is a simple HTTP header comparison on every `/api/*` request: the
  request must carry `Authorization: Bearer <token>` matching the server's
  `PSX_API_TOKEN` env var.
- The frontend sends that header automatically from `apiFetch` (see
  `src/services/api-url.ts`), reading the token at **build time** from
  `VITE_PSX_API_TOKEN`. There is no interactive login form — the token is
  baked into the built JS bundle.
- If `PSX_API_TOKEN` is unset on the server, the check is bypassed and the
  server logs:
  `[psx] PSX_API_TOKEN not set — /api/* is unauthenticated`
  This preserves the local-dev UX (no token required when running on
  `127.0.0.1` only).

> **Important**: server token (`PSX_API_TOKEN`) and frontend token
> (`VITE_PSX_API_TOKEN`) must match. The frontend token is baked at build time,
> so changing it requires a rebuild.

## Enabling the token (manual / dev)

```bash
# Pick any sufficiently random string and use it for both vars
export PSX_API_TOKEN=$(openssl rand -hex 32)
export VITE_PSX_API_TOKEN=$PSX_API_TOKEN

# Rebuild the frontend so the new token is baked into the bundle
npm run build

# Start the server with the token in its env
node server/index.mjs
```

Verify:

```bash
curl -i http://localhost:3000/api/portfolio/load
# → HTTP/1.1 401 Unauthorized

curl -i -H "Authorization: Bearer $PSX_API_TOKEN" \
     http://localhost:3000/api/portfolio/load
# → HTTP/1.1 200 OK
```

## Enabling via docker-compose

`docker-compose.yml` already passes `PSX_API_TOKEN` from the shell env in two
places: as a build ARG (so the frontend bundle gets the matching
`VITE_PSX_API_TOKEN`) and as a runtime env var on the container.

```bash
# One-shot
PSX_API_TOKEN=$(openssl rand -hex 32) docker compose up -d --build

# Or persist it in an .env file next to docker-compose.yml
echo "PSX_API_TOKEN=$(openssl rand -hex 32)" > .env
docker compose up -d --build
```

Rotating the token: regenerate, re-`up --build` (frontend must be rebuilt so
the new token is baked in).

## Disabling the token (local-only deployments)

Unset both env vars and rebuild:

```bash
unset PSX_API_TOKEN VITE_PSX_API_TOKEN
npm run build
node server/index.mjs    # → logs "PSX_API_TOKEN not set …"
```

The server will accept all `/api/*` requests. Only safe when `127.0.0.1:3000`
is not reachable from outside the host.

## Frontend behavior when the token is wrong / missing

There is no login UI. A wrong/missing token results in `401` on every API call.
Visible symptoms in the browser:

- "Disk load failed: HTTP 401" toast on page load.
- "Disk save failed: HTTP 401 (kept in browser)" toast on any state change.
- "Price refresh failed: API returned 401" toast when clicking Refresh.

If you want a real login prompt (HTTP Basic, or a login page), that's a
separate change — Caddy's `basicauth` directive is the simplest path; wire it
into `deploy/Caddyfile`.

---

## PSX upstream APIs in use

The server proxies two upstream data sources. Neither requires its own API key.

### `psxterminal.com` (live market data + dividends)

Called server-side only from `server/api.mjs`:

| Server route                  | Upstream call                                          | Defined at        |
| ----------------------------- | ------------------------------------------------------ | ----------------- |
| `GET /api/psx/market-data`    | `GET https://psxterminal.com/api/fundamentals/{ticker}`| `api.mjs:39`      |
| `GET /api/psx/dividends`      | `GET https://psxterminal.com/api/dividends/{ticker}`   | `api.mjs:58`      |

Behavior:

- Both routes accept `?tickers=A,B,C` and fan out one upstream request per
  ticker via `Promise.all` (no batching, no rate limiting).
- Both swallow upstream failures per-ticker (returning `null`, filtered out
  before the response) and `console.warn` the failure for ops visibility.
- Frontend callers: `fetchMarketData` and `fetchDividends` in
  `src/services/psx-scraper.ts`, used by the "Refresh prices" button in
  `App.tsx`.

### `dps.psx.com.pk` (official PSX market-watch HTML, offline scrape)

Used **only** by the offline script `scripts/fetch-stocks.mjs` (run via
`npm run fetch-stocks`). It scrapes the market-watch HTML page to populate
the local SQLite `stocks` + `sectors` tables.

| Script                  | Upstream call                                  | Defined at              |
| ----------------------- | ---------------------------------------------- | ----------------------- |
| `scripts/fetch-stocks`  | `GET https://dps.psx.com.pk/market-watch`      | `fetch-stocks.mjs:12`   |

Behavior:

- Regex-based HTML parser — fragile if PSX changes their markup.
- Runs on demand only (no cron). The server never calls this URL at request
  time; it only reads the resulting SQLite DB via the read-only
  `GET /api/psx/stocks` endpoint (`api.mjs` after the migrations refactor).

### Endpoints that do **not** touch any upstream

- `GET /api/portfolio/load` — reads `data/portfolio.json` from disk.
- `POST /api/portfolio/save` — writes `data/portfolio.json` (rotated through 5
  `.bak.N` generations, serialized through an in-process queue).
- `GET /api/psx/stocks` — reads from local SQLite, no network.
