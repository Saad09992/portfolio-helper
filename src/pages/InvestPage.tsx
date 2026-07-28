import type { InvestmentRow, InvestmentSummary } from "../derivedTypes";
import type { SavingsStats } from "../analytics";
import { formatCompactCurrency, formatCurrency, formatPercent } from "../utils";
import { InvestmentChart } from "../components/charts/InvestmentChart";

type DraftInvestment = {
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};

export type InvestPageProps = {
  investmentSummary: InvestmentSummary;
  investDraft: DraftInvestment;
  setInvestDraft: React.Dispatch<React.SetStateAction<DraftInvestment>>;
  addInvestment: (event: React.FormEvent<HTMLFormElement>) => void;
  investError: string;
  totalValue: number;
  investmentRows: InvestmentRow[];
  removeInvestment: (id: string) => void;
  savingsStats: SavingsStats;
};

export function InvestPage({
  investmentSummary,
  investDraft,
  setInvestDraft,
  addInvestment,
  investError,
  totalValue,
  investmentRows,
  removeInvestment,
  savingsStats,
}: InvestPageProps) {
  const sv = savingsStats;
  return (
    <>
      <section className="panel risk-panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Savings</p>
            <h2>Savings behaviour</h2>
          </div>
          <span className="panel-meta">From your contribution ledger</span>
        </div>
        <div className="kpi-grid">
          <div className="kpi-tile">
            <p>Avg monthly saving</p>
            <strong className="num">{sv.ready ? formatCompactCurrency(sv.monthlyAvg) : "—"}</strong>
            <span>{sv.ready ? `over ${sv.months} mo` : "Add 2+ entries"}</span>
          </div>
          <div className="kpi-tile">
            <p>Contribution streak</p>
            <strong className="num">{sv.ready ? `${sv.streak}` : "—"}</strong>
            <span>consecutive deposits</span>
          </div>
          <div className="kpi-tile">
            <p>From deposits</p>
            <strong className="num">{sv.ready ? formatPercent(sv.pctFromDeposits) : "—"}</strong>
            <span>of current value</span>
          </div>
          <div className="kpi-tile">
            <p>From market</p>
            <strong className={`num ${sv.marketGain >= 0 ? "positive" : "negative"}`}>
              {sv.ready ? formatPercent(sv.pctFromMarket) : "—"}
            </strong>
            <span>{sv.ready ? formatCompactCurrency(sv.marketGain) : "growth share"}</span>
          </div>
        </div>
      </section>

      <section className="invest-summary">
        <div className="invest-stat">
          <span className="invest-stat-num num">{formatCurrency(investmentSummary.totalInvested)}</span>
          <span className="invest-stat-label">Total invested</span>
        </div>
        <div className="invest-stat">
          <span className="invest-stat-num num">{formatCurrency(investmentSummary.latestValue)}</span>
          <span className="invest-stat-label">Latest value</span>
        </div>
        <div className="invest-stat">
          <span className={`invest-stat-num num ${investmentSummary.pnlValue >= 0 ? "positive" : "negative"}`}>
            {investmentSummary.pnlValue >= 0 ? "+" : ""}{formatCurrency(investmentSummary.pnlValue)}
          </span>
          <span className="invest-stat-label">P&amp;L</span>
        </div>
        <div className="invest-stat">
          <span className={`invest-stat-num num ${investmentSummary.pnlPct >= 0 ? "positive" : "negative"}`}>
            {investmentSummary.pnlPct >= 0 ? "+" : ""}{investmentSummary.pnlPct.toFixed(2)}%
          </span>
          <span className="invest-stat-label" title="Cumulative P&L over total deployed; ignores deposit timing.">
            Cumulative %
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Investment tracker</p>
            <h2>Add installment</h2>
          </div>
          <span className="panel-meta">{investmentSummary.count} entries</span>
        </div>
        <form className="invest-form" onSubmit={addInvestment}>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              className="num"
              value={investDraft.date}
              onChange={(e) => setInvestDraft((c) => ({ ...c, date: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Label</span>
            <input
              type="text"
              placeholder="e.g. Month 1"
              value={investDraft.label}
              onChange={(e) => setInvestDraft((c) => ({ ...c, label: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Amount (+/-)</span>
            <input
              type="number"
              className="num"
              step="0.01"
              placeholder="0"
              value={investDraft.amount === 0 ? "" : investDraft.amount}
              onChange={(e) => setInvestDraft((c) => ({ ...c, amount: Number(e.target.value) }))}
            />
          </label>
          <label className="field">
            <span>
              Value EOM
              <button
                type="button"
                className="invest-fill-current"
                onClick={() => setInvestDraft((c) => ({ ...c, valueEom: totalValue }))}
                title="Fill with current portfolio total value"
              >
                Use current
              </button>
            </span>
            <input
              type="number"
              className="num"
              step="0.01"
              min={0}
              placeholder="0"
              value={investDraft.valueEom === 0 ? "" : investDraft.valueEom}
              onChange={(e) => setInvestDraft((c) => ({ ...c, valueEom: Number(e.target.value) }))}
            />
          </label>
          <button type="submit" className="button button-primary invest-form-add">Add</button>
        </form>
        {investError ? <p className="form-error">{investError}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Chart</p>
            <h2>Total &amp; Value EOM</h2>
          </div>
        </div>
        <InvestmentChart rows={investmentRows} />
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Entries</p>
            <h2>Installment ledger</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Label</th>
                <th className="right">Amount</th>
                <th className="right">Total</th>
                <th className="right">Value EOM</th>
                <th className="right">P&amp;L</th>
                <th className="right">P&amp;L %</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {investmentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No entries yet. Add an installment above to start tracking.
                  </td>
                </tr>
              ) : (
                investmentRows.map((row) => (
                  <tr key={row.id}>
                    <td className="num">{row.date}</td>
                    <td>{row.label}</td>
                    <td className={`right num ${row.amount >= 0 ? "" : "negative"}`}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="right num">{formatCurrency(row.total)}</td>
                    <td className="right num">{formatCurrency(row.valueEom)}</td>
                    <td className={`right num ${row.pnlValue >= 0 ? "positive" : "negative"}`}>
                      {row.pnlValue >= 0 ? "+" : ""}{formatCurrency(row.pnlValue)}
                    </td>
                    <td className={`right num ${row.pnlPct >= 0 ? "positive" : "negative"}`}>
                      {row.pnlPct >= 0 ? "+" : ""}{row.pnlPct.toFixed(2)}%
                    </td>
                    <td className="right">
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => removeInvestment(row.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
