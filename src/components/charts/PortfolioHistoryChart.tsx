import { useMemo, useState } from "react";
import {
  ChartTooltip,
  buildCatmullRomPath,
  niceTicks,
  useChartHover,
} from "../../chartHelpers";
import {
  computeTwrIndex,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatRelativeTime,
  formatSignedPercent,
  type PortfolioSnapshot,
} from "../../utils";

type HistorySeriesKey = "value" | "cost" | "twr";

const HISTORY_SERIES_META: Record<
  HistorySeriesKey,
  { label: string; color: string; dashed?: boolean }
> = {
  value: { label: "Market value", color: "#e6edf3" },
  cost: { label: "Cost basis", color: "#ffb300", dashed: true },
  twr: { label: "True return (TWR)", color: "#00e676" },
};

export function PortfolioHistoryChart({
  snapshots,
  lastFetchedIso,
}: {
  snapshots: PortfolioSnapshot[];
  lastFetchedIso?: string | null;
}) {
  const [viewMode, setViewMode] = useState<"value" | "twr">("value");
  const [hiddenSeries, setHiddenSeries] = useState<Set<HistorySeriesKey>>(
    () => new Set(),
  );

  const twrIndex = useMemo(() => computeTwrIndex(snapshots), [snapshots]);

  const W = 800;
  const H = 300;
  const padL = 78;
  const padR = 24;
  const padT = 24;
  const padB = 48;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const visibleKeys = useMemo<HistorySeriesKey[]>(() => {
    const keys: HistorySeriesKey[] =
      viewMode === "value" ? ["value", "cost"] : ["twr"];
    return keys.filter((k) => !hiddenSeries.has(k));
  }, [viewMode, hiddenSeries]);

  const chart = useMemo(() => {
    if (snapshots.length < 2) return null;

    const values = snapshots.map((s) => s.totalValue);
    const costs = snapshots.map((s) => s.totalCost);

    const seriesByKey: Record<HistorySeriesKey, number[]> = {
      value: values,
      cost: costs,
      twr: twrIndex.map((v) => v - 100),
    };

    const allVisible = visibleKeys.flatMap((k) => seriesByKey[k]);
    const hi = Math.max(...allVisible);
    const lo = Math.min(...allVisible, viewMode === "twr" ? 0 : hi);
    const span = hi - lo || 1;
    const yHi = hi + span * 0.08;
    const yLo = viewMode === "twr" ? lo - span * 0.08 : Math.max(0, lo - span * 0.08);

    const xOf = (i: number) =>
      padL +
      (snapshots.length === 1
        ? innerW / 2
        : (i / (snapshots.length - 1)) * innerW);
    const yOf = (v: number) =>
      padT + innerH - ((v - yLo) / (yHi - yLo)) * innerH;

    const pointsByKey: Record<HistorySeriesKey, { x: number; y: number }[]> = {
      value: values.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
      cost: costs.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
      twr: seriesByKey.twr.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
    };

    const tickValues = niceTicks(yLo, yHi, 5);

    return {
      seriesByKey,
      pointsByKey,
      yLo,
      yHi,
      xOf,
      yOf,
      tickValues,
    };
  }, [snapshots, twrIndex, visibleKeys, viewMode, innerH, innerW]);

  const { containerRef, svgRef, hover, handlers } = useChartHover({
    pointCount: snapshots.length,
    plotLeft: padL,
    plotRight: padR,
    viewBoxWidth: W,
  });

  const containerWidth = containerRef.current?.clientWidth ?? 600;

  function toggleSeries(key: HistorySeriesKey) {
    setHiddenSeries((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (snapshots.length < 2 || !chart) {
    return (
      <div className="chart-empty">
        Refresh prices after PSX close (15:30 PKT) on 2+ weekdays to chart value over time.
      </div>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(snapshots.length / 6));
  const formatY = (v: number): string =>
    viewMode === "twr" ? formatSignedPercent(v, 1) : formatCompactCurrency(v);

  const hoveredIdx = hover?.index ?? null;
  const lastSnap = snapshots[snapshots.length - 1];
  const unrealizedPnl = lastSnap.totalValue - lastSnap.totalCost;
  const unrealizedPnlPct =
    lastSnap.totalCost > 0 ? (unrealizedPnl / lastSnap.totalCost) * 100 : 0;
  const twrCumulative = twrIndex[twrIndex.length - 1] - 100;

  return (
    <div
      ref={containerRef}
      className="line-chart"
      data-view-mode={viewMode}
    >
      <div className="line-chart-header">
        <div className="line-chart-summary">
          {viewMode === "value" ? (
            <>
              <strong>{formatCurrency(lastSnap.totalValue)}</strong>
              <span
                className={unrealizedPnl >= 0 ? "positive" : "negative"}
                title="Unrealized P&L on current snapshot (cost-basis adjusted, deposit-neutral)"
              >
                {unrealizedPnl >= 0 ? "+" : ""}
                {formatCurrency(unrealizedPnl)} ({formatSignedPercent(unrealizedPnlPct, 2)})
              </span>
            </>
          ) : (
            <>
              <strong className={twrCumulative >= 0 ? "positive" : "negative"}>
                {formatSignedPercent(twrCumulative, 2)}
              </strong>
              <span className="muted">deposit-neutral return over {snapshots.length} snapshots</span>
            </>
          )}
        </div>
        <div className="line-chart-controls">
          {lastFetchedIso ? (
            <span
              className="line-chart-stale"
              title={formatDateLong(lastFetchedIso)}
            >
              Updated {formatRelativeTime(lastFetchedIso)}
            </span>
          ) : null}
          <div className="chip-group">
            <button
              type="button"
              className={`chip ${viewMode === "value" ? "chip--active" : ""}`}
              onClick={() => setViewMode("value")}
            >
              Value
            </button>
            <button
              type="button"
              className={`chip ${viewMode === "twr" ? "chip--active" : ""}`}
              onClick={() => setViewMode("twr")}
            >
              True return %
            </button>
          </div>
        </div>
      </div>

      <div className="line-chart-legend">
        {(viewMode === "value"
          ? (["value", "cost"] as const)
          : (["twr"] as const)
        ).map((key) => {
          const meta = HISTORY_SERIES_META[key];
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
                style={{
                  background: meta.dashed ? "transparent" : meta.color,
                  borderColor: meta.color,
                  borderStyle: meta.dashed ? "dashed" : "solid",
                }}
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
          aria-label="Portfolio history line chart"
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
                {formatY(v)}
              </text>
            </g>
          ))}

          {viewMode === "twr" ? (
            <line
              className="line-chart-zero"
              x1={padL}
              x2={W - padR}
              y1={chart.yOf(0)}
              y2={chart.yOf(0)}
            />
          ) : null}

          {visibleKeys.includes("value") && viewMode === "value" ? (
            <path
              className="line-chart-area"
              d={`${buildCatmullRomPath(chart.pointsByKey.value)} L ${chart.pointsByKey.value[chart.pointsByKey.value.length - 1].x} ${chart.yOf(chart.yLo)} L ${chart.pointsByKey.value[0].x} ${chart.yOf(chart.yLo)} Z`}
            />
          ) : null}

          {visibleKeys.map((key) => {
            const meta = HISTORY_SERIES_META[key];
            const pts = chart.pointsByKey[key];
            return (
              <path
                key={`line-${key}`}
                className="line-chart-line"
                d={buildCatmullRomPath(pts)}
                stroke={meta.color}
                strokeDasharray={meta.dashed ? "4 4" : undefined}
                strokeWidth={key === "value" || key === "twr" ? 2.4 : 1.6}
              />
            );
          })}

          {snapshots.map((s, i) => {
            if (i % labelEvery !== 0 && i !== snapshots.length - 1) return null;
            return (
              <text
                key={`xl-${i}`}
                className="line-chart-axis"
                x={chart.xOf(i)}
                y={H - padB + 22}
                textAnchor="middle"
              >
                {formatDateShort(s.date)}
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
              {visibleKeys.map((key) => {
                const meta = HISTORY_SERIES_META[key];
                const p = chart.pointsByKey[key][hoveredIdx];
                return (
                  <circle
                    key={`hd-${key}`}
                    className="line-chart-hover-dot"
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={meta.color}
                  />
                );
              })}
            </g>
          ) : null}
        </svg>

        {hoveredIdx !== null && hover ? (
          <ChartTooltip
            x={hover.containerX}
            y={hover.containerY}
            containerWidth={containerWidth}
            title={formatDateLong(snapshots[hoveredIdx].date)}
            rows={(viewMode === "value"
              ? ([
                  {
                    label: "Market value",
                    value: formatCurrency(snapshots[hoveredIdx].totalValue),
                    color: HISTORY_SERIES_META.value.color,
                  },
                  {
                    label: "Cost basis",
                    value: formatCurrency(snapshots[hoveredIdx].totalCost),
                    color: HISTORY_SERIES_META.cost.color,
                  },
                  {
                    label: "Unrealized P&L",
                    value: formatCurrency(snapshots[hoveredIdx].gainLoss),
                  },
                ] as const)
              : ([
                  {
                    label: "TWR cumulative",
                    value: formatSignedPercent(
                      chart.seriesByKey.twr[hoveredIdx],
                      2,
                    ),
                    color: HISTORY_SERIES_META.twr.color,
                  },
                  {
                    label: "Market value",
                    value: formatCurrency(snapshots[hoveredIdx].totalValue),
                  },
                  {
                    label: "Cost basis",
                    value: formatCurrency(snapshots[hoveredIdx].totalCost),
                  },
                ] as const)
            ).map((r) => ({ ...r }))}
          />
        ) : null}
      </div>
    </div>
  );
}
