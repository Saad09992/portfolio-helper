import { useMemo } from "react";
import type { DerivedHolding, Holding } from "../types";
import type { StockLedgerRow } from "../ledger/perStock";
import type { HoldingsSortKey, HoldingsSortState } from "../uiTypes";
import type { HoldingSources } from "../services/psx-scraper";
import { formatCurrency, formatPercent } from "../utils";
import { paisaToRupees } from "../money";
import { Field } from "../components/ui/Field";
import { SortHeader } from "../components/ui/SortHeader";
import { StockSearch } from "../components/StockSearch";

type DraftHolding = Omit<Holding, "id" | "account">;

export type HoldingsPageProps = {
  draft: DraftHolding;
  setDraft: React.Dispatch<React.SetStateAction<DraftHolding>>;
  draftError: string;
  addManualHolding: (event: React.FormEvent<HTMLFormElement>) => void;
  holdingsSearch: string;
  setHoldingsSearch: (value: string) => void;
  sortedHoldings: DerivedHolding[];
  holdingsSort: HoldingsSortState;
  toggleSort: (key: HoldingsSortKey) => void;
  updateHoldingShares: (id: string, value: number) => void;
  updateHoldingCostBasis: (id: string, value: number) => void;
  removeHolding: (id: string) => void;
  quoteSources: HoldingSources;
  /** true once the ledger owns share counts and cost basis */
  ledgerActive: boolean;
  stockRows: StockLedgerRow[];
  onOpenLedger: () => void;
};

