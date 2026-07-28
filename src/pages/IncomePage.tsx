import { useState } from "react";
import type { CashBuckets } from "../types";
import { Field } from "../components/ui/Field";
import { formatCurrency } from "../utils";
import { paisaToRupees, rupeesToPaisa } from "../money";

export type IncomePageProps = {
  cashDraft: CashBuckets;
  setCashDraft: (cash: CashBuckets) => void;
  cashError: string;
  saveCashBuckets: (event: React.FormEvent<HTMLFormElement>) => void;
  /** true once the ledger derives the cash balance */
  ledgerActive: boolean;
  /** paisa — balance implied by the ledger */
  ledgerCash: number;
  today: string;
  addCashEntry: (type: "DEPOSIT" | "WITHDRAW", amount: number, date: string, note: string) => void;
};

export function IncomePage({
  cashDraft,
  setCashDraft,
  cashError,
  saveCashBuckets,
  ledgerActive,
  ledgerCash,
  today,
  addCashEntry,
}: IncomePageProps) {
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submit(type: "DEPOSIT" | "WITHDRAW") {
    const paisa = rupeesToPaisa(Number(amount) || 0);
    if (paisa <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    addCashEntry(type, paisa, date, note.trim());
    setAmount("");
    setNote("");
    setError("");
  }

  if (!ledgerActive) {
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

  return (
    <section className="insight-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Cash</p>
            <h2>Account balance</h2>
          </div>
          <span className="panel-meta">Derived from the ledger</span>
        </div>

        <div className="kpi-grid">
          <div className="kpi-tile">
            <p>Available cash</p>
            <strong className={`num ${ledgerCash < 0 ? "negative" : ""}`}>
              {formatCurrency(ledgerCash)}
            </strong>
            <span>deposits − buys + sells + dividends</span>
          </div>
        </div>

        {ledgerCash < 0 ? (
          <p className="muted-note">
            The balance is negative, which means the ledger records more spending
            than funding. Add the deposits that paid for those trades below.
          </p>
        ) : null}

        <div className="form-grid">
          <Field label="Date" type="date" value={date} onChange={setDate} />
          <Field
            label="Amount (Rs)"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={setAmount}
          />
          <Field label="Note" value={note} placeholder="optional" onChange={setNote} />
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => submit("DEPOSIT")}
          >
            Record deposit
          </button>
          <button type="button" className="button" onClick={() => submit("WITHDRAW")}>
            Record withdrawal
          </button>
        </div>
      </article>
    </section>
  );
}
