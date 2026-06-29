import type { DerivedHolding, Holding, MetalId, MetalUnit } from "../types";
import type { HoldingsSortKey, HoldingsSortState } from "../uiTypes";
import type { HoldingSources } from "../services/psx-scraper";
import { formatCurrency, formatPercent, formatUsd } from "../utils";
import {
  GRAMS_PER_UNIT,
  METAL_LABEL,
  METAL_UNITS,
  UNIT_LABEL,
  formatQty,
  gramsToUnit,
  unitToGrams,
} from "../portfolio/metals";
import { Field } from "../components/ui/Field";
import { SortHeader } from "../components/ui/SortHeader";
import { StockSearch } from "../components/StockSearch";
import { CryptoSearch } from "../components/CryptoSearch";

type DraftHolding = Omit<Holding, "id" | "account">;
type ClassFilter = "all" | "stock" | "crypto" | "metal";

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
  updateHoldingUnit: (id: string, unit: MetalUnit) => void;
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
  updateHoldingUnit,
  removeHolding,
  quoteSources,
  classFilter,
  setClassFilter,
}: HoldingsPageProps) {
  const isCrypto = draft.assetClass === "crypto";
  const isMetal = draft.assetClass === "metal";
  const draftUnit: MetalUnit = draft.unit ?? "tola";
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
          {(["stock", "crypto", "metal"] as const).map((cls) => (
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
                  sector:
                    cls === "crypto" ? "Crypto" : cls === "metal" ? "Metals" : "Uncategorized",
                  ...(cls === "metal" && { metalId: current.metalId ?? "gold", unit: current.unit ?? "tola" }),
                }))
              }
            >
              {cls === "stock" ? "Stock (PSX)" : cls === "crypto" ? "Crypto" : "Metal"}
            </button>
          ))}
        </div>

        <form onSubmit={addManualHolding}>
          <div className="form-grid">
            {isMetal ? (
              <>
                <label className="field">
                  <span>Metal</span>
                  <select
                    value={draft.metalId ?? "gold"}
                    onChange={(e) =>
                      setDraft((current) => ({
                        ...current,
                        metalId: e.target.value as MetalId,
                        name: METAL_LABEL[e.target.value as MetalId],
                        ticker: (e.target.value as string).toUpperCase(),
                      }))
                    }
                  >
                    <option value="gold">Gold (XAU)</option>
                    <option value="silver">Silver (XAG)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Unit</span>
                  <select
                    value={draftUnit}
                    onChange={(e) => {
                      const nextUnit = e.target.value as MetalUnit;
                      setDraft((current) => {
                        const prevUnit = current.unit ?? "tola";
                        // Keep the same physical weight when switching units.
                        const grams = unitToGrams(current.shares, prevUnit);
                        return {
                          ...current,
                          unit: nextUnit,
                          shares: gramsToUnit(grams, nextUnit),
                        };
                      });
                    }}
                  >
                    {METAL_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {UNIT_LABEL[u]}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label={`Quantity (${UNIT_LABEL[draftUnit]})`}
                  type="number"
                  min={0}
                  step="any"
                  value={String(draft.shares)}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, shares: Number(value) }))
                  }
                />
                <Field
                  label={`Avg cost (Rs/${UNIT_LABEL[draftUnit]})`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(draft.costBasis)}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, costBasis: Number(value) }))
                  }
                />
              </>
            ) : isCrypto ? (
              <>
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
                <Field
                  label="Quantity"
                  type="number"
                  min={0}
                  step="any"
                  value={String(draft.shares)}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, shares: Number(value) }))
                  }
                />
                <Field
                  label="Avg cost (USD)"
                  type="number"
                  min={0}
                  step="any"
                  value={String(draft.usdCostBasis ?? 0)}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, usdCostBasis: Number(value) }))
                  }
                />
              </>
            ) : (
              <>
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
              </>
            )}
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
              {(["all", "stock", "crypto", "metal"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${classFilter === f ? "chip--active" : ""}`}
                  onClick={() => setClassFilter(f)}
                >
                  {f === "all" ? "All" : f === "stock" ? "Stocks" : f === "crypto" ? "Crypto" : "Metals"}
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
                <SortHeader label="Qty" sortKey="shares" sort={holdingsSort} onClick={toggleSort} align="right" />
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
                  const isCryptoRow = holding.assetClass === "crypto";
                  const isMetalRow = holding.assetClass === "metal";
                  const src = quoteSources[holding.ticker.toUpperCase()];
                  const fallback =
                    src?.price === "sarmaaya" || src?.dividend === "sarmaaya";

                  // Metal display helpers — stored canonically in grams / PKR-per-gram.
                  const mUnit: MetalUnit = holding.unit ?? "tola";
                  const gpu = GRAMS_PER_UNIT[mUnit];
                  const mQty = gramsToUnit(holding.shares, mUnit);
                  const mPricePkr = holding.price * gpu;
                  const mCostPkr = holding.costBasis * gpu;
                  const usdPerGram = holding.usdPrice ?? 0;
                  // Implied PKR/USD from today's spot, for the USD secondary labels.
                  const fx = holding.price > 0 && usdPerGram > 0 ? holding.price / usdPerGram : 0;
                  const toUsd = (pkr: number) => (fx > 0 ? pkr / fx : 0);

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
                            {holding.assetClass ?? "stock"}
                          </span>
                        )}
                      </td>
                      <td>{holding.sector}</td>
                      <td className="right">
                        {syntheticCash ? (
                          <span className="num">{holding.shares.toLocaleString()}</span>
                        ) : isMetalRow ? (
                          <span className="metal-qty-cell">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              className="inline-edit num metal-qty-input"
                              defaultValue={formatQty(mQty)}
                              title={`Edit quantity (${UNIT_LABEL[mUnit]})`}
                              key={`${holding.id}-${mUnit}`}
                              onBlur={(e) => {
                                const next = unitToGrams(Number(e.currentTarget.value), mUnit);
                                if (next !== holding.shares) {
                                  updateHoldingShares(holding.id, next);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") {
                                  e.currentTarget.value = formatQty(mQty);
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                            <select
                              className="metal-unit-select"
                              value={mUnit}
                              title="Display unit"
                              aria-label="Display unit"
                              onChange={(e) => updateHoldingUnit(holding.id, e.target.value as MetalUnit)}
                            >
                              {METAL_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {UNIT_LABEL[u]}
                                </option>
                              ))}
                            </select>
                          </span>
                        ) : (
                          <input
                            type="number"
                            inputMode={isCryptoRow ? "decimal" : "numeric"}
                            step={isCryptoRow ? "any" : "1"}
                            min="0"
                            className="inline-edit num"
                            defaultValue={holding.shares}
                            title={isCryptoRow ? "Edit quantity" : "Edit shares"}
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
                        ) : isCryptoRow ? (
                          <span className="num">
                            {formatUsd(holding.usdCostBasis ?? 0)}
                            <br />
                            <small className="pkr-secondary">≈ {formatCurrency(holding.costBasis)}</small>
                          </span>
                        ) : isMetalRow ? (
                          <span className="num">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              className="inline-edit num"
                              defaultValue={mCostPkr.toFixed(2)}
                              title={`Edit avg cost (Rs/${UNIT_LABEL[mUnit]})`}
                              key={`${holding.id}-cost-${mUnit}`}
                              onBlur={(e) => {
                                const perGram = Number(e.currentTarget.value) / gpu;
                                if (perGram !== holding.costBasis) {
                                  updateHoldingCostBasis(holding.id, perGram);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") {
                                  e.currentTarget.value = mCostPkr.toFixed(2);
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                            <br />
                            <small className="pkr-secondary">≈ {formatUsd(toUsd(mCostPkr))}</small>
                          </span>
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
                        {isCryptoRow ? (
                          <>
                            {formatUsd(holding.usdPrice ?? 0)}
                            <br />
                            <small className="pkr-secondary">≈ {formatCurrency(holding.price)}</small>
                          </>
                        ) : isMetalRow ? (
                          <>
                            {formatCurrency(mPricePkr)}/{UNIT_LABEL[mUnit]}
                            <br />
                            <small className="pkr-secondary">≈ {formatUsd(toUsd(mPricePkr))}/{UNIT_LABEL[mUnit]}</small>
                          </>
                        ) : (
                          formatCurrency(holding.price)
                        )}
                      </td>
                      <td className={`right num ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash || isMetalRow ? "-" : `${holding.dayChangePct.toFixed(2)}%`}
                      </td>
                      <td className="right num">
                        {isCryptoRow ? (
                          <>
                            {formatUsd(holding.shares * (holding.usdPrice ?? 0))}
                            <br />
                            <small className="pkr-secondary">≈ {formatCurrency(holding.marketValue)}</small>
                          </>
                        ) : isMetalRow ? (
                          <>
                            {formatCurrency(holding.marketValue)}
                            <br />
                            <small className="pkr-secondary">≈ {formatUsd(holding.shares * usdPerGram)}</small>
                          </>
                        ) : (
                          formatCurrency(holding.marketValue)
                        )}
                      </td>
                      <td className="right num">{formatPercent(holding.weight)}</td>
                      <td className={`right num ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash || isMetalRow ? "-" : isCryptoRow ? (
                          <>
                            {formatUsd(
                              (holding.shares * (holding.usdPrice ?? 0)) *
                                holding.dayChangePct / (100 + holding.dayChangePct),
                            )}
                            <br />
                            <small className="pkr-secondary">
                              ≈ {formatCurrency(holding.marketValue * holding.dayChangePct / (100 + holding.dayChangePct))}
                            </small>
                          </>
                        ) : (
                          <>
                            {formatCurrency(holding.marketValue * holding.dayChangePct / (100 + holding.dayChangePct))}
                            <br />
                            <small>{holding.dayChangePct >= 0 ? "+" : ""}{holding.dayChangePct.toFixed(2)}%</small>
                          </>
                        )}
                      </td>
                      <td className={`right num ${holding.gainLoss >= 0 ? "positive" : "negative"}`}>
                        {isCryptoRow ? (
                          <>
                            {(() => {
                              const usdGain = holding.shares * ((holding.usdPrice ?? 0) - (holding.usdCostBasis ?? 0));
                              return formatUsd(usdGain);
                            })()}
                            <br />
                            <small className="pkr-secondary">≈ {formatCurrency(holding.gainLoss)}</small>
                          </>
                        ) : isMetalRow ? (
                          <>
                            {formatCurrency(holding.gainLoss)}
                            {holding.costValue > 0 && (
                              <>
                                <br />
                                <small>{holding.gainLoss >= 0 ? "+" : ""}{((holding.gainLoss / holding.costValue) * 100).toFixed(2)}%</small>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {formatCurrency(holding.gainLoss)}
                            {!syntheticCash && holding.costValue > 0 && (
                              <>
                                <br />
                                <small>{holding.gainLoss >= 0 ? "+" : ""}{((holding.gainLoss / holding.costValue) * 100).toFixed(2)}%</small>
                              </>
                            )}
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
