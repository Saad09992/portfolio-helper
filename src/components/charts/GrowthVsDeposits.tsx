import type { SavingsStats } from "../../analytics";
import { formatCompactCurrency, formatCurrency, formatPercent } from "../../utils";

export type GrowthVsDepositsProps = {
  stats: SavingsStats;
};

function formatEntryDate(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return iso;
  return new Date(ts).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Decomposes the portfolio value into two components:
 *   - Deposits (net capital contributed via the Invest tab ledger)
 *   - Market growth (or loss) on top of those deposits
 * Rendered as a single stacked bar with each segment's share of the value.
 *
 * The split is marked at live prices when the portfolio has one; the last Invest
 * entry's own value is kept as a secondary line so the two are never conflated.
 */
export function GrowthVsDeposits({ stats }: GrowthVsDepositsProps) {
  const useLive = stats.liveReady;
  const value = useLive ? stats.liveValue : stats.latestValue;
  const marketGain = useLive ? stats.liveMarketGain : stats.marketGain;
  const pctFromDeposits = useLive ? stats.livePctFromDeposits : stats.pctFromDeposits;
  const pctFromMarket = useLive ? stats.livePctFromMarket : stats.pctFromMarket;

  if (!stats.ready || value <= 0) {
    return (
      <div className="chart-empty">
        Add entries in the Invest tab to see the deposits-vs-growth split.
      </div>
    );
  }

  const depositsShare = Math.max(0, Math.min(1, pctFromDeposits));
  const gainShare = Math.max(0, Math.min(1 - depositsShare, pctFromMarket));
  const marketPositive = marketGain >= 0;
  const gainToneClass = marketPositive ? "gvd-seg--gain" : "gvd-seg--loss";
  const gainLabel = marketPositive ? "Market gain" : "Market loss";

  return (
    <div className="gvd">
      <div className="gvd-bar" role="img" aria-label="Deposits versus market growth">
        <div
          className="gvd-seg gvd-seg--deposits"
          style={{ width: `${depositsShare * 100}%` }}
          title={`Deposits: ${formatCurrency(stats.totalContributed)}`}
        />
        <div
          className={`gvd-seg ${gainToneClass}`}
          style={{ width: `${gainShare * 100}%` }}
          title={`${gainLabel}: ${formatCurrency(marketGain)}`}
        />
      </div>
      <div className="gvd-legend">
        <div className="gvd-legend-row">
          <span className="gvd-swatch gvd-swatch--deposits" />
          <span className="gvd-legend-label">Deposits</span>
          <span className="num gvd-legend-val">{formatCompactCurrency(stats.totalContributed)}</span>
          <span className="gvd-legend-pct">{formatPercent(depositsShare)}</span>
        </div>
        <div className="gvd-legend-row">
          <span className={`gvd-swatch ${marketPositive ? "gvd-swatch--gain" : "gvd-swatch--loss"}`} />
          <span className="gvd-legend-label">{gainLabel}</span>
          <span className={`num gvd-legend-val ${marketPositive ? "positive" : "negative"}`}>
            {marketPositive ? "+" : ""}{formatCompactCurrency(marketGain)}
          </span>
          <span className="gvd-legend-pct">{formatPercent(pctFromMarket)}</span>
        </div>
        <div className="gvd-legend-row gvd-legend-total">
          <span className="gvd-legend-label">
            {useLive ? "Current market value" : "Value at last entry"}
          </span>
          <span className="num gvd-legend-val">{formatCompactCurrency(value)}</span>
          <span className="gvd-legend-pct">{useLive ? "live prices" : "last entry"}</span>
        </div>
        {useLive ? (
          <p className="gvd-note">
            Last Invest entry ({formatEntryDate(stats.latestValueDate)}):{" "}
            <span className="num">{formatCompactCurrency(stats.latestValue)}</span> value,{" "}
            <span className={`num ${stats.marketGain >= 0 ? "positive" : "negative"}`}>
              {stats.marketGain >= 0 ? "+" : ""}{formatCompactCurrency(stats.marketGain)}
            </span>{" "}
            {stats.marketGain >= 0 ? "gain" : "loss"}.
          </p>
        ) : (
          <p className="gvd-note">
            Based on the last Invest entry ({formatEntryDate(stats.latestValueDate)}) — add
            holdings with prices to mark this at live prices.
          </p>
        )}
      </div>
    </div>
  );
}
