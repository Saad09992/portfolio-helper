// BASE_URL is Vite's build-time base (e.g. "/" or "/psx/"). Always ends with "/".
const BASE = import.meta.env.BASE_URL;
const TOKEN = (import.meta.env.VITE_PSX_API_TOKEN ?? "").trim();

export function apiUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE}${trimmed}`;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (TOKEN && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${TOKEN}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
