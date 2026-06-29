import { useCallback, useMemo, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";
import { getSliceColor } from "./palette";
import { formatPercent } from "../../utils";
import type { TargetRow } from "../../derivedTypes";

/**
 * Dual-ring allocation donut: inner ring = current weights, outer ring = target
 * weights. Same slice color per key across both rings so drift reads as a ring
 * mismatch. An "Untargeted" slice fills the remainder (cash / unmodeled book).
 */
export function TargetDonut({
  rows,
  mode,
}: {
  rows: TargetRow[];
  mode: "sector" | "ticker";
}) {
  const data = useMemo(
    () => rows.filter((r) => r.mode === mode),
    [rows, mode],
  );

  // Cross-highlight: hovering one ring (or a legend row) lights the same key in
  // BOTH rings. `highlight`/`downplay` by name span every series.
  const chartRef = useRef<ECharts | null>(null);
  const handleInit = useCallback((chart: ECharts) => {
    chartRef.current = chart;
    chart.on("mouseover", { seriesType: "pie" }, (p: { name: string }) => {
      chart.dispatchAction({ type: "highlight", name: p.name });
    });
    chart.on("mouseout", { seriesType: "pie" }, (p: { name: string }) => {
      chart.dispatchAction({ type: "downplay", name: p.name });
    });
  }, []);
  const highlightKey = useCallback((name: string) => {
    chartRef.current?.dispatchAction({ type: "highlight", name });
  }, []);
  const downplayKey = useCallback((name: string) => {
    chartRef.current?.dispatchAction({ type: "downplay", name });
  }, []);

  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    const sorted = [...data].sort((a, b) => b.targetWeight - a.targetWeight);
    const sumTarget = sorted.reduce((s, r) => s + r.targetWeight, 0);
    const sumCurrent = sorted.reduce((s, r) => s + r.currentWeight, 0);
    const untTarget = Math.max(0, 1 - sumTarget);
    const untCurrent = Math.max(0, 1 - sumCurrent);

    const innerData = [
      ...sorted.map((r, i) => ({
        name: r.key,
        value: r.currentWeight,
        itemStyle: { color: getSliceColor(i) },
      })),
      { name: "Untargeted", value: untCurrent, itemStyle: { color: t.border } },
    ];
    const outerData = [
      ...sorted.map((r, i) => ({
        name: r.key,
        value: r.targetWeight,
        itemStyle: { color: getSliceColor(i) },
      })),
      { name: "Untargeted", value: untTarget, itemStyle: { color: t.border } },
    ];

    return {
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        formatter: (d: { seriesName: string; name: string; percent: number }) =>
          `${d.seriesName} · ${d.name}<br/>${d.percent.toFixed(1)}%`,
      },
      series: [
        {
          name: "Current",
          type: "pie",
          radius: ["34%", "52%"],
          center: ["50%", "50%"],
          itemStyle: { borderColor: t.bg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: innerData,
        },
        {
          name: "Target",
          type: "pie",
          radius: ["58%", "80%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: t.bg, borderWidth: 2 },
          label: {
            color: t.muted,
            fontFamily: t.fontMono,
            fontSize: 10,
            formatter: (d: { name: string; percent: number }) =>
              d.percent >= 4 ? `${d.name} ${d.percent.toFixed(0)}%` : "",
          },
          labelLine: { lineStyle: { color: t.border }, length: 6, length2: 6 },
          data: outerData,
        },
      ],
    };
  }, [data]);

  if (data.length === 0) {
    return <div className="chart-empty">No {mode} targets yet</div>;
  }

  const legend = [...data].sort((a, b) => b.targetWeight - a.targetWeight);
  return (
    <div className="alloc-donut target-donut">
      <EChart option={option} height={300} onInit={handleInit} />
      <div className="pie-legend">
        <p className="target-donut-legend-head">inner = current · outer = target</p>
        {legend.slice(0, 8).map((r, i) => (
          <div
            key={r.id}
            className="legend-row"
            onMouseEnter={() => highlightKey(r.key)}
            onMouseLeave={() => downplayKey(r.key)}
          >
            <span className="legend-swatch" style={{ background: getSliceColor(i) }} />
            <div>
              <strong>{r.key}</strong>
              <span className="num">
                {formatPercent(r.currentWeight)} → {formatPercent(r.targetWeight)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
