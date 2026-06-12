import { useMemo, useState } from "react";
import {
  ChartTooltip,
  buildCatmullRomPath,
  niceTicks,
  useChartHover,
} from "../../chartHelpers";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatSignedPercent,
} from "../../utils";

export type InvestmentChartRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  total: number;
  valueEom: number;
  pnlValue: number;
  pnlPct: number;
};

type InvestSeriesKey = "total" | "value";
const INVEST_SERIES_META: Record<
  InvestSeriesKey,
  { label: string; color: string }
> = {
  total: { label: "Capital deployed", color: "#5ea5ea" },
  value: { label: "Portfolio value", color: "#e4ecff" },
};

export function InvestmentChart({ rows }: { rows: InvestmentChartRow[] }) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<InvestSeriesKey>>(
    () => new Set(),
  );

  const W = 800;
  const H = 320;
  const padL = 78;
  const padR = 24;
  const padT = 24;
  const padB = 52;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const visibleKeys = useMemo<InvestSeriesKey[]>(
    () => (["total", "value"] as const).filter((k) => !hiddenSeries.has(k)),
    [hiddenSeries],
  );

  const chart = useMemo(() => {
    if (rows.length < 2) return null;

    const totals = rows.map((r) => r.total);
    const values = rows.map((r) => r.valueEom);

    const seriesByKey: Record<InvestSeriesKey, number[]> = {
      total: totals,
      value: values,
    };

    const visibleSeries = visibleKeys.flatMap((k) => seriesByKey[k]);
    const hi = Math.max(...visibleSeries, 0);
    const lo = Math.min(...visibleSeries, 0);
    const span = hi - lo || 1;
    const yHi = hi + span * 0.08;
    const yLo = Math.max(0, lo - span * 0.04);

    const xOf = (i: number) =>
      padL +
      (rows.length === 1
        ? innerW / 2
        : (i / (rows.length - 1)) * innerW);
    const yOf = (v: number) =>
      padT + innerH - ((v - yLo) / (yHi - yLo)) * innerH;

    let stepPath = `M ${xOf(0)} ${yOf(totals[0])}`;
    for (let i = 1; i < rows.length; i++) {
      stepPath += ` H ${xOf(i)} V ${yOf(totals[i])}`;
    }
    const stepArea = `${stepPath} L ${xOf(rows.length - 1)} ${yOf(yLo)} L ${xOf(0)} ${yOf(yLo)} Z`;

    const valuePoints = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
    const totalPoints = totals.map((v, i) => ({ x: xOf(i), y: yOf(v) }));

    const tickValues = niceTicks(yLo, yHi, 5);

    return {
      seriesByKey,
      valuePath: buildCatmullRomPath(valuePoints),
      stepPath,
      stepArea,
      valuePoints,
      totalPoints,
      tickValues,
      yOf,
      xOf,
    };
  }, [rows, visibleKeys, innerH, innerW]);

  const { containerRef, svgRef, hover, handlers } = useChartHover({
    pointCount: rows.length,
    plotLeft: padL,
    plotRight: padR,
    viewBoxWidth: W,
  });

  function toggleSeries(key: InvestSeriesKey) {
    setHiddenSeries((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (rows.length < 2 || !chart) {
    return (
      <div className="chart-empty">
        Add at least 2 investment entries to see chart.
      </div>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
  const hoveredIdx = hover?.index ?? null;
  const containerWidth = containerRef.current?.clientWidth ?? 600;

  return (
    <div ref={containerRef} className="line-chart">
      <div className="line-chart-legend">
        {(["total", "value"] as const).map((key) => {
          const meta = INVEST_SERIES_META[key];
          const hidden = hiddenSeries.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`line-chart-legend-item ${hidden ? "line-chart-legend-item--off" : ""}`}
              onClick={() => toggleSeries(key)}
              aria-pressed={!hidden}
            >
              <span
                className="line-chart-legend-swatch"
                style={{ background: meta.color, borderColor: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="line-chart-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="line-chart-svg"
          preserveAspectRatio="none"
          role="img"
          aria-label="Investment growth chart"
          {...handlers}
        >
          {chart.tickValues.map((v, i) => (
            <g key={`y-${i}`}>
              <line
                className="line-chart-grid"
                x1={padL}
                x2={W - padR}
                y1={chart.yOf(v)}
                y2={chart.yOf(v)}
              />
              <text
                className="line-chart-axis"
                x={padL - 10}
                y={chart.yOf(v) + 4}
                textAnchor="end"
              >
                {formatCompactCurrency(v)}
              </text>
            </g>
          ))}

          {visibleKeys.includes("total") ? (
            <>
              <path className="line-chart-step-fill" d={chart.stepArea} />
              <path
                className="line-chart-step"
                d={chart.stepPath}
                stroke={INVEST_SERIES_META.total.color}
              />
            </>
          ) : null}

          {visibleKeys.includes("value") ? (
            <path
              className="line-chart-line"
              d={chart.valuePath}
              stroke={INVEST_SERIES_META.value.color}
              strokeWidth={2.4}
            />
          ) : null}

          {rows.map((r, i) => {
            if (i % labelEvery !== 0 && i !== rows.length - 1) return null;
            return (
              <text
                key={`xl-${r.id}`}
                className="line-chart-axis"
                x={chart.xOf(i)}
                y={H - padB + 22}
                textAnchor="middle"
              >
                {formatDateShort(r.date)}
              </text>
            );
          })}

          {hoveredIdx !== null ? (
            <g pointerEvents="none">
              <line
                className="line-chart-crosshair"
                x1={chart.xOf(hoveredIdx)}
                x2={chart.xOf(hoveredIdx)}
                y1={padT}
                y2={H - padB}
              />
              {visibleKeys.includes("total") ? (
                <circle
                  className="line-chart-hover-dot"
                  cx={chart.totalPoints[hoveredIdx].x}
                  cy={chart.totalPoints[hoveredIdx].y}
                  r={5}
                  fill={INVEST_SERIES_META.total.color}
                />
              ) : null}
              {visibleKeys.includes("value") ? (
                <circle
                  className="line-chart-hover-dot"
                  cx={chart.valuePoints[hoveredIdx].x}
                  cy={chart.valuePoints[hoveredIdx].y}
                  r={5}
                  fill={INVEST_SERIES_META.value.color}
                />
              ) : null}
            </g>
          ) : null}
        </svg>

        {hoveredIdx !== null && hover ? (
          <ChartTooltip
            x={hover.containerX}
            y={hover.containerY}
            containerWidth={containerWidth}
            title={`${formatDateLong(rows[hoveredIdx].date)} · ${rows[hoveredIdx].label}`}
            rows={[
              {
                label: "Capital deployed",
                value: formatCurrency(rows[hoveredIdx].total),
                color: INVEST_SERIES_META.total.color,
              },
              {
                label: "Portfolio value",
                value: formatCurrency(rows[hoveredIdx].valueEom),
                color: INVEST_SERIES_META.value.color,
              },
              {
                label: "P&L",
                value: `${rows[hoveredIdx].pnlValue >= 0 ? "+" : ""}${formatCurrency(rows[hoveredIdx].pnlValue)} (${formatSignedPercent(rows[hoveredIdx].pnlPct, 2)})`,
              },
              {
                label: "Entry amount",
                value:
                  rows[hoveredIdx].amount === 0
                    ? "—"
                    : `${rows[hoveredIdx].amount > 0 ? "+" : ""}${formatCurrency(rows[hoveredIdx].amount)}`,
              },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}
