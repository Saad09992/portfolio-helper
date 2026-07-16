import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { TreemapChart, ScatterChart, PieChart } from "echarts/charts";
import {
  TooltipComponent,
  VisualMapComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
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
  onInit,
}: {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
  /** Called once with the chart instance after init (attach events, keep a ref). */
  onInit?: (chart: echarts.ECharts) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    const el = ref.current;
    if (!box || !el) return;
    // Init against the absolutely-filled inner node and pass the box's measured
    // size explicitly so ECharts never sizes the canvas larger than the panel.
    const rect = box.getBoundingClientRect();
    const chart = echarts.init(el, undefined, {
      renderer: "canvas",
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    });
    chartRef.current = chart;
    onInit?.(chart);
    const resize = () => {
      const r = box.getBoundingClientRect();
      chart.resize({ width: Math.max(1, Math.floor(r.width)), height: Math.max(1, Math.floor(r.height)) });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    const raf = requestAnimationFrame(resize);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={boxRef}
      className={className}
      style={{ position: "relative", width: "100%", height, minWidth: 0, overflow: "hidden" }}
    >
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
