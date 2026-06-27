import type { CashBuckets, DerivedHolding } from "../types";
import type { InvestmentSummary } from "../derivedTypes";
import type { PortfolioSnapshot } from "../utils";
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
} from "../utils";
import { StatCard } from "../components/ui/StatCard";
import { PieChart } from "../components/PieChart";
import { RankedAllocation } from "../components/RankedAllocation";
import { PortfolioHistoryChart } from "../components/charts/PortfolioHistoryChart";
import { Treemap } from "../components/charts/Treemap";

type TreemapItem = { key: string; label: string; value: number; weight: number };

export type OverviewPageProps = {
  equityMarketValue: number;
  totalInvested: number;
  nonCashCount: number;
  portfolio: { totalValue: number; totalGainLoss: number; holdings: DerivedHolding[] };
  topHolding?: DerivedHolding;
  cashDraft: CashBuckets;
  cashWeight: number;
  investmentSummary: InvestmentSummary;
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
};

export function OverviewPage({
  equityMarketValue,
  totalInvested,
  nonCashCount,
  portfolio,
  topHolding,
  cashDraft,
  cashWeight,
  investmentSummary,
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
}: OverviewPageProps) {
  return (
    <>
      <section className="stats-grid">
        <StatCard
          label="Total value"
          value={formatCurrency(equityMarketValue)}
          detail={`${nonCashCount} position${nonCashCount === 1 ? "" : "s"} · excludes cash`}
        />
        <StatCard
          label="Total avg cost"
          value={formatCurrency(totalInvested)}
          detail={`Cost basis of ${nonCashCount} position${nonCashCount === 1 ? "" : "s"} · excludes cash`}
        />
        <StatCard
          label="Unrealized P/L"
          value={formatCurrency(portfolio.totalGainLoss)}
          detail={portfolio.totalGainLoss >= 0 ? "Positive drift" : "Downside risk"}
          tone={portfolio.totalGainLoss >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Top position"
          value={
            topHolding
              ? `${topHolding.ticker} ${formatPercent(topHolding.weight)}`
              : "None"
          }
          detail={topHolding ? topHolding.name : "Import holdings to begin"}
        />
      </section>

      <section className="stats-grid secondary">
        <StatCard
          label="Cash"
          value={formatCurrency(cashDraft.available)}
          detail={`${formatPercent(cashWeight)} of portfolio`}
        />
        <StatCard
          label="Total invested"
          value={formatCurrency(investmentSummary.totalInvested)}
          detail={
            investmentSummary.count > 0
              ? `${investmentSummary.count} Invest entr${investmentSummary.count === 1 ? "y" : "ies"}`
              : "Add entries in Invest tab"
          }
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
              {history.length} snapshot{history.length === 1 ? "" : "s"} · 1/day after PSX close (15:30 PKT)
            </span>
          </div>
        </div>
        <PortfolioHistoryChart snapshots={history} lastFetchedIso={lastFetchedAt} />
      </section>

      <section className="dashboard-grid dual">
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
          <PieChart holdings={portfolio.holdings} />
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
            <Treemap items={treemapItems} />
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
