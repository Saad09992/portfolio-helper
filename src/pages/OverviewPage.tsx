import type { CashBuckets, DerivedHolding } from "../types";
import type { InvestmentSummary } from "../derivedTypes";
import type { BenchmarkStats, RiskMetrics, SavingsStats } from "../analytics";
import type { PortfolioSnapshot } from "../utils";
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
} from "../utils";
import { METRIC_INFO, type MetricInfo } from "../metricInfo";
import { StatCard } from "../components/ui/StatCard";
import { InfoTip } from "../components/ui/InfoTip";
import { Sparkline } from "../components/ui/Sparkline";
import { RankedAllocation } from "../components/RankedAllocation";
import {
  PortfolioHistoryChart,
  type ContributionPoint,
} from "../components/charts/PortfolioHistoryChart";
import { AllocationDonut } from "../components/charts/AllocationDonut";
import { AllocationTreemap } from "../components/charts/AllocationTreemap";
import { Heatmap, type HeatmapItem } from "../components/charts/Heatmap";
import { GrowthVsDeposits } from "../components/charts/GrowthVsDeposits";

type TreemapItem = { key: string; label: string; value: number; weight: number };

export type OverviewPageProps = {
  equityMarketValue: number;
  costBasis: number;
  nonCashCount: number;
  portfolio: { totalValue: number; totalGainLoss: number; holdings: DerivedHolding[] };
  topHolding?: DerivedHolding;
  cashDraft: CashBuckets;
  cashWeight: number;
  investmentSummary: InvestmentSummary;
  savingsStats: SavingsStats;
  contributionSeries: ContributionPoint[];
  history: PortfolioSnapshot[];
  lastFetchedAt: string | null;
  fetching: boolean;
  treemapMode: "sector" | "ticker";
  setTreemapMode: (mode: "sector" | "ticker") => void;
  allocationView: "map" | "ranked";
  setAllocationView: (view: "map" | "ranked") => void;
  treemapItems: TreemapItem[];
  waterfallRows: DerivedHolding[];
  maxWaterfall: number;
  topMovers: DerivedHolding[];
  riskMetrics: RiskMetrics;
  valueSeries: number[];
  pnlSeries: number[];
  benchmarkStats: BenchmarkStats;
  heatmapItems: HeatmapItem[];
};

function pctOrDash(ready: boolean, value: string): string {
  return ready ? value : "—";
}

function KpiLabel({ label, info }: { label: string; info: MetricInfo }) {
  return (
    <p className="kpi-label">
      {label}
      <InfoTip title={label} what={info.what} reading={info.reading} />
    </p>
  );
}

