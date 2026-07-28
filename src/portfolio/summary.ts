import type { DerivedHolding, InvestmentEntry, SectorBucket } from "../types";
import type { StockLedgerRow } from "../ledger/perStock";
import type { TaxYear } from "../ledger/tax";
import {
  type PortfolioSnapshot,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
} from "../utils";

export type SummaryDepth = "headline" | "compact" | "comprehensive";

export type SummaryTargetRow = {
  mode: "sector" | "ticker";
  key: string;
  currentWeight: number;
  targetWeight: number;
  drift: number;
  absDrift: number;
  gapValue: number;
  status: "critical" | "warn" | "ontrack";
};

export type SummaryDividend = {
  ticker: string;
  date: string;
  dps: number;
  expectedIncome: number;
};

export type SummaryInvestmentStats = {
  totalInvested: number;
  latestValue: number;
  pnlValue: number;
  pnlPct: number;
  count: number;
};

export type PortfolioSummaryInput = {
  generatedAt: string;
  lastFetchedAt: string | null;
  totals: {
    totalValue: number;
    equityMarketValue: number;
    totalCost: number;
    unrealizedPnL: number;
    dayPnL: number;
  };
  cash: { available: number; weight: number };
  holdings: DerivedHolding[];
  sectors: SectorBucket[];
  targets: SummaryTargetRow[];
  upcomingDividends: SummaryDividend[];
  investments: SummaryInvestmentStats;
  investmentLedger: InvestmentEntry[];
  history: PortfolioSnapshot[];
  twrLatest: number | null;
  /** Per-stock ledger rows. Empty (or absent) before the ledger is in use. */
  stocks?: StockLedgerRow[];
  /** Fiscal-year tax breakdown. Empty (or absent) with no realized activity. */
  taxYears?: TaxYear[];
};

function mdTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return rows.length === 0 ? `${head}\n${sep}` : `${head}\n${sep}\n${body}`;
}

function signedCurrency(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function dayPnLFor(h: DerivedHolding): number {
  const denom = 100 + h.dayChangePct;
  if (denom === 0) return 0;
  return (h.marketValue * h.dayChangePct) / denom;
}

function statusLabel(row: SummaryTargetRow): string {
  const action = row.gapValue > 0 ? "BUY" : row.gapValue < 0 ? "SELL" : "—";
  if (row.status === "ontrack") return "on track";
  return `${row.status} (${action})`;
}

function renderHeader(input: PortfolioSummaryInput): string {
  const date = formatDateLong(input.generatedAt);
  const lines = [`# Portfolio Summary — ${date}`];
  if (input.lastFetchedAt) {
    lines.push(
      `_Last price refresh: ${formatDateLong(input.lastFetchedAt)} (${formatRelativeTime(input.lastFetchedAt)})_`,
    );
  }
  return lines.join("\n");
}

function renderHeadline(input: PortfolioSummaryInput): string {
  const { totals, cash } = input;
  const costRef = totals.totalCost > 0 ? totals.totalCost : totals.equityMarketValue;
  const pnlPct = costRef > 0 ? (totals.unrealizedPnL / costRef) * 100 : 0;
  const dayPct =
    totals.equityMarketValue > 0
      ? (totals.dayPnL / (totals.equityMarketValue - totals.dayPnL)) * 100
      : 0;

  return [
    "## Headline",
    `- Total value (incl. cash): ${formatCurrency(totals.totalValue)}`,
    `- Equity market value: ${formatCurrency(totals.equityMarketValue)}`,
    `- Cost basis: ${formatCurrency(totals.totalCost)}`,
    `- Unrealized P/L: ${signedCurrency(totals.unrealizedPnL)} (${formatSignedPercent(pnlPct, 2)})`,
    `- Day P/L: ${signedCurrency(totals.dayPnL)} (${formatSignedPercent(dayPct, 2)})`,
    `- Cash: ${formatCurrency(cash.available)} (${formatPercent(cash.weight)} of portfolio)`,
  ].join("\n");
}

function renderTopHoldings(input: PortfolioSummaryInput, limit = 5): string {
  if (input.holdings.length === 0) return "## Top holdings\n_Empty portfolio_";
  const top = [...input.holdings]
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, limit);
  const lines = top.map(
    (h) =>
      `- **${h.ticker}** ${h.name} · ${formatCurrency(h.marketValue)} · ${formatPercent(h.weight)} · ${formatSignedPercent(h.dayChangePct, 2)} day`,
  );
  return ["## Top holdings", ...lines].join("\n");
}

