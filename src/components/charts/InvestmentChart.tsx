import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { formatCurrency } from "../../utils";
import { chartTokens } from "../../theme/chartTokens";
import { useMoneyHidden } from "../../privacy";

export type InvestmentChartRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  total: number;
  valueEom: number;
  pnlValue: number;
  pnlPct: number;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function InvestmentChart({ rows }: { rows: InvestmentChartRow[] }) {
  const moneyHidden = useMoneyHidden();
  const containerRef = useRef<HTMLDivElement>(null);
  // State, not a ref — see the same note in PortfolioHistoryChart: the series
  // effect must re-run when the chart is rebuilt, and a ref change is invisible
  // to a dependency array.
  const [chart, setChart] = useState<IChartApi | null>(null);

  const series = useMemo(() => {
    const byDay = new Map<string, InvestmentChartRow>();
    for (const r of rows) byDay.set(dayKey(r.date), r);
    const ordered = [...byDay.values()].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
    const t = (iso: string) =>
      Math.floor(new Date(`${dayKey(iso)}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
    // total/valueEom are paisa in state → divide for the rupee value axis.
    return {
      deployed: ordered.map((r) => ({ time: t(r.date), value: r.total / 100 })),
      value: ordered.map((r) => ({ time: t(r.date), value: r.valueEom / 100 })),
    };
  }, [rows]);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = chartTokens();
    const instance = createChart(containerRef.current, {
      autoSize: true,
      // Canvas-drawn axis labels the formatters cannot reach — see the same
      // note in PortfolioHistoryChart.
      localization: moneyHidden ? { priceFormatter: () => "••••" } : undefined,
      layout: {
        background: { color: "transparent" },
        textColor: t.muted,
        fontFamily: t.fontMono,
        fontSize: 10,
      },
      grid: { vertLines: { color: t.border }, horzLines: { color: t.border } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border, timeVisible: false },
      crosshair: {
        vertLine: { color: t.muted, labelBackgroundColor: t.panel },
        horzLine: { color: t.muted, labelBackgroundColor: t.panel },
      },
    });
    setChart(instance);
    return () => {
      instance.remove();
      setChart(null);
    };
  }, [moneyHidden]);

  useEffect(() => {
    if (!chart) return;
    const t = chartTokens();
    const created: ReturnType<typeof chart.addSeries>[] = [];

    const deployed = chart.addSeries(AreaSeries, {
      lineColor: t.info,
      topColor: "rgba(76,201,240,0.16)",
      bottomColor: "rgba(76,201,240,0.0)",
      lineWidth: 2,
      priceLineVisible: false,
    });
    deployed.setData(series.deployed);
    created.push(deployed);

    const value = chart.addSeries(LineSeries, {
      color: t.accent,
      lineWidth: 2,
      priceLineVisible: false,
    });
    value.setData(series.value);
    created.push(value);

    chart.timeScale().fitContent();
    return () => {
      for (const s of created) {
        try {
          chart.removeSeries(s);
        } catch {
          /* disposed */
        }
      }
    };
  }, [chart, series]);

  if (rows.length === 0) {
    return <div className="chart-empty">No entries yet — add an installment to chart it</div>;
  }

  const last = rows[rows.length - 1];
  return (
    <div className="history-chart">
      <div className="history-chart-bar">
        <div className="history-summary">
          <strong className="num">{formatCurrency(last.valueEom)}</strong>
          <span className={`num ${last.pnlValue >= 0 ? "positive" : "negative"}`}>
            {last.pnlValue >= 0 ? "+" : ""}
            {formatCurrency(last.pnlValue)}
          </span>
        </div>
        <div className="chart-legend">
          <span className="legend-line">
            <span className="legend-dash" style={{ borderColor: "var(--info)" }} />
            Capital deployed
          </span>
          <span className="legend-line">
            <span className="legend-dash" style={{ borderColor: "var(--accent)" }} />
            Portfolio value
          </span>
        </div>
      </div>
      <div ref={containerRef} className="history-chart-canvas" />
    </div>
  );
}