export function OverviewPage({
  equityMarketValue,
  costBasis,
  nonCashCount,
  portfolio,
  topHolding,
  cashDraft,
  cashWeight,
  investmentSummary,
  savingsStats,
  contributionSeries,
  history,
  lastFetchedAt,
  fetching,
  treemapMode,
  setTreemapMode,
  allocationView,
  setAllocationView,
  treemapItems,
  waterfallRows,
  maxWaterfall,
  topMovers,
  riskMetrics,
  valueSeries,
  pnlSeries,
  benchmarkStats,
  heatmapItems,
}: OverviewPageProps) {
  const rm = riskMetrics;
  const bm = benchmarkStats;
  const investedDetail =
    investmentSummary.count > 0
      ? `${investmentSummary.count} Invest entr${investmentSummary.count === 1 ? "y" : "ies"} · ${formatSignedPercent(investmentSummary.pnlPct, 1)} P/L`
      : "Add entries in Invest tab";
  return (
    <>
      <section className="stats-grid kpi-six">
        <StatCard
          label="Total value"
          value={formatCurrency(equityMarketValue)}
          detail={`${nonCashCount} position${nonCashCount === 1 ? "" : "s"} · excludes cash`}
          info={METRIC_INFO.totalValue}
        />
        <StatCard
          label="Total invested"
          value={formatCurrency(investmentSummary.totalInvested)}
          detail={investedDetail}
          info={METRIC_INFO.totalInvested}
        />
        <StatCard
          label="Unrealized P/L"
          value={formatCurrency(portfolio.totalGainLoss)}
          detail={portfolio.totalGainLoss >= 0 ? "Positive drift" : "Downside risk"}
          tone={portfolio.totalGainLoss >= 0 ? "positive" : "negative"}
          series={pnlSeries}
          seriesTone={portfolio.totalGainLoss >= 0 ? "positive" : "negative"}
          info={METRIC_INFO.unrealizedPl}
        />
        <StatCard
          label="Current portfolio value"
          value={formatCurrency(portfolio.totalValue)}
          detail={`Positions + ${formatCurrency(cashDraft.available)} cash · incl. unrealized P/L`}
          series={valueSeries}
          seriesTone="accent"
          info={METRIC_INFO.portfolioValue}
        />
        <StatCard
          label="True return (TWR)"
          value={rm.ready ? formatSignedPercent(rm.twrReturn * 100, 1) : "—"}
          detail={rm.ready ? `${formatSignedPercent(rm.cagr * 100, 1)} annualized` : "Needs 2+ snapshots"}
          tone={rm.twrReturn >= 0 ? "positive" : "negative"}
          series={rm.series.twr}
          seriesTone={rm.twrReturn >= 0 ? "positive" : "negative"}
          info={METRIC_INFO.trueReturn}
        />
        <StatCard
          label="Top position"
          value={
            topHolding
              ? `${topHolding.ticker} ${formatPercent(topHolding.weight)}`
              : "None"
          }
          detail={topHolding ? topHolding.name : "Import holdings to begin"}
          info={METRIC_INFO.topPosition}
        />
      </section>

      <section className="panel risk-panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Risk</p>
            <h2>Performance &amp; risk profile</h2>
          </div>
          <span className="panel-meta">Flow-adjusted (TWR) · daily snapshots</span>
        </div>
        <div className="kpi-grid">
          <div className="kpi-tile">
            <KpiLabel label="Max drawdown" info={METRIC_INFO.maxDrawdown} />
            <strong className="num negative">{pctOrDash(rm.ready, formatPercent(rm.maxDrawdown))}</strong>
            {rm.ready ? <Sparkline data={rm.series.drawdown} tone="negative" fill /> : null}
            <span>Peak-to-trough</span>
          </div>
          <div className="kpi-tile">
            <KpiLabel label="Volatility" info={METRIC_INFO.volatility} />
            <strong className="num">{pctOrDash(rm.ready, formatPercent(rm.volatilityAnnual))}</strong>
            {rm.ready ? <Sparkline data={rm.series.dailyReturns} tone="warn" /> : null}
            <span>Annualized</span>
          </div>
          <div className="kpi-tile">
            <KpiLabel label="Sharpe" info={METRIC_INFO.sharpe} />
            <strong className={`num ${rm.sharpe >= 1 ? "positive" : rm.sharpe < 0 ? "negative" : ""}`}>
              {rm.ready ? rm.sharpe.toFixed(2) : "—"}
            </strong>
            {rm.ready ? <Sparkline data={rm.series.twr} tone="accent" /> : null}
            <span>Risk-adjusted return</span>
          </div>
          <div className="kpi-tile">
            <KpiLabel label="Best day" info={METRIC_INFO.bestDay} />
            <strong className="num positive">{rm.ready ? formatSignedPercent(rm.bestDay * 100, 2) : "—"}</strong>
            <span>Largest daily gain</span>
          </div>
          <div className="kpi-tile">
            <KpiLabel label="Worst day" info={METRIC_INFO.worstDay} />
            <strong className="num negative">{rm.ready ? formatSignedPercent(rm.worstDay * 100, 2) : "—"}</strong>
            <span>Largest daily loss</span>
          </div>
          <div className="kpi-tile">
            <KpiLabel label="Alpha vs KSE100" info={METRIC_INFO.alpha} />
            <strong className={`num ${bm.alpha >= 0 ? "positive" : "negative"}`}>
              {bm.ready ? formatSignedPercent(bm.alpha * 100, 1) : "—"}
            </strong>
            <span>{bm.ready ? `you ${formatSignedPercent(bm.portReturn * 100, 1)} · idx ${formatSignedPercent(bm.benchReturn * 100, 1)}` : "Needs 3+ snapshots"}</span>
          </div>
          <div className="kpi-tile">
            <KpiLabel label="Beta" info={METRIC_INFO.beta} />
            <strong className="num">{bm.ready ? bm.beta.toFixed(2) : "—"}</strong>
            <span>vs KSE100</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Heatmap</p>
              <h2>Day change · sized by weight</h2>
            </div>
            <span className="panel-meta">green up · red down</span>
          </div>
          <Heatmap items={heatmapItems} />
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Growth</p>
              <h2>
                Deposits vs market growth
                <InfoTip
                  title="Deposits vs market growth"
                  what={METRIC_INFO.depositsVsGrowth.what}
                  reading={METRIC_INFO.depositsVsGrowth.reading}
                />
              </h2>
            </div>
            <span className="panel-meta">of current value</span>
          </div>
          <GrowthVsDeposits stats={savingsStats} />
        </article>
      </section>

      <section className="stats-grid secondary">
        <StatCard
          label="Cash"
          value={formatCurrency(cashDraft.available)}
          detail={`${formatPercent(cashWeight)} of portfolio`}
          info={METRIC_INFO.cash}
        />
        <StatCard
          label="Cost basis"
          value={formatCurrency(costBasis)}
          detail={`Sum of position cost · ${nonCashCount} position${nonCashCount === 1 ? "" : "s"}`}
          info={METRIC_INFO.costBasis}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">History</p>
            <h2>Portfolio value over time</h2>
          </div>
          <div className="panel-meta-row">
            <span className="panel-meta">
              {history.length} snapshot{history.length === 1 ? "" : "s"} · 1/day end-of-day (23:59 PKT) · all 7 days
            </span>
          </div>
        </div>
        <PortfolioHistoryChart
          snapshots={history}
          lastFetchedIso={lastFetchedAt}
          contributions={contributionSeries}
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Allocation</p>
              <h2>Portfolio weightage</h2>
            </div>
            <span className="panel-meta">
              {lastFetchedAt
                ? `Updated ${formatRelativeTime(lastFetchedAt)}`
                : "Interactive donut"}
            </span>
          </div>
          {fetching ? <div className="chart-skeleton" aria-hidden="true" /> : null}
          <AllocationDonut holdings={portfolio.holdings} />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">
                {allocationView === "map" ? "Treemap" : "Ranked"}
              </p>
              <h2>Concentration {allocationView === "map" ? "map" : "leaderboard"}</h2>
            </div>
            <div className="allocation-toggles">
              <div className="toggle-row">
                <button
                  type="button"
                  className={`chip ${treemapMode === "sector" ? "active" : ""}`}
                  onClick={() => setTreemapMode("sector")}
                >
                  Sector
                </button>
                <button
                  type="button"
                  className={`chip ${treemapMode === "ticker" ? "active" : ""}`}
                  onClick={() => setTreemapMode("ticker")}
                >
                  Ticker
                </button>
              </div>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`chip ${allocationView === "map" ? "active" : ""}`}
                  onClick={() => setAllocationView("map")}
                  title="Squarified treemap"
                >
                  Map
                </button>
                <button
                  type="button"
                  className={`chip ${allocationView === "ranked" ? "active" : ""}`}
                  onClick={() => setAllocationView("ranked")}
                  title="Sorted horizontal bars"
                >
                  Ranked
                </button>
              </div>
            </div>
          </div>
          {allocationView === "map" ? (
            <AllocationTreemap items={treemapItems} />
          ) : (
            <RankedAllocation items={treemapItems} />
          )}
        </article>
      </section>

      <section className="insight-grid dual">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Waterfall</p>
              <h2>P/L contribution</h2>
            </div>
            <span className="panel-meta">Biggest impact positions</span>
          </div>
          <div className="waterfall-list waterfall-list--centered">
            {waterfallRows.length === 0 ? (
              <p className="muted-note">No positions to evaluate yet.</p>
            ) : (
              waterfallRows.map((holding) => {
                const pct = (Math.abs(holding.gainLoss) / maxWaterfall) * 50;
                const isPos = holding.gainLoss >= 0;
                const contribution =
                  Math.abs(portfolio.totalGainLoss) > 0
                    ? (holding.gainLoss / Math.abs(portfolio.totalGainLoss)) * 100
                    : 0;
                return (
                  <div
                    key={holding.id}
                    className="waterfall-row"
                    title={`${holding.ticker}: ${formatCurrency(holding.gainLoss)} · ${formatSignedPercent(contribution, 1)} of total P&L`}
                  >
                    <strong>{holding.ticker}</strong>
                    <div className="waterfall-track waterfall-track--centered">
                      <span className="waterfall-zero" />
                      <span
                        className={`waterfall-bar waterfall-bar--centered ${isPos ? "positive" : "negative"}`}
                        style={
                          isPos
                            ? { left: "50%", width: `${pct}%` }
                            : { right: "50%", width: `${pct}%` }
                        }
                      />
                    </div>
                    <span className={`waterfall-value num ${isPos ? "positive" : "negative"}`}>
                      {formatCurrency(holding.gainLoss)}
                      <small>{formatSignedPercent(contribution, 1)}</small>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Top movers</p>
              <h2>Daily change watch</h2>
            </div>
            <span className="panel-meta">Live from PSX</span>
          </div>
          <div className="suggestion-list">
            {topMovers.length === 0 ? (
              <p className="muted-note">No mover data yet.</p>
            ) : (
              topMovers.map((holding) => (
                <div key={holding.id} className="suggestion-row">
                  <strong>{holding.ticker}</strong>
                  <span className={`num ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                    {holding.dayChangePct.toFixed(2)}%
                  </span>
                  <small>{holding.name}</small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
