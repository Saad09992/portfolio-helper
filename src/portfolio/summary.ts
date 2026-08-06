import type { DerivedHolding, InvestmentEntry, SectorBucket } from "../types";
import type { StockLedgerRow } from "../ledger/perStock";
import type { TaxYear } from "../ledger/tax";
import type { FeeConfig } from "../ledger/feeConfig";
import type {
  BonusTaxCharge,
  DividendReceipt,
  RealizedSlice,
  Transaction,
} from "../ledger/types";
import { computeTradeCosts, tradeValue } from "../ledger/fees";
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
  /** The raw transaction ledger, for the detailed trade log. */
  transactions?: Transaction[];
  /** Realized FIFO slices — per-stock sales detail and per-txn CGT. */
  realized?: RealizedSlice[];
  /** Dividend receipts — per-txn withholding lookup. */
  dividends?: DividendReceipt[];
  /** Bonus-issue tax charges — per-txn tax lookup. */
  bonusTaxes?: BonusTaxCharge[];
  /** Rate set, to itemize per-trade fees in the ledger. */
  feeConfig?: FeeConfig;
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
    formatCurrency(s.price),
    formatCurrency(s.marketValue),
    signedCurrency(s.unrealized),
    signedCurrency(s.realized),
    formatCurrency(s.dividends),
    signedCurrency(s.totalNet),
    formatSignedPercent(s.totalReturnPct, 1),
    formatCurrency(s.feesPaid + s.taxesPaid),
  ]);

  const totalNet = stocks.reduce((sum, s) => sum + s.totalNet, 0);
  const totalCosts = stocks.reduce((sum, s) => sum + s.feesPaid + s.taxesPaid, 0);

  return [
    "## Per-stock P/L (net of fees and taxes)",
    mdTable(
      [
        "Ticker",
        "Shares",
        "Avg cost",
        "Price",
        "Market value",
        "Unrealized",
        "Realized",
        "Dividends",
        "Net P/L",
        "Return",
        "Fees + taxes",
      ],
      rows,
    ),
    "",
    `**Portfolio net P/L: ${signedCurrency(totalNet)}** · total fees + taxes paid: ${formatCurrency(totalCosts)}`,
  ].join("\n");
}

/**
 * A block per stock: the headline metrics, then that stock's realized sales.
 * The one-row table above is the scoreboard; this is the story behind each row.
 */
function renderStockDetail(input: PortfolioSummaryInput): string {
  const stocks = input.stocks ?? [];
  if (stocks.length === 0) return "";

  const salesByTicker = new Map<string, RealizedSlice[]>();
  for (const slice of input.realized ?? []) {
    const list = salesByTicker.get(slice.ticker) ?? [];
    list.push(slice);
    salesByTicker.set(slice.ticker, list);
  }

  const blocks = stocks.map((s) => {
    const lines: string[] = [
      `### ${s.ticker} — ${s.name}${s.isClosed ? " (closed)" : ""}`,
      `- Sector: ${s.sector}`,
      `- Position: ${s.shares.toLocaleString()} shares @ ${formatCurrency(s.avgCost)} avg · market ${formatCurrency(s.marketValue)} @ ${formatCurrency(s.price)}`,
      `- Unrealized: ${signedCurrency(s.unrealized)} · net if sold today: ${signedCurrency(s.netIfSoldToday)}`,
      `- Realized: ${signedCurrency(s.realized)} (${s.closed.count} closed lot${s.closed.count === 1 ? "" : "s"}${s.closed.count > 0 ? `, ${s.closed.winRatePct.toFixed(0)}% winners` : ""})`,
      `- Dividends (net of WHT): ${formatCurrency(s.dividends)}`,
      `- **Net P/L: ${signedCurrency(s.totalNet)}** (${formatSignedPercent(s.totalReturnPct, 1)} on cash invested)`,
      `- Fees + taxes: ${formatCurrency(s.feesPaid + s.taxesPaid)} (${s.feeDragPct.toFixed(2)}% drag)`,
      `- Held: ${s.holdingDays.toLocaleString()}d${s.firstDate ? ` since ${formatDateShort(s.firstDate)}` : ""}`,
    ];

    const sales = salesByTicker.get(s.ticker) ?? [];
    if (sales.length > 0) {
      const saleRows = sales
        .slice()
        .sort((a, b) => a.sellDate.localeCompare(b.sellDate))
        .map((slice) => [
          formatDateShort(slice.sellDate),
          formatDateShort(slice.buyDate),
          slice.shares.toLocaleString(),
          formatCurrency(slice.proceeds),
          formatCurrency(slice.cost),
          signedCurrency(slice.gain),
          `${slice.cgtRatePct}%`,
          formatCurrency(slice.cgt),
        ]);
      lines.push(
        "",
        mdTable(
          ["Sold", "Bought", "Shares", "Proceeds", "Cost", "Gain", "Rate", "CGT"],
          saleRows,
        ),
      );
    }
    return lines.join("\n");
  });

  return ["## Stock detail", ...blocks].join("\n\n");
}

