import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CashBuckets,
  Holding,
  InvestmentEntry,
  TargetAllocation,
} from "./types";
import {
  computePortfolio,
  computeTwrIndex,
  createId,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
  type PortfolioSnapshot,
  storageKey,
  upsertDailySnapshot,
  xirr,
} from "./utils";
import { useConfirm } from "./confirmDialog";
import { applyMarketData, fetchDividends, fetchMarketData } from "./services/psx-scraper";
import { loadPortfolioFromDisk, savePortfolioToDisk } from "./services/portfolio-store";
import { apiUrl } from "./services/api-url";
import { DRIFT, REBALANCE, UI_LIMITS } from "./constants";
import { ToastViewport } from "./components/Toast";
import { pushToast } from "./hooks/useToast";
import { driftStatus, isRebalanceSuggestion } from "./portfolio/rebalance";
import { ImportParseError, parseImportBundle } from "./portfolio/importExport";
import { pkDateOf, psxCloseStatus } from "./portfolio/calendar";
import {
  buildHoldingsWithCash,
  buildSectorBuckets,
  getCashDeploymentIdea,
  normalizeHolding,
} from "./portfolio/holdings";
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
  targetStorageKey,
} from "./portfolio/storage";
import { PortfolioHistoryChart } from "./components/charts/PortfolioHistoryChart";
import { InvestmentChart } from "./components/charts/InvestmentChart";
import { Treemap } from "./components/charts/Treemap";
import { getSliceColor } from "./components/charts/palette";
import { CopySummaryButton } from "./components/CopySummaryButton";
import type { PortfolioSummaryInput } from "./portfolio/summary";

const BACKUP_SCHEMA_VERSION = 1;

type DraftHolding = Omit<Holding, "id" | "account">;

type DraftTarget = {
  mode: "sector" | "ticker";
  key: string;
  targetWeightPct: number;
};

type DraftInvestment = {
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};

