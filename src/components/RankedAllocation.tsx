import { formatCompactCurrency, formatPercent } from "../utils";
import { getSliceColor } from "./charts/palette";

export function RankedAllocation({
  items,
}: {
  items: { key: string; label: string; value: number; weight: number }[];
}) {
  if (items.length === 0) {
    return <div className="chart-empty">No data</div>;
  }
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const top = sorted[0]?.weight || 1;
  return (
    <div className="ranked-allocation">
      {sorted.map((item, i) => {
        const widthPct = (item.weight / top) * 100;
        return (
          <div className="ranked-row" key={item.key}>
            <span className="ranked-rank num">{i + 1}</span>
            <strong className="ranked-label">{item.label}</strong>
            <div className="ranked-track">
              <span
                className="ranked-fill"
                style={{
                  width: `${widthPct}%`,
                  background: getSliceColor(i),
                }}
              />
            </div>
            <span className="ranked-weight num">{formatPercent(item.weight)}</span>
            <span className="ranked-value num">{formatCompactCurrency(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
