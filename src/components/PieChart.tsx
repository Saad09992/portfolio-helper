import { useState } from "react";
import { formatCurrency, formatPercent } from "../utils";
import { getSliceColor } from "./charts/palette";

export function PieChart({
  holdings,
}: {
  holdings: { ticker: string; marketValue: number; weight: number }[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const pad = 12;
  const size = 280;
  const stroke = 32;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );
  let dashOffset = 0;

  if (totalValue === 0) {
    return <div className="chart-empty">No holdings yet</div>;
  }

  const hoveredHolding = hovered !== null ? holdings[hovered] : null;

  return (
    <div className="pie-layout">
      <div className="donut-container">
        <svg
          viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
          className="pie-chart"
          role="img"
          aria-label="Portfolio allocation chart"
          onMouseLeave={() => setHovered(null)}
        >
          <circle cx={size / 2} cy={size / 2} r={radius} className="pie-base" />
          {holdings.map((holding, index) => {
            const dashLength = holding.weight * circumference;
            const currentOffset = dashOffset;
            dashOffset += dashLength;
            const isHovered = hovered === index;
            const isDimmed = hovered !== null && !isHovered;
            return (
              <circle
                key={holding.ticker}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className={`pie-slice ${isHovered ? "pie-slice--active" : ""} ${isDimmed ? "pie-slice--dim" : ""}`}
                style={
                  {
                    strokeDasharray: `${dashLength} ${circumference - dashLength}`,
                    strokeDashoffset: -currentOffset,
                    ["--slice-color" as never]: getSliceColor(index),
                  } as React.CSSProperties
                }
                onMouseEnter={() => setHovered(index)}
              />
            );
          })}
        </svg>
        {hoveredHolding ? (
          <div className="donut-center">
            <strong>{hoveredHolding.ticker}</strong>
            <span className="num">{formatCurrency(hoveredHolding.marketValue)}</span>
            <small className="num">{formatPercent(hoveredHolding.weight)}</small>
          </div>
        ) : (
          <div className="donut-center">
            <strong>Total</strong>
            <span className="num">{formatCurrency(totalValue)}</span>
            <small className="num">{holdings.length} positions</small>
          </div>
        )}
      </div>

      <div className="pie-legend">
        {holdings.slice(0, 8).map((holding, index) => (
          <div
            key={holding.ticker}
            className={`legend-row ${hovered === index ? "legend-row--active" : ""} ${hovered !== null && hovered !== index ? "legend-row--dim" : ""}`}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="legend-swatch"
              style={{ background: getSliceColor(index) }}
            />
            <div>
              <strong>{holding.ticker}</strong>
              <span className="num">{formatPercent(holding.weight)} of portfolio</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
