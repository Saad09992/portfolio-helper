import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  computeTwrIndex,
  formatCurrency,
  formatRelativeTime,
  formatSignedPercent,
  type PortfolioSnapshot,
} from "../../utils";
import { chartTokens } from "../../theme/chartTokens";
import { useMoneyHidden } from "../../privacy";
import { ChipGroup } from "../ui/ChipGroup";

type ViewMode = "value" | "twr";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export type ContributionPoint = { time: string; value: number };

export function PortfolioHistoryChart({
  snapshots,
  lastFetchedIso,
  contributions,
}: {
  snapshots: PortfolioSnapshot[];
  lastFetchedIso?: string | null;
  contributions?: ContributionPoint[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("value");
  const moneyHidden = useMoneyHidden();
  const containerRef = useRef<HTMLDivElement>(null);
  // State, not a ref: the series effect below has to re-run when the chart is
  // rebuilt, and a ref change is invisible to the dependency array. Holding it
  // in a ref is what left the chart blank after toggling hidden mode — the
  // instance was replaced and nothing redrew the series onto the new one.
  const [chart, setChart] = useState<IChartApi | null>(null);

  // One row per calendar day (latest wins), ascending.
  const rows = useMemo(() => {
    const byDay = new Map<string, PortfolioSnapshot>();
    for (const s of snapshots) byDay.set(dayKey(s.date), s);
    return [...byDay.values()].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
  }, [snapshots]);

  const series = useMemo(() => {
    const t = (iso: string) =>
      (Math.floor(new Date(`${dayKey(iso)}T00:00:00Z`).getTime() / 1000)) as UTCTimestamp;
    // Money series are paisa in state → divide for the rupee value axis.
    const value = rows.map((s) => ({ time: t(s.date), value: s.totalValue / 100 }));
    const cost = rows.map((s) => ({ time: t(s.date), value: s.totalCost / 100 }));
    const twrIdx = computeTwrIndex(rows);
    const twr = rows.map((s, i) => ({ time: t(s.date), value: twrIdx[i] }));
    const kseRows = rows.filter((s) => typeof s.kse100 === "number" && (s.kse100 as number) > 0);
    const base = kseRows.length ? (kseRows[0].kse100 as number) : 0;
    const kse =
      base > 0
        ? kseRows.map((s) => ({ time: t(s.date), value: ((s.kse100 as number) / base) * 100 }))
        : [];
    // Contributions: cumulative deposit ledger aligned to history's day grid.
    // Emit a step per snapshot day carrying the latest cumulative value <= that day.
    const contribInput = (contributions ?? [])
      .filter((c) => c.time && Number.isFinite(c.value))
      .sort((a, b) => a.time.localeCompare(b.time));
    const contrib: { time: UTCTimestamp; value: number }[] = [];
    if (contribInput.length && rows.length) {
      let idx = 0;
      let running = 0;
      for (const row of rows) {
        const day = dayKey(row.date);
        while (idx < contribInput.length && contribInput[idx].time <= day) {
          running = contribInput[idx].value;
          idx++;
        }
        contrib.push({ time: t(row.date), value: running / 100 });
      }
    }
    return { value, cost, twr, kse, contrib };
  }, [rows, contributions]);

  const summary = useMemo(() => {
    const last = rows[rows.length - 1];
    if (!last) return null;
    const pnl = last.gainLoss;
    return { value: last.totalValue, pnl };
  }, [rows]);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = chartTokens();
    const created = createChart(containerRef.current, {
      autoSize: true,
      // The price scale draws its own labels straight to canvas, so the
      // formatters cannot reach them — mask here or the y-axis quietly prints
      // the portfolio value that everything else is hiding.
      localization: moneyHidden ? { priceFormatter: () => "••••" } : undefined,
      layout: {
        background: { color: "transparent" },
        textColor: t.muted,
        fontFamily: t.fontMono,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: t.border },
        horzLines: { color: t.border },
      },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border, timeVisible: false },
      crosshair: {
        vertLine: { color: t.muted, labelBackgroundColor: t.panel },
        horzLine: { color: t.muted, labelBackgroundColor: t.panel },
      },
    });
    setChart(created);
    return () => {
      created.remove();
      setChart(null);
    };
  }, [moneyHidden]);

  // (Re)draw series whenever the chart instance, the data or the mode changes.
  useEffect(() => {
    if (!chart) return;
    const t = chartTokens();
    // LWC has no "removeAllSeries" — track what we add and remove on cleanup.
    const created: ReturnType<typeof chart.addSeries>[] = [];

    if (viewMode === "value") {
      const area = chart.addSeries(AreaSeries, {
        lineColor: t.text,
        topColor: "rgba(0,230,118,0.18)",
        bottomColor: "rgba(0,230,118,0.0)",
        lineWidth: 2,
        priceLineVisible: false,
      });
      area.setData(series.value);
      created.push(area);
      const cost = chart.addSeries(LineSeries, {
        color: t.warn,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
      });
      cost.setData(series.cost);
      created.push(cost);
      if (series.contrib.length >= 2) {
        const contrib = chart.addSeries(LineSeries, {
          color: t.info,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
        });
        contrib.setData(series.contrib);
        created.push(contrib);
      }
    } else {
      const twr = chart.addSeries(LineSeries, {
        color: t.accent,
        lineWidth: 2,
        priceLineVisible: false,
      });
      twr.setData(series.twr);
      created.push(twr);
      if (series.kse.length >= 2) {
        const kse = chart.addSeries(LineSeries, {
          color: t.info,
          lineWidth: 1,
          priceLineVisible: false,
        });
        kse.setData(series.kse);
        created.push(kse);
      }
    }
    chart.timeScale().fitContent();

    return () => {
      for (const s of created) {
        try {
          chart.removeSeries(s);
        } catch {
          /* chart already disposed */
        }
      }
    };
  }, [chart, series, viewMode]);

  if (rows.length === 0) {
    return <div className="chart-empty">No snapshots yet — refresh prices after 23:59 PKT</div>;
  }

  return (
    <div className="history-chart">
      <div className="history-chart-bar">
        <div className="history-summary">
          {summary ? (
            <>
              <strong className="num">{formatCurrency(summary.value)}</strong>
              <span className={`num ${summary.pnl >= 0 ? "positive" : "negative"}`}>
                {formatSignedPercent(
                  summary.value - summary.pnl > 0
                    ? (summary.pnl / (summary.value - summary.pnl)) * 100
                    : 0,
                  2,
                )}
              </span>
            </>
          ) : null}
          {lastFetchedIso ? (
            <small className="history-updated">Updated {formatRelativeTime(lastFetchedIso)}</small>
          ) : null}
        </div>
        <ChipGroup
          ariaLabel="History view"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: "value", label: "Value" },
            { value: "twr", label: "TWR vs KSE100" },
          ]}
        />
      </div>
      <div className="chart-legend">
        {(viewMode === "value"
          ? [
              { label: "Market value", color: "var(--text)", dashed: false },
              { label: "Cost basis", color: "var(--warn)", dashed: true },
              ...(series.contrib.length >= 2
                ? [{ label: "Invested (ledger)", color: "var(--info)", dashed: true }]
                : []),
            ]
          : [
              { label: "Portfolio (TWR)", color: "var(--accent)", dashed: false },
              ...(series.kse.length >= 2
                ? [{ label: "KSE100", color: "var(--info)", dashed: false }]
                : []),
            ]
        ).map((l) => (
          <span key={l.label} className="legend-line">
            <span
              className={`legend-dash ${l.dashed ? "legend-dash--dashed" : ""}`}
              style={{ borderColor: l.color }}
            />
            {l.label}
          </span>
        ))}
        {viewMode === "twr" && series.kse.length < 2 ? (
          <span className="legend-line legend-muted">KSE100 — needs 2+ snapshots</span>
        ) : null}
      </div>
      <div ref={containerRef} className="history-chart-canvas" />
    </div>
  );
}
