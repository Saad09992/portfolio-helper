// Server-side smoke render of the dashboard. OverviewPage had no test before the
// band restructure, and it is the page that touches the most derived data — so
// this covers the three states that actually differ: nothing recorded, holdings
// but no ledger, and a full ledger.
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { OverviewPage, type OverviewPageProps } from "./OverviewPage";
import { replayLedger } from "../ledger/replay";
import { buildStockRows } from "../ledger/perStock";
import { buildLedgerSummary } from "../ledger/summary";
import { buildTaxYears, cgtReserve as cgtReserveOf } from "../ledger/tax";
import { DEFAULT_FEE_CONFIG } from "../ledger/feeConfig";
import { mixedPrices, mixedTransactions } from "../ledger/testFixtures";
import { computePortfolio } from "../utils";
import { deriveHoldings } from "../ledger/deriveHoldings";
import { computeRiskMetrics, computeBenchmarkStats, computeSavingsStats } from "../analytics";
import type { PortfolioSnapshot } from "../utils";

const AS_OF = "2026-01-01";

const state = replayLedger(mixedTransactions, DEFAULT_FEE_CONFIG);
const stockRows = buildStockRows(state, mixedPrices, DEFAULT_FEE_CONFIG, AS_OF);
const ledgerSummary = buildLedgerSummary(stockRows);
const reserve = cgtReserveOf(buildTaxYears(state, DEFAULT_FEE_CONFIG));
const portfolio = computePortfolio(deriveHoldings(state));

const snapshots: PortfolioSnapshot[] = [
  { date: "2025-11-01", totalValue: 5_000_000, totalCost: 4_800_000, gainLoss: 200_000, kse100: 100_000 },
  { date: "2025-11-02", totalValue: 5_100_000, totalCost: 4_800_000, gainLoss: 300_000, kse100: 101_000 },
  { date: "2025-11-03", totalValue: 5_050_000, totalCost: 4_800_000, gainLoss: 250_000, kse100: 100_500 },
  { date: "2025-11-04", totalValue: 5_300_000, totalCost: 4_800_000, gainLoss: 500_000, kse100: 102_000 },
];

const empty: OverviewPageProps = {
  equityMarketValue: 0,
  costBasis: 0,
  nonCashCount: 0,
  portfolio: { totalValue: 0, totalGainLoss: 0, holdings: [] },
  nonCashHoldings: [],
  topHolding: undefined,
  topHoldingWeight: 0,
  cashDraft: { available: 0 },
  cashWeight: 0,
  investmentSummary: { totalInvested: 0, latestValue: 0, pnlValue: 0, pnlPct: 0, count: 0 },
  savingsStats: computeSavingsStats([]),
  contributionSeries: [],
  history: [],
  totalSnapshotCount: 0,
  range: "all",
  onRangeChange: () => {},
  lastFetchedAt: null,
  fetching: false,
  treemapMode: "sector",
  setTreemapMode: () => {},
  allocationView: "map",
  setAllocationView: () => {},
  treemapItems: [],
  waterfallRows: [],
  maxWaterfall: 1,
  topMovers: [],
  riskMetrics: computeRiskMetrics([], 0.11, 365),
  valueSeries: [],
  pnlSeries: [],
  benchmarkStats: computeBenchmarkStats([]),
  heatmapItems: [],
  ledgerSummary: buildLedgerSummary([]),
  hasLedger: false,
  cgtReserve: 0,
  withheldCash: 0,
  ledgerCash: 0,
  dayPnL: 0,
  top3Weight: 0,
  // The fixtures render Advanced so the band assertions below cover the whole
  // page; the Basic cases opt in explicitly.
  viewMode: "advanced",
  onViewModeChange: () => {},
};

const full: OverviewPageProps = {
  ...empty,
  equityMarketValue: portfolio.totalValue,
  costBasis: 5_600_000,
  nonCashCount: portfolio.holdings.length,
  portfolio,
  nonCashHoldings: portfolio.holdings,
  topHolding: portfolio.holdings[0],
  cashDraft: { available: state.cash },
  cashWeight: 0.1,
  history: snapshots,
  totalSnapshotCount: snapshots.length,
  riskMetrics: computeRiskMetrics(snapshots, 0.11, 365),
  benchmarkStats: computeBenchmarkStats(snapshots),
  valueSeries: snapshots.map((s) => s.totalValue),
  pnlSeries: snapshots.map((s) => s.gainLoss),
  waterfallRows: portfolio.holdings,
  maxWaterfall: 1_000_000,
  topMovers: portfolio.holdings,
  treemapItems: portfolio.holdings.map((h) => ({
    key: h.ticker,
    label: h.ticker,
    value: h.marketValue,
    weight: h.weight,
  })),
  heatmapItems: portfolio.holdings.map((h) => ({
    ticker: h.ticker,
    group: h.sector,
    value: h.marketValue,
    weight: h.weight,
    dayChangePct: h.dayChangePct,
  })),
  ledgerSummary,
  hasLedger: true,
  cgtReserve: reserve,
  ledgerCash: state.cash,
  dayPnL: 12_345,
  top3Weight: 0.72,
};

