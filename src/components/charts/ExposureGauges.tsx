import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";

type Gauge = { label: string; pct: number; cap: number };

function gaugeOption(g: Gauge): EChartsCoreOption {
  const t = chartTokens();
  const warn = g.cap;
  const crit = Math.min(100, g.cap * 1.4);
  return {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: "92%",
        progress: { show: false },
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [warn / 100, t.pos],
              [crit / 100, t.warn],
              [1, t.neg],
            ],
          },
        },
        pointer: { width: 4, length: "60%", itemStyle: { color: t.text } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: t.border, width: 1 } },
        axisLabel: { show: false },
        anchor: { show: true, size: 6, itemStyle: { color: t.text } },
        title: {
          offsetCenter: [0, "32%"],
          color: t.muted,
          fontFamily: t.fontMono,
          fontSize: 9,
        },
        detail: {
          offsetCenter: [0, "62%"],
          color: t.text,
          fontFamily: t.fontMono,
          fontSize: 14,
          formatter: (v: number) => `${v.toFixed(0)}%`,
        },
        data: [{ value: Math.max(0, Math.min(100, g.pct)), name: g.label }],
      },
    ],
  };
}

export function ExposureGauges({ gauges }: { gauges: Gauge[] }) {
  const options = useMemo(() => gauges.map(gaugeOption), [gauges]);
  return (
    <div className="gauge-row">
      {options.map((opt, i) => (
        <EChart key={gauges[i].label} option={opt} height={130} />
      ))}
    </div>
  );
}
