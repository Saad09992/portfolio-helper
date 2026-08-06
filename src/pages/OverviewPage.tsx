import type { CashBuckets, DerivedHolding } from "../types";
import type { InvestmentSummary } from "../derivedTypes";
import type {
  BenchmarkStats,
  RangeKey,
  RiskMetrics,
  SavingsStats,
} from "../analytics";
import { RANGE_DESCRIPTIONS, RANGE_KEYS, RANGE_LABELS } from "../analytics";
import { ANALYTICS } from "../constants";
import type { LedgerSummary } from "../ledger/summary";
import type { PortfolioSnapshot } from "../utils";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
} from "../utils";
import { METRIC_INFO, type MetricInfo } from "../metricInfo";
import { goTo, holdingsQueryHref, pageHref, stockHref } from "../routes";
import { StatCard } from "../components/ui/StatCard";
import { InfoTip } from "../components/ui/InfoTip";
import { Sparkline } from "../components/ui/Sparkline";
import { ChipGroup } from "../components/ui/ChipGroup";
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
  /** Cost of the positions held today. Labelled "Open position cost". */
  costBasis: number;
  nonCashCount: number;
  portfolio: { totalValue: number; totalGainLoss: number; holdings: DerivedHolding[] };
  topHolding?: DerivedHolding;
  cashDraft: CashBuckets;
  cashWeight: number;
  investmentSummary: InvestmentSummary;
  savingsStats: SavingsStats;
  contributionSeries: ContributionPoint[];
  /** Snapshots inside the active range, already sliced by the caller. */
  history: PortfolioSnapshot[];
  /** Total snapshots on record, so a short window can explain itself. */
  totalSnapshotCount: number;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
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
  /** Lifetime ledger roll-up. `ready: false` before the first transaction. */
  ledgerSummary: LedgerSummary;
  hasLedger: boolean;
  cgtReserve: number;
  ledgerCash: number;
  dayPnL: number;
  /** Combined weight of the three largest positions. */
  top3Weight: number;
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

/**
 * A band heading. The numbered kicker is what turns a stack of panels into a
 * readable outline — each band answers exactly one question.
 */
function BandLabel({ index, title, question }: { index: string; title: string; question: string }) {
  return (
    <div className="band-label">
      <span className="band-label-index">{index}</span>
      <h2 className="band-label-title">{title}</h2>
      <span className="section-lede">{question}</span>
    </div>
  );
}

/**
 * Why a windowed statistic can't be computed yet. A bare "—" reads as breakage,
 * so say what's missing: the window, not the feature, is the problem.
 */
