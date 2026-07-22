import type { CashBuckets } from "../types";
import { Field } from "../components/ui/Field";
import { paisaToRupees, rupeesToPaisa } from "../money";

export type IncomePageProps = {
  cashDraft: CashBuckets;
  setCashDraft: (cash: CashBuckets) => void;
  cashError: string;
  saveCashBuckets: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function IncomePage({
  cashDraft,
  setCashDraft,
  cashError,
  saveCashBuckets,
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
              value={String(paisaToRupees(cashDraft.available))}
              onChange={(value) => setCashDraft({ available: rupeesToPaisa(Number(value)) })}
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
    </section>
  );
}