export function HoldingsPage({
  draft,
  setDraft,
  draftError,
  addManualHolding,
  holdingsSearch,
  setHoldingsSearch,
  sortedHoldings,
  holdingsSort,
  toggleSort,
  updateHoldingShares,
  updateHoldingCostBasis,
  removeHolding,
  quoteSources,
  ledgerActive,
  stockRows,
  onOpenLedger,
}: HoldingsPageProps) {
  const rowByTicker = useMemo(() => {
    const map = new Map<string, StockLedgerRow>();
    for (const row of stockRows) map.set(row.ticker, row);
    return map;
  }, [stockRows]);

  return (
    <>
      {ledgerActive ? (
        <section className="panel holdings-ledger-note">
          <p className="muted-note">
            Share counts and average cost are derived from your trade ledger —
            edit them by recording buys, sells and corporate actions.{" "}
            <button type="button" className="button button-sm" onClick={onOpenLedger}>
              Open Ledger
            </button>
          </p>
        </section>
      ) : (
      <section className="quick-add-card panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Quick add</p>
            <h2>Manual holding</h2>
          </div>
          <span className="panel-meta">No CSV required</span>
        </div>

        <form onSubmit={addManualHolding}>
          <div className="form-grid">
            <StockSearch
              onSelect={(stock) =>
                setDraft((current) => ({
                  ...current,
                  ticker: stock.ticker,
                  name: stock.name,
                  sector: stock.sector,
                }))
              }
              selected={draft.ticker ? `${draft.ticker} — ${draft.name}` : ""}
              onClear={() =>
                setDraft((current) => ({
                  ...current,
                  ticker: "",
                  name: "",
                  sector: "Uncategorized",
                }))
              }
            />
            <Field
              label="Shares"
              type="number"
              min={0}
              step="1"
              value={String(draft.shares)}
              onChange={(value) =>
                setDraft((current) => ({ ...current, shares: Number(value) }))
              }
            />
            <Field
              label="Avg price (Rs)"
              type="number"
              min={0}
              step="0.01"
              value={String(draft.costBasis)}
              onChange={(value) =>
                setDraft((current) => ({ ...current, costBasis: Number(value) }))
              }
            />
          </div>

          {draftError ? <p className="form-error">{draftError}</p> : null}

          <div className="form-actions">
            <button type="submit" className="button button-primary">
              Add record
            </button>
          </div>
        </form>
      </section>
      )}

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Holdings</p>
            <h2>Portfolio breakdown</h2>
          </div>
          <div className="holdings-controls">
            <input
              type="text"
              className="holdings-search"
              placeholder="Search ticker, name, sector..."
              value={holdingsSearch}
              onChange={(e) => setHoldingsSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Ticker" sortKey="ticker" sort={holdingsSort} onClick={toggleSort} />
                <SortHeader label="Name" sortKey="name" sort={holdingsSort} onClick={toggleSort} />
                <SortHeader label="Sector" sortKey="sector" sort={holdingsSort} onClick={toggleSort} />
                <SortHeader label="Shares" sortKey="shares" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Avg price" sortKey="costBasis" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Current price" sortKey="price" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Day %" sortKey="dayChangePct" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Market value" sortKey="marketValue" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Weight" sortKey="weight" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="P&L today" sortKey="pnlToday" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="P&L total" sortKey="gainLoss" sort={holdingsSort} onClick={toggleSort} align="right" />
                {ledgerActive ? <th className="right">Realized</th> : null}
                {ledgerActive ? <th className="right">Net P&L</th> : null}
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.length === 0 ? (
                <tr>
                  <td colSpan={ledgerActive ? 14 : 12} className="empty-state">
                    {holdingsSearch ? "No matches." : "No holdings yet. Use Quick add above or Import a saved backup."}
                  </td>
                </tr>
              ) : (
                sortedHoldings.map((holding) => {
                  const syntheticCash = holding.id.startsWith("cash-");
                  const src = quoteSources[holding.ticker.toUpperCase()];
                  const fallback =
                    src?.price === "sarmaaya" || src?.dividend === "sarmaaya";
                  const stock = rowByTicker.get(holding.ticker.toUpperCase());
                  // Ledger-derived positions are read-only: the trade log is
                  // the only place share counts and cost basis can change.
                  const editable = !syntheticCash && !ledgerActive;

                  return (
                    <tr key={holding.id}>
                      <td>
                        {holding.ticker}
                        {fallback ? (
                          <span
                            className="source-badge"
                            title="Served via sarmaaya.pk fallback — PSX source failed"
                          >
                            sarmaaya
                          </span>
                        ) : null}
                      </td>
                      <td>{holding.name}</td>
                      <td>{holding.sector}</td>
                      <td className="right">
                        {!editable ? (
                          <span className="num">{holding.shares.toLocaleString()}</span>
                        ) : (
                          <input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="0"
                            className="inline-edit num"
                            defaultValue={holding.shares}
                            title="Edit shares"
                            onBlur={(e) => {
                              const next = Number(e.currentTarget.value);
                              if (next !== holding.shares) {
                                updateHoldingShares(holding.id, next);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                e.currentTarget.value = String(holding.shares);
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="right">
                        {!editable ? (
                          <span className="num">{formatCurrency(holding.costBasis)}</span>
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            className="inline-edit num"
                            defaultValue={paisaToRupees(holding.costBasis)}
                            title="Edit avg price (cost basis per share)"
                            onBlur={(e) => {
                              // Widget is in rupees; handler converts to paisa.
                              const next = Number(e.currentTarget.value);
                              if (next !== paisaToRupees(holding.costBasis)) {
                                updateHoldingCostBasis(holding.id, next);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                e.currentTarget.value = String(paisaToRupees(holding.costBasis));
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="right num">{formatCurrency(holding.price)}</td>
                      <td className={`right num ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash ? "-" : `${holding.dayChangePct.toFixed(2)}%`}
                      </td>
                      <td className="right num">{formatCurrency(holding.marketValue)}</td>
                      <td className="right num">{formatPercent(holding.weight)}</td>
                      <td className={`right num ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash ? "-" : (
                          <>
                            {formatCurrency(holding.marketValue * holding.dayChangePct / (100 + holding.dayChangePct))}
                            <br />
                            <small>{holding.dayChangePct >= 0 ? "+" : ""}{holding.dayChangePct.toFixed(2)}%</small>
                          </>
                        )}
                      </td>
                      <td className={`right num ${holding.gainLoss >= 0 ? "positive" : "negative"}`}>
                        {formatCurrency(holding.gainLoss)}
                        {!syntheticCash && holding.costValue > 0 && (
                          <>
                            <br />
                            <small>{holding.gainLoss >= 0 ? "+" : ""}{((holding.gainLoss / holding.costValue) * 100).toFixed(2)}%</small>
                          </>
                        )}
                      </td>
                      {ledgerActive ? (
                        <td
                          className={`right num ${(stock?.realized ?? 0) >= 0 ? "positive" : "negative"}`}
                        >
                          {stock ? formatCurrency(stock.realized) : "—"}
                        </td>
                      ) : null}
                      {ledgerActive ? (
                        <td
                          className={`right num ${(stock?.totalNet ?? 0) >= 0 ? "positive" : "negative"}`}
                        >
                          {stock ? formatCurrency(stock.totalNet) : "—"}
                        </td>
                      ) : null}
                      <td className="right">
                        {syntheticCash || ledgerActive ? (
                          "-"
                        ) : (
                          <button
                            type="button"
                            className="remove-button"
                            onClick={() => removeHolding(holding.id)}
                          >
                            Remove
                          </button>
                        )}
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
