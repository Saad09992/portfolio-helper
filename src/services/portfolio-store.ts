import { apiFetch } from "./api-url";
import { PERSISTENCE } from "../constants";
import { pushToast } from "../hooks/useToast";
import { pkDateOf } from "../portfolio/calendar";

export type PortfolioFile = {
  holdings?: unknown;
  cash?: unknown;
  targets?: unknown;
  investments?: unknown;
  /** v3+ — the per-stock transaction ledger */
  transactions?: unknown;
  /** v3+ — broker fee / tax rates */
  feeConfig?: unknown;
  history?: unknown;
  lastFetchedAt?: unknown;
  savedAt?: string;
};

type Snapshot = { date: string; [k: string]: unknown };

/**
 * The `savedAt` of the server copy this tab is working from.
 *
 * Sent with every save so the server can refuse a write built on a stale
 * bundle. Saves are whole-bundle full-replace: before this, a tab left open
 * across 23:59 would push its pre-cron copy back over the nightly snapshot.
 */
let baseSavedAt: string | null = null;

export async function loadPortfolioFromDisk(): Promise<PortfolioFile | null> {
  try {
    const res = await apiFetch("/api/portfolio/load");
    if (!res.ok) {
      pushToast(`Disk load failed: HTTP ${res.status}`, "warn");
      return null;
    }
    const data = (await res.json()) as PortfolioFile | null;
    baseSavedAt = data?.savedAt ?? null;
    return data ?? null;
  } catch (err) {
    pushToast(`Disk load failed: ${err instanceof Error ? err.message : String(err)}`, "warn");
    return null;
  }
}

/**
 * Union two history lists, one entry per PKT calendar date, keeping whichever
 * entry was recorded later for a date both sides have.
 *
 * Used to reconcile a conflict rather than picking a winner wholesale: the
 * server may hold nights this tab never saw (written by the cron), while the
 * tab may hold days the server lost. Dropping either side loses real data.
 */
export function mergeHistory(mine: unknown, theirs: unknown): Snapshot[] {
  const byDate = new Map<string, Snapshot>();
  const take = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const entry of list as Snapshot[]) {
      if (!entry || typeof entry.date !== "string") continue;
      const key = pkDateOf(entry.date);
      const existing = byDate.get(key);
      if (!existing || Date.parse(entry.date) >= Date.parse(existing.date)) {
        byDate.set(key, entry);
      }
    }
  };
  take(theirs);
  take(mine);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Newer of two ISO timestamps, tolerating nulls. */
function laterIso(a: unknown, b: unknown): unknown {
  const ta = typeof a === "string" ? Date.parse(a) : NaN;
  const tb = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta)) return Number.isFinite(tb) ? b : a;
  if (!Number.isFinite(tb)) return a;
  return ta >= tb ? a : b;
}

async function postBundle(body: PortfolioFile): Promise<Response> {
  return apiFetch("/api/portfolio/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(baseSavedAt ? { "X-PSX-Base-SavedAt": baseSavedAt } : {}),
    },
    body: JSON.stringify(body),
  });
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
      const savedAt = new Date().toISOString();
      let res = await postBundle({ ...body, savedAt });

      if (res.status === 409) {
        // Someone else wrote since this tab loaded — in practice the nightly
        // cron. Fold their history into ours, adopt the newer fetch stamp, and
        // retry once against the version they left behind.
        const conflict = (await res.json()) as {
          currentSavedAt?: string;
          bundle?: PortfolioFile | null;
        };
        const theirs = conflict.bundle ?? null;
        baseSavedAt = conflict.currentSavedAt ?? baseSavedAt;

        const merged: PortfolioFile = {
          ...body,
          history: mergeHistory(body.history, theirs?.history),
          lastFetchedAt: laterIso(body.lastFetchedAt, theirs?.lastFetchedAt),
          savedAt: new Date().toISOString(),
        };

        res = await postBundle(merged);
        if (res.ok) {
          baseSavedAt = merged.savedAt ?? null;
          pushToast("Merged changes saved by the nightly sync.", "info");
          return;
        }
        pushToast(
          "Save conflicted twice — reload the page to pick up the latest data.",
          "warn",
        );
        return;
      }

      if (!res.ok) {
        pushToast(`Disk save failed: HTTP ${res.status} (kept in browser)`, "warn");
        return;
      }
      baseSavedAt = savedAt;
    } catch (err) {
      pushToast(
        `Disk save failed: ${err instanceof Error ? err.message : String(err)} (kept in browser)`,
        "warn",
      );
    }
  }, debounceMs);
}