describe("OverviewPage", () => {
  it("renders every band with an empty portfolio and no NaN", () => {
    const html = renderToString(<OverviewPage {...empty} />);

    // All seven bands present.
    for (const title of [
      "Position",
      "Ledger truth",
      "History",
      "Today",
      "Allocation",
      "Contribution",
      "Risk",
    ]) {
      expect(html).toContain(title);
    }
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("prompts for the ledger instead of showing zeroed ledger stats", () => {
    const html = renderToString(<OverviewPage {...empty} />);
    expect(html).toContain("Open Ledger");
    expect(html).toContain('href="#/ledger"');
    // The reconciliation strip must not render as a row of Rs 0.00.
    expect(html).not.toContain("recon-row");
  });

  it("explains why windowed risk stats are unavailable rather than showing a bare dash", () => {
    const html = renderToString(<OverviewPage {...empty} />);
    expect(html).toContain("daily snapshots");
  });

  it("renders the reconciliation and ledger tiles with a full ledger", () => {
    const html = renderToString(<OverviewPage {...full} />);
    expect(html).toContain("recon-row");
    expect(html).toContain("Net P&amp;L");
    expect(html).toContain("Taxes booked");
    expect(html).toContain("Deployable cash");
    expect(html).toContain("Win rate");
    expect(html).toContain("of brokerage is already inside");
    expect(html).not.toContain("NaN");
  });

  /**
   * The strip is shown as an equation, so a term that is in `netTotal` but not
   * on screen reads as arithmetic that does not work. Charges were once exactly
   * that.
   */
  it("shows the charges and tax-paid terms when there are any", () => {
    const charged = { ...full, ledgerSummary: { ...full.ledgerSummary, expenses: 10_000 } };
    expect(renderToString(<OverviewPage {...charged} />)).toContain("Charges");

    const taxed = { ...full, ledgerSummary: { ...full.ledgerSummary, taxPaid: 4_000 } };
    expect(renderToString(<OverviewPage {...taxed} />)).toContain("Tax paid");

    const clean = renderToString(<OverviewPage {...full} />);
    expect(clean).not.toContain(">Charges<");
    expect(clean).not.toContain(">Tax paid<");
  });

  it("cross-links tickers into the stock detail route", () => {
    const html = renderToString(<OverviewPage {...full} />);
    expect(html).toContain('href="#/stocks/ENGRO"');
    // Best and worst contributor both link out.
    expect(html).toContain("Best contributor");
    expect(html).toContain("Worst contributor");
  });

  it("labels the ledger band as lifetime so the range chips don't mislead", () => {
    const html = renderToString(<OverviewPage {...full} />);
    expect(html).toContain("not affected by range");
  });

  it("names the active range and drops the CAGR line on a short window", () => {
    const html = renderToString(<OverviewPage {...full} range="3m" />);
    expect(html).toContain("3M");
    // 4 snapshots is far short of the ~60 needed to annualize honestly.
    expect(html).toContain("too short to annualize");
    expect(html).not.toContain("annualized");
  });

  it("distinguishes net deposits from open position cost", () => {
    const html = renderToString(<OverviewPage {...full} />);
    expect(html).toContain("Net deposits");
    expect(html).toContain("Open position cost");
    // The ambiguous "Total invested" KPI is gone. ("Cost basis" survives as the
    // history chart's series legend, which is a different, unambiguous use.)
    expect(html).not.toContain("Total invested");
  });

  it("withholds Sharpe on a window too short to annualize", () => {
    // Sharpe is (CAGR − risk-free) / volatility, so a 4-snapshot window would
    // otherwise report a Sharpe in the thousands.
    const html = renderToString(<OverviewPage {...full} />);
    expect(html).toContain("snapshots to annualize");
    expect(html).not.toContain("2114");
  });
});

describe("OverviewPage · Basic mode", () => {
  const basic: OverviewPageProps = { ...full, viewMode: "basic" };

  it("drops the three diagnostic bands", () => {
    const html = renderToString(<OverviewPage {...basic} />);
    for (const gone of [
      "Ledger truth",
      "recon-row",
      "Deployable cash",
      "Contribution",
      "P/L contribution",
      "Max drawdown",
      "Sharpe",
    ]) {
      expect(html).not.toContain(gone);
    }
  });

  it("keeps the four everyday bands, renumbered without gaps", () => {
    const html = renderToString(<OverviewPage {...basic} />);
    for (const title of ["Position", "History", "Today", "Allocation"]) {
      expect(html).toContain(title);
    }
    // Numbered 01-04, not 01, 03, 04, 05.
    for (const index of ["01", "02", "03", "04"]) {
      expect(html).toContain(`>${index}</span>`);
    }
    for (const index of ["05", "06", "07"]) {
      expect(html).not.toContain(`>${index}</span>`);
    }
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("names what Advanced adds instead of just ending short", () => {
    const html = renderToString(<OverviewPage {...basic} />);
    expect(html).toContain("are in Advanced");
    expect(renderToString(<OverviewPage {...full} />)).not.toContain("are in Advanced");
  });

  it("renders the switch in both modes", () => {
    for (const props of [basic, full]) {
      const html = renderToString(<OverviewPage {...props} />);
      expect(html).toContain('aria-label="Detail level"');
      expect(html).toContain(">Basic</button>");
      expect(html).toContain(">Advanced</button>");
    }
  });
});