type SortDir = "asc" | "desc";
type HoldingsSortKey =
  | "ticker"
  | "name"
  | "sector"
  | "shares"
  | "costBasis"
  | "price"
  | "dayChangePct"
  | "marketValue"
  | "weight"
  | "pnlToday"
  | "gainLoss";

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
      if (Array.isArray(data.targets)) setTargets(data.targets as TargetAllocation[]);
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

  const targetRows = targets.map((target) => {
    const lookup = target.mode === "sector" ? sectorWeightMap : tickerWeightMap;
    const currentWeight = lookup.get(target.key.toLowerCase()) ?? 0;
    const drift = currentWeight - target.targetWeight;
    const gapValue = (target.targetWeight - currentWeight) * portfolio.totalValue;
    const absDrift = Math.abs(drift);
    const status: "severe" | "moderate" | "ontrack" = driftStatus(absDrift);
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
    const over = targetRows.filter((r) => r.drift > DRIFT.COUNT_THRESHOLD).length;
    const under = targetRows.filter((r) => r.drift < -DRIFT.COUNT_THRESHOLD).length;
    const onTrack = targetRows.length - over - under;
    const totalDeviation = targetRows.reduce((s, r) => s + r.absDrift, 0);
    return { over, under, onTrack, totalDeviation };
  }, [targetRows]);

  const rebalanceSuggestions = targetRows
    .filter((row) => isRebalanceSuggestion(row.gapValue, portfolio.totalValue))
    .sort((left, right) => Math.abs(right.gapValue) - Math.abs(left.gapValue))
    .slice(0, REBALANCE.MAX_SUGGESTIONS);

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
    const filtered = q
      ? portfolio.holdings.filter(
          (h) =>
            h.ticker.toLowerCase().includes(q) ||
            h.name.toLowerCase().includes(q) ||
            h.sector.toLowerCase().includes(q),
        )
      : [...portfolio.holdings];

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
  }, [portfolio.holdings, holdingsSearch, holdingsSort]);

  function toggleSort(key: HoldingsSortKey) {
    setHoldingsSort((cur) => {
      if (cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: "desc" };
    });
  }

  const treemapItems = useMemo(() => {
    if (treemapMode === "sector") {
      return sectors.map((sector) => ({
        key: sector.sector,
        label: sector.sector,
        value: sector.value,
        weight: sector.weight,
      }));
    }

    return portfolio.holdings.slice(0, UI_LIMITS.TREEMAP_TOP_N).map((holding) => ({
      key: holding.id,
      label: holding.ticker,
      value: holding.marketValue,
      weight: holding.weight,
    }));
  }, [treemapMode, sectors, portfolio.holdings]);

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
        h.id === id ? { ...h, shares: Math.round(value) } : h,
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
      const tickers = nonCash.map((h) => h.ticker);
      const [quotes, dividends] = await Promise.all([
        fetchMarketData(tickers),
        fetchDividends(tickers),
      ]);
      const { holdings: updated } = applyMarketData(holdings, quotes, dividends);
      setHoldings(updated);
      setLastFetchedAt(new Date().toISOString());

      const snapshot = computePortfolio(buildHoldingsWithCash(updated, cashDraft));
      const { isWeekday, afterClose } = psxCloseStatus();
      if (isWeekday && afterClose) {
        const entry = {
          date: new Date().toISOString(),
          totalValue: snapshot.totalValue,
          totalCost: snapshot.totalCost,
          gainLoss: snapshot.totalGainLoss,
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
      if (incomingTargets) setTargets(incomingTargets);
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
          value={formatCurrency(equityMarketValue)}
          detail={`${nonCashPortfolio.length} position${nonCashPortfolio.length === 1 ? "" : "s"} · excludes cash`}
        />
        <StatCard
          label="Total avg cost"
          value={formatCurrency(totalInvested)}
          detail={`Cost basis of ${nonCashPortfolio.length} position${nonCashPortfolio.length === 1 ? "" : "s"} · excludes cash`}
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
          label="Total invested"
          value={formatCurrency(investmentSummary.totalInvested)}
          detail={
            investmentSummary.count > 0
              ? `${investmentSummary.count} Invest entr${investmentSummary.count === 1 ? "y" : "ies"}`
              : "Add entries in Invest tab"
          }
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">History</p>
            <h2>Portfolio value over time</h2>
          </div>
          <div className="panel-meta-row">
            <span className="panel-meta">{history.length} snapshot{history.length === 1 ? "" : "s"} · 1/day after PSX close (15:30 PKT)</span>
          </div>
        </div>
        <PortfolioHistoryChart snapshots={history} lastFetchedIso={lastFetchedAt} />
      </section>

      <section className="dashboard-grid dual">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Allocation</p>
              <h2>Portfolio weightage</h2>
            </div>
            <span className="panel-meta">
              {lastFetchedAt
                ? `Updated ${formatRelativeTime(lastFetchedAt)}`
                : "Interactive donut"}
            </span>
          </div>
          {fetching ? <div className="chart-skeleton" aria-hidden="true" /> : null}
          <PieChart holdings={portfolio.holdings} />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">
                {allocationView === "map" ? "Treemap" : "Ranked"}
              </p>
              <h2>Concentration {allocationView === "map" ? "map" : "leaderboard"}</h2>
            </div>
            <div className="allocation-toggles">
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
              <div className="toggle-row">
                <button
                  type="button"
                  className={`chip ${allocationView === "map" ? "active" : ""}`}
                  onClick={() => setAllocationView("map")}
                  title="Squarified treemap"
                >
                  Map
                </button>
                <button
                  type="button"
                  className={`chip ${allocationView === "ranked" ? "active" : ""}`}
                  onClick={() => setAllocationView("ranked")}
                  title="Sorted horizontal bars"
                >
                  Ranked
                </button>
              </div>
            </div>
          </div>
          {allocationView === "map" ? (
            <Treemap items={treemapItems} />
          ) : (
            <RankedAllocation items={treemapItems} />
          )}
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
                if (targetStatusFilter === "over") return row.drift > DRIFT.COUNT_THRESHOLD;
                if (targetStatusFilter === "under") return row.drift < -DRIFT.COUNT_THRESHOLD;
                return Math.abs(row.drift) <= DRIFT.COUNT_THRESHOLD;
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
              <p className="muted-note">No upcoming dividends. Refresh prices to fetch latest announcements.</p>
            ) : (
              upcomingDividends.map((up, i) => (
                <div key={`${up.holding.id}-${up.date}-${i}`} className="suggestion-row">
                  <strong>{up.ticker}</strong>
                  <span>DPS: {formatCurrency(up.dps)}</span>
                  <small>
                    Expected income {formatCurrency(up.holding.shares * up.dps)}
                    {up.date ? ` · Book closure ${up.date}` : ""}
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
          <div className="waterfall-list waterfall-list--centered">
            {waterfallRows.length === 0 ? (
              <p className="muted-note">No positions to evaluate yet.</p>
            ) : (
              waterfallRows.map((holding) => {
                const pct = (Math.abs(holding.gainLoss) / maxWaterfall) * 50;
                const isPos = holding.gainLoss >= 0;
                const contribution =
                  Math.abs(portfolio.totalGainLoss) > 0
                    ? (holding.gainLoss / Math.abs(portfolio.totalGainLoss)) * 100
                    : 0;
                return (
                  <div
                    key={holding.id}
                    className="waterfall-row"
                    title={`${holding.ticker}: ${formatCurrency(holding.gainLoss)} · ${formatSignedPercent(contribution, 1)} of total P&L`}
                  >
                    <strong>{holding.ticker}</strong>
                    <div className="waterfall-track waterfall-track--centered">
                      <span className="waterfall-zero" />
                      <span
                        className={`waterfall-bar waterfall-bar--centered ${isPos ? "positive" : "negative"}`}
                        style={
                          isPos
                            ? { left: "50%", width: `${pct}%` }
                            : { right: "50%", width: `${pct}%` }
                        }
                      />
                    </div>
                    <span
                      className={`waterfall-value ${isPos ? "positive" : "negative"}`}
                    >
                      {formatCurrency(holding.gainLoss)}
                      <small>{formatSignedPercent(contribution, 1)}</small>
                    </span>
                  </div>
                );
              })
            )}
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
          <input
            type="text"
            className="holdings-search"
            placeholder="Search ticker, name, sector..."
            value={holdingsSearch}
            onChange={(e) => setHoldingsSearch(e.target.value)}
          />
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
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.length === 0 ? (
                <tr>
                  <td colSpan={13} className="empty-state">
                    {holdingsSearch ? "No matches." : "No holdings yet. Use Quick add above or Import a saved backup."}
                  </td>
                </tr>
              ) : (
                sortedHoldings.map((holding) => {
                  const syntheticCash = holding.id.startsWith("cash-");
                  return (
                    <tr key={holding.id}>
                      <td>{holding.ticker}</td>
                      <td>{holding.name}</td>
                      <td>{holding.sector}</td>
                      <td className="right">
                        {syntheticCash ? (
                          holding.shares.toLocaleString()
                        ) : (
                          <input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="1"
                            className="inline-edit"
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
                          formatCurrency(holding.costBasis)
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            className="inline-edit"
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
                      <td className="right">
                        {formatCurrency(holding.price)}
                      </td>
                      <td className={`right ${holding.dayChangePct >= 0 ? "positive" : "negative"}`}>
                        {syntheticCash ? "-" : `${holding.dayChangePct.toFixed(2)}%`}
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
            <span className="invest-stat-label" title="Cumulative P&L over total deployed; ignores deposit timing.">
              Cumulative %
            </span>
          </div>
          <div className="invest-stat">
            <span className={`invest-stat-num ${investmentSummary.xirrPct >= 0 ? "positive" : "negative"}`}>
              {investmentSummary.count >= 2
                ? `${investmentSummary.xirrPct >= 0 ? "+" : ""}${investmentSummary.xirrPct.toFixed(2)}%`
                : "—"}
            </span>
            <span className="invest-stat-label" title="Money-weighted return (XIRR): annualized rate that discounts each cashflow to today's value. Industry standard for personal investing performance.">
              Annualized (XIRR)
            </span>
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
              <span>
                Value EOM
                <button
                  type="button"
                  className="invest-fill-current"
                  onClick={() => setInvestDraft((c) => ({ ...c, valueEom: portfolio.totalValue }))}
                  title="Fill with current portfolio total value"
                >
                  Use current
                </button>
              </span>
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
      {confirmDialog}
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

function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  align,
}: {
  label: string;
  sortKey: HoldingsSortKey;
  sort: { key: HoldingsSortKey | null; dir: SortDir };
  onClick: (k: HoldingsSortKey) => void;
  align?: "right";
}) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th className={align === "right" ? "right sortable" : "sortable"}>
      <button type="button" className="sort-btn" onClick={() => onClick(sortKey)}>
        {label}
        <span className="sort-arrow">{arrow}</span>
      </button>
    </th>
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



function RankedAllocation({
  items,
}: {
  items: { key: string; label: string; value: number; weight: number }[];
}) {
  if (items.length === 0) {
    return <div className="chart-empty">No data</div>;
  }
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const top = sorted[0]?.weight || 1;
  return (
    <div className="ranked-allocation">
      {sorted.map((item, i) => {
        const widthPct = (item.weight / top) * 100;
        return (
          <div className="ranked-row" key={item.key}>
            <span className="ranked-rank">{i + 1}</span>
            <strong className="ranked-label">{item.label}</strong>
            <div className="ranked-track">
              <span
                className="ranked-fill"
                style={{
                  width: `${widthPct}%`,
                  background: getSliceColor(i),
                }}
              />
            </div>
            <span className="ranked-weight">{formatPercent(item.weight)}</span>
            <span className="ranked-value">{formatCompactCurrency(item.value)}</span>
          </div>
        );
      })}
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
    fetch(apiUrl("/api/psx/stocks"))
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
