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
} satisfies Record<string, MetricInfo>;
