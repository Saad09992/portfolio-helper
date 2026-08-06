# API authentication

The app is deployed as a Cloudflare Worker at a public `*.workers.dev` URL, so
the `/api/*` surface has to be genuinely closed: `POST /api/portfolio/save`
replaces the entire portfolio bundle, and `/api/psx/*` burns upstream PSX
bandwidth.

## What this replaced, and why

Previously the gate was a bearer token compared against `PSX_API_TOKEN`, with the
matching `VITE_PSX_API_TOKEN` compiled into the JS bundle at build time. That
worked behind a private ngrok URL but does not survive being public: the token
shipped inside the bundle, so anyone who loaded the page could read it out of
devtools and call the API directly. It was, in effect, a public API with an
extra step.

**Cloudflare Access would be the better answer and is not available here.**
Self-hosted Access applications attach to a hostname on a zone in your account,
and `*.workers.dev` is not such a zone. Access becomes an option the moment a
custom domain is added — at which point this module can be deleted in favour of
it.

## How it works now

Password login in exchange for a signed session cookie. Implemented in
`worker/auth.mjs`, wired up in `worker/index.mjs`.

| Piece | Choice |
|---|---|
| Password storage | PBKDF2-HMAC-SHA256, random 16-byte salt, stored as `pbkdf2$<iterations>$<salt>$<hash>` |
| Session | `base64url(payload).HMAC-SHA256(payload, SESSION_SECRET)`, 30-day expiry |
| Cookie | `HttpOnly; Secure; SameSite=Strict; Path=/` |
| Comparison | Constant-time, on both the password digest and the session signature |
| Throttle | Per-IP (`CF-Connecting-IP`), 5 failures per 15 min, then a lockout doubling to a 1-hour cap |

`HttpOnly` keeps the session out of reach of any injected script — the page never
holds a credential it could leak, which is the specific failure of the old
scheme. `SameSite=Strict` is what stops a cross-site POST to `/api/portfolio/save`.

The gate **fails closed**: if `SESSION_SECRET` is unset the Worker returns 503 for
every API request rather than falling open. The old token gate did the opposite,
silently serving an unauthenticated API when the token was missing.

Cron invocations do not pass through the HTTP gate, so the nightly snapshot is
unaffected by any of this.

### About the iteration count

`PBKDF2_ITERATIONS` is **50,000**, not the 210,000 OWASP recommends. This is a
deliberate constraint, not an oversight: the Workers free plan allows 10ms of CPU
per invocation, and 210k iterations exceeds it — the derivation is killed
mid-flight. When that first happened it surfaced as every correct password being
rejected with a plain 401.

The trade is compensated on the password side. `scripts/hash-password.mjs`
enforces a minimum length, and the deployed password is 130 bits of randomness,
so offline attack is infeasible on entropy alone even at a reduced KDF cost.
**If this Worker ever moves to a paid plan (30s CPU), raise the constant back
toward 210,000** — it is a one-line change plus a re-hash.

## Setting or rotating the password

```sh
# Derive a hash. The plaintext is never written to disk and never given to
# wrangler — only the derived hash leaves this command.
node scripts/hash-password.mjs
# → pbkdf2$50000$<salt>$<hash>

npx wrangler secret put APP_PASSWORD_HASH   # paste the hash
```

The session secret is independent and only needs setting once:

```sh
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

Rotating `SESSION_SECRET` invalidates every existing session immediately, which
is the fastest way to force a logout everywhere.

## Verifying

```sh
BASE=https://psx-portfolio.saadofficial0999.workers.dev

curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/portfolio/load          # 401
curl -s -c jar -X POST -H 'Content-Type: application/json' \
     -d '{"password":"<password>"}' $BASE/api/auth/login                    # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' -b jar $BASE/api/portfolio/load    # 200
curl -s -X POST -b jar -c jar $BASE/api/auth/logout                         # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' -b jar $BASE/api/portfolio/load    # 401
```

The SPA itself stays publicly readable — only `/api/*` is gated. The login screen
(`src/components/LoginGate.tsx`) renders until `/api/auth/me` reports a valid
session.

## Known limitations

- **The throttle is best-effort.** Without Durable Objects there is no
  strongly-consistent counter, so concurrent attempts can race and let an extra
  try through. Acceptable when each guess must still beat PBKDF2 against a
  130-bit password; worth revisiting if this ever becomes multi-user.
- **Single shared password, no user accounts.** This is a single-user dashboard;
  anything more would be building an identity system where a password suffices.
- **No password reset flow.** Rotation is the `wrangler secret put` above.

## Running on Node

`server/index.mjs` (the Docker/VPS rollback path) still uses the original
`PSX_API_TOKEN` bearer check. That path is not internet-facing — it exists so the
deployment can be rolled back — and the token gate is adequate behind a private
tunnel. If it is ever exposed publicly again, port the cookie gate to it first.
