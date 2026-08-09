import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CashBuckets,
  Holding,
  InvestmentEntry,
  RebalanceCadence,
  TargetAllocation,
} from "./types";
import {
  computePortfolio,
  computeTwrIndex,
  createId,
  formatCurrency,
  formatDateLong,
  formatPercent,
  type PortfolioSnapshot,
  storageKey,
  upsertDailySnapshot,
} from "./utils";
import { rupeesToPaisa, roundPaisa } from "./money";
import { useConfirm } from "./confirmDialog";
import { applyMarketData, fetchMarketData } from "./services/psx-scraper";
import type { HoldingSources, MarketQuote } from "./services/psx-scraper";
import { fetchBenchmark } from "./services/benchmark";
import { loadPortfolioFromDisk, savePortfolioToDisk } from "./services/portfolio-store";
import { ANALYTICS, DRIFT, REBALANCE, TARGET_DEFAULTS, UI_LIMITS } from "./constants";
import { computeRiskMetrics } from "./analytics";
import { ToastViewport } from "./components/Toast";
import { pushToast } from "./hooks/useToast";
import {
  cadenceState,
  driftStatusFor,
  isRebalanceSuggestion,
} from "./portfolio/rebalance";
import { ImportParseError, parseImportBundle } from "./portfolio/importExport";
import { pkDateOf, psxCloseStatus } from "./portfolio/calendar";
import {
  buildHoldingsWithCash,
  buildSectorBuckets,
  getCashDeploymentIdea,
  normalizeHolding,
} from "./portfolio/holdings";
import {
  computeSavingsStats,
  computeBenchmarkStats,
  isRangeKey,
  sliceSnapshots,
  RANGE_DESCRIPTIONS,
  type RangeKey,
} from "./analytics";
import {
  cashStorageKey,
  historyStorageKey,
  investStorageKey,
  lastFetchedStorageKey,
  loadCashBuckets,
  loadHistory,
  loadHoldings,
  loadInvestments,
  loadLastFetchedAt,
  loadTargets,
  loadTargetPresets,
  saveTargetPresets,
  loadViewMode,
  saveViewMode,
  loadMoneyHidden,
  saveMoneyHidden,
  normalizeTarget,
  targetStorageKey,
  type TargetPreset,
} from "./portfolio/storage";
import type { ViewMode } from "./overviewBands";
import { buildAllocationSlices } from "./portfolio/allocation";
import { setMoneyHidden } from "./privacy";
import { useLedger } from "./hooks/useLedger";
import { buildLedgerSummary } from "./ledger/summary";
import { useHashRoute } from "./hooks/useHashRoute";
import { PAGES, PAGE_LABELS, pageHref } from "./routes";
import type { Transaction } from "./ledger/types";
import {
  affectsLaterSales,
  describeTransactionWithDate,
} from "./ledger/describe";
import { DataMenu } from "./components/DataMenu";
import { CommandPalette } from "./components/CommandPalette";
import type { PortfolioSummaryInput } from "./portfolio/summary";
import { OverviewPage } from "./pages/OverviewPage";
import { HoldingsPage } from "./pages/HoldingsPage";
import { TargetsPage } from "./pages/TargetsPage";
import { IncomePage } from "./pages/IncomePage";
import { InvestPage } from "./pages/InvestPage";
import { LedgerPage } from "./pages/LedgerPage";
import { StocksPage } from "./pages/StocksPage";
import { TaxPage } from "./pages/TaxPage";
import { SettingsPage } from "./pages/SettingsPage";

// v2: monetary values are integer paisa (was rupee-floats in v1).
// v3: adds the per-stock transaction ledger and the broker fee/tax config.
const BACKUP_SCHEMA_VERSION = 3;

type DraftHolding = Omit<Holding, "id" | "account">;

type DraftTarget = {
  mode: "sector" | "ticker";
  key: string;
  targetWeightPct: number;
  warnPct: number;
  criticalPct: number;
  cadence: RebalanceCadence;
};

type DraftInvestment = {
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};

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

const emptyTargetDraft: DraftTarget = {
  mode: "sector",
  key: "",
  targetWeightPct: 0,
  warnPct: TARGET_DEFAULTS.WARN_THRESHOLD * 100,
  criticalPct: TARGET_DEFAULTS.CRITICAL_THRESHOLD * 100,
  cadence: TARGET_DEFAULTS.CADENCE,
};

const emptyInvestmentDraft: DraftInvestment = {
  date: "",
  label: "",
  amount: 0,
  valueEom: 0,
};