/**
 * The full trade ledger — every transaction with its computed value, fees and
 * tax, and the resulting cash movement. Mirrors the Ledger tab.
 */
function renderTradeLedger(input: PortfolioSummaryInput): string {
  const txns = input.transactions ?? [];
  if (txns.length === 0) return "";
  const cfg = input.feeConfig;

  const cgtByTxn = new Map<string, number>();
  for (const slice of input.realized ?? []) {
    cgtByTxn.set(slice.txnId, (cgtByTxn.get(slice.txnId) ?? 0) + slice.cgt);
  }
  const grossByTxn = new Map<string, number>();
  const whtByTxn = new Map<string, number>();
  for (const d of input.dividends ?? []) {
    grossByTxn.set(d.txnId, d.gross);
    whtByTxn.set(d.txnId, d.wht);
  }
  const bonusTaxByTxn = new Map<string, number>();
  for (const b of input.bonusTaxes ?? []) bonusTaxByTxn.set(b.txnId, b.tax);

  const sorted = [...txns].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

  const rows = sorted.map((t) => {
    const fees =
      cfg && (t.type === "BUY" || t.type === "SELL")
        ? computeTradeCosts(t.shares, t.price, cfg, t.feeOverride).total
        : 0;
    const cgt = cgtByTxn.get(t.id) ?? 0;
    const wht = whtByTxn.get(t.id) ?? 0;
    const bonusTax = bonusTaxByTxn.get(t.id) ?? 0;
    const tax = cgt + wht + bonusTax;

    return [
      formatDateShort(t.date),
      t.type,
      t.ticker || "—",
      txnQty(t),
      t.price ? formatCurrency(t.price) : "—",
      formatCurrency(txnValue(t, grossByTxn.get(t.id))),
      fees ? formatCurrency(fees) : "—",
      tax ? formatCurrency(tax) : "—",
      signedCurrency(txnCashDelta(t, { fees, cgt, wht, bonusTax, grossByTxn })),
      t.note || "",
    ];
  });

  return [
    "## Trade ledger",
    mdTable(
      ["Date", "Type", "Ticker", "Qty", "Price", "Value", "Fees", "Tax", "Cash Δ", "Note"],
      rows,
    ),
  ].join("\n");
}

function txnQty(t: Transaction): string {
  if (t.type === "SPLIT") return `${t.ratioFrom}:${t.ratioTo}`;
  return t.shares ? t.shares.toLocaleString() : "—";
}

function txnValue(t: Transaction, gross?: number): number {
  switch (t.type) {
    case "DEPOSIT":
    case "WITHDRAW":
    case "TAX":
    case "EXPENSE":
      return t.amount;
    case "DIVIDEND":
      return gross ?? t.amount;
    case "SPLIT":
      return 0;
    default:
      return tradeValue(t.shares, t.price);
  }
}

function txnCashDelta(
  t: Transaction,
  ctx: {
    fees: number;
    cgt: number;
    wht: number;
    bonusTax: number;
    grossByTxn: Map<string, number>;
  },
): number {
  const value = tradeValue(t.shares, t.price);
  switch (t.type) {
    case "BUY":
    case "RIGHT":
      return -(value + ctx.fees);
    // CGT is accrued on a sale, never deducted from it — see replayLedger.
    case "SELL":
      return value - ctx.fees;
    case "DIVIDEND":
      return (ctx.grossByTxn.get(t.id) ?? t.amount) - ctx.wht;
    case "BONUS":
      return -ctx.bonusTax;
    case "DEPOSIT":
      return t.amount;
    case "WITHDRAW":
    case "TAX":
    case "EXPENSE":
      return -t.amount;
    default:
      return 0;
  }
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
    formatCurrency(y.cgtPaid),
    signedCurrency(y.cgtOutstanding),
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
        "Gross CGT",
        "CGT paid",
        "Outstanding",
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

  // Per-stock scoreboard appears from compact up — it's the single most useful
  // ledger view and stays terse (one row per name).
  const stockLedger = renderStockLedger(input);
  if (stockLedger) sections.push(stockLedger);

  if (depth === "compact") {
    sections.push(renderDividends(input, 4));
    return sections.filter(Boolean).join("\n\n") + "\n";
  }

  const stockDetail = renderStockDetail(input);
  if (stockDetail) sections.push(stockDetail);
  const taxes = renderTaxes(input);
  if (taxes) sections.push(taxes);
  const tradeLedger = renderTradeLedger(input);
  if (tradeLedger) sections.push(tradeLedger);
  sections.push(renderDividends(input, 10));
  const history = renderHistory(input, 14);
  if (history) sections.push(history);
  const ledger = renderInvestmentLedger(input);
  if (ledger) sections.push(ledger);

  return sections.filter(Boolean).join("\n\n") + "\n";
}
