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
    const res = await fetch("/api/portfolio/load");
    if (!res.ok) return null;
    const data = (await res.json()) as PortfolioFile | null;
    return data ?? null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: PortfolioFile | null = null;

export function savePortfolioToDisk(state: PortfolioFile, debounceMs = 500) {
  pending = state;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const body = pending;
    pending = null;
    if (!body) return;
    try {
      await fetch("/api/portfolio/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, savedAt: new Date().toISOString() }),
      });
    } catch {
      // ignore — localStorage still has it
    }
  }, debounceMs);
}
