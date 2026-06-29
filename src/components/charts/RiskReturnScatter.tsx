import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";

export type ScatterPoint = {
  ticker: string;
  risk: number; // |dayChangePct|
  ret: number; // total return %
  weight: number; // 0..1
  assetClass: "stock" | "crypto";
};

export function RiskReturnScatter({ points }: { points: ScatterPoint[] }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    const mk = (cls: "stock" | "crypto", color: string) => ({
      name: cls,
      type: "scatter" as const,
      symbolSize: (d: number[]) => Math.max(8, Math.sqrt(d[2]) * 60),
      itemStyle: { color, opacity: 0.8, borderColor: t.bg },
      data: points
        .filter((p) => p.assetClass === cls)
        .map((p) => ({ name: p.ticker, value: [p.risk, p.ret, p.weight] })),
    });
    return {
      backgroundColor: "transparent",
      grid: { left: 48, right: 16, top: 16, bottom: 36 },
      tooltip: {
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        formatter: (d: { data: { name: string; value: number[] } }) =>
          `${d.data.name}<br/>return ${d.data.value[1] >= 0 ? "+" : ""}${d.data.value[1].toFixed(1)}%<br/>risk ${d.data.value[0].toFixed(2)}%<br/>weight ${(d.data.value[2] * 100).toFixed(1)}%`,
      },
      xAxis: {
        name: "risk |day %|",
        nameLocation: "middle",
        nameGap: 22,
        nameTextStyle: { color: t.muted, fontFamily: t.fontMono, fontSize: 9 },
        axisLine: { lineStyle: { color: t.border } },
        axisLabel: { color: t.muted, fontFamily: t.fontMono, fontSize: 9 },
        splitLine: { lineStyle: { color: t.border, opacity: 0.4 } },
      },
      yAxis: {
        name: "return %",
        axisLine: { lineStyle: { color: t.border } },
        axisLabel: { color: t.muted, fontFamily: t.fontMono, fontSize: 9 },
        splitLine: { lineStyle: { color: t.border, opacity: 0.4 } },
      },
      series: [mk("stock", t.accent), mk("crypto", t.violet)],
    };
  }, [points]);

  if (points.length === 0) return <div className="chart-empty">No positions yet</div>;
  return <EChart option={option} height={280} />;
}
