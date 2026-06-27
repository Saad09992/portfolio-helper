import type { DerivedHolding, Holding } from "../types";
import type { HoldingsSortKey, HoldingsSortState } from "../uiTypes";
import type { HoldingSources } from "../services/psx-scraper";
import { formatCurrency, formatPercent } from "../utils";
import { Field } from "../components/ui/Field";
import { SortHeader } from "../components/ui/SortHeader";
import { StockSearch } from "../components/StockSearch";
import { CryptoSearch } from "../components/CryptoSearch";

type DraftHolding = Omit<Holding, "id" | "account">;
type ClassFilter = "all" | "stock" | "crypto";

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
  classFilter: ClassFilter;
  setClassFilter: (f: ClassFilter) => void;
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
  classFilter,
  setClassFilter,
}: HoldingsPageProps) {
  const isCrypto = draft.assetClass === "crypto";
  return (
    <>
      <section className="quick-add-card panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Quick add</p>
            <h2>Manual holding</h2>
          </div>
          <span className="panel-meta">No CSV required</span>
        </div>

        <div className="chip-group asset-class-toggle">
          {(["stock", "crypto"] as const).map((cls) => (
            <button
              key={cls}
              type="button"
              className={`chip ${draft.assetClass === cls || (cls === "stock" && !draft.assetClass) ? "chip--active" : ""}`}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  assetClass: cls,
                  ticker: "",
                  name: "",
                  coinId: "",
                  sector: cls === "crypto" ? "Crypto" : "Uncategorized",
                }))
              }
            >
              {cls === "stock" ? "Stock (PSX)" : "Crypto"}
            </button>
          ))}
        </div>

        <form onSubmit={addManualHolding}>
          <div className="form-grid">
            {isCrypto ? (
              <CryptoSearch
                onSelect={(coin) =>
                  setDraft((current) => ({
                    ...current,
                    ticker: coin.symbol,
                    name: coin.name,
                    coinId: coin.id,
                    sector: "Crypto",
                    assetClass: "crypto",
                  }))
                }
                selected={draft.coinId ? `${draft.ticker} — ${draft.name}` : ""}
                onClear={() =>
                  setDraft((current) => ({
                    ...current,
                    ticker: "",
                    name: "",
                    coinId: "",
                  }))
                }
              />
            ) : (
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
            )}
            <Field
              label={isCrypto ? "Quantity" : "Shares"}
              type="number"
              min={0}
              step={isCrypto ? "any" : "1"}
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

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Holdings</p>
            <h2>Portfolio breakdown</h2>
          </div>
          <div className="holdings-controls">
            <div className="chip-group">
              {(["all", "stock", "crypto"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${classFilter === f ? "chip--active" : ""}`}
                  onClick={() => setClassFilter(f)}
                >
                  {f === "all" ? "All" : f === "stock" ? "Stocks" : "Crypto"}
                </button>
              ))}
            </div>
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
                <th>Class</th>
                <SortHeader label="Sector" sortKey="sector" sort={holdingsSort} onClick={toggleSort} />
                <SortHeader label="Shares" sortKey="shares" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Avg price" sortKey="costBasis" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Current price" sortKey="price" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Day %" sortKey="dayChangePct" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Market value" sortKey="marketValue" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="Weight" sortKey="weight" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="P&L today" sortKey="pnlToday" sort={holdingsSort} onClick={toggleSort} align="right" />
                <SortHeader label="P&L total" sortKey="gainLoss" sort={holdingsSort} onClick={toggleSort} align="right" />
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.length === 0 ? (
                <tr>
                  <td colSpan={14} className="empty-state">
                    {holdingsSearch ? "No matches." : "No holdings yet. Use Quick add above or Import a saved backup."}
                  </td>
                </tr>
              ) : (
                sortedHoldings.map((holding) => {
                  const syntheticCash = holding.id.startsWith("cash-");
                  const src = quoteSources[holding.ticker.toUpperCase()];
                  const fallback =
                    src?.price === "sarmaaya" || src?.dividend === "sarmaaya";
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
                      <td>
                        {syntheticCash ? (
                          "—"
                        ) : (
                          <span className={`class-tag class-tag--${holding.assetClass ?? "stock"}`}>
                            {holding.assetClass === "crypto" ? "crypto" : "stock"}
                          </span>
                        )}
                      </td>
                      <td>{holding.sector}</td>
                      <td className="right">
                        {syntheticCash ? (
                          <span className="num">{holding.shares.toLocaleString()}</span>
                        ) : (
                          <input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="1"
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
                        {syntheticCash ? (
                          <span className="num">{formatCurrency(holding.costBasis)}</span>
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            className="inline-edit num"
                            defaultValue={holding.costBasis}
                            title="Edit avg price (cost basis per share)"
                            onBlur={(e) => {
                              const next = Number(e.currentTarget.value);
                              if (next !== holding.costBasis) {
                                updateHoldingCostBasis(holding.id, next);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                e.currentTarget.value = String(holding.costBasis);
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="right num">
                        {formatCurrency(holding.price)}
                        {holding.assetClass === "crypto" && holding.usdPrice ? (
                          <>
                            <br />
                            <small className="usd-secondary">~${holding.usdPrice.toLocaleString()}</small>
                          </>
                        ) : null}
                      </td>
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
                      <td className="right">
                        {syntheticCash ? (
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
