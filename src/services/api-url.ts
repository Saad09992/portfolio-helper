// BASE_URL is Vite's build-time base (e.g. "/" or "/psx/"). Always ends with "/".
const BASE = import.meta.env.BASE_URL;

export function apiUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE}${trimmed}`;
}

/**
 * Fetch against the API with the session cookie attached.
 *
 * This previously sent a bearer token compiled into the bundle at build time,
 * which meant anyone who loaded the page could read it out of devtools. Auth is
 * now a HttpOnly session cookie the browser attaches automatically — the page
 * itself never holds a credential it could leak.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { ...init, credentials: "same-origin" });
}
