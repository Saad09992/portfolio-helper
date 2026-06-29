import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";

export type HeatmapItem = {
  ticker: string;
  group: string; // sector (stocks) or "Crypto"
  value: number; // market value (tile size)
  weight: number;
  dayChangePct: number;
};

export function Heatmap({ items }: { items: HeatmapItem[] }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    // Flat: one tile per holding (so small positions like crypto always show),
    // sized by value, colored by day %.
    const data = items.map((c) => ({
      name: c.ticker,
      value: [c.value, c.dayChangePct],
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        formatter: (info: { name: string; value: number | number[] }) => {
          const v = Array.isArray(info.value) ? info.value : [info.value, 0];
          return `${info.name}<br/>day ${v[1] >= 0 ? "+" : ""}${Number(v[1]).toFixed(2)}%<br/>Rs ${Number(v[0]).toLocaleString()}`;
        },
      },
      visualMap: {
        type: "continuous",
        min: -5,
        max: 5,
        dimension: 1,
        show: false,
        inRange: { color: [t.neg, "#2a3340", t.pos] },
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: "100%",
          height: "100%",
          visibleMin: 1,
          label: {
            show: true,
            color: t.text,
            fontFamily: t.fontMono,
            fontSize: 10,
            formatter: (info: { name: string; value: number | number[] }) => {
              const v = Array.isArray(info.value) ? info.value[1] : 0;
              return `${info.name}\n${v >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`;
            },
          },
          itemStyle: { borderColor: t.bg, borderWidth: 1, gapWidth: 1 },
          data,
        },
      ],
    };
  }, [items]);

  if (items.length === 0) return <div className="chart-empty">No holdings yet</div>;
  return <EChart option={option} height={380} />;
}
