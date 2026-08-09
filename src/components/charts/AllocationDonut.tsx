import { useCallback, useMemo, useRef, useState } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";
import { chartTokens } from "../../theme/chartTokens";
import { getSliceColor } from "./palette";
import { formatCompactCurrency, formatCurrency, formatPercent } from "../../utils";
import { ChipGroup } from "../ui/ChipGroup";
import { UI_LIMITS } from "../../constants";
import {
  BASIS_LABEL,
  allocationTotal,
  buildAllocationSlices,
  valueFor,
  weightFor,
  type AllocationBasis,
  type AllocationGroup,
  type AllocationInput,
} from "../../portfolio/allocation";

export function AllocationDonut({
  holdings,
  hrefFor,
  onSelect,
}: {
  holdings: AllocationInput[];
  /** Where a slice leads — a stock page, or Holdings filtered to a sector. */
  hrefFor?: (key: string, groupBy: AllocationGroup) => string;
  /** Canvas clicks, which cannot be anchors. */
  onSelect?: (key: string, groupBy: AllocationGroup) => void;
}) {
  const [groupBy, setGroupBy] = useState<AllocationGroup>("sector");
  const [basis, setBasis] = useState<AllocationBasis>("market");

  const chartRef = useRef<ECharts | null>(null);
  // See Heatmap: `onInit` fires once, so the callback is read through a ref.
  const cbRef = useRef({ onSelect, groupBy });
  cbRef.current = { onSelect, groupBy };

  // One ordering for the donut and the legend, so a legend row's index is the
  // slice's `dataIndex` and its colour.
  const slices = useMemo(
    () => buildAllocationSlices(holdings, groupBy, basis),
    [holdings, groupBy, basis],
  );
  const total = useMemo(() => allocationTotal(slices, basis), [slices, basis]);

  const option = useMemo<EChartsCoreOption>(() => {
    const t = chartTokens();
    return {
      backgroundColor: "transparent",
      tooltip: {
        // Chart box is overflow:hidden, so keep the tip inside the canvas rect.
        confine: true,
        backgroundColor: t.panel,
        borderColor: t.border,
        textStyle: { color: t.text, fontFamily: t.fontMono, fontSize: 11 },
        // Both weights, always — the comparison is the point of the widget, and
        // it should not depend on which column happens to be active.
        formatter: (d: { dataIndex: number }) => {
          const slice = slices[d.dataIndex];
          if (!slice) return "";
          return [
            slice.label,
            formatCurrency(valueFor(slice, basis)),
            `market ${formatPercent(slice.marketWeight)} · cost ${formatPercent(slice.costWeight)}`,
          ].join("<br/>");
        },
      },
      series: [
        {
          type: "pie",
          radius: ["58%", "82%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: t.bg, borderWidth: 2 },
          emphasis: {
            scale: true,
            scaleSize: 8,
            itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.35)" },
          },
          // The legend below carries every name and both numbers, so the ring
          // stays clean — labels on it would only repeat the table.
          label: { show: false },
          labelLine: { show: false },
          data: slices.map((slice, i) => ({
            name: slice.label,
            value: valueFor(slice, basis),
            itemStyle: { color: getSliceColor(i) },
          })),
        },
      ],
    };
  }, [slices, basis]);

  const highlight = useCallback((dataIndex: number) => {
    chartRef.current?.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex });
    chartRef.current?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex });
  }, []);

  const downplay = useCallback((dataIndex: number) => {
    chartRef.current?.dispatchAction({ type: "downplay", seriesIndex: 0, dataIndex });
    chartRef.current?.dispatchAction({ type: "hideTip" });
  }, []);

  const groupChips = (
    <ChipGroup
      ariaLabel="Group allocation by"
      value={groupBy}
      onChange={setGroupBy}
      options={[
        { value: "sector", label: "Sector" },
        { value: "ticker", label: "Ticker" },
      ]}
    />
  );

  if (holdings.length === 0) {
    return (
      <div className="alloc-donut">
        <div className="alloc-donut-bar">{groupChips}</div>
        <div className="chart-empty">No holdings yet</div>
      </div>
    );
  }

  const shown = slices.slice(0, UI_LIMITS.DONUT_LEGEND_ROWS);
  const rest = slices.slice(UI_LIMITS.DONUT_LEGEND_ROWS);

  return (
    <div className="alloc-donut">
      <div className="alloc-donut-bar">{groupChips}</div>

      <div className="alloc-donut-ring">
        <EChart
          option={option}
          height={UI_LIMITS.DONUT_HEIGHT}
          className={hrefFor || onSelect ? "chart-clickable" : undefined}
          onInit={(chart) => {
            chartRef.current = chart;
            chart.on("click", (params: { name?: string }) => {
              const { onSelect: cb, groupBy: mode } = cbRef.current;
              if (params.name) cb?.(params.name, mode);
            });
          }}
        />
        {/* Which basis the ring is drawn from, and how much of it there is.
            Sits over the hole rather than inside the option: the `graphic`
            component is not registered on this app's ECharts build. */}
        <div className="alloc-donut-centre" aria-hidden="true">
          <span className="alloc-donut-centre-label">{BASIS_LABEL[basis]}</span>
          <strong className="num">{formatCompactCurrency(total)}</strong>
        </div>
      </div>

      {/* The canvas can't be focused, so these legend rows are the keyboard path
          into each slice — real anchors when a target exists, so Enter works and
          the destination shows in the status bar. */}
      <div className="alloc-legend">
        <div className="alloc-legend-head">
          <span className="alloc-legend-name">
            {groupBy === "sector" ? "Sector" : "Ticker"}
          </span>
          {(["market", "cost"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`alloc-legend-sort ${basis === key ? "is-active" : ""}`.trim()}
              aria-pressed={basis === key}
              title={`Size and sort the ring by ${BASIS_LABEL[key].toLowerCase()}`}
              onClick={() => setBasis(key)}
            >
              {key === "market" ? "Market" : "Cost"}
              <span aria-hidden="true">{basis === key ? " ↓" : ""}</span>
            </button>
          ))}
        </div>

        {shown.map((slice, i) => {
          const inner = (
            <>
              <span className="alloc-legend-name">
                <span className="legend-swatch" style={{ background: getSliceColor(i) }} />
                {slice.label}
              </span>
              <span className={`num ${basis === "market" ? "is-active" : ""}`.trim()}>
                {formatPercent(slice.marketWeight)}
              </span>
              <span className={`num ${basis === "cost" ? "is-active" : ""}`.trim()}>
                {formatPercent(slice.costWeight)}
              </span>
            </>
          );
          const hover = {
            onMouseEnter: () => highlight(i),
            onMouseLeave: () => downplay(i),
            onFocus: () => highlight(i),
            onBlur: () => downplay(i),
          };
          return hrefFor ? (
            <a
              key={slice.key}
              className="alloc-legend-row alloc-legend-row--link"
              href={hrefFor(slice.key, groupBy)}
              {...hover}
            >
              {inner}
            </a>
          ) : (
            <div key={slice.key} className="alloc-legend-row" tabIndex={0} {...hover}>
              {inner}
            </div>
          );
        })}

        {rest.length > 0 ? (
          <p className="alloc-legend-rest">
            + {rest.length} more, {formatPercent(
              rest.reduce((sum, s) => sum + weightFor(s, basis), 0),
            )}{" "}
            of {BASIS_LABEL[basis].toLowerCase()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
