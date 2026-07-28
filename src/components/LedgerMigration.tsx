import { useState } from "react";
import type { Holding } from "../types";
import type { TransactionDraft } from "../hooks/useLedger";
import { formatCurrency } from "../utils";

export type LedgerMigrationProps = {
  holdings: Holding[];
  /** paisa — the hand-typed cash figure, seeded as an opening deposit */
  cashAvailable: number;
  /** ISO day used as the default acquisition date */
  defaultDate: string;
  onImport: (drafts: TransactionDraft[]) => void;
};

/**
 * One-time bridge from hand-maintained holdings into the ledger.
 *
 * Each position becomes an "opening balance" BUY at its recorded average cost
 * with zero fees — those costs were already paid and are baked into the average,
 * so charging them again would overstate the cost basis. The acquisition date is
 * editable because it decides which CGT rate tier the shares fall into.
 */
/**
 * Earliest acquisition date entered, so the opening deposit lands on or before
 * the first buy and the balance never dips negative mid-replay.
 */
function earliestDate(dates: Record<string, string>, fallback: string): string {
  const all = Object.values(dates).filter(Boolean);
  return all.length > 0 ? all.reduce((a, b) => (a < b ? a : b)) : fallback;
}

export function LedgerMigration({
  holdings,
  cashAvailable,
  defaultDate,
  onImport,
}: LedgerMigrationProps) {
  const positions = holdings.filter((h) => !h.id.startsWith("cash-") && h.shares > 0);
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(positions.map((h) => [h.id, defaultDate])),
  );
  const [includeCash, setIncludeCash] = useState(cashAvailable > 0);

  if (positions.length === 0 && cashAvailable <= 0) return null;

  // Opening buys debit cash like any other buy, so the opening deposit has to
  // cover the capital ALREADY deployed in those shares — not just the cash
  // sitting idle. Deposit anything less and the account opens overdrawn by the
  // cost of the portfolio.
  const deployedCapital = positions.reduce((sum, h) => sum + h.shares * h.costBasis, 0);
  const freeCash = includeCash ? cashAvailable : 0;
  const openingDeposit = deployedCapital + freeCash;

  const buildDrafts = (): TransactionDraft[] => {
    const drafts: TransactionDraft[] = positions.map((h) => ({
      date: dates[h.id] ?? defaultDate,
      type: "BUY",
      ticker: h.ticker.toUpperCase(),
      name: h.name,
      sector: h.sector,
      shares: h.shares,
      price: h.costBasis,
      amount: 0,
      // Costs are already inside the recorded average — don't charge them twice.
      feeOverride: { total: 0 },
      note: "opening balance",
    }));

    if (openingDeposit > 0) {
      drafts.unshift({
        date: earliestDate(dates, defaultDate),
        type: "DEPOSIT",
        ticker: "",
        name: "",
        sector: "",
        shares: 0,
        price: 0,
        amount: openingDeposit,
        note: "opening capital",
      });
    }
    return drafts;
  };

  return (
    <section className="panel ledger-migration">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Start here</p>
          <h2>Import current positions into the ledger</h2>
        </div>
        <span className="panel-meta">One time</span>
      </div>

      <p className="muted-note">
        Your {positions.length} existing position{positions.length === 1 ? "" : "s"} become
        opening-balance buys at their recorded average cost, with no fees charged
        (those are already inside the average). One deposit is recorded alongside
        them for the capital those shares cost, so the account opens funded rather
        than overdrawn. <strong>Set the acquisition date for each</strong> — it
        decides which capital gains tax tier applies when you sell, and it anchors
        the holding period.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="right">Shares</th>
              <th className="right">Avg cost</th>
              <th className="right">Value at cost</th>
              <th>Acquisition date</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((h) => (
              <tr key={h.id}>
                <td>{h.ticker}</td>
                <td className="right num">{h.shares.toLocaleString()}</td>
                <td className="right num">{formatCurrency(h.costBasis)}</td>
                <td className="right num">{formatCurrency(h.shares * h.costBasis)}</td>
                <td>
                  <input
                    type="date"
                    className="inline-edit"
                    value={dates[h.id] ?? defaultDate}
                    onChange={(e) =>
                      setDates((cur) => ({ ...cur, [h.id]: e.target.value }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className="cost-preview">
        <tbody>
          <tr>
            <td>Capital already in these shares</td>
            <td className="right num">{formatCurrency(deployedCapital)}</td>
          </tr>
          <tr>
            <td>Free cash carried over</td>
            <td className="right num">{formatCurrency(freeCash)}</td>
          </tr>
          <tr className="cost-preview-total">
            <td>Opening deposit recorded</td>
            <td className="right num">{formatCurrency(openingDeposit)}</td>
          </tr>
          <tr className="cost-preview-total">
            <td>Cash balance after import</td>
            <td className="right num">{formatCurrency(freeCash)}</td>
          </tr>
        </tbody>
      </table>

      {cashAvailable > 0 ? (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includeCash}
            onChange={(e) => setIncludeCash(e.target.checked)}
          />
          <span>
            Also carry over the {formatCurrency(cashAvailable)} of uninvested cash
            recorded on the Income tab. Untick only if that figure is stale.
          </span>
        </label>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => onImport(buildDrafts())}
        >
          Import {positions.length} position{positions.length === 1 ? "" : "s"} +{" "}
          {formatCurrency(openingDeposit)} opening deposit
        </button>
      </div>
    </section>
  );
}
