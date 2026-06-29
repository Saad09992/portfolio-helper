import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { formatCurrency } from "../../utils";
import { chartTokens } from "../../theme/chartTokens";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const series = useMemo(() => {
    const byDay = new Map<string, InvestmentChartRow>();
    for (const r of rows) byDay.set(dayKey(r.date), r);
    const ordered = [...byDay.values()].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
    const t = (iso: string) =>
      Math.floor(new Date(`${dayKey(iso)}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
    return {
      deployed: ordered.map((r) => ({ time: t(r.date), value: r.total })),
      value: ordered.map((r) => ({ time: t(r.date), value: r.valueEom })),
    };
  }, [rows]);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = chartTokens();
    const chart = createChart(containerRef.current, {
      autoSize: true,
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
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
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
  }, [series]);

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