function App() {
  // `holdings` is the STORED row set: it carries scraped market data (price,
  // day change, payouts). Once the ledger has entries, share counts and cost
  // basis are derived from it instead — see `ledger.holdings`.
  const [holdings, setHoldings] = useState<Holding[]>(() => loadHoldings());
  const ledger = useLedger(holdings);
  const [draft, setDraft] = useState<DraftHolding>(emptyDraft);
  const [cashDraft, setCashDraft] = useState<CashBuckets>(() => loadCashBuckets());
  const [targets, setTargets] = useState<TargetAllocation[]>(() => loadTargets());
  const [targetDraft, setTargetDraft] = useState<DraftTarget>(emptyTargetDraft);
  const [targetPresets, setTargetPresets] = useState<TargetPreset[]>(() => loadTargetPresets());
  // How much of the Overview page to show. Deliberately NOT in the hash: the
  // range and allocation toggles describe how you are looking at one panel and
  // are meant to be shareable, whereas this is a standing preference — and
  // `setPage` clears every query param, so a hash-backed mode would reset each
  // time you left the page and came back.
  const [viewMode, setViewModeState] = useState<ViewMode>(() => loadViewMode());
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    saveViewMode(mode);
  }, []);

  // Hidden mode masks every rupee figure — see `src/privacy.ts` for why the
  // masking lives in the formatters rather than in props.
  //
  // Seeding the module store from inside the lazy initializer is deliberate: an
  // effect would run after the first paint, so a reload with the mode on would
  // flash the real numbers before hiding them, which is the one thing this
  // feature exists to prevent. Setting the same value twice under StrictMode is
  // a no-op.
  const [moneyHidden, setMoneyHiddenState] = useState(() => {
    const stored = loadMoneyHidden();
    setMoneyHidden(stored);
    return stored;
  });
  const toggleMoneyHidden = useCallback(() => {
    setMoneyHiddenState((current) => {
      const next = !current;
      setMoneyHidden(next);
      saveMoneyHidden(next);
      return next;
    });
  }, []);
  // Navigation and view state live in the location hash — see `src/routes.ts`.
  // Toggles are derived from `route.query` but keep the same prop signatures the
  // pages already expect, so nothing downstream changes shape.
  const { route, navigate, setParam } = useHashRoute();
  const page = route.page;

  // Handed to the URL-backed tables so their search, sort, filters and page live
  // in the hash. Memoized because `useTableView` keys its derivation on it.
  const tableStore = useMemo(
    () => ({ query: route.query, setParam }),
    [route.query, setParam],
  );

  const treemapMode: "sector" | "ticker" =
    route.query.tmap === "ticker" ? "ticker" : "sector";
  const setTreemapMode = useCallback(
    (mode: "sector" | "ticker") => setParam("tmap", mode === "sector" ? null : mode),
    [setParam],
  );
  const allocationView: "map" | "ranked" =
    route.query.alloc === "ranked" ? "ranked" : "map";
  const setAllocationView = useCallback(
    (view: "map" | "ranked") => setParam("alloc", view === "map" ? null : view),
    [setParam],
  );

  // Default stays "all": windowing silently moving a headline number the user has
  // memorized is worse than making them ask for a window.
  const range: RangeKey = isRangeKey(route.query.range) ? route.query.range : "all";
  const setRange = useCallback(
    (next: RangeKey) => setParam("range", next === "all" ? null : next),
    [setParam],
  );

  const [investments, setInvestments] = useState<InvestmentEntry[]>(() => loadInvestments());
  const [investDraft, setInvestDraft] = useState<DraftInvestment>(emptyInvestmentDraft);
  const [investError, setInvestError] = useState("");
  const [history, setHistory] = useState<PortfolioSnapshot[]>(() => loadHistory());
  const [fetching, setFetching] = useState(false);
  const [quoteSources, setQuoteSources] = useState<HoldingSources>({});
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(
    () => loadLastFetchedAt(),
  );

  const { confirm, dialog: confirmDialog } = useConfirm();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [cashError, setCashError] = useState("");
  const [targetError, setTargetError] = useState("");

  // Everything below renders from the ledger-derived view of the portfolio.
  // Before the first transaction is recorded these fall back to the stored
  // holdings and the hand-typed cash figure, so the app behaves exactly as it
  // did until the user opts into the ledger.
  const effectiveHoldings = ledger.holdings;
  const effectiveCash: CashBuckets = ledger.hasLedger
    ? { available: ledger.cash }
    : cashDraft;

  // Cmd/Ctrl-K opens the jump-to palette. Registered once on the document so it
  // works from anywhere, including while a chart has focus.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Palette targets. Ledger stocks come first, then any stored holding the ledger
   * has not seen — deduped, since most tickers appear in both.
   */
  const paletteTickers = useMemo(() => {
    const seen = new Map<string, { ticker: string; name: string }>();
    for (const row of ledger.stockRows) {
      seen.set(row.ticker, { ticker: row.ticker, name: row.name });
    }
    for (const holding of holdings) {
      const key = holding.ticker.toUpperCase();
      if (!seen.has(key)) seen.set(key, { ticker: key, name: holding.name });
    }
    return [...seen.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [ledger.stockRows, holdings]);

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

  useEffect(() => {
    window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (lastFetchedAt) {
      window.localStorage.setItem(lastFetchedStorageKey, lastFetchedAt);
    } else {
      window.localStorage.removeItem(lastFetchedStorageKey);
    }
  }, [lastFetchedAt]);

  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadPortfolioFromDisk();
      if (cancelled || !data) {
        hydratedRef.current = true;
        return;
      }
      if (Array.isArray(data.holdings)) setHoldings(data.holdings as Holding[]);
      if (data.cash && typeof data.cash === "object") setCashDraft(data.cash as CashBuckets);
      if (Array.isArray(data.targets)) setTargets((data.targets as TargetAllocation[]).map(normalizeTarget));
      if (Array.isArray(data.investments)) setInvestments(data.investments as InvestmentEntry[]);
      if (Array.isArray(data.transactions)) {
        ledger.replaceTransactions(data.transactions as Transaction[]);
      }
      if (data.feeConfig) ledger.replaceFeeConfig(data.feeConfig);
      if (Array.isArray(data.history)) setHistory(data.history as PortfolioSnapshot[]);
      if (typeof data.lastFetchedAt === "string") setLastFetchedAt(data.lastFetchedAt);
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    // Persist the DERIVED holdings and cash: the cron reads them straight back
    // out of the bundle to price the daily snapshot, and it has no ledger of
    // its own to replay.
    savePortfolioToDisk({
      holdings: effectiveHoldings,
      cash: effectiveCash,
      targets,
      investments,
      transactions: ledger.transactions,
      feeConfig: ledger.feeConfig,
      history,
      lastFetchedAt,
    });
  }, [
    effectiveHoldings,
    effectiveCash,
    targets,
    investments,
    ledger.transactions,
    ledger.feeConfig,
    history,
    lastFetchedAt,
  ]);

  const holdingsWithCash = useMemo(
    () => buildHoldingsWithCash(effectiveHoldings, effectiveCash),
    [effectiveHoldings, effectiveCash],
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

  const topHolding = [...nonCashPortfolio].sort((a, b) => b.weight - a.weight)[0];
  const cashWeight =
    portfolio.totalValue > 0 ? effectiveCash.available / portfolio.totalValue : 0;
  const cashMessage = getCashDeploymentIdea(cashWeight);

  const todayTs = Date.now();

  const totalInvested = nonCashPortfolio.reduce((s, h) => s + h.costValue, 0);
  const equityMarketValue = nonCashPortfolio.reduce((s, h) => s + h.marketValue, 0);

  const upcomingDividends = useMemo(() => {
    type Up = { ticker: string; holding: typeof nonCashPortfolio[number]; date: string; dps: number };
    const items: Up[] = [];
    for (const holding of nonCashPortfolio) {
      if (holding.payouts && holding.payouts.length > 0) {
        for (const p of holding.payouts) {
          if (!p.bookClosureDate) continue;
          const ts = new Date(p.bookClosureDate).getTime();
          if (!Number.isFinite(ts) || ts < todayTs) continue;
          items.push({
            ticker: holding.ticker,
            holding,
            date: p.bookClosureDate,
            dps: p.dividendPerShare,
          });
        }
      } else if (holding.payoutDate) {
        const ts = new Date(holding.payoutDate).getTime();
        if (Number.isFinite(ts) && ts >= todayTs) {
          items.push({
            ticker: holding.ticker,
            holding,
            date: holding.payoutDate,
            dps: holding.dividendPerShare,
          });
        }
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, UI_LIMITS.UPCOMING_DIVIDENDS);
  }, [nonCashPortfolio, todayTs]);

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

  const nowDate = new Date();
  const targetRows = targets.map((target) => {
    const lookup = target.mode === "sector" ? sectorWeightMap : tickerWeightMap;
    const currentWeight = lookup.get(target.key.toLowerCase()) ?? 0;
    const drift = currentWeight - target.targetWeight;
    const gapValue = roundPaisa((target.targetWeight - currentWeight) * portfolio.totalValue);
    const absDrift = Math.abs(drift);
    const warn = target.warnThreshold ?? TARGET_DEFAULTS.WARN_THRESHOLD;
    const critical = target.criticalThreshold ?? TARGET_DEFAULTS.CRITICAL_THRESHOLD;
    const cadence = target.cadence ?? TARGET_DEFAULTS.CADENCE;
    const status = driftStatusFor(absDrift, warn, critical);
    const price = target.mode === "ticker" ? tickerPriceMap.get(target.key.toLowerCase()) ?? 0 : 0;
    const shares = price > 0 ? Math.abs(gapValue) / price : 0;
    const cad = cadenceState(target.lastRebalancedAt ?? null, cadence, nowDate);

    return {
      ...target,
      warnThreshold: warn,
      criticalThreshold: critical,
      cadence,
      currentWeight,
      drift,
      gapValue,
      absDrift,
      status,
      price,
      shares,
      cadenceState: cad.state,
      daysUntilDue: cad.daysUntilDue,
    };
  });

  const driftSummary = useMemo(() => {
    const over = targetRows.filter((r) => r.drift > DRIFT.COUNT_THRESHOLD).length;
    const under = targetRows.filter((r) => r.drift < -DRIFT.COUNT_THRESHOLD).length;
    const onTrack = targetRows.length - over - under;
    const due = targetRows.filter(
      (r) => r.cadenceState === "due" || r.cadenceState === "overdue",
    ).length;
    const totalDeviation = targetRows.reduce((s, r) => s + r.absDrift, 0);
    return { over, under, onTrack, due, totalDeviation };
  }, [targetRows]);

  const rebalanceSuggestions = targetRows
    .filter((row) => {
      const cadenceOverride = row.cadenceState === "due" || row.cadenceState === "overdue";
      return isRebalanceSuggestion(row.gapValue, portfolio.totalValue, cadenceOverride);
    })
    .sort((left, right) => Math.abs(right.gapValue) - Math.abs(left.gapValue))
    .slice(0, REBALANCE.MAX_SUGGESTIONS);

  const buySuggestions = rebalanceSuggestions.filter((r) => r.gapValue > 0);
  const sellSuggestions = rebalanceSuggestions.filter((r) => r.gapValue < 0);

  const coverage = useMemo(() => {
    const calc = (mode: "sector" | "ticker") => {
      const rows = targets.filter((t) => t.mode === mode);
      const sum = rows.reduce((s, t) => s + t.targetWeight, 0);
      return { sum, untargeted: Math.max(0, 1 - sum), count: rows.length };
    };
    return { sector: calc("sector"), ticker: calc("ticker") };
  }, [targets]);

  const turnover = (() => {
    const buyTotal = buySuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0);
    const sellTotal = sellSuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0);
    const gross = buyTotal + sellTotal;
    return {
      buyTotal,
      sellTotal,
      net: buyTotal - sellTotal,
      gross,
      turnoverPct: portfolio.totalValue > 0 ? gross / portfolio.totalValue : 0,
    };
  })();

  const sectorByTicker = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of portfolio.holdings) {
      if (h.id.startsWith("cash-")) continue;
      map.set(h.ticker.toUpperCase(), h.sector);
    }
    return map;
  }, [portfolio.holdings]);

  useEffect(() => {
    const snapsWithShares = history.filter((s) => s.shares && Object.keys(s.shares).length > 0);
    if (snapsWithShares.length < 2) return;
    const sorted = [...snapsWithShares].sort((a, b) => a.date.localeCompare(b.date));
    const newest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (!newest.shares || !prev.shares) return;

    const changedTickers = new Set<string>();
    const allKeys = new Set([
      ...Object.keys(newest.shares),
      ...Object.keys(prev.shares),
    ]);
    for (const ticker of allKeys) {
      const a = prev.shares[ticker] ?? 0;
      const b = newest.shares[ticker] ?? 0;
      if (a === 0 && b === 0) continue;
      const denom = Math.max(Math.abs(a), Math.abs(b), 1);
      const delta = Math.abs(b - a) / denom;
      if (delta >= 0.01) changedTickers.add(ticker);
    }
    if (changedTickers.size === 0) return;

    const changedSectors = new Set<string>();
    for (const ticker of changedTickers) {
      const sector = sectorByTicker.get(ticker);
      if (sector) changedSectors.add(sector.toLowerCase());
    }

    const newestDate = newest.date;
    let dirty = false;
    const next = targets.map((t) => {
      const last = t.lastRebalancedAt;
      if (last && last >= newestDate) return t;
      if (t.mode === "ticker") {
        if (changedTickers.has(t.key.toUpperCase())) {
          dirty = true;
          return { ...t, lastRebalancedAt: newestDate };
        }
      } else {
        if (changedSectors.has(t.key.toLowerCase())) {
          dirty = true;
          return { ...t, lastRebalancedAt: newestDate };
        }
      }
      return t;
    });
    if (dirty) setTargets(next);
  }, [history, targets, sectorByTicker]);

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

    return {
      totalInvested,
      latestValue,
      pnlValue,
      pnlPct,
      count: investmentRows.length,
    };
  }, [investmentRows]);

  // Back out yesterday's close from today's value to get the rupee move:
  // marketValue already includes the day's change, so divide by (100 + pct).
  // Hoisted out of `summaryInput` so the dashboard can show it — it used to be
  // computed only for the copy-summary markdown.
  const dayPnL = useMemo(
    () =>
      roundPaisa(
        nonCashPortfolio.reduce((s, h) => {
          const denom = 100 + h.dayChangePct;
          return denom === 0 ? s : s + (h.marketValue * h.dayChangePct) / denom;
        }, 0),
      ),
    [nonCashPortfolio],
  );

  // The Invest tab is the record of money actually moved in and out of the
  // brokerage — the ledger cannot know it, because broker statements list
  // trades and not funding, so its own deposits are only ever a plug. Fall back
  // to the ledger figure when nothing has been logged there.
  const contributions = useMemo(() => {
    const logged = investments.reduce((sum, entry) => sum + entry.amount, 0);
    return investments.length > 0 ? logged : ledger.state.contributions;
  }, [investments, ledger.state.contributions]);

  const ledgerSummary = useMemo(
    () => buildLedgerSummary(
        ledger.stockRows,
        contributions,
        ledger.state.expenses,
        ledger.state.taxPaid,
      ),
    [ledger.stockRows, contributions, ledger.state.expenses, ledger.state.taxPaid],
  );

  /**
   * Combined weight of the three largest positions — concentration at a glance.
   *
   * Measured against invested value, not the whole account, because this line
   * is printed directly under the treemap whose tiles now sum to 100% of
   * positions. Holding cash is not diversification, so counting it here would
   * also flatter the number.
   */
  const positionWeights = useMemo(
    () => buildAllocationSlices(nonCashPortfolio, "ticker", "market"),
    [nonCashPortfolio],
  );
  const top3Weight = useMemo(
    () => positionWeights.slice(0, 3).reduce((sum, slice) => sum + slice.marketWeight, 0),
    [positionWeights],
  );
  /** The largest position's share of invested value — same denominator as above. */
  const topHoldingWeight = positionWeights[0]?.marketWeight ?? 0;



  // Same source as the allocation donut, so the two panels in the Allocation
  // band cannot disagree about a sector's share. `sectors` is deliberately NOT
  // used here: it carries the cash pseudo-holding and weights measured against
  // the whole account, and it feeds `sectorWeightMap` — changing it would move
  // every sector target's drift on the Targets page.
  //
  // Keys are tickers rather than holding ids in ticker mode: an id is
  // `ledger-LUCK`, and the tile's link runs it through `stockHref`, which was
  // producing `#/stocks/ledger-LUCK`.
  const treemapItems = useMemo(() => {
    const slices = buildAllocationSlices(nonCashPortfolio, treemapMode, "market");
    const capped = treemapMode === "ticker" ? slices.slice(0, UI_LIMITS.TREEMAP_TOP_N) : slices;
    return capped.map((slice) => ({
      key: slice.key,
      label: slice.label,
      value: slice.marketValue,
      weight: slice.marketWeight,
    }));
  }, [treemapMode, nonCashPortfolio]);

  const savingsStats = useMemo(
    () => computeSavingsStats(investmentRows, portfolio.totalValue),
    [investmentRows, portfolio.totalValue],
  );

  const contributionSeries = useMemo(() => {
    const rows = [...investmentRows].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    return rows.map((row) => {
      cumulative += row.amount;
      return { time: row.date, value: cumulative };
    });
  }, [investmentRows]);

  // Everything derived from snapshots reads `windowedHistory`, so the range chips
  // rescope drawdown, volatility, Sharpe, alpha, beta and the history chart in one
  // move. The TWR index rebases to 100 at the start of the slice — that is the
  // correct meaning of "return over this window", not a bug.
  //
  // Ledger figures (realized, dividends, fees, taxes) stay lifetime: StockLedgerRow
  // carries no dates to filter on, so they are labelled lifetime in the UI instead
  // of being silently windowed.
  const windowedHistory = useMemo(
    () => sliceSnapshots(history, range),
    [history, range],
  );

  const benchmarkStats = useMemo(
    () => computeBenchmarkStats(windowedHistory),
    [windowedHistory],
  );

  const heatmapItems = useMemo(
    () =>
      nonCashPortfolio.map((h) => ({
        ticker: h.ticker,
        group: h.sector || "Uncategorized",
        value: h.marketValue,
        weight: h.weight,
        dayChangePct: h.dayChangePct,
      })),
    [nonCashPortfolio],
  );

  const waterfallRows = [...nonCashPortfolio]
    .sort((left, right) => Math.abs(right.gainLoss) - Math.abs(left.gainLoss))
    .slice(0, UI_LIMITS.WATERFALL_TOP_N);

  const maxWaterfall =
    waterfallRows.length > 0
      ? Math.max(...waterfallRows.map((holding) => Math.abs(holding.gainLoss)))
      : 1;

  const topMovers = [...nonCashPortfolio]
    .sort((left, right) => right.dayChangePct - left.dayChangePct)
    .slice(0, UI_LIMITS.TOP_MOVERS);

  const riskMetrics = useMemo(
    () =>
      computeRiskMetrics(
        windowedHistory,
        ANALYTICS.RISK_FREE_ANNUAL,
        ANALYTICS.TRADING_DAYS,
      ),
    [windowedHistory],
  );
  const valueSeries = useMemo(
    () => windowedHistory.map((s) => s.totalValue),
    [windowedHistory],
  );
  const pnlSeries = useMemo(
    () => windowedHistory.map((s) => s.gainLoss),
    [windowedHistory],
  );

  const summaryInput: PortfolioSummaryInput = useMemo(() => {
    const twrIdx = computeTwrIndex(history);
    const twrLatest = twrIdx.length >= 2 ? twrIdx[twrIdx.length - 1] : null;

    return {
      generatedAt: new Date().toISOString(),
      lastFetchedAt,
      totals: {
        totalValue: portfolio.totalValue,
        equityMarketValue,
        totalCost: totalInvested,
        unrealizedPnL: portfolio.totalGainLoss,
        dayPnL,
      },
      cash: { available: effectiveCash.available, weight: cashWeight },
      holdings: nonCashPortfolio,
      sectors,
      targets: targetRows.map((r) => ({
        mode: r.mode,
        key: r.key,
        currentWeight: r.currentWeight,
        targetWeight: r.targetWeight,
        drift: r.drift,
        absDrift: r.absDrift,
        gapValue: r.gapValue,
        status: r.status,
      })),
      upcomingDividends: upcomingDividends.map((u) => ({
        ticker: u.ticker,
        date: u.date,
        dps: u.dps,
        expectedIncome: u.holding.shares * u.dps,
      })),
      investments: investmentSummary,
      investmentLedger: investments,
      history,
      twrLatest,
      stocks: ledger.stockRows,
      taxYears: ledger.taxYears,
      transactions: ledger.transactions,
      realized: ledger.state.realized,
      dividends: ledger.state.dividends,
      bonusTaxes: ledger.state.bonusTaxes,
      feeConfig: ledger.feeConfig,
      // The Overview dashboard's own numbers, so a pasted summary says what the
      // page says rather than a thinner version of it.
      ledgerSummary,
      risk: riskMetrics,
      benchmark: benchmarkStats,
      savings: savingsStats,
      rangeLabel: RANGE_DESCRIPTIONS[range],
      riskWindowSnapshots: windowedHistory.length,
      top3Weight,
      cashDetail: {
        cgtReserve: ledger.cgtReserve,
        withheld: ledger.feeConfig.withheldCash,
        deployable:
          effectiveCash.available - ledger.feeConfig.withheldCash - ledger.cgtReserve,
      },
    };
  }, [
    nonCashPortfolio,
    portfolio,
    equityMarketValue,
    totalInvested,
    effectiveCash.available,
    cashWeight,
    sectors,
    targetRows,
    upcomingDividends,
    investmentSummary,
    investments,
    history,
    lastFetchedAt,
    ledger.stockRows,
    ledger.taxYears,
    ledger.transactions,
    ledger.state,
    ledger.feeConfig,
    ledger.cgtReserve,
    ledgerSummary,
    riskMetrics,
    benchmarkStats,
    savingsStats,
    range,
    windowedHistory,
    top3Weight,
  ]);

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
      // Draft holds rupees from the form → store as integer paisa.
      price: rupeesToPaisa(draft.price),
      costBasis: rupeesToPaisa(draft.costBasis),
      dayChangePct: draft.dayChangePct,
      dividendPerShare: rupeesToPaisa(draft.dividendPerShare),
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

    if (targetDraft.warnPct <= 0 || targetDraft.criticalPct <= 0) {
      setTargetError("Warn and critical thresholds must be positive.");
      return;
    }

    if (targetDraft.criticalPct <= targetDraft.warnPct) {
      setTargetError("Critical threshold must be greater than warn threshold.");
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
        warnThreshold: targetDraft.warnPct / 100,
        criticalThreshold: targetDraft.criticalPct / 100,
        cadence: targetDraft.cadence,
        lastRebalancedAt: null,
      },
      ...current,
    ]);

    setTargetDraft(emptyTargetDraft);
    setTargetError("");
  }

  async function removeTarget(id: string) {
    const target = targets.find((t) => t.id === id);
    if (!target) return;
    const ok = await confirm({
      title: "Remove target",
      message: (
        <>
          Remove the <strong>{target.key}</strong> ({target.mode}) target of {formatPercent(target.targetWeight)}? This cannot be undone.
        </>
      ),
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setTargets((current) => current.filter((t) => t.id !== id));
  }

  function updateTargetThreshold(
    id: string,
    field: "warnThreshold" | "criticalThreshold",
    valuePct: number,
  ) {
    if (!Number.isFinite(valuePct) || valuePct <= 0) return;
    setTargets((current) =>
      current.map((t) => {
        if (t.id !== id) return t;
        const decimal = valuePct / 100;
        const warn = field === "warnThreshold" ? decimal : t.warnThreshold ?? TARGET_DEFAULTS.WARN_THRESHOLD;
        const critical = field === "criticalThreshold" ? decimal : t.criticalThreshold ?? TARGET_DEFAULTS.CRITICAL_THRESHOLD;
        if (critical <= warn) {
          pushToast("Critical threshold must be greater than warn threshold.", "error");
          return t;
        }
        return { ...t, [field]: decimal };
      }),
    );
  }

  function updateTargetCadence(id: string, cadence: RebalanceCadence) {
    setTargets((current) =>
      current.map((t) => (t.id === id ? { ...t, cadence } : t)),
    );
  }

  function markTargetRebalanced(id: string) {
    const now = new Date().toISOString();
    setTargets((current) =>
      current.map((t) => (t.id === id ? { ...t, lastRebalancedAt: now } : t)),
    );
  }

  function saveTargetPreset(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast("Preset name required.", "error");
      return;
    }
    if (targets.length === 0) {
      pushToast("No targets to save.", "error");
      return;
    }
    const snapshot = targets.map((t) => ({ ...t }));
    const next = [
      ...targetPresets.filter((p) => p.name !== trimmed),
      { name: trimmed, targets: snapshot },
    ].sort((a, b) => a.name.localeCompare(b.name));
    setTargetPresets(next);
    saveTargetPresets(next);
    pushToast(`Saved preset "${trimmed}".`, "info");
  }

  function applyTargetPreset(name: string) {
    const preset = targetPresets.find((p) => p.name === name);
    if (!preset) return;
    setTargets(
      preset.targets.map((t) => ({ ...normalizeTarget(t), id: createId() })),
    );
    pushToast(`Applied preset "${name}".`, "info");
  }

  async function deleteTargetPreset(name: string) {
    const ok = await confirm({
      title: "Delete preset",
      message: (
        <>
          Delete the <strong>{name}</strong> target preset?
        </>
      ),
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const next = targetPresets.filter((p) => p.name !== name);
    setTargetPresets(next);
    saveTargetPresets(next);
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
        // Draft holds rupees → store as integer paisa.
        amount: rupeesToPaisa(amount),
        valueEom: rupeesToPaisa(valueEom),
      },
    ]);
    setInvestDraft(emptyInvestmentDraft);
    setInvestError("");
  }

  async function removeInvestment(id: string) {
    const entry = investments.find((e) => e.id === id);
    if (!entry) return;
    const ok = await confirm({
      title: "Remove investment entry",
      message: (
        <>
          Remove the entry from <strong>{entry.date}</strong>
          {entry.label ? ` (${entry.label})` : ""} for {formatCurrency(entry.amount)}? This cannot be undone.
        </>
      ),
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setInvestments((current) => current.filter((e) => e.id !== id));
  }

  async function removeLedgerEntry(id: string) {
    const txn = ledger.transactions.find((t) => t.id === id);
    if (!txn) return;

    // Removing a lot-changing entry re-runs FIFO for every sale after it, so
    // realized P&L and CGT on trades the user isn't touching can move.
    const rematches = affectsLaterSales(txn, ledger.transactions);

    const ok = await confirm({
      title: "Remove ledger entry",
      message: (
        <>
          <p>
            Remove <strong>{describeTransactionWithDate(txn)}</strong>?
          </p>
          <p>
            Holdings, cash and taxes are all derived from this ledger, so they
            will change to match.
            {rematches
              ? " Later sales of this stock will re-match against different lots, which moves their realized P/L and CGT."
              : ""}
          </p>
        </>
      ),
      confirmLabel: "Remove entry",
      tone: "danger",
    });
    if (!ok) return;
    ledger.removeTransaction(id);
  }

  // Inline edits only apply while the ledger is empty. Once trades exist, the
  // ledger owns share counts and cost basis and the Holdings table is read-only.
  function updateHoldingCostBasis(id: string, value: number) {
    if (ledger.hasLedger || !Number.isFinite(value) || value < 0) return;
    setHoldings((current) =>
      current.map((h) =>
        h.id === id ? { ...h, costBasis: rupeesToPaisa(value) } : h,
      ),
    );
  }

  function updateHoldingShares(id: string, value: number) {
    if (ledger.hasLedger || !Number.isFinite(value) || value <= 0) return;
    setHoldings((current) =>
      current.map((h) =>
        h.id === id ? { ...h, shares: Math.round(value) } : h,
      ),
    );
  }

  async function removeHolding(id: string) {
    const holding = effectiveHoldings.find((h) => h.id === id);
    if (!holding) return;
    if (ledger.hasLedger) {
      pushToast(
        "This position comes from the ledger — remove its trades on the Ledger tab.",
        "warn",
      );
      return;
    }
    const ok = await confirm({
      title: "Remove holding",
      message: (
        <>
          Remove <strong>{holding.ticker}</strong> ({holding.shares.toLocaleString()} shares,
          market value {formatCurrency(holding.shares * holding.price)})? This cannot be undone.
        </>
      ),
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setHoldings((current) => current.filter((h) => h.id !== id));
  }


  async function refreshPrices() {
    const nonCash = effectiveHoldings.filter((h) => !h.id.startsWith("cash-"));
    if (nonCash.length === 0) {
      return;
    }

    setFetching(true);

    try {
      const stockTickers = nonCash.map((h) => h.ticker);

      let quotes: MarketQuote[] = [];
      try {
        quotes = await fetchMarketData(stockTickers);
      } catch (err) {
        pushToast(`Stock prices failed: ${String(err)}`, "error");
      }

      // Refresh against the derived rows so a ledger-only position (never in
      // the stored set) still gets a price on its first fetch.
      const { holdings: updated, sources } = applyMarketData(
        effectiveHoldings,
        quotes,
        [],
      );
      setHoldings(updated);
      setQuoteSources(sources);
      setLastFetchedAt(new Date().toISOString());

      const fellBack = Object.values(sources).filter(
        (s) => s.price === "sarmaaya" || s.dividend === "sarmaaya",
      ).length;
      if (fellBack > 0) {
        pushToast(
          `${fellBack} holding${fellBack === 1 ? "" : "s"} served via sarmaaya fallback — PSX source failed.`,
          "warn",
        );
      }

      const snapshot = computePortfolio(buildHoldingsWithCash(updated, effectiveCash));
      // Snapshot once/day after the 15:30 PKT close.
      const { afterClose } = psxCloseStatus();
      if (afterClose) {
        const bench = await fetchBenchmark().catch(() => null);
        const shares: Record<string, number> = {};
        for (const h of updated) {
          if (!h.id.startsWith("cash-")) shares[h.ticker.toUpperCase()] = h.shares;
        }
        const entry: PortfolioSnapshot = {
          date: new Date().toISOString(),
          totalValue: snapshot.totalValue,
          totalCost: snapshot.totalCost,
          gainLoss: snapshot.totalGainLoss,
          shares,
          ...(bench && { kse100: bench.current }),
        };
        setHistory((cur) => upsertDailySnapshot(cur, entry, pkDateOf));
      }
    } catch (err) {
      pushToast(
        `Price refresh failed: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    } finally {
      setFetching(false);
    }
  }

  function exportPortfolio() {
    const data = {
      schema: "psx-portfolio-tools",
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      lastFetchedAt,
      holdings: effectiveHoldings,
      cash: effectiveCash,
      targets,
      investments,
      transactions: ledger.transactions,
      feeConfig: ledger.feeConfig,
      history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `psx-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importPortfolio(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      let bundle;
      try {
        const text = String(reader.result);
        bundle = parseImportBundle(JSON.parse(text));
      } catch (err) {
        const msg = err instanceof ImportParseError
          ? err.message
          : err instanceof Error ? err.message : "Invalid file";
        await confirm({
          title: "Import failed",
          message: `Could not parse file: ${msg}`,
          confirmLabel: "Close",
          cancelLabel: "Close",
        });
        return;
      }

      const incomingHoldings = bundle.holdings;
      const incomingCash = bundle.cash;
      const incomingTargets = bundle.targets as TargetAllocation[] | null;
      const incomingInvestments = bundle.investments as InvestmentEntry[] | null;
      const incomingTransactions = bundle.transactions;
      const incomingFeeConfig = bundle.feeConfig;
      const incomingHistory = bundle.history;
      const incomingLastFetched = bundle.lastFetchedAt;
      const exportedAt = bundle.exportedAt;

      const ok = await confirm({
        title: "Restore from backup?",
        message: (
          <div className="confirm-import-summary">
            <p>
              This will <strong>replace all current data</strong>. Current
              workspace cannot be recovered unless you exported it first.
            </p>
            <ul>
              <li>
                Holdings: <strong>{incomingHoldings?.length ?? 0}</strong>
                {effectiveHoldings.length > 0 ? ` (was ${effectiveHoldings.length})` : ""}
              </li>
              <li>
                Ledger entries: <strong>{incomingTransactions?.length ?? 0}</strong>
                {ledger.transactions.length > 0 ? ` (was ${ledger.transactions.length})` : ""}
              </li>
              <li>
                Cash: <strong>{formatCurrency(incomingCash?.available ?? 0)}</strong>
                {effectiveCash.available > 0
                  ? ` (was ${formatCurrency(effectiveCash.available)})`
                  : ""}
              </li>
              <li>
                Targets: <strong>{incomingTargets?.length ?? 0}</strong>
                {targets.length > 0 ? ` (was ${targets.length})` : ""}
              </li>
              <li>
                Investments: <strong>{incomingInvestments?.length ?? 0}</strong>
                {investments.length > 0 ? ` (was ${investments.length})` : ""}
              </li>
              <li>
                History snapshots: <strong>{incomingHistory?.length ?? 0}</strong>
                {history.length > 0 ? ` (was ${history.length})` : ""}
              </li>
              {exportedAt ? (
                <li>
                  Backup created: <strong>{formatDateLong(exportedAt)}</strong>
                </li>
              ) : null}
            </ul>
          </div>
        ),
        confirmLabel: "Replace all data",
        tone: "danger",
      });
      if (!ok) return;

      if (incomingHoldings) setHoldings(incomingHoldings.map(normalizeHolding));
      if (incomingCash) setCashDraft({ available: Number(incomingCash.available ?? 0) });
      if (incomingTargets) setTargets(incomingTargets.map(normalizeTarget));
      if (incomingInvestments) setInvestments(incomingInvestments);
      // A pre-v3 backup has no ledger: clear it rather than leaving the old one
      // to contradict the holdings just restored.
      ledger.replaceTransactions(incomingTransactions ?? []);
      if (incomingFeeConfig) ledger.replaceFeeConfig(incomingFeeConfig);
      if (incomingHistory) setHistory(incomingHistory);
      if (incomingLastFetched) setLastFetchedAt(incomingLastFetched);
    };
    reader.readAsText(file);
  }

  return (
    <main className="app-shell">
      <ToastViewport />
      <section className="hero-bar">
        <div className="hero-title">
          <p className="eyebrow">PSX portfolio tools</p>
          <h1>Portfolio command center</h1>
        </div>
        <div className="hero-actions">
          {lastFetchedAt ? (
            <span className="hero-status num" title="Last price refresh">
              <span className="hero-status-dot" /> {new Date(lastFetchedAt).toLocaleString()}
            </span>
          ) : null}
          <button
            type="button"
            className={`button ${moneyHidden ? "button-active" : ""}`.trim()}
            onClick={toggleMoneyHidden}
            aria-pressed={moneyHidden}
            title={
              moneyHidden
                ? "Show rupee amounts again"
                : "Mask every rupee amount — percentages and weights stay visible"
            }
          >
            {moneyHidden ? "Show amounts" : "Hide amounts"}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={refreshPrices}
            disabled={fetching || effectiveHoldings.length === 0}
          >
            {fetching ? "Fetching..." : "Refresh prices"}
          </button>
          <DataMenu
            summaryInput={summaryInput}
            onExport={exportPortfolio}
            onImport={importPortfolio}
            copyDisabled={effectiveHoldings.length === 0}
          />
        </div>
      </section>

      {/* Real anchors, not buttons: cmd/middle-click opens a tab, the target is
          visible in the status bar, and `href="#/…"` fires `hashchange` on its
          own so no click handler is needed. */}
      <nav className="page-nav" aria-label="Sections">
        {PAGES.map((key) => (
          <a
            key={key}
            className={`page-nav-tab ${page === key ? "page-nav-tab--active" : ""}`}
            href={pageHref(key)}
            aria-current={page === key ? "page" : undefined}
          >
            {PAGE_LABELS[key]}
          </a>
        ))}
        {/* Without this the keybinding is invisible. */}
        <button
          type="button"
          className="palette-hint"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open the jump-to palette"
        >
          Jump to <kbd>⌘K</kbd>
        </button>
      </nav>

      {page === "overview" && (
        <OverviewPage
          equityMarketValue={equityMarketValue}
          costBasis={totalInvested}
          nonCashCount={nonCashPortfolio.length}
          portfolio={portfolio}
          nonCashHoldings={nonCashPortfolio}
          topHolding={topHolding}
          topHoldingWeight={topHoldingWeight}
          cashDraft={effectiveCash}
          cashWeight={cashWeight}
          investmentSummary={investmentSummary}
          savingsStats={savingsStats}
          contributionSeries={contributionSeries}
          history={windowedHistory}
          totalSnapshotCount={history.length}
          range={range}
          onRangeChange={setRange}
          lastFetchedAt={lastFetchedAt}
          fetching={fetching}
          treemapMode={treemapMode}
          setTreemapMode={setTreemapMode}
          allocationView={allocationView}
          setAllocationView={setAllocationView}
          treemapItems={treemapItems}
          waterfallRows={waterfallRows}
          maxWaterfall={maxWaterfall}
          topMovers={topMovers}
          riskMetrics={riskMetrics}
          valueSeries={valueSeries}
          pnlSeries={pnlSeries}
          benchmarkStats={benchmarkStats}
          heatmapItems={heatmapItems}
          ledgerSummary={ledgerSummary}
          hasLedger={ledger.hasLedger}
          cgtReserve={ledger.cgtReserve}
          withheldCash={ledger.feeConfig.withheldCash}
          ledgerCash={effectiveCash.available}
          dayPnL={dayPnL}
          top3Weight={top3Weight}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {page === "holdings" && (
        <HoldingsPage
          draft={draft}
          setDraft={setDraft}
          draftError={draftError}
          addManualHolding={addManualHolding}
          holdings={portfolio.holdings}
          updateHoldingShares={updateHoldingShares}
          updateHoldingCostBasis={updateHoldingCostBasis}
          removeHolding={removeHolding}
          quoteSources={quoteSources}
          ledgerActive={ledger.hasLedger}
          stockRows={ledger.stockRows}
          tableStore={tableStore}
        />
      )}

      {page === "ledger" && (
        <LedgerPage
          transactions={ledger.transactions}
          feeConfig={ledger.feeConfig}
          state={ledger.state}
          cash={ledger.cash}
          cgtReserve={ledger.cgtReserve}
          hasLedger={ledger.hasLedger}
          storedHoldings={holdings}
          storedCash={cashDraft.available}
          today={pkDateOf(new Date().toISOString())}
          addTransaction={ledger.addTransaction}
          addTransactions={ledger.addTransactions}
          removeTransaction={removeLedgerEntry}
          tableStore={tableStore}
        />
      )}

      {page === "stocks" && (
        <StocksPage
          stockRows={ledger.stockRows}
          state={ledger.state}
          transactions={ledger.transactions}
          selected={route.entity}
          onSelect={(ticker) => navigate({ page: "stocks", entity: ticker })}
          tableStore={tableStore}
        />
      )}

      {page === "tax" && (
        <TaxPage
          taxYears={ledger.taxYears}
          selectedFy={route.entity}
          tableStore={tableStore}
        />
      )}

      {page === "settings" && (
        <SettingsPage
          feeConfig={ledger.feeConfig}
          updateFeeConfig={ledger.updateFeeConfig}
          replaceFeeConfig={ledger.replaceFeeConfig}
        />
      )}

      {page === "targets" && (
        <TargetsPage
          targetDraft={targetDraft}
          setTargetDraft={setTargetDraft}
          targetError={targetError}
          addTargetAllocation={addTargetAllocation}
          sectors={sectors}
          holdings={portfolio.holdings}
          targetRows={targetRows}
          driftSummary={driftSummary}
          markTargetRebalanced={markTargetRebalanced}
          removeTarget={removeTarget}
          updateTargetThreshold={updateTargetThreshold}
          updateTargetCadence={updateTargetCadence}
          rebalanceSuggestions={rebalanceSuggestions}
          buySuggestions={buySuggestions}
          sellSuggestions={sellSuggestions}
          cashMessage={cashMessage}
          availableCash={effectiveCash.available}
          totalValue={portfolio.totalValue}
          coverage={coverage}
          turnover={turnover}
          presets={targetPresets}
          saveTargetPreset={saveTargetPreset}
          applyTargetPreset={applyTargetPreset}
          deleteTargetPreset={deleteTargetPreset}
        />
      )}

      {page === "income" && (
        <IncomePage
          cashDraft={cashDraft}
          setCashDraft={setCashDraft}
          cashError={cashError}
          saveCashBuckets={saveCashBuckets}
          ledgerActive={ledger.hasLedger}
          ledgerCash={ledger.cash}
          today={pkDateOf(new Date().toISOString())}
          addCashEntry={(type, amount, date, note) =>
            ledger.addTransaction({
              date,
              type,
              ticker: "",
              name: "",
              sector: "",
              shares: 0,
              price: 0,
              amount,
              note,
            })
          }
        />
      )}

      {page === "invest" && (
        <InvestPage
          investmentSummary={investmentSummary}
          investDraft={investDraft}
          setInvestDraft={setInvestDraft}
          addInvestment={addInvestment}
          investError={investError}
          totalValue={portfolio.totalValue}
          investmentRows={investmentRows}
          removeInvestment={removeInvestment}
          savingsStats={savingsStats}
        />
      )}
      {confirmDialog}
      {paletteOpen ? (
        <CommandPalette
          tickers={paletteTickers}
          fiscalYears={ledger.taxYears.map((year) => year.fy)}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
    </main>
  );
}

export default App;
