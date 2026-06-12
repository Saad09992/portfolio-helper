import { formatCurrency, formatPercent } from "../../utils";
import { getSliceColor } from "./palette";

export function Treemap({
  items,
}: {
  items: { key: string; label: string; value: number; weight: number }[];
}) {
  if (items.length === 0) {
    return <div className="chart-empty">No data</div>;
  }

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);

  // Squarified layout: split into rows, aiming for aspect ratios close to 1
  const rows: typeof items[] = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    let best = 1;
    let bestRatio = Infinity;

    for (let count = 1; count <= remaining.length; count++) {
      const slice = remaining.slice(0, count);
      const sliceWeight = slice.reduce((s, i) => s + i.weight, 0);
      const rowFraction = sliceWeight / totalWeight;
      const worstRatio = Math.max(
        ...slice.map((i) => {
          const w = i.weight / sliceWeight;
          const aspect = rowFraction > 0 ? (w / rowFraction) : 1;
          return Math.max(aspect, 1 / (aspect || 1));
        }),
      );
      if (worstRatio <= bestRatio) {
        bestRatio = worstRatio;
        best = count;
      } else {
        break;
      }
    }

    rows.push(remaining.slice(0, best));
    remaining = remaining.slice(best);
  }

  let colorIdx = 0;

  return (
    <div className="treemap-container">
      <div className="treemap-grid">
        {rows.map((row, ri) => {
          const rowWeight = row.reduce((s, r) => s + r.weight, 0);
          return (
            <div
              key={ri}
              className="treemap-row"
              style={{ flexGrow: rowWeight, flexShrink: 1, flexBasis: 0 }}
            >
              {row.map((item) => {
                const ci = colorIdx++;
                const widthPct = (item.weight / rowWeight) * 100;
                return (
                  <div
                    key={item.key}
                    className="treemap-block"
                    style={
                      {
                        "--tree-color": getSliceColor(ci),
                        width: `${widthPct}%`,
                      } as React.CSSProperties
                    }
                    title={`${item.label}: ${formatCurrency(item.value)} (${formatPercent(item.weight)})`}
                  >
                    <strong>{item.label}</strong>
                    <span>{formatPercent(item.weight)}</span>
                    <small>{formatCurrency(item.value)}</small>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
