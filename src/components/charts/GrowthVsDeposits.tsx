import type { SavingsStats } from "../../analytics";
import { formatCompactCurrency, formatCurrency, formatPercent } from "../../utils";

export type GrowthVsDepositsProps = {
  stats: SavingsStats;
};

/**
 * Decomposes the current portfolio value into two components:
 *   - Deposits (net capital contributed via the Invest tab ledger)
 *   - Market growth (or loss) on top of those deposits
 * Rendered as a single stacked bar with each segment's share of latestValue.
 */
export function GrowthVsDeposits({ stats }: GrowthVsDepositsProps) {
  if (!stats.ready || stats.latestValue <= 0) {
    return (
      <div className="chart-empty">
        Add entries in the Invest tab to see the deposits-vs-growth split.
      </div>
    );
  }

  const depositsShare = Math.max(0, Math.min(1, stats.pctFromDeposits));
  const gainShare = Math.max(0, Math.min(1 - depositsShare, stats.pctFromMarket));
  const marketPositive = stats.marketGain >= 0;
  const gainToneClass = marketPositive ? "gvd-seg--gain" : "gvd-seg--loss";

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
          title={`Market ${marketPositive ? "gain" : "loss"}: ${formatCurrency(stats.marketGain)}`}
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
          <span className="gvd-legend-label">{marketPositive ? "Market gain" : "Market loss"}</span>
          <span className={`num gvd-legend-val ${marketPositive ? "positive" : "negative"}`}>
            {marketPositive ? "+" : ""}{formatCompactCurrency(stats.marketGain)}
          </span>
          <span className="gvd-legend-pct">{formatPercent(stats.pctFromMarket)}</span>
        </div>
        <div className="gvd-legend-row gvd-legend-total">
          <span className="gvd-legend-label">Current value</span>
          <span className="num gvd-legend-val">{formatCompactCurrency(stats.latestValue)}</span>
        </div>
      </div>
    </div>
  );
}
