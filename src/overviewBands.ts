// Which Overview bands are on screen, and what number each one wears.
//
// The Overview page is seven bands deep and every one of them is wanted — but
// not at the same time. Basic answers the daily question (where do I stand, how
// did I get here, what is moving, how is it distributed); Advanced adds the
// three diagnostic bands you go looking for rather than glance at.
//
// Pure on purpose: Vitest runs in node here with no jsdom, so the mode logic
// lives in a module that can be tested and the page stays a thin shell over it
// (same bargain as `routes.ts` and `table/tableView.ts`).

export type ViewMode = "basic" | "advanced";

/**
 * Basic is the default. Crowding is the problem this solves, so the fix should
 * be what a fresh browser shows — and the switch sits in the first band header,
 * so nothing is hidden without a way back.
 */
export const DEFAULT_VIEW_MODE: ViewMode = "basic";

export function isViewMode(value: unknown): value is ViewMode {
  return value === "basic" || value === "advanced";
}

/** Every band, in the order the page renders them. */
export const OVERVIEW_BANDS = [
  "position",
  "ledger",
  "history",
  "today",
  "allocation",
  "contribution",
  "risk",
] as const;

export type OverviewBandId = (typeof OVERVIEW_BANDS)[number];

/**
 * The bands Basic hides. Whole bands, never parts of one: the ledger band is an
 * equation, and showing some of its terms would read as arithmetic that does
 * not work.
 */
export const ADVANCED_ONLY_BANDS: readonly OverviewBandId[] = [
  "ledger",
  "contribution",
  "risk",
];

export function isBandVisible(id: OverviewBandId, mode: ViewMode): boolean {
  return mode === "advanced" || !ADVANCED_ONLY_BANDS.includes(id);
}

/** The bands on screen in this mode, in render order. */
export function visibleBands(mode: ViewMode): OverviewBandId[] {
  return OVERVIEW_BANDS.filter((id) => isBandVisible(id, mode));
}

/**
 * The kicker each band shows — "01".."07", counted over the bands that are
 * actually rendered. Without this Basic would read 01, 03, 04, 05 and the gaps
 * would look like breakage rather than a choice.
 *
 * Hidden bands map to "" so a stray render of one is visibly wrong rather than
 * silently mis-numbered.
 */
export function bandNumbers(mode: ViewMode): Record<OverviewBandId, string> {
  const numbers = {} as Record<OverviewBandId, string>;
  let shown = 0;
  for (const id of OVERVIEW_BANDS) {
    numbers[id] = isBandVisible(id, mode) ? String(++shown).padStart(2, "0") : "";
  }
  return numbers;
}