function renderHoldingsTable(input: PortfolioSummaryInput): string {
  if (input.holdings.length === 0) return "## Holdings\n_Empty portfolio_";
  const sorted = [...input.holdings].sort((a, b) => b.marketValue - a.marketValue);
  const rows = sorted.map((h) => {
    const day = dayPnLFor(h);
    return [
      h.ticker,
      h.name,
      h.sector,
      h.shares.toLocaleString(),
      formatCurrency(h.costBasis),
      formatCurrency(h.price),
      formatCurrency(h.marketValue),
      formatPercent(h.weight),
      formatSignedPercent(h.dayChangePct, 2),
      signedCurrency(day),
      signedCurrency(h.gainLoss),
    ];
  });
  return [
    "## Holdings",
    mdTable(
      [
        "Ticker",
        "Name",
        "Sector",
        "Shares",
        "Avg cost",
        "Price",
        "Market value",
        "Weight",
        "Day %",
        "Day P/L",
        "Unrealized P/L",
      ],
      rows,
    ),
  ].join("\n");
}

function renderSectors(input: PortfolioSummaryInput): string {
  if (input.sectors.length === 0) return "";
  const sorted = [...input.sectors].sort((a, b) => b.value - a.value);
  const rows = sorted.map((s) => [
    s.sector,
    formatCurrency(s.value),
    formatPercent(s.weight),
    String(s.holdings),
  ]);
  return [
    "## Sector allocation",
    mdTable(["Sector", "Value", "Weight", "Positions"], rows),
  ].join("\n");
}

function renderTargets(input: PortfolioSummaryInput): string {
  if (input.targets.length === 0) return "";
  const sorted = [...input.targets].sort((a, b) => b.absDrift - a.absDrift);
  const rows = sorted.map((t) => [
    t.key,
    t.mode,
    formatPercent(t.currentWeight),
    formatPercent(t.targetWeight),
    formatSignedPercent(t.drift * 100, 2),
    signedCurrency(t.gapValue),
    statusLabel(t),
  ]);
  return [
    "## Targets vs current",
    mdTable(
      ["Key", "Mode", "Current", "Target", "Drift", "Gap value", "Status"],
      rows,
    ),
  ].join("\n");
}

function renderPerformance(input: PortfolioSummaryInput): string {
  const inv = input.investments;
  const cost = input.totals.totalCost;
  const simpleReturnPct =
    cost > 0 ? (input.totals.unrealizedPnL / cost) * 100 : 0;

  const lines = ["## Performance"];
  lines.push(`- Simple cumulative return: ${formatSignedPercent(simpleReturnPct, 2)}`);
  if (inv.count >= 1) {
    lines.push(
      `- Invest-tracker P/L: ${signedCurrency(inv.pnlValue)} (${formatSignedPercent(inv.pnlPct, 2)})`,
    );
  }
  if (input.twrLatest != null) {
    lines.push(`- TWR index (latest): ${input.twrLatest.toFixed(2)} (base 100)`);
  } else {
    lines.push("- TWR index (latest): —");
  }
  lines.push(`- History snapshots: ${input.history.length}`);
  return lines.join("\n");
}

function renderDividends(input: PortfolioSummaryInput, limit: number): string {
  if (input.upcomingDividends.length === 0) {
    return "## Upcoming dividends\n_No upcoming dividends in window._";
  }
  const sorted = [...input.upcomingDividends]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
  const rows = sorted.map((d) => [
    d.ticker,
    formatDateShort(d.date),
    formatCurrency(d.dps),
    formatCurrency(d.expectedIncome),
  ]);
  return [
    `## Upcoming dividends (next ${sorted.length})`,
    mdTable(["Ticker", "Book closure", "DPS", "Expected income"], rows),
  ].join("\n");
}

