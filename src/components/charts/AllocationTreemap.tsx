import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";
import { getSliceColor } from "./palette";
import { formatCurrency, formatPercent } from "../../utils";

export type AllocItem = { key: string; label: string; value: number; weight: number };

export function AllocationTreemap({ items }: { items: AllocItem[] }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    const sorted = [...items].sort((a, b) => b.value - a.value);
    return {
      backgroundColor: "transparent",
      tooltip: {
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
            itemStyle: { color: getSliceColor(i) },
          })),
        },
      ],
    };
  }, [items]);

  if (items.length === 0) return <div className="chart-empty">No data</div>;
  return <EChart option={option} height={420} />;
}
