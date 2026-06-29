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
    const groups = new Map<string, HeatmapItem[]>();
    for (const it of items) {
      const g = groups.get(it.group) ?? [];
      g.push(it);
      groups.set(it.group, g);
    }
    const data = [...groups.entries()].map(([group, children]) => ({
      name: group,
      children: children.map((c) => ({
        name: c.ticker,
        value: [c.value, c.dayChangePct],
      })),
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
          label: {
            color: t.text,
            fontFamily: t.fontMono,
            fontSize: 10,
            formatter: "{b}",
          },
          upperLabel: {
            show: true,
            height: 16,
            color: t.muted,
            fontFamily: t.fontMono,
            fontSize: 9,
          },
          itemStyle: { borderColor: t.bg, borderWidth: 1, gapWidth: 1 },
          levels: [
            { itemStyle: { borderColor: t.bg, borderWidth: 2, gapWidth: 2 } },
            { itemStyle: { borderColor: t.border, borderWidth: 1, gapWidth: 1 } },
          ],
          data,
        },
      ],
    };
  }, [items]);

  if (items.length === 0) return <div className="chart-empty">No holdings yet</div>;
  return <EChart option={option} height={320} />;
}