function renderHistory(input: PortfolioSummaryInput, limit = 14): string {
  if (input.history.length === 0) return "";
  const sorted = [...input.history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  const rows = sorted.map((s) => [
    formatDateShort(s.date),
    formatCurrency(s.totalValue),
    formatCurrency(s.totalCost),
    signedCurrency(s.gainLoss),
  ]);
  return [
    `## Recent history (last ${sorted.length} snapshots)`,
    mdTable(["Date", "Total value", "Cost", "Gain/Loss"], rows),
  ].join("\n");
}

function renderInvestmentLedger(input: PortfolioSummaryInput): string {
  if (input.investmentLedger.length === 0) return "";
  const sorted = [...input.investmentLedger].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  let running = 0;
  const rows = sorted.map((e) => {
    running += e.amount;
    return [
      formatDateShort(e.date),
      e.label || "—",
      signedCurrency(e.amount),
      formatCurrency(running),
      formatCurrency(e.valueEom),
    ];
  });
  return [
    "## Investment ledger",
    mdTable(
      ["Date", "Label", "Amount", "Cumulative invested", "Value EOM"],
      rows,
    ),
  ].join("\n");
}

function renderStockLedger(input: PortfolioSummaryInput): string {
  const stocks = input.stocks ?? [];
  if (stocks.length === 0) return "";

  const rows = stocks.map((s) => [
    s.ticker,
    s.shares.toLocaleString(),
    formatCurrency(s.avgCost),
    signedCurrency(s.unrealized),
    signedCurrency(s.realized),
    formatCurrency(s.dividends),
    signedCurrency(s.totalNet),
    formatSignedPercent(s.totalReturnPct, 1),
    formatCurrency(s.feesPaid + s.taxesPaid),
  ]);

  return [
    "## Per-stock P/L (net of fees and taxes)",
    mdTable(
      [
        "Ticker",
        "Shares",
        "Avg cost",
        "Unrealized",
        "Realized",
        "Dividends",
        "Net P/L",
        "Return",
        "Fees + taxes",
      ],
      rows,
    ),
  ].join("\n");
}

function renderTaxes(input: PortfolioSummaryInput): string {
  const years = input.taxYears ?? [];
  if (years.length === 0) return "";

  const rows = years.map((y) => [
    y.fy,
    formatCurrency(y.gains),
    formatCurrency(y.losses),
    formatCurrency(y.carryIn),
    formatCurrency(y.taxable),
    formatCurrency(y.cgtDue),
    formatCurrency(y.cgtCharged),
    signedCurrency(y.cgtRefundable),
    formatCurrency(y.dividendWht),
    formatCurrency(y.carryOut),
  ]);

  return [
    "## Taxes by fiscal year",
    mdTable(
      [
        "FY",
        "Gains",
        "Losses",
        "Carried in",
        "Taxable",
        "CGT due",
        "CGT deducted",
        "Refundable",
        "Dividend WHT",
        "Carried out",
      ],
      rows,
    ),
  ].join("\n");
}

export function buildPortfolioSummary(
  input: PortfolioSummaryInput,
  depth: SummaryDepth,
): string {
  const sections: string[] = [renderHeader(input), renderHeadline(input)];

  if (depth === "headline") {
    sections.push(renderTopHoldings(input, 5));
    sections.push(renderPerformance(input));
    return sections.filter(Boolean).join("\n\n") + "\n";
  }

  sections.push(renderHoldingsTable(input));
  const sectors = renderSectors(input);
  if (sectors) sections.push(sectors);
  const targets = renderTargets(input);
  if (targets) sections.push(targets);
  sections.push(renderPerformance(input));

  if (depth === "compact") {
    sections.push(renderDividends(input, 4));
    return sections.filter(Boolean).join("\n\n") + "\n";
  }

  const stockLedger = renderStockLedger(input);
  if (stockLedger) sections.push(stockLedger);
  const taxes = renderTaxes(input);
  if (taxes) sections.push(taxes);
  sections.push(renderDividends(input, 10));
  const history = renderHistory(input, 14);
  if (history) sections.push(history);
  const ledger = renderInvestmentLedger(input);
  if (ledger) sections.push(ledger);

  return sections.filter(Boolean).join("\n\n") + "\n";
}
