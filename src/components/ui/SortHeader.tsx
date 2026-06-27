import type { HoldingsSortKey, HoldingsSortState } from "../../uiTypes";

export function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  align,
}: {
  label: string;
  sortKey: HoldingsSortKey;
  sort: HoldingsSortState;
  onClick: (k: HoldingsSortKey) => void;
  align?: "right";
}) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th className={align === "right" ? "right sortable" : "sortable"}>
      <button type="button" className="sort-btn" onClick={() => onClick(sortKey)}>
        {label}
        <span className="sort-arrow">{arrow}</span>
      </button>
    </th>
  );
}
