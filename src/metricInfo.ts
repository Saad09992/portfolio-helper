import { ANALYTICS } from "./constants";

export type MetricInfo = {
  /** What the number measures. */
  what: string;
  /** How to read it — what counts as healthy vs concerning. */
  reading: string;
};

const RISK_FREE_PCT = `${(ANALYTICS.RISK_FREE_ANNUAL * 100).toFixed(0)}%`;

/**
 * Plain-language explanations for every dashboard metric, surfaced through the
 * ⓘ triggers. Keep these in sync with the formulas in `analytics.ts` — each one
 * describes what this app actually computes, not the textbook definition.
 */
export const METRIC_INFO = {
  totalValue: {
    what: "Market value of your positions at the last fetched prices. Cash is excluded.",
    reading:
      "Not good or bad on its own — it moves with prices. Compare it against Total invested to see whether you're up.",
  },
  portfolioValue: {
    what: "Everything you own right now: market value of your positions at the last fetched prices, plus uninvested cash. Unrealized gains and losses are already baked into the market value.",
    reading:
      "The single number for 'what is the portfolio worth today'. Above Total invested means you're ahead overall; below means you're behind. It moves with prices and with every deposit or withdrawal.",
  },
  totalInvested: {
    what: "Net capital you put in, from the Invest tab ledger (deposits minus withdrawals).",
    reading:
      "This is your cost of entry. Value above it means you're ahead; below it means you're behind.",
  },
  unrealizedPl: {
    what: "Market value minus cost basis across your holdings — profit you'd bank if you sold everything now.",
    reading:
      "Green is profit, red is loss. Unrealized: it isn't real until you sell, and it swings with prices.",
  },
  trueReturn: {
    what: "Time-weighted return (TWR) across your daily snapshots. It strips out deposits and withdrawals, so adding money never shows up as a gain.",
    reading:
      "This is the honest measure of how your picks performed. Above 0% means the portfolio grew on its own merit. Compare the annualized figure with KSE100 and with cash rates.",
  },
  topPosition: {
    what: "Your largest holding and its share of portfolio value.",
    reading:
      "Concentration risk. Above roughly 20-25% in one name means a single stock drives your outcome — fine if deliberate, dangerous if accidental.",
  },
  cash: {
    what: "Uninvested cash you've recorded, and its share of total portfolio value.",
    reading:
      "Dry powder for buying dips, but idle cash loses to inflation. Most plans keep 5-15%.",
  },
  costBasis: {
    what: "What your current positions cost you — sum of shares × cost basis per position.",
    reading:
      "The break-even line for the holdings you own today. Market value above it means an unrealized gain.",
  },
  maxDrawdown: {
    what: "The deepest peak-to-trough fall of your TWR index over the snapshot window.",
    reading:
      "The worst pain the portfolio has handed you so far. Closer to 0% is better; a drawdown deeper than you can stomach without selling means the portfolio is too risky for you.",
  },
  volatility: {
    what: `How much daily returns swing around, annualized (standard deviation × √${ANALYTICS.TRADING_DAYS}).`,
    reading:
      "Higher means a bumpier ride, not necessarily worse returns. Roughly: under 15% is calm, 15-25% is typical for equities, above 30% is turbulent.",
  },
  sharpe: {
    what: `Return earned per unit of risk taken: (annualized TWR − ${RISK_FREE_PCT} risk-free rate) ÷ volatility.`,
    reading:
      "Higher is better. Below 0 means you trailed a risk-free deposit; 0-1 is unremarkable; above 1 is good; above 2 is excellent.",
  },
  bestDay: {
    what: "Largest single-day gain in the TWR index over the snapshot window.",
    reading:
      "Context for volatility, not a scorecard. Big best days usually travel with big worst days.",
  },
  worstDay: {
    what: "Largest single-day loss in the TWR index over the snapshot window.",
    reading:
      "A gut-check on downside: expect days like this to recur. If one would make you panic-sell, size down.",
  },
  alpha: {
    what: "Your TWR return minus the KSE100 return over the same window — the excess you earned above simply buying the index.",
    reading:
      "Positive means you beat the index; negative means an index fund would have served you better. Short windows are mostly noise.",
  },
  beta: {
    what: "How hard your portfolio moves when KSE100 moves (covariance of daily returns ÷ index variance).",
    reading:
      "1.0 tracks the index. Above 1 amplifies both rallies and crashes; below 1 cushions them. Near 0 means your holdings march to their own beat.",
  },
  depositsVsGrowth: {
    what: "Splits portfolio value into deposits you made versus market gain or loss on top of them.",
    reading:
      "Early on, deposits dominate — that's normal. Growth taking a bigger share over the years is the goal.",
  },
  stockNetPnl: {
    what: "Everything this stock has made you: realized profit from sales, unrealized profit on what you still hold, and dividends received — all after brokerage, CGT and withholding tax.",
    reading:
      "The honest scorecard for the position. It can be positive while the current holding is under water, if earlier sales or dividends already banked more than the paper loss.",
  },
  feeDrag: {
    what: "Brokerage, statutory charges and taxes paid on this stock, as a share of the cash you put into it.",
    reading:
      "The cost of doing business. Under 1% is normal for buy-and-hold; several percent means frequent trading or small tickets are eating the return.",
  },
  cgtCarryForward: {
    what: "Capital losses not yet used against gains. They offset future capital gains for three tax years, then expire.",
    reading:
      "A cushion on next year's tax bill. Watch the expiry: a loss that ages out saves you nothing.",
  },
  cgtOutstanding: {
    what: "CGT the year's netted gains imply, minus what NCCPL has actually debited so far.",
    reading:
      "Positive is money in your cash balance that is not yours — set it aside for the next NCCPL debit. Negative means you have overpaid and a refund is due.",
  },
  cgtReserve: {
    what: "Total unpaid CGT across every tax year, held against the cash balance.",
    reading:
      "Cash minus this is what you can actually deploy. It falls on its own when later losses net off the gains, so it is an estimate until NCCPL settles.",
  },
  netTotalPnl: {
    what: "Everything the portfolio has made since you started: realized profit from sales, unrealized profit on what you still hold, and dividends received. Brokerage, CGT and withholding are already deducted inside those three figures.",
    reading:
      "The single honest scorecard. Unlike Unrealized P/L it doesn't forget the trades you've already closed, and unlike True return it's a rupee amount rather than a rate. Lifetime — the date range at the top doesn't narrow it.",
  },
  realizedPnl: {
    what: "Profit and loss you have actually banked by selling, net of the brokerage and capital gains tax attributed to each sale.",
    reading:
      "Money that is genuinely yours — it can't swing back. Compare it against Unrealized to see how much of your record is settled versus still on paper.",
  },
  dividendsReceived: {
    what: "Cash dividends received across all holdings, after the withholding tax deducted at source.",
    reading:
      "Return that arrives whatever the price does, which makes it the steadiest part of the total. Growing dividends on an unchanged position count as real progress.",
  },
  feesPaidTotal: {
    what: "Brokerage commission and statutory charges paid across every trade you have recorded.",
    reading:
      "Pure friction — the only line here you can shrink by acting less. Judge it against the fee-drag percentage rather than the rupee amount, which just grows with activity.",
  },
  taxesBooked: {
    what: "Capital gains tax, dividend withholding and bonus-issue tax booked to date. Booked, not paid: withholding has already left your hands, but accrued CGT has not — NCCPL debits that later.",
    reading:
      "Read it next to the CGT reserve, which is the part still sitting in your cash balance awaiting collection. Treating the whole figure as money already gone will understate what you can deploy.",
  },
  winRate: {
    what: "Share of your closed sales that made a profit. A part-sale of one lot counts once.",
    reading:
      "Above 50% means most exits worked out, but it says nothing about size — a 30% win rate with large winners beats a 90% win rate with one ruinous loss. Read it beside best and worst trade.",
  },
  dayPnl: {
    what: "Change in the market value of your positions since the previous close, at the last fetched prices.",
    reading:
      "Noise on any single day. Useful as a sanity check that prices actually refreshed, not as a measure of whether the strategy is working.",
  },
  netIfSoldToday: {
    what: "What your unrealized gain would be worth after paying the brokerage and capital gains tax to liquidate every position right now.",
    reading:
      "The unrealized figure you'd actually keep. The gap between the two is the cost of the exit — normally small, but wide on short-held positions where the full CGT rate applies.",
  },
  deployableCash: {
    what: "Cash balance minus the CGT reserve — what you can commit to a new position without spending tax you owe.",
    reading:
      "The number to size a buy against. Using the raw cash balance instead means funding trades with money earmarked for the next NCCPL debit.",
  },
  top3Concentration: {
    what: "Combined weight of your three largest positions, as a share of invested value — cash is excluded.",
    reading:
      "Under about 40% is diversified, 40-60% is concentrated, above 60% means three names decide your outcome. Fine if deliberate; check it is.",
  },
  feeDragPortfolio: {
    what: "Brokerage, statutory charges and taxes across the whole portfolio, as a share of the lifetime cash you have put in.",
    reading:
      "Under 1% is normal for buy-and-hold. Several percent means frequent trading or small tickets are quietly eating the return.",
  },
  netDeposits: {
    what: "Net capital you have contributed, from the Invest tab ledger — deposits minus withdrawals.",
    reading:
      "Your cost of entry, and not the same thing as Open position cost: this is money in, that is what today's holdings cost. Value above this line means you're ahead overall.",
  },
  openPositionCost: {
    what: "What the positions you hold right now cost you — shares × cost basis, brokerage included.",
    reading:
      "The break-even line for today's holdings only. It says nothing about positions you already sold; Realized P&L covers those.",
  },
} satisfies Record<string, MetricInfo>;
