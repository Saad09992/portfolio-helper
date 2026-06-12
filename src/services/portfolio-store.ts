import { apiFetch } from "./api-url";
import { PERSISTENCE } from "../constants";
import { pushToast } from "../hooks/useToast";

export type PortfolioFile = {
  holdings?: unknown;
  cash?: unknown;
  targets?: unknown;
  investments?: unknown;
  history?: unknown;
  lastFetchedAt?: unknown;
  savedAt?: string;
};

export async function loadPortfolioFromDisk(): Promise<PortfolioFile | null> {
  try {
    const res = await apiFetch("/api/portfolio/load");
    if (!res.ok) {
      pushToast(`Disk load failed: HTTP ${res.status}`, "warn");
      return null;
    }
    const data = (await res.json()) as PortfolioFile | null;
    return data ?? null;
  } catch (err) {
    pushToast(`Disk load failed: ${err instanceof Error ? err.message : String(err)}`, "warn");
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: PortfolioFile | null = null;

export function savePortfolioToDisk(state: PortfolioFile, debounceMs = PERSISTENCE.SAVE_DEBOUNCE_MS) {
  pending = state;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const body = pending;
    pending = null;
    if (!body) return;
    try {
      const res = await apiFetch("/api/portfolio/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, savedAt: new Date().toISOString() }),
      });
      if (!res.ok) {
        pushToast(`Disk save failed: HTTP ${res.status} (kept in browser)`, "warn");
      }
    } catch (err) {
      pushToast(
        `Disk save failed: ${err instanceof Error ? err.message : String(err)} (kept in browser)`,
        "warn",
      );
    }
  }, debounceMs);
}
