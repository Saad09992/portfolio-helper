// Money is stored and computed as integer paisa (minor units): 100 paisa = 1 Rs.
//
// Keeping money as integers makes `shares * price` and their sums EXACT — no
// float drift. This matters most for low-priced (penny) stocks where a fraction
// of a rupee per share, times a large share count, is real money.
//
// Convert ONLY at the boundaries:
//   - user input & scraped rupee prices → paisa via `rupeesToPaisa`
//   - display → `formatCurrency` / `formatCompactCurrency` (they divide by 100)
//   - chart value axes → divide series data by 100 (see `paisaToRupees`)
// Everything in between (state, props, compute, storage) stays in paisa.

/** Integer minor units. Documented alias — not branded, to keep arithmetic ergonomic. */
export type Paisa = number;

/** Rupees (possibly fractional, e.g. 4.92) → whole paisa (492). */
export function rupeesToPaisa(rupees: number): Paisa {
  return Math.round((Number.isFinite(rupees) ? rupees : 0) * 100);
}

/** Paisa (492) → rupees (4.92). For chart axes and non-Intl display. */
export function paisaToRupees(paisa: Paisa): number {
  return paisa / 100;
}

/** Round a derived paisa amount (e.g. ratio × total) back to whole paisa. */
export function roundPaisa(paisa: number): Paisa {
  return Math.round(Number.isFinite(paisa) ? paisa : 0);
}
