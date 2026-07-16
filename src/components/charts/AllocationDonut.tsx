import { useCallback, useMemo, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";
import { getSliceColor } from "./palette";
import { formatCurrency, formatPercent } from "../../utils";

export function AllocationDonut({
  holdings,
}: {
  holdings: { ticker: string; marketValue: number; weight: number }[];
}) {
  const chartRef = useRef<ECharts | null>(null);

  // One ordering for both the donut and the legend so a legend row's index is
  // the slice's dataIndex.
  const sorted = useMemo(
    () => [...holdings].sort((a, b) => b.marketValue - a.marketValue),
    [holdings],
  );

  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    return {
      backgroundColor: "transparent",
      tooltip: {
        // Chart box is overflow:hidden, so keep the tip inside the canvas rect.
        confine: true,
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        formatter: (d: { name: string; value: number; percent: number }) =>
          `${d.name}<br/>${formatCurrency(d.value)}<br/>${d.percent.toFixed(1)}%`,
      },
      series: [
        {
          type: "pie",
          radius: ["56%", "82%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: t.bg, borderWidth: 2 },
          emphasis: {
            scale: true,
            scaleSize: 8,
            itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.35)" },
            label: { show: true, color: t.text, fontWeight: "bold" },
          },
          label: {
            color: t.muted,
            fontFamily: t.fontMono,
            fontSize: 10,
            formatter: (d: { name: string; percent: number }) =>
              d.percent >= 4 ? `${d.name} ${d.percent.toFixed(0)}%` : "",
          },
          labelLine: { lineStyle: { color: t.border }, length: 6, length2: 6 },
          data: sorted.map((h, i) => ({
            name: h.ticker,
            value: h.marketValue,
            itemStyle: { color: getSliceColor(i) },
          })),
        },
      ],
    };
  }, [sorted]);

  const highlight = useCallback((dataIndex: number) => {
    chartRef.current?.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex });
    chartRef.current?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex });
  }, []);

  const downplay = useCallback((dataIndex: number) => {
    chartRef.current?.dispatchAction({ type: "downplay", seriesIndex: 0, dataIndex });
    chartRef.current?.dispatchAction({ type: "hideTip" });
  }, []);

  if (holdings.length === 0) return <div className="chart-empty">No holdings yet</div>;
  return (
    <div className="alloc-donut">
      <EChart
        option={option}
        height={300}
        onInit={(chart) => {
          chartRef.current = chart;
        }}
      />
      <div className="pie-legend">
        {sorted.slice(0, 8).map((h, i) => (
          <div
            key={h.ticker}
            className="legend-row"
            onMouseEnter={() => highlight(i)}
            onMouseLeave={() => downplay(i)}
            onFocus={() => highlight(i)}
            onBlur={() => downplay(i)}
            tabIndex={0}
          >
            <span className="legend-swatch" style={{ background: getSliceColor(i) }} />
            <div>
              <strong>{h.ticker}</strong>
              <span className="num">{formatPercent(h.weight)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
