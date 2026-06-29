import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { GaugeChart, TreemapChart, ScatterChart, PieChart } from "echarts/charts";
import {
  TooltipComponent,
  VisualMapComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
  GaugeChart,
  TreemapChart,
  ScatterChart,
  PieChart,
  TooltipComponent,
  VisualMapComponent,
  GridComponent,
  CanvasRenderer,
]);

/** Thin React wrapper: renders an ECharts `option`, resizes + disposes cleanly. */
export function EChart({
  option,
  height = 300,
  className,
}: {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} style={{ width: "100%", height }} />;
}
