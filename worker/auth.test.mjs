// Tests for the session gate. Node 22's global WebCrypto is the same API
// surface the Workers runtime exposes, so these exercise the real primitives.

import { describe, expect, it } from "vitest";
import {
  checkThrottle,
  clearFailures,
  createSession,
  hashPassword,
  readCookie,
  recordFailure,
  sessionCookie,
  clearCookie,
  verifyPassword,
  verifySession,
} from "./auth.mjs";
import { freshTestDb } from "../server/local-db.mjs";

// Keep iterations low so the suite stays fast — the production default is set
// in auth.mjs and is not what is under test here.
const FAST = 1000;

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("correct horse battery staple", FAST);
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple", FAST);
    expect(await verifyPassword("Correct horse battery staple", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const a = await hashPassword("same", FAST);
    const b = await hashPassword("same", FAST);
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("returns false rather than throwing on malformed stored hashes", async () => {
    for (const bad of ["", "garbage", "pbkdf2$", "bcrypt$1$a$b", "pbkdf2$abc$x$y", null]) {
      expect(await verifyPassword("pw", bad)).toBe(false);
    }
  });

  // Regression guard. A previous version caught every error and returned false,
  // so when the KDF exceeded the Worker CPU limit each correct password came
  // back as a plain "invalid password" with nothing logged. A failure to *check*
  // must be distinguishable from a failure to *match*.
  it("propagates derivation failures instead of reporting a mismatch", async () => {
    const realDeriveBits = crypto.subtle.deriveBits;
    crypto.subtle.deriveBits = () => Promise.reject(new Error("CPU limit exceeded"));
    try {
      const stored = "pbkdf2$50000$c2FsdHNhbHQ$aGFzaGhhc2g";
      await expect(verifyPassword("pw", stored)).rejects.toThrow(/CPU limit/);
    } finally {
      crypto.subtle.deriveBits = realDeriveBits;
    }
  });

  it("rejects a stored hash with an empty digest", async () => {
    expect(await verifyPassword("pw", "pbkdf2$50000$c2FsdA$")).toBe(false);
  });

  it("refuses an implausibly low iteration count", async () => {
    // A stored hash claiming 1 iteration would be trivially brute-forced; treat
    // it as corrupt rather than honouring it.
    expect(await verifyPassword("pw", "pbkdf2$1$c2FsdA$aGFzaA")).toBe(false);
  });
});

