// BASE_URL is Vite's build-time base (e.g. "/" or "/psx/"). Always ends with "/".
const BASE = import.meta.env.BASE_URL;

export function apiUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE}${trimmed}`;
}
