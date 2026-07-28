import { useMemo, useState } from "react";
import type { Holding } from "../types";
import type { FeeConfig } from "../ledger/feeConfig";
import type { LedgerState, Transaction, TxnType } from "../ledger/types";
import type { TransactionDraft } from "../hooks/useLedger";
import { computeTradeCosts, tradeValue } from "../ledger/fees";
import { formatCurrency, formatDateShort } from "../utils";
import { roundPaisa, rupeesToPaisa } from "../money";
import { Field } from "../components/ui/Field";
import { StockSearch } from "../components/StockSearch";
import { LedgerMigration } from "../components/LedgerMigration";

const TYPES: { value: TxnType; label: string; hint: string }[] = [
  { value: "BUY", label: "Buy", hint: "Shares bought — fees are added to your cost." },
  { value: "SELL", label: "Sell", hint: "Shares sold — fees and CGT come out of the proceeds." },
  { value: "DIVIDEND", label: "Dividend", hint: "Cash dividend, credited net of withholding tax." },
  { value: "BONUS", label: "Bonus", hint: "Free shares. Taxed on their issue value." },
  { value: "RIGHT", label: "Rights", hint: "Rights subscription at the offer price." },
  { value: "SPLIT", label: "Split", hint: "Share split or consolidation. Cost is unchanged." },
  { value: "DEPOSIT", label: "Deposit", hint: "Cash paid into the brokerage account." },
  { value: "WITHDRAW", label: "Withdraw", hint: "Cash taken out of the account." },
];

const CASH_TYPES: TxnType[] = ["DEPOSIT", "WITHDRAW"];

type Draft = {
  type: TxnType;
  date: string;
  ticker: string;
  name: string;
  sector: string;
  shares: string;
  price: string;
  amount: string;
  ratioFrom: string;
  ratioTo: string;
  note: string;
};

const emptyDraft = (date: string): Draft => ({
  type: "BUY",
  date,
  ticker: "",
  name: "",
  sector: "",
  shares: "",
  price: "",
  amount: "",
  ratioFrom: "1",
  ratioTo: "2",
  note: "",
});

export type LedgerPageProps = {
  transactions: Transaction[];
  feeConfig: FeeConfig;
  state: LedgerState;
  cash: number;
  hasLedger: boolean;
  /** stored holdings, used to seed the one-time migration */
  storedHoldings: Holding[];
  storedCash: number;
  today: string;
  addTransaction: (draft: TransactionDraft) => void;
  addTransactions: (drafts: TransactionDraft[]) => void;
  removeTransaction: (id: string) => void;
};

