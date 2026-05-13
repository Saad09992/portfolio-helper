import { useEffect, useMemo, useRef, useState } from "react";
import type { Holding } from "./types";
import {
  computePortfolio,
  computeTwrIndex,
  createId,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatRelativeTime,
  formatSignedPercent,
  sampleHoldings,
  storageKey,
  xirr,
} from "./utils";
import {
  ChartTooltip,
  buildCatmullRomPath,
  niceTicks,
  useChartHover,
} from "./chartHelpers";
import { useConfirm } from "./confirmDialog";
import { applyMarketData, fetchDividends, fetchMarketData } from "./services/psx-scraper";
import { loadPortfolioFromDisk, savePortfolioToDisk } from "./services/portfolio-store";
import { apiUrl } from "./services/api-url";

const BACKUP_SCHEMA_VERSION = 1;
const lastFetchedStorageKey = `${storageKey}:last-fetched`;

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

type PortfolioSnapshot = {
  date: string;
  totalValue: number;
  totalCost: number;
  gainLoss: number;
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

const cashStorageKey = `${storageKey}:cash-buckets`;
const targetStorageKey = `${storageKey}:targets`;
const investStorageKey = `${storageKey}:investments`;
const historyStorageKey = `${storageKey}:history`;

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
    return items.slice(0, 4);
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
      const { isWeekday, afterClose, pkDate } = psxCloseStatus();
      if (isWeekday && afterClose) {
        setHistory((cur) => {
          if (cur.some((s) => pkDateOf(s.date) === pkDate)) return cur;
          const next = [
            ...cur,
            {
              date: new Date().toISOString(),
              totalValue: snapshot.totalValue,
              totalCost: snapshot.totalCost,
              gainLoss: snapshot.totalGainLoss,
            },
          ];
          return next.slice(-365);
        });
      }
    } catch {
      // ignore
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
      let data: Record<string, unknown>;
      try {
        const text = String(reader.result);
        data = JSON.parse(text);
        if (!data || typeof data !== "object") throw new Error("Not a JSON object");
      } catch (err) {
        await confirm({
          title: "Import failed",
          message: `Could not parse file: ${err instanceof Error ? err.message : "Invalid file"}`,
          confirmLabel: "Close",
          cancelLabel: "Close",
        });
        return;
      }

      const incomingHoldings = Array.isArray(data.holdings) ? (data.holdings as Holding[]) : null;
      const incomingCash =
        data.cash && typeof data.cash === "object" ? (data.cash as CashBuckets) : null;
      const incomingTargets = Array.isArray(data.targets) ? (data.targets as TargetAllocation[]) : null;
      const incomingInvestments = Array.isArray(data.investments)
        ? (data.investments as InvestmentEntry[])
        : null;
      const incomingHistory = Array.isArray(data.history)
        ? (data.history as PortfolioSnapshot[])
        : null;
      const incomingLastFetched =
        typeof data.lastFetchedAt === "string" ? (data.lastFetchedAt as string) : null;

      const anyData =
        incomingHoldings ||
        incomingCash ||
        incomingTargets ||
        incomingInvestments ||
        incomingHistory;
      if (!anyData) {
        await confirm({
          title: "Nothing to import",
          message: "The file did not contain any recognizable portfolio data.",
          confirmLabel: "Close",
          cancelLabel: "Close",
        });
        return;
      }

      const exportedAt =
        typeof data.exportedAt === "string" ? (data.exportedAt as string) : null;

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
            <button
              type="button"
              className="button button-ghost"
              onClick={async () => {
                if (history.length === 0) return;
                const ok = await confirm({
                  title: "Clear history",
                  message: (
                    <>
                      Wipe all <strong>{history.length}</strong> chart snapshot(s)? Daily history will rebuild after each PSX close. This cannot be undone.
                    </>
                  ),
                  confirmLabel: "Clear history",
                  tone: "danger",
                });
                if (!ok) return;
                setHistory([]);
              }}
              disabled={history.length === 0}
              title="Wipe portfolio chart history"
            >
              Clear history
            </button>
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
                      <td className="right">{holding.shares.toLocaleString()}</td>
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

function loadLastFetchedAt(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(lastFetchedStorageKey);
  return raw && raw !== "null" ? raw : null;
}

function loadHistory(): PortfolioSnapshot[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(historyStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PortfolioSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// PSX trading window ends 15:30 PKT Mon–Thu; Fri ladder ends 16:30. Use 15:30
// weekday cutoff — daily snapshot only persists once market has closed.
function pkParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

function psxCloseStatus(now: Date = new Date()) {
  const p = pkParts(now);
  const isWeekday = !["Sat", "Sun"].includes(p.weekday);
  const afterClose = p.hour > 15 || (p.hour === 15 && p.minute >= 30);
  return { isWeekday, afterClose, pkDate: p.date };
}

function pkDateOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return pkParts(d).date;
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

type HistorySeriesKey = "value" | "cost" | "twr";

const HISTORY_SERIES_META: Record<
  HistorySeriesKey,
  { label: string; color: string; dashed?: boolean }
> = {
  value: { label: "Market value", color: "#e4ecff" },
  cost: { label: "Cost basis", color: "#fbbf24", dashed: true },
  twr: { label: "True return (TWR)", color: "#5eead4" },
};

function PortfolioHistoryChart({
  snapshots,
  lastFetchedIso,
}: {
  snapshots: PortfolioSnapshot[];
  lastFetchedIso?: string | null;
}) {
  const [viewMode, setViewMode] = useState<"value" | "twr">("value");
  const [hiddenSeries, setHiddenSeries] = useState<Set<HistorySeriesKey>>(
    () => new Set(),
  );

  const twrIndex = useMemo(() => computeTwrIndex(snapshots), [snapshots]);

  const W = 800;
  const H = 300;
  const padL = 78;
  const padR = 24;
  const padT = 24;
  const padB = 48;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const visibleKeys = useMemo<HistorySeriesKey[]>(() => {
    const keys: HistorySeriesKey[] =
      viewMode === "value" ? ["value", "cost"] : ["twr"];
    return keys.filter((k) => !hiddenSeries.has(k));
  }, [viewMode, hiddenSeries]);

  const chart = useMemo(() => {
    if (snapshots.length < 2) return null;

    const values = snapshots.map((s) => s.totalValue);
    const costs = snapshots.map((s) => s.totalCost);

    const seriesByKey: Record<HistorySeriesKey, number[]> = {
      value: values,
      cost: costs,
      twr: twrIndex.map((v) => v - 100),
    };

    const allVisible = visibleKeys.flatMap((k) => seriesByKey[k]);
    const hi = Math.max(...allVisible);
    const lo = Math.min(...allVisible, viewMode === "twr" ? 0 : hi);
    const span = hi - lo || 1;
    const yHi = hi + span * 0.08;
    const yLo = viewMode === "twr" ? lo - span * 0.08 : Math.max(0, lo - span * 0.08);

    const xOf = (i: number) =>
      padL +
      (snapshots.length === 1
        ? innerW / 2
        : (i / (snapshots.length - 1)) * innerW);
    const yOf = (v: number) =>
      padT + innerH - ((v - yLo) / (yHi - yLo)) * innerH;

    const pointsByKey: Record<HistorySeriesKey, { x: number; y: number }[]> = {
      value: values.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
      cost: costs.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
      twr: seriesByKey.twr.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
    };

    const tickValues = niceTicks(yLo, yHi, 5);

    return {
      seriesByKey,
      pointsByKey,
      yLo,
      yHi,
      xOf,
      yOf,
      tickValues,
    };
  }, [snapshots, twrIndex, visibleKeys, viewMode, innerH, innerW]);

  const { containerRef, svgRef, hover, handlers } = useChartHover({
    pointCount: snapshots.length,
    plotLeft: padL,
    plotRight: padR,
    viewBoxWidth: W,
  });

  const containerWidth =
    containerRef.current?.clientWidth ?? 600;

  function toggleSeries(key: HistorySeriesKey) {
    setHiddenSeries((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (snapshots.length < 2 || !chart) {
    return (
      <div className="chart-empty">
        Refresh prices after PSX close (15:30 PKT) on 2+ weekdays to chart value over time.
      </div>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(snapshots.length / 6));
  const formatY = (v: number): string =>
    viewMode === "twr" ? formatSignedPercent(v, 1) : formatCompactCurrency(v);

  const hoveredIdx = hover?.index ?? null;
  const lastSnap = snapshots[snapshots.length - 1];
  const unrealizedPnl = lastSnap.totalValue - lastSnap.totalCost;
  const unrealizedPnlPct =
    lastSnap.totalCost > 0 ? (unrealizedPnl / lastSnap.totalCost) * 100 : 0;
  const twrCumulative = twrIndex[twrIndex.length - 1] - 100;

  return (
    <div
      ref={containerRef}
      className="line-chart"
      data-view-mode={viewMode}
    >
      <div className="line-chart-header">
        <div className="line-chart-summary">
          {viewMode === "value" ? (
            <>
              <strong>{formatCurrency(lastSnap.totalValue)}</strong>
              <span
                className={unrealizedPnl >= 0 ? "positive" : "negative"}
                title="Unrealized P&L on current snapshot (cost-basis adjusted, deposit-neutral)"
              >
                {unrealizedPnl >= 0 ? "+" : ""}
                {formatCurrency(unrealizedPnl)} ({formatSignedPercent(unrealizedPnlPct, 2)})
              </span>
            </>
          ) : (
            <>
              <strong className={twrCumulative >= 0 ? "positive" : "negative"}>
                {formatSignedPercent(twrCumulative, 2)}
              </strong>
              <span className="muted">deposit-neutral return over {snapshots.length} snapshots</span>
            </>
          )}
        </div>
        <div className="line-chart-controls">
          {lastFetchedIso ? (
            <span
              className="line-chart-stale"
              title={formatDateLong(lastFetchedIso)}
            >
              Updated {formatRelativeTime(lastFetchedIso)}
            </span>
          ) : null}
          <div className="chip-group">
            <button
              type="button"
              className={`chip ${viewMode === "value" ? "chip--active" : ""}`}
              onClick={() => setViewMode("value")}
            >
              Value
            </button>
            <button
              type="button"
              className={`chip ${viewMode === "twr" ? "chip--active" : ""}`}
              onClick={() => setViewMode("twr")}
            >
              True return %
            </button>
          </div>
        </div>
      </div>

      <div className="line-chart-legend">
        {(viewMode === "value"
          ? (["value", "cost"] as const)
          : (["twr"] as const)
        ).map((key) => {
          const meta = HISTORY_SERIES_META[key];
          const hidden = hiddenSeries.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`line-chart-legend-item ${hidden ? "line-chart-legend-item--off" : ""}`}
              onClick={() => toggleSeries(key)}
              aria-pressed={!hidden}
            >
              <span
                className="line-chart-legend-swatch"
                style={{
                  background: meta.dashed ? "transparent" : meta.color,
                  borderColor: meta.color,
                  borderStyle: meta.dashed ? "dashed" : "solid",
                }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="line-chart-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="line-chart-svg"
          preserveAspectRatio="none"
          role="img"
          aria-label="Portfolio history line chart"
          {...handlers}
        >
          {chart.tickValues.map((v, i) => (
            <g key={`y-${i}`}>
              <line
                className="line-chart-grid"
                x1={padL}
                x2={W - padR}
                y1={chart.yOf(v)}
                y2={chart.yOf(v)}
              />
              <text
                className="line-chart-axis"
                x={padL - 10}
                y={chart.yOf(v) + 4}
                textAnchor="end"
              >
                {formatY(v)}
              </text>
            </g>
          ))}

          {viewMode === "twr" ? (
            <line
              className="line-chart-zero"
              x1={padL}
              x2={W - padR}
              y1={chart.yOf(0)}
              y2={chart.yOf(0)}
            />
          ) : null}

          {visibleKeys.includes("value") && viewMode === "value" ? (
            <path
              className="line-chart-area"
              d={`${buildCatmullRomPath(chart.pointsByKey.value)} L ${chart.pointsByKey.value[chart.pointsByKey.value.length - 1].x} ${chart.yOf(chart.yLo)} L ${chart.pointsByKey.value[0].x} ${chart.yOf(chart.yLo)} Z`}
            />
          ) : null}

          {visibleKeys.map((key) => {
            const meta = HISTORY_SERIES_META[key];
            const pts = chart.pointsByKey[key];
            return (
              <path
                key={`line-${key}`}
                className="line-chart-line"
                d={buildCatmullRomPath(pts)}
                stroke={meta.color}
                strokeDasharray={meta.dashed ? "4 4" : undefined}
                strokeWidth={key === "value" || key === "twr" ? 2.4 : 1.6}
              />
            );
          })}

          {snapshots.map((s, i) => {
            if (i % labelEvery !== 0 && i !== snapshots.length - 1) return null;
            return (
              <text
                key={`xl-${i}`}
                className="line-chart-axis"
                x={chart.xOf(i)}
                y={H - padB + 22}
                textAnchor="middle"
              >
                {formatDateShort(s.date)}
              </text>
            );
          })}

          {hoveredIdx !== null ? (
            <g pointerEvents="none">
              <line
                className="line-chart-crosshair"
                x1={chart.xOf(hoveredIdx)}
                x2={chart.xOf(hoveredIdx)}
                y1={padT}
                y2={H - padB}
              />
              {visibleKeys.map((key) => {
                const meta = HISTORY_SERIES_META[key];
                const p = chart.pointsByKey[key][hoveredIdx];
                return (
                  <circle
                    key={`hd-${key}`}
                    className="line-chart-hover-dot"
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={meta.color}
                  />
                );
              })}
            </g>
          ) : null}
        </svg>

        {hoveredIdx !== null && hover ? (
          <ChartTooltip
            x={hover.containerX}
            y={hover.containerY}
            containerWidth={containerWidth}
            title={formatDateLong(snapshots[hoveredIdx].date)}
            rows={(viewMode === "value"
              ? ([
                  {
                    label: "Market value",
                    value: formatCurrency(snapshots[hoveredIdx].totalValue),
                    color: HISTORY_SERIES_META.value.color,
                  },
                  {
                    label: "Cost basis",
                    value: formatCurrency(snapshots[hoveredIdx].totalCost),
                    color: HISTORY_SERIES_META.cost.color,
                  },
                  {
                    label: "Unrealized P&L",
                    value: formatCurrency(snapshots[hoveredIdx].gainLoss),
                  },
                ] as const)
              : ([
                  {
                    label: "TWR cumulative",
                    value: formatSignedPercent(
                      chart.seriesByKey.twr[hoveredIdx],
                      2,
                    ),
                    color: HISTORY_SERIES_META.twr.color,
                  },
                  {
                    label: "Market value",
                    value: formatCurrency(snapshots[hoveredIdx].totalValue),
                  },
                  {
                    label: "Cost basis",
                    value: formatCurrency(snapshots[hoveredIdx].totalCost),
                  },
                ] as const)
            ).map((r) => ({ ...r }))}
          />
        ) : null}
      </div>
    </div>
  );
}

type InvestmentChartRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  total: number;
  valueEom: number;
  pnlValue: number;
  pnlPct: number;
};

type InvestSeriesKey = "total" | "value";
const INVEST_SERIES_META: Record<
  InvestSeriesKey,
  { label: string; color: string }
> = {
  total: { label: "Capital deployed", color: "#5ea5ea" },
  value: { label: "Portfolio value", color: "#e4ecff" },
};

function InvestmentChart({ rows }: { rows: InvestmentChartRow[] }) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<InvestSeriesKey>>(
    () => new Set(),
  );

  const W = 800;
  const H = 320;
  const padL = 78;
  const padR = 24;
  const padT = 24;
  const padB = 52;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const visibleKeys = useMemo<InvestSeriesKey[]>(
    () => (["total", "value"] as const).filter((k) => !hiddenSeries.has(k)),
    [hiddenSeries],
  );

  const chart = useMemo(() => {
    if (rows.length < 2) return null;

    const totals = rows.map((r) => r.total);
    const values = rows.map((r) => r.valueEom);

    const seriesByKey: Record<InvestSeriesKey, number[]> = {
      total: totals,
      value: values,
    };

    const visibleSeries = visibleKeys.flatMap((k) => seriesByKey[k]);
    const hi = Math.max(...visibleSeries, 0);
    const lo = Math.min(...visibleSeries, 0);
    const span = hi - lo || 1;
    const yHi = hi + span * 0.08;
    const yLo = Math.max(0, lo - span * 0.04);

    const xOf = (i: number) =>
      padL +
      (rows.length === 1
        ? innerW / 2
        : (i / (rows.length - 1)) * innerW);
    const yOf = (v: number) =>
      padT + innerH - ((v - yLo) / (yHi - yLo)) * innerH;

    let stepPath = `M ${xOf(0)} ${yOf(totals[0])}`;
    for (let i = 1; i < rows.length; i++) {
      stepPath += ` H ${xOf(i)} V ${yOf(totals[i])}`;
    }
    const stepArea = `${stepPath} L ${xOf(rows.length - 1)} ${yOf(yLo)} L ${xOf(0)} ${yOf(yLo)} Z`;

    const valuePoints = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
    const totalPoints = totals.map((v, i) => ({ x: xOf(i), y: yOf(v) }));

    const tickValues = niceTicks(yLo, yHi, 5);

    return {
      seriesByKey,
      valuePath: buildCatmullRomPath(valuePoints),
      stepPath,
      stepArea,
      valuePoints,
      totalPoints,
      tickValues,
      yOf,
      xOf,
    };
  }, [rows, visibleKeys, innerH, innerW]);

  const { containerRef, svgRef, hover, handlers } = useChartHover({
    pointCount: rows.length,
    plotLeft: padL,
    plotRight: padR,
    viewBoxWidth: W,
  });

  function toggleSeries(key: InvestSeriesKey) {
    setHiddenSeries((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (rows.length < 2 || !chart) {
    return (
      <div className="chart-empty">
        Add at least 2 investment entries to see chart.
      </div>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
  const hoveredIdx = hover?.index ?? null;
  const containerWidth = containerRef.current?.clientWidth ?? 600;

  return (
    <div ref={containerRef} className="line-chart">
      <div className="line-chart-legend">
        {(["total", "value"] as const).map((key) => {
          const meta = INVEST_SERIES_META[key];
          const hidden = hiddenSeries.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`line-chart-legend-item ${hidden ? "line-chart-legend-item--off" : ""}`}
              onClick={() => toggleSeries(key)}
              aria-pressed={!hidden}
            >
              <span
                className="line-chart-legend-swatch"
                style={{ background: meta.color, borderColor: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="line-chart-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="line-chart-svg"
          preserveAspectRatio="none"
          role="img"
          aria-label="Investment growth chart"
          {...handlers}
        >
          {chart.tickValues.map((v, i) => (
            <g key={`y-${i}`}>
              <line
                className="line-chart-grid"
                x1={padL}
                x2={W - padR}
                y1={chart.yOf(v)}
                y2={chart.yOf(v)}
              />
              <text
                className="line-chart-axis"
                x={padL - 10}
                y={chart.yOf(v) + 4}
                textAnchor="end"
              >
                {formatCompactCurrency(v)}
              </text>
            </g>
          ))}

          {visibleKeys.includes("total") ? (
            <>
              <path className="line-chart-step-fill" d={chart.stepArea} />
              <path
                className="line-chart-step"
                d={chart.stepPath}
                stroke={INVEST_SERIES_META.total.color}
              />
            </>
          ) : null}

          {visibleKeys.includes("value") ? (
            <path
              className="line-chart-line"
              d={chart.valuePath}
              stroke={INVEST_SERIES_META.value.color}
              strokeWidth={2.4}
            />
          ) : null}

          {rows.map((r, i) => {
            if (i % labelEvery !== 0 && i !== rows.length - 1) return null;
            return (
              <text
                key={`xl-${r.id}`}
                className="line-chart-axis"
                x={chart.xOf(i)}
                y={H - padB + 22}
                textAnchor="middle"
              >
                {formatDateShort(r.date)}
              </text>
            );
          })}

          {hoveredIdx !== null ? (
            <g pointerEvents="none">
              <line
                className="line-chart-crosshair"
                x1={chart.xOf(hoveredIdx)}
                x2={chart.xOf(hoveredIdx)}
                y1={padT}
                y2={H - padB}
              />
              {visibleKeys.includes("total") ? (
                <circle
                  className="line-chart-hover-dot"
                  cx={chart.totalPoints[hoveredIdx].x}
                  cy={chart.totalPoints[hoveredIdx].y}
                  r={5}
                  fill={INVEST_SERIES_META.total.color}
                />
              ) : null}
              {visibleKeys.includes("value") ? (
                <circle
                  className="line-chart-hover-dot"
                  cx={chart.valuePoints[hoveredIdx].x}
                  cy={chart.valuePoints[hoveredIdx].y}
                  r={5}
                  fill={INVEST_SERIES_META.value.color}
                />
              ) : null}
            </g>
          ) : null}
        </svg>

        {hoveredIdx !== null && hover ? (
          <ChartTooltip
            x={hover.containerX}
            y={hover.containerY}
            containerWidth={containerWidth}
            title={`${formatDateLong(rows[hoveredIdx].date)} · ${rows[hoveredIdx].label}`}
            rows={[
              {
                label: "Capital deployed",
                value: formatCurrency(rows[hoveredIdx].total),
                color: INVEST_SERIES_META.total.color,
              },
              {
                label: "Portfolio value",
                value: formatCurrency(rows[hoveredIdx].valueEom),
                color: INVEST_SERIES_META.value.color,
              },
              {
                label: "P&L",
                value: `${rows[hoveredIdx].pnlValue >= 0 ? "+" : ""}${formatCurrency(rows[hoveredIdx].pnlValue)} (${formatSignedPercent(rows[hoveredIdx].pnlPct, 2)})`,
              },
              {
                label: "Entry amount",
                value:
                  rows[hoveredIdx].amount === 0
                    ? "—"
                    : `${rows[hoveredIdx].amount > 0 ? "+" : ""}${formatCurrency(rows[hoveredIdx].amount)}`,
              },
            ]}
          />
        ) : null}
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
          return (
            <div
              key={ri}
              className="treemap-row"
              style={{ flexGrow: rowWeight, flexShrink: 1, flexBasis: 0 }}
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
