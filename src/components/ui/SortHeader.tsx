import type { SortState } from "../../uiTypes";

/**
 * A sortable column header.
 *
 * Generic over the key type so every table can use it — it started out hard-typed
 * to the Holdings columns, which is why the Targets page grew its own copy of the
 * same markup. Inference resolves `K` from `sortKey`, `sort` and `onClick`
 * together, so existing call sites need no annotation.
 *
 * The class names are load-bearing: `th.sortable`, `.sort-btn` and `.sort-arrow`
 * are styled in `styles.css`, so keep the structure even if the internals change.
 */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onClick,
  align,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onClick: (k: K) => void;
  align?: "right";
}) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      className={align === "right" ? "right sortable" : "sortable"}
      // Screen readers get the sort state from the header itself; the arrow is
      // decorative and inside the button, where it would be read as text.
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="sort-btn"
        onClick={() => onClick(sortKey)}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {arrow}
        </span>
      </button>
    </th>
  );
}
