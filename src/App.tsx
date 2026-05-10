import { useEffect, useMemo, useRef, useState } from "react";
import type { Holding } from "./types";
import {
  computePortfolio,
  createId,
  formatCurrency,
  formatPercent,
  parseHoldingsCsv,
  sampleHoldings,
  storageKey,
} from "./utils";
import { applyMarketData, fetchDividends, fetchMarketData } from "./services/psx-scraper";

type SectorBucket = {
  sector: string;
  value: number;
  weight: number;
  holdings: number;
};

type DraftHolding = Omit<Holding, "id" | "account">;

type CashBuckets = {
  available: number;
};

type TargetAllocation = {
  id: string;
  mode: "sector" | "ticker";
  key: string;
  targetWeight: number;
};

type DraftTarget = {
  mode: "sector" | "ticker";
  key: string;
  targetWeightPct: number;
};

type InvestmentEntry = {
  id: string;
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};

type DraftInvestment = {
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};

const cashStorageKey = `${storageKey}:cash-buckets`;
const targetStorageKey = `${storageKey}:targets`;
const investStorageKey = `${storageKey}:investments`;

const emptyDraft: DraftHolding = {
  ticker: "",
  name: "",
  sector: "Uncategorized",
  shares: 0,
  price: 0,
  costBasis: 0,
  dayChangePct: 0,
  dividendPerShare: 0,
  payoutDate: "",
};

const emptyCashBuckets: CashBuckets = {
  available: 0,
};

const emptyTargetDraft: DraftTarget = {
  mode: "sector",
  key: "",
  targetWeightPct: 0,
};

const emptyInvestmentDraft: DraftInvestment = {
  date: "",
  label: "",
  amount: 0,
  valueEom: 0,
};

