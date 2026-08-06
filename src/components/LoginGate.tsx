import { useCallback, useEffect, useRef, useState } from "react";
import { checkAuth, login, type AuthState } from "../services/auth";

/**
 * Gates the app behind a password prompt.
 *
 * The session lives in an HttpOnly cookie, so this component never holds a
 * credential — it only knows whether the server currently accepts the cookie.
 * On a 401 anywhere in the app the user simply lands back here.
 */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    checkAuth().then((ok) => {
      if (!cancelled) setState(ok ? "authenticated" : "anonymous");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === "anonymous") inputRef.current?.focus();
  }, [state]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy || !password) return;
      setBusy(true);
      setError(null);

      const res = await login(password);
      setBusy(false);

      if (res.ok) {
        setPassword("");
        setState("authenticated");
      } else {
        setPassword("");
        setError(res.error);
        inputRef.current?.focus();
      }
    },
    [busy, password],
  );

  // Avoid flashing the login form while the session probe is still in flight.
  if (state === "checking") {
    return (
      <div className="login-shell">
        <p className="login-checking">Checking session…</p>
      </div>
    );
  }

  if (state === "authenticated") return <>{children}</>;

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">PSX Portfolio Tools</p>
        <h1>Sign in</h1>
        <p className="login-copy">This dashboard is private. Enter the password to continue.</p>

        <label className="sr-only" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          ref={inputRef}
          type="password"
          className="login-input"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button button-primary button-wide"
          disabled={busy || !password}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