describe("session tokens", () => {
  const SECRET = "test-secret-value";

  it("round-trips a freshly minted session", async () => {
    const token = await createSession(SECRET);
    const payload = await verifySession(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSession(SECRET);
    expect(await verifySession(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createSession(SECRET);
    const [, sig] = token.split(".");
    // Forge a far-future expiry and keep the original signature.
    const forged = Buffer.from(JSON.stringify({ iat: 0, exp: 9e15 }))
      .toString("base64url");
    expect(await verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSession(SECRET, Date.now() - 40 * 24 * 60 * 60 * 1000);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("rejects structurally invalid input without throwing", async () => {
    for (const bad of [null, undefined, "", "no-dot", "a.b.c", "....", 42, {}]) {
      expect(await verifySession(bad, SECRET)).toBeNull();
    }
  });

  it("rejects a token whose signature is valid for a different payload", async () => {
    const a = await createSession(SECRET, 1000);
    const b = await createSession(SECRET, 2000);
    const [payloadA] = a.split(".");
    const [, sigB] = b.split(".");
    expect(await verifySession(`${payloadA}.${sigB}`, SECRET)).toBeNull();
  });
});

describe("cookies", () => {
  it("parses the session cookie out of a crowded header", () => {
    expect(readCookie("foo=1; psx_session=abc.def; bar=2")).toBe("abc.def");
  });

  it("returns null when absent or empty", () => {
    expect(readCookie("foo=1; bar=2")).toBeNull();
    expect(readCookie("")).toBeNull();
    expect(readCookie(null)).toBeNull();
  });

  it("does not confuse a cookie whose name merely ends with the target", () => {
    expect(readCookie("not_psx_session=nope")).toBeNull();
  });

  it("sets the flags that actually matter", () => {
    const c = sessionCookie("tok");
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Strict/);
  });

  it("expires the cookie on logout", () => {
    expect(clearCookie()).toMatch(/Max-Age=0/);
  });
});

describe("login throttle", () => {
  const IP = "203.0.113.9";

  it("starts unlocked with no prior record", async () => {
    const db = freshTestDb();
    expect(await checkThrottle(db, IP)).toMatchObject({ locked: false });
  });

  it("locks out after the failure threshold", async () => {
    const db = freshTestDb();
    let state = await checkThrottle(db, IP);
    let last;
    for (let i = 0; i < 5; i++) {
      last = await recordFailure(db, IP, state.row);
      state = await checkThrottle(db, IP);
    }
    expect(last.failures).toBe(5);
    expect(last.lockedUntil).not.toBeNull();
    expect((await checkThrottle(db, IP)).locked).toBe(true);
  });

  it("escalates the lockout on repeated trips", async () => {
    const db = freshTestDb();
    const now = Date.now();
    let row = null;
    let fifth;
    let sixth;
    for (let i = 0; i < 6; i++) {
      const r = await recordFailure(db, IP, row, now);
      if (i === 4) fifth = r.lockedUntil;
      if (i === 5) sixth = r.lockedUntil;
      row = (await checkThrottle(db, IP, now)).row ?? {
        failures: r.failures,
        window_start: now,
        locked_until: r.lockedUntil,
      };
    }
    expect(sixth - now).toBeGreaterThan(fifth - now);
  });

  it("resets the counter once the window has passed", async () => {
    const db = freshTestDb();
    const t0 = Date.now();
    await recordFailure(db, IP, null, t0);
    const stale = { failures: 4, window_start: t0, locked_until: null };
    const later = t0 + 16 * 60 * 1000; // past the 15-minute window
    const res = await recordFailure(db, IP, stale, later);
    expect(res.failures).toBe(1);
    expect(res.lockedUntil).toBeNull();
  });

  it("clears the record on a successful login", async () => {
    const db = freshTestDb();
    await recordFailure(db, IP, null);
    await clearFailures(db, IP);
    expect(await checkThrottle(db, IP)).toMatchObject({ locked: false, row: null });
  });

  // A transient D1 error while reading the counter once turned every login into
  // an HTTP 500. The throttle is defence-in-depth; it must never be the thing
  // that denies access when the password itself is correct.
  it("allows the attempt when the throttle store is unreadable", async () => {
    const broken = {
      first: () => Promise.reject(new Error("D1_ERROR: internal error; reference = abc")),
      run: () => Promise.reject(new Error("D1_ERROR: internal error; reference = abc")),
      all: () => Promise.reject(new Error("nope")),
      batch: () => Promise.reject(new Error("nope")),
    };

    const state = await checkThrottle(broken, "203.0.113.9");
    expect(state.locked).toBe(false);
    expect(state.degraded).toBe(true);
  });

  it("does not throw when the throttle store is unwritable", async () => {
    const broken = {
      first: () => Promise.resolve(null),
      run: () => Promise.reject(new Error("D1_ERROR: internal error")),
      all: () => Promise.resolve([]),
      batch: () => Promise.reject(new Error("nope")),
    };

    await expect(recordFailure(broken, "203.0.113.9", null)).resolves.toMatchObject({
      degraded: true,
    });
    await expect(clearFailures(broken, "203.0.113.9")).resolves.toBeUndefined();
  });

  it("tracks IPs independently", async () => {
    const db = freshTestDb();
    let row = null;
    for (let i = 0; i < 5; i++) {
      await recordFailure(db, IP, row);
      row = (await checkThrottle(db, IP)).row;
    }
    expect((await checkThrottle(db, IP)).locked).toBe(true);
    expect((await checkThrottle(db, "198.51.100.4")).locked).toBe(false);
  });
});
