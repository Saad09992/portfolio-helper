import { useMemo, useRef } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";
import { getSliceColor } from "./palette";
import { formatCurrency, formatPercent } from "../../utils";

export type AllocItem = { key: string; label: string; value: number; weight: number };

export function AllocationTreemap({
  items,
  onSelect,
}: {
  items: AllocItem[];
  /** Receives the item's `key` — a ticker or a sector, depending on the mode. */
  onSelect?: (key: string) => void;
}) {
  // See Heatmap: `onInit` fires once, so the callback is read through a ref.
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;

  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    const sorted = [...items].sort((a, b) => b.value - a.value);
    return {
      backgroundColor: "transparent",
      tooltip: {
        confine: true,
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        formatter: (info: { name: string; value: number }) =>
          `${info.name}<br/>${formatCurrency(info.value)}`,
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
            color: t.bg,
            fontFamily: t.fontMono,
            fontSize: 11,
            overflow: "truncate",
            formatter: (info: { name: string; data: { weight: number } }) =>
              `${info.name}\n${formatPercent(info.data.weight)}`,
          },
          itemStyle: { borderColor: t.bg, borderWidth: 2, gapWidth: 2 },
          data: sorted.map((it, i) => ({
            name: it.label,
            value: it.value,
            weight: it.weight,
            // The key, not the label — sector names and tickers can differ.
            itemKey: it.key,
            itemStyle: {
              color: getSliceColor(i),
              cursor: onSelect ? "pointer" : "default",
            },
          })),
        },
      ],
    };
  }, [items, onSelect]);

  if (items.length === 0) return <div className="chart-empty">No data</div>;
  return (
    <EChart
      option={option}
      height={420}
      className={onSelect ? "chart-clickable" : undefined}
      onInit={(chart) => {
        // `nodeClick: false` only disables zoom-on-click; the event still fires.
        chart.on("click", (params) => {
          const key = (params.data as { itemKey?: string } | undefined)?.itemKey;
          if (key) cbRef.current?.(key);
        });
      }}
    />
  );
}
