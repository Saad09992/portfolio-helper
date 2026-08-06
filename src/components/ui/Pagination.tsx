import { TABLE } from "../../constants";
import { ALL_ROWS } from "../../table/tableView";

/**
 * The window control for a paged table: which rows you're looking at, how to move,
 * and how many to show at once.
 *
 * There is deliberately no numbered page strip. 357 rows at 50 a page is 8 pages;
 * first/prev/next/last plus a monospace "1 / 8" does the same job with less DOM.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  from,
  to,
  total,
  onPage,
  onPageSize,
  label,
  /** Rows below which the whole control hides. Pass 0 to always show it. */
  minRows = TABLE.PAGER_MIN_ROWS,
  pageSizes = TABLE.PAGE_SIZES,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  /** Names the table, e.g. "Ledger" — becomes the nav's accessible name. */
  label: string;
  minRows?: number;
  pageSizes?: readonly number[];
}) {
  // Small tables show no chrome at all. This is also what keeps the existing
  // render-to-string smoke tests byte-identical: their fixtures are tiny.
  if (total <= minRows) return null;

  const atStart = page <= 1;
  const atEnd = page >= pageCount;
  const showing = total === 0 ? "No matching rows" : `Showing ${from}–${to} of ${total}`;

  return (
    <nav className="pager" aria-label={`${label} pagination`}>
      {/* The only feedback a screen-reader user gets when the window moves. */}
      <p className="pager-status num" aria-live="polite">
        {showing}
      </p>

      <div className="pager-nav">
        <PagerButton label="First page" glyph="«" disabled={atStart} onClick={() => onPage(1)} />
        <PagerButton
          label="Previous page"
          glyph="‹"
          disabled={atStart}
          onClick={() => onPage(page - 1)}
        />
        <span className="pager-page num">
          Page <strong>{page}</strong> / {pageCount}
        </span>
        <PagerButton
          label="Next page"
          glyph="›"
          disabled={atEnd}
          onClick={() => onPage(page + 1)}
        />
        <PagerButton
          label="Last page"
          glyph="»"
          disabled={atEnd}
          onClick={() => onPage(pageCount)}
        />
      </div>

      <label className="pager-size">
        Rows
        <select
          className="table-filter-select"
          value={String(pageSize)}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {pageSizes.map((size) => (
            <option key={size} value={String(size)}>
              {size === ALL_ROWS ? "All" : size}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}

/**
 * `aria-disabled` plus a click guard, NOT the `disabled` attribute.
 *
 * A `disabled` button is removed from the tab order, so the moment you page to the
 * last page the Next button you just clicked drops focus to `<body>` — and that is
 * the one interaction guaranteed to happen. This keeps focus where the user left
 * it. Please don't "clean this up" into `disabled`.
 */
function PagerButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="pager-btn"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
