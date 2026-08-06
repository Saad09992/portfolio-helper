import { apiFetch } from "./api-url";

export type AuthState = "checking" | "authenticated" | "anonymous";

/** Ask the Worker whether the current session cookie is still valid. */
export async function checkAuth(): Promise<boolean> {
  try {
    const res = await apiFetch("/api/auth/me");
    return res.ok;
  } catch {
    return false;
  }
}

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec?: number };

export async function login(password: string): Promise<LoginResult> {
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) return { ok: true };

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      return {
        ok: false,
        error: "Too many attempts. Try again shortly.",
        retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : undefined,
      };
    }
    if (res.status === 503) {
      return { ok: false, error: "Server auth is not configured." };
    }
    return { ok: false, error: "Incorrect password." };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* logging out locally is what matters; the cookie expires regardless */
  }
}
