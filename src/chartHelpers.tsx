import { useEffect, useRef, useState, useCallback } from "react";
import type React from "react";

export type Size = { width: number; height: number };

export function useResizeObserver<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  size: Size;
} {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

export type HoverInfo = {
  index: number;
  svgX: number;
  svgY: number;
  containerX: number;
  containerY: number;
};

type UseChartHoverArgs = {
  pointCount: number;
  plotLeft: number;
  plotRight: number;
  viewBoxWidth: number;
};

export function useChartHover(args: UseChartHoverArgs) {
  const { pointCount, plotLeft, plotRight, viewBoxWidth } = args;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const compute = useCallback(
    (clientX: number, clientY: number): HoverInfo | null => {
      const svg = svgRef.current;
      const container = containerRef.current;
      if (!svg || !container || pointCount < 1) return null;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (svgRect.width === 0) return null;
      const localX = clientX - svgRect.left;
      const localY = clientY - svgRect.top;
      const svgX = (localX / svgRect.width) * viewBoxWidth;
      const innerLeft = plotLeft;
      const innerRight = viewBoxWidth - plotRight;
      const innerWidth = innerRight - innerLeft;
      if (innerWidth <= 0) return null;
      const clamped = Math.min(innerRight, Math.max(innerLeft, svgX));
      const frac = (clamped - innerLeft) / innerWidth;
      const index = Math.max(
        0,
        Math.min(pointCount - 1, Math.round(frac * (pointCount - 1))),
      );
      const targetSvgX = innerLeft + (index / Math.max(1, pointCount - 1)) * innerWidth;
      const svgYHeight = svgRect.height;
      const svgYPos = (localY / svgRect.height) * (svgYHeight || 1);
      return {
        index,
        svgX: targetSvgX,
        svgY: svgYPos,
        containerX: clientX - containerRect.left,
        containerY: clientY - containerRect.top,
      };
    },
    [pointCount, plotLeft, plotRight, viewBoxWidth],
  );

  const handlers = {
    onPointerMove: (e: React.PointerEvent) => {
      const next = compute(e.clientX, e.clientY);
      if (next) setHover(next);
    },
    onPointerLeave: () => setHover(null),
    onPointerDown: (e: React.PointerEvent) => {
      const next = compute(e.clientX, e.clientY);
      if (next) setHover(next);
    },
  };

  return { containerRef, svgRef, hover, handlers };
}

export type TooltipRow = {
  label: string;
  value: string;
  color?: string;
};

export function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title?: string;
  rows: TooltipRow[];
}) {
  const ESTIMATED_WIDTH = 200;
  const flipLeft = x + ESTIMATED_WIDTH + 24 > containerWidth;
  const style: React.CSSProperties = {
    position: "absolute",
    top: Math.max(8, y - 12),
    left: flipLeft ? undefined : x + 16,
    right: flipLeft ? containerWidth - x + 16 : undefined,
    pointerEvents: "none",
  };
  return (
    <div className="chart-tooltip" style={style} role="tooltip">
      {title ? <div className="chart-tooltip-title">{title}</div> : null}
      {rows.map((row, i) => (
        <div className="chart-tooltip-row" key={`${row.label}-${i}`}>
          <span className="chart-tooltip-row-left">
            {row.color ? (
              <span
                className="chart-tooltip-swatch"
                style={{ background: row.color }}
              />
            ) : null}
            <span>{row.label}</span>
          </span>
          <span className="chart-tooltip-row-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function buildCatmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }
  const range = max - min;
  const rough = range / count;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow10;
  let step: number;
  if (norm >= 7.5) step = 10 * pow10;
  else if (norm >= 3) step = 5 * pow10;
  else if (norm >= 1.5) step = 2 * pow10;
  else step = pow10;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}