export function LedgerPage({
  transactions,
  feeConfig,
  state,
  cash,
  hasLedger,
  storedHoldings,
  storedCash,
  today,
  addTransaction,
  addTransactions,
  removeTransaction,
}: LedgerPageProps) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(today));
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const set = (patch: Partial<Draft>) => setDraft((cur) => ({ ...cur, ...patch }));

  const isCash = CASH_TYPES.includes(draft.type);
  const shares = Number(draft.shares) || 0;
  const price = rupeesToPaisa(Number(draft.price) || 0);
  const amount = rupeesToPaisa(Number(draft.amount) || 0);

  const preview = useMemo(
    () => buildPreview(draft.type, shares, price, amount, state, draft.ticker, feeConfig),
    [draft.type, draft.ticker, shares, price, amount, state, feeConfig],
  );

  // Per-transaction outcomes, looked up from the replay rather than recomputed:
  // CGT in particular depends on which lots the sale matched.
  const cgtByTxn = useMemo(() => {
    const map = new Map<string, number>();
    for (const slice of state.realized) {
      map.set(slice.txnId, (map.get(slice.txnId) ?? 0) + slice.cgt);
    }
    return map;
  }, [state.realized]);

  const whtByTxn = useMemo(() => {
    const map = new Map<string, number>();
    for (const receipt of state.dividends) map.set(receipt.txnId, receipt.wht);
    for (const bonus of state.bonusTaxes) map.set(bonus.txnId, bonus.tax);
    return map;
  }, [state.dividends, state.bonusTaxes]);

  const issueByTxn = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of state.issues) map.set(issue.txnId, issue.message);
    return map;
  }, [state.issues]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const sorted = [...transactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    );
    return q
      ? sorted.filter(
          (t) =>
            t.ticker.toLowerCase().includes(q) ||
            t.type.toLowerCase().includes(q) ||
            t.note.toLowerCase().includes(q),
        )
      : sorted;
  }, [transactions, filter]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.date) return setError("Date is required.");
    if (!isCash && !draft.ticker.trim()) return setError("Pick a stock first.");

    if (draft.type === "SPLIT") {
      if ((Number(draft.ratioFrom) || 0) <= 0 || (Number(draft.ratioTo) || 0) <= 0) {
        return setError("Split ratio must be two positive numbers.");
      }
    } else if (isCash) {
      if (amount <= 0) return setError("Amount must be greater than zero.");
    } else if (draft.type === "DIVIDEND") {
      if (price <= 0 && amount <= 0) {
        return setError("Enter a dividend per share or a total amount.");
      }
    } else if (shares <= 0) {
      return setError("Shares must be greater than zero.");
    }

    addTransaction({
      date: draft.date,
      type: draft.type,
      ticker: draft.ticker.trim().toUpperCase(),
      name: draft.name,
      sector: draft.sector,
      shares,
      price,
      amount,
      ...(draft.type === "SPLIT"
        ? { ratioFrom: Number(draft.ratioFrom), ratioTo: Number(draft.ratioTo) }
        : {}),
      note: draft.note.trim(),
    });

    // Keep the type, date and stock — entering a run of trades is the common case.
    setDraft((cur) => ({
      ...cur,
      shares: "",
      price: "",
      amount: "",
      note: "",
    }));
    setError("");
  }

  const typeHint = TYPES.find((t) => t.value === draft.type)?.hint ?? "";

  return (
    <>
      {!hasLedger ? (
        <LedgerMigration
          holdings={storedHoldings}
          cashAvailable={storedCash}
          defaultDate={today}
          onImport={addTransactions}
        />
      ) : null}

      {state.issues.length > 0 ? (
        <section className="panel ledger-issues">
          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Check these</p>
              <h2>
                {state.issues.length} entr{state.issues.length === 1 ? "y" : "ies"} could not
                be applied
              </h2>
            </div>
          </div>
          <ul className="ledger-issue-list">
            {state.issues.map((issue, i) => (
              <li key={`${issue.txnId}-${i}`}>
                <strong>{issue.date}</strong> {issue.ticker ? `${issue.ticker} — ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Record</p>
            <h2>New entry</h2>
          </div>
          <span className="panel-meta num">Cash: {formatCurrency(cash)}</span>
        </div>

        <div className="chip-group">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`chip ${draft.type === t.value ? "chip--active" : ""}`}
              onClick={() => set({ type: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted-note">{typeHint}</p>

        <form onSubmit={submit}>
          <div className="form-grid">
            <Field
              label="Date"
              type="date"
              value={draft.date}
              onChange={(value) => set({ date: value })}
            />

            {!isCash ? (
              <StockSearch
                onSelect={(stock) =>
                  set({ ticker: stock.ticker, name: stock.name, sector: stock.sector })
                }
                selected={draft.ticker ? `${draft.ticker} — ${draft.name}` : ""}
                onClear={() => set({ ticker: "", name: "", sector: "" })}
              />
            ) : null}

            {["BUY", "SELL", "BONUS", "RIGHT"].includes(draft.type) ? (
              <Field
                label="Shares"
                type="number"
                min={0}
                step="1"
                value={draft.shares}
                onChange={(value) => set({ shares: value })}
              />
            ) : null}

            {["BUY", "SELL", "RIGHT"].includes(draft.type) ? (
              <Field
                label="Price per share (Rs)"
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(value) => set({ price: value })}
              />
            ) : null}

            {draft.type === "BONUS" ? (
              <Field
                label="Issue value per share (Rs)"
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(value) => set({ price: value })}
              />
            ) : null}

            {draft.type === "DIVIDEND" ? (
              <>
                <Field
                  label="Dividend per share (Rs)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.price}
                  onChange={(value) => set({ price: value })}
                />
                <Field
                  label="Or total gross (Rs)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.amount}
                  onChange={(value) => set({ amount: value })}
                />
              </>
            ) : null}

            {isCash ? (
              <Field
                label="Amount (Rs)"
                type="number"
                min={0}
                step="0.01"
                value={draft.amount}
                onChange={(value) => set({ amount: value })}
              />
            ) : null}

            {draft.type === "SPLIT" ? (
              <>
                <Field
                  label="Old shares"
                  type="number"
                  min={0}
                  step="1"
                  value={draft.ratioFrom}
                  onChange={(value) => set({ ratioFrom: value })}
                />
                <Field
                  label="become new shares"
                  type="number"
                  min={0}
                  step="1"
                  value={draft.ratioTo}
                  onChange={(value) => set({ ratioTo: value })}
                />
              </>
            ) : null}

            <Field
              label="Note"
              value={draft.note}
              placeholder="optional"
              onChange={(value) => set({ note: value })}
            />
          </div>

          {preview.lines.length > 0 ? (
            <table className="cost-preview">
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.label} className={line.strong ? "cost-preview-total" : ""}>
                    <td>{line.label}</td>
                    <td className="right num">{formatCurrency(line.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="submit" className="button button-primary">
              Record entry
            </button>
          </div>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Ledger</p>
            <h2>{transactions.length} entries</h2>
          </div>
          <div className="holdings-controls">
            <input
              type="text"
              className="holdings-search"
              placeholder="Filter ticker, type, note..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Ticker</th>
                <th className="right">Shares</th>
                <th className="right">Price</th>
                <th className="right">Value</th>
                <th className="right">Fees</th>
                <th className="right">Tax</th>
                <th>Note</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    {filter ? "No matches." : "No entries yet. Record your first trade above."}
                  </td>
                </tr>
              ) : (
                rows.map((txn) => {
                  const value = rowValue(txn);
                  const fees = rowFees(txn, feeConfig);
                  const tax = (cgtByTxn.get(txn.id) ?? 0) + (whtByTxn.get(txn.id) ?? 0);
                  const issue = issueByTxn.get(txn.id);

                  return (
                    <tr key={txn.id} className={issue ? "ledger-row--issue" : ""}>
                      <td>{formatDateShort(txn.date)}</td>
                      <td>
                        <span className={`txn-tag txn-tag--${txn.type.toLowerCase()}`}>
                          {txn.type}
                        </span>
                      </td>
                      <td>{txn.ticker || "—"}</td>
                      <td className="right num">
                        {txn.type === "SPLIT"
                          ? `${txn.ratioFrom}:${txn.ratioTo}`
                          : txn.shares
                            ? txn.shares.toLocaleString()
                            : "—"}
                      </td>
                      <td className="right num">
                        {txn.price ? formatCurrency(txn.price) : "—"}
                      </td>
                      <td className="right num">{value ? formatCurrency(value) : "—"}</td>
                      <td className="right num">{fees ? formatCurrency(fees) : "—"}</td>
                      <td className="right num">{tax ? formatCurrency(tax) : "—"}</td>
                      <td>
                        {txn.note}
                        {issue ? <span className="ledger-issue-flag">{issue}</span> : null}
                      </td>
                      <td className="right">
                        <button
                          type="button"
                          className="remove-button"
                          onClick={() => removeTransaction(txn.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function rowValue(txn: Transaction): number {
  if (txn.type === "DEPOSIT" || txn.type === "WITHDRAW") return txn.amount;
  if (txn.type === "DIVIDEND") return txn.amount > 0 ? txn.amount : 0;
  if (txn.type === "SPLIT") return 0;
  return tradeValue(txn.shares, txn.price);
}

function rowFees(txn: Transaction, cfg: FeeConfig): number {
  if (txn.type !== "BUY" && txn.type !== "SELL") return 0;
  return computeTradeCosts(txn.shares, txn.price, cfg, txn.feeOverride).total;
}

type PreviewLine = { label: string; value: number; strong?: boolean };

/**
 * What the entry being typed will do. CGT is deliberately absent for sells: it
 * depends on which lots FIFO matches, which is only known once the entry joins
 * the ledger — the row's tax column fills in immediately after.
 */
function buildPreview(
  type: TxnType,
  shares: number,
  price: number,
  amount: number,
  state: LedgerState,
  ticker: string,
  cfg: FeeConfig,
): { lines: PreviewLine[] } {
  const lines: PreviewLine[] = [];

  if (type === "BUY" || type === "SELL" || type === "RIGHT") {
    if (shares <= 0 || price <= 0) return { lines };
    const value = tradeValue(shares, price);
    const fees = type === "RIGHT" ? null : computeTradeCosts(shares, price, cfg);

    lines.push({ label: "Trade value", value });
    if (fees) {
      lines.push({ label: "Commission", value: fees.commission });
      lines.push({ label: "Sales tax on commission", value: fees.salesTax });
      lines.push({ label: "CDC + NCCPL + SECP", value: fees.cdc + fees.nccpl + fees.secp });
      if (fees.flatFee > 0) {
        lines.push({ label: "Flat charge", value: fees.flatFee });
      }
    }
    const total = fees?.total ?? 0;
    lines.push({
      label: type === "SELL" ? "Cash in (before CGT)" : "Cash out",
      value: type === "SELL" ? value - total : value + total,
      strong: true,
    });
    return { lines };
  }

  if (type === "DIVIDEND") {
    const held = state.positions.get(ticker.toUpperCase())?.shares ?? 0;
    const gross = amount > 0 ? amount : roundPaisa(held * price);
    if (gross <= 0) return { lines };
    const wht = roundPaisa((gross * cfg.dividendWhtPct) / 100);
    lines.push({ label: `Gross${amount > 0 ? "" : ` on ${held.toLocaleString()} shares`}`, value: gross });
    lines.push({ label: `Withholding (${cfg.dividendWhtPct}%)`, value: wht });
    lines.push({ label: "Cash in", value: gross - wht, strong: true });
    return { lines };
  }

  if (type === "BONUS") {
    if (shares <= 0) return { lines };
    const value = tradeValue(shares, price);
    const tax = roundPaisa((value * cfg.bonusTaxPct) / 100);
    lines.push({ label: "Issue value", value });
    lines.push({ label: `Bonus tax (${cfg.bonusTaxPct}%)`, value: tax });
    lines.push({ label: "Cash out", value: tax, strong: true });
    return { lines };
  }

  if (type === "DEPOSIT" || type === "WITHDRAW") {
    if (amount <= 0) return { lines };
    lines.push({ label: type === "DEPOSIT" ? "Cash in" : "Cash out", value: amount, strong: true });
    return { lines };
  }

  return { lines };
}