function shortWindowNote(
  snapshotsInWindow: number,
  needed: number,
  range: RangeKey,
  totalSnapshots: number,
): string {
  if (range === "all") {
    return `Needs ${needed}+ daily snapshots — ${totalSnapshots} recorded so far.`;
  }
  return `${RANGE_LABELS[range]} window has ${snapshotsInWindow} snapshot${
    snapshotsInWindow === 1 ? "" : "s"
  } — needs ${needed}+. Try a wider range.`;
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
  totalSnapshotCount,
  range,
  onRangeChange,
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
  ledgerSummary,
  hasLedger,
  cgtReserve,
  ledgerCash,
  dayPnL,
  top3Weight,
}: OverviewPageProps) {
  const rm = riskMetrics;
  const bm = benchmarkStats;
  const ls = ledgerSummary;

  const rangeLabel = RANGE_DESCRIPTIONS[range];
  const riskNote = shortWindowNote(history.length, 3, range, totalSnapshotCount);
  const benchNote = shortWindowNote(history.length, 3, range, totalSnapshotCount);

  // Annualizing a one-month window produces a number nobody should act on, so
  // the CAGR line is withheld until there is roughly a quarter of data.
  //
  // Sharpe is gated on the same threshold because it is *derived* from CAGR
  // ((cagr − riskFree) / volatility) — a handful of snapshots annualizes into a
  // Sharpe in the thousands, which is noise wearing a decimal point.
  const cagrTrustworthy = history.length >= ANALYTICS.MIN_ANNUALIZE_SNAPSHOTS;

  const rangeChips = (
    <ChipGroup
      ariaLabel="Date range"
      className="range-bar"
      value={range}
      onChange={onRangeChange}
      options={RANGE_KEYS.map((key) => ({ value: key, label: RANGE_LABELS[key] }))}
    />
  );

  /** Net P&L falls back to unrealized-only until the ledger exists. */
  const netPnl = ls.ready ? ls.netTotal : portfolio.totalGainLoss;
  const netPnlDetail = ls.ready
    ? `${formatSignedPercent(ls.netReturnPct, 1)} on ${formatCompactCurrency(ls.contributions)} of capital · lifetime`
    : "Unrealized only — record trades on the Ledger tab";

  const deployableCash = ledgerCash - cgtReserve;

  // Treemap and ranked bars carry either a ticker or a sector depending on the
  // mode, so they resolve to different destinations: a stock detail, or Holdings
  // pre-filtered to that sector.
  const allocHref = (key: string) =>
    treemapMode === "ticker" ? stockHref(key) : holdingsQueryHref(key);

  return (
    <>
      {/* ---- A · Position: where do I stand? ---- */}
      <section className="overview-band">
        <div className="band-header">
          <BandLabel index="01" title="Position" question="Where do I stand?" />
          {rangeChips}
        </div>
        <div className="stats-grid kpi-four">
          <StatCard
            label="Portfolio value"
            value={formatCurrency(portfolio.totalValue)}
            detail={`${formatCurrency(equityMarketValue)} in ${nonCashCount} position${nonCashCount === 1 ? "" : "s"} + ${formatCurrency(cashDraft.available)} cash`}
            series={valueSeries}
            seriesTone="accent"
            delta={`${dayPnL >= 0 ? "+" : "−"}${formatCurrency(Math.abs(dayPnL))} today`}
            deltaTone={dayPnL >= 0 ? "positive" : "negative"}
            info={METRIC_INFO.portfolioValue}
          />
          <StatCard
            label="Net P&L"
            value={formatCurrency(netPnl)}
            detail={netPnlDetail}
            tone={netPnl >= 0 ? "positive" : "negative"}
            series={pnlSeries}
            seriesTone={netPnl >= 0 ? "positive" : "negative"}
            info={ls.ready ? METRIC_INFO.netTotalPnl : METRIC_INFO.unrealizedPl}
          />
          <StatCard
            label="True return (TWR)"
            value={rm.ready ? formatSignedPercent(rm.twrReturn * 100, 1) : "—"}
            detail={
              rm.ready
                ? cagrTrustworthy
                  ? `${formatSignedPercent(rm.cagr * 100, 1)} annualized · ${rangeLabel}`
                  : `Over the ${rangeLabel} — too short to annualize`
                : riskNote
            }
            tone={rm.twrReturn >= 0 ? "positive" : "negative"}
            series={rm.series.twr}
            seriesTone={rm.twrReturn >= 0 ? "positive" : "negative"}
            info={METRIC_INFO.trueReturn}
          />
          <StatCard
            label="vs KSE100"
            value={bm.ready ? formatSignedPercent(bm.alpha * 100, 1) : "—"}
            detail={
              bm.ready
                ? `you ${formatSignedPercent(bm.portReturn * 100, 1)} · index ${formatSignedPercent(bm.benchReturn * 100, 1)}`
                : benchNote
            }
            tone={bm.alpha >= 0 ? "positive" : "negative"}
            info={METRIC_INFO.alpha}
          />
        </div>
      </section>

      {/* ---- B · Ledger truth: what is that made of? ---- */}
      <section className="overview-band">
        <div className="band-header">
          <BandLabel
            index="02"
            title="Ledger truth"
            question="What is that number made of?"
          />
          <span className="panel-meta">lifetime · not affected by range</span>
        </div>
        <article className="panel ledger-truth">
          {!hasLedger || !ls.ready ? (
            <p className="empty-state">
              Record your trades on the Ledger tab and realized profit, dividends,
              fees and taxes all break out here.{" "}
              <a className="button button-sm" href={pageHref("ledger")}>
                Open Ledger
              </a>
            </p>
          ) : (
            <>
              {/* The reconciliation. Fees and taxes are context, NOT subtrahends:
                  they are already deducted inside realized and dividends. */}
              <div className="recon-row">
                <div className="recon-term">
                  <span>Realized</span>
                  <strong className={`num ${ls.realized >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(ls.realized)}
                  </strong>
                </div>
                <span className="recon-op">+</span>
                <div className="recon-term">
                  <span>Unrealized</span>
                  <strong className={`num ${ls.unrealized >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(ls.unrealized)}
                  </strong>
                </div>
                <span className="recon-op">+</span>
                <div className="recon-term">
                  <span>Dividends</span>
                  <strong className="num">{formatCurrency(ls.dividends)}</strong>
                </div>
                <span className="recon-op">=</span>
                <div className="recon-term recon-term--total">
                  <span>Net P&amp;L</span>
                  <strong className={`num ${ls.netTotal >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(ls.netTotal)}
                  </strong>
                </div>
              </div>
              <p className="recon-note">
                Costs are already deducted above: {formatCurrency(ls.feesPaid)} brokerage
                and {formatCurrency(ls.taxesBooked)} tax, a {ls.feeDragPct.toFixed(2)}% drag
                on the {formatCompactCurrency(ls.contributions)} you put in.
              </p>

              <div className="kpi-grid">
                <a className="kpi-tile kpi-tile-link" href={pageHref("stocks")}>
                  <KpiLabel label="Realized" info={METRIC_INFO.realizedPnl} />
                  <strong className={`num ${ls.realized >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(ls.realized)}
                  </strong>
                  <span>
                    {ls.closedTrades} closed sale{ls.closedTrades === 1 ? "" : "s"} ·{" "}
                    {ls.closedPositions} position{ls.closedPositions === 1 ? "" : "s"} exited
                  </span>
                </a>
                <a className="kpi-tile kpi-tile-link" href={pageHref("stocks")}>
                  <KpiLabel label="Unrealized" info={METRIC_INFO.unrealizedPl} />
                  <strong className={`num ${ls.unrealized >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(ls.unrealized)}
                  </strong>
                  <span>
                    across {ls.openPositions} open position
                    {ls.openPositions === 1 ? "" : "s"}
                  </span>
                </a>
                <a className="kpi-tile kpi-tile-link" href={pageHref("stocks")}>
                  <KpiLabel label="Net if sold today" info={METRIC_INFO.netIfSoldToday} />
                  <strong className={`num ${ls.netIfSoldToday >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(ls.netIfSoldToday)}
                  </strong>
                  <span>
                    after {formatCompactCurrency(ls.unrealized - ls.netIfSoldToday)} exit costs
                  </span>
                </a>
                <a className="kpi-tile kpi-tile-link" href={pageHref("tax")}>
                  <KpiLabel label="Dividends" info={METRIC_INFO.dividendsReceived} />
                  <strong className="num">{formatCurrency(ls.dividends)}</strong>
                  <span>after withholding</span>
                </a>
                <a className="kpi-tile kpi-tile-link" href={pageHref("settings")}>
                  <KpiLabel label="Fees paid" info={METRIC_INFO.feesPaidTotal} />
                  <strong className="num">{formatCurrency(ls.feesPaid)}</strong>
                  <span>
                    {ls.feeDragPct.toFixed(2)}% drag on capital put in
                    <InfoTip
                      title="Fee drag"
                      what={METRIC_INFO.feeDragPortfolio.what}
                      reading={METRIC_INFO.feeDragPortfolio.reading}
                    />
                  </span>
                </a>
                <a className="kpi-tile kpi-tile-link" href={pageHref("tax")}>
                  <KpiLabel label="Taxes booked" info={METRIC_INFO.taxesBooked} />
                  <strong className="num">{formatCurrency(ls.taxesBooked)}</strong>
                  <span>
                    {formatCurrency(cgtReserve)} CGT still reserved
                    <InfoTip
                      title="CGT reserve"
                      what={METRIC_INFO.cgtReserve.what}
                      reading={METRIC_INFO.cgtReserve.reading}
                    />
                  </span>
                </a>
                <div className="kpi-tile">
                  <KpiLabel label="Win rate" info={METRIC_INFO.winRate} />
                  <strong className="num">
                    {ls.closedTrades > 0 ? `${ls.winRatePct.toFixed(0)}%` : "—"}
                  </strong>
                  <span>
                    {ls.closedTrades > 0
                      ? `${ls.wins}/${ls.closedTrades} sales · best ${formatCompactCurrency(ls.bestTrade)}, worst ${formatCompactCurrency(ls.worstTrade)}`
                      : "No completed sales yet"}
                  </span>
                </div>
                <a className="kpi-tile kpi-tile-link" href={pageHref("income")}>
                  <KpiLabel label="Deployable cash" info={METRIC_INFO.deployableCash} />
                  <strong className={`num ${deployableCash >= 0 ? "" : "negative"}`}>
                    {formatCurrency(deployableCash)}
                  </strong>
                  <span>
                    {formatCurrency(ledgerCash)} cash less {formatCurrency(cgtReserve)} CGT
                  </span>
                </a>
              </div>

              {ls.topContributor && ls.worstContributor ? (
                <div className="contributor-row">
                  <a className="contributor" href={stockHref(ls.topContributor.ticker)}>
                    <span>Best contributor</span>
                    <strong className="ticker-link">{ls.topContributor.ticker}</strong>
                    <span className="num positive">
                      {formatCurrency(ls.topContributor.totalNet)}
                    </span>
                  </a>
                  <a className="contributor" href={stockHref(ls.worstContributor.ticker)}>
                    <span>Worst contributor</span>
                    <strong className="ticker-link">{ls.worstContributor.ticker}</strong>
                    <span
                      className={`num ${ls.worstContributor.totalNet >= 0 ? "positive" : "negative"}`}
                    >
                      {formatCurrency(ls.worstContributor.totalNet)}
                    </span>
                  </a>
                </div>
              ) : null}
            </>
          )}
        </article>
      </section>

      {/* ---- C · History: how did it get here? ---- */}
      <section className="overview-band">
        <div className="band-header">
          <BandLabel index="03" title="History" question="How did it get here?" />
          {rangeChips}
        </div>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Portfolio value over time</p>
              <h2>{RANGE_LABELS[range]} · {rangeLabel}</h2>
            </div>
            <span className="panel-meta">
              {history.length} of {totalSnapshotCount} snapshot
              {totalSnapshotCount === 1 ? "" : "s"} · 1/day end-of-day (23:59 PKT)
            </span>
          </div>
          <PortfolioHistoryChart
            snapshots={history}
            lastFetchedIso={lastFetchedAt}
            contributions={contributionSeries}
          />
        </article>
      </section>

      {/* ---- D · Today: what is moving right now? ---- */}
      <section className="overview-band">
        <BandLabel index="04" title="Today" question="What is moving right now?" />
        <div className="dashboard-grid dual">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Heatmap</p>
                <h2>Day change · sized by weight</h2>
              </div>
              <span className="panel-meta">green up · red down · click to drill in</span>
            </div>
            <Heatmap
              items={heatmapItems}
              onSelectTicker={(ticker) => goTo(stockHref(ticker))}
            />
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
                  <a
                    key={holding.id}
                    className="suggestion-row suggestion-row--link"
                    href={stockHref(holding.ticker)}
                  >
                    <strong className="ticker-link">{holding.ticker}</strong>
                    <span className={`num ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                      {holding.dayChangePct.toFixed(2)}%
                    </span>
                    <small>{holding.name}</small>
                  </a>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      {/* ---- E · Allocation: how is it distributed? ---- */}
      <section className="overview-band">
        <BandLabel index="05" title="Allocation" question="How is it distributed?" />
        <div className="dashboard-grid dual">
          <article className="panel chart-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Weightage</p>
                <h2>Portfolio mix</h2>
              </div>
              <span className="panel-meta">
                {lastFetchedAt
                  ? `Updated ${formatRelativeTime(lastFetchedAt)}`
                  : "Interactive donut"}
              </span>
            </div>
            {fetching ? <div className="chart-skeleton" aria-hidden="true" /> : null}
            <AllocationDonut
              holdings={portfolio.holdings}
              onSelectTicker={(ticker) => goTo(stockHref(ticker))}
            />
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
                <ChipGroup
                  ariaLabel="Group by"
                  value={treemapMode}
                  onChange={setTreemapMode}
                  options={[
                    { value: "sector", label: "Sector" },
                    { value: "ticker", label: "Ticker" },
                  ]}
                />
                <ChipGroup
                  ariaLabel="Chart style"
                  value={allocationView}
                  onChange={setAllocationView}
                  options={[
                    { value: "map", label: "Map", title: "Squarified treemap" },
                    { value: "ranked", label: "Ranked", title: "Sorted horizontal bars" },
                  ]}
                />
              </div>
            </div>
            <p className="panel-meta panel-meta--inline">
              Top 3 = {formatPercent(top3Weight)} of the portfolio
              <InfoTip
                title="Top-3 concentration"
                what={METRIC_INFO.top3Concentration.what}
                reading={METRIC_INFO.top3Concentration.reading}
              />
              {topHolding ? (
                <>
                  {" · largest is "}
                  <a className="ticker-link" href={stockHref(topHolding.ticker)}>
                    {topHolding.ticker}
                  </a>
                  {` at ${formatPercent(topHolding.weight)}`}
                </>
              ) : null}
            </p>
            {allocationView === "map" ? (
              <>
                <AllocationTreemap
                  items={treemapItems}
                  onSelect={(key) => goTo(allocHref(key))}
                />
                {/* Canvases can't be focused and must not be given tabIndex, so
                    point keyboard users at the Ranked view, which is the same
                    data as a list of links. */}
                <p className="sr-only">
                  Treemap tiles are clickable. Switch to the Ranked view for a
                  keyboard-navigable list of the same positions.
                </p>
              </>
            ) : (
              <RankedAllocation items={treemapItems} hrefFor={allocHref} />
            )}
          </article>
        </div>
      </section>

      {/* ---- F · Contribution: who moved the needle? ---- */}
      <section className="overview-band">
        <BandLabel index="06" title="Contribution" question="Who moved the needle?" />
        <div className="insight-grid dual">
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
                    <a
                      key={holding.id}
                      className="waterfall-row waterfall-row--link"
                      href={stockHref(holding.ticker)}
                      aria-label={`${holding.ticker}: ${formatCurrency(holding.gainLoss)}, ${formatSignedPercent(contribution, 1)} of total P&L`}
                    >
                      <strong className="ticker-link">{holding.ticker}</strong>
                      <div className="waterfall-track waterfall-track--centered" aria-hidden="true">
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
                    </a>
                  );
                })
              )}
            </div>
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
            <div className="growth-footnotes">
              <span>
                Net deposits {formatCurrency(investmentSummary.totalInvested)}
                <InfoTip
                  title="Net deposits"
                  what={METRIC_INFO.netDeposits.what}
                  reading={METRIC_INFO.netDeposits.reading}
                />
              </span>
              <span>
                Open position cost {formatCurrency(costBasis)}
                <InfoTip
                  title="Open position cost"
                  what={METRIC_INFO.openPositionCost.what}
                  reading={METRIC_INFO.openPositionCost.reading}
                />
              </span>
              <span>
                Cash {formatCurrency(cashDraft.available)} ({formatPercent(cashWeight)})
                <InfoTip
                  title="Cash"
                  what={METRIC_INFO.cash.what}
                  reading={METRIC_INFO.cash.reading}
                />
              </span>
            </div>
          </article>
        </div>
      </section>

      {/* ---- G · Risk: diagnostic, so it sits last ---- */}
      <section className="overview-band">
        <BandLabel index="07" title="Risk" question="How rough was the ride?" />
        <article className="panel risk-panel">
          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Performance &amp; risk profile</p>
              <h2>Flow-adjusted (TWR) · {rangeLabel}</h2>
            </div>
            <span className="panel-meta">
              {rm.ready ? `${history.length} daily snapshots` : riskNote}
            </span>
          </div>
          <div className="kpi-grid">
            <div className="kpi-tile">
              <KpiLabel label="Max drawdown" info={METRIC_INFO.maxDrawdown} />
              <strong className="num negative">
                {pctOrDash(rm.ready, formatPercent(rm.maxDrawdown))}
              </strong>
              {rm.ready ? <Sparkline data={rm.series.drawdown} tone="negative" fill /> : null}
              <span>Peak-to-trough</span>
            </div>
            <div className="kpi-tile">
              <KpiLabel label="Volatility" info={METRIC_INFO.volatility} />
              <strong className="num">
                {pctOrDash(rm.ready, formatPercent(rm.volatilityAnnual))}
              </strong>
              {rm.ready ? <Sparkline data={rm.series.dailyReturns} tone="warn" /> : null}
              <span>Annualized</span>
            </div>
            <div className="kpi-tile">
              <KpiLabel label="Sharpe" info={METRIC_INFO.sharpe} />
              <strong className={`num ${rm.sharpe >= 1 ? "positive" : rm.sharpe < 0 ? "negative" : ""}`}>
                {rm.ready && cagrTrustworthy ? rm.sharpe.toFixed(2) : "—"}
              </strong>
              {rm.ready ? <Sparkline data={rm.series.twr} tone="accent" /> : null}
              <span>
                {rm.ready && !cagrTrustworthy
                  ? `Needs ${ANALYTICS.MIN_ANNUALIZE_SNAPSHOTS}+ snapshots to annualize`
                  : "Risk-adjusted return"}
              </span>
            </div>
            <div className="kpi-tile">
              <KpiLabel label="Best day" info={METRIC_INFO.bestDay} />
              <strong className="num positive">
                {rm.ready ? formatSignedPercent(rm.bestDay * 100, 2) : "—"}
              </strong>
              <span>Largest daily gain</span>
            </div>
            <div className="kpi-tile">
              <KpiLabel label="Worst day" info={METRIC_INFO.worstDay} />
              <strong className="num negative">
                {rm.ready ? formatSignedPercent(rm.worstDay * 100, 2) : "—"}
              </strong>
              <span>Largest daily loss</span>
            </div>
            <div className="kpi-tile">
              <KpiLabel label="Beta" info={METRIC_INFO.beta} />
              <strong className="num">{bm.ready ? bm.beta.toFixed(2) : "—"}</strong>
              <span>{bm.ready ? "vs KSE100" : benchNote}</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
