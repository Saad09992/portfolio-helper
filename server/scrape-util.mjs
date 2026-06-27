export const FETCH_TIMEOUT_MS = 8000;

// fetch() with an AbortController timeout so a hung upstream can't stall the
// whole refresh (and so the fallback source gets a chance to run promptly).
export async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Run `fn`, retrying once when it throws or returns null/undefined.
// Used for the PRIMARY source only — the fallback gets a single attempt.
export async function withRetry(fn, attempts = 2) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (result !== null && result !== undefined) return result;
      last = result;
    } catch (err) {
      last = null;
      if (i === attempts - 1) {
        console.warn(
          `[psx] retry exhausted:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
  return last;
}
