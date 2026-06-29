import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";
import { getSliceColor } from "./palette";
import { formatCurrency, formatPercent } from "../../utils";

export function AllocationDonut({
  holdings,
}: {
  holdings: { ticker: string; marketValue: number; weight: number }[];
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    const sorted = [...holdings].sort((a, b) => b.marketValue - a.marketValue);
    return {
      backgroundColor: "transparent",
      tooltip: {
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
  }, [holdings]);

  if (holdings.length === 0) return <div className="chart-empty">No holdings yet</div>;
  return (
    <div className="alloc-donut">
      <EChart option={option} height={300} />
      <div className="pie-legend">
        {[...holdings]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 8)
          .map((h, i) => (
            <div key={h.ticker} className="legend-row">
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
