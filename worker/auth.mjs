// Password login + signed session cookie for the Workers deployment.
//
// Cloudflare Access would have been the right answer here, but self-hosted
// Access applications attach to a hostname on a zone in the account, and
// *.workers.dev is not such a zone. This is the fallback, built from WebCrypto
// primitives that ship with the runtime.
//
// Threat model: a single-user app on a public URL. The realistic attacks are
// drive-by scanning and online password guessing, both of which this addresses.
// It is not a general-purpose identity system.

const COOKIE_NAME = "psx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_KEY_BITS = 256;

// OWASP recommends 210,000 iterations for PBKDF2-HMAC-SHA256. That does not fit
// here: the Workers free plan allows 10ms of CPU per invocation, and 210k
// iterations blows through it — the derivation is killed mid-flight, which
// surfaced as "wrong password" for every correct password. Measured on this
// deployment, 50k fits with headroom.
//
// The shortfall is compensated on the other side of the trade: the password is
// required to be long and randomly generated (see scripts/hash-password.mjs),
// so its own entropy — not the KDF cost — is what makes offline attack
// infeasible if the hash ever leaked. Raise this toward 210k if the Worker is
// ever moved to a paid plan, where the CPU ceiling is 30s.
const PBKDF2_ITERATIONS = 50_000;

// Throttle: 5 failures per 15-minute window, then a lockout that doubles each
// time it trips, capped at an hour.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const BASE_LOCKOUT_MS = 60 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;

const enc = new TextEncoder();

/* ---------- encoding helpers ---------- */

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Length-independent constant-time comparison.
 *
 * A plain `a === b` on a signature returns as soon as it finds a differing
 * byte, and the time it takes leaks how many leading bytes were correct —
 * enough to forge a signature one byte at a time. This always inspects every
 * byte of `a`.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------- password hashing ---------- */

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    PBKDF2_KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** Produce a storable hash string: pbkdf2$<iterations>$<salt>$<hash>. */
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`;
}

/**
 * Verify a password against a stored hash string.
 *
 * Returns false for a genuine mismatch or a malformed stored hash. Throws if
 * the derivation itself fails — deliberately.
 *
 * An earlier version caught everything and returned false. That turned an
 * operational failure into a silent "wrong password": when the KDF exceeded the
 * Worker CPU limit, every correct password was rejected with a plain 401 and
 * nothing in the logs to explain it. Distinguishing "did not match" from "could
 * not check" is what makes that failure visible instead of baffling.
 */
export async function verifyPassword(password, stored) {
  const [scheme, iterStr, saltStr, hashStr] = String(stored).split("$");
  if (scheme !== "pbkdf2" || !saltStr || !hashStr) return false;

  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;

  let expected;
  let salt;
  try {
    expected = b64urlDecode(hashStr);
    salt = b64urlDecode(saltStr);
  } catch {
    return false; // corrupt encoding is a bad stored hash, not an outage
  }
  if (expected.length === 0) return false;

  // Not wrapped: a failure here means the runtime could not complete the
  // derivation, which must surface as a 5xx rather than a login rejection.
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/* ---------- session cookie ---------- */

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(payloadB64, secret) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payloadB64));
  return b64urlEncode(sig);
}

/** Mint a signed session token valid for SESSION_TTL_MS. */
export async function createSession(secret, now = Date.now()) {
  const payload = { iat: now, exp: now + SESSION_TTL_MS };
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  return `${payloadB64}.${await sign(payloadB64, secret)}`;
}

/** Validate a session token. Returns the payload, or null if unusable. */
export async function verifySession(token, secret, now = Date.now()) {
  try {
    if (typeof token !== "string") return null;
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;

    // Verify the signature BEFORE parsing the payload — the payload is
    // attacker-supplied until the HMAC says otherwise.
    const expected = b64urlDecode(await sign(payloadB64, secret));
    if (!timingSafeEqual(b64urlDecode(sigB64), expected)) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (typeof payload?.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- cookie plumbing ---------- */

export function readCookie(header, name = COOKIE_NAME) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

// HttpOnly keeps it out of reach of any injected script; Secure prevents it
// ever crossing plaintext; SameSite=Strict means it is not attached to
// cross-site requests, which is what stops CSRF against the save endpoint.
export function sessionCookie(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/* ---------- login throttle ---------- */

/**
 * Best-effort per-IP throttle backed by D1.
 *
 * Without Durable Objects there is no strongly-consistent counter, so
 * concurrent attempts can race and slip an extra try through. That is an
 * acceptable margin against online guessing when each guess must still beat
 * PBKDF2; it is documented rather than papered over.
 */
export async function checkThrottle(db, ip, now = Date.now()) {
  const row = await db.first(
    "SELECT failures, window_start, locked_until FROM login_attempts WHERE ip = ?",
    [ip],
  );
  if (row?.locked_until && row.locked_until > now) {
    return { locked: true, retryAfterMs: row.locked_until - now };
  }
  return { locked: false, row: row ?? null };
}

export async function recordFailure(db, ip, row, now = Date.now()) {
  const inWindow = row && now - row.window_start < THROTTLE_WINDOW_MS;
  const failures = inWindow ? row.failures + 1 : 1;
  const windowStart = inWindow ? row.window_start : now;

  let lockedUntil = null;
  if (failures >= MAX_FAILURES) {
    const overage = failures - MAX_FAILURES;
    lockedUntil = now + Math.min(BASE_LOCKOUT_MS * 2 ** overage, MAX_LOCKOUT_MS);
  }

  await db.run(
    `INSERT INTO login_attempts (ip, failures, window_start, locked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET failures = ?, window_start = ?, locked_until = ?`,
    [ip, failures, windowStart, lockedUntil, failures, windowStart, lockedUntil],
  );

  return { failures, lockedUntil };
}

export async function clearFailures(db, ip) {
  await db.run("DELETE FROM login_attempts WHERE ip = ?", [ip]);
}
