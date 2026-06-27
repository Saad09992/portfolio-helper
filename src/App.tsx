import { useEffect, useMemo, useRef, useState } from "react";
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
  xirr,
} from "./utils";
import { useConfirm } from "./confirmDialog";
import { applyMarketData, fetchMarketData } from "./services/psx-scraper";
import type { HoldingSources, MarketQuote } from "./services/psx-scraper";
import { fetchCryptoMarketData } from "./services/crypto";
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
  buildAssetClassBuckets,
  buildHoldingsWithCash,
  buildSectorBuckets,
  getCashDeploymentIdea,
  normalizeHolding,
} from "./portfolio/holdings";
import { computeSavingsStats } from "./analytics";
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
  normalizeTarget,
  targetStorageKey,
} from "./portfolio/storage";
import { CopySummaryButton } from "./components/CopySummaryButton";
import type { PortfolioSummaryInput } from "./portfolio/summary";
import type { HoldingsSortKey, SortDir } from "./uiTypes";
import { OverviewPage } from "./pages/OverviewPage";
import { HoldingsPage } from "./pages/HoldingsPage";
import { TargetsPage } from "./pages/TargetsPage";
import { IncomePage } from "./pages/IncomePage";
import { InvestPage } from "./pages/InvestPage";

const BACKUP_SCHEMA_VERSION = 1;

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
  assetClass: "stock",
  coinId: "",
  usdCostBasis: 0,
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
  const [holdings, setHoldings] = useState<Holding[]>(() => loadHoldings());
  const [draft, setDraft] = useState<DraftHolding>(emptyDraft);
  const [cashDraft, setCashDraft] = useState<CashBuckets>(() => loadCashBuckets());
  const [targets, setTargets] = useState<TargetAllocation[]>(() => loadTargets());
  const [targetDraft, setTargetDraft] = useState<DraftTarget>(emptyTargetDraft);
  const [targetFilter, setTargetFilter] = useState("");
  const [targetStatusFilter, setTargetStatusFilter] = useState<"all" | "over" | "under" | "ontrack" | "due">("all");
  const [targetSort, setTargetSort] = useState<"drift" | "name" | "weight">("drift");
  const [treemapMode, setTreemapMode] = useState<"sector" | "ticker" | "assetClass">("sector");
  const [holdingsClassFilter, setHoldingsClassFilter] = useState<"all" | "stock" | "crypto">("all");
  const [allocationView, setAllocationView] = useState<"map" | "ranked">("map");
  const [page, setPage] = useState<"overview" | "holdings" | "targets" | "income" | "invest">("overview");
  const [investments, setInvestments] = useState<InvestmentEntry[]>(() => loadInvestments());
  const [investDraft, setInvestDraft] = useState<DraftInvestment>(emptyInvestmentDraft);
  const [investError, setInvestError] = useState("");
  const [history, setHistory] = useState<PortfolioSnapshot[]>(() => loadHistory());
  const [holdingsSearch, setHoldingsSearch] = useState("");
  const [holdingsSort, setHoldingsSort] = useState<{ key: HoldingsSortKey | null; dir: SortDir }>({
    key: null,
    dir: "desc",
  });

  const [fetching, setFetching] = useState(false);
  const [quoteSources, setQuoteSources] = useState<HoldingSources>({});
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(
    () => loadLastFetchedAt(),
  );

  const { confirm, dialog: confirmDialog } = useConfirm();
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
    savePortfolioToDisk({
      holdings,
      cash: cashDraft,
      targets,
      investments,
      history,
      lastFetchedAt,
    });
  }, [holdings, cashDraft, targets, investments, history, lastFetchedAt]);

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

  const topHolding = [...nonCashPortfolio].sort((a, b) => b.weight - a.weight)[0];
  const cashWeight = portfolio.totalValue > 0 ? cashDraft.available / portfolio.totalValue : 0;
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
    const gapValue = (target.targetWeight - currentWeight) * portfolio.totalValue;
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

    let xirrPct = 0;
    if (investmentRows.length >= 2 && latestValue > 0) {
      const flows = investmentRows
        .filter((row) => row.amount !== 0)
        .map((row) => ({
          date: new Date(row.date),
          amount: -row.amount,
        }));
      const terminalDate = new Date(last!.date);
      flows.push({ date: terminalDate, amount: latestValue });
      const rate = xirr(flows, 0.1);
      xirrPct = Number.isFinite(rate) ? rate * 100 : 0;
    }

    return {
      totalInvested,
      latestValue,
      pnlValue,
      pnlPct,
      xirrPct,
      count: investmentRows.length,
    };
  }, [investmentRows]);

  const summaryInput: PortfolioSummaryInput = useMemo(() => {
    const dayPnL = nonCashPortfolio.reduce((s, h) => {
      const denom = 100 + h.dayChangePct;
      return denom === 0 ? s : s + (h.marketValue * h.dayChangePct) / denom;
    }, 0);
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
      cash: { available: cashDraft.available, weight: cashWeight },
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
    };
  }, [
    nonCashPortfolio,
    portfolio,
    equityMarketValue,
    totalInvested,
    cashDraft.available,
    cashWeight,
    sectors,
    targetRows,
    upcomingDividends,
    investmentSummary,
    investments,
    history,
    lastFetchedAt,
  ]);

  const sortedHoldings = useMemo(() => {
    const q = holdingsSearch.trim().toLowerCase();
    const byClass =
      holdingsClassFilter === "all"
        ? portfolio.holdings
        : portfolio.holdings.filter(
            (h) =>
              h.id.startsWith("cash-") ||
              (h.assetClass ?? "stock") === holdingsClassFilter,
          );
    const filtered = q
      ? byClass.filter(
          (h) =>
            h.ticker.toLowerCase().includes(q) ||
            h.name.toLowerCase().includes(q) ||
            h.sector.toLowerCase().includes(q),
        )
      : [...byClass];

    const { key, dir } = holdingsSort;
    if (!key) return filtered;

    const mult = dir === "asc" ? 1 : -1;
    const valueOf = (h: typeof filtered[number]): string | number => {
      switch (key) {
        case "ticker": return h.ticker;
        case "name": return h.name;
        case "sector": return h.sector;
        case "shares": return h.shares;
        case "costBasis": return h.costBasis;
        case "price": return h.price;
        case "dayChangePct": return h.dayChangePct;
        case "marketValue": return h.marketValue;
        case "weight": return h.weight;
        case "pnlToday": return h.marketValue * h.dayChangePct / (100 + h.dayChangePct || 1);
        case "gainLoss": return h.gainLoss;
      }
    };

    filtered.sort((a, b) => {
      const aCash = a.id.startsWith("cash-");
      const bCash = b.id.startsWith("cash-");
      if (aCash && !bCash) return 1;
      if (!aCash && bCash) return -1;
      const va = valueOf(a);
      const vb = valueOf(b);
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * mult;
      }
      return ((va as number) - (vb as number)) * mult;
    });

    return filtered;
  }, [portfolio.holdings, holdingsSearch, holdingsSort, holdingsClassFilter]);

  function toggleSort(key: HoldingsSortKey) {
    setHoldingsSort((cur) => {
      if (cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: "desc" };
    });
  }

  const assetClassBuckets = useMemo(
    () => buildAssetClassBuckets(portfolio.holdings),
    [portfolio.holdings],
  );

  const treemapItems = useMemo(() => {
    if (treemapMode === "sector") {
      return sectors.map((sector) => ({
        key: sector.sector,
        label: sector.sector,
        value: sector.value,
        weight: sector.weight,
      }));
    }

    if (treemapMode === "assetClass") {
      return assetClassBuckets.map((bucket) => ({
        key: bucket.assetClass,
        label: bucket.assetClass,
        value: bucket.value,
        weight: bucket.weight,
      }));
    }

    return portfolio.holdings.slice(0, UI_LIMITS.TREEMAP_TOP_N).map((holding) => ({
      key: holding.id,
      label: holding.ticker,
      value: holding.marketValue,
      weight: holding.weight,
    }));
  }, [treemapMode, sectors, assetClassBuckets, portfolio.holdings]);

  const savingsStats = useMemo(
    () => computeSavingsStats(investmentRows),
    [investmentRows],
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
    () => computeRiskMetrics(history, ANALYTICS.RISK_FREE_ANNUAL, ANALYTICS.TRADING_DAYS),
    [history],
  );
  const valueSeries = useMemo(() => history.map((s) => s.totalValue), [history]);
  const pnlSeries = useMemo(() => history.map((s) => s.gainLoss), [history]);

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

    const isCrypto = draft.assetClass === "crypto";
    if (isCrypto && !draft.coinId) {
      setDraftError("Pick a coin from the search to add a crypto holding.");
      return;
    }

    const holding: Holding = {
      id: createId(),
      ticker: ticker.toUpperCase(),
      name,
      sector: isCrypto ? "Crypto" : draft.sector.trim() || "Uncategorized",
      account: isCrypto ? "Crypto" : "PSX",
      shares: draft.shares,
      price: isCrypto ? 0 : draft.price,
      // Crypto cost is USD-native; PKR costBasis is derived on the next price
      // refresh from CoinGecko's implied FX. Starts at 0 until then.
      costBasis: isCrypto ? 0 : draft.costBasis,
      dayChangePct: draft.dayChangePct,
      dividendPerShare: draft.dividendPerShare,
      payoutDate: draft.payoutDate,
      assetClass: isCrypto ? "crypto" : "stock",
      coinId: isCrypto ? draft.coinId : "",
      ...(isCrypto && { usdCostBasis: draft.usdCostBasis ?? 0, usdPrice: 0 }),
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

  function updateHoldingCostBasis(id: string, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    setHoldings((current) =>
      current.map((h) =>
        h.id === id ? { ...h, costBasis: Math.round(value * 100) / 100 } : h,
      ),
    );
  }

  function updateHoldingShares(id: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setHoldings((current) =>
      current.map((h) =>
        h.id === id
          ? { ...h, shares: h.assetClass === "crypto" ? value : Math.round(value) }
          : h,
      ),
    );
  }

  async function removeHolding(id: string) {
    const holding = holdings.find((h) => h.id === id);
    if (!holding) return;
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
    const nonCash = holdings.filter((h) => !h.id.startsWith("cash-"));
    if (nonCash.length === 0) {
      return;
    }

    setFetching(true);

    try {
      const stockTickers = nonCash
        .filter((h) => h.assetClass !== "crypto")
        .map((h) => h.ticker);
      const coinIds = Array.from(
        new Set(
          nonCash
            .filter((h) => h.assetClass === "crypto" && h.coinId)
            .map((h) => h.coinId as string),
        ),
      );

      // Dividends disabled for now — no reliable source (see fetchDividendResilient).
      // Fetch both classes independently so one source failing doesn't block the other.
      const [stockRes, cryptoRes] = await Promise.allSettled([
        stockTickers.length ? fetchMarketData(stockTickers) : Promise.resolve([]),
        coinIds.length ? fetchCryptoMarketData(coinIds) : Promise.resolve([]),
      ]);

      const quotes: MarketQuote[] = [];
      if (stockRes.status === "fulfilled") quotes.push(...stockRes.value);
      if (cryptoRes.status === "fulfilled") quotes.push(...cryptoRes.value);

      if (stockRes.status === "rejected" && stockTickers.length) {
        pushToast(`Stock prices failed: ${String(stockRes.reason)}`, "error");
      }
      if (cryptoRes.status === "rejected" && coinIds.length) {
        pushToast(`Crypto prices failed: ${String(cryptoRes.reason)}`, "error");
      }

      const { holdings: updated, sources } = applyMarketData(holdings, quotes, []);
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

      const snapshot = computePortfolio(buildHoldingsWithCash(updated, cashDraft));
      // Snapshot once/day after the 15:30 PKT close — every calendar day, so
      // crypto's 24/7 movement (incl. weekends) is tracked. Stocks just carry
      // their last close on non-trading days.
      const { afterClose } = psxCloseStatus();
      if (afterClose) {
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
      holdings,
      cash: cashDraft,
      targets,
      investments,
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
                {holdings.length > 0 ? ` (was ${holdings.length})` : ""}
              </li>
              <li>
                Cash: <strong>{formatCurrency(incomingCash?.available ?? 0)}</strong>
                {cashDraft.available > 0 ? ` (was ${formatCurrency(cashDraft.available)})` : ""}
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
            className="button button-primary"
            onClick={refreshPrices}
            disabled={fetching || holdings.length === 0}
          >
            {fetching ? "Fetching..." : "Refresh prices"}
          </button>
          <button type="button" className="button" onClick={exportPortfolio}>
            Export
          </button>
          <CopySummaryButton
            summaryInput={summaryInput}
            disabled={holdings.length === 0}
          />
          <label className="button" htmlFor="import-portfolio-file">
            Import
          </label>
          <input
            id="import-portfolio-file"
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importPortfolio(file);
              event.target.value = "";
            }}
          />
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

      {page === "overview" && (
        <OverviewPage
          equityMarketValue={equityMarketValue}
          totalInvested={totalInvested}
          nonCashCount={nonCashPortfolio.length}
          portfolio={portfolio}
          topHolding={topHolding}
          cashDraft={cashDraft}
          cashWeight={cashWeight}
          investmentSummary={investmentSummary}
          history={history}
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
          assetClassBuckets={assetClassBuckets}
        />
      )}

      {page === "holdings" && (
        <HoldingsPage
          draft={draft}
          setDraft={setDraft}
          draftError={draftError}
          addManualHolding={addManualHolding}
          holdingsSearch={holdingsSearch}
          setHoldingsSearch={setHoldingsSearch}
          sortedHoldings={sortedHoldings}
          holdingsSort={holdingsSort}
          toggleSort={toggleSort}
          updateHoldingShares={updateHoldingShares}
          updateHoldingCostBasis={updateHoldingCostBasis}
          removeHolding={removeHolding}
          quoteSources={quoteSources}
          classFilter={holdingsClassFilter}
          setClassFilter={setHoldingsClassFilter}
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
          targetStatusFilter={targetStatusFilter}
          setTargetStatusFilter={setTargetStatusFilter}
          targetSort={targetSort}
          setTargetSort={setTargetSort}
          targetFilter={targetFilter}
          setTargetFilter={setTargetFilter}
          markTargetRebalanced={markTargetRebalanced}
          removeTarget={removeTarget}
          updateTargetThreshold={updateTargetThreshold}
          updateTargetCadence={updateTargetCadence}
          rebalanceSuggestions={rebalanceSuggestions}
          buySuggestions={buySuggestions}
          sellSuggestions={sellSuggestions}
          cashMessage={cashMessage}
          totalValue={portfolio.totalValue}
        />
      )}

      {page === "income" && (
        <IncomePage
          cashDraft={cashDraft}
          setCashDraft={setCashDraft}
          cashError={cashError}
          saveCashBuckets={saveCashBuckets}
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
    </main>
  );
}

export default App;