function App() {
  const [holdings, setHoldings] = useState<Holding[]>(() => loadHoldings());
  const [draft, setDraft] = useState<DraftHolding>(emptyDraft);
  const [cashDraft, setCashDraft] = useState<CashBuckets>(() => loadCashBuckets());
  const [targets, setTargets] = useState<TargetAllocation[]>(() => loadTargets());
  const [targetDraft, setTargetDraft] = useState<DraftTarget>(emptyTargetDraft);
  const [targetFilter, setTargetFilter] = useState("");
  const [targetStatusFilter, setTargetStatusFilter] = useState<"all" | "over" | "under" | "ontrack">("all");
  const [targetSort, setTargetSort] = useState<"drift" | "name" | "weight">("drift");
  const [treemapMode, setTreemapMode] = useState<"sector" | "ticker">("sector");
  const [page, setPage] = useState<"overview" | "holdings" | "targets" | "income" | "invest">("overview");
  const [investments, setInvestments] = useState<InvestmentEntry[]>(() => loadInvestments());
  const [investDraft, setInvestDraft] = useState<DraftInvestment>(emptyInvestmentDraft);
  const [investError, setInvestError] = useState("");

  const [fetching, setFetching] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [cashError, setCashError] = useState("");
  const [targetError, setTargetError] = useState("");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(holdings));
  }, [holdings]);

  useEffect(() => {
    window.localStorage.setItem(cashStorageKey, JSON.stringify(cashDraft));
  }, [cashDraft]);

  useEffect(() => {
    window.localStorage.setItem(targetStorageKey, JSON.stringify(targets));
  }, [targets]);

  useEffect(() => {
    window.localStorage.setItem(investStorageKey, JSON.stringify(investments));
  }, [investments]);

  const holdingsWithCash = useMemo(
    () => buildHoldingsWithCash(holdings, cashDraft),
    [holdings, cashDraft],
  );

  const portfolio = useMemo(
    () => computePortfolio(holdingsWithCash),
    [holdingsWithCash],
  );
  const sectors = useMemo(
    () => buildSectorBuckets(portfolio.holdings),
    [portfolio.holdings],
  );

  const nonCashPortfolio = portfolio.holdings.filter(
    (holding) => holding.sector.toLowerCase() !== "cash",
  );

  const topHolding = portfolio.holdings[0];
  const cashWeight = portfolio.totalValue > 0 ? cashDraft.available / portfolio.totalValue : 0;
  const cashMessage = getCashDeploymentIdea(cashWeight);

  const annualizedDividendIncome = nonCashPortfolio.reduce(
    (sum, holding) => sum + holding.shares * holding.dividendPerShare,
    0,
  );
  const equityCost = nonCashPortfolio.reduce((sum, holding) => sum + holding.costValue, 0);
  const yieldOnCost = equityCost > 0 ? annualizedDividendIncome / equityCost : 0;
  const upcomingDividends = [...nonCashPortfolio]
    .filter((holding) => holding.payoutDate)
    .sort((left, right) => left.payoutDate.localeCompare(right.payoutDate))
    .slice(0, 4);

  const sectorWeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const bucket of sectors) {
      map.set(bucket.sector.toLowerCase(), bucket.weight);
    }
    return map;
  }, [sectors]);

  const tickerWeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const holding of portfolio.holdings) {
      map.set(holding.ticker.toLowerCase(), holding.weight);
    }
    return map;
  }, [portfolio.holdings]);

  const tickerPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of portfolio.holdings) {
      map.set(h.ticker.toLowerCase(), h.price);
    }
    return map;
  }, [portfolio.holdings]);

  const targetRows = targets.map((target) => {
    const lookup = target.mode === "sector" ? sectorWeightMap : tickerWeightMap;
    const currentWeight = lookup.get(target.key.toLowerCase()) ?? 0;
    const drift = currentWeight - target.targetWeight;
    const gapValue = (target.targetWeight - currentWeight) * portfolio.totalValue;
    const absDrift = Math.abs(drift);
    const status: "severe" | "moderate" | "ontrack" =
      absDrift >= 0.05 ? "severe" : absDrift >= 0.02 ? "moderate" : "ontrack";
    const price = target.mode === "ticker" ? tickerPriceMap.get(target.key.toLowerCase()) ?? 0 : 0;
    const shares = price > 0 ? Math.abs(gapValue) / price : 0;

    return {
      ...target,
      currentWeight,
      drift,
      gapValue,
      absDrift,
      status,
      price,
      shares,
    };
  });

  const driftSummary = useMemo(() => {
    const over = targetRows.filter((r) => r.drift > 0.005).length;
    const under = targetRows.filter((r) => r.drift < -0.005).length;
    const onTrack = targetRows.length - over - under;
    const totalDeviation = targetRows.reduce((s, r) => s + r.absDrift, 0);
    return { over, under, onTrack, totalDeviation };
  }, [targetRows]);

  const rebalanceSuggestions = targetRows
    .filter(
      (row) =>
        Math.abs(row.gapValue) > Math.max(5000, portfolio.totalValue * 0.01),
    )
    .sort((left, right) => Math.abs(right.gapValue) - Math.abs(left.gapValue))
    .slice(0, 8);

  const buySuggestions = rebalanceSuggestions.filter((r) => r.gapValue > 0);
  const sellSuggestions = rebalanceSuggestions.filter((r) => r.gapValue < 0);

  const investmentRows = useMemo(() => {
    const sorted = [...investments].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((entry) => {
      running += entry.amount;
      const total = running;
      const pnlValue = entry.valueEom - total;
      const pnlPct = total > 0 ? (pnlValue / total) * 100 : 0;
      return { ...entry, total, pnlValue, pnlPct };
    });
  }, [investments]);

  const investmentSummary = useMemo(() => {
    const last = investmentRows[investmentRows.length - 1];
    const totalInvested = last?.total ?? 0;
    const latestValue = last?.valueEom ?? 0;
    const pnlValue = latestValue - totalInvested;
    const pnlPct = totalInvested > 0 ? (pnlValue / totalInvested) * 100 : 0;
    return { totalInvested, latestValue, pnlValue, pnlPct, count: investmentRows.length };
  }, [investmentRows]);

  const treemapItems = useMemo(() => {
    if (treemapMode === "sector") {
      return sectors.map((sector) => ({
        key: sector.sector,
        label: sector.sector,
        value: sector.value,
        weight: sector.weight,
      }));
    }

    return portfolio.holdings.slice(0, 12).map((holding) => ({
      key: holding.id,
      label: holding.ticker,
      value: holding.marketValue,
      weight: holding.weight,
    }));
  }, [treemapMode, sectors, portfolio.holdings]);

  const waterfallRows = [...nonCashPortfolio]
    .sort((left, right) => Math.abs(right.gainLoss) - Math.abs(left.gainLoss))
    .slice(0, 10);

  const maxWaterfall =
    waterfallRows.length > 0
      ? Math.max(...waterfallRows.map((holding) => Math.abs(holding.gainLoss)))
      : 1;

  const topMovers = [...nonCashPortfolio]
    .sort((left, right) => right.dayChangePct - left.dayChangePct)
    .slice(0, 6);

  async function handleImport(file: File) {
    const text = await file.text();
    const imported = parseHoldingsCsv(text).map(normalizeHolding);

    if (imported.length === 0) {
      return;
    }

    setHoldings(imported);
    setDraft(emptyDraft);
    setDraftError("");
  }

  function addManualHolding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ticker = draft.ticker.trim();
    const name = draft.name.trim();

    if (!ticker || !name) {
      setDraftError("Ticker and name are required.");
      return;
    }

    if (draft.shares <= 0 || draft.price < 0 || draft.costBasis < 0) {
      setDraftError(
        "Shares must be positive, and avg/current price cannot be negative.",
      );
      return;
    }

    const holding: Holding = {
      id: createId(),
      ticker: ticker.toUpperCase(),
      name,
      sector: draft.sector.trim() || "Uncategorized",
      account: "PSX",
      shares: draft.shares,
      price: draft.price,
      costBasis: draft.costBasis,
      dayChangePct: draft.dayChangePct,
      dividendPerShare: draft.dividendPerShare,
      payoutDate: draft.payoutDate,
    };

    setHoldings((current) => [holding, ...current]);
    setDraft(emptyDraft);
    setDraftError("");
  }

  function saveCashBuckets(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (cashDraft.available < 0) {
      setCashError("Cash value cannot be negative.");
      return;
    }

    setCashError("");
  }

  function addTargetAllocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const key = targetDraft.key.trim();
    if (!key) {
      setTargetError("Target key is required.");
      return;
    }

    if (targetDraft.targetWeightPct <= 0 || targetDraft.targetWeightPct > 100) {
      setTargetError("Target weight must be between 0 and 100.");
      return;
    }

    const normalizedKey =
      targetDraft.mode === "ticker" ? key.toUpperCase() : key;

    setTargets((current) => [
      {
        id: createId(),
        mode: targetDraft.mode,
        key: normalizedKey,
        targetWeight: targetDraft.targetWeightPct / 100,
      },
      ...current,
    ]);

    setTargetDraft(emptyTargetDraft);
    setTargetError("");
  }

  function removeTarget(id: string) {
    setTargets((current) => current.filter((target) => target.id !== id));
  }

  function addInvestment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!investDraft.date) {
      setInvestError("Date required.");
      return;
    }

    const amount = Number(investDraft.amount);
    const valueEom = Number(investDraft.valueEom);

    if (!Number.isFinite(amount)) {
      setInvestError("Amount must be a number.");
      return;
    }

    if (!Number.isFinite(valueEom) || valueEom < 0) {
      setInvestError("Value EOM must be a non-negative number.");
      return;
    }

    setInvestments((current) => [
      ...current,
      {
        id: createId(),
        date: investDraft.date,
        label: investDraft.label.trim() || `Month ${current.length}`,
        amount,
        valueEom,
      },
    ]);
    setInvestDraft(emptyInvestmentDraft);
    setInvestError("");
  }

  function removeInvestment(id: string) {
    setInvestments((current) => current.filter((entry) => entry.id !== id));
  }

  function removeHolding(id: string) {
    setHoldings((current) => current.filter((holding) => holding.id !== id));
  }


  async function refreshPrices() {
    const nonCash = holdings.filter((h) => !h.id.startsWith("cash-"));
    if (nonCash.length === 0) {
      return;
    }

    setFetching(true);

    try {
      const [quotes, dividends] = await Promise.all([
        fetchMarketData(),
        fetchDividends(nonCash.map((h) => h.ticker)),
      ]);
      const { holdings: updated } = applyMarketData(holdings, quotes, dividends);
      setHoldings(updated);
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-bar">
        <div className="hero-title">
          <p className="eyebrow">PSX portfolio tools</p>
          <h1>Portfolio command center</h1>
        </div>
        <div className="hero-actions">
          <label className="button" htmlFor="import-file">
            Import CSV
          </label>
          <input
            id="import-file"
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
            }}
          />
          <button
            type="button"
            className="button button-primary"
            onClick={refreshPrices}
            disabled={fetching || holdings.length === 0}
          >
            {fetching ? "Fetching..." : "Refresh prices"}
          </button>
        </div>
      </section>

      <nav className="page-nav">
        {([
          ["overview", "Overview"],
          ["holdings", "Holdings"],
          ["targets", "Targets"],
          ["income", "Income"],
          ["invest", "Invest"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`page-nav-tab ${page === key ? "page-nav-tab--active" : ""}`}
            onClick={() => setPage(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {page === "holdings" && (
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
                label="Avg price"
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

      {page === "overview" && (<>
      <section className="stats-grid">
        <StatCard
          label="Total value"
          value={formatCurrency(portfolio.totalValue)}
          detail={`${portfolio.holdings.length} positions`}
        />
        <StatCard
          label="Total avg cost"
          value={formatCurrency(portfolio.totalCost)}
          detail="Cost basis of all positions"
        />
        <StatCard
          label="Unrealized P/L"
          value={formatCurrency(portfolio.totalGainLoss)}
          detail={
            portfolio.totalGainLoss >= 0 ? "Positive drift" : "Downside risk"
          }
          tone={portfolio.totalGainLoss >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Top position"
          value={
            topHolding
              ? `${topHolding.ticker} ${formatPercent(topHolding.weight)}`
              : "None"
          }
          detail={topHolding ? topHolding.name : "Import holdings to begin"}
        />
      </section>

      <section className="stats-grid secondary">
        <StatCard
          label="Cash"
          value={formatCurrency(cashDraft.available)}
          detail={`${formatPercent(cashWeight)} of portfolio`}
        />
        <StatCard
          label="Yield on cost"
          value={formatPercent(yieldOnCost)}
          detail="Annual dividend / equity cost"
        />
      </section>

      <section className="dashboard-grid dual">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Allocation</p>
              <h2>Portfolio weightage</h2>
            </div>
            <span className="panel-meta">Interactive donut</span>
          </div>
          <PieChart holdings={portfolio.holdings} />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Treemap</p>
              <h2>Concentration map</h2>
            </div>
            <div className="toggle-row">
              <button
                type="button"
                className={`chip ${treemapMode === "sector" ? "active" : ""}`}
                onClick={() => setTreemapMode("sector")}
              >
                Sector
              </button>
              <button
                type="button"
                className={`chip ${treemapMode === "ticker" ? "active" : ""}`}
                onClick={() => setTreemapMode("ticker")}
              >
                Ticker
              </button>
            </div>
          </div>
          <Treemap items={treemapItems} />
        </article>
      </section>
      </>)}

      {page === "targets" && (
      <section className="insight-grid targets-grid">
        <article className="panel target-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Targets</p>
              <h2>Allocation drift alerts</h2>
            </div>
          </div>

          <form className="target-form" onSubmit={addTargetAllocation}>
            <select
              value={targetDraft.mode}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  mode: event.target.value as "sector" | "ticker",
                  key: "",
                }))
              }
            >
              <option value="sector">Sector</option>
              <option value="ticker">Ticker</option>
            </select>
            <Combobox
              value={targetDraft.key}
              onChange={(val) =>
                setTargetDraft((current) => ({ ...current, key: val }))
              }
              options={
                targetDraft.mode === "sector"
                  ? sectors.map((s) => s.sector)
                  : portfolio.holdings.map((h) => h.ticker)
              }
              placeholder={targetDraft.mode === "sector" ? "Search sector..." : "Search ticker..."}
            />
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={targetDraft.targetWeightPct}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  targetWeightPct: Number(event.target.value),
                }))
              }
              placeholder="Weight %"
            />
            <button type="submit" className="button">
              Add
            </button>
          </form>

          {targetError ? <p className="form-error">{targetError}</p> : null}

          {targetRows.length > 0 && (
            <>
              <div className="drift-summary">
                <div className="drift-stat drift-stat--over">
                  <span className="drift-stat-num">{driftSummary.over}</span>
                  <span className="drift-stat-label">Over</span>
                </div>
                <div className="drift-stat drift-stat--under">
                  <span className="drift-stat-num">{driftSummary.under}</span>
                  <span className="drift-stat-label">Under</span>
                </div>
                <div className="drift-stat drift-stat--ontrack">
                  <span className="drift-stat-num">{driftSummary.onTrack}</span>
                  <span className="drift-stat-label">On track</span>
                </div>
                <div className="drift-stat">
                  <span className="drift-stat-num">{formatPercent(driftSummary.totalDeviation)}</span>
                  <span className="drift-stat-label">Total drift</span>
                </div>
              </div>

              <div className="drift-controls">
                <div className="chip-group">
                  {(["all", "over", "under", "ontrack"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${targetStatusFilter === s ? "chip--active" : ""}`}
                      onClick={() => setTargetStatusFilter(s)}
                    >
                      {s === "all" ? "All" : s === "over" ? "Over" : s === "under" ? "Under" : "On track"}
                    </button>
                  ))}
                </div>
                <select
                  className="drift-sort"
                  value={targetSort}
                  onChange={(e) => setTargetSort(e.target.value as typeof targetSort)}
                >
                  <option value="drift">Sort: Drift</option>
                  <option value="name">Sort: Name</option>
                  <option value="weight">Sort: Weight</option>
                </select>
                {targetRows.length > 3 && (
                  <input
                    className="target-filter"
                    value={targetFilter}
                    onChange={(e) => setTargetFilter(e.target.value)}
                    placeholder="Search..."
                  />
                )}
              </div>
            </>
          )}

          <div className="target-list">
            {targetRows.length === 0 ? (
              <p className="muted-note">No targets yet. Add sector or ticker targets.</p>
            ) : (
              targetRows
              .filter((row) => !targetFilter || row.key.toLowerCase().includes(targetFilter.toLowerCase()))
              .filter((row) => {
                if (targetStatusFilter === "all") return true;
                if (targetStatusFilter === "over") return row.drift > 0.005;
                if (targetStatusFilter === "under") return row.drift < -0.005;
                return Math.abs(row.drift) <= 0.005;
              })
              .sort((a, b) => {
                if (targetSort === "drift") return b.absDrift - a.absDrift;
                if (targetSort === "name") return a.key.localeCompare(b.key);
                return b.targetWeight - a.targetWeight;
              })
              .map((row) => {
                const scale = Math.max(row.currentWeight, row.targetWeight, 0.01) * 1.1;
                const currentPct = (row.currentWeight / scale) * 100;
                const targetPct = (row.targetWeight / scale) * 100;
                return (
                  <div key={row.id} className={`drift-card drift-card--${row.status}`}>
                    <div className="drift-row-top">
                      <div className="drift-key">
                        <strong>{row.key}</strong>
                        <span className="drift-badge">{row.mode}</span>
                      </div>
                      <div className="drift-percentages">
                        <span className="drift-current-num">{formatPercent(row.currentWeight)}</span>
                        <span className="drift-arrow">→</span>
                        <span className="drift-target-num">{formatPercent(row.targetWeight)}</span>
                      </div>
                      <button
                        type="button"
                        className="drift-remove"
                        onClick={() => removeTarget(row.id)}
                        aria-label="Remove target"
                      >
                        ×
                      </button>
                    </div>
                    <div className="drift-track-combined">
                      <div
                        className={`drift-fill-current ${row.drift >= 0 ? "drift-fill--over" : "drift-fill--under"}`}
                        style={{ width: `${currentPct}%` }}
                      />
                      <div
                        className="drift-target-marker"
                        style={{ left: `${targetPct}%` }}
                        title={`Target ${formatPercent(row.targetWeight)}`}
                      />
                    </div>
                    <div className="drift-row-bottom">
                      <span className={`drift-action-tag ${row.gapValue > 0 ? "buy" : "sell"}`}>
                        {row.gapValue > 0 ? "BUY" : "SELL"} {formatCurrency(Math.abs(row.gapValue))}
                      </span>
                      <span className={`drift-delta ${row.drift >= 0 ? "negative" : "positive"}`}>
                        {row.drift >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(row.drift))}
                      </span>
                      {row.mode === "ticker" && row.shares > 0 && (
                        <span className="drift-shares">~{row.shares.toFixed(0)} sh</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Rebalance</p>
              <h2>Suggested actions</h2>
            </div>
            <span className="panel-meta">{rebalanceSuggestions.length} action{rebalanceSuggestions.length === 1 ? "" : "s"}</span>
          </div>
          <p className="muted-note">{cashMessage}</p>
          {rebalanceSuggestions.length === 0 ? (
            <p className="muted-note">No major drift detected from current targets.</p>
          ) : (
            <div className="action-groups">
              {buySuggestions.length > 0 && (
                <div className="action-group">
                  <div className="action-group-header">
                    <span className="action-group-label buy">BUY</span>
                    <span className="action-group-total">
                      {formatCurrency(buySuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0))}
                    </span>
                  </div>
                  {buySuggestions.map((item) => (
                    <ActionRow key={item.id} item={item} kind="buy" total={portfolio.totalValue} />
                  ))}
                </div>
              )}
              {sellSuggestions.length > 0 && (
                <div className="action-group">
                  <div className="action-group-header">
                    <span className="action-group-label sell">SELL</span>
                    <span className="action-group-total">
                      {formatCurrency(sellSuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0))}
                    </span>
                  </div>
                  {sellSuggestions.map((item) => (
                    <ActionRow key={item.id} item={item} kind="sell" total={portfolio.totalValue} />
                  ))}
                </div>
              )}
            </div>
          )}
        </article>
      </section>
      )}

      {page === "income" && (
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
                onChange={(value) =>
                  setCashDraft({ available: Number(value) })
                }
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
              <p className="muted-note">Click Refresh prices to fetch dividend data.</p>
            ) : (
              upcomingDividends.map((holding) => (
                <div key={holding.id} className="suggestion-row">
                  <strong>{holding.ticker}</strong>
                  <span>DPS: {formatCurrency(holding.dividendPerShare)}</span>
                  <small>
                    Annual income {formatCurrency(holding.shares * holding.dividendPerShare)}
                    {holding.payoutDate ? ` · Book closure ${holding.payoutDate}` : ""}
                  </small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
      )}

      {page === "overview" && (
      <section className="insight-grid dual">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Waterfall</p>
              <h2>P/L contribution</h2>
            </div>
            <span className="panel-meta">Biggest impact positions</span>
          </div>
          <div className="waterfall-list">
            {waterfallRows.map((holding) => (
              <div key={holding.id} className="waterfall-row">
                <strong>{holding.ticker}</strong>
                <div className="waterfall-track">
                  <span
                    className={`waterfall-bar ${holding.gainLoss >= 0 ? "positive" : "negative"}`}
                    style={{ width: `${(Math.abs(holding.gainLoss) / maxWaterfall) * 100}%` }}
                  />
                </div>
                <span>{formatCurrency(holding.gainLoss)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Top movers</p>
              <h2>Daily change watch</h2>
            </div>
            <span className="panel-meta">Live from PSX</span>
          </div>
          <div className="suggestion-list">
            {topMovers.length === 0 ? (
              <p className="muted-note">No mover data yet.</p>
            ) : (
              topMovers.map((holding) => (
                <div key={holding.id} className="suggestion-row">
                  <strong>{holding.ticker}</strong>
                  <span className={holding.dayChangePct >= 0 ? "positive" : "negative"}>
                    {holding.dayChangePct.toFixed(2)}%
                  </span>
                  <small>{holding.name}</small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
      )}

      {page === "holdings" && (
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Holdings</p>
            <h2>Portfolio breakdown</h2>
          </div>
          <span className="panel-meta">Client-side calculations</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th>Sector</th>
                <th className="right">Shares</th>
                <th className="right">Avg price</th>
                <th className="right">Current price</th>
                <th className="right">Day %</th>
                <th className="right">Div yield</th>
                <th className="right">Market value</th>
                <th className="right">Weight</th>
                <th className="right">P&amp;L today</th>
                <th className="right">P&amp;L total</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.length === 0 ? (
                <tr>
                  <td colSpan={14} className="empty-state">
                    Import a CSV or load sample data to populate the dashboard.
                  </td>
                </tr>
              ) : (
                portfolio.holdings.map((holding) => {
                  const syntheticCash = holding.id.startsWith("cash-");
                  return (
                    <tr key={holding.id}>
                      <td>{holding.ticker}</td>
                      <td>{holding.name}</td>
                      <td>{holding.sector}</td>
                      <td className="right">{holding.shares.toLocaleString()}</td>
                      <td className="right">{formatCurrency(holding.costBasis)}</td>
                      <td className="right">
                        {formatCurrency(holding.price)}
                      </td>
                      <td className={`right ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash ? "-" : `${holding.dayChangePct.toFixed(2)}%`}
                      </td>
                      <td className="right">
                        {syntheticCash || holding.costBasis <= 0 || holding.dividendPerShare <= 0
                          ? "-"
                          : `${((holding.dividendPerShare / holding.costBasis) * 100).toFixed(2)}%`}
                      </td>
                      <td className="right">{formatCurrency(holding.marketValue)}</td>
                      <td className="right">{formatPercent(holding.weight)}</td>
                      <td className={`right ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash ? "-" : (
                          <>
                            {formatCurrency(holding.marketValue * holding.dayChangePct / (100 + holding.dayChangePct))}
                            <br />
                            <small>{holding.dayChangePct >= 0 ? "+" : ""}{holding.dayChangePct.toFixed(2)}%</small>
                          </>
                        )}
                      </td>
                      <td
                        className={`right ${holding.gainLoss >= 0 ? "positive" : "negative"}`}
                      >
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
      )}

      {page === "invest" && (
      <>
        <section className="invest-summary">
          <div className="invest-stat">
            <span className="invest-stat-num">{formatCurrency(investmentSummary.totalInvested)}</span>
            <span className="invest-stat-label">Total invested</span>
          </div>
          <div className="invest-stat">
            <span className="invest-stat-num">{formatCurrency(investmentSummary.latestValue)}</span>
            <span className="invest-stat-label">Latest value</span>
          </div>
          <div className="invest-stat">
            <span className={`invest-stat-num ${investmentSummary.pnlValue >= 0 ? "positive" : "negative"}`}>
              {investmentSummary.pnlValue >= 0 ? "+" : ""}{formatCurrency(investmentSummary.pnlValue)}
            </span>
            <span className="invest-stat-label">P&amp;L</span>
          </div>
          <div className="invest-stat">
            <span className={`invest-stat-num ${investmentSummary.pnlPct >= 0 ? "positive" : "negative"}`}>
              {investmentSummary.pnlPct >= 0 ? "+" : ""}{investmentSummary.pnlPct.toFixed(2)}%
            </span>
            <span className="invest-stat-label">Return</span>
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
                step="0.01"
                placeholder="0"
                value={investDraft.amount === 0 ? "" : investDraft.amount}
                onChange={(e) => setInvestDraft((c) => ({ ...c, amount: Number(e.target.value) }))}
              />
            </label>
            <label className="field">
              <span>Value EOM</span>
              <input
                type="number"
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
                      <td>{row.date}</td>
                      <td>{row.label}</td>
                      <td className={`right ${row.amount >= 0 ? "" : "negative"}`}>
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="right">{formatCurrency(row.total)}</td>
                      <td className="right">{formatCurrency(row.valueEom)}</td>
                      <td className={`right ${row.pnlValue >= 0 ? "positive" : "negative"}`}>
                        {row.pnlValue >= 0 ? "+" : ""}{formatCurrency(row.pnlValue)}
                      </td>
                      <td className={`right ${row.pnlPct >= 0 ? "positive" : "negative"}`}>
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
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function loadHoldings(): Holding[] {
  if (typeof window === "undefined") {
    return sampleHoldings.map(normalizeHolding);
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return sampleHoldings.map(normalizeHolding);
  }

  try {
    const parsed = JSON.parse(raw) as Holding[];
    return Array.isArray(parsed)
      ? parsed.map(normalizeHolding)
      : sampleHoldings.map(normalizeHolding);
  } catch {
    return sampleHoldings.map(normalizeHolding);
  }
}

function loadCashBuckets(): CashBuckets {
  if (typeof window === "undefined") {
    return emptyCashBuckets;
  }

  const raw = window.localStorage.getItem(cashStorageKey);
  if (!raw) {
    return emptyCashBuckets;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CashBuckets>;
    return {
      available: Number(parsed.available ?? 0),
    };
  } catch {
    return emptyCashBuckets;
  }
}

function loadTargets(): TargetAllocation[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(targetStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TargetAllocation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInvestments(): InvestmentEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(investStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as InvestmentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeHolding(holding: Holding): Holding {
  return {
    ...holding,
    dayChangePct: Number(holding.dayChangePct ?? 0),
    dividendPerShare: Number(holding.dividendPerShare ?? 0),
    payoutDate: holding.payoutDate ?? "",
  };
}

function buildHoldingsWithCash(
  holdings: Holding[],
  cash: CashBuckets,
): Holding[] {
  const nonCash = holdings.filter((holding) => !holding.id.startsWith("cash-"));

  if (cash.available <= 0) return nonCash;

  const cashPosition: Holding = {
    id: "cash-available",
    ticker: "CASH",
    name: "Available Cash",
    sector: "Cash",
    account: "PSX",
    shares: 1,
    price: cash.available,
    costBasis: cash.available,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
  };

  return [cashPosition, ...nonCash];
}

function buildSectorBuckets(
  holdings: { sector: string; marketValue: number; weight: number }[],
): SectorBucket[] {
  const map = new Map<string, SectorBucket>();

  for (const holding of holdings) {
    const current = map.get(holding.sector) ?? {
      sector: holding.sector,
      value: 0,
      weight: 0,
      holdings: 0,
    };
    current.value += holding.marketValue;
    current.weight += holding.weight;
    current.holdings += 1;
    map.set(holding.sector, current);
  }

  return [...map.values()].sort((left, right) => right.value - left.value);
}

function getCashDeploymentIdea(cashWeight: number): string {
  if (cashWeight >= 0.25) {
    return "Cash is above 25%. Consider deploying into underweight targets gradually.";
  }

  if (cashWeight >= 0.1) {
    return "Cash is healthy. Keep watchlist entries ready for pullbacks.";
  }

  return "Cash is tight. Prioritize trims from overweight targets before new buys.";
}

function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function PieChart({
  holdings,
}: {
  holdings: { ticker: string; marketValue: number; weight: number }[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const pad = 12;
  const size = 280;
  const stroke = 32;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );
  let dashOffset = 0;

  if (totalValue === 0) {
    return <div className="chart-empty">No holdings yet</div>;
  }

  const hoveredHolding = hovered !== null ? holdings[hovered] : null;

  return (
    <div className="pie-layout">
      <div className="donut-container">
        <svg
          viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
          className="pie-chart"
          role="img"
          aria-label="Portfolio allocation chart"
          onMouseLeave={() => setHovered(null)}
        >
          <circle cx={size / 2} cy={size / 2} r={radius} className="pie-base" />
          {holdings.map((holding, index) => {
            const dashLength = holding.weight * circumference;
            const currentOffset = dashOffset;
            dashOffset += dashLength;
            const isHovered = hovered === index;
            const isDimmed = hovered !== null && !isHovered;
            return (
              <circle
                key={holding.ticker}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className={`pie-slice ${isHovered ? "pie-slice--active" : ""} ${isDimmed ? "pie-slice--dim" : ""}`}
                style={
                  {
                    strokeDasharray: `${dashLength} ${circumference - dashLength}`,
                    strokeDashoffset: -currentOffset,
                    ["--slice-color" as never]: getSliceColor(index),
                  } as React.CSSProperties
                }
                onMouseEnter={() => setHovered(index)}
              />
            );
          })}
        </svg>
        {hoveredHolding ? (
          <div className="donut-center">
            <strong>{hoveredHolding.ticker}</strong>
            <span>{formatCurrency(hoveredHolding.marketValue)}</span>
            <small>{formatPercent(hoveredHolding.weight)}</small>
          </div>
        ) : (
          <div className="donut-center">
            <strong>Total</strong>
            <span>{formatCurrency(totalValue)}</span>
            <small>{holdings.length} positions</small>
          </div>
        )}
      </div>

      <div className="pie-legend">
        {holdings.slice(0, 8).map((holding, index) => (
          <div
            key={holding.ticker}
            className={`legend-row ${hovered === index ? "legend-row--active" : ""} ${hovered !== null && hovered !== index ? "legend-row--dim" : ""}`}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="legend-swatch"
              style={{ background: getSliceColor(index) }}
            />
            <div>
              <strong>{holding.ticker}</strong>
              <span>{formatPercent(holding.weight)} of portfolio</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSliceColor(index: number): string {
  const palette = [
    "#4cc9f0",
    "#5eead4",
    "#f97316",
    "#facc15",
    "#a78bfa",
    "#f472b6",
    "#38bdf8",
    "#34d399",
  ];
  return palette[index % palette.length];
}

function Combobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = options.filter((o) =>
    !value ? true : o.toLowerCase().includes(value.toLowerCase()),
  );

  return (
    <div className="combobox" ref={ref}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="combobox-list">
          {filtered.slice(0, 50).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`combobox-option ${opt === value ? "combobox-option--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({
  item,
  kind,
  total,
}: {
  item: {
    id: string;
    key: string;
    mode: "sector" | "ticker";
    gapValue: number;
    drift: number;
    targetWeight: number;
    currentWeight: number;
    price: number;
    shares: number;
  };
  kind: "buy" | "sell";
  total: number;
}) {
  const impact = total > 0 ? (Math.abs(item.gapValue) / total) * 100 : 0;
  return (
    <div className={`action-row action-row--${kind}`}>
      <div className="action-row-main">
        <strong>{item.key}</strong>
        <span className="action-row-mode">{item.mode}</span>
        <span className="action-row-amount">{formatCurrency(Math.abs(item.gapValue))}</span>
      </div>
      <div className="action-row-detail">
        <span>
          {formatPercent(item.currentWeight)} → {formatPercent(item.targetWeight)}
        </span>
        {item.mode === "ticker" && item.shares > 0 && (
          <span>~{item.shares.toFixed(0)} sh @ {formatCurrency(item.price)}</span>
        )}
        <span className="action-row-impact">{impact.toFixed(1)}% of book</span>
      </div>
    </div>
  );
}

function InvestmentChart({
  rows,
}: {
  rows: { id: string; date: string; total: number; valueEom: number }[];
}) {
  if (rows.length < 2) {
    return (
      <div className="chart-empty">
        Add at least 2 entries to see chart.
      </div>
    );
  }

  const W = 800;
  const H = 320;
  const padL = 70;
  const padR = 20;
  const padT = 20;
  const padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxY = Math.max(...rows.map((r) => Math.max(r.total, r.valueEom))) * 1.1 || 1;
  const minY = 0;

  const x = (i: number) =>
    padL + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - minY) / (maxY - minY)) * innerH;

  // Step area path for Total
  let stepPath = `M ${x(0)} ${y(rows[0].total)}`;
  for (let i = 1; i < rows.length; i++) {
    stepPath += ` H ${x(i)} V ${y(rows[i].total)}`;
  }
  const stepArea = `${stepPath} L ${x(rows.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  // Smooth Catmull-Rom path through Value EOM points
  const points = rows.map((r, i) => ({ x: x(i), y: y(r.valueEom) }));
  let smooth = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    smooth += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  // Y gridlines: 5 evenly spaced
  const gridSteps = 5;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = (maxY * i) / gridSteps;
    return { v, y: y(v) };
  });

  // X labels: show first, last, and ~3 middle ticks
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));

  return (
    <div className="invest-chart">
      <div className="invest-chart-legend">
        <span className="invest-chart-legend-item">
          <span className="invest-chart-swatch invest-chart-swatch--total" />
          Total
        </span>
        <span className="invest-chart-legend-item">
          <span className="invest-chart-swatch invest-chart-swatch--value" />
          Value EOM
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="invest-chart-svg" preserveAspectRatio="none">
        {grid.map((g, i) => (
          <g key={i}>
            <line
              className="invest-chart-grid"
              x1={padL}
              x2={W - padR}
              y1={g.y}
              y2={g.y}
            />
            <text
              className="invest-chart-axis"
              x={padL - 8}
              y={g.y + 4}
              textAnchor="end"
            >
              Rs {Math.round(g.v).toLocaleString()}
            </text>
          </g>
        ))}

        <path className="invest-chart-step-fill" d={stepArea} />
        <path className="invest-chart-step" d={stepPath} />
        <path className="invest-chart-line" d={smooth} />

        {points.map((p, i) => (
          <circle
            key={i}
            className="invest-chart-dot"
            cx={p.x}
            cy={p.y}
            r={4}
          >
            <title>
              {rows[i].date} · Total {rows[i].total.toLocaleString()} · Value {rows[i].valueEom.toLocaleString()}
            </title>
          </circle>
        ))}

        {rows.map((r, i) => {
          if (i % labelEvery !== 0 && i !== rows.length - 1) return null;
          return (
            <text
              key={r.id}
              className="invest-chart-axis"
              x={x(i)}
              y={H - padB + 18}
              textAnchor="middle"
            >
              {r.date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Treemap({
  items,
}: {
  items: { key: string; label: string; value: number; weight: number }[];
}) {
  if (items.length === 0) {
    return <div className="chart-empty">No data</div>;
  }

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);

  // Squarified layout: split into rows, aiming for aspect ratios close to 1
  const rows: typeof items[] = [];
  let remaining = [...items];
  let remainingWeight = totalWeight;

  while (remaining.length > 0) {
    let best = 1;
    let bestRatio = Infinity;

    for (let count = 1; count <= remaining.length; count++) {
      const slice = remaining.slice(0, count);
      const sliceWeight = slice.reduce((s, i) => s + i.weight, 0);
      const rowFraction = sliceWeight / totalWeight;
      const worstRatio = Math.max(
        ...slice.map((i) => {
          const w = i.weight / sliceWeight;
          const aspect = rowFraction > 0 ? (w / rowFraction) : 1;
          return Math.max(aspect, 1 / (aspect || 1));
        }),
      );
      if (worstRatio <= bestRatio) {
        bestRatio = worstRatio;
        best = count;
      } else {
        break;
      }
    }

    rows.push(remaining.slice(0, best));
    const usedWeight = remaining.slice(0, best).reduce((s, i) => s + i.weight, 0);
    remainingWeight -= usedWeight;
    remaining = remaining.slice(best);
  }

  let colorIdx = 0;

  return (
    <div className="treemap-container">
      <div className="treemap-grid">
        {rows.map((row, ri) => {
          const rowWeight = row.reduce((s, r) => s + r.weight, 0);
          const rowHeightPct = (rowWeight / totalWeight) * 100;
          return (
            <div
              key={ri}
              className="treemap-row"
              style={{ height: `${rowHeightPct}%` }}
            >
              {row.map((item) => {
                const ci = colorIdx++;
                const widthPct = (item.weight / rowWeight) * 100;
                return (
                  <div
                    key={item.key}
                    className="treemap-block"
                    style={
                      {
                        "--tree-color": getSliceColor(ci),
                        width: `${widthPct}%`,
                      } as React.CSSProperties
                    }
                    title={`${item.label}: ${formatCurrency(item.value)} (${formatPercent(item.weight)})`}
                  >
                    <strong>{item.label}</strong>
                    <span>{formatPercent(item.weight)}</span>
                    <small>{formatCurrency(item.value)}</small>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PsxStock = { ticker: string; name: string; sector: string };

function StockSearch({
  onSelect,
  selected,
  onClear,
}: {
  onSelect: (stock: PsxStock) => void;
  selected: string;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState<PsxStock[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    fetch("/api/psx/stocks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStocks(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const q = query.toUpperCase();
  const filtered = query.length > 0
    ? stocks
        .filter(
          (s) =>
            s.ticker.includes(q) ||
            s.name.toUpperCase().includes(q),
        )
        .slice(0, 8)
    : [];

  if (selected) {
    return (
      <label className="field stock-search-field">
        <span>Stock</span>
        <div className="stock-selected">
          <span>{selected}</span>
          <button type="button" className="stock-clear" onClick={onClear}>
            &times;
          </button>
        </div>
      </label>
    );
  }

  return (
    <label className="field stock-search-field" ref={wrapRef}>
      <span>Search stock</span>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.length > 0 && setOpen(true)}
        placeholder="Type ticker or company name..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="stock-dropdown">
          {filtered.map((s) => (
            <button
              key={s.ticker}
              type="button"
              className="stock-option"
              onClick={() => {
                onSelect(s);
                setQuery("");
                setOpen(false);
              }}
            >
              <strong>{s.ticker}</strong>
              <span>{s.name}</span>
              <small>{s.sector}</small>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

export default App;
