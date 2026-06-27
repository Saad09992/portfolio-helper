import type { CashBuckets } from "../types";
import type { UpcomingDividend } from "../derivedTypes";
import { formatCurrency } from "../utils";
import { Field } from "../components/ui/Field";

export type IncomePageProps = {
  cashDraft: CashBuckets;
  setCashDraft: (cash: CashBuckets) => void;
  cashError: string;
  saveCashBuckets: (event: React.FormEvent<HTMLFormElement>) => void;
  upcomingDividends: UpcomingDividend[];
};

export function IncomePage({
  cashDraft,
  setCashDraft,
  cashError,
  saveCashBuckets,
  upcomingDividends,
}: IncomePageProps) {
  return (
    <section className="insight-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Cash</p>
            <h2>Available cash</h2>
          </div>
          <span className="panel-meta">Reflected in portfolio</span>
        </div>
        <form className="cash-section" onSubmit={saveCashBuckets}>
          <div className="cash-grid">
            <Field
              label="Cash amount"
              type="number"
              min={0}
              step="0.01"
              value={String(cashDraft.available)}
              onChange={(value) => setCashDraft({ available: Number(value) })}
            />
          </div>
          {cashError ? <p className="form-error">{cashError}</p> : null}
          <div className="form-actions">
            <button type="submit" className="button button-primary">
              Update cash
            </button>
          </div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Dividends</p>
            <h2>Income tracking</h2>
          </div>
          <span className="panel-meta">Auto-fetched from PSX</span>
        </div>
        <div className="suggestion-list">
          {upcomingDividends.length === 0 ? (
            <p className="muted-note">No upcoming dividends. Refresh prices to fetch latest announcements.</p>
          ) : (
            upcomingDividends.map((up, i) => (
              <div key={`${up.holding.id}-${up.date}-${i}`} className="suggestion-row">
                <strong>{up.ticker}</strong>
                <span className="num">DPS: {formatCurrency(up.dps)}</span>
                <small className="num">
                  Expected income {formatCurrency(up.holding.shares * up.dps)}
                  {up.date ? ` · Book closure ${up.date}` : ""}
                </small>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
