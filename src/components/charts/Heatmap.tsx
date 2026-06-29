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

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function hexToRgb(h: string): [number, number, number] {
  const n = h.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
/** Day-change → red→grey→green, clamped at ±3%. */
function dayColor(day: number, neg: string, mid: string, pos: string): string {
  const t = Math.max(-1, Math.min(1, day / 3));
  const [a, b, c] = hexToRgb(mid);
  const [x, y, z] = hexToRgb(t >= 0 ? pos : neg);
  const f = Math.abs(t);
  return `rgb(${lerp(a, x, f)},${lerp(b, y, f)},${lerp(c, z, f)})`;
}

export function Heatmap({ items }: { items: HeatmapItem[] }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    const mid = "#2a3340";
    // Flat: one tile per holding (numeric value so EVERY position renders,
    // incl. tiny crypto), colored explicitly by day %.
    const data = [...items]
      .sort((a, b) => b.value - a.value)
      .map((c) => ({
        name: c.ticker,
        value: c.value,
        day: c.dayChangePct,
        weight: c.weight,
        itemStyle: { color: dayColor(c.dayChangePct, t.neg, mid, t.pos) },
      }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        formatter: (info: { name: string; value: number; data: { day: number } }) =>
          `${info.name}<br/>day ${info.data.day >= 0 ? "+" : ""}${info.data.day.toFixed(2)}%<br/>Rs ${Number(info.value).toLocaleString()}`,
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          top: 1,
          bottom: 1,
          left: 1,
          right: 1,
          visibleMin: 0,
          label: {
            show: true,
            color: t.text,
            fontFamily: t.fontMono,
            fontSize: 10,
            overflow: "truncate",
            formatter: (info: { name: string; data: { day: number } }) =>
              `${info.name}\n${info.data.day >= 0 ? "+" : ""}${info.data.day.toFixed(1)}%`,
          },
          itemStyle: { borderColor: t.bg, borderWidth: 1, gapWidth: 1 },
          data,
        },
      ],
    };
  }, [items]);

  if (items.length === 0) return <div className="chart-empty">No holdings yet</div>;
  return <EChart option={option} height={360} />;
}
