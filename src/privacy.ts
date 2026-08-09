// Hidden mode: rupee figures are masked, everything else stays legible.
//
// The point is a screen someone else can look at. Percentages, weights, share
// counts, tickers and every chart shape survive — you can still see that you
// are up 8.4% and which position is the largest, just not how much money is in
// the pot. That is a deliberately weaker guarantee than "blur everything", and
// it is the one that leaves the page usable.
//
// Why a module store rather than a prop: money is rendered from 150-odd call
// sites across every page, all of them going through `formatCurrency` or
// `formatCompactCurrency`. Threading a flag to each one would be a large,
// permanently-maintained refactor with a leak everywhere it was forgotten —
// including ECharts tooltip callbacks, which have no React context to read.
// Masking inside the two formatters covers all of them at once and cannot be
// forgotten by a future call site. The same shape as `hooks/useToast.ts`.
//
// The clipboard is NOT masked — see `portfolio/summary.ts`, which imports the
// raw formatters on purpose.

import { useSyncExternalStore } from "react";

/** What a masked figure reads as. Keeps the "Rs" so the units stay obvious. */
export const MONEY_MASK = "Rs ••••••";
/** Shorter mask for the compact formatter, which lives in tighter spaces. */
export const COMPACT_MONEY_MASK = "Rs ••••";

let hidden = false;
const listeners = new Set<() => void>();

export function isMoneyHidden(): boolean {
  return hidden;
}

export function setMoneyHidden(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * For the few places that need to *re-render* when the mode flips rather than
 * just format differently on the next render they were having anyway — the two
 * lightweight-charts price scales, whose axis labels are drawn imperatively.
 */
export function useMoneyHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    isMoneyHidden,
    // Server render is always visible: nothing is being shoulder-surfed there,
    // and a masked first paint would hydrate into a mismatch.
    () => false,
  );
}
