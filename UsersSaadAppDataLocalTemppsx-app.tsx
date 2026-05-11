import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=c201f403"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/dev/psx/src/App.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$(), _s2 = $RefreshSig$(), _s3 = $RefreshSig$(), _s4 = $RefreshSig$(), _s5 = $RefreshSig$(), _s6 = $RefreshSig$(), _s7 = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=c201f403"; const useEffect = __vite__cjsImport3_react["useEffect"]; const useMemo = __vite__cjsImport3_react["useMemo"]; const useRef = __vite__cjsImport3_react["useRef"]; const useState = __vite__cjsImport3_react["useState"];
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
  parseHoldingsCsv,
  sampleHoldings,
  storageKey,
  xirr
} from "/src/utils.ts?t=1778517406664";
import {
  ChartTooltip,
  buildCatmullRomPath,
  niceTicks,
  useChartHover
} from "/src/chartHelpers.tsx";
import { applyMarketData, fetchDividends, fetchMarketData } from "/src/services/psx-scraper.ts";
import { loadPortfolioFromDisk, savePortfolioToDisk } from "/src/services/portfolio-store.ts";
const cashStorageKey = `${storageKey}:cash-buckets`;
const targetStorageKey = `${storageKey}:targets`;
const investStorageKey = `${storageKey}:investments`;
const historyStorageKey = `${storageKey}:history`;
const emptyDraft = {
  ticker: "",
  name: "",
  sector: "Uncategorized",
  shares: 0,
  price: 0,
  costBasis: 0,
  dayChangePct: 0,
  dividendPerShare: 0,
  payoutDate: ""
};
const emptyCashBuckets = {
  available: 0
};
const emptyTargetDraft = {
  mode: "sector",
  key: "",
  targetWeightPct: 0
};
const emptyInvestmentDraft = {
  date: "",
  label: "",
  amount: 0,
  valueEom: 0
};
function App() {
  _s();
  const [holdings, setHoldings] = useState(() => loadHoldings());
  const [draft, setDraft] = useState(emptyDraft);
  const [cashDraft, setCashDraft] = useState(() => loadCashBuckets());
  const [targets, setTargets] = useState(() => loadTargets());
  const [targetDraft, setTargetDraft] = useState(emptyTargetDraft);
  const [targetFilter, setTargetFilter] = useState("");
  const [targetStatusFilter, setTargetStatusFilter] = useState("all");
  const [targetSort, setTargetSort] = useState("drift");
  const [treemapMode, setTreemapMode] = useState("sector");
  const [allocationView, setAllocationView] = useState("map");
  const [page, setPage] = useState("overview");
  const [investments, setInvestments] = useState(() => loadInvestments());
  const [investDraft, setInvestDraft] = useState(emptyInvestmentDraft);
  const [investError, setInvestError] = useState("");
  const [history, setHistory] = useState(() => loadHistory());
  const [holdingsSearch, setHoldingsSearch] = useState("");
  const [holdingsSort, setHoldingsSort] = useState({
    key: null,
    dir: "desc"
  });
  const [fetching, setFetching] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
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
  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadPortfolioFromDisk();
      if (cancelled || !data) {
        hydratedRef.current = true;
        return;
      }
      if (Array.isArray(data.holdings)) setHoldings(data.holdings);
      if (data.cash && typeof data.cash === "object") setCashDraft(data.cash);
      if (Array.isArray(data.targets)) setTargets(data.targets);
      if (Array.isArray(data.investments)) setInvestments(data.investments);
      if (Array.isArray(data.history)) setHistory(data.history);
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
      history
    });
  }, [holdings, cashDraft, targets, investments, history]);
  const holdingsWithCash = useMemo(
    () => buildHoldingsWithCash(holdings, cashDraft),
    [holdings, cashDraft]
  );
  const portfolio = useMemo(
    () => computePortfolio(holdingsWithCash),
    [holdingsWithCash]
  );
  const sectors = useMemo(
    () => buildSectorBuckets(portfolio.holdings),
    [portfolio.holdings]
  );
  const nonCashPortfolio = portfolio.holdings.filter(
    (holding) => holding.sector.toLowerCase() !== "cash"
  );
  const topHolding = portfolio.holdings[0];
  const cashWeight = portfolio.totalValue > 0 ? cashDraft.available / portfolio.totalValue : 0;
  const cashMessage = getCashDeploymentIdea(cashWeight);
  const annualizedDividendIncome = nonCashPortfolio.reduce(
    (sum, holding) => sum + holding.shares * holding.dividendPerShare,
    0
  );
  const equityCost = nonCashPortfolio.reduce((sum, holding) => sum + holding.costValue, 0);
  const yieldOnCost = equityCost > 0 ? annualizedDividendIncome / equityCost : 0;
  const upcomingDividends = [...nonCashPortfolio].filter((holding) => holding.payoutDate).sort((left, right) => left.payoutDate.localeCompare(right.payoutDate)).slice(0, 4);
  const dividendCalendar = useMemo(() => {
    const monthsAhead = 12;
    const now = /* @__PURE__ */ new Date();
    const cells = [];
    for (let i = 0; i < monthsAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      cells.push({
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("en-GB", {
          month: "short",
          year: "2-digit"
        }).format(d),
        year,
        month,
        total: 0,
        entries: []
      });
    }
    for (const holding of nonCashPortfolio) {
      if (!holding.payoutDate || holding.dividendPerShare <= 0) continue;
      const pd = new Date(holding.payoutDate);
      if (!Number.isFinite(pd.getTime())) continue;
      const target = cells.find(
        (c) => c.year === pd.getFullYear() && c.month === pd.getMonth()
      );
      if (!target) continue;
      const amount = holding.shares * holding.dividendPerShare;
      target.total += amount;
      target.entries.push({
        ticker: holding.ticker,
        amount,
        date: holding.payoutDate
      });
    }
    const total = cells.reduce((s, c) => s + c.total, 0);
    return { cells, total };
  }, [nonCashPortfolio]);
  const sectorWeightMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const bucket of sectors) {
      map.set(bucket.sector.toLowerCase(), bucket.weight);
    }
    return map;
  }, [sectors]);
  const tickerWeightMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const holding of portfolio.holdings) {
      map.set(holding.ticker.toLowerCase(), holding.weight);
    }
    return map;
  }, [portfolio.holdings]);
  const tickerPriceMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
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
    const status = absDrift >= 0.05 ? "severe" : absDrift >= 0.02 ? "moderate" : "ontrack";
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
      shares
    };
  });
  const driftSummary = useMemo(() => {
    const over = targetRows.filter((r) => r.drift > 5e-3).length;
    const under = targetRows.filter((r) => r.drift < -5e-3).length;
    const onTrack = targetRows.length - over - under;
    const totalDeviation = targetRows.reduce((s, r) => s + r.absDrift, 0);
    return { over, under, onTrack, totalDeviation };
  }, [targetRows]);
  const rebalanceSuggestions = targetRows.filter(
    (row) => Math.abs(row.gapValue) > Math.max(5e3, portfolio.totalValue * 0.01)
  ).sort((left, right) => Math.abs(right.gapValue) - Math.abs(left.gapValue)).slice(0, 8);
  const buySuggestions = rebalanceSuggestions.filter((r) => r.gapValue > 0);
  const sellSuggestions = rebalanceSuggestions.filter((r) => r.gapValue < 0);
  const investmentRows = useMemo(() => {
    const sorted = [...investments].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((entry) => {
      running += entry.amount;
      const total = running;
      const pnlValue = entry.valueEom - total;
      const pnlPct = total > 0 ? pnlValue / total * 100 : 0;
      return { ...entry, total, pnlValue, pnlPct };
    });
  }, [investments]);
  const investmentSummary = useMemo(() => {
    const last = investmentRows[investmentRows.length - 1];
    const totalInvested = last?.total ?? 0;
    const latestValue = last?.valueEom ?? 0;
    const pnlValue = latestValue - totalInvested;
    const pnlPct = totalInvested > 0 ? pnlValue / totalInvested * 100 : 0;
    let xirrPct = 0;
    if (investmentRows.length >= 2 && latestValue > 0) {
      const flows = investmentRows.filter((row) => row.amount !== 0).map((row) => ({
        date: new Date(row.date),
        amount: -row.amount
      }));
      const terminalDate = new Date(last.date);
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
      count: investmentRows.length
    };
  }, [investmentRows]);
  const sortedHoldings = useMemo(() => {
    const q = holdingsSearch.trim().toLowerCase();
    const filtered = q ? portfolio.holdings.filter(
      (h) => h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q) || h.sector.toLowerCase().includes(q)
    ) : [...portfolio.holdings];
    const { key, dir } = holdingsSort;
    if (!key) return filtered;
    const mult = dir === "asc" ? 1 : -1;
    const valueOf = (h) => {
      switch (key) {
        case "ticker":
          return h.ticker;
        case "name":
          return h.name;
        case "sector":
          return h.sector;
        case "shares":
          return h.shares;
        case "costBasis":
          return h.costBasis;
        case "price":
          return h.price;
        case "dayChangePct":
          return h.dayChangePct;
        case "divYield":
          return h.costBasis > 0 ? h.dividendPerShare / h.costBasis * 100 : 0;
        case "marketValue":
          return h.marketValue;
        case "weight":
          return h.weight;
        case "pnlToday":
          return h.marketValue * h.dayChangePct / (100 + h.dayChangePct || 1);
        case "gainLoss":
          return h.gainLoss;
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
      return (va - vb) * mult;
    });
    return filtered;
  }, [portfolio.holdings, holdingsSearch, holdingsSort]);
  function toggleSort(key) {
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
        weight: sector.weight
      }));
    }
    return portfolio.holdings.slice(0, 12).map((holding) => ({
      key: holding.id,
      label: holding.ticker,
      value: holding.marketValue,
      weight: holding.weight
    }));
  }, [treemapMode, sectors, portfolio.holdings]);
  const waterfallRows = [...nonCashPortfolio].sort((left, right) => Math.abs(right.gainLoss) - Math.abs(left.gainLoss)).slice(0, 10);
  const maxWaterfall = waterfallRows.length > 0 ? Math.max(...waterfallRows.map((holding) => Math.abs(holding.gainLoss))) : 1;
  const topMovers = [...nonCashPortfolio].sort((left, right) => right.dayChangePct - left.dayChangePct).slice(0, 6);
  async function handleImport(file) {
    const text = await file.text();
    const imported = parseHoldingsCsv(text).map(normalizeHolding);
    if (imported.length === 0) {
      return;
    }
    setHoldings(imported);
    setDraft(emptyDraft);
    setDraftError("");
  }
  function addManualHolding(event) {
    event.preventDefault();
    const ticker = draft.ticker.trim();
    const name = draft.name.trim();
    if (!ticker || !name) {
      setDraftError("Ticker and name are required.");
      return;
    }
    if (draft.shares <= 0 || draft.price < 0 || draft.costBasis < 0) {
      setDraftError(
        "Shares must be positive, and avg/current price cannot be negative."
      );
      return;
    }
    const holding = {
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
      payoutDate: draft.payoutDate
    };
    setHoldings((current) => [holding, ...current]);
    setDraft(emptyDraft);
    setDraftError("");
  }
  function saveCashBuckets(event) {
    event.preventDefault();
    if (cashDraft.available < 0) {
      setCashError("Cash value cannot be negative.");
      return;
    }
    setCashError("");
  }
  function addTargetAllocation(event) {
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
    const normalizedKey = targetDraft.mode === "ticker" ? key.toUpperCase() : key;
    setTargets(
      (current) => [
        {
          id: createId(),
          mode: targetDraft.mode,
          key: normalizedKey,
          targetWeight: targetDraft.targetWeightPct / 100
        },
        ...current
      ]
    );
    setTargetDraft(emptyTargetDraft);
    setTargetError("");
  }
  function removeTarget(id) {
    setTargets((current) => current.filter((target) => target.id !== id));
  }
  function addInvestment(event) {
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
    setInvestments(
      (current) => [
        ...current,
        {
          id: createId(),
          date: investDraft.date,
          label: investDraft.label.trim() || `Month ${current.length}`,
          amount,
          valueEom
        }
      ]
    );
    setInvestDraft(emptyInvestmentDraft);
    setInvestError("");
  }
  function removeInvestment(id) {
    setInvestments((current) => current.filter((entry) => entry.id !== id));
  }
  function removeHolding(id) {
    setHoldings((current) => current.filter((holding) => holding.id !== id));
  }
  async function refreshPrices() {
    const nonCash = holdings.filter((h) => !h.id.startsWith("cash-"));
    if (nonCash.length === 0) {
      return;
    }
    setFetching(true);
    try {
      const [quotes, dividends] = await Promise.all(
        [
          fetchMarketData(),
          fetchDividends(nonCash.map((h) => h.ticker))
        ]
      );
      const { holdings: updated } = applyMarketData(holdings, quotes, dividends);
      setHoldings(updated);
      setLastFetchedAt((/* @__PURE__ */ new Date()).toISOString());
      const equityOnly = updated.filter((h) => !isCashHolding(h));
      const snapshot = computePortfolio(equityOnly);
      const { isWeekday, afterClose, pkDate } = psxCloseStatus();
      if (isWeekday && afterClose) {
        setHistory((cur) => {
          if (cur.some((s) => pkDateOf(s.date) === pkDate)) return cur;
          const next = [
            ...cur,
            {
              date: (/* @__PURE__ */ new Date()).toISOString(),
              totalValue: snapshot.totalValue,
              totalCost: snapshot.totalCost,
              gainLoss: snapshot.totalGainLoss
            }
          ];
          return next.slice(-365);
        });
      }
    } catch {
    } finally {
      setFetching(false);
    }
  }
  function exportPortfolio() {
    const data = {
      holdings,
      cash: cashDraft,
      targets,
      investments,
      history,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `psx-portfolio-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importPortfolio(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const data = JSON.parse(text);
        if (!confirm("Replace current data with imported file? This cannot be undone.")) return;
        if (Array.isArray(data.holdings)) setHoldings(data.holdings);
        if (data.cash && typeof data.cash === "object") setCashDraft(data.cash);
        if (Array.isArray(data.targets)) setTargets(data.targets);
        if (Array.isArray(data.investments)) setInvestments(data.investments);
        if (Array.isArray(data.history)) setHistory(data.history);
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : "Invalid file"}`);
      }
    };
    reader.readAsText(file);
  }
  return /* @__PURE__ */ jsxDEV("main", { className: "app-shell", children: [
    /* @__PURE__ */ jsxDEV("section", { className: "hero-bar", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "hero-title", children: [
        /* @__PURE__ */ jsxDEV("p", { className: "eyebrow", children: "PSX portfolio tools" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 723,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("h1", { children: "Portfolio command center" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 724,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 722,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "hero-actions", children: [
        /* @__PURE__ */ jsxDEV("label", { className: "button", htmlFor: "import-file", children: "Import CSV" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 727,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(
          "input",
          {
            id: "import-file",
            className: "sr-only",
            type: "file",
            accept: ".csv,text/csv",
            onChange: (event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
            }
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 730,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            className: "button button-primary",
            onClick: refreshPrices,
            disabled: fetching || holdings.length === 0,
            children: fetching ? "Fetching..." : "Refresh prices"
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 742,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("button", { type: "button", className: "button", onClick: exportPortfolio, children: "Export" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 750,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("label", { className: "button", htmlFor: "import-portfolio-file", children: "Import" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 753,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(
          "input",
          {
            id: "import-portfolio-file",
            className: "sr-only",
            type: "file",
            accept: ".json,application/json",
            onChange: (event) => {
              const file = event.target.files?.[0];
              if (file) importPortfolio(file);
              event.target.value = "";
            }
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 756,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 726,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 721,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("nav", { className: "page-nav", children: [
      ["overview", "Overview"],
      ["holdings", "Holdings"],
      ["targets", "Targets"],
      ["income", "Income"],
      ["invest", "Invest"]
    ].map(
      ([key, label]) => /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          className: `page-nav-tab ${page === key ? "page-nav-tab--active" : ""}`,
          onClick: () => setPage(key),
          children: label
        },
        key,
        false,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 778,
          columnNumber: 9
        },
        this
      )
    ) }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 770,
      columnNumber: 7
    }, this),
    page === "holdings" && /* @__PURE__ */ jsxDEV("section", { className: "quick-add-card panel", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "panel-header compact", children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Quick add" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 793,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("h2", { children: "Manual holding" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 794,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 792,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: "No CSV required" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 796,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 791,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("form", { onSubmit: addManualHolding, children: [
        /* @__PURE__ */ jsxDEV("div", { className: "form-grid", children: [
          /* @__PURE__ */ jsxDEV(
            StockSearch,
            {
              onSelect: (stock) => setDraft((current) => ({
                ...current,
                ticker: stock.ticker,
                name: stock.name,
                sector: stock.sector
              })),
              selected: draft.ticker ? `${draft.ticker} — ${draft.name}` : "",
              onClear: () => setDraft((current) => ({
                ...current,
                ticker: "",
                name: "",
                sector: "Uncategorized"
              }))
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 801,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Field,
            {
              label: "Shares",
              type: "number",
              min: 0,
              step: "1",
              value: String(draft.shares),
              onChange: (value) => setDraft((current) => ({ ...current, shares: Number(value) }))
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 820,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Field,
            {
              label: "Avg price",
              type: "number",
              min: 0,
              step: "0.01",
              value: String(draft.costBasis),
              onChange: (value) => setDraft((current) => ({ ...current, costBasis: Number(value) }))
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 830,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 800,
          columnNumber: 13
        }, this),
        draftError ? /* @__PURE__ */ jsxDEV("p", { className: "form-error", children: draftError }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 842,
          columnNumber: 27
        }, this) : null,
        /* @__PURE__ */ jsxDEV("div", { className: "form-actions", children: /* @__PURE__ */ jsxDEV("button", { type: "submit", className: "button button-primary", children: "Add record" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 845,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 844,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 799,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 790,
      columnNumber: 7
    }, this),
    page === "overview" && /* @__PURE__ */ jsxDEV(Fragment, { children: [
      /* @__PURE__ */ jsxDEV("section", { className: "stats-grid", children: [
        /* @__PURE__ */ jsxDEV(
          StatCard,
          {
            label: "Total value",
            value: formatCurrency(portfolio.totalValue),
            detail: `${portfolio.holdings.length} positions`
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 855,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          StatCard,
          {
            label: "Total avg cost",
            value: formatCurrency(portfolio.totalCost),
            detail: "Cost basis of all positions"
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 860,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          StatCard,
          {
            label: "Unrealized P/L",
            value: formatCurrency(portfolio.totalGainLoss),
            detail: portfolio.totalGainLoss >= 0 ? "Positive drift" : "Downside risk",
            tone: portfolio.totalGainLoss >= 0 ? "positive" : "negative"
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 865,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          StatCard,
          {
            label: "Top position",
            value: topHolding ? `${topHolding.ticker} ${formatPercent(topHolding.weight)}` : "None",
            detail: topHolding ? topHolding.name : "Import holdings to begin"
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 873,
            columnNumber: 9
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 854,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("section", { className: "stats-grid secondary", children: [
        /* @__PURE__ */ jsxDEV(
          StatCard,
          {
            label: "Cash",
            value: formatCurrency(cashDraft.available),
            detail: `${formatPercent(cashWeight)} of portfolio`
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 885,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          StatCard,
          {
            label: "Yield on cost",
            value: formatPercent(yieldOnCost),
            detail: `TTM dividends ${formatCompactCurrency(annualizedDividendIncome)} / equity cost`
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 890,
            columnNumber: 9
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 884,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("section", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "History" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 900,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Portfolio value over time" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 901,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 899,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "panel-meta-row", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: [
              history.length,
              " snapshot",
              history.length === 1 ? "" : "s",
              " · 1/day after PSX close (15:30 PKT)"
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 904,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: "button button-ghost",
                onClick: () => {
                  if (history.length === 0) return;
                  if (!confirm(`Clear all ${history.length} chart snapshot(s)? This cannot be undone.`)) return;
                  setHistory([]);
                },
                disabled: history.length === 0,
                title: "Temp: wipe portfolio chart history",
                children: "Clear history"
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 905,
                columnNumber: 13
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 903,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 898,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV(PortfolioHistoryChart, { snapshots: history, lastFetchedIso: lastFetchedAt }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 920,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 897,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("section", { className: "dashboard-grid dual", children: [
        /* @__PURE__ */ jsxDEV("article", { className: "panel chart-panel", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Allocation" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 927,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("h2", { children: "Portfolio weightage" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 928,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 926,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: lastFetchedAt ? `Updated ${formatRelativeTime(lastFetchedAt)}` : "Interactive donut" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 930,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 925,
            columnNumber: 11
          }, this),
          fetching ? /* @__PURE__ */ jsxDEV("div", { className: "chart-skeleton", "aria-hidden": "true" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 936,
            columnNumber: 23
          }, this) : null,
          /* @__PURE__ */ jsxDEV(PieChart, { holdings: portfolio.holdings }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 937,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 924,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("article", { className: "panel", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: allocationView === "map" ? "Treemap" : "Ranked" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 943,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("h2", { children: [
                "Concentration ",
                allocationView === "map" ? "map" : "leaderboard"
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 946,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 942,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "allocation-toggles", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "toggle-row", children: [
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    className: `chip ${treemapMode === "sector" ? "active" : ""}`,
                    onClick: () => setTreemapMode("sector"),
                    children: "Sector"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 950,
                    columnNumber: 17
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    className: `chip ${treemapMode === "ticker" ? "active" : ""}`,
                    onClick: () => setTreemapMode("ticker"),
                    children: "Ticker"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 957,
                    columnNumber: 17
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 949,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "toggle-row", children: [
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    className: `chip ${allocationView === "map" ? "active" : ""}`,
                    onClick: () => setAllocationView("map"),
                    title: "Squarified treemap",
                    children: "Map"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 966,
                    columnNumber: 17
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    className: `chip ${allocationView === "ranked" ? "active" : ""}`,
                    onClick: () => setAllocationView("ranked"),
                    title: "Sorted horizontal bars",
                    children: "Ranked"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 974,
                    columnNumber: 17
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 965,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 948,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 941,
            columnNumber: 11
          }, this),
          allocationView === "map" ? /* @__PURE__ */ jsxDEV(Treemap, { items: treemapItems }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 986,
            columnNumber: 13
          }, this) : /* @__PURE__ */ jsxDEV(RankedAllocation, { items: treemapItems }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 988,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 940,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 923,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 853,
      columnNumber: 31
    }, this),
    page === "targets" && /* @__PURE__ */ jsxDEV("section", { className: "insight-grid targets-grid", children: [
      /* @__PURE__ */ jsxDEV("article", { className: "panel target-panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Targets" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 999,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("h2", { children: "Allocation drift alerts" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1e3,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 998,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 997,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("form", { className: "target-form", onSubmit: addTargetAllocation, children: [
          /* @__PURE__ */ jsxDEV(
            "select",
            {
              value: targetDraft.mode,
              onChange: (event) => setTargetDraft((current) => ({
                ...current,
                mode: event.target.value,
                key: ""
              })),
              children: [
                /* @__PURE__ */ jsxDEV("option", { value: "sector", children: "Sector" }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1015,
                  columnNumber: 15
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "ticker", children: "Ticker" }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1016,
                  columnNumber: 15
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1005,
              columnNumber: 13
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Combobox,
            {
              value: targetDraft.key,
              onChange: (val) => setTargetDraft((current) => ({ ...current, key: val })),
              options: targetDraft.mode === "sector" ? sectors.map((s) => s.sector) : portfolio.holdings.map((h) => h.ticker),
              placeholder: targetDraft.mode === "sector" ? "Search sector..." : "Search ticker..."
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1018,
              columnNumber: 13
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "number",
              min: 0,
              max: 100,
              step: "0.1",
              value: targetDraft.targetWeightPct,
              onChange: (event) => setTargetDraft((current) => ({
                ...current,
                targetWeightPct: Number(event.target.value)
              })),
              placeholder: "Weight %"
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1030,
              columnNumber: 13
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("button", { type: "submit", className: "button", children: "Add" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1044,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1004,
          columnNumber: 11
        }, this),
        targetError ? /* @__PURE__ */ jsxDEV("p", { className: "form-error", children: targetError }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1049,
          columnNumber: 26
        }, this) : null,
        targetRows.length > 0 && /* @__PURE__ */ jsxDEV(Fragment, { children: [
          /* @__PURE__ */ jsxDEV("div", { className: "drift-summary", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "drift-stat drift-stat--over", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-num", children: driftSummary.over }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1055,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-label", children: "Over" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1056,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1054,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "drift-stat drift-stat--under", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-num", children: driftSummary.under }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1059,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-label", children: "Under" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1060,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1058,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "drift-stat drift-stat--ontrack", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-num", children: driftSummary.onTrack }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1063,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-label", children: "On track" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1064,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1062,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "drift-stat", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-num", children: formatPercent(driftSummary.totalDeviation) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1067,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "drift-stat-label", children: "Total drift" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1068,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1066,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1053,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "drift-controls", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "chip-group", children: ["all", "over", "under", "ontrack"].map(
              (s) => /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: `chip ${targetStatusFilter === s ? "chip--active" : ""}`,
                  onClick: () => setTargetStatusFilter(s),
                  children: s === "all" ? "All" : s === "over" ? "Over" : s === "under" ? "Under" : "On track"
                },
                s,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1075,
                  columnNumber: 17
                },
                this
              )
            ) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1073,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                className: "drift-sort",
                value: targetSort,
                onChange: (e) => setTargetSort(e.target.value),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "drift", children: "Sort: Drift" }, void 0, false, {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 1090,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "name", children: "Sort: Name" }, void 0, false, {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 1091,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "weight", children: "Sort: Weight" }, void 0, false, {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 1092,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1085,
                columnNumber: 17
              },
              this
            ),
            targetRows.length > 3 && /* @__PURE__ */ jsxDEV(
              "input",
              {
                className: "target-filter",
                value: targetFilter,
                onChange: (e) => setTargetFilter(e.target.value),
                placeholder: "Search..."
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1095,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1072,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1052,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "target-list", children: targetRows.length === 0 ? /* @__PURE__ */ jsxDEV("p", { className: "muted-note", children: "No targets yet. Add sector or ticker targets." }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1108,
          columnNumber: 13
        }, this) : targetRows.filter((row) => !targetFilter || row.key.toLowerCase().includes(targetFilter.toLowerCase())).filter((row) => {
          if (targetStatusFilter === "all") return true;
          if (targetStatusFilter === "over") return row.drift > 5e-3;
          if (targetStatusFilter === "under") return row.drift < -5e-3;
          return Math.abs(row.drift) <= 5e-3;
        }).sort((a, b) => {
          if (targetSort === "drift") return b.absDrift - a.absDrift;
          if (targetSort === "name") return a.key.localeCompare(b.key);
          return b.targetWeight - a.targetWeight;
        }).map((row) => {
          const scale = Math.max(row.currentWeight, row.targetWeight, 0.01) * 1.1;
          const currentPct = row.currentWeight / scale * 100;
          const targetPct = row.targetWeight / scale * 100;
          return /* @__PURE__ */ jsxDEV("div", { className: `drift-card drift-card--${row.status}`, children: [
            /* @__PURE__ */ jsxDEV("div", { className: "drift-row-top", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "drift-key", children: [
                /* @__PURE__ */ jsxDEV("strong", { children: row.key }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1131,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "drift-badge", children: row.mode }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1132,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1130,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "drift-percentages", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "drift-current-num", children: formatPercent(row.currentWeight) }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1135,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "drift-arrow", children: "→" }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1136,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "drift-target-num", children: formatPercent(row.targetWeight) }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1137,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1134,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: "drift-remove",
                  onClick: () => removeTarget(row.id),
                  "aria-label": "Remove target",
                  children: "×"
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1139,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1129,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "drift-track-combined", children: [
              /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: `drift-fill-current ${row.drift >= 0 ? "drift-fill--over" : "drift-fill--under"}`,
                  style: { width: `${currentPct}%` }
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1149,
                  columnNumber: 23
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "drift-target-marker",
                  style: { left: `${targetPct}%` },
                  title: `Target ${formatPercent(row.targetWeight)}`
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1153,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1148,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "drift-row-bottom", children: [
              /* @__PURE__ */ jsxDEV("span", { className: `drift-action-tag ${row.gapValue > 0 ? "buy" : "sell"}`, children: [
                row.gapValue > 0 ? "BUY" : "SELL",
                " ",
                formatCurrency(Math.abs(row.gapValue))
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1160,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: `drift-delta ${row.drift >= 0 ? "negative" : "positive"}`, children: [
                row.drift >= 0 ? "▲" : "▼",
                " ",
                formatPercent(Math.abs(row.drift))
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1163,
                columnNumber: 23
              }, this),
              row.mode === "ticker" && row.shares > 0 && /* @__PURE__ */ jsxDEV("span", { className: "drift-shares", children: [
                "~",
                row.shares.toFixed(0),
                " sh"
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1167,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1159,
              columnNumber: 21
            }, this)
          ] }, row.id, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1128,
            columnNumber: 17
          }, this);
        }) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1106,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 996,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("article", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Rebalance" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1180,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Suggested actions" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1181,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1179,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: [
            rebalanceSuggestions.length,
            " action",
            rebalanceSuggestions.length === 1 ? "" : "s"
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1183,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1178,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "muted-note", children: cashMessage }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1185,
          columnNumber: 11
        }, this),
        rebalanceSuggestions.length === 0 ? /* @__PURE__ */ jsxDEV("p", { className: "muted-note", children: "No major drift detected from current targets." }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1187,
          columnNumber: 11
        }, this) : /* @__PURE__ */ jsxDEV("div", { className: "action-groups", children: [
          buySuggestions.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "action-group", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "action-group-header", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "action-group-label buy", children: "BUY" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1193,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "action-group-total", children: formatCurrency(buySuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0)) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1194,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1192,
              columnNumber: 19
            }, this),
            buySuggestions.map(
              (item) => /* @__PURE__ */ jsxDEV(ActionRow, { item, kind: "buy", total: portfolio.totalValue }, item.id, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1199,
                columnNumber: 15
              }, this)
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1191,
            columnNumber: 13
          }, this),
          sellSuggestions.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "action-group", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "action-group-header", children: [
              /* @__PURE__ */ jsxDEV("span", { className: "action-group-label sell", children: "SELL" }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1206,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "action-group-total", children: formatCurrency(sellSuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0)) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1207,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1205,
              columnNumber: 19
            }, this),
            sellSuggestions.map(
              (item) => /* @__PURE__ */ jsxDEV(ActionRow, { item, kind: "sell", total: portfolio.totalValue }, item.id, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1212,
                columnNumber: 15
              }, this)
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1204,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1189,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1177,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 995,
      columnNumber: 7
    }, this),
    page === "income" && /* @__PURE__ */ jsxDEV("section", { className: "insight-grid", children: [
      /* @__PURE__ */ jsxDEV("article", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Cash" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1227,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Available cash" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1228,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1226,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: "Reflected in portfolio" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1230,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1225,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("form", { className: "cash-section", onSubmit: saveCashBuckets, children: [
          /* @__PURE__ */ jsxDEV("div", { className: "cash-grid", children: /* @__PURE__ */ jsxDEV(
            Field,
            {
              label: "Cash amount",
              type: "number",
              min: 0,
              step: "0.01",
              value: String(cashDraft.available),
              onChange: (value) => setCashDraft({ available: Number(value) })
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1234,
              columnNumber: 15
            },
            this
          ) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1233,
            columnNumber: 13
          }, this),
          cashError ? /* @__PURE__ */ jsxDEV("p", { className: "form-error", children: cashError }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1245,
            columnNumber: 26
          }, this) : null,
          /* @__PURE__ */ jsxDEV("div", { className: "form-actions", children: /* @__PURE__ */ jsxDEV("button", { type: "submit", className: "button button-primary", children: "Update cash" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1247,
            columnNumber: 15
          }, this) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1246,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1232,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1224,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("article", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Dividends" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1257,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Income tracking" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1258,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1256,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: "Auto-fetched from PSX" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1260,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1255,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "suggestion-list", children: upcomingDividends.length === 0 ? /* @__PURE__ */ jsxDEV("p", { className: "muted-note", children: "Click Refresh prices to fetch dividend data." }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1264,
          columnNumber: 13
        }, this) : upcomingDividends.map(
          (holding) => /* @__PURE__ */ jsxDEV("div", { className: "suggestion-row", children: [
            /* @__PURE__ */ jsxDEV("strong", { children: holding.ticker }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1268,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: [
              "DPS: ",
              formatCurrency(holding.dividendPerShare)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1269,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("small", { children: [
              "Annual income ",
              formatCurrency(holding.shares * holding.dividendPerShare),
              holding.payoutDate ? ` · Book closure ${holding.payoutDate}` : ""
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1270,
              columnNumber: 19
            }, this)
          ] }, holding.id, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1267,
            columnNumber: 13
          }, this)
        ) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1262,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1254,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("article", { className: "panel insight-grid-span", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Calendar" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1283,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Expected dividend payments" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1284,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1282,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: [
            formatCompactCurrency(dividendCalendar.total),
            " over next 12 months"
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1286,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1281,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(DividendCalendarChart, { cells: dividendCalendar.cells }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1290,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1280,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1223,
      columnNumber: 7
    }, this),
    page === "overview" && /* @__PURE__ */ jsxDEV("section", { className: "insight-grid dual", children: [
      /* @__PURE__ */ jsxDEV("article", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Waterfall" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1300,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "P/L contribution" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1301,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1299,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: "Biggest impact positions" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1303,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1298,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "waterfall-list waterfall-list--centered", children: waterfallRows.length === 0 ? /* @__PURE__ */ jsxDEV("p", { className: "muted-note", children: "No positions to evaluate yet." }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1307,
          columnNumber: 13
        }, this) : waterfallRows.map((holding) => {
          const pct = Math.abs(holding.gainLoss) / maxWaterfall * 50;
          const isPos = holding.gainLoss >= 0;
          const contribution = Math.abs(portfolio.totalGainLoss) > 0 ? holding.gainLoss / Math.abs(portfolio.totalGainLoss) * 100 : 0;
          return /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "waterfall-row",
              title: `${holding.ticker}: ${formatCurrency(holding.gainLoss)} · ${formatSignedPercent(contribution, 1)} of total P&L`,
              children: [
                /* @__PURE__ */ jsxDEV("strong", { children: holding.ticker }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1322,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "waterfall-track waterfall-track--centered", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "waterfall-zero" }, void 0, false, {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 1324,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "span",
                    {
                      className: `waterfall-bar waterfall-bar--centered ${isPos ? "positive" : "negative"}`,
                      style: isPos ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/dev/psx/src/App.tsx",
                      lineNumber: 1325,
                      columnNumber: 23
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1323,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "span",
                  {
                    className: `waterfall-value ${isPos ? "positive" : "negative"}`,
                    children: [
                      formatCurrency(holding.gainLoss),
                      /* @__PURE__ */ jsxDEV("small", { children: formatSignedPercent(contribution, 1) }, void 0, false, {
                        fileName: "C:/dev/psx/src/App.tsx",
                        lineNumber: 1338,
                        columnNumber: 23
                      }, this)
                    ]
                  },
                  void 0,
                  true,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 1334,
                    columnNumber: 21
                  },
                  this
                )
              ]
            },
            holding.id,
            true,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1317,
              columnNumber: 17
            },
            this
          );
        }) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1305,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1297,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("article", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Top movers" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1350,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Daily change watch" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1351,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1349,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: "Live from PSX" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1353,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1348,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "suggestion-list", children: topMovers.length === 0 ? /* @__PURE__ */ jsxDEV("p", { className: "muted-note", children: "No mover data yet." }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1357,
          columnNumber: 13
        }, this) : topMovers.map(
          (holding) => /* @__PURE__ */ jsxDEV("div", { className: "suggestion-row", children: [
            /* @__PURE__ */ jsxDEV("strong", { children: holding.ticker }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1361,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: holding.dayChangePct >= 0 ? "positive" : "negative", children: [
              holding.dayChangePct.toFixed(2),
              "%"
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1362,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("small", { children: holding.name }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1365,
              columnNumber: 19
            }, this)
          ] }, holding.id, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1360,
            columnNumber: 13
          }, this)
        ) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1355,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1347,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1296,
      columnNumber: 7
    }, this),
    page === "holdings" && /* @__PURE__ */ jsxDEV("section", { className: "panel table-panel", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Holdings" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1378,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("h2", { children: "Portfolio breakdown" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1379,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1377,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(
          "input",
          {
            type: "text",
            className: "holdings-search",
            placeholder: "Search ticker, name, sector...",
            value: holdingsSearch,
            onChange: (e) => setHoldingsSearch(e.target.value)
          },
          void 0,
          false,
          {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1381,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1376,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "table-wrap", children: /* @__PURE__ */ jsxDEV("table", { children: [
        /* @__PURE__ */ jsxDEV("thead", { children: /* @__PURE__ */ jsxDEV("tr", { children: [
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Ticker", sortKey: "ticker", sort: holdingsSort, onClick: toggleSort }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1394,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Name", sortKey: "name", sort: holdingsSort, onClick: toggleSort }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1395,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Sector", sortKey: "sector", sort: holdingsSort, onClick: toggleSort }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1396,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Shares", sortKey: "shares", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1397,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Avg price", sortKey: "costBasis", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1398,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Current price", sortKey: "price", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1399,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Day %", sortKey: "dayChangePct", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1400,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Div yield", sortKey: "divYield", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1401,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Market value", sortKey: "marketValue", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1402,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "Weight", sortKey: "weight", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1403,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "P&L today", sortKey: "pnlToday", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1404,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(SortHeader, { label: "P&L total", sortKey: "gainLoss", sort: holdingsSort, onClick: toggleSort, align: "right" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1405,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("th", { className: "right", children: "Action" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1406,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1393,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1392,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("tbody", { children: sortedHoldings.length === 0 ? /* @__PURE__ */ jsxDEV("tr", { children: /* @__PURE__ */ jsxDEV("td", { colSpan: 14, className: "empty-state", children: holdingsSearch ? "No matches." : "Import a CSV or load sample data to populate the dashboard." }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1412,
          columnNumber: 19
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1411,
          columnNumber: 15
        }, this) : sortedHoldings.map((holding) => {
          const syntheticCash = holding.id.startsWith("cash-");
          return /* @__PURE__ */ jsxDEV("tr", { children: [
            /* @__PURE__ */ jsxDEV("td", { children: holding.ticker }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1421,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: holding.name }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1422,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { children: holding.sector }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1423,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: holding.shares.toLocaleString() }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1424,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: formatCurrency(holding.costBasis) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1425,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: formatCurrency(holding.price) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1426,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: `right ${holding.dayChangePct >= 0 ? "positive" : "negative"}`, children: syntheticCash ? "-" : `${holding.dayChangePct.toFixed(2)}%` }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1429,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: syntheticCash || holding.costBasis <= 0 || holding.dividendPerShare <= 0 ? "-" : `${(holding.dividendPerShare / holding.costBasis * 100).toFixed(2)}%` }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1432,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: formatCurrency(holding.marketValue) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1437,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: formatPercent(holding.weight) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1438,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("td", { className: `right ${holding.dayChangePct >= 0 ? "positive" : "negative"}`, children: syntheticCash ? "-" : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              formatCurrency(holding.marketValue * holding.dayChangePct / (100 + holding.dayChangePct)),
              /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1443,
                columnNumber: 29
              }, this),
              /* @__PURE__ */ jsxDEV("small", { children: [
                holding.dayChangePct >= 0 ? "+" : "",
                holding.dayChangePct.toFixed(2),
                "%"
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1444,
                columnNumber: 29
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1441,
              columnNumber: 23
            }, this) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1439,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV(
              "td",
              {
                className: `right ${holding.gainLoss >= 0 ? "positive" : "negative"}`,
                children: [
                  formatCurrency(holding.gainLoss),
                  !syntheticCash && holding.costValue > 0 && /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
                      fileName: "C:/dev/psx/src/App.tsx",
                      lineNumber: 1454,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("small", { children: [
                      holding.gainLoss >= 0 ? "+" : "",
                      (holding.gainLoss / holding.costValue * 100).toFixed(2),
                      "%"
                    ] }, void 0, true, {
                      fileName: "C:/dev/psx/src/App.tsx",
                      lineNumber: 1455,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 1453,
                    columnNumber: 23
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1448,
                columnNumber: 23
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("td", { className: "right", children: syntheticCash ? "-" : /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: "remove-button",
                onClick: () => removeHolding(holding.id),
                children: "Remove"
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1463,
                columnNumber: 23
              },
              this
            ) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1459,
              columnNumber: 23
            }, this)
          ] }, holding.id, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1420,
            columnNumber: 19
          }, this);
        }) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1409,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1391,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1390,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1375,
      columnNumber: 7
    }, this),
    page === "invest" && /* @__PURE__ */ jsxDEV(Fragment, { children: [
      /* @__PURE__ */ jsxDEV("section", { className: "invest-summary", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "invest-stat", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-num", children: formatCurrency(investmentSummary.totalInvested) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1486,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-label", children: "Total invested" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1487,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1485,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "invest-stat", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-num", children: formatCurrency(investmentSummary.latestValue) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1490,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-label", children: "Latest value" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1491,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1489,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "invest-stat", children: [
          /* @__PURE__ */ jsxDEV("span", { className: `invest-stat-num ${investmentSummary.pnlValue >= 0 ? "positive" : "negative"}`, children: [
            investmentSummary.pnlValue >= 0 ? "+" : "",
            formatCurrency(investmentSummary.pnlValue)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1494,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-label", children: "P&L" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1497,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1493,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "invest-stat", children: [
          /* @__PURE__ */ jsxDEV("span", { className: `invest-stat-num ${investmentSummary.pnlPct >= 0 ? "positive" : "negative"}`, children: [
            investmentSummary.pnlPct >= 0 ? "+" : "",
            investmentSummary.pnlPct.toFixed(2),
            "%"
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1500,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-label", title: "Cumulative P&L over total deployed; ignores deposit timing.", children: "Cumulative %" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1503,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1499,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "invest-stat", children: [
          /* @__PURE__ */ jsxDEV("span", { className: `invest-stat-num ${investmentSummary.xirrPct >= 0 ? "positive" : "negative"}`, children: investmentSummary.count >= 2 ? `${investmentSummary.xirrPct >= 0 ? "+" : ""}${investmentSummary.xirrPct.toFixed(2)}%` : "—" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1508,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "invest-stat-label", title: "Money-weighted return (XIRR): annualized rate that discounts each cashflow to today's value. Industry standard for personal investing performance.", children: "Annualized (XIRR)" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1513,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1507,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1484,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("section", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Investment tracker" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1522,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("h2", { children: "Add installment" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1523,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1521,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "panel-meta", children: [
            investmentSummary.count,
            " entries"
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1525,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1520,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("form", { className: "invest-form", onSubmit: addInvestment, children: [
          /* @__PURE__ */ jsxDEV("label", { className: "field", children: [
            /* @__PURE__ */ jsxDEV("span", { children: "Date" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1529,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "date",
                value: investDraft.date,
                onChange: (e) => setInvestDraft((c) => ({ ...c, date: e.target.value }))
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1530,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1528,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("label", { className: "field", children: [
            /* @__PURE__ */ jsxDEV("span", { children: "Label" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1537,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "text",
                placeholder: "e.g. Month 1",
                value: investDraft.label,
                onChange: (e) => setInvestDraft((c) => ({ ...c, label: e.target.value }))
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1538,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1536,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("label", { className: "field", children: [
            /* @__PURE__ */ jsxDEV("span", { children: "Amount (+/-)" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1546,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "number",
                step: "0.01",
                placeholder: "0",
                value: investDraft.amount === 0 ? "" : investDraft.amount,
                onChange: (e) => setInvestDraft((c) => ({ ...c, amount: Number(e.target.value) }))
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1547,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1545,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("label", { className: "field", children: [
            /* @__PURE__ */ jsxDEV("span", { children: [
              "Value EOM",
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: "invest-fill-current",
                  onClick: () => setInvestDraft((c) => ({ ...c, valueEom: portfolio.totalValue })),
                  title: "Fill with current portfolio total value",
                  children: "Use current"
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1558,
                  columnNumber: 17
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1556,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "number",
                step: "0.01",
                min: 0,
                placeholder: "0",
                value: investDraft.valueEom === 0 ? "" : investDraft.valueEom,
                onChange: (e) => setInvestDraft((c) => ({ ...c, valueEom: Number(e.target.value) }))
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1567,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1555,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("button", { type: "submit", className: "button button-primary invest-form-add", children: "Add" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1576,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1527,
          columnNumber: 11
        }, this),
        investError ? /* @__PURE__ */ jsxDEV("p", { className: "form-error", children: investError }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1578,
          columnNumber: 26
        }, this) : null
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1519,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("section", { className: "panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Chart" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1584,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("h2", { children: "Total & Value EOM" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1585,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1583,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1582,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(InvestmentChart, { rows: investmentRows }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1588,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1581,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("section", { className: "panel table-panel", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "panel-header", children: /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("p", { className: "panel-kicker", children: "Entries" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1594,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("h2", { children: "Installment ledger" }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1595,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1593,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1592,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "table-scroll", children: /* @__PURE__ */ jsxDEV("table", { className: "holdings-table", children: [
          /* @__PURE__ */ jsxDEV("thead", { children: /* @__PURE__ */ jsxDEV("tr", { children: [
            /* @__PURE__ */ jsxDEV("th", { children: "Date" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1602,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { children: "Label" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1603,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { className: "right", children: "Amount" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1604,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { className: "right", children: "Total" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1605,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { className: "right", children: "Value EOM" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1606,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { className: "right", children: "P&L" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1607,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { className: "right", children: "P&L %" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1608,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("th", { className: "right", children: "Action" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1609,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1601,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1600,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("tbody", { children: investmentRows.length === 0 ? /* @__PURE__ */ jsxDEV("tr", { children: /* @__PURE__ */ jsxDEV("td", { colSpan: 8, className: "empty-state", children: "No entries yet. Add an installment above to start tracking." }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1615,
            columnNumber: 21
          }, this) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1614,
            columnNumber: 17
          }, this) : investmentRows.map(
            (row) => /* @__PURE__ */ jsxDEV("tr", { children: [
              /* @__PURE__ */ jsxDEV("td", { children: row.date }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1622,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { children: row.label }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1623,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { className: `right ${row.amount >= 0 ? "" : "negative"}`, children: formatCurrency(row.amount) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1624,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { className: "right", children: formatCurrency(row.total) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1627,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { className: "right", children: formatCurrency(row.valueEom) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1628,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { className: `right ${row.pnlValue >= 0 ? "positive" : "negative"}`, children: [
                row.pnlValue >= 0 ? "+" : "",
                formatCurrency(row.pnlValue)
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1629,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { className: `right ${row.pnlPct >= 0 ? "positive" : "negative"}`, children: [
                row.pnlPct >= 0 ? "+" : "",
                row.pnlPct.toFixed(2),
                "%"
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1632,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("td", { className: "right", children: /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: "remove-button",
                  onClick: () => removeInvestment(row.id),
                  children: "Remove"
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1636,
                  columnNumber: 25
                },
                this
              ) }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1635,
                columnNumber: 23
              }, this)
            ] }, row.id, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1621,
              columnNumber: 17
            }, this)
          ) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 1612,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1599,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1598,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1591,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1483,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 720,
    columnNumber: 5
  }, this);
}
_s(App, "nMun/gxBxcAfGvpI4d/sIRrtY+Y=");
_c = App;
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step
}) {
  return /* @__PURE__ */ jsxDEV("label", { className: "field", children: [
    /* @__PURE__ */ jsxDEV("span", { children: label }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1678,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      "input",
      {
        type,
        min,
        max,
        step,
        value,
        placeholder,
        onChange: (event) => onChange(event.target.value)
      },
      void 0,
      false,
      {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1679,
        columnNumber: 7
      },
      this
    )
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 1677,
    columnNumber: 5
  }, this);
}
_c2 = Field;
function loadHoldings() {
  if (typeof window === "undefined") {
    return sampleHoldings.map(normalizeHolding);
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return sampleHoldings.map(normalizeHolding);
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeHolding) : sampleHoldings.map(normalizeHolding);
  } catch {
    return sampleHoldings.map(normalizeHolding);
  }
}
function loadCashBuckets() {
  if (typeof window === "undefined") {
    return emptyCashBuckets;
  }
  const raw = window.localStorage.getItem(cashStorageKey);
  if (!raw) {
    return emptyCashBuckets;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      available: Number(parsed.available ?? 0)
    };
  } catch {
    return emptyCashBuckets;
  }
}
function loadTargets() {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(targetStorageKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function loadInvestments() {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(investStorageKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function loadHistory() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(historyStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function pkParts(now) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday
  };
}
function psxCloseStatus(now = /* @__PURE__ */ new Date()) {
  const p = pkParts(now);
  const isWeekday = !["Sat", "Sun"].includes(p.weekday);
  const afterClose = p.hour > 15 || p.hour === 15 && p.minute >= 30;
  return { isWeekday, afterClose, pkDate: p.date };
}
function pkDateOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return pkParts(d).date;
}
function normalizeHolding(holding) {
  return {
    ...holding,
    dayChangePct: Number(holding.dayChangePct ?? 0),
    dividendPerShare: Number(holding.dividendPerShare ?? 0),
    payoutDate: holding.payoutDate ?? ""
  };
}
function isCashHolding(h) {
  if (h.id?.startsWith("cash-")) return true;
  const ticker = (h.ticker ?? "").trim().toUpperCase();
  const sector = (h.sector ?? "").trim().toLowerCase();
  return ticker === "CASH" || sector === "cash";
}
function buildHoldingsWithCash(holdings, cash) {
  const nonCash = holdings.filter((holding) => !holding.id.startsWith("cash-"));
  if (cash.available <= 0) return nonCash;
  const cashPosition = {
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
    payoutDate: ""
  };
  return [cashPosition, ...nonCash];
}
function buildSectorBuckets(holdings) {
  const map = /* @__PURE__ */ new Map();
  for (const holding of holdings) {
    const current = map.get(holding.sector) ?? {
      sector: holding.sector,
      value: 0,
      weight: 0,
      holdings: 0
    };
    current.value += holding.marketValue;
    current.weight += holding.weight;
    current.holdings += 1;
    map.set(holding.sector, current);
  }
  return [...map.values()].sort((left, right) => right.value - left.value);
}
function getCashDeploymentIdea(cashWeight) {
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
  tone = "neutral"
}) {
  return /* @__PURE__ */ jsxDEV("article", { className: `stat-card ${tone}`, children: [
    /* @__PURE__ */ jsxDEV("p", { children: label }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1904,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("strong", { children: value }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1905,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("span", { children: detail }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1906,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 1903,
    columnNumber: 5
  }, this);
}
_c3 = StatCard;
function PieChart({
  holdings
}) {
  _s2();
  const [hovered, setHovered] = useState(null);
  const pad = 12;
  const size = 280;
  const stroke = 32;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0
  );
  let dashOffset = 0;
  if (totalValue === 0) {
    return /* @__PURE__ */ jsxDEV("div", { className: "chart-empty", children: "No holdings yet" }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1929,
      columnNumber: 12
    }, this);
  }
  const hoveredHolding = hovered !== null ? holdings[hovered] : null;
  return /* @__PURE__ */ jsxDEV("div", { className: "pie-layout", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "donut-container", children: [
      /* @__PURE__ */ jsxDEV(
        "svg",
        {
          viewBox: `${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`,
          className: "pie-chart",
          role: "img",
          "aria-label": "Portfolio allocation chart",
          onMouseLeave: () => setHovered(null),
          children: [
            /* @__PURE__ */ jsxDEV("circle", { cx: size / 2, cy: size / 2, r: radius, className: "pie-base" }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1944,
              columnNumber: 11
            }, this),
            holdings.map((holding, index) => {
              const dashLength = holding.weight * circumference;
              const currentOffset = dashOffset;
              dashOffset += dashLength;
              const isHovered = hovered === index;
              const isDimmed = hovered !== null && !isHovered;
              return /* @__PURE__ */ jsxDEV(
                "circle",
                {
                  cx: size / 2,
                  cy: size / 2,
                  r: radius,
                  className: `pie-slice ${isHovered ? "pie-slice--active" : ""} ${isDimmed ? "pie-slice--dim" : ""}`,
                  style: {
                    strokeDasharray: `${dashLength} ${circumference - dashLength}`,
                    strokeDashoffset: -currentOffset,
                    ["--slice-color"]: getSliceColor(index)
                  },
                  onMouseEnter: () => setHovered(index)
                },
                holding.ticker,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 1952,
                  columnNumber: 15
                },
                this
              );
            })
          ]
        },
        void 0,
        true,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1937,
          columnNumber: 9
        },
        this
      ),
      hoveredHolding ? /* @__PURE__ */ jsxDEV("div", { className: "donut-center", children: [
        /* @__PURE__ */ jsxDEV("strong", { children: hoveredHolding.ticker }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1972,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { children: formatCurrency(hoveredHolding.marketValue) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1973,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("small", { children: formatPercent(hoveredHolding.weight) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1974,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1971,
        columnNumber: 9
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "donut-center", children: [
        /* @__PURE__ */ jsxDEV("strong", { children: "Total" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1978,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { children: formatCurrency(totalValue) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1979,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("small", { children: [
          holdings.length,
          " positions"
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1980,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 1977,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1936,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "pie-legend", children: holdings.slice(0, 8).map(
      (holding, index) => /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: `legend-row ${hovered === index ? "legend-row--active" : ""} ${hovered !== null && hovered !== index ? "legend-row--dim" : ""}`,
          onMouseEnter: () => setHovered(index),
          onMouseLeave: () => setHovered(null),
          children: [
            /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: "legend-swatch",
                style: { background: getSliceColor(index) }
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1993,
                columnNumber: 13
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("strong", { children: holding.ticker }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1998,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: [
                formatPercent(holding.weight),
                " of portfolio"
              ] }, void 0, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 1999,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 1997,
              columnNumber: 13
            }, this)
          ]
        },
        holding.ticker,
        true,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 1987,
          columnNumber: 9
        },
        this
      )
    ) }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 1985,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 1935,
    columnNumber: 5
  }, this);
}
_s2(PieChart, "mEhKvegbaT+HE5gyL2KiZdVDWeQ=");
_c4 = PieChart;
function getSliceColor(index) {
  const palette = [
    "#4cc9f0",
    "#5eead4",
    "#f97316",
    "#facc15",
    "#a78bfa",
    "#f472b6",
    "#38bdf8",
    "#34d399"
  ];
  return palette[index % palette.length];
}
function Combobox({
  value,
  onChange,
  options,
  placeholder
}) {
  _s3();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const filtered = options.filter(
    (o) => !value ? true : o.toLowerCase().includes(value.toLowerCase())
  );
  return /* @__PURE__ */ jsxDEV("div", { className: "combobox", ref, children: [
    /* @__PURE__ */ jsxDEV(
      "input",
      {
        value,
        onChange: (e) => {
          onChange(e.target.value);
          setOpen(true);
        },
        onFocus: () => setOpen(true),
        placeholder,
        autoComplete: "off"
      },
      void 0,
      false,
      {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2050,
        columnNumber: 7
      },
      this
    ),
    open && filtered.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "combobox-list", children: filtered.slice(0, 50).map(
      (opt) => /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          className: `combobox-option ${opt === value ? "combobox-option--active" : ""}`,
          onMouseDown: (e) => {
            e.preventDefault();
            onChange(opt);
            setOpen(false);
          },
          children: opt
        },
        opt,
        false,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2063,
          columnNumber: 9
        },
        this
      )
    ) }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2061,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2049,
    columnNumber: 5
  }, this);
}
_s3(Combobox, "wl9VvfhnMVWQ+kCekFjcRPEi3/0=");
_c5 = Combobox;
function SortHeader({
  label,
  sortKey,
  sort,
  onClick,
  align
}) {
  const active = sort.key === sortKey;
  const arrow = active ? sort.dir === "asc" ? " ▲" : " ▼" : "";
  return /* @__PURE__ */ jsxDEV("th", { className: align === "right" ? "right sortable" : "sortable", children: /* @__PURE__ */ jsxDEV("button", { type: "button", className: "sort-btn", onClick: () => onClick(sortKey), children: [
    label,
    /* @__PURE__ */ jsxDEV("span", { className: "sort-arrow", children: arrow }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2101,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2099,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2098,
    columnNumber: 5
  }, this);
}
_c6 = SortHeader;
function ActionRow({
  item,
  kind,
  total
}) {
  const impact = total > 0 ? Math.abs(item.gapValue) / total * 100 : 0;
  return /* @__PURE__ */ jsxDEV("div", { className: `action-row action-row--${kind}`, children: [
    /* @__PURE__ */ jsxDEV("div", { className: "action-row-main", children: [
      /* @__PURE__ */ jsxDEV("strong", { children: item.key }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2130,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "action-row-mode", children: item.mode }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2131,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "action-row-amount", children: formatCurrency(Math.abs(item.gapValue)) }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2132,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2129,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "action-row-detail", children: [
      /* @__PURE__ */ jsxDEV("span", { children: [
        formatPercent(item.currentWeight),
        " → ",
        formatPercent(item.targetWeight)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2135,
        columnNumber: 9
      }, this),
      item.mode === "ticker" && item.shares > 0 && /* @__PURE__ */ jsxDEV("span", { children: [
        "~",
        item.shares.toFixed(0),
        " sh @ ",
        formatCurrency(item.price)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2139,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "action-row-impact", children: [
        impact.toFixed(1),
        "% of book"
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2141,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2134,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2128,
    columnNumber: 5
  }, this);
}
_c7 = ActionRow;
const HISTORY_SERIES_META = {
  value: { label: "Market value", color: "#e4ecff" },
  cost: { label: "Cost basis", color: "#fbbf24", dashed: true },
  twr: { label: "True return (TWR)", color: "#5eead4" }
};
function PortfolioHistoryChart({
  snapshots,
  lastFetchedIso
}) {
  _s4();
  const [viewMode, setViewMode] = useState("value");
  const [hiddenSeries, setHiddenSeries] = useState(
    () => /* @__PURE__ */ new Set()
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
  const visibleKeys = useMemo(() => {
    const keys = viewMode === "value" ? ["value", "cost"] : ["twr"];
    return keys.filter((k) => !hiddenSeries.has(k));
  }, [viewMode, hiddenSeries]);
  const chart = useMemo(() => {
    if (snapshots.length < 2) return null;
    const values = snapshots.map((s) => s.totalValue);
    const costs = snapshots.map((s) => s.totalCost);
    const seriesByKey = {
      value: values,
      cost: costs,
      twr: twrIndex.map((v) => v - 100)
    };
    const allVisible = visibleKeys.flatMap((k) => seriesByKey[k]);
    const hi = Math.max(...allVisible);
    const lo = Math.min(...allVisible, viewMode === "twr" ? 0 : hi);
    const span = hi - lo || 1;
    const yHi = hi + span * 0.08;
    const yLo = viewMode === "twr" ? lo - span * 0.08 : Math.max(0, lo - span * 0.08);
    const xOf = (i) => padL + (snapshots.length === 1 ? innerW / 2 : i / (snapshots.length - 1) * innerW);
    const yOf = (v) => padT + innerH - (v - yLo) / (yHi - yLo) * innerH;
    const pointsByKey = {
      value: values.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
      cost: costs.map((v, i) => ({ x: xOf(i), y: yOf(v) })),
      twr: seriesByKey.twr.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
    };
    const tickValues = niceTicks(yLo, yHi, 5);
    return {
      seriesByKey,
      pointsByKey,
      yLo,
      yHi,
      xOf,
      yOf,
      tickValues
    };
  }, [snapshots, twrIndex, visibleKeys, viewMode, innerH, innerW]);
  const { containerRef, svgRef, hover, handlers } = useChartHover({
    pointCount: snapshots.length,
    plotLeft: padL,
    plotRight: padR,
    viewBoxWidth: W
  });
  const containerWidth = containerRef.current?.clientWidth ?? 600;
  function toggleSeries(key) {
    setHiddenSeries((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else
        next.add(key);
      return next;
    });
  }
  if (snapshots.length < 2 || !chart) {
    return /* @__PURE__ */ jsxDEV("div", { className: "chart-empty", children: "Refresh prices after PSX close (15:30 PKT) on 2+ weekdays to chart value over time." }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2254,
      columnNumber: 7
    }, this);
  }
  const labelEvery = Math.max(1, Math.ceil(snapshots.length / 6));
  const formatY = (v) => viewMode === "twr" ? formatSignedPercent(v, 1) : formatCompactCurrency(v);
  const hoveredIdx = hover?.index ?? null;
  const lastSnap = snapshots[snapshots.length - 1];
  const firstSnap = snapshots[0];
  const valueChange = lastSnap.totalValue - firstSnap.totalValue;
  const valueChangePct = firstSnap.totalValue > 0 ? valueChange / firstSnap.totalValue * 100 : 0;
  const twrCumulative = twrIndex[twrIndex.length - 1] - 100;
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      ref: containerRef,
      className: "line-chart",
      "data-view-mode": viewMode,
      children: [
        /* @__PURE__ */ jsxDEV("div", { className: "line-chart-header", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "line-chart-summary", children: viewMode === "value" ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV("strong", { children: formatCurrency(lastSnap.totalValue) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2284,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: valueChange >= 0 ? "positive" : "negative",
                children: [
                  valueChange >= 0 ? "+" : "",
                  formatCurrency(valueChange),
                  " (",
                  formatSignedPercent(valueChangePct, 2),
                  ")"
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2285,
                columnNumber: 15
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 2283,
            columnNumber: 11
          }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV("strong", { className: twrCumulative >= 0 ? "positive" : "negative", children: formatSignedPercent(twrCumulative, 2) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2294,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "muted", children: [
              "deposit-neutral return over ",
              snapshots.length,
              " snapshots"
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2297,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 2293,
            columnNumber: 11
          }, this) }, void 0, false, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 2281,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "line-chart-controls", children: [
            lastFetchedIso ? /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: "line-chart-stale",
                title: formatDateLong(lastFetchedIso),
                children: [
                  "Updated ",
                  formatRelativeTime(lastFetchedIso)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2303,
                columnNumber: 11
              },
              this
            ) : null,
            /* @__PURE__ */ jsxDEV("div", { className: "chip-group", children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: `chip ${viewMode === "value" ? "chip--active" : ""}`,
                  onClick: () => setViewMode("value"),
                  children: "Value"
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2311,
                  columnNumber: 13
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: `chip ${viewMode === "twr" ? "chip--active" : ""}`,
                  onClick: () => setViewMode("twr"),
                  children: "True return %"
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2318,
                  columnNumber: 13
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2310,
              columnNumber: 11
            }, this)
          ] }, void 0, true, {
            fileName: "C:/dev/psx/src/App.tsx",
            lineNumber: 2301,
            columnNumber: 9
          }, this)
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2280,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "line-chart-legend", children: (viewMode === "value" ? ["value", "cost"] : ["twr"]).map((key) => {
          const meta = HISTORY_SERIES_META[key];
          const hidden = hiddenSeries.has(key);
          return /* @__PURE__ */ jsxDEV(
            "button",
            {
              type: "button",
              className: `line-chart-legend-item ${hidden ? "line-chart-legend-item--off" : ""}`,
              onClick: () => toggleSeries(key),
              "aria-pressed": !hidden,
              children: [
                /* @__PURE__ */ jsxDEV(
                  "span",
                  {
                    className: "line-chart-legend-swatch",
                    style: {
                      background: meta.dashed ? "transparent" : meta.color,
                      borderColor: meta.color,
                      borderStyle: meta.dashed ? "dashed" : "solid"
                    }
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 2344,
                    columnNumber: 15
                  },
                  this
                ),
                meta.label
              ]
            },
            key,
            true,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2337,
              columnNumber: 13
            },
            this
          );
        }) }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2329,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "line-chart-svg-wrap", children: [
          /* @__PURE__ */ jsxDEV(
            "svg",
            {
              ref: svgRef,
              viewBox: `0 0 ${W} ${H}`,
              className: "line-chart-svg",
              preserveAspectRatio: "none",
              role: "img",
              "aria-label": "Portfolio history line chart",
              ...handlers,
              children: [
                chart.tickValues.map(
                  (v, i) => /* @__PURE__ */ jsxDEV("g", { children: [
                    /* @__PURE__ */ jsxDEV(
                      "line",
                      {
                        className: "line-chart-grid",
                        x1: padL,
                        x2: W - padR,
                        y1: chart.yOf(v),
                        y2: chart.yOf(v)
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/dev/psx/src/App.tsx",
                        lineNumber: 2370,
                        columnNumber: 15
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      "text",
                      {
                        className: "line-chart-axis",
                        x: padL - 10,
                        y: chart.yOf(v) + 4,
                        textAnchor: "end",
                        children: formatY(v)
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/dev/psx/src/App.tsx",
                        lineNumber: 2377,
                        columnNumber: 15
                      },
                      this
                    )
                  ] }, `y-${i}`, true, {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 2369,
                    columnNumber: 11
                  }, this)
                ),
                viewMode === "twr" ? /* @__PURE__ */ jsxDEV(
                  "line",
                  {
                    className: "line-chart-zero",
                    x1: padL,
                    x2: W - padR,
                    y1: chart.yOf(0),
                    y2: chart.yOf(0)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 2389,
                    columnNumber: 11
                  },
                  this
                ) : null,
                visibleKeys.includes("value") && viewMode === "value" ? /* @__PURE__ */ jsxDEV(
                  "path",
                  {
                    className: "line-chart-area",
                    d: `${buildCatmullRomPath(chart.pointsByKey.value)} L ${chart.pointsByKey.value[chart.pointsByKey.value.length - 1].x} ${chart.yOf(chart.yLo)} L ${chart.pointsByKey.value[0].x} ${chart.yOf(chart.yLo)} Z`
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 2399,
                    columnNumber: 11
                  },
                  this
                ) : null,
                visibleKeys.map((key) => {
                  const meta = HISTORY_SERIES_META[key];
                  const pts = chart.pointsByKey[key];
                  return /* @__PURE__ */ jsxDEV(
                    "path",
                    {
                      className: "line-chart-line",
                      d: buildCatmullRomPath(pts),
                      stroke: meta.color,
                      strokeDasharray: meta.dashed ? "4 4" : void 0,
                      strokeWidth: key === "value" || key === "twr" ? 2.4 : 1.6
                    },
                    `line-${key}`,
                    false,
                    {
                      fileName: "C:/dev/psx/src/App.tsx",
                      lineNumber: 2409,
                      columnNumber: 15
                    },
                    this
                  );
                }),
                snapshots.map((s, i) => {
                  if (i % labelEvery !== 0 && i !== snapshots.length - 1) return null;
                  return /* @__PURE__ */ jsxDEV(
                    "text",
                    {
                      className: "line-chart-axis",
                      x: chart.xOf(i),
                      y: H - padB + 22,
                      textAnchor: "middle",
                      children: formatDateShort(s.date)
                    },
                    `xl-${i}`,
                    false,
                    {
                      fileName: "C:/dev/psx/src/App.tsx",
                      lineNumber: 2423,
                      columnNumber: 15
                    },
                    this
                  );
                }),
                hoveredIdx !== null ? /* @__PURE__ */ jsxDEV("g", { pointerEvents: "none", children: [
                  /* @__PURE__ */ jsxDEV(
                    "line",
                    {
                      className: "line-chart-crosshair",
                      x1: chart.xOf(hoveredIdx),
                      x2: chart.xOf(hoveredIdx),
                      y1: padT,
                      y2: H - padB
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/dev/psx/src/App.tsx",
                      lineNumber: 2437,
                      columnNumber: 15
                    },
                    this
                  ),
                  visibleKeys.map((key) => {
                    const meta = HISTORY_SERIES_META[key];
                    const p = chart.pointsByKey[key][hoveredIdx];
                    return /* @__PURE__ */ jsxDEV(
                      "circle",
                      {
                        className: "line-chart-hover-dot",
                        cx: p.x,
                        cy: p.y,
                        r: 5,
                        fill: meta.color
                      },
                      `hd-${key}`,
                      false,
                      {
                        fileName: "C:/dev/psx/src/App.tsx",
                        lineNumber: 2448,
                        columnNumber: 17
                      },
                      this
                    );
                  })
                ] }, void 0, true, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2436,
                  columnNumber: 11
                }, this) : null
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2359,
              columnNumber: 9
            },
            this
          ),
          hoveredIdx !== null && hover ? /* @__PURE__ */ jsxDEV(
            ChartTooltip,
            {
              x: hover.containerX,
              y: hover.containerY,
              containerWidth,
              title: formatDateLong(snapshots[hoveredIdx].date),
              rows: (viewMode === "value" ? [
                {
                  label: "Market value",
                  value: formatCurrency(snapshots[hoveredIdx].totalValue),
                  color: HISTORY_SERIES_META.value.color
                },
                {
                  label: "Cost basis",
                  value: formatCurrency(snapshots[hoveredIdx].totalCost),
                  color: HISTORY_SERIES_META.cost.color
                },
                {
                  label: "Unrealized P&L",
                  value: formatCurrency(snapshots[hoveredIdx].gainLoss)
                }
              ] : [
                {
                  label: "TWR cumulative",
                  value: formatSignedPercent(
                    chart.seriesByKey.twr[hoveredIdx],
                    2
                  ),
                  color: HISTORY_SERIES_META.twr.color
                },
                {
                  label: "Market value",
                  value: formatCurrency(snapshots[hoveredIdx].totalValue)
                },
                {
                  label: "Cost basis",
                  value: formatCurrency(snapshots[hoveredIdx].totalCost)
                }
              ]).map((r) => ({ ...r }))
            },
            void 0,
            false,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2463,
              columnNumber: 9
            },
            this
          ) : null
        ] }, void 0, true, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2358,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2275,
      columnNumber: 5
    },
    this
  );
}
_s4(PortfolioHistoryChart, "3y1aSS+5WMVVKBalXPrT0/NIzOg=", false, function() {
  return [useChartHover];
});
_c8 = PortfolioHistoryChart;
const INVEST_SERIES_META = {
  total: { label: "Capital deployed", color: "#5ea5ea" },
  value: { label: "Portfolio value", color: "#e4ecff" }
};
function InvestmentChart({ rows }) {
  _s5();
  const [hiddenSeries, setHiddenSeries] = useState(
    () => /* @__PURE__ */ new Set()
  );
  const W = 800;
  const H = 320;
  const padL = 78;
  const padR = 24;
  const padT = 24;
  const padB = 52;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const visibleKeys = useMemo(
    () => ["total", "value"].filter((k) => !hiddenSeries.has(k)),
    [hiddenSeries]
  );
  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const totals = rows.map((r) => r.total);
    const values = rows.map((r) => r.valueEom);
    const seriesByKey = {
      total: totals,
      value: values
    };
    const visibleSeries = visibleKeys.flatMap((k) => seriesByKey[k]);
    const hi = Math.max(...visibleSeries, 0);
    const lo = Math.min(...visibleSeries, 0);
    const span = hi - lo || 1;
    const yHi = hi + span * 0.08;
    const yLo = Math.max(0, lo - span * 0.04);
    const xOf = (i) => padL + (rows.length === 1 ? innerW / 2 : i / (rows.length - 1) * innerW);
    const yOf = (v) => padT + innerH - (v - yLo) / (yHi - yLo) * innerH;
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
      xOf
    };
  }, [rows, visibleKeys, innerH, innerW]);
  const { containerRef, svgRef, hover, handlers } = useChartHover({
    pointCount: rows.length,
    plotLeft: padL,
    plotRight: padR,
    viewBoxWidth: W
  });
  function toggleSeries(key) {
    setHiddenSeries((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else
        next.add(key);
      return next;
    });
  }
  if (rows.length < 2 || !chart) {
    return /* @__PURE__ */ jsxDEV("div", { className: "chart-empty", children: "Add at least 2 investment entries to see chart." }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2618,
      columnNumber: 7
    }, this);
  }
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
  const hoveredIdx = hover?.index ?? null;
  const containerWidth = containerRef.current?.clientWidth ?? 600;
  return /* @__PURE__ */ jsxDEV("div", { ref: containerRef, className: "line-chart", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "line-chart-legend", children: ["total", "value"].map((key) => {
      const meta = INVEST_SERIES_META[key];
      const hidden = hiddenSeries.has(key);
      return /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          className: `line-chart-legend-item ${hidden ? "line-chart-legend-item--off" : ""}`,
          onClick: () => toggleSeries(key),
          "aria-pressed": !hidden,
          children: [
            /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: "line-chart-legend-swatch",
                style: { background: meta.color, borderColor: meta.color }
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2642,
                columnNumber: 15
              },
              this
            ),
            meta.label
          ]
        },
        key,
        true,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2635,
          columnNumber: 13
        },
        this
      );
    }) }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2630,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "line-chart-svg-wrap", children: [
      /* @__PURE__ */ jsxDEV(
        "svg",
        {
          ref: svgRef,
          viewBox: `0 0 ${W} ${H}`,
          className: "line-chart-svg",
          preserveAspectRatio: "none",
          role: "img",
          "aria-label": "Investment growth chart",
          ...handlers,
          children: [
            chart.tickValues.map(
              (v, i) => /* @__PURE__ */ jsxDEV("g", { children: [
                /* @__PURE__ */ jsxDEV(
                  "line",
                  {
                    className: "line-chart-grid",
                    x1: padL,
                    x2: W - padR,
                    y1: chart.yOf(v),
                    y2: chart.yOf(v)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 2664,
                    columnNumber: 15
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  "text",
                  {
                    className: "line-chart-axis",
                    x: padL - 10,
                    y: chart.yOf(v) + 4,
                    textAnchor: "end",
                    children: formatCompactCurrency(v)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/dev/psx/src/App.tsx",
                    lineNumber: 2671,
                    columnNumber: 15
                  },
                  this
                )
              ] }, `y-${i}`, true, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2663,
                columnNumber: 11
              }, this)
            ),
            visibleKeys.includes("total") ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("path", { className: "line-chart-step-fill", d: chart.stepArea }, void 0, false, {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2684,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV(
                "path",
                {
                  className: "line-chart-step",
                  d: chart.stepPath,
                  stroke: INVEST_SERIES_META.total.color
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2685,
                  columnNumber: 15
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2683,
              columnNumber: 11
            }, this) : null,
            visibleKeys.includes("value") ? /* @__PURE__ */ jsxDEV(
              "path",
              {
                className: "line-chart-line",
                d: chart.valuePath,
                stroke: INVEST_SERIES_META.value.color,
                strokeWidth: 2.4
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2694,
                columnNumber: 11
              },
              this
            ) : null,
            rows.map((r, i) => {
              if (i % labelEvery !== 0 && i !== rows.length - 1) return null;
              return /* @__PURE__ */ jsxDEV(
                "text",
                {
                  className: "line-chart-axis",
                  x: chart.xOf(i),
                  y: H - padB + 22,
                  textAnchor: "middle",
                  children: formatDateShort(r.date)
                },
                `xl-${r.id}`,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2705,
                  columnNumber: 15
                },
                this
              );
            }),
            hoveredIdx !== null ? /* @__PURE__ */ jsxDEV("g", { pointerEvents: "none", children: [
              /* @__PURE__ */ jsxDEV(
                "line",
                {
                  className: "line-chart-crosshair",
                  x1: chart.xOf(hoveredIdx),
                  x2: chart.xOf(hoveredIdx),
                  y1: padT,
                  y2: H - padB
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2719,
                  columnNumber: 15
                },
                this
              ),
              visibleKeys.includes("total") ? /* @__PURE__ */ jsxDEV(
                "circle",
                {
                  className: "line-chart-hover-dot",
                  cx: chart.totalPoints[hoveredIdx].x,
                  cy: chart.totalPoints[hoveredIdx].y,
                  r: 5,
                  fill: INVEST_SERIES_META.total.color
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2727,
                  columnNumber: 13
                },
                this
              ) : null,
              visibleKeys.includes("value") ? /* @__PURE__ */ jsxDEV(
                "circle",
                {
                  className: "line-chart-hover-dot",
                  cx: chart.valuePoints[hoveredIdx].x,
                  cy: chart.valuePoints[hoveredIdx].y,
                  r: 5,
                  fill: INVEST_SERIES_META.value.color
                },
                void 0,
                false,
                {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2736,
                  columnNumber: 13
                },
                this
              ) : null
            ] }, void 0, true, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2718,
              columnNumber: 11
            }, this) : null
          ]
        },
        void 0,
        true,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2653,
          columnNumber: 9
        },
        this
      ),
      hoveredIdx !== null && hover ? /* @__PURE__ */ jsxDEV(
        ChartTooltip,
        {
          x: hover.containerX,
          y: hover.containerY,
          containerWidth,
          title: `${formatDateLong(rows[hoveredIdx].date)} · ${rows[hoveredIdx].label}`,
          rows: [
            {
              label: "Capital deployed",
              value: formatCurrency(rows[hoveredIdx].total),
              color: INVEST_SERIES_META.total.color
            },
            {
              label: "Portfolio value",
              value: formatCurrency(rows[hoveredIdx].valueEom),
              color: INVEST_SERIES_META.value.color
            },
            {
              label: "P&L",
              value: `${rows[hoveredIdx].pnlValue >= 0 ? "+" : ""}${formatCurrency(rows[hoveredIdx].pnlValue)} (${formatSignedPercent(rows[hoveredIdx].pnlPct, 2)})`
            },
            {
              label: "Entry amount",
              value: rows[hoveredIdx].amount === 0 ? "—" : `${rows[hoveredIdx].amount > 0 ? "+" : ""}${formatCurrency(rows[hoveredIdx].amount)}`
            }
          ]
        },
        void 0,
        false,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2749,
          columnNumber: 9
        },
        this
      ) : null
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2652,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2629,
    columnNumber: 5
  }, this);
}
_s5(InvestmentChart, "JIH6A0urJNEbKjeqcypZlKyh+kg=", false, function() {
  return [useChartHover];
});
_c9 = InvestmentChart;
function RankedAllocation({
  items
}) {
  if (items.length === 0) {
    return /* @__PURE__ */ jsxDEV("div", { className: "chart-empty", children: "No data" }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2790,
      columnNumber: 12
    }, this);
  }
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const top = sorted[0]?.weight || 1;
  return /* @__PURE__ */ jsxDEV("div", { className: "ranked-allocation", children: sorted.map((item, i) => {
    const widthPct = item.weight / top * 100;
    return /* @__PURE__ */ jsxDEV("div", { className: "ranked-row", children: [
      /* @__PURE__ */ jsxDEV("span", { className: "ranked-rank", children: i + 1 }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2800,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("strong", { className: "ranked-label", children: item.label }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2801,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "ranked-track", children: /* @__PURE__ */ jsxDEV(
        "span",
        {
          className: "ranked-fill",
          style: {
            width: `${widthPct}%`,
            background: getSliceColor(i)
          }
        },
        void 0,
        false,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2803,
          columnNumber: 15
        },
        this
      ) }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2802,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "ranked-weight", children: formatPercent(item.weight) }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2811,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "ranked-value", children: formatCompactCurrency(item.value) }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2812,
        columnNumber: 13
      }, this)
    ] }, item.key, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2799,
      columnNumber: 11
    }, this);
  }) }, void 0, false, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2795,
    columnNumber: 5
  }, this);
}
_c0 = RankedAllocation;
function DividendCalendarChart({ cells }) {
  _s6();
  const [hovered, setHovered] = useState(null);
  const containerRef = useRef(null);
  const max = cells.reduce((m, c) => Math.max(m, c.total), 0);
  if (max === 0) {
    return /* @__PURE__ */ jsxDEV("div", { className: "chart-empty", children: "No dividend payout dates yet. Refresh prices to populate the calendar." }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2836,
      columnNumber: 7
    }, this);
  }
  const containerWidth = containerRef.current?.clientWidth ?? 600;
  const hoveredCell = hovered !== null ? cells[hovered] : null;
  return /* @__PURE__ */ jsxDEV("div", { ref: containerRef, className: "dividend-calendar", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "dividend-calendar-bars", children: cells.map((cell, i) => {
      const heightPct = max > 0 ? cell.total / max * 100 : 0;
      return /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          className: `dividend-bar ${cell.total === 0 ? "dividend-bar--empty" : ""} ${hovered === i ? "dividend-bar--active" : ""}`,
          onPointerEnter: () => setHovered(i),
          onPointerLeave: () => setHovered(null),
          onFocus: () => setHovered(i),
          onBlur: () => setHovered(null),
          "aria-label": `${cell.label}: ${formatCurrency(cell.total)}`,
          children: [
            /* @__PURE__ */ jsxDEV("span", { className: "dividend-bar-track", children: /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: "dividend-bar-fill",
                style: { height: `${heightPct}%` }
              },
              void 0,
              false,
              {
                fileName: "C:/dev/psx/src/App.tsx",
                lineNumber: 2862,
                columnNumber: 17
              },
              this
            ) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2861,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "dividend-bar-amount", children: cell.total === 0 ? "—" : formatCompactCurrency(cell.total) }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2867,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "dividend-bar-label", children: cell.label }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2870,
              columnNumber: 15
            }, this)
          ]
        },
        cell.key,
        true,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 2851,
          columnNumber: 13
        },
        this
      );
    }) }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2847,
      columnNumber: 7
    }, this),
    hoveredCell && hoveredCell.entries.length > 0 ? /* @__PURE__ */ jsxDEV(
      ChartTooltip,
      {
        x: containerWidth / 2,
        y: 20,
        containerWidth,
        title: `${hoveredCell.label} · ${formatCurrency(hoveredCell.total)}`,
        rows: hoveredCell.entries.map((entry) => ({
          label: `${entry.ticker} · ${formatDateShort(entry.date)}`,
          value: formatCurrency(entry.amount)
        }))
      },
      void 0,
      false,
      {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2877,
        columnNumber: 7
      },
      this
    ) : null
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2846,
    columnNumber: 5
  }, this);
}
_s6(DividendCalendarChart, "ZJJYmKOREJbYWTqE9gOuLXCp1Sk=");
_c1 = DividendCalendarChart;
function Treemap({
  items
}) {
  if (items.length === 0) {
    return /* @__PURE__ */ jsxDEV("div", { className: "chart-empty", children: "No data" }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 2898,
      columnNumber: 12
    }, this);
  }
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const rows = [];
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
          const aspect = rowFraction > 0 ? w / rowFraction : 1;
          return Math.max(aspect, 1 / (aspect || 1));
        })
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
  return /* @__PURE__ */ jsxDEV("div", { className: "treemap-container", children: /* @__PURE__ */ jsxDEV("div", { className: "treemap-grid", children: rows.map((row, ri) => {
    const rowWeight = row.reduce((s, r) => s + r.weight, 0);
    return /* @__PURE__ */ jsxDEV(
      "div",
      {
        className: "treemap-row",
        style: { flexGrow: rowWeight, flexShrink: 1, flexBasis: 0 },
        children: row.map((item) => {
          const ci = colorIdx++;
          const widthPct = item.weight / rowWeight * 100;
          return /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "treemap-block",
              style: {
                "--tree-color": getSliceColor(ci),
                width: `${widthPct}%`
              },
              title: `${item.label}: ${formatCurrency(item.value)} (${formatPercent(item.weight)})`,
              children: [
                /* @__PURE__ */ jsxDEV("strong", { children: item.label }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2965,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("span", { children: formatPercent(item.weight) }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2966,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("small", { children: formatCurrency(item.value) }, void 0, false, {
                  fileName: "C:/dev/psx/src/App.tsx",
                  lineNumber: 2967,
                  columnNumber: 21
                }, this)
              ]
            },
            item.key,
            true,
            {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 2954,
              columnNumber: 19
            },
            this
          );
        })
      },
      ri,
      false,
      {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 2945,
        columnNumber: 13
      },
      this
    );
  }) }, void 0, false, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2941,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 2940,
    columnNumber: 5
  }, this);
}
_c10 = Treemap;
function StockSearch({
  onSelect,
  selected,
  onClear
}) {
  _s7();
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    fetch("/api/psx/stocks").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setStocks(data);
    }).catch(() => {
    });
  }, []);
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const q = query.toUpperCase();
  const filtered = query.length > 0 ? stocks.filter(
    (s) => s.ticker.includes(q) || s.name.toUpperCase().includes(q)
  ).slice(0, 8) : [];
  if (selected) {
    return /* @__PURE__ */ jsxDEV("label", { className: "field stock-search-field", children: [
      /* @__PURE__ */ jsxDEV("span", { children: "Stock" }, void 0, false, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 3028,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "stock-selected", children: [
        /* @__PURE__ */ jsxDEV("span", { children: selected }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 3030,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("button", { type: "button", className: "stock-clear", onClick: onClear, children: "×" }, void 0, false, {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 3031,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 3029,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 3027,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("label", { className: "field stock-search-field", ref: wrapRef, children: [
    /* @__PURE__ */ jsxDEV("span", { children: "Search stock" }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 3041,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      "input",
      {
        value: query,
        onChange: (e) => {
          setQuery(e.target.value);
          setOpen(true);
        },
        onFocus: () => query.length > 0 && setOpen(true),
        placeholder: "Type ticker or company name...",
        autoComplete: "off"
      },
      void 0,
      false,
      {
        fileName: "C:/dev/psx/src/App.tsx",
        lineNumber: 3042,
        columnNumber: 7
      },
      this
    ),
    open && filtered.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "stock-dropdown", children: filtered.map(
      (s) => /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          className: "stock-option",
          onClick: () => {
            onSelect(s);
            setQuery("");
            setOpen(false);
          },
          children: [
            /* @__PURE__ */ jsxDEV("strong", { children: s.ticker }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 3065,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: s.name }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 3066,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("small", { children: s.sector }, void 0, false, {
              fileName: "C:/dev/psx/src/App.tsx",
              lineNumber: 3067,
              columnNumber: 15
            }, this)
          ]
        },
        s.ticker,
        true,
        {
          fileName: "C:/dev/psx/src/App.tsx",
          lineNumber: 3055,
          columnNumber: 9
        },
        this
      )
    ) }, void 0, false, {
      fileName: "C:/dev/psx/src/App.tsx",
      lineNumber: 3053,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/dev/psx/src/App.tsx",
    lineNumber: 3040,
    columnNumber: 5
  }, this);
}
_s7(StockSearch, "8L+F/hk2Yovf2OUyGNSTrIadE10=");
_c11 = StockSearch;
export default App;
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1, _c10, _c11;
$RefreshReg$(_c, "App");
$RefreshReg$(_c2, "Field");
$RefreshReg$(_c3, "StatCard");
$RefreshReg$(_c4, "PieChart");
$RefreshReg$(_c5, "Combobox");
$RefreshReg$(_c6, "SortHeader");
$RefreshReg$(_c7, "ActionRow");
$RefreshReg$(_c8, "PortfolioHistoryChart");
$RefreshReg$(_c9, "InvestmentChart");
$RefreshReg$(_c0, "RankedAllocation");
$RefreshReg$(_c1, "DividendCalendarChart");
$RefreshReg$(_c10, "Treemap");
$RefreshReg$(_c11, "StockSearch");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/dev/psx/src/App.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/dev/psx/src/App.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBK3JCVSxTQWtJcUIsVUFsSXJCOzs7Ozs7Ozs7Ozs7Ozs7OztBQS9yQlYsU0FBU0EsV0FBV0MsU0FBU0MsUUFBUUMsZ0JBQWdCO0FBRXJEO0FBQUEsRUFDRUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsT0FDSztBQUNQO0FBQUEsRUFDRUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsT0FDSztBQUNQLFNBQVNDLGlCQUFpQkMsZ0JBQWdCQyx1QkFBdUI7QUFDakUsU0FBU0MsdUJBQXVCQywyQkFBMkI7QUFpRTNELE1BQU1DLGlCQUFpQixHQUFHWCxVQUFVO0FBQ3BDLE1BQU1ZLG1CQUFtQixHQUFHWixVQUFVO0FBQ3RDLE1BQU1hLG1CQUFtQixHQUFHYixVQUFVO0FBQ3RDLE1BQU1jLG9CQUFvQixHQUFHZCxVQUFVO0FBRXZDLE1BQU1lLGFBQTJCO0FBQUEsRUFDL0JDLFFBQVE7QUFBQSxFQUNSQyxNQUFNO0FBQUEsRUFDTkMsUUFBUTtBQUFBLEVBQ1JDLFFBQVE7QUFBQSxFQUNSQyxPQUFPO0FBQUEsRUFDUEMsV0FBVztBQUFBLEVBQ1hDLGNBQWM7QUFBQSxFQUNkQyxrQkFBa0I7QUFBQSxFQUNsQkMsWUFBWTtBQUNkO0FBRUEsTUFBTUMsbUJBQWdDO0FBQUEsRUFDcENDLFdBQVc7QUFDYjtBQUVBLE1BQU1DLG1CQUFnQztBQUFBLEVBQ3BDQyxNQUFNO0FBQUEsRUFDTkMsS0FBSztBQUFBLEVBQ0xDLGlCQUFpQjtBQUNuQjtBQUVBLE1BQU1DLHVCQUF3QztBQUFBLEVBQzVDQyxNQUFNO0FBQUEsRUFDTkMsT0FBTztBQUFBLEVBQ1BDLFFBQVE7QUFBQSxFQUNSQyxVQUFVO0FBQ1o7QUFFQSxTQUFTQyxNQUFNO0FBQUFDLEtBQUE7QUFDYixRQUFNLENBQUNDLFVBQVVDLFdBQVcsSUFBSXBELFNBQW9CLE1BQU1xRCxhQUFhLENBQUM7QUFDeEUsUUFBTSxDQUFDQyxPQUFPQyxRQUFRLElBQUl2RCxTQUF1QjRCLFVBQVU7QUFDM0QsUUFBTSxDQUFDNEIsV0FBV0MsWUFBWSxJQUFJekQsU0FBc0IsTUFBTTBELGdCQUFnQixDQUFDO0FBQy9FLFFBQU0sQ0FBQ0MsU0FBU0MsVUFBVSxJQUFJNUQsU0FBNkIsTUFBTTZELFlBQVksQ0FBQztBQUM5RSxRQUFNLENBQUNDLGFBQWFDLGNBQWMsSUFBSS9ELFNBQXNCd0MsZ0JBQWdCO0FBQzVFLFFBQU0sQ0FBQ3dCLGNBQWNDLGVBQWUsSUFBSWpFLFNBQVMsRUFBRTtBQUNuRCxRQUFNLENBQUNrRSxvQkFBb0JDLHFCQUFxQixJQUFJbkUsU0FBK0MsS0FBSztBQUN4RyxRQUFNLENBQUNvRSxZQUFZQyxhQUFhLElBQUlyRSxTQUFzQyxPQUFPO0FBQ2pGLFFBQU0sQ0FBQ3NFLGFBQWFDLGNBQWMsSUFBSXZFLFNBQThCLFFBQVE7QUFDNUUsUUFBTSxDQUFDd0UsZ0JBQWdCQyxpQkFBaUIsSUFBSXpFLFNBQTJCLEtBQUs7QUFDNUUsUUFBTSxDQUFDMEUsTUFBTUMsT0FBTyxJQUFJM0UsU0FBb0UsVUFBVTtBQUN0RyxRQUFNLENBQUM0RSxhQUFhQyxjQUFjLElBQUk3RSxTQUE0QixNQUFNOEUsZ0JBQWdCLENBQUM7QUFDekYsUUFBTSxDQUFDQyxhQUFhQyxjQUFjLElBQUloRixTQUEwQjRDLG9CQUFvQjtBQUNwRixRQUFNLENBQUNxQyxhQUFhQyxjQUFjLElBQUlsRixTQUFTLEVBQUU7QUFDakQsUUFBTSxDQUFDbUYsU0FBU0MsVUFBVSxJQUFJcEYsU0FBOEIsTUFBTXFGLFlBQVksQ0FBQztBQUMvRSxRQUFNLENBQUNDLGdCQUFnQkMsaUJBQWlCLElBQUl2RixTQUFTLEVBQUU7QUFDdkQsUUFBTSxDQUFDd0YsY0FBY0MsZUFBZSxJQUFJekYsU0FBd0Q7QUFBQSxJQUM5RjBDLEtBQUs7QUFBQSxJQUNMZ0QsS0FBSztBQUFBLEVBQ1AsQ0FBQztBQUVELFFBQU0sQ0FBQ0MsVUFBVUMsV0FBVyxJQUFJNUYsU0FBUyxLQUFLO0FBQzlDLFFBQU0sQ0FBQzZGLGVBQWVDLGdCQUFnQixJQUFJOUYsU0FBd0IsSUFBSTtBQUN0RSxRQUFNLENBQUMrRixZQUFZQyxhQUFhLElBQUloRyxTQUFTLEVBQUU7QUFDL0MsUUFBTSxDQUFDaUcsV0FBV0MsWUFBWSxJQUFJbEcsU0FBUyxFQUFFO0FBQzdDLFFBQU0sQ0FBQ21HLGFBQWFDLGNBQWMsSUFBSXBHLFNBQVMsRUFBRTtBQUVqREgsWUFBVSxNQUFNO0FBQ2R3RyxXQUFPQyxhQUFhQyxRQUFRMUYsWUFBWTJGLEtBQUtDLFVBQVV0RCxRQUFRLENBQUM7QUFBQSxFQUNsRSxHQUFHLENBQUNBLFFBQVEsQ0FBQztBQUVidEQsWUFBVSxNQUFNO0FBQ2R3RyxXQUFPQyxhQUFhQyxRQUFRL0UsZ0JBQWdCZ0YsS0FBS0MsVUFBVWpELFNBQVMsQ0FBQztBQUFBLEVBQ3ZFLEdBQUcsQ0FBQ0EsU0FBUyxDQUFDO0FBRWQzRCxZQUFVLE1BQU07QUFDZHdHLFdBQU9DLGFBQWFDLFFBQVE5RSxrQkFBa0IrRSxLQUFLQyxVQUFVOUMsT0FBTyxDQUFDO0FBQUEsRUFDdkUsR0FBRyxDQUFDQSxPQUFPLENBQUM7QUFFWjlELFlBQVUsTUFBTTtBQUNkd0csV0FBT0MsYUFBYUMsUUFBUTdFLGtCQUFrQjhFLEtBQUtDLFVBQVU3QixXQUFXLENBQUM7QUFBQSxFQUMzRSxHQUFHLENBQUNBLFdBQVcsQ0FBQztBQUVoQi9FLFlBQVUsTUFBTTtBQUNkd0csV0FBT0MsYUFBYUMsUUFBUTVFLG1CQUFtQjZFLEtBQUtDLFVBQVV0QixPQUFPLENBQUM7QUFBQSxFQUN4RSxHQUFHLENBQUNBLE9BQU8sQ0FBQztBQUVaLFFBQU11QixjQUFjM0csT0FBTyxLQUFLO0FBQ2hDRixZQUFVLE1BQU07QUFDZCxRQUFJOEcsWUFBWTtBQUNoQixLQUFDLFlBQVk7QUFDWCxZQUFNQyxPQUFPLE1BQU10RixzQkFBc0I7QUFDekMsVUFBSXFGLGFBQWEsQ0FBQ0MsTUFBTTtBQUN0QkYsb0JBQVlHLFVBQVU7QUFDdEI7QUFBQSxNQUNGO0FBQ0EsVUFBSUMsTUFBTUMsUUFBUUgsS0FBS3pELFFBQVEsRUFBR0MsYUFBWXdELEtBQUt6RCxRQUFxQjtBQUN4RSxVQUFJeUQsS0FBS0ksUUFBUSxPQUFPSixLQUFLSSxTQUFTLFNBQVV2RCxjQUFhbUQsS0FBS0ksSUFBbUI7QUFDckYsVUFBSUYsTUFBTUMsUUFBUUgsS0FBS2pELE9BQU8sRUFBR0MsWUFBV2dELEtBQUtqRCxPQUE2QjtBQUM5RSxVQUFJbUQsTUFBTUMsUUFBUUgsS0FBS2hDLFdBQVcsRUFBR0MsZ0JBQWUrQixLQUFLaEMsV0FBZ0M7QUFDekYsVUFBSWtDLE1BQU1DLFFBQVFILEtBQUt6QixPQUFPLEVBQUdDLFlBQVd3QixLQUFLekIsT0FBOEI7QUFDL0V1QixrQkFBWUcsVUFBVTtBQUFBLElBQ3hCLEdBQUc7QUFDSCxXQUFPLE1BQU07QUFDWEYsa0JBQVk7QUFBQSxJQUNkO0FBQUEsRUFDRixHQUFHLEVBQUU7QUFFTDlHLFlBQVUsTUFBTTtBQUNkLFFBQUksQ0FBQzZHLFlBQVlHLFFBQVM7QUFDMUJ0Rix3QkFBb0I7QUFBQSxNQUNsQjRCO0FBQUFBLE1BQ0E2RCxNQUFNeEQ7QUFBQUEsTUFDTkc7QUFBQUEsTUFDQWlCO0FBQUFBLE1BQ0FPO0FBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0gsR0FBRyxDQUFDaEMsVUFBVUssV0FBV0csU0FBU2lCLGFBQWFPLE9BQU8sQ0FBQztBQUV2RCxRQUFNOEIsbUJBQW1Cbkg7QUFBQUEsSUFDdkIsTUFBTW9ILHNCQUFzQi9ELFVBQVVLLFNBQVM7QUFBQSxJQUMvQyxDQUFDTCxVQUFVSyxTQUFTO0FBQUEsRUFDdEI7QUFFQSxRQUFNMkQsWUFBWXJIO0FBQUFBLElBQ2hCLE1BQU1HLGlCQUFpQmdILGdCQUFnQjtBQUFBLElBQ3ZDLENBQUNBLGdCQUFnQjtBQUFBLEVBQ25CO0FBQ0EsUUFBTUcsVUFBVXRIO0FBQUFBLElBQ2QsTUFBTXVILG1CQUFtQkYsVUFBVWhFLFFBQVE7QUFBQSxJQUMzQyxDQUFDZ0UsVUFBVWhFLFFBQVE7QUFBQSxFQUNyQjtBQUVBLFFBQU1tRSxtQkFBbUJILFVBQVVoRSxTQUFTb0U7QUFBQUEsSUFDMUMsQ0FBQ0MsWUFBWUEsUUFBUXpGLE9BQU8wRixZQUFZLE1BQU07QUFBQSxFQUNoRDtBQUVBLFFBQU1DLGFBQWFQLFVBQVVoRSxTQUFTLENBQUM7QUFDdkMsUUFBTXdFLGFBQWFSLFVBQVVTLGFBQWEsSUFBSXBFLFVBQVVqQixZQUFZNEUsVUFBVVMsYUFBYTtBQUMzRixRQUFNQyxjQUFjQyxzQkFBc0JILFVBQVU7QUFFcEQsUUFBTUksMkJBQTJCVCxpQkFBaUJVO0FBQUFBLElBQ2hELENBQUNDLEtBQUtULFlBQVlTLE1BQU1ULFFBQVF4RixTQUFTd0YsUUFBUXBGO0FBQUFBLElBQ2pEO0FBQUEsRUFDRjtBQUNBLFFBQU04RixhQUFhWixpQkFBaUJVLE9BQU8sQ0FBQ0MsS0FBS1QsWUFBWVMsTUFBTVQsUUFBUVcsV0FBVyxDQUFDO0FBQ3ZGLFFBQU1DLGNBQWNGLGFBQWEsSUFBSUgsMkJBQTJCRyxhQUFhO0FBQzdFLFFBQU1HLG9CQUFvQixDQUFDLEdBQUdmLGdCQUFnQixFQUMzQ0MsT0FBTyxDQUFDQyxZQUFZQSxRQUFRbkYsVUFBVSxFQUN0Q2lHLEtBQUssQ0FBQ0MsTUFBTUMsVUFBVUQsS0FBS2xHLFdBQVdvRyxjQUFjRCxNQUFNbkcsVUFBVSxDQUFDLEVBQ3JFcUcsTUFBTSxHQUFHLENBQUM7QUFFYixRQUFNQyxtQkFBbUI3SSxRQUFRLE1BQU07QUFDckMsVUFBTThJLGNBQWM7QUFDcEIsVUFBTUMsTUFBTSxvQkFBSUMsS0FBSztBQUNyQixVQUFNQyxRQU9EO0FBQ0wsYUFBU0MsSUFBSSxHQUFHQSxJQUFJSixhQUFhSSxLQUFLO0FBQ3BDLFlBQU1DLElBQUksSUFBSUgsS0FBS0QsSUFBSUssWUFBWSxHQUFHTCxJQUFJTSxTQUFTLElBQUlILEdBQUcsQ0FBQztBQUMzRCxZQUFNSSxPQUFPSCxFQUFFQyxZQUFZO0FBQzNCLFlBQU1HLFFBQVFKLEVBQUVFLFNBQVM7QUFDekJKLFlBQU1PLEtBQUs7QUFBQSxRQUNUNUcsS0FBSyxHQUFHMEcsSUFBSSxJQUFJRyxPQUFPRixRQUFRLENBQUMsRUFBRUcsU0FBUyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ2xEMUcsT0FBTyxJQUFJMkcsS0FBS0MsZUFBZSxTQUFTO0FBQUEsVUFDdENMLE9BQU87QUFBQSxVQUNQRCxNQUFNO0FBQUEsUUFDUixDQUFDLEVBQUVPLE9BQU9WLENBQUM7QUFBQSxRQUNYRztBQUFBQSxRQUNBQztBQUFBQSxRQUNBTyxPQUFPO0FBQUEsUUFDUEMsU0FBUztBQUFBLE1BQ1gsQ0FBQztBQUFBLElBQ0g7QUFDQSxlQUFXckMsV0FBV0Ysa0JBQWtCO0FBQ3RDLFVBQUksQ0FBQ0UsUUFBUW5GLGNBQWNtRixRQUFRcEYsb0JBQW9CLEVBQUc7QUFDMUQsWUFBTTBILEtBQUssSUFBSWhCLEtBQUt0QixRQUFRbkYsVUFBVTtBQUN0QyxVQUFJLENBQUMwSCxPQUFPQyxTQUFTRixHQUFHRyxRQUFRLENBQUMsRUFBRztBQUNwQyxZQUFNQyxTQUFTbkIsTUFBTW9CO0FBQUFBLFFBQ25CLENBQUNDLE1BQU1BLEVBQUVoQixTQUFTVSxHQUFHWixZQUFZLEtBQUtrQixFQUFFZixVQUFVUyxHQUFHWCxTQUFTO0FBQUEsTUFDaEU7QUFDQSxVQUFJLENBQUNlLE9BQVE7QUFDYixZQUFNbkgsU0FBU3lFLFFBQVF4RixTQUFTd0YsUUFBUXBGO0FBQ3hDOEgsYUFBT04sU0FBUzdHO0FBQ2hCbUgsYUFBT0wsUUFBUVAsS0FBSztBQUFBLFFBQ2xCekgsUUFBUTJGLFFBQVEzRjtBQUFBQSxRQUNoQmtCO0FBQUFBLFFBQ0FGLE1BQU0yRSxRQUFRbkY7QUFBQUEsTUFDaEIsQ0FBQztBQUFBLElBQ0g7QUFDQSxVQUFNdUgsUUFBUWIsTUFBTWYsT0FBTyxDQUFDcUMsR0FBR0QsTUFBTUMsSUFBSUQsRUFBRVIsT0FBTyxDQUFDO0FBQ25ELFdBQU8sRUFBRWIsT0FBT2EsTUFBTTtBQUFBLEVBQ3hCLEdBQUcsQ0FBQ3RDLGdCQUFnQixDQUFDO0FBRXJCLFFBQU1nRCxrQkFBa0J4SyxRQUFRLE1BQU07QUFDcEMsVUFBTXlLLE1BQU0sb0JBQUlDLElBQW9CO0FBQ3BDLGVBQVdDLFVBQVVyRCxTQUFTO0FBQzVCbUQsVUFBSUcsSUFBSUQsT0FBTzFJLE9BQU8wRixZQUFZLEdBQUdnRCxPQUFPRSxNQUFNO0FBQUEsSUFDcEQ7QUFDQSxXQUFPSjtBQUFBQSxFQUNULEdBQUcsQ0FBQ25ELE9BQU8sQ0FBQztBQUVaLFFBQU13RCxrQkFBa0I5SyxRQUFRLE1BQU07QUFDcEMsVUFBTXlLLE1BQU0sb0JBQUlDLElBQW9CO0FBQ3BDLGVBQVdoRCxXQUFXTCxVQUFVaEUsVUFBVTtBQUN4Q29ILFVBQUlHLElBQUlsRCxRQUFRM0YsT0FBTzRGLFlBQVksR0FBR0QsUUFBUW1ELE1BQU07QUFBQSxJQUN0RDtBQUNBLFdBQU9KO0FBQUFBLEVBQ1QsR0FBRyxDQUFDcEQsVUFBVWhFLFFBQVEsQ0FBQztBQUV2QixRQUFNMEgsaUJBQWlCL0ssUUFBUSxNQUFNO0FBQ25DLFVBQU15SyxNQUFNLG9CQUFJQyxJQUFvQjtBQUNwQyxlQUFXTSxLQUFLM0QsVUFBVWhFLFVBQVU7QUFDbENvSCxVQUFJRyxJQUFJSSxFQUFFakosT0FBTzRGLFlBQVksR0FBR3FELEVBQUU3SSxLQUFLO0FBQUEsSUFDekM7QUFDQSxXQUFPc0k7QUFBQUEsRUFDVCxHQUFHLENBQUNwRCxVQUFVaEUsUUFBUSxDQUFDO0FBRXZCLFFBQU00SCxhQUFhcEgsUUFBUTRHLElBQUksQ0FBQ0wsV0FBVztBQUN6QyxVQUFNYyxTQUFTZCxPQUFPekgsU0FBUyxXQUFXNkgsa0JBQWtCTTtBQUM1RCxVQUFNSyxnQkFBZ0JELE9BQU9FLElBQUloQixPQUFPeEgsSUFBSStFLFlBQVksQ0FBQyxLQUFLO0FBQzlELFVBQU0wRCxRQUFRRixnQkFBZ0JmLE9BQU9rQjtBQUNyQyxVQUFNQyxZQUFZbkIsT0FBT2tCLGVBQWVILGlCQUFpQjlELFVBQVVTO0FBQ25FLFVBQU0wRCxXQUFXQyxLQUFLQyxJQUFJTCxLQUFLO0FBQy9CLFVBQU1NLFNBQ0pILFlBQVksT0FBTyxXQUFXQSxZQUFZLE9BQU8sYUFBYTtBQUNoRSxVQUFNckosUUFBUWlJLE9BQU96SCxTQUFTLFdBQVdvSSxlQUFlSyxJQUFJaEIsT0FBT3hILElBQUkrRSxZQUFZLENBQUMsS0FBSyxJQUFJO0FBQzdGLFVBQU16RixTQUFTQyxRQUFRLElBQUlzSixLQUFLQyxJQUFJSCxRQUFRLElBQUlwSixRQUFRO0FBRXhELFdBQU87QUFBQSxNQUNMLEdBQUdpSTtBQUFBQSxNQUNIZTtBQUFBQSxNQUNBRTtBQUFBQSxNQUNBRTtBQUFBQSxNQUNBQztBQUFBQSxNQUNBRztBQUFBQSxNQUNBeEo7QUFBQUEsTUFDQUQ7QUFBQUEsSUFDRjtBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0wSixlQUFlNUwsUUFBUSxNQUFNO0FBQ2pDLFVBQU02TCxPQUFPWixXQUFXeEQsT0FBTyxDQUFDcUUsTUFBTUEsRUFBRVQsUUFBUSxJQUFLLEVBQUVVO0FBQ3ZELFVBQU1DLFFBQVFmLFdBQVd4RCxPQUFPLENBQUNxRSxNQUFNQSxFQUFFVCxRQUFRLEtBQU0sRUFBRVU7QUFDekQsVUFBTUUsVUFBVWhCLFdBQVdjLFNBQVNGLE9BQU9HO0FBQzNDLFVBQU1FLGlCQUFpQmpCLFdBQVcvQyxPQUFPLENBQUNxQyxHQUFHdUIsTUFBTXZCLElBQUl1QixFQUFFTixVQUFVLENBQUM7QUFDcEUsV0FBTyxFQUFFSyxNQUFNRyxPQUFPQyxTQUFTQyxlQUFlO0FBQUEsRUFDaEQsR0FBRyxDQUFDakIsVUFBVSxDQUFDO0FBRWYsUUFBTWtCLHVCQUF1QmxCLFdBQzFCeEQ7QUFBQUEsSUFDQyxDQUFDMkUsUUFDQ1gsS0FBS0MsSUFBSVUsSUFBSWIsUUFBUSxJQUFJRSxLQUFLWSxJQUFJLEtBQU1oRixVQUFVUyxhQUFhLElBQUk7QUFBQSxFQUN2RSxFQUNDVSxLQUFLLENBQUNDLE1BQU1DLFVBQVUrQyxLQUFLQyxJQUFJaEQsTUFBTTZDLFFBQVEsSUFBSUUsS0FBS0MsSUFBSWpELEtBQUs4QyxRQUFRLENBQUMsRUFDeEUzQyxNQUFNLEdBQUcsQ0FBQztBQUViLFFBQU0wRCxpQkFBaUJILHFCQUFxQjFFLE9BQU8sQ0FBQ3FFLE1BQU1BLEVBQUVQLFdBQVcsQ0FBQztBQUN4RSxRQUFNZ0Isa0JBQWtCSixxQkFBcUIxRSxPQUFPLENBQUNxRSxNQUFNQSxFQUFFUCxXQUFXLENBQUM7QUFFekUsUUFBTWlCLGlCQUFpQnhNLFFBQVEsTUFBTTtBQUNuQyxVQUFNeU0sU0FBUyxDQUFDLEdBQUczSCxXQUFXLEVBQUUwRCxLQUFLLENBQUNrRSxHQUFHQyxNQUFNRCxFQUFFM0osS0FBSzRGLGNBQWNnRSxFQUFFNUosSUFBSSxDQUFDO0FBQzNFLFFBQUk2SixVQUFVO0FBQ2QsV0FBT0gsT0FBT2hDLElBQUksQ0FBQ29DLFVBQVU7QUFDM0JELGlCQUFXQyxNQUFNNUo7QUFDakIsWUFBTTZHLFFBQVE4QztBQUNkLFlBQU1FLFdBQVdELE1BQU0zSixXQUFXNEc7QUFDbEMsWUFBTWlELFNBQVNqRCxRQUFRLElBQUtnRCxXQUFXaEQsUUFBUyxNQUFNO0FBQ3RELGFBQU8sRUFBRSxHQUFHK0MsT0FBTy9DLE9BQU9nRCxVQUFVQyxPQUFPO0FBQUEsSUFDN0MsQ0FBQztBQUFBLEVBQ0gsR0FBRyxDQUFDakksV0FBVyxDQUFDO0FBRWhCLFFBQU1rSSxvQkFBb0JoTixRQUFRLE1BQU07QUFDdEMsVUFBTWlOLE9BQU9ULGVBQWVBLGVBQWVULFNBQVMsQ0FBQztBQUNyRCxVQUFNbUIsZ0JBQWdCRCxNQUFNbkQsU0FBUztBQUNyQyxVQUFNcUQsY0FBY0YsTUFBTS9KLFlBQVk7QUFDdEMsVUFBTTRKLFdBQVdLLGNBQWNEO0FBQy9CLFVBQU1ILFNBQVNHLGdCQUFnQixJQUFLSixXQUFXSSxnQkFBaUIsTUFBTTtBQUV0RSxRQUFJRSxVQUFVO0FBQ2QsUUFBSVosZUFBZVQsVUFBVSxLQUFLb0IsY0FBYyxHQUFHO0FBQ2pELFlBQU1FLFFBQVFiLGVBQ1gvRSxPQUFPLENBQUMyRSxRQUFRQSxJQUFJbkosV0FBVyxDQUFDLEVBQ2hDd0gsSUFBSSxDQUFDMkIsU0FBUztBQUFBLFFBQ2JySixNQUFNLElBQUlpRyxLQUFLb0QsSUFBSXJKLElBQUk7QUFBQSxRQUN2QkUsUUFBUSxDQUFDbUosSUFBSW5KO0FBQUFBLE1BQ2YsRUFBRTtBQUNKLFlBQU1xSyxlQUFlLElBQUl0RSxLQUFLaUUsS0FBTWxLLElBQUk7QUFDeENzSyxZQUFNN0QsS0FBSyxFQUFFekcsTUFBTXVLLGNBQWNySyxRQUFRa0ssWUFBWSxDQUFDO0FBQ3RELFlBQU1JLE9BQU92TSxLQUFLcU0sT0FBTyxHQUFHO0FBQzVCRCxnQkFBVW5ELE9BQU9DLFNBQVNxRCxJQUFJLElBQUlBLE9BQU8sTUFBTTtBQUFBLElBQ2pEO0FBRUEsV0FBTztBQUFBLE1BQ0xMO0FBQUFBLE1BQ0FDO0FBQUFBLE1BQ0FMO0FBQUFBLE1BQ0FDO0FBQUFBLE1BQ0FLO0FBQUFBLE1BQ0FJLE9BQU9oQixlQUFlVDtBQUFBQSxJQUN4QjtBQUFBLEVBQ0YsR0FBRyxDQUFDUyxjQUFjLENBQUM7QUFFbkIsUUFBTWlCLGlCQUFpQnpOLFFBQVEsTUFBTTtBQUNuQyxVQUFNME4sSUFBSWxJLGVBQWVtSSxLQUFLLEVBQUVoRyxZQUFZO0FBQzVDLFVBQU1pRyxXQUFXRixJQUNickcsVUFBVWhFLFNBQVNvRTtBQUFBQSxNQUNqQixDQUFDdUQsTUFDQ0EsRUFBRWpKLE9BQU80RixZQUFZLEVBQUVrRyxTQUFTSCxDQUFDLEtBQ2pDMUMsRUFBRWhKLEtBQUsyRixZQUFZLEVBQUVrRyxTQUFTSCxDQUFDLEtBQy9CMUMsRUFBRS9JLE9BQU8wRixZQUFZLEVBQUVrRyxTQUFTSCxDQUFDO0FBQUEsSUFDckMsSUFDQSxDQUFDLEdBQUdyRyxVQUFVaEUsUUFBUTtBQUUxQixVQUFNLEVBQUVULEtBQUtnRCxJQUFJLElBQUlGO0FBQ3JCLFFBQUksQ0FBQzlDLElBQUssUUFBT2dMO0FBRWpCLFVBQU1FLE9BQU9sSSxRQUFRLFFBQVEsSUFBSTtBQUNqQyxVQUFNbUksVUFBVUEsQ0FBQy9DLE1BQWdEO0FBQy9ELGNBQVFwSSxLQUFHO0FBQUEsUUFDVCxLQUFLO0FBQVUsaUJBQU9vSSxFQUFFako7QUFBQUEsUUFDeEIsS0FBSztBQUFRLGlCQUFPaUosRUFBRWhKO0FBQUFBLFFBQ3RCLEtBQUs7QUFBVSxpQkFBT2dKLEVBQUUvSTtBQUFBQSxRQUN4QixLQUFLO0FBQVUsaUJBQU8rSSxFQUFFOUk7QUFBQUEsUUFDeEIsS0FBSztBQUFhLGlCQUFPOEksRUFBRTVJO0FBQUFBLFFBQzNCLEtBQUs7QUFBUyxpQkFBTzRJLEVBQUU3STtBQUFBQSxRQUN2QixLQUFLO0FBQWdCLGlCQUFPNkksRUFBRTNJO0FBQUFBLFFBQzlCLEtBQUs7QUFBWSxpQkFBTzJJLEVBQUU1SSxZQUFZLElBQUs0SSxFQUFFMUksbUJBQW1CMEksRUFBRTVJLFlBQWEsTUFBTTtBQUFBLFFBQ3JGLEtBQUs7QUFBZSxpQkFBTzRJLEVBQUVnRDtBQUFBQSxRQUM3QixLQUFLO0FBQVUsaUJBQU9oRCxFQUFFSDtBQUFBQSxRQUN4QixLQUFLO0FBQVksaUJBQU9HLEVBQUVnRCxjQUFjaEQsRUFBRTNJLGdCQUFnQixNQUFNMkksRUFBRTNJLGdCQUFnQjtBQUFBLFFBQ2xGLEtBQUs7QUFBWSxpQkFBTzJJLEVBQUVpRDtBQUFBQSxNQUM1QjtBQUFBLElBQ0Y7QUFFQUwsYUFBU3BGLEtBQUssQ0FBQ2tFLEdBQUdDLE1BQU07QUFDdEIsWUFBTXVCLFFBQVF4QixFQUFFeUIsR0FBR0MsV0FBVyxPQUFPO0FBQ3JDLFlBQU1DLFFBQVExQixFQUFFd0IsR0FBR0MsV0FBVyxPQUFPO0FBQ3JDLFVBQUlGLFNBQVMsQ0FBQ0csTUFBTyxRQUFPO0FBQzVCLFVBQUksQ0FBQ0gsU0FBU0csTUFBTyxRQUFPO0FBQzVCLFlBQU1DLEtBQUtQLFFBQVFyQixDQUFDO0FBQ3BCLFlBQU02QixLQUFLUixRQUFRcEIsQ0FBQztBQUNwQixVQUFJLE9BQU8yQixPQUFPLFlBQVksT0FBT0MsT0FBTyxVQUFVO0FBQ3BELGVBQU9ELEdBQUczRixjQUFjNEYsRUFBRSxJQUFJVDtBQUFBQSxNQUNoQztBQUNBLGNBQVNRLEtBQWlCQyxNQUFpQlQ7QUFBQUEsSUFDN0MsQ0FBQztBQUVELFdBQU9GO0FBQUFBLEVBQ1QsR0FBRyxDQUFDdkcsVUFBVWhFLFVBQVVtQyxnQkFBZ0JFLFlBQVksQ0FBQztBQUVyRCxXQUFTOEksV0FBVzVMLEtBQXNCO0FBQ3hDK0Msb0JBQWdCLENBQUM4SSxRQUFRO0FBQ3ZCLFVBQUlBLElBQUk3TCxRQUFRQSxJQUFLLFFBQU8sRUFBRUEsS0FBS2dELEtBQUssT0FBTztBQUMvQyxVQUFJNkksSUFBSTdJLFFBQVEsT0FBUSxRQUFPLEVBQUVoRCxLQUFLZ0QsS0FBSyxNQUFNO0FBQ2pELGFBQU8sRUFBRWhELEtBQUssTUFBTWdELEtBQUssT0FBTztBQUFBLElBQ2xDLENBQUM7QUFBQSxFQUNIO0FBRUEsUUFBTThJLGVBQWUxTyxRQUFRLE1BQU07QUFDakMsUUFBSXdFLGdCQUFnQixVQUFVO0FBQzVCLGFBQU84QyxRQUFRbUQsSUFBSSxDQUFDeEksWUFBWTtBQUFBLFFBQzlCVyxLQUFLWCxPQUFPQTtBQUFBQSxRQUNaZSxPQUFPZixPQUFPQTtBQUFBQSxRQUNkME0sT0FBTzFNLE9BQU8wTTtBQUFBQSxRQUNkOUQsUUFBUTVJLE9BQU80STtBQUFBQSxNQUNqQixFQUFFO0FBQUEsSUFDSjtBQUVBLFdBQU94RCxVQUFVaEUsU0FBU3VGLE1BQU0sR0FBRyxFQUFFLEVBQUU2QixJQUFJLENBQUMvQyxhQUFhO0FBQUEsTUFDdkQ5RSxLQUFLOEUsUUFBUXlHO0FBQUFBLE1BQ2JuTCxPQUFPMEUsUUFBUTNGO0FBQUFBLE1BQ2Y0TSxPQUFPakgsUUFBUXNHO0FBQUFBLE1BQ2ZuRCxRQUFRbkQsUUFBUW1EO0FBQUFBLElBQ2xCLEVBQUU7QUFBQSxFQUNKLEdBQUcsQ0FBQ3JHLGFBQWE4QyxTQUFTRCxVQUFVaEUsUUFBUSxDQUFDO0FBRTdDLFFBQU11TCxnQkFBZ0IsQ0FBQyxHQUFHcEgsZ0JBQWdCLEVBQ3ZDZ0IsS0FBSyxDQUFDQyxNQUFNQyxVQUFVK0MsS0FBS0MsSUFBSWhELE1BQU11RixRQUFRLElBQUl4QyxLQUFLQyxJQUFJakQsS0FBS3dGLFFBQVEsQ0FBQyxFQUN4RXJGLE1BQU0sR0FBRyxFQUFFO0FBRWQsUUFBTWlHLGVBQ0pELGNBQWM3QyxTQUFTLElBQ25CTixLQUFLWSxJQUFJLEdBQUd1QyxjQUFjbkUsSUFBSSxDQUFDL0MsWUFBWStELEtBQUtDLElBQUloRSxRQUFRdUcsUUFBUSxDQUFDLENBQUMsSUFDdEU7QUFFTixRQUFNYSxZQUFZLENBQUMsR0FBR3RILGdCQUFnQixFQUNuQ2dCLEtBQUssQ0FBQ0MsTUFBTUMsVUFBVUEsTUFBTXJHLGVBQWVvRyxLQUFLcEcsWUFBWSxFQUM1RHVHLE1BQU0sR0FBRyxDQUFDO0FBRWIsaUJBQWVtRyxhQUFhQyxNQUFZO0FBQ3RDLFVBQU1DLE9BQU8sTUFBTUQsS0FBS0MsS0FBSztBQUM3QixVQUFNQyxXQUFXck8saUJBQWlCb08sSUFBSSxFQUFFeEUsSUFBSTBFLGdCQUFnQjtBQUU1RCxRQUFJRCxTQUFTbkQsV0FBVyxHQUFHO0FBQ3pCO0FBQUEsSUFDRjtBQUVBekksZ0JBQVk0TCxRQUFRO0FBQ3BCekwsYUFBUzNCLFVBQVU7QUFDbkJvRSxrQkFBYyxFQUFFO0FBQUEsRUFDbEI7QUFFQSxXQUFTa0osaUJBQWlCQyxPQUF5QztBQUNqRUEsVUFBTUMsZUFBZTtBQUVyQixVQUFNdk4sU0FBU3lCLE1BQU16QixPQUFPNEwsS0FBSztBQUNqQyxVQUFNM0wsT0FBT3dCLE1BQU14QixLQUFLMkwsS0FBSztBQUU3QixRQUFJLENBQUM1TCxVQUFVLENBQUNDLE1BQU07QUFDcEJrRSxvQkFBYywrQkFBK0I7QUFDN0M7QUFBQSxJQUNGO0FBRUEsUUFBSTFDLE1BQU10QixVQUFVLEtBQUtzQixNQUFNckIsUUFBUSxLQUFLcUIsTUFBTXBCLFlBQVksR0FBRztBQUMvRDhEO0FBQUFBLFFBQ0U7QUFBQSxNQUNGO0FBQ0E7QUFBQSxJQUNGO0FBRUEsVUFBTXdCLFVBQW1CO0FBQUEsTUFDdkJ5RyxJQUFJOU4sU0FBUztBQUFBLE1BQ2IwQixRQUFRQSxPQUFPd04sWUFBWTtBQUFBLE1BQzNCdk47QUFBQUEsTUFDQUMsUUFBUXVCLE1BQU12QixPQUFPMEwsS0FBSyxLQUFLO0FBQUEsTUFDL0I2QixTQUFTO0FBQUEsTUFDVHROLFFBQVFzQixNQUFNdEI7QUFBQUEsTUFDZEMsT0FBT3FCLE1BQU1yQjtBQUFBQSxNQUNiQyxXQUFXb0IsTUFBTXBCO0FBQUFBLE1BQ2pCQyxjQUFjbUIsTUFBTW5CO0FBQUFBLE1BQ3BCQyxrQkFBa0JrQixNQUFNbEI7QUFBQUEsTUFDeEJDLFlBQVlpQixNQUFNakI7QUFBQUEsSUFDcEI7QUFFQWUsZ0JBQVksQ0FBQ3lELFlBQVksQ0FBQ1csU0FBUyxHQUFHWCxPQUFPLENBQUM7QUFDOUN0RCxhQUFTM0IsVUFBVTtBQUNuQm9FLGtCQUFjLEVBQUU7QUFBQSxFQUNsQjtBQUVBLFdBQVN1SixnQkFBZ0JKLE9BQXlDO0FBQ2hFQSxVQUFNQyxlQUFlO0FBRXJCLFFBQUk1TCxVQUFVakIsWUFBWSxHQUFHO0FBQzNCMkQsbUJBQWEsZ0NBQWdDO0FBQzdDO0FBQUEsSUFDRjtBQUVBQSxpQkFBYSxFQUFFO0FBQUEsRUFDakI7QUFFQSxXQUFTc0osb0JBQW9CTCxPQUF5QztBQUNwRUEsVUFBTUMsZUFBZTtBQUVyQixVQUFNMU0sTUFBTW9CLFlBQVlwQixJQUFJK0ssS0FBSztBQUNqQyxRQUFJLENBQUMvSyxLQUFLO0FBQ1IwRCxxQkFBZSx5QkFBeUI7QUFDeEM7QUFBQSxJQUNGO0FBRUEsUUFBSXRDLFlBQVluQixtQkFBbUIsS0FBS21CLFlBQVluQixrQkFBa0IsS0FBSztBQUN6RXlELHFCQUFlLDBDQUEwQztBQUN6RDtBQUFBLElBQ0Y7QUFFQSxVQUFNcUosZ0JBQ0ozTCxZQUFZckIsU0FBUyxXQUFXQyxJQUFJMk0sWUFBWSxJQUFJM007QUFFdERrQjtBQUFBQSxNQUFXLENBQUNpRCxZQUFZO0FBQUEsUUFDdEI7QUFBQSxVQUNFb0gsSUFBSTlOLFNBQVM7QUFBQSxVQUNic0MsTUFBTXFCLFlBQVlyQjtBQUFBQSxVQUNsQkMsS0FBSytNO0FBQUFBLFVBQ0xyRSxjQUFjdEgsWUFBWW5CLGtCQUFrQjtBQUFBLFFBQzlDO0FBQUEsUUFDQSxHQUFHa0U7QUFBQUEsTUFBTztBQUFBLElBQ1g7QUFFRDlDLG1CQUFldkIsZ0JBQWdCO0FBQy9CNEQsbUJBQWUsRUFBRTtBQUFBLEVBQ25CO0FBRUEsV0FBU3NKLGFBQWF6QixJQUFZO0FBQ2hDckssZUFBVyxDQUFDaUQsWUFBWUEsUUFBUVUsT0FBTyxDQUFDMkMsV0FBV0EsT0FBTytELE9BQU9BLEVBQUUsQ0FBQztBQUFBLEVBQ3RFO0FBRUEsV0FBUzBCLGNBQWNSLE9BQXlDO0FBQzlEQSxVQUFNQyxlQUFlO0FBRXJCLFFBQUksQ0FBQ3JLLFlBQVlsQyxNQUFNO0FBQ3JCcUMscUJBQWUsZ0JBQWdCO0FBQy9CO0FBQUEsSUFDRjtBQUVBLFVBQU1uQyxTQUFTZ0gsT0FBT2hGLFlBQVloQyxNQUFNO0FBQ3hDLFVBQU1DLFdBQVcrRyxPQUFPaEYsWUFBWS9CLFFBQVE7QUFFNUMsUUFBSSxDQUFDK0csT0FBT0MsU0FBU2pILE1BQU0sR0FBRztBQUM1Qm1DLHFCQUFlLDBCQUEwQjtBQUN6QztBQUFBLElBQ0Y7QUFFQSxRQUFJLENBQUM2RSxPQUFPQyxTQUFTaEgsUUFBUSxLQUFLQSxXQUFXLEdBQUc7QUFDOUNrQyxxQkFBZSwwQ0FBMEM7QUFDekQ7QUFBQSxJQUNGO0FBRUFMO0FBQUFBLE1BQWUsQ0FBQ2dDLFlBQVk7QUFBQSxRQUMxQixHQUFHQTtBQUFBQSxRQUNIO0FBQUEsVUFDRW9ILElBQUk5TixTQUFTO0FBQUEsVUFDYjBDLE1BQU1rQyxZQUFZbEM7QUFBQUEsVUFDbEJDLE9BQU9pQyxZQUFZakMsTUFBTTJLLEtBQUssS0FBSyxTQUFTNUcsUUFBUWdGLE1BQU07QUFBQSxVQUMxRDlJO0FBQUFBLFVBQ0FDO0FBQUFBLFFBQ0Y7QUFBQSxNQUFDO0FBQUEsSUFDRjtBQUNEZ0MsbUJBQWVwQyxvQkFBb0I7QUFDbkNzQyxtQkFBZSxFQUFFO0FBQUEsRUFDbkI7QUFFQSxXQUFTMEssaUJBQWlCM0IsSUFBWTtBQUNwQ3BKLG1CQUFlLENBQUNnQyxZQUFZQSxRQUFRVSxPQUFPLENBQUNvRixVQUFVQSxNQUFNc0IsT0FBT0EsRUFBRSxDQUFDO0FBQUEsRUFDeEU7QUFFQSxXQUFTNEIsY0FBYzVCLElBQVk7QUFDakM3SyxnQkFBWSxDQUFDeUQsWUFBWUEsUUFBUVUsT0FBTyxDQUFDQyxZQUFZQSxRQUFReUcsT0FBT0EsRUFBRSxDQUFDO0FBQUEsRUFDekU7QUFHQSxpQkFBZTZCLGdCQUFnQjtBQUM3QixVQUFNQyxVQUFVNU0sU0FBU29FLE9BQU8sQ0FBQ3VELE1BQU0sQ0FBQ0EsRUFBRW1ELEdBQUdDLFdBQVcsT0FBTyxDQUFDO0FBQ2hFLFFBQUk2QixRQUFRbEUsV0FBVyxHQUFHO0FBQ3hCO0FBQUEsSUFDRjtBQUVBakcsZ0JBQVksSUFBSTtBQUVoQixRQUFJO0FBQ0YsWUFBTSxDQUFDb0ssUUFBUUMsU0FBUyxJQUFJLE1BQU1DLFFBQVFDO0FBQUFBLFFBQUk7QUFBQSxVQUM1QzlPLGdCQUFnQjtBQUFBLFVBQ2hCRCxlQUFlMk8sUUFBUXhGLElBQUksQ0FBQ08sTUFBTUEsRUFBRWpKLE1BQU0sQ0FBQztBQUFBLFFBQUM7QUFBQSxNQUM3QztBQUNELFlBQU0sRUFBRXNCLFVBQVVpTixRQUFRLElBQUlqUCxnQkFBZ0JnQyxVQUFVNk0sUUFBUUMsU0FBUztBQUN6RTdNLGtCQUFZZ04sT0FBTztBQUNuQnRLLHdCQUFpQixvQkFBSWdELEtBQUssR0FBRXVILFlBQVksQ0FBQztBQUV6QyxZQUFNQyxhQUFhRixRQUFRN0ksT0FBTyxDQUFDdUQsTUFBTSxDQUFDeUYsY0FBY3pGLENBQUMsQ0FBQztBQUMxRCxZQUFNMEYsV0FBV3ZRLGlCQUFpQnFRLFVBQVU7QUFDNUMsWUFBTSxFQUFFRyxXQUFXQyxZQUFZQyxPQUFPLElBQUlDLGVBQWU7QUFDekQsVUFBSUgsYUFBYUMsWUFBWTtBQUMzQnRMLG1CQUFXLENBQUNtSixRQUFRO0FBQ2xCLGNBQUlBLElBQUlzQyxLQUFLLENBQUN4RyxNQUFNeUcsU0FBU3pHLEVBQUV4SCxJQUFJLE1BQU04TixNQUFNLEVBQUcsUUFBT3BDO0FBQ3pELGdCQUFNd0MsT0FBTztBQUFBLFlBQ1gsR0FBR3hDO0FBQUFBLFlBQ0g7QUFBQSxjQUNFMUwsT0FBTSxvQkFBSWlHLEtBQUssR0FBRXVILFlBQVk7QUFBQSxjQUM3QnpJLFlBQVk0SSxTQUFTNUk7QUFBQUEsY0FDckJvSixXQUFXUixTQUFTUTtBQUFBQSxjQUNwQmpELFVBQVV5QyxTQUFTUztBQUFBQSxZQUNyQjtBQUFBLFVBQUM7QUFFSCxpQkFBT0YsS0FBS3JJLE1BQU0sSUFBSTtBQUFBLFFBQ3hCLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRixRQUFRO0FBQUEsSUFDTixVQUNEO0FBQ0M5QyxrQkFBWSxLQUFLO0FBQUEsSUFDbkI7QUFBQSxFQUNGO0FBRUEsV0FBU3NMLGtCQUFrQjtBQUN6QixVQUFNdEssT0FBTztBQUFBLE1BQ1h6RDtBQUFBQSxNQUNBNkQsTUFBTXhEO0FBQUFBLE1BQ05HO0FBQUFBLE1BQ0FpQjtBQUFBQSxNQUNBTztBQUFBQSxNQUNBZ00sYUFBWSxvQkFBSXJJLEtBQUssR0FBRXVILFlBQVk7QUFBQSxJQUNyQztBQUNBLFVBQU1lLE9BQU8sSUFBSUMsS0FBSyxDQUFDN0ssS0FBS0MsVUFBVUcsTUFBTSxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUwSyxNQUFNLG1CQUFtQixDQUFDO0FBQ25GLFVBQU1DLE1BQU1DLElBQUlDLGdCQUFnQkwsSUFBSTtBQUNwQyxVQUFNNUUsSUFBSWtGLFNBQVNDLGNBQWMsR0FBRztBQUNwQ25GLE1BQUVvRixPQUFPTDtBQUNUL0UsTUFBRXFGLFdBQVcsa0JBQWlCLG9CQUFJL0ksS0FBSyxHQUFFdUgsWUFBWSxFQUFFM0gsTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUNuRThELE1BQUVzRixNQUFNO0FBQ1JOLFFBQUlPLGdCQUFnQlIsR0FBRztBQUFBLEVBQ3pCO0FBRUEsV0FBU1MsZ0JBQWdCbEQsTUFBWTtBQUNuQyxVQUFNbUQsU0FBUyxJQUFJQyxXQUFXO0FBQzlCRCxXQUFPRSxTQUFTLE1BQU07QUFDcEIsVUFBSTtBQUNGLGNBQU1wRCxPQUFPeEYsT0FBTzBJLE9BQU9HLE1BQU07QUFDakMsY0FBTXhMLE9BQU9KLEtBQUs2TCxNQUFNdEQsSUFBSTtBQUM1QixZQUFJLENBQUN1RCxRQUFRLGlFQUFpRSxFQUFHO0FBQ2pGLFlBQUl4TCxNQUFNQyxRQUFRSCxLQUFLekQsUUFBUSxFQUFHQyxhQUFZd0QsS0FBS3pELFFBQVE7QUFDM0QsWUFBSXlELEtBQUtJLFFBQVEsT0FBT0osS0FBS0ksU0FBUyxTQUFVdkQsY0FBYW1ELEtBQUtJLElBQUk7QUFDdEUsWUFBSUYsTUFBTUMsUUFBUUgsS0FBS2pELE9BQU8sRUFBR0MsWUFBV2dELEtBQUtqRCxPQUFPO0FBQ3hELFlBQUltRCxNQUFNQyxRQUFRSCxLQUFLaEMsV0FBVyxFQUFHQyxnQkFBZStCLEtBQUtoQyxXQUFXO0FBQ3BFLFlBQUlrQyxNQUFNQyxRQUFRSCxLQUFLekIsT0FBTyxFQUFHQyxZQUFXd0IsS0FBS3pCLE9BQU87QUFBQSxNQUMxRCxTQUFTb04sS0FBSztBQUNaQyxjQUFNLGtCQUFrQkQsZUFBZUUsUUFBUUYsSUFBSUcsVUFBVSxjQUFjLEVBQUU7QUFBQSxNQUMvRTtBQUFBLElBQ0Y7QUFDQVQsV0FBT1UsV0FBVzdELElBQUk7QUFBQSxFQUN4QjtBQUVBLFNBQ0UsdUJBQUMsVUFBSyxXQUFVLGFBQ2Q7QUFBQSwyQkFBQyxhQUFRLFdBQVUsWUFDakI7QUFBQSw2QkFBQyxTQUFJLFdBQVUsY0FDYjtBQUFBLCtCQUFDLE9BQUUsV0FBVSxXQUFVLG1DQUF2QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQTBDO0FBQUEsUUFDMUMsdUJBQUMsUUFBRyx3Q0FBSjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQTRCO0FBQUEsV0FGOUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUdBO0FBQUEsTUFDQSx1QkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSwrQkFBQyxXQUFNLFdBQVUsVUFBUyxTQUFRLGVBQWEsMEJBQS9DO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFFQTtBQUFBLFFBQ0E7QUFBQSxVQUFDO0FBQUE7QUFBQSxZQUNDLElBQUc7QUFBQSxZQUNILFdBQVU7QUFBQSxZQUNWLE1BQUs7QUFBQSxZQUNMLFFBQU87QUFBQSxZQUNQLFVBQVUsQ0FBQ0ssVUFBVTtBQUNuQixvQkFBTUwsT0FBT0ssTUFBTWpGLE9BQU8wSSxRQUFRLENBQUM7QUFDbkMsa0JBQUk5RCxNQUFNO0FBQ1IscUJBQUtELGFBQWFDLElBQUk7QUFBQSxjQUN4QjtBQUFBLFlBQ0Y7QUFBQTtBQUFBLFVBVkY7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBVUk7QUFBQSxRQUVKO0FBQUEsVUFBQztBQUFBO0FBQUEsWUFDQyxNQUFLO0FBQUEsWUFDTCxXQUFVO0FBQUEsWUFDVixTQUFTZ0I7QUFBQUEsWUFDVCxVQUFVbkssWUFBWXhDLFNBQVMwSSxXQUFXO0FBQUEsWUFFekNsRyxxQkFBVyxnQkFBZ0I7QUFBQTtBQUFBLFVBTjlCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQU9BO0FBQUEsUUFDQSx1QkFBQyxZQUFPLE1BQUssVUFBUyxXQUFVLFVBQVMsU0FBU3VMLGlCQUFnQixzQkFBbEU7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUVBO0FBQUEsUUFDQSx1QkFBQyxXQUFNLFdBQVUsVUFBUyxTQUFRLHlCQUF1QixzQkFBekQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUVBO0FBQUEsUUFDQTtBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsSUFBRztBQUFBLFlBQ0gsV0FBVTtBQUFBLFlBQ1YsTUFBSztBQUFBLFlBQ0wsUUFBTztBQUFBLFlBQ1AsVUFBVSxDQUFDL0IsVUFBVTtBQUNuQixvQkFBTUwsT0FBT0ssTUFBTWpGLE9BQU8wSSxRQUFRLENBQUM7QUFDbkMsa0JBQUk5RCxLQUFNa0QsaUJBQWdCbEQsSUFBSTtBQUM5Qkssb0JBQU1qRixPQUFPdUUsUUFBUTtBQUFBLFlBQ3ZCO0FBQUE7QUFBQSxVQVRGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQVNJO0FBQUEsV0F2Q047QUFBQTtBQUFBO0FBQUE7QUFBQSxhQXlDQTtBQUFBLFNBOUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0ErQ0E7QUFBQSxJQUVBLHVCQUFDLFNBQUksV0FBVSxZQUNYO0FBQUEsTUFDQSxDQUFDLFlBQVksVUFBVTtBQUFBLE1BQ3ZCLENBQUMsWUFBWSxVQUFVO0FBQUEsTUFDdkIsQ0FBQyxXQUFXLFNBQVM7QUFBQSxNQUNyQixDQUFDLFVBQVUsUUFBUTtBQUFBLE1BQ25CLENBQUMsVUFBVSxRQUFRO0FBQUEsSUFBQyxFQUNWbEU7QUFBQUEsTUFBSSxDQUFDLENBQUM3SCxLQUFLSSxLQUFLLE1BQzFCO0FBQUEsUUFBQztBQUFBO0FBQUEsVUFFQyxNQUFLO0FBQUEsVUFDTCxXQUFXLGdCQUFnQjRCLFNBQVNoQyxNQUFNLHlCQUF5QixFQUFFO0FBQUEsVUFDckUsU0FBUyxNQUFNaUMsUUFBUWpDLEdBQUc7QUFBQSxVQUV6Qkk7QUFBQUE7QUFBQUEsUUFMSUo7QUFBQUEsUUFEUDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BT0E7QUFBQSxJQUNELEtBaEJIO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FpQkE7QUFBQSxJQUVDZ0MsU0FBUyxjQUNSLHVCQUFDLGFBQVEsV0FBVSx3QkFDakI7QUFBQSw2QkFBQyxTQUFJLFdBQVUsd0JBQ2I7QUFBQSwrQkFBQyxTQUNDO0FBQUEsaUNBQUMsT0FBRSxXQUFVLGdCQUFlLHlCQUE1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFxQztBQUFBLFVBQ3JDLHVCQUFDLFFBQUcsOEJBQUo7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBa0I7QUFBQSxhQUZwQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBR0E7QUFBQSxRQUNBLHVCQUFDLFVBQUssV0FBVSxjQUFhLCtCQUE3QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQTRDO0FBQUEsV0FMOUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQU1BO0FBQUEsTUFFQSx1QkFBQyxVQUFLLFVBQVV3SyxrQkFDZDtBQUFBLCtCQUFDLFNBQUksV0FBVSxhQUNiO0FBQUE7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDLFVBQVUsQ0FBQzJELFVBQ1R0UCxTQUFTLENBQUNzRCxhQUFhO0FBQUEsZ0JBQ3JCLEdBQUdBO0FBQUFBLGdCQUNIaEYsUUFBUWdSLE1BQU1oUjtBQUFBQSxnQkFDZEMsTUFBTStRLE1BQU0vUTtBQUFBQSxnQkFDWkMsUUFBUThRLE1BQU05UTtBQUFBQSxjQUNoQixFQUFFO0FBQUEsY0FFSixVQUFVdUIsTUFBTXpCLFNBQVMsR0FBR3lCLE1BQU16QixNQUFNLE1BQU15QixNQUFNeEIsSUFBSSxLQUFLO0FBQUEsY0FDN0QsU0FBUyxNQUNQeUIsU0FBUyxDQUFDc0QsYUFBYTtBQUFBLGdCQUNyQixHQUFHQTtBQUFBQSxnQkFDSGhGLFFBQVE7QUFBQSxnQkFDUkMsTUFBTTtBQUFBLGdCQUNOQyxRQUFRO0FBQUEsY0FDVixFQUFFO0FBQUE7QUFBQSxZQWhCTjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsVUFpQkc7QUFBQSxVQUVIO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxPQUFNO0FBQUEsY0FDTixNQUFLO0FBQUEsY0FDTCxLQUFLO0FBQUEsY0FDTCxNQUFLO0FBQUEsY0FDTCxPQUFPd0gsT0FBT2pHLE1BQU10QixNQUFNO0FBQUEsY0FDMUIsVUFBVSxDQUFDeU0sVUFDVGxMLFNBQVMsQ0FBQ3NELGFBQWEsRUFBRSxHQUFHQSxTQUFTN0UsUUFBUStILE9BQU8wRSxLQUFLLEVBQUUsRUFBRTtBQUFBO0FBQUEsWUFQakU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBUUc7QUFBQSxVQUVIO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxPQUFNO0FBQUEsY0FDTixNQUFLO0FBQUEsY0FDTCxLQUFLO0FBQUEsY0FDTCxNQUFLO0FBQUEsY0FDTCxPQUFPbEYsT0FBT2pHLE1BQU1wQixTQUFTO0FBQUEsY0FDN0IsVUFBVSxDQUFDdU0sVUFDVGxMLFNBQVMsQ0FBQ3NELGFBQWEsRUFBRSxHQUFHQSxTQUFTM0UsV0FBVzZILE9BQU8wRSxLQUFLLEVBQUUsRUFBRTtBQUFBO0FBQUEsWUFQcEU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBUUc7QUFBQSxhQXRDTDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBd0NBO0FBQUEsUUFFQzFJLGFBQWEsdUJBQUMsT0FBRSxXQUFVLGNBQWNBLHdCQUEzQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQXNDLElBQU87QUFBQSxRQUUzRCx1QkFBQyxTQUFJLFdBQVUsZ0JBQ2IsaUNBQUMsWUFBTyxNQUFLLFVBQVMsV0FBVSx5QkFBdUIsMEJBQXZEO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFFQSxLQUhGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFJQTtBQUFBLFdBakRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFrREE7QUFBQSxTQTNERjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBNERBO0FBQUEsSUFHRHJCLFNBQVMsY0FBZSxtQ0FDekI7QUFBQSw2QkFBQyxhQUFRLFdBQVUsY0FDakI7QUFBQTtBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsT0FBTTtBQUFBLFlBQ04sT0FBT3JFLGVBQWU4RyxVQUFVUyxVQUFVO0FBQUEsWUFDMUMsUUFBUSxHQUFHVCxVQUFVaEUsU0FBUzBJLE1BQU07QUFBQTtBQUFBLFVBSHRDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUdtRDtBQUFBLFFBRW5EO0FBQUEsVUFBQztBQUFBO0FBQUEsWUFDQyxPQUFNO0FBQUEsWUFDTixPQUFPeEwsZUFBZThHLFVBQVU2SixTQUFTO0FBQUEsWUFDekMsUUFBTztBQUFBO0FBQUEsVUFIVDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFHc0M7QUFBQSxRQUV0QztBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsT0FBTTtBQUFBLFlBQ04sT0FBTzNRLGVBQWU4RyxVQUFVOEosYUFBYTtBQUFBLFlBQzdDLFFBQ0U5SixVQUFVOEosaUJBQWlCLElBQUksbUJBQW1CO0FBQUEsWUFFcEQsTUFBTTlKLFVBQVU4SixpQkFBaUIsSUFBSSxhQUFhO0FBQUE7QUFBQSxVQU5wRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFNK0Q7QUFBQSxRQUUvRDtBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsT0FBTTtBQUFBLFlBQ04sT0FDRXZKLGFBQ0ksR0FBR0EsV0FBVzdGLE1BQU0sSUFBSXJCLGNBQWNrSCxXQUFXaUQsTUFBTSxDQUFDLEtBQ3hEO0FBQUEsWUFFTixRQUFRakQsYUFBYUEsV0FBVzVGLE9BQU87QUFBQTtBQUFBLFVBUHpDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQU9vRTtBQUFBLFdBMUJ0RTtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBNEJBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUsd0JBQ2pCO0FBQUE7QUFBQSxVQUFDO0FBQUE7QUFBQSxZQUNDLE9BQU07QUFBQSxZQUNOLE9BQU96QixlQUFlbUQsVUFBVWpCLFNBQVM7QUFBQSxZQUN6QyxRQUFRLEdBQUcvQixjQUFjbUgsVUFBVSxDQUFDO0FBQUE7QUFBQSxVQUh0QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFHc0Q7QUFBQSxRQUV0RDtBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsT0FBTTtBQUFBLFlBQ04sT0FBT25ILGNBQWM0SCxXQUFXO0FBQUEsWUFDaEMsUUFBUSxpQkFBaUJoSSxzQkFBc0IySCx3QkFBd0IsQ0FBQztBQUFBO0FBQUEsVUFIMUU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBRzJGO0FBQUEsV0FUN0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQVdBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUsU0FDakI7QUFBQSwrQkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSxpQ0FBQyxTQUNDO0FBQUEsbUNBQUMsT0FBRSxXQUFVLGdCQUFlLHVCQUE1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFtQztBQUFBLFlBQ25DLHVCQUFDLFFBQUcseUNBQUo7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBNkI7QUFBQSxlQUYvQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUdBO0FBQUEsVUFDQSx1QkFBQyxTQUFJLFdBQVUsa0JBQ2I7QUFBQSxtQ0FBQyxVQUFLLFdBQVUsY0FBYzVDO0FBQUFBLHNCQUFRMEc7QUFBQUEsY0FBTztBQUFBLGNBQVUxRyxRQUFRMEcsV0FBVyxJQUFJLEtBQUs7QUFBQSxjQUFJO0FBQUEsaUJBQXZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQTJIO0FBQUEsWUFDM0g7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxNQUFLO0FBQUEsZ0JBQ0wsV0FBVTtBQUFBLGdCQUNWLFNBQVMsTUFBTTtBQUNiLHNCQUFJMUcsUUFBUTBHLFdBQVcsRUFBRztBQUMxQixzQkFBSSxDQUFDeUcsUUFBUSxhQUFhbk4sUUFBUTBHLE1BQU0sNENBQTRDLEVBQUc7QUFDdkZ6Ryw2QkFBVyxFQUFFO0FBQUEsZ0JBQ2Y7QUFBQSxnQkFDQSxVQUFVRCxRQUFRMEcsV0FBVztBQUFBLGdCQUM3QixPQUFNO0FBQUEsZ0JBQW9DO0FBQUE7QUFBQSxjQVQ1QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFZQTtBQUFBLGVBZEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFlQTtBQUFBLGFBcEJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFxQkE7QUFBQSxRQUNBLHVCQUFDLHlCQUFzQixXQUFXMUcsU0FBUyxnQkFBZ0JVLGlCQUEzRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQXlFO0FBQUEsV0F2QjNFO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUF3QkE7QUFBQSxNQUVBLHVCQUFDLGFBQVEsV0FBVSx1QkFDakI7QUFBQSwrQkFBQyxhQUFRLFdBQVUscUJBQ2pCO0FBQUEsaUNBQUMsU0FBSSxXQUFVLGdCQUNiO0FBQUEsbUNBQUMsU0FDQztBQUFBLHFDQUFDLE9BQUUsV0FBVSxnQkFBZSwwQkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBc0M7QUFBQSxjQUN0Qyx1QkFBQyxRQUFHLG1DQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQXVCO0FBQUEsaUJBRnpCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBR0E7QUFBQSxZQUNBLHVCQUFDLFVBQUssV0FBVSxjQUNiQSwwQkFDRyxXQUFXcEYsbUJBQW1Cb0YsYUFBYSxDQUFDLEtBQzVDLHVCQUhOO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBSUE7QUFBQSxlQVRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBVUE7QUFBQSxVQUNDRixXQUFXLHVCQUFDLFNBQUksV0FBVSxrQkFBaUIsZUFBWSxVQUE1QztBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFrRCxJQUFNO0FBQUEsVUFDcEUsdUJBQUMsWUFBUyxVQUFVd0IsVUFBVWhFLFlBQTlCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXVDO0FBQUEsYUFiekM7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQWNBO0FBQUEsUUFFQSx1QkFBQyxhQUFRLFdBQVUsU0FDakI7QUFBQSxpQ0FBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSxtQ0FBQyxTQUNDO0FBQUEscUNBQUMsT0FBRSxXQUFVLGdCQUNWcUIsNkJBQW1CLFFBQVEsWUFBWSxZQUQxQztBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUVBO0FBQUEsY0FDQSx1QkFBQyxRQUFHO0FBQUE7QUFBQSxnQkFBZUEsbUJBQW1CLFFBQVEsUUFBUTtBQUFBLG1CQUF0RDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFvRTtBQUFBLGlCQUp0RTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUtBO0FBQUEsWUFDQSx1QkFBQyxTQUFJLFdBQVUsc0JBQ2I7QUFBQSxxQ0FBQyxTQUFJLFdBQVUsY0FDYjtBQUFBO0FBQUEsa0JBQUM7QUFBQTtBQUFBLG9CQUNDLE1BQUs7QUFBQSxvQkFDTCxXQUFXLFFBQVFGLGdCQUFnQixXQUFXLFdBQVcsRUFBRTtBQUFBLG9CQUMzRCxTQUFTLE1BQU1DLGVBQWUsUUFBUTtBQUFBLG9CQUFFO0FBQUE7QUFBQSxrQkFIMUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGdCQU1BO0FBQUEsZ0JBQ0E7QUFBQSxrQkFBQztBQUFBO0FBQUEsb0JBQ0MsTUFBSztBQUFBLG9CQUNMLFdBQVcsUUFBUUQsZ0JBQWdCLFdBQVcsV0FBVyxFQUFFO0FBQUEsb0JBQzNELFNBQVMsTUFBTUMsZUFBZSxRQUFRO0FBQUEsb0JBQUU7QUFBQTtBQUFBLGtCQUgxQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBTUE7QUFBQSxtQkFkRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQWVBO0FBQUEsY0FDQSx1QkFBQyxTQUFJLFdBQVUsY0FDYjtBQUFBO0FBQUEsa0JBQUM7QUFBQTtBQUFBLG9CQUNDLE1BQUs7QUFBQSxvQkFDTCxXQUFXLFFBQVFDLG1CQUFtQixRQUFRLFdBQVcsRUFBRTtBQUFBLG9CQUMzRCxTQUFTLE1BQU1DLGtCQUFrQixLQUFLO0FBQUEsb0JBQ3RDLE9BQU07QUFBQSxvQkFBb0I7QUFBQTtBQUFBLGtCQUo1QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBT0E7QUFBQSxnQkFDQTtBQUFBLGtCQUFDO0FBQUE7QUFBQSxvQkFDQyxNQUFLO0FBQUEsb0JBQ0wsV0FBVyxRQUFRRCxtQkFBbUIsV0FBVyxXQUFXLEVBQUU7QUFBQSxvQkFDOUQsU0FBUyxNQUFNQyxrQkFBa0IsUUFBUTtBQUFBLG9CQUN6QyxPQUFNO0FBQUEsb0JBQXdCO0FBQUE7QUFBQSxrQkFKaEM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGdCQU9BO0FBQUEsbUJBaEJGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBaUJBO0FBQUEsaUJBbENGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBbUNBO0FBQUEsZUExQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkEyQ0E7QUFBQSxVQUNDRCxtQkFBbUIsUUFDbEIsdUJBQUMsV0FBUSxPQUFPZ0ssZ0JBQWhCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQTZCLElBRTdCLHVCQUFDLG9CQUFpQixPQUFPQSxnQkFBekI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBc0M7QUFBQSxhQWhEMUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQWtEQTtBQUFBLFdBbkVGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFvRUE7QUFBQSxTQTFJeUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQTJJekI7QUFBQSxJQUVDOUosU0FBUyxhQUNWLHVCQUFDLGFBQVEsV0FBVSw2QkFDakI7QUFBQSw2QkFBQyxhQUFRLFdBQVUsc0JBQ2pCO0FBQUEsK0JBQUMsU0FBSSxXQUFVLGdCQUNiLGlDQUFDLFNBQ0M7QUFBQSxpQ0FBQyxPQUFFLFdBQVUsZ0JBQWUsdUJBQTVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQW1DO0FBQUEsVUFDbkMsdUJBQUMsUUFBRyx1Q0FBSjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUEyQjtBQUFBLGFBRjdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFHQSxLQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFLQTtBQUFBLFFBRUEsdUJBQUMsVUFBSyxXQUFVLGVBQWMsVUFBVThLLHFCQUN0QztBQUFBO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxPQUFPMUwsWUFBWXJCO0FBQUFBLGNBQ25CLFVBQVUsQ0FBQzBNLFVBQ1RwTCxlQUFlLENBQUM4QyxhQUFhO0FBQUEsZ0JBQzNCLEdBQUdBO0FBQUFBLGdCQUNIcEUsTUFBTTBNLE1BQU1qRixPQUFPdUU7QUFBQUEsZ0JBQ25CL0wsS0FBSztBQUFBLGNBQ1AsRUFBRTtBQUFBLGNBR0o7QUFBQSx1Q0FBQyxZQUFPLE9BQU0sVUFBUyxzQkFBdkI7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBNkI7QUFBQSxnQkFDN0IsdUJBQUMsWUFBTyxPQUFNLFVBQVMsc0JBQXZCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQTZCO0FBQUE7QUFBQTtBQUFBLFlBWC9CO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQVlBO0FBQUEsVUFDQTtBQUFBLFlBQUM7QUFBQTtBQUFBLGNBQ0MsT0FBT29CLFlBQVlwQjtBQUFBQSxjQUNuQixVQUFVLENBQUNvUSxRQUNUL08sZUFBZSxDQUFDOEMsYUFBYSxFQUFFLEdBQUdBLFNBQVNuRSxLQUFLb1EsSUFBSSxFQUFFO0FBQUEsY0FFeEQsU0FDRWhQLFlBQVlyQixTQUFTLFdBQ2pCMkUsUUFBUW1ELElBQUksQ0FBQ0YsTUFBTUEsRUFBRXRJLE1BQU0sSUFDM0JvRixVQUFVaEUsU0FBU29ILElBQUksQ0FBQ08sTUFBTUEsRUFBRWpKLE1BQU07QUFBQSxjQUU1QyxhQUFhaUMsWUFBWXJCLFNBQVMsV0FBVyxxQkFBcUI7QUFBQTtBQUFBLFlBVnBFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQVV1RjtBQUFBLFVBRXZGO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxNQUFLO0FBQUEsY0FDTCxLQUFLO0FBQUEsY0FDTCxLQUFLO0FBQUEsY0FDTCxNQUFLO0FBQUEsY0FDTCxPQUFPcUIsWUFBWW5CO0FBQUFBLGNBQ25CLFVBQVUsQ0FBQ3dNLFVBQ1RwTCxlQUFlLENBQUM4QyxhQUFhO0FBQUEsZ0JBQzNCLEdBQUdBO0FBQUFBLGdCQUNIbEUsaUJBQWlCb0gsT0FBT29GLE1BQU1qRixPQUFPdUUsS0FBSztBQUFBLGNBQzVDLEVBQUU7QUFBQSxjQUVKLGFBQVk7QUFBQTtBQUFBLFlBWmQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBWXdCO0FBQUEsVUFFeEIsdUJBQUMsWUFBTyxNQUFLLFVBQVMsV0FBVSxVQUFRLG1CQUF4QztBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUVBO0FBQUEsYUExQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQTJDQTtBQUFBLFFBRUN0SSxjQUFjLHVCQUFDLE9BQUUsV0FBVSxjQUFjQSx5QkFBM0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUF1QyxJQUFPO0FBQUEsUUFFNUQ0RSxXQUFXYyxTQUFTLEtBQ25CLG1DQUNFO0FBQUEsaUNBQUMsU0FBSSxXQUFVLGlCQUNiO0FBQUEsbUNBQUMsU0FBSSxXQUFVLCtCQUNiO0FBQUEscUNBQUMsVUFBSyxXQUFVLGtCQUFrQkgsdUJBQWFDLFFBQS9DO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQW9EO0FBQUEsY0FDcEQsdUJBQUMsVUFBSyxXQUFVLG9CQUFtQixvQkFBbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBdUM7QUFBQSxpQkFGekM7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQTtBQUFBLFlBQ0EsdUJBQUMsU0FBSSxXQUFVLGdDQUNiO0FBQUEscUNBQUMsVUFBSyxXQUFVLGtCQUFrQkQsdUJBQWFJLFNBQS9DO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQXFEO0FBQUEsY0FDckQsdUJBQUMsVUFBSyxXQUFVLG9CQUFtQixxQkFBbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBd0M7QUFBQSxpQkFGMUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQTtBQUFBLFlBQ0EsdUJBQUMsU0FBSSxXQUFVLGtDQUNiO0FBQUEscUNBQUMsVUFBSyxXQUFVLGtCQUFrQkosdUJBQWFLLFdBQS9DO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQXVEO0FBQUEsY0FDdkQsdUJBQUMsVUFBSyxXQUFVLG9CQUFtQix3QkFBbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBMkM7QUFBQSxpQkFGN0M7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQTtBQUFBLFlBQ0EsdUJBQUMsU0FBSSxXQUFVLGNBQ2I7QUFBQSxxQ0FBQyxVQUFLLFdBQVUsa0JBQWtCdkwsd0JBQWNrTCxhQUFhTSxjQUFjLEtBQTNFO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQTZFO0FBQUEsY0FDN0UsdUJBQUMsVUFBSyxXQUFVLG9CQUFtQiwyQkFBbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBOEM7QUFBQSxpQkFGaEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQTtBQUFBLGVBaEJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBaUJBO0FBQUEsVUFFQSx1QkFBQyxTQUFJLFdBQVUsa0JBQ2I7QUFBQSxtQ0FBQyxTQUFJLFdBQVUsY0FDWCxXQUFDLE9BQU8sUUFBUSxTQUFTLFNBQVMsRUFBWXpCO0FBQUFBLGNBQUksQ0FBQ0YsTUFDbkQ7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBRUMsTUFBSztBQUFBLGtCQUNMLFdBQVcsUUFBUW5HLHVCQUF1Qm1HLElBQUksaUJBQWlCLEVBQUU7QUFBQSxrQkFDakUsU0FBUyxNQUFNbEcsc0JBQXNCa0csQ0FBQztBQUFBLGtCQUVyQ0EsZ0JBQU0sUUFBUSxRQUFRQSxNQUFNLFNBQVMsU0FBU0EsTUFBTSxVQUFVLFVBQVU7QUFBQTtBQUFBLGdCQUxwRUE7QUFBQUEsZ0JBRFA7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxjQU9BO0FBQUEsWUFDRCxLQVZIO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBV0E7QUFBQSxZQUNBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsV0FBVTtBQUFBLGdCQUNWLE9BQU9qRztBQUFBQSxnQkFDUCxVQUFVLENBQUMyTyxNQUFNMU8sY0FBYzBPLEVBQUU3SSxPQUFPdUUsS0FBMEI7QUFBQSxnQkFFbEU7QUFBQSx5Q0FBQyxZQUFPLE9BQU0sU0FBUSwyQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBaUM7QUFBQSxrQkFDakMsdUJBQUMsWUFBTyxPQUFNLFFBQU8sMEJBQXJCO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQStCO0FBQUEsa0JBQy9CLHVCQUFDLFlBQU8sT0FBTSxVQUFTLDRCQUF2QjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUFtQztBQUFBO0FBQUE7QUFBQSxjQVByQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFRQTtBQUFBLFlBQ0MxRCxXQUFXYyxTQUFTLEtBQ25CO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsV0FBVTtBQUFBLGdCQUNWLE9BQU83SDtBQUFBQSxnQkFDUCxVQUFVLENBQUMrTyxNQUFNOU8sZ0JBQWdCOE8sRUFBRTdJLE9BQU91RSxLQUFLO0FBQUEsZ0JBQy9DLGFBQVk7QUFBQTtBQUFBLGNBSmQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBSXlCO0FBQUEsZUEzQjdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBOEJBO0FBQUEsYUFsREY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQW1EQTtBQUFBLFFBR0YsdUJBQUMsU0FBSSxXQUFVLGVBQ1oxRCxxQkFBV2MsV0FBVyxJQUNyQix1QkFBQyxPQUFFLFdBQVUsY0FBYSw2REFBMUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUF1RSxJQUV2RWQsV0FDQ3hELE9BQU8sQ0FBQzJFLFFBQVEsQ0FBQ2xJLGdCQUFnQmtJLElBQUl4SixJQUFJK0UsWUFBWSxFQUFFa0csU0FBUzNKLGFBQWF5RCxZQUFZLENBQUMsQ0FBQyxFQUMzRkYsT0FBTyxDQUFDMkUsUUFBUTtBQUNmLGNBQUloSSx1QkFBdUIsTUFBTyxRQUFPO0FBQ3pDLGNBQUlBLHVCQUF1QixPQUFRLFFBQU9nSSxJQUFJZixRQUFRO0FBQ3RELGNBQUlqSCx1QkFBdUIsUUFBUyxRQUFPZ0ksSUFBSWYsUUFBUTtBQUN2RCxpQkFBT0ksS0FBS0MsSUFBSVUsSUFBSWYsS0FBSyxLQUFLO0FBQUEsUUFDaEMsQ0FBQyxFQUNBN0MsS0FBSyxDQUFDa0UsR0FBR0MsTUFBTTtBQUNkLGNBQUlySSxlQUFlLFFBQVMsUUFBT3FJLEVBQUVuQixXQUFXa0IsRUFBRWxCO0FBQ2xELGNBQUlsSCxlQUFlLE9BQVEsUUFBT29JLEVBQUU5SixJQUFJK0YsY0FBY2dFLEVBQUUvSixHQUFHO0FBQzNELGlCQUFPK0osRUFBRXJCLGVBQWVvQixFQUFFcEI7QUFBQUEsUUFDNUIsQ0FBQyxFQUNBYixJQUFJLENBQUMyQixRQUFRO0FBQ1osZ0JBQU04RyxRQUFRekgsS0FBS1ksSUFBSUQsSUFBSWpCLGVBQWVpQixJQUFJZCxjQUFjLElBQUksSUFBSTtBQUNwRSxnQkFBTTZILGFBQWMvRyxJQUFJakIsZ0JBQWdCK0gsUUFBUztBQUNqRCxnQkFBTUUsWUFBYWhILElBQUlkLGVBQWU0SCxRQUFTO0FBQy9DLGlCQUNFLHVCQUFDLFNBQWlCLFdBQVcsMEJBQTBCOUcsSUFBSVQsTUFBTSxJQUMvRDtBQUFBLG1DQUFDLFNBQUksV0FBVSxpQkFDYjtBQUFBLHFDQUFDLFNBQUksV0FBVSxhQUNiO0FBQUEsdUNBQUMsWUFBUVMsY0FBSXhKLE9BQWI7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBaUI7QUFBQSxnQkFDakIsdUJBQUMsVUFBSyxXQUFVLGVBQWV3SixjQUFJekosUUFBbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBd0M7QUFBQSxtQkFGMUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFHQTtBQUFBLGNBQ0EsdUJBQUMsU0FBSSxXQUFVLHFCQUNiO0FBQUEsdUNBQUMsVUFBSyxXQUFVLHFCQUFxQmpDLHdCQUFjMEwsSUFBSWpCLGFBQWEsS0FBcEU7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBc0U7QUFBQSxnQkFDdEUsdUJBQUMsVUFBSyxXQUFVLGVBQWMsaUJBQTlCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQStCO0FBQUEsZ0JBQy9CLHVCQUFDLFVBQUssV0FBVSxvQkFBb0J6Syx3QkFBYzBMLElBQUlkLFlBQVksS0FBbEU7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBb0U7QUFBQSxtQkFIdEU7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFJQTtBQUFBLGNBQ0E7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBQ0MsTUFBSztBQUFBLGtCQUNMLFdBQVU7QUFBQSxrQkFDVixTQUFTLE1BQU1zRSxhQUFheEQsSUFBSStCLEVBQUU7QUFBQSxrQkFDbEMsY0FBVztBQUFBLGtCQUFlO0FBQUE7QUFBQSxnQkFKNUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGNBT0E7QUFBQSxpQkFqQkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFrQkE7QUFBQSxZQUNBLHVCQUFDLFNBQUksV0FBVSx3QkFDYjtBQUFBO0FBQUEsZ0JBQUM7QUFBQTtBQUFBLGtCQUNDLFdBQVcsc0JBQXNCL0IsSUFBSWYsU0FBUyxJQUFJLHFCQUFxQixtQkFBbUI7QUFBQSxrQkFDMUYsT0FBTyxFQUFFZ0ksT0FBTyxHQUFHRixVQUFVLElBQUk7QUFBQTtBQUFBLGdCQUZuQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FFcUM7QUFBQSxjQUVyQztBQUFBLGdCQUFDO0FBQUE7QUFBQSxrQkFDQyxXQUFVO0FBQUEsa0JBQ1YsT0FBTyxFQUFFMUssTUFBTSxHQUFHMkssU0FBUyxJQUFJO0FBQUEsa0JBQy9CLE9BQU8sVUFBVTFTLGNBQWMwTCxJQUFJZCxZQUFZLENBQUM7QUFBQTtBQUFBLGdCQUhsRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FHcUQ7QUFBQSxpQkFSdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFVQTtBQUFBLFlBQ0EsdUJBQUMsU0FBSSxXQUFVLG9CQUNiO0FBQUEscUNBQUMsVUFBSyxXQUFXLG9CQUFvQmMsSUFBSWIsV0FBVyxJQUFJLFFBQVEsTUFBTSxJQUNuRWE7QUFBQUEsb0JBQUliLFdBQVcsSUFBSSxRQUFRO0FBQUEsZ0JBQU87QUFBQSxnQkFBRWhMLGVBQWVrTCxLQUFLQyxJQUFJVSxJQUFJYixRQUFRLENBQUM7QUFBQSxtQkFENUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFFQTtBQUFBLGNBQ0EsdUJBQUMsVUFBSyxXQUFXLGVBQWVhLElBQUlmLFNBQVMsSUFBSSxhQUFhLFVBQVUsSUFDckVlO0FBQUFBLG9CQUFJZixTQUFTLElBQUksTUFBTTtBQUFBLGdCQUFJO0FBQUEsZ0JBQUUzSyxjQUFjK0ssS0FBS0MsSUFBSVUsSUFBSWYsS0FBSyxDQUFDO0FBQUEsbUJBRGpFO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBRUE7QUFBQSxjQUNDZSxJQUFJekosU0FBUyxZQUFZeUosSUFBSWxLLFNBQVMsS0FDckMsdUJBQUMsVUFBSyxXQUFVLGdCQUFlO0FBQUE7QUFBQSxnQkFBRWtLLElBQUlsSyxPQUFPb1IsUUFBUSxDQUFDO0FBQUEsZ0JBQUU7QUFBQSxtQkFBdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBMEQ7QUFBQSxpQkFSOUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFVQTtBQUFBLGVBekNRbEgsSUFBSStCLElBQWQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkEwQ0E7QUFBQSxRQUVKLENBQUMsS0FsRUw7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQW9FQTtBQUFBLFdBbExGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFtTEE7QUFBQSxNQUVBLHVCQUFDLGFBQVEsV0FBVSxTQUNqQjtBQUFBLCtCQUFDLFNBQUksV0FBVSxnQkFDYjtBQUFBLGlDQUFDLFNBQ0M7QUFBQSxtQ0FBQyxPQUFFLFdBQVUsZ0JBQWUseUJBQTVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXFDO0FBQUEsWUFDckMsdUJBQUMsUUFBRyxpQ0FBSjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFxQjtBQUFBLGVBRnZCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBR0E7QUFBQSxVQUNBLHVCQUFDLFVBQUssV0FBVSxjQUFjaEM7QUFBQUEsaUNBQXFCSjtBQUFBQSxZQUFPO0FBQUEsWUFBUUkscUJBQXFCSixXQUFXLElBQUksS0FBSztBQUFBLGVBQTNHO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQStHO0FBQUEsYUFMakg7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU1BO0FBQUEsUUFDQSx1QkFBQyxPQUFFLFdBQVUsY0FBY2hFLHlCQUEzQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQXVDO0FBQUEsUUFDdENvRSxxQkFBcUJKLFdBQVcsSUFDL0IsdUJBQUMsT0FBRSxXQUFVLGNBQWEsNkRBQTFCO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBdUUsSUFFdkUsdUJBQUMsU0FBSSxXQUFVLGlCQUNaTztBQUFBQSx5QkFBZVAsU0FBUyxLQUN2Qix1QkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSxtQ0FBQyxTQUFJLFdBQVUsdUJBQ2I7QUFBQSxxQ0FBQyxVQUFLLFdBQVUsMEJBQXlCLG1CQUF6QztBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUE0QztBQUFBLGNBQzVDLHVCQUFDLFVBQUssV0FBVSxzQkFDYnhMLHlCQUFlK0wsZUFBZXBFLE9BQU8sQ0FBQ3FDLEdBQUd1QixNQUFNdkIsSUFBSWtCLEtBQUtDLElBQUlJLEVBQUVQLFFBQVEsR0FBRyxDQUFDLENBQUMsS0FEOUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFFQTtBQUFBLGlCQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBS0E7QUFBQSxZQUNDZSxlQUFlN0I7QUFBQUEsY0FBSSxDQUFDOEksU0FDbkIsdUJBQUMsYUFBd0IsTUFBWSxNQUFLLE9BQU0sT0FBT2xNLFVBQVVTLGNBQWpEeUwsS0FBS3BGLElBQXJCO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQTRFO0FBQUEsWUFDN0U7QUFBQSxlQVRIO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBVUE7QUFBQSxVQUVENUIsZ0JBQWdCUixTQUFTLEtBQ3hCLHVCQUFDLFNBQUksV0FBVSxnQkFDYjtBQUFBLG1DQUFDLFNBQUksV0FBVSx1QkFDYjtBQUFBLHFDQUFDLFVBQUssV0FBVSwyQkFBMEIsb0JBQTFDO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQThDO0FBQUEsY0FDOUMsdUJBQUMsVUFBSyxXQUFVLHNCQUNieEwseUJBQWVnTSxnQkFBZ0JyRSxPQUFPLENBQUNxQyxHQUFHdUIsTUFBTXZCLElBQUlrQixLQUFLQyxJQUFJSSxFQUFFUCxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBRC9FO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBRUE7QUFBQSxpQkFKRjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUtBO0FBQUEsWUFDQ2dCLGdCQUFnQjlCO0FBQUFBLGNBQUksQ0FBQzhJLFNBQ3BCLHVCQUFDLGFBQXdCLE1BQVksTUFBSyxRQUFPLE9BQU9sTSxVQUFVUyxjQUFsRHlMLEtBQUtwRixJQUFyQjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUE2RTtBQUFBLFlBQzlFO0FBQUEsZUFUSDtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQVVBO0FBQUEsYUF6Qko7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQTJCQTtBQUFBLFdBdkNKO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUF5Q0E7QUFBQSxTQS9ORjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBZ09BO0FBQUEsSUFHQ3ZKLFNBQVMsWUFDVix1QkFBQyxhQUFRLFdBQVUsZ0JBQ2pCO0FBQUEsNkJBQUMsYUFBUSxXQUFVLFNBQ2pCO0FBQUEsK0JBQUMsU0FBSSxXQUFVLGdCQUNiO0FBQUEsaUNBQUMsU0FDQztBQUFBLG1DQUFDLE9BQUUsV0FBVSxnQkFBZSxvQkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBZ0M7QUFBQSxZQUNoQyx1QkFBQyxRQUFHLDhCQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQWtCO0FBQUEsZUFGcEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFHQTtBQUFBLFVBQ0EsdUJBQUMsVUFBSyxXQUFVLGNBQWEsc0NBQTdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQW1EO0FBQUEsYUFMckQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU1BO0FBQUEsUUFDQSx1QkFBQyxVQUFLLFdBQVUsZ0JBQWUsVUFBVTZLLGlCQUN2QztBQUFBLGlDQUFDLFNBQUksV0FBVSxhQUNiO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxPQUFNO0FBQUEsY0FDTixNQUFLO0FBQUEsY0FDTCxLQUFLO0FBQUEsY0FDTCxNQUFLO0FBQUEsY0FDTCxPQUFPaEcsT0FBTy9GLFVBQVVqQixTQUFTO0FBQUEsY0FDakMsVUFBVSxDQUFDa00sVUFDVGhMLGFBQWEsRUFBRWxCLFdBQVd3SCxPQUFPMEUsS0FBSyxFQUFFLENBQUM7QUFBQTtBQUFBLFlBUDdDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQVFHLEtBVEw7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFXQTtBQUFBLFVBQ0N4SSxZQUFZLHVCQUFDLE9BQUUsV0FBVSxjQUFjQSx1QkFBM0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBcUMsSUFBTztBQUFBLFVBQ3pELHVCQUFDLFNBQUksV0FBVSxnQkFDYixpQ0FBQyxZQUFPLE1BQUssVUFBUyxXQUFVLHlCQUF1QiwyQkFBdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFFQSxLQUhGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBSUE7QUFBQSxhQWxCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBbUJBO0FBQUEsV0EzQkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQTRCQTtBQUFBLE1BRUEsdUJBQUMsYUFBUSxXQUFVLFNBQ2pCO0FBQUEsK0JBQUMsU0FBSSxXQUFVLGdCQUNiO0FBQUEsaUNBQUMsU0FDQztBQUFBLG1DQUFDLE9BQUUsV0FBVSxnQkFBZSx5QkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBcUM7QUFBQSxZQUNyQyx1QkFBQyxRQUFHLCtCQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQW1CO0FBQUEsZUFGckI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFHQTtBQUFBLFVBQ0EsdUJBQUMsVUFBSyxXQUFVLGNBQWEscUNBQTdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQWtEO0FBQUEsYUFMcEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU1BO0FBQUEsUUFDQSx1QkFBQyxTQUFJLFdBQVUsbUJBQ1pvQyw0QkFBa0J3RCxXQUFXLElBQzVCLHVCQUFDLE9BQUUsV0FBVSxjQUFhLDREQUExQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQXNFLElBRXRFeEQsa0JBQWtCa0M7QUFBQUEsVUFBSSxDQUFDL0MsWUFDckIsdUJBQUMsU0FBcUIsV0FBVSxrQkFDOUI7QUFBQSxtQ0FBQyxZQUFRQSxrQkFBUTNGLFVBQWpCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXdCO0FBQUEsWUFDeEIsdUJBQUMsVUFBSztBQUFBO0FBQUEsY0FBTXhCLGVBQWVtSCxRQUFRcEYsZ0JBQWdCO0FBQUEsaUJBQW5EO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXFEO0FBQUEsWUFDckQsdUJBQUMsV0FBSztBQUFBO0FBQUEsY0FDVy9CLGVBQWVtSCxRQUFReEYsU0FBU3dGLFFBQVFwRixnQkFBZ0I7QUFBQSxjQUN0RW9GLFFBQVFuRixhQUFhLG1CQUFtQm1GLFFBQVFuRixVQUFVLEtBQUs7QUFBQSxpQkFGbEU7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQTtBQUFBLGVBTlFtRixRQUFReUcsSUFBbEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFPQTtBQUFBLFFBQ0QsS0FiTDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBZUE7QUFBQSxXQXZCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBd0JBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUsMkJBQ2pCO0FBQUEsK0JBQUMsU0FBSSxXQUFVLGdCQUNiO0FBQUEsaUNBQUMsU0FDQztBQUFBLG1DQUFDLE9BQUUsV0FBVSxnQkFBZSx3QkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBb0M7QUFBQSxZQUNwQyx1QkFBQyxRQUFHLDBDQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQThCO0FBQUEsZUFGaEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFHQTtBQUFBLFVBQ0EsdUJBQUMsVUFBSyxXQUFVLGNBQ2I3TjtBQUFBQSxrQ0FBc0J1SSxpQkFBaUJpQixLQUFLO0FBQUEsWUFBRTtBQUFBLGVBRGpEO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBRUE7QUFBQSxhQVBGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFRQTtBQUFBLFFBQ0EsdUJBQUMseUJBQXNCLE9BQU9qQixpQkFBaUJJLFNBQS9DO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBcUQ7QUFBQSxXQVZ2RDtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBV0E7QUFBQSxTQXBFRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBcUVBO0FBQUEsSUFHQ3JFLFNBQVMsY0FDVix1QkFBQyxhQUFRLFdBQVUscUJBQ2pCO0FBQUEsNkJBQUMsYUFBUSxXQUFVLFNBQ2pCO0FBQUEsK0JBQUMsU0FBSSxXQUFVLGdCQUNiO0FBQUEsaUNBQUMsU0FDQztBQUFBLG1DQUFDLE9BQUUsV0FBVSxnQkFBZSx5QkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBcUM7QUFBQSxZQUNyQyx1QkFBQyxRQUFHLGdDQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQW9CO0FBQUEsZUFGdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFHQTtBQUFBLFVBQ0EsdUJBQUMsVUFBSyxXQUFVLGNBQWEsd0NBQTdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXFEO0FBQUEsYUFMdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU1BO0FBQUEsUUFDQSx1QkFBQyxTQUFJLFdBQVUsMkNBQ1pnSyx3QkFBYzdDLFdBQVcsSUFDeEIsdUJBQUMsT0FBRSxXQUFVLGNBQWEsNkNBQTFCO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBdUQsSUFFdkQ2QyxjQUFjbkUsSUFBSSxDQUFDL0MsWUFBWTtBQUM3QixnQkFBTThMLE1BQU8vSCxLQUFLQyxJQUFJaEUsUUFBUXVHLFFBQVEsSUFBSVksZUFBZ0I7QUFDMUQsZ0JBQU00RSxRQUFRL0wsUUFBUXVHLFlBQVk7QUFDbEMsZ0JBQU15RixlQUNKakksS0FBS0MsSUFBSXJFLFVBQVU4SixhQUFhLElBQUksSUFDL0J6SixRQUFRdUcsV0FBV3hDLEtBQUtDLElBQUlyRSxVQUFVOEosYUFBYSxJQUFLLE1BQ3pEO0FBQ04saUJBQ0U7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUVDLFdBQVU7QUFBQSxjQUNWLE9BQU8sR0FBR3pKLFFBQVEzRixNQUFNLEtBQUt4QixlQUFlbUgsUUFBUXVHLFFBQVEsQ0FBQyxNQUFNck4sb0JBQW9COFMsY0FBYyxDQUFDLENBQUM7QUFBQSxjQUV2RztBQUFBLHVDQUFDLFlBQVFoTSxrQkFBUTNGLFVBQWpCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQXdCO0FBQUEsZ0JBQ3hCLHVCQUFDLFNBQUksV0FBVSw2Q0FDYjtBQUFBLHlDQUFDLFVBQUssV0FBVSxvQkFBaEI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBZ0M7QUFBQSxrQkFDaEM7QUFBQSxvQkFBQztBQUFBO0FBQUEsc0JBQ0MsV0FBVyx5Q0FBeUMwUixRQUFRLGFBQWEsVUFBVTtBQUFBLHNCQUNuRixPQUNFQSxRQUNJLEVBQUVoTCxNQUFNLE9BQU80SyxPQUFPLEdBQUdHLEdBQUcsSUFBSSxJQUNoQyxFQUFFOUssT0FBTyxPQUFPMkssT0FBTyxHQUFHRyxHQUFHLElBQUk7QUFBQTtBQUFBLG9CQUx6QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsa0JBTUc7QUFBQSxxQkFSTDtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQVVBO0FBQUEsZ0JBQ0E7QUFBQSxrQkFBQztBQUFBO0FBQUEsb0JBQ0MsV0FBVyxtQkFBbUJDLFFBQVEsYUFBYSxVQUFVO0FBQUEsb0JBRTVEbFQ7QUFBQUEscUNBQWVtSCxRQUFRdUcsUUFBUTtBQUFBLHNCQUNoQyx1QkFBQyxXQUFPck4sOEJBQW9COFMsY0FBYyxDQUFDLEtBQTNDO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBQTZDO0FBQUE7QUFBQTtBQUFBLGtCQUovQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBS0E7QUFBQTtBQUFBO0FBQUEsWUFyQktoTSxRQUFReUc7QUFBQUEsWUFEZjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBdUJBO0FBQUEsUUFFSixDQUFDLEtBckNMO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUF1Q0E7QUFBQSxXQS9DRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBZ0RBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUsU0FDakI7QUFBQSwrQkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSxpQ0FBQyxTQUNDO0FBQUEsbUNBQUMsT0FBRSxXQUFVLGdCQUFlLDBCQUE1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFzQztBQUFBLFlBQ3RDLHVCQUFDLFFBQUcsa0NBQUo7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBc0I7QUFBQSxlQUZ4QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUdBO0FBQUEsVUFDQSx1QkFBQyxVQUFLLFdBQVUsY0FBYSw2QkFBN0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBMEM7QUFBQSxhQUw1QztBQUFBO0FBQUE7QUFBQTtBQUFBLGVBTUE7QUFBQSxRQUNBLHVCQUFDLFNBQUksV0FBVSxtQkFDWlcsb0JBQVUvQyxXQUFXLElBQ3BCLHVCQUFDLE9BQUUsV0FBVSxjQUFhLGtDQUExQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQTRDLElBRTVDK0MsVUFBVXJFO0FBQUFBLFVBQUksQ0FBQy9DLFlBQ2IsdUJBQUMsU0FBcUIsV0FBVSxrQkFDOUI7QUFBQSxtQ0FBQyxZQUFRQSxrQkFBUTNGLFVBQWpCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXdCO0FBQUEsWUFDeEIsdUJBQUMsVUFBSyxXQUFXMkYsUUFBUXJGLGdCQUFnQixJQUFJLGFBQWEsWUFDdkRxRjtBQUFBQSxzQkFBUXJGLGFBQWFpUixRQUFRLENBQUM7QUFBQSxjQUFFO0FBQUEsaUJBRG5DO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBRUE7QUFBQSxZQUNBLHVCQUFDLFdBQU81TCxrQkFBUTFGLFFBQWhCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXFCO0FBQUEsZUFMYjBGLFFBQVF5RyxJQUFsQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQU1BO0FBQUEsUUFDRCxLQVpMO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFjQTtBQUFBLFdBdEJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUF1QkE7QUFBQSxTQTFFRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBMkVBO0FBQUEsSUFHQ3ZKLFNBQVMsY0FDVix1QkFBQyxhQUFRLFdBQVUscUJBQ2pCO0FBQUEsNkJBQUMsU0FBSSxXQUFVLGdCQUNiO0FBQUEsK0JBQUMsU0FDQztBQUFBLGlDQUFDLE9BQUUsV0FBVSxnQkFBZSx3QkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBb0M7QUFBQSxVQUNwQyx1QkFBQyxRQUFHLG1DQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXVCO0FBQUEsYUFGekI7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUdBO0FBQUEsUUFDQTtBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsTUFBSztBQUFBLFlBQ0wsV0FBVTtBQUFBLFlBQ1YsYUFBWTtBQUFBLFlBQ1osT0FBT1k7QUFBQUEsWUFDUCxVQUFVLENBQUN5TixNQUFNeE4sa0JBQWtCd04sRUFBRTdJLE9BQU91RSxLQUFLO0FBQUE7QUFBQSxVQUxuRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFLcUQ7QUFBQSxXQVZ2RDtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBWUE7QUFBQSxNQUVBLHVCQUFDLFNBQUksV0FBVSxjQUNiLGlDQUFDLFdBQ0M7QUFBQSwrQkFBQyxXQUNDLGlDQUFDLFFBQ0M7QUFBQSxpQ0FBQyxjQUFXLE9BQU0sVUFBUyxTQUFRLFVBQVMsTUFBTWpKLGNBQWMsU0FBUzhJLGNBQXpFO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQW9GO0FBQUEsVUFDcEYsdUJBQUMsY0FBVyxPQUFNLFFBQU8sU0FBUSxRQUFPLE1BQU05SSxjQUFjLFNBQVM4SSxjQUFyRTtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFnRjtBQUFBLFVBQ2hGLHVCQUFDLGNBQVcsT0FBTSxVQUFTLFNBQVEsVUFBUyxNQUFNOUksY0FBYyxTQUFTOEksY0FBekU7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBb0Y7QUFBQSxVQUNwRix1QkFBQyxjQUFXLE9BQU0sVUFBUyxTQUFRLFVBQVMsTUFBTTlJLGNBQWMsU0FBUzhJLFlBQVksT0FBTSxXQUEzRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFrRztBQUFBLFVBQ2xHLHVCQUFDLGNBQVcsT0FBTSxhQUFZLFNBQVEsYUFBWSxNQUFNOUksY0FBYyxTQUFTOEksWUFBWSxPQUFNLFdBQWpHO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXdHO0FBQUEsVUFDeEcsdUJBQUMsY0FBVyxPQUFNLGlCQUFnQixTQUFRLFNBQVEsTUFBTTlJLGNBQWMsU0FBUzhJLFlBQVksT0FBTSxXQUFqRztBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUF3RztBQUFBLFVBQ3hHLHVCQUFDLGNBQVcsT0FBTSxTQUFRLFNBQVEsZ0JBQWUsTUFBTTlJLGNBQWMsU0FBUzhJLFlBQVksT0FBTSxXQUFoRztBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUF1RztBQUFBLFVBQ3ZHLHVCQUFDLGNBQVcsT0FBTSxhQUFZLFNBQVEsWUFBVyxNQUFNOUksY0FBYyxTQUFTOEksWUFBWSxPQUFNLFdBQWhHO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXVHO0FBQUEsVUFDdkcsdUJBQUMsY0FBVyxPQUFNLGdCQUFlLFNBQVEsZUFBYyxNQUFNOUksY0FBYyxTQUFTOEksWUFBWSxPQUFNLFdBQXRHO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQTZHO0FBQUEsVUFDN0csdUJBQUMsY0FBVyxPQUFNLFVBQVMsU0FBUSxVQUFTLE1BQU05SSxjQUFjLFNBQVM4SSxZQUFZLE9BQU0sV0FBM0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBa0c7QUFBQSxVQUNsRyx1QkFBQyxjQUFXLE9BQU0sYUFBWSxTQUFRLFlBQVcsTUFBTTlJLGNBQWMsU0FBUzhJLFlBQVksT0FBTSxXQUFoRztBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUF1RztBQUFBLFVBQ3ZHLHVCQUFDLGNBQVcsT0FBTSxhQUFZLFNBQVEsWUFBVyxNQUFNOUksY0FBYyxTQUFTOEksWUFBWSxPQUFNLFdBQWhHO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXVHO0FBQUEsVUFDdkcsdUJBQUMsUUFBRyxXQUFVLFNBQVEsc0JBQXRCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQTRCO0FBQUEsYUFiOUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQWNBLEtBZkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQWdCQTtBQUFBLFFBQ0EsdUJBQUMsV0FDRWYseUJBQWUxQixXQUFXLElBQ3pCLHVCQUFDLFFBQ0MsaUNBQUMsUUFBRyxTQUFTLElBQUksV0FBVSxlQUN4QnZHLDJCQUFpQixnQkFBZ0IsaUVBRHBDO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFFQSxLQUhGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFJQSxJQUVBaUksZUFBZWhELElBQUksQ0FBQy9DLFlBQVk7QUFDOUIsZ0JBQU1pTSxnQkFBZ0JqTSxRQUFReUcsR0FBR0MsV0FBVyxPQUFPO0FBQ25ELGlCQUNFLHVCQUFDLFFBQ0M7QUFBQSxtQ0FBQyxRQUFJMUcsa0JBQVEzRixVQUFiO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQW9CO0FBQUEsWUFDcEIsdUJBQUMsUUFBSTJGLGtCQUFRMUYsUUFBYjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFrQjtBQUFBLFlBQ2xCLHVCQUFDLFFBQUkwRixrQkFBUXpGLFVBQWI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBb0I7QUFBQSxZQUNwQix1QkFBQyxRQUFHLFdBQVUsU0FBU3lGLGtCQUFReEYsT0FBTzBSLGVBQWUsS0FBckQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBdUQ7QUFBQSxZQUN2RCx1QkFBQyxRQUFHLFdBQVUsU0FBU3JULHlCQUFlbUgsUUFBUXRGLFNBQVMsS0FBdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBeUQ7QUFBQSxZQUN6RCx1QkFBQyxRQUFHLFdBQVUsU0FDWDdCLHlCQUFlbUgsUUFBUXZGLEtBQUssS0FEL0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFFQTtBQUFBLFlBQ0EsdUJBQUMsUUFBRyxXQUFXLFNBQVN1RixRQUFRckYsZ0JBQWdCLElBQUksYUFBYSxVQUFVLElBQ3hFc1IsMEJBQWdCLE1BQU0sR0FBR2pNLFFBQVFyRixhQUFhaVIsUUFBUSxDQUFDLENBQUMsT0FEM0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFFQTtBQUFBLFlBQ0EsdUJBQUMsUUFBRyxXQUFVLFNBQ1hLLDJCQUFpQmpNLFFBQVF0RixhQUFhLEtBQUtzRixRQUFRcEYsb0JBQW9CLElBQ3BFLE1BQ0EsSUFBS29GLFFBQVFwRixtQkFBbUJvRixRQUFRdEYsWUFBYSxLQUFLa1IsUUFBUSxDQUFDLENBQUMsT0FIMUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFJQTtBQUFBLFlBQ0EsdUJBQUMsUUFBRyxXQUFVLFNBQVMvUyx5QkFBZW1ILFFBQVFzRyxXQUFXLEtBQXpEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQTJEO0FBQUEsWUFDM0QsdUJBQUMsUUFBRyxXQUFVLFNBQVN0Tix3QkFBY2dILFFBQVFtRCxNQUFNLEtBQW5EO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXFEO0FBQUEsWUFDckQsdUJBQUMsUUFBRyxXQUFXLFNBQVNuRCxRQUFRckYsZ0JBQWdCLElBQUksYUFBYSxVQUFVLElBQ3hFc1IsMEJBQWdCLE1BQ2YsbUNBQ0dwVDtBQUFBQSw2QkFBZW1ILFFBQVFzRyxjQUFjdEcsUUFBUXJGLGdCQUFnQixNQUFNcUYsUUFBUXJGLGFBQWE7QUFBQSxjQUN6Rix1QkFBQyxVQUFEO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQUc7QUFBQSxjQUNILHVCQUFDLFdBQU9xRjtBQUFBQSx3QkFBUXJGLGdCQUFnQixJQUFJLE1BQU07QUFBQSxnQkFBSXFGLFFBQVFyRixhQUFhaVIsUUFBUSxDQUFDO0FBQUEsZ0JBQUU7QUFBQSxtQkFBOUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBK0U7QUFBQSxpQkFIakY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFJQSxLQU5KO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBUUE7QUFBQSxZQUNBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsV0FBVyxTQUFTNUwsUUFBUXVHLFlBQVksSUFBSSxhQUFhLFVBQVU7QUFBQSxnQkFFbEUxTjtBQUFBQSxpQ0FBZW1ILFFBQVF1RyxRQUFRO0FBQUEsa0JBQy9CLENBQUMwRixpQkFBaUJqTSxRQUFRVyxZQUFZLEtBQ3JDLG1DQUNFO0FBQUEsMkNBQUMsVUFBRDtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFHO0FBQUEsb0JBQ0gsdUJBQUMsV0FBT1g7QUFBQUEsOEJBQVF1RyxZQUFZLElBQUksTUFBTTtBQUFBLHVCQUFNdkcsUUFBUXVHLFdBQVd2RyxRQUFRVyxZQUFhLEtBQUtpTCxRQUFRLENBQUM7QUFBQSxzQkFBRTtBQUFBLHlCQUFwRztBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFxRztBQUFBLHVCQUZ2RztBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUdBO0FBQUE7QUFBQTtBQUFBLGNBUko7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBVUE7QUFBQSxZQUNBLHVCQUFDLFFBQUcsV0FBVSxTQUNYSywwQkFDQyxNQUVBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsTUFBSztBQUFBLGdCQUNMLFdBQVU7QUFBQSxnQkFDVixTQUFTLE1BQU01RCxjQUFjckksUUFBUXlHLEVBQUU7QUFBQSxnQkFBRTtBQUFBO0FBQUEsY0FIM0M7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBTUEsS0FWSjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQVlBO0FBQUEsZUFuRE96RyxRQUFReUcsSUFBakI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFvREE7QUFBQSxRQUVKLENBQUMsS0FqRUw7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQW1FQTtBQUFBLFdBckZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFzRkEsS0F2RkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQXdGQTtBQUFBLFNBdkdGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0F3R0E7QUFBQSxJQUdDdkosU0FBUyxZQUNWLG1DQUNFO0FBQUEsNkJBQUMsYUFBUSxXQUFVLGtCQUNqQjtBQUFBLCtCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEsaUNBQUMsVUFBSyxXQUFVLG1CQUFtQnJFLHlCQUFleU0sa0JBQWtCRSxhQUFhLEtBQWpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQW1GO0FBQUEsVUFDbkYsdUJBQUMsVUFBSyxXQUFVLHFCQUFvQiw4QkFBcEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBa0Q7QUFBQSxhQUZwRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBR0E7QUFBQSxRQUNBLHVCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEsaUNBQUMsVUFBSyxXQUFVLG1CQUFtQjNNLHlCQUFleU0sa0JBQWtCRyxXQUFXLEtBQS9FO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQWlGO0FBQUEsVUFDakYsdUJBQUMsVUFBSyxXQUFVLHFCQUFvQiw0QkFBcEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBZ0Q7QUFBQSxhQUZsRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBR0E7QUFBQSxRQUNBLHVCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEsaUNBQUMsVUFBSyxXQUFXLG1CQUFtQkgsa0JBQWtCRixZQUFZLElBQUksYUFBYSxVQUFVLElBQzFGRTtBQUFBQSw4QkFBa0JGLFlBQVksSUFBSSxNQUFNO0FBQUEsWUFBSXZNLGVBQWV5TSxrQkFBa0JGLFFBQVE7QUFBQSxlQUR4RjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUVBO0FBQUEsVUFDQSx1QkFBQyxVQUFLLFdBQVUscUJBQW9CLG1CQUFwQztBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUEyQztBQUFBLGFBSjdDO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFLQTtBQUFBLFFBQ0EsdUJBQUMsU0FBSSxXQUFVLGVBQ2I7QUFBQSxpQ0FBQyxVQUFLLFdBQVcsbUJBQW1CRSxrQkFBa0JELFVBQVUsSUFBSSxhQUFhLFVBQVUsSUFDeEZDO0FBQUFBLDhCQUFrQkQsVUFBVSxJQUFJLE1BQU07QUFBQSxZQUFJQyxrQkFBa0JELE9BQU91RyxRQUFRLENBQUM7QUFBQSxZQUFFO0FBQUEsZUFEakY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFFQTtBQUFBLFVBQ0EsdUJBQUMsVUFBSyxXQUFVLHFCQUFvQixPQUFNLCtEQUE2RCw0QkFBdkc7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFFQTtBQUFBLGFBTkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU9BO0FBQUEsUUFDQSx1QkFBQyxTQUFJLFdBQVUsZUFDYjtBQUFBLGlDQUFDLFVBQUssV0FBVyxtQkFBbUJ0RyxrQkFBa0JJLFdBQVcsSUFBSSxhQUFhLFVBQVUsSUFDekZKLDRCQUFrQlEsU0FBUyxJQUN4QixHQUFHUixrQkFBa0JJLFdBQVcsSUFBSSxNQUFNLEVBQUUsR0FBR0osa0JBQWtCSSxRQUFRa0csUUFBUSxDQUFDLENBQUMsTUFDbkYsT0FITjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUlBO0FBQUEsVUFDQSx1QkFBQyxVQUFLLFdBQVUscUJBQW9CLE9BQU0sc0pBQW9KLGlDQUE5TDtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUVBO0FBQUEsYUFSRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBU0E7QUFBQSxXQWhDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBaUNBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUsU0FDakI7QUFBQSwrQkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSxpQ0FBQyxTQUNDO0FBQUEsbUNBQUMsT0FBRSxXQUFVLGdCQUFlLGtDQUE1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUE4QztBQUFBLFlBQzlDLHVCQUFDLFFBQUcsK0JBQUo7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBbUI7QUFBQSxlQUZyQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUdBO0FBQUEsVUFDQSx1QkFBQyxVQUFLLFdBQVUsY0FBY3RHO0FBQUFBLDhCQUFrQlE7QUFBQUEsWUFBTTtBQUFBLGVBQXREO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQThEO0FBQUEsYUFMaEU7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU1BO0FBQUEsUUFDQSx1QkFBQyxVQUFLLFdBQVUsZUFBYyxVQUFVcUMsZUFDdEM7QUFBQSxpQ0FBQyxXQUFNLFdBQVUsU0FDZjtBQUFBLG1DQUFDLFVBQUssb0JBQU47QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBVTtBQUFBLFlBQ1Y7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxNQUFLO0FBQUEsZ0JBQ0wsT0FBTzVLLFlBQVlsQztBQUFBQSxnQkFDbkIsVUFBVSxDQUFDa1EsTUFBTS9OLGVBQWUsQ0FBQ29GLE9BQU8sRUFBRSxHQUFHQSxHQUFHdkgsTUFBTWtRLEVBQUU3SSxPQUFPdUUsTUFBTSxFQUFFO0FBQUE7QUFBQSxjQUh6RTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFHMkU7QUFBQSxlQUw3RTtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQU9BO0FBQUEsVUFDQSx1QkFBQyxXQUFNLFdBQVUsU0FDZjtBQUFBLG1DQUFDLFVBQUsscUJBQU47QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBVztBQUFBLFlBQ1g7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxNQUFLO0FBQUEsZ0JBQ0wsYUFBWTtBQUFBLGdCQUNaLE9BQU8xSixZQUFZakM7QUFBQUEsZ0JBQ25CLFVBQVUsQ0FBQ2lRLE1BQU0vTixlQUFlLENBQUNvRixPQUFPLEVBQUUsR0FBR0EsR0FBR3RILE9BQU9pUSxFQUFFN0ksT0FBT3VFLE1BQU0sRUFBRTtBQUFBO0FBQUEsY0FKMUU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBSTRFO0FBQUEsZUFOOUU7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFRQTtBQUFBLFVBQ0EsdUJBQUMsV0FBTSxXQUFVLFNBQ2Y7QUFBQSxtQ0FBQyxVQUFLLDRCQUFOO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQWtCO0FBQUEsWUFDbEI7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxNQUFLO0FBQUEsZ0JBQ0wsTUFBSztBQUFBLGdCQUNMLGFBQVk7QUFBQSxnQkFDWixPQUFPMUosWUFBWWhDLFdBQVcsSUFBSSxLQUFLZ0MsWUFBWWhDO0FBQUFBLGdCQUNuRCxVQUFVLENBQUNnUSxNQUFNL04sZUFBZSxDQUFDb0YsT0FBTyxFQUFFLEdBQUdBLEdBQUdySCxRQUFRZ0gsT0FBT2dKLEVBQUU3SSxPQUFPdUUsS0FBSyxFQUFFLEVBQUU7QUFBQTtBQUFBLGNBTG5GO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQUtxRjtBQUFBLGVBUHZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBU0E7QUFBQSxVQUNBLHVCQUFDLFdBQU0sV0FBVSxTQUNmO0FBQUEsbUNBQUMsVUFBSTtBQUFBO0FBQUEsY0FFSDtBQUFBLGdCQUFDO0FBQUE7QUFBQSxrQkFDQyxNQUFLO0FBQUEsa0JBQ0wsV0FBVTtBQUFBLGtCQUNWLFNBQVMsTUFBTXpKLGVBQWUsQ0FBQ29GLE9BQU8sRUFBRSxHQUFHQSxHQUFHcEgsVUFBVW1FLFVBQVVTLFdBQVcsRUFBRTtBQUFBLGtCQUMvRSxPQUFNO0FBQUEsa0JBQXlDO0FBQUE7QUFBQSxnQkFKakQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGNBT0E7QUFBQSxpQkFURjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQVVBO0FBQUEsWUFDQTtBQUFBLGNBQUM7QUFBQTtBQUFBLGdCQUNDLE1BQUs7QUFBQSxnQkFDTCxNQUFLO0FBQUEsZ0JBQ0wsS0FBSztBQUFBLGdCQUNMLGFBQVk7QUFBQSxnQkFDWixPQUFPN0MsWUFBWS9CLGFBQWEsSUFBSSxLQUFLK0IsWUFBWS9CO0FBQUFBLGdCQUNyRCxVQUFVLENBQUMrUCxNQUFNL04sZUFBZSxDQUFDb0YsT0FBTyxFQUFFLEdBQUdBLEdBQUdwSCxVQUFVK0csT0FBT2dKLEVBQUU3SSxPQUFPdUUsS0FBSyxFQUFFLEVBQUU7QUFBQTtBQUFBLGNBTnJGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQU11RjtBQUFBLGVBbEJ6RjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQW9CQTtBQUFBLFVBQ0EsdUJBQUMsWUFBTyxNQUFLLFVBQVMsV0FBVSx5Q0FBd0MsbUJBQXhFO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQTJFO0FBQUEsYUFqRDdFO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFrREE7QUFBQSxRQUNDeEosY0FBYyx1QkFBQyxPQUFFLFdBQVUsY0FBY0EseUJBQTNCO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBdUMsSUFBTztBQUFBLFdBM0QvRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBNERBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUsU0FDakI7QUFBQSwrQkFBQyxTQUFJLFdBQVUsZ0JBQ2IsaUNBQUMsU0FDQztBQUFBLGlDQUFDLE9BQUUsV0FBVSxnQkFBZSxxQkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBaUM7QUFBQSxVQUNqQyx1QkFBQyxRQUFHLGlDQUFKO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQXlCO0FBQUEsYUFGM0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUdBLEtBSkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUtBO0FBQUEsUUFDQSx1QkFBQyxtQkFBZ0IsTUFBTXFILGtCQUF2QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQXNDO0FBQUEsV0FQeEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQVFBO0FBQUEsTUFFQSx1QkFBQyxhQUFRLFdBQVUscUJBQ2pCO0FBQUEsK0JBQUMsU0FBSSxXQUFVLGdCQUNiLGlDQUFDLFNBQ0M7QUFBQSxpQ0FBQyxPQUFFLFdBQVUsZ0JBQWUsdUJBQTVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQW1DO0FBQUEsVUFDbkMsdUJBQUMsUUFBRyxrQ0FBSjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFzQjtBQUFBLGFBRnhCO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFHQSxLQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFLQTtBQUFBLFFBQ0EsdUJBQUMsU0FBSSxXQUFVLGdCQUNiLGlDQUFDLFdBQU0sV0FBVSxrQkFDZjtBQUFBLGlDQUFDLFdBQ0MsaUNBQUMsUUFDQztBQUFBLG1DQUFDLFFBQUcsb0JBQUo7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBUTtBQUFBLFlBQ1IsdUJBQUMsUUFBRyxxQkFBSjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFTO0FBQUEsWUFDVCx1QkFBQyxRQUFHLFdBQVUsU0FBUSxzQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBNEI7QUFBQSxZQUM1Qix1QkFBQyxRQUFHLFdBQVUsU0FBUSxxQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBMkI7QUFBQSxZQUMzQix1QkFBQyxRQUFHLFdBQVUsU0FBUSx5QkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBK0I7QUFBQSxZQUMvQix1QkFBQyxRQUFHLFdBQVUsU0FBUSxtQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBNkI7QUFBQSxZQUM3Qix1QkFBQyxRQUFHLFdBQVUsU0FBUSxxQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBK0I7QUFBQSxZQUMvQix1QkFBQyxRQUFHLFdBQVUsU0FBUSxzQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBNEI7QUFBQSxlQVI5QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQVNBLEtBVkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFXQTtBQUFBLFVBQ0EsdUJBQUMsV0FDRUEseUJBQWVULFdBQVcsSUFDekIsdUJBQUMsUUFDQyxpQ0FBQyxRQUFHLFNBQVMsR0FBRyxXQUFVLGVBQWEsMkVBQXZDO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBRUEsS0FIRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUlBLElBRUFTLGVBQWUvQjtBQUFBQSxZQUFJLENBQUMyQixRQUNsQix1QkFBQyxRQUNDO0FBQUEscUNBQUMsUUFBSUEsY0FBSXJKLFFBQVQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBYztBQUFBLGNBQ2QsdUJBQUMsUUFBSXFKLGNBQUlwSixTQUFUO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQWU7QUFBQSxjQUNmLHVCQUFDLFFBQUcsV0FBVyxTQUFTb0osSUFBSW5KLFVBQVUsSUFBSSxLQUFLLFVBQVUsSUFDdEQxQyx5QkFBZTZMLElBQUluSixNQUFNLEtBRDVCO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBRUE7QUFBQSxjQUNBLHVCQUFDLFFBQUcsV0FBVSxTQUFTMUMseUJBQWU2TCxJQUFJdEMsS0FBSyxLQUEvQztBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFpRDtBQUFBLGNBQ2pELHVCQUFDLFFBQUcsV0FBVSxTQUFTdkoseUJBQWU2TCxJQUFJbEosUUFBUSxLQUFsRDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFvRDtBQUFBLGNBQ3BELHVCQUFDLFFBQUcsV0FBVyxTQUFTa0osSUFBSVUsWUFBWSxJQUFJLGFBQWEsVUFBVSxJQUNoRVY7QUFBQUEsb0JBQUlVLFlBQVksSUFBSSxNQUFNO0FBQUEsZ0JBQUl2TSxlQUFlNkwsSUFBSVUsUUFBUTtBQUFBLG1CQUQ1RDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUVBO0FBQUEsY0FDQSx1QkFBQyxRQUFHLFdBQVcsU0FBU1YsSUFBSVcsVUFBVSxJQUFJLGFBQWEsVUFBVSxJQUM5RFg7QUFBQUEsb0JBQUlXLFVBQVUsSUFBSSxNQUFNO0FBQUEsZ0JBQUlYLElBQUlXLE9BQU91RyxRQUFRLENBQUM7QUFBQSxnQkFBRTtBQUFBLG1CQURyRDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUVBO0FBQUEsY0FDQSx1QkFBQyxRQUFHLFdBQVUsU0FDWjtBQUFBLGdCQUFDO0FBQUE7QUFBQSxrQkFDQyxNQUFLO0FBQUEsa0JBQ0wsV0FBVTtBQUFBLGtCQUNWLFNBQVMsTUFBTXhELGlCQUFpQjFELElBQUkrQixFQUFFO0FBQUEsa0JBQUU7QUFBQTtBQUFBLGdCQUgxQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FNQSxLQVBGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBUUE7QUFBQSxpQkF0Qk8vQixJQUFJK0IsSUFBYjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQXVCQTtBQUFBLFVBQ0QsS0FqQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFtQ0E7QUFBQSxhQWhERjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBaURBLEtBbERGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFtREE7QUFBQSxXQTFERjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBMkRBO0FBQUEsU0F2S0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQXdLQTtBQUFBLE9BbjZCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBcTZCQTtBQUVKO0FBQUMvSyxHQXYrQ1FELEtBQUc7QUFBQSxLQUFIQTtBQXkrQ1QsU0FBUzBRLE1BQU07QUFBQSxFQUNiN1E7QUFBQUEsRUFDQTJMO0FBQUFBLEVBQ0FtRjtBQUFBQSxFQUNBQztBQUFBQSxFQUNBdkMsT0FBTztBQUFBLEVBQ1B3QztBQUFBQSxFQUNBM0g7QUFBQUEsRUFDQTRIO0FBVUYsR0FBRztBQUNELFNBQ0UsdUJBQUMsV0FBTSxXQUFVLFNBQ2Y7QUFBQSwyQkFBQyxVQUFNalIsbUJBQVA7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUFhO0FBQUEsSUFDYjtBQUFBLE1BQUM7QUFBQTtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0EsVUFBVSxDQUFDcU0sVUFBVXlFLFNBQVN6RSxNQUFNakYsT0FBT3VFLEtBQUs7QUFBQTtBQUFBLE1BUGxEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9vRDtBQUFBLE9BVHREO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FXQTtBQUVKO0FBQUN1RixNQWpDUUw7QUFtQ1QsU0FBU3RRLGVBQTBCO0FBQ2pDLE1BQUksT0FBT2dELFdBQVcsYUFBYTtBQUNqQyxXQUFPekYsZUFBZTJKLElBQUkwRSxnQkFBZ0I7QUFBQSxFQUM1QztBQUVBLFFBQU1nRixNQUFNNU4sT0FBT0MsYUFBYTROLFFBQVFyVCxVQUFVO0FBQ2xELE1BQUksQ0FBQ29ULEtBQUs7QUFDUixXQUFPclQsZUFBZTJKLElBQUkwRSxnQkFBZ0I7QUFBQSxFQUM1QztBQUVBLE1BQUk7QUFDRixVQUFNa0YsU0FBUzNOLEtBQUs2TCxNQUFNNEIsR0FBRztBQUM3QixXQUFPbk4sTUFBTUMsUUFBUW9OLE1BQU0sSUFDdkJBLE9BQU81SixJQUFJMEUsZ0JBQWdCLElBQzNCck8sZUFBZTJKLElBQUkwRSxnQkFBZ0I7QUFBQSxFQUN6QyxRQUFRO0FBQ04sV0FBT3JPLGVBQWUySixJQUFJMEUsZ0JBQWdCO0FBQUEsRUFDNUM7QUFDRjtBQUVBLFNBQVN2TCxrQkFBK0I7QUFDdEMsTUFBSSxPQUFPMkMsV0FBVyxhQUFhO0FBQ2pDLFdBQU8vRDtBQUFBQSxFQUNUO0FBRUEsUUFBTTJSLE1BQU01TixPQUFPQyxhQUFhNE4sUUFBUTFTLGNBQWM7QUFDdEQsTUFBSSxDQUFDeVMsS0FBSztBQUNSLFdBQU8zUjtBQUFBQSxFQUNUO0FBRUEsTUFBSTtBQUNGLFVBQU02UixTQUFTM04sS0FBSzZMLE1BQU00QixHQUFHO0FBQzdCLFdBQU87QUFBQSxNQUNMMVIsV0FBV3dILE9BQU9vSyxPQUFPNVIsYUFBYSxDQUFDO0FBQUEsSUFDekM7QUFBQSxFQUNGLFFBQVE7QUFDTixXQUFPRDtBQUFBQSxFQUNUO0FBQ0Y7QUFFQSxTQUFTdUIsY0FBa0M7QUFDekMsTUFBSSxPQUFPd0MsV0FBVyxhQUFhO0FBQ2pDLFdBQU87QUFBQSxFQUNUO0FBRUEsUUFBTTROLE1BQU01TixPQUFPQyxhQUFhNE4sUUFBUXpTLGdCQUFnQjtBQUN4RCxNQUFJLENBQUN3UyxLQUFLO0FBQ1IsV0FBTztBQUFBLEVBQ1Q7QUFFQSxNQUFJO0FBQ0YsVUFBTUUsU0FBUzNOLEtBQUs2TCxNQUFNNEIsR0FBRztBQUM3QixXQUFPbk4sTUFBTUMsUUFBUW9OLE1BQU0sSUFBSUEsU0FBUztBQUFBLEVBQzFDLFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUNGO0FBRUEsU0FBU3JQLGtCQUFxQztBQUM1QyxNQUFJLE9BQU91QixXQUFXLGFBQWE7QUFDakMsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNNE4sTUFBTTVOLE9BQU9DLGFBQWE0TixRQUFReFMsZ0JBQWdCO0FBQ3hELE1BQUksQ0FBQ3VTLEtBQUs7QUFDUixXQUFPO0FBQUEsRUFDVDtBQUVBLE1BQUk7QUFDRixVQUFNRSxTQUFTM04sS0FBSzZMLE1BQU00QixHQUFHO0FBQzdCLFdBQU9uTixNQUFNQyxRQUFRb04sTUFBTSxJQUFJQSxTQUFTO0FBQUEsRUFDMUMsUUFBUTtBQUNOLFdBQU87QUFBQSxFQUNUO0FBQ0Y7QUFFQSxTQUFTOU8sY0FBbUM7QUFDMUMsTUFBSSxPQUFPZ0IsV0FBVyxZQUFhLFFBQU87QUFDMUMsUUFBTTROLE1BQU01TixPQUFPQyxhQUFhNE4sUUFBUXZTLGlCQUFpQjtBQUN6RCxNQUFJLENBQUNzUyxJQUFLLFFBQU87QUFDakIsTUFBSTtBQUNGLFVBQU1FLFNBQVMzTixLQUFLNkwsTUFBTTRCLEdBQUc7QUFDN0IsV0FBT25OLE1BQU1DLFFBQVFvTixNQUFNLElBQUlBLFNBQVM7QUFBQSxFQUMxQyxRQUFRO0FBQ04sV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUlBLFNBQVNDLFFBQVF2TCxLQUFXO0FBQzFCLFFBQU13TCxNQUFNLElBQUk1SyxLQUFLQyxlQUFlLFNBQVM7QUFBQSxJQUMzQzRLLFVBQVU7QUFBQSxJQUNWbEwsTUFBTTtBQUFBLElBQ05DLE9BQU87QUFBQSxJQUNQa0wsS0FBSztBQUFBLElBQ0xDLE1BQU07QUFBQSxJQUNOQyxRQUFRO0FBQUEsSUFDUkMsUUFBUTtBQUFBLElBQ1JDLFNBQVM7QUFBQSxFQUNYLENBQUM7QUFDRCxRQUFNQyxRQUFRQyxPQUFPQztBQUFBQSxJQUNuQlQsSUFBSVUsY0FBY2xNLEdBQUcsRUFBRTBCLElBQUksQ0FBQ3lLLE1BQU0sQ0FBQ0EsRUFBRTFELE1BQU0wRCxFQUFFdkcsS0FBSyxDQUFDO0FBQUEsRUFDckQ7QUFDQSxTQUFPO0FBQUEsSUFDTDVMLE1BQU0sR0FBRytSLE1BQU14TCxJQUFJLElBQUl3TCxNQUFNdkwsS0FBSyxJQUFJdUwsTUFBTUwsR0FBRztBQUFBLElBQy9DQyxNQUFNekssT0FBTzZLLE1BQU1KLElBQUk7QUFBQSxJQUN2QkMsUUFBUTFLLE9BQU82SyxNQUFNSCxNQUFNO0FBQUEsSUFDM0JFLFNBQVNDLE1BQU1EO0FBQUFBLEVBQ2pCO0FBQ0Y7QUFFQSxTQUFTL0QsZUFBZS9ILE1BQVksb0JBQUlDLEtBQUssR0FBRztBQUM5QyxRQUFNa00sSUFBSVosUUFBUXZMLEdBQUc7QUFDckIsUUFBTTRILFlBQVksQ0FBQyxDQUFDLE9BQU8sS0FBSyxFQUFFOUMsU0FBU3FILEVBQUVMLE9BQU87QUFDcEQsUUFBTWpFLGFBQWFzRSxFQUFFUixPQUFPLE1BQU9RLEVBQUVSLFNBQVMsTUFBTVEsRUFBRVAsVUFBVTtBQUNoRSxTQUFPLEVBQUVoRSxXQUFXQyxZQUFZQyxRQUFRcUUsRUFBRW5TLEtBQUs7QUFDakQ7QUFFQSxTQUFTaU8sU0FBU21FLEtBQXFCO0FBQ3JDLFFBQU1oTSxJQUFJLElBQUlILEtBQUttTSxHQUFHO0FBQ3RCLE1BQUlsTCxPQUFPbUwsTUFBTWpNLEVBQUVnQixRQUFRLENBQUMsRUFBRyxRQUFPZ0wsSUFBSXZNLE1BQU0sR0FBRyxFQUFFO0FBQ3JELFNBQU8wTCxRQUFRbkwsQ0FBQyxFQUFFcEc7QUFDcEI7QUFFQSxTQUFTb00saUJBQWlCekgsU0FBMkI7QUFDbkQsU0FBTztBQUFBLElBQ0wsR0FBR0E7QUFBQUEsSUFDSHJGLGNBQWM0SCxPQUFPdkMsUUFBUXJGLGdCQUFnQixDQUFDO0FBQUEsSUFDOUNDLGtCQUFrQjJILE9BQU92QyxRQUFRcEYsb0JBQW9CLENBQUM7QUFBQSxJQUN0REMsWUFBWW1GLFFBQVFuRixjQUFjO0FBQUEsRUFDcEM7QUFDRjtBQUVBLFNBQVNrTyxjQUFjekYsR0FBcUI7QUFDMUMsTUFBSUEsRUFBRW1ELElBQUlDLFdBQVcsT0FBTyxFQUFHLFFBQU87QUFDdEMsUUFBTXJNLFVBQVVpSixFQUFFakosVUFBVSxJQUFJNEwsS0FBSyxFQUFFNEIsWUFBWTtBQUNuRCxRQUFNdE4sVUFBVStJLEVBQUUvSSxVQUFVLElBQUkwTCxLQUFLLEVBQUVoRyxZQUFZO0FBQ25ELFNBQU81RixXQUFXLFVBQVVFLFdBQVc7QUFDekM7QUFFQSxTQUFTbUYsc0JBQ1AvRCxVQUNBNkQsTUFDVztBQUNYLFFBQU0rSSxVQUFVNU0sU0FBU29FLE9BQU8sQ0FBQ0MsWUFBWSxDQUFDQSxRQUFReUcsR0FBR0MsV0FBVyxPQUFPLENBQUM7QUFFNUUsTUFBSWxILEtBQUt6RSxhQUFhLEVBQUcsUUFBT3dOO0FBRWhDLFFBQU1vRixlQUF3QjtBQUFBLElBQzVCbEgsSUFBSTtBQUFBLElBQ0pwTSxRQUFRO0FBQUEsSUFDUkMsTUFBTTtBQUFBLElBQ05DLFFBQVE7QUFBQSxJQUNSdU4sU0FBUztBQUFBLElBQ1R0TixRQUFRO0FBQUEsSUFDUkMsT0FBTytFLEtBQUt6RTtBQUFBQSxJQUNaTCxXQUFXOEUsS0FBS3pFO0FBQUFBLElBQ2hCSixjQUFjO0FBQUEsSUFDZEMsa0JBQWtCO0FBQUEsSUFDbEJDLFlBQVk7QUFBQSxFQUNkO0FBRUEsU0FBTyxDQUFDOFMsY0FBYyxHQUFHcEYsT0FBTztBQUNsQztBQUVBLFNBQVMxSSxtQkFDUGxFLFVBQ2dCO0FBQ2hCLFFBQU1vSCxNQUFNLG9CQUFJQyxJQUEwQjtBQUUxQyxhQUFXaEQsV0FBV3JFLFVBQVU7QUFDOUIsVUFBTTBELFVBQVUwRCxJQUFJVyxJQUFJMUQsUUFBUXpGLE1BQU0sS0FBSztBQUFBLE1BQ3pDQSxRQUFReUYsUUFBUXpGO0FBQUFBLE1BQ2hCME0sT0FBTztBQUFBLE1BQ1A5RCxRQUFRO0FBQUEsTUFDUnhILFVBQVU7QUFBQSxJQUNaO0FBQ0EwRCxZQUFRNEgsU0FBU2pILFFBQVFzRztBQUN6QmpILFlBQVE4RCxVQUFVbkQsUUFBUW1EO0FBQzFCOUQsWUFBUTFELFlBQVk7QUFDcEJvSCxRQUFJRyxJQUFJbEQsUUFBUXpGLFFBQVE4RSxPQUFPO0FBQUEsRUFDakM7QUFFQSxTQUFPLENBQUMsR0FBRzBELElBQUk2SyxPQUFPLENBQUMsRUFBRTlNLEtBQUssQ0FBQ0MsTUFBTUMsVUFBVUEsTUFBTWlHLFFBQVFsRyxLQUFLa0csS0FBSztBQUN6RTtBQUVBLFNBQVMzRyxzQkFBc0JILFlBQTRCO0FBQ3pELE1BQUlBLGNBQWMsTUFBTTtBQUN0QixXQUFPO0FBQUEsRUFDVDtBQUVBLE1BQUlBLGNBQWMsS0FBSztBQUNyQixXQUFPO0FBQUEsRUFDVDtBQUVBLFNBQU87QUFDVDtBQUVBLFNBQVMwTixTQUFTO0FBQUEsRUFDaEJ2UztBQUFBQSxFQUNBMkw7QUFBQUEsRUFDQTZHO0FBQUFBLEVBQ0FDLE9BQU87QUFNVCxHQUFHO0FBQ0QsU0FDRSx1QkFBQyxhQUFRLFdBQVcsYUFBYUEsSUFBSSxJQUNuQztBQUFBLDJCQUFDLE9BQUd6UyxtQkFBSjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQVU7QUFBQSxJQUNWLHVCQUFDLFlBQVEyTCxtQkFBVDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQWU7QUFBQSxJQUNmLHVCQUFDLFVBQU02RyxvQkFBUDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQWM7QUFBQSxPQUhoQjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBSUE7QUFFSjtBQUFDRSxNQWxCUUg7QUFvQlQsU0FBU0ksU0FBUztBQUFBLEVBQ2hCdFM7QUFHRixHQUFHO0FBQUF1UyxNQUFBO0FBQ0QsUUFBTSxDQUFDQyxTQUFTQyxVQUFVLElBQUk1VixTQUF3QixJQUFJO0FBQzFELFFBQU02VixNQUFNO0FBQ1osUUFBTUMsT0FBTztBQUNiLFFBQU1DLFNBQVM7QUFDZixRQUFNQyxVQUFVRixPQUFPQyxVQUFVO0FBQ2pDLFFBQU1FLGdCQUFnQixJQUFJMUssS0FBSzJLLEtBQUtGO0FBQ3BDLFFBQU1wTyxhQUFhekUsU0FBUzZFO0FBQUFBLElBQzFCLENBQUNDLEtBQUtULFlBQVlTLE1BQU1ULFFBQVFzRztBQUFBQSxJQUNoQztBQUFBLEVBQ0Y7QUFDQSxNQUFJcUksYUFBYTtBQUVqQixNQUFJdk8sZUFBZSxHQUFHO0FBQ3BCLFdBQU8sdUJBQUMsU0FBSSxXQUFVLGVBQWMsK0JBQTdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBNEM7QUFBQSxFQUNyRDtBQUVBLFFBQU13TyxpQkFBaUJULFlBQVksT0FBT3hTLFNBQVN3UyxPQUFPLElBQUk7QUFFOUQsU0FDRSx1QkFBQyxTQUFJLFdBQVUsY0FDYjtBQUFBLDJCQUFDLFNBQUksV0FBVSxtQkFDYjtBQUFBO0FBQUEsUUFBQztBQUFBO0FBQUEsVUFDQyxTQUFTLEdBQUcsQ0FBQ0UsR0FBRyxJQUFJLENBQUNBLEdBQUcsSUFBSUMsT0FBT0QsTUFBTSxDQUFDLElBQUlDLE9BQU9ELE1BQU0sQ0FBQztBQUFBLFVBQzVELFdBQVU7QUFBQSxVQUNWLE1BQUs7QUFBQSxVQUNMLGNBQVc7QUFBQSxVQUNYLGNBQWMsTUFBTUQsV0FBVyxJQUFJO0FBQUEsVUFFbkM7QUFBQSxtQ0FBQyxZQUFPLElBQUlFLE9BQU8sR0FBRyxJQUFJQSxPQUFPLEdBQUcsR0FBR0UsUUFBUSxXQUFVLGNBQXpEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQW1FO0FBQUEsWUFDbEU3UyxTQUFTb0gsSUFBSSxDQUFDL0MsU0FBUzZPLFVBQVU7QUFDaEMsb0JBQU1DLGFBQWE5TyxRQUFRbUQsU0FBU3NMO0FBQ3BDLG9CQUFNTSxnQkFBZ0JKO0FBQ3RCQSw0QkFBY0c7QUFDZCxvQkFBTUUsWUFBWWIsWUFBWVU7QUFDOUIsb0JBQU1JLFdBQVdkLFlBQVksUUFBUSxDQUFDYTtBQUN0QyxxQkFDRTtBQUFBLGdCQUFDO0FBQUE7QUFBQSxrQkFFQyxJQUFJVixPQUFPO0FBQUEsa0JBQ1gsSUFBSUEsT0FBTztBQUFBLGtCQUNYLEdBQUdFO0FBQUFBLGtCQUNILFdBQVcsYUFBYVEsWUFBWSxzQkFBc0IsRUFBRSxJQUFJQyxXQUFXLG1CQUFtQixFQUFFO0FBQUEsa0JBQ2hHLE9BQ0U7QUFBQSxvQkFDRUMsaUJBQWlCLEdBQUdKLFVBQVUsSUFBSUwsZ0JBQWdCSyxVQUFVO0FBQUEsb0JBQzVESyxrQkFBa0IsQ0FBQ0o7QUFBQUEsb0JBQ25CLENBQUMsZUFBd0IsR0FBR0ssY0FBY1AsS0FBSztBQUFBLGtCQUNqRDtBQUFBLGtCQUVGLGNBQWMsTUFBTVQsV0FBV1MsS0FBSztBQUFBO0FBQUEsZ0JBWi9CN08sUUFBUTNGO0FBQUFBLGdCQURmO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0Fhd0M7QUFBQSxZQUc1QyxDQUFDO0FBQUE7QUFBQTtBQUFBLFFBL0JIO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWdDQTtBQUFBLE1BQ0N1VSxpQkFDQyx1QkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSwrQkFBQyxZQUFRQSx5QkFBZXZVLFVBQXhCO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBK0I7QUFBQSxRQUMvQix1QkFBQyxVQUFNeEIseUJBQWUrVixlQUFldEksV0FBVyxLQUFoRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQWtEO0FBQUEsUUFDbEQsdUJBQUMsV0FBT3ROLHdCQUFjNFYsZUFBZXpMLE1BQU0sS0FBM0M7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUE2QztBQUFBLFdBSC9DO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFJQSxJQUVBLHVCQUFDLFNBQUksV0FBVSxnQkFDYjtBQUFBLCtCQUFDLFlBQU8scUJBQVI7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUFhO0FBQUEsUUFDYix1QkFBQyxVQUFNdEsseUJBQWV1SCxVQUFVLEtBQWhDO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBa0M7QUFBQSxRQUNsQyx1QkFBQyxXQUFPekU7QUFBQUEsbUJBQVMwSTtBQUFBQSxVQUFPO0FBQUEsYUFBeEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUFrQztBQUFBLFdBSHBDO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFJQTtBQUFBLFNBN0NKO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0ErQ0E7QUFBQSxJQUVBLHVCQUFDLFNBQUksV0FBVSxjQUNaMUksbUJBQVN1RixNQUFNLEdBQUcsQ0FBQyxFQUFFNkI7QUFBQUEsTUFBSSxDQUFDL0MsU0FBUzZPLFVBQ2xDO0FBQUEsUUFBQztBQUFBO0FBQUEsVUFFQyxXQUFXLGNBQWNWLFlBQVlVLFFBQVEsdUJBQXVCLEVBQUUsSUFBSVYsWUFBWSxRQUFRQSxZQUFZVSxRQUFRLG9CQUFvQixFQUFFO0FBQUEsVUFDeEksY0FBYyxNQUFNVCxXQUFXUyxLQUFLO0FBQUEsVUFDcEMsY0FBYyxNQUFNVCxXQUFXLElBQUk7QUFBQSxVQUVuQztBQUFBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsV0FBVTtBQUFBLGdCQUNWLE9BQU8sRUFBRWlCLFlBQVlELGNBQWNQLEtBQUssRUFBRTtBQUFBO0FBQUEsY0FGNUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBRThDO0FBQUEsWUFFOUMsdUJBQUMsU0FDQztBQUFBLHFDQUFDLFlBQVE3TyxrQkFBUTNGLFVBQWpCO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQXdCO0FBQUEsY0FDeEIsdUJBQUMsVUFBTXJCO0FBQUFBLDhCQUFjZ0gsUUFBUW1ELE1BQU07QUFBQSxnQkFBRTtBQUFBLG1CQUFyQztBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFrRDtBQUFBLGlCQUZwRDtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUdBO0FBQUE7QUFBQTtBQUFBLFFBWktuRCxRQUFRM0Y7QUFBQUEsUUFEZjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BY0E7QUFBQSxJQUNELEtBakJIO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FrQkE7QUFBQSxPQXBFRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBcUVBO0FBRUo7QUFBQzZULElBL0ZRRCxVQUFRO0FBQUEsTUFBUkE7QUFpR1QsU0FBU21CLGNBQWNQLE9BQXVCO0FBQzVDLFFBQU1TLFVBQVU7QUFBQSxJQUNkO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQVM7QUFFWCxTQUFPQSxRQUFRVCxRQUFRUyxRQUFRakwsTUFBTTtBQUN2QztBQUVBLFNBQVNrTCxTQUFTO0FBQUEsRUFDaEJ0STtBQUFBQSxFQUNBbUY7QUFBQUEsRUFDQW9EO0FBQUFBLEVBQ0FuRDtBQU1GLEdBQUc7QUFBQW9ELE1BQUE7QUFDRCxRQUFNLENBQUNDLE1BQU1DLE9BQU8sSUFBSW5YLFNBQVMsS0FBSztBQUN0QyxRQUFNb1gsTUFBTXJYLE9BQXVCLElBQUk7QUFFdkNGLFlBQVUsTUFBTTtBQUNkLGFBQVN3WCxXQUFXdEUsR0FBZTtBQUNqQyxVQUFJcUUsSUFBSXZRLFdBQVcsQ0FBQ3VRLElBQUl2USxRQUFReVEsU0FBU3ZFLEVBQUU3SSxNQUFjLEVBQUdpTixTQUFRLEtBQUs7QUFBQSxJQUMzRTtBQUNBekYsYUFBUzZGLGlCQUFpQixhQUFhRixVQUFVO0FBQ2pELFdBQU8sTUFBTTNGLFNBQVM4RixvQkFBb0IsYUFBYUgsVUFBVTtBQUFBLEVBQ25FLEdBQUcsRUFBRTtBQUVMLFFBQU0zSixXQUFXc0osUUFBUXpQO0FBQUFBLElBQU8sQ0FBQ2tRLE1BQy9CLENBQUNoSixRQUFRLE9BQU9nSixFQUFFaFEsWUFBWSxFQUFFa0csU0FBU2MsTUFBTWhILFlBQVksQ0FBQztBQUFBLEVBQzlEO0FBRUEsU0FDRSx1QkFBQyxTQUFJLFdBQVUsWUFBVyxLQUN4QjtBQUFBO0FBQUEsTUFBQztBQUFBO0FBQUEsUUFDQztBQUFBLFFBQ0EsVUFBVSxDQUFDc0wsTUFBTTtBQUNmYSxtQkFBU2IsRUFBRTdJLE9BQU91RSxLQUFLO0FBQ3ZCMEksa0JBQVEsSUFBSTtBQUFBLFFBQ2Q7QUFBQSxRQUNBLFNBQVMsTUFBTUEsUUFBUSxJQUFJO0FBQUEsUUFDM0I7QUFBQSxRQUNBLGNBQWE7QUFBQTtBQUFBLE1BUmY7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBUW9CO0FBQUEsSUFFbkJELFFBQVF4SixTQUFTN0IsU0FBUyxLQUN6Qix1QkFBQyxTQUFJLFdBQVUsaUJBQ1o2QixtQkFBU2hGLE1BQU0sR0FBRyxFQUFFLEVBQUU2QjtBQUFBQSxNQUFJLENBQUNtTixRQUMxQjtBQUFBLFFBQUM7QUFBQTtBQUFBLFVBRUMsTUFBSztBQUFBLFVBQ0wsV0FBVyxtQkFBbUJBLFFBQVFqSixRQUFRLDRCQUE0QixFQUFFO0FBQUEsVUFDNUUsYUFBYSxDQUFDc0UsTUFBTTtBQUNsQkEsY0FBRTNELGVBQWU7QUFDakJ3RSxxQkFBUzhELEdBQUc7QUFDWlAsb0JBQVEsS0FBSztBQUFBLFVBQ2Y7QUFBQSxVQUVDTztBQUFBQTtBQUFBQSxRQVRJQTtBQUFBQSxRQURQO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXQTtBQUFBLElBQ0QsS0FkSDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBZUE7QUFBQSxPQTNCSjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBNkJBO0FBRUo7QUFBQ1QsSUExRFFGLFVBQVE7QUFBQSxNQUFSQTtBQTREVCxTQUFTWSxXQUFXO0FBQUEsRUFDbEI3VTtBQUFBQSxFQUNBOFU7QUFBQUEsRUFDQXRQO0FBQUFBLEVBQ0F1UDtBQUFBQSxFQUNBQztBQU9GLEdBQUc7QUFDRCxRQUFNQyxTQUFTelAsS0FBSzVGLFFBQVFrVjtBQUM1QixRQUFNSSxRQUFRRCxTQUFVelAsS0FBSzVDLFFBQVEsUUFBUSxPQUFPLE9BQVE7QUFDNUQsU0FDRSx1QkFBQyxRQUFHLFdBQVdvUyxVQUFVLFVBQVUsbUJBQW1CLFlBQ3BELGlDQUFDLFlBQU8sTUFBSyxVQUFTLFdBQVUsWUFBVyxTQUFTLE1BQU1ELFFBQVFELE9BQU8sR0FDdEU5VTtBQUFBQTtBQUFBQSxJQUNELHVCQUFDLFVBQUssV0FBVSxjQUFja1YsbUJBQTlCO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBb0M7QUFBQSxPQUZ0QztBQUFBO0FBQUE7QUFBQTtBQUFBLFNBR0EsS0FKRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBS0E7QUFFSjtBQUFDQyxNQXZCUU47QUF5QlQsU0FBU08sVUFBVTtBQUFBLEVBQ2pCN0U7QUFBQUEsRUFDQThFO0FBQUFBLEVBQ0F2TztBQWVGLEdBQUc7QUFDRCxRQUFNd08sU0FBU3hPLFFBQVEsSUFBSzJCLEtBQUtDLElBQUk2SCxLQUFLaEksUUFBUSxJQUFJekIsUUFBUyxNQUFNO0FBQ3JFLFNBQ0UsdUJBQUMsU0FBSSxXQUFXLDBCQUEwQnVPLElBQUksSUFDNUM7QUFBQSwyQkFBQyxTQUFJLFdBQVUsbUJBQ2I7QUFBQSw2QkFBQyxZQUFROUUsZUFBSzNRLE9BQWQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUFrQjtBQUFBLE1BQ2xCLHVCQUFDLFVBQUssV0FBVSxtQkFBbUIyUSxlQUFLNVEsUUFBeEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUE2QztBQUFBLE1BQzdDLHVCQUFDLFVBQUssV0FBVSxxQkFBcUJwQyx5QkFBZWtMLEtBQUtDLElBQUk2SCxLQUFLaEksUUFBUSxDQUFDLEtBQTNFO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBNkU7QUFBQSxTQUgvRTtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBSUE7QUFBQSxJQUNBLHVCQUFDLFNBQUksV0FBVSxxQkFDYjtBQUFBLDZCQUFDLFVBQ0U3SztBQUFBQSxzQkFBYzZTLEtBQUtwSSxhQUFhO0FBQUEsUUFBRTtBQUFBLFFBQUl6SyxjQUFjNlMsS0FBS2pJLFlBQVk7QUFBQSxXQUR4RTtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBRUE7QUFBQSxNQUNDaUksS0FBSzVRLFNBQVMsWUFBWTRRLEtBQUtyUixTQUFTLEtBQ3ZDLHVCQUFDLFVBQUs7QUFBQTtBQUFBLFFBQUVxUixLQUFLclIsT0FBT29SLFFBQVEsQ0FBQztBQUFBLFFBQUU7QUFBQSxRQUFPL1MsZUFBZWdULEtBQUtwUixLQUFLO0FBQUEsV0FBL0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUFpRTtBQUFBLE1BRW5FLHVCQUFDLFVBQUssV0FBVSxxQkFBcUJtVztBQUFBQSxlQUFPaEYsUUFBUSxDQUFDO0FBQUEsUUFBRTtBQUFBLFdBQXZEO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBZ0U7QUFBQSxTQVBsRTtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBUUE7QUFBQSxPQWRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FlQTtBQUVKO0FBQUNpRixNQXRDUUg7QUEwQ1QsTUFBTUksc0JBR0Y7QUFBQSxFQUNGN0osT0FBTyxFQUFFM0wsT0FBTyxnQkFBZ0J5VixPQUFPLFVBQVU7QUFBQSxFQUNqREMsTUFBTSxFQUFFMVYsT0FBTyxjQUFjeVYsT0FBTyxXQUFXRSxRQUFRLEtBQUs7QUFBQSxFQUM1REMsS0FBSyxFQUFFNVYsT0FBTyxxQkFBcUJ5VixPQUFPLFVBQVU7QUFDdEQ7QUFFQSxTQUFTSSxzQkFBc0I7QUFBQSxFQUM3QkM7QUFBQUEsRUFDQUM7QUFJRixHQUFHO0FBQUFDLE1BQUE7QUFDRCxRQUFNLENBQUNDLFVBQVVDLFdBQVcsSUFBSWhaLFNBQTBCLE9BQU87QUFDakUsUUFBTSxDQUFDaVosY0FBY0MsZUFBZSxJQUFJbFo7QUFBQUEsSUFDdEMsTUFBTSxvQkFBSW1aLElBQUk7QUFBQSxFQUNoQjtBQUVBLFFBQU1DLFdBQVd0WixRQUFRLE1BQU1JLGdCQUFnQjBZLFNBQVMsR0FBRyxDQUFDQSxTQUFTLENBQUM7QUFFdEUsUUFBTVMsSUFBSTtBQUNWLFFBQU1DLElBQUk7QUFDVixRQUFNQyxPQUFPO0FBQ2IsUUFBTUMsT0FBTztBQUNiLFFBQU1DLE9BQU87QUFDYixRQUFNQyxPQUFPO0FBQ2IsUUFBTUMsU0FBU04sSUFBSUUsT0FBT0M7QUFDMUIsUUFBTUksU0FBU04sSUFBSUcsT0FBT0M7QUFFMUIsUUFBTUcsY0FBYy9aLFFBQTRCLE1BQU07QUFDcEQsVUFBTWdhLE9BQ0pmLGFBQWEsVUFBVSxDQUFDLFNBQVMsTUFBTSxJQUFJLENBQUMsS0FBSztBQUNuRCxXQUFPZSxLQUFLdlMsT0FBTyxDQUFDd1MsTUFBTSxDQUFDZCxhQUFhZSxJQUFJRCxDQUFDLENBQUM7QUFBQSxFQUNoRCxHQUFHLENBQUNoQixVQUFVRSxZQUFZLENBQUM7QUFFM0IsUUFBTWdCLFFBQVFuYSxRQUFRLE1BQU07QUFDMUIsUUFBSThZLFVBQVUvTSxTQUFTLEVBQUcsUUFBTztBQUVqQyxVQUFNdUosU0FBU3dELFVBQVVyTyxJQUFJLENBQUNGLE1BQU1BLEVBQUV6QyxVQUFVO0FBQ2hELFVBQU1zUyxRQUFRdEIsVUFBVXJPLElBQUksQ0FBQ0YsTUFBTUEsRUFBRTJHLFNBQVM7QUFFOUMsVUFBTW1KLGNBQWtEO0FBQUEsTUFDdEQxTCxPQUFPMkc7QUFBQUEsTUFDUG9ELE1BQU0wQjtBQUFBQSxNQUNOeEIsS0FBS1UsU0FBUzdPLElBQUksQ0FBQzZQLE1BQU1BLElBQUksR0FBRztBQUFBLElBQ2xDO0FBRUEsVUFBTUMsYUFBYVIsWUFBWVMsUUFBUSxDQUFDUCxNQUFNSSxZQUFZSixDQUFDLENBQUM7QUFDNUQsVUFBTVEsS0FBS2hQLEtBQUtZLElBQUksR0FBR2tPLFVBQVU7QUFDakMsVUFBTUcsS0FBS2pQLEtBQUt1SSxJQUFJLEdBQUd1RyxZQUFZdEIsYUFBYSxRQUFRLElBQUl3QixFQUFFO0FBQzlELFVBQU1FLE9BQU9GLEtBQUtDLE1BQU07QUFDeEIsVUFBTUUsTUFBTUgsS0FBS0UsT0FBTztBQUN4QixVQUFNRSxNQUFNNUIsYUFBYSxRQUFReUIsS0FBS0MsT0FBTyxPQUFPbFAsS0FBS1ksSUFBSSxHQUFHcU8sS0FBS0MsT0FBTyxJQUFJO0FBRWhGLFVBQU1HLE1BQU1BLENBQUM1UixNQUNYdVEsUUFDQ1gsVUFBVS9NLFdBQVcsSUFDbEI4TixTQUFTLElBQ1IzUSxLQUFLNFAsVUFBVS9NLFNBQVMsS0FBTThOO0FBQ3JDLFVBQU1rQixNQUFNQSxDQUFDVCxNQUNYWCxPQUFPRyxVQUFXUSxJQUFJTyxRQUFRRCxNQUFNQyxPQUFRZjtBQUU5QyxVQUFNa0IsY0FBb0U7QUFBQSxNQUN4RXJNLE9BQU8yRyxPQUFPN0ssSUFBSSxDQUFDNlAsR0FBR3BSLE9BQU8sRUFBRStSLEdBQUdILElBQUk1UixDQUFDLEdBQUdnUyxHQUFHSCxJQUFJVCxDQUFDLEVBQUUsRUFBRTtBQUFBLE1BQ3RENUIsTUFBTTBCLE1BQU0zUCxJQUFJLENBQUM2UCxHQUFHcFIsT0FBTyxFQUFFK1IsR0FBR0gsSUFBSTVSLENBQUMsR0FBR2dTLEdBQUdILElBQUlULENBQUMsRUFBRSxFQUFFO0FBQUEsTUFDcEQxQixLQUFLeUIsWUFBWXpCLElBQUluTyxJQUFJLENBQUM2UCxHQUFHcFIsT0FBTyxFQUFFK1IsR0FBR0gsSUFBSTVSLENBQUMsR0FBR2dTLEdBQUdILElBQUlULENBQUMsRUFBRSxFQUFFO0FBQUEsSUFDL0Q7QUFFQSxVQUFNYSxhQUFhaGEsVUFBVTBaLEtBQUtELEtBQUssQ0FBQztBQUV4QyxXQUFPO0FBQUEsTUFDTFA7QUFBQUEsTUFDQVc7QUFBQUEsTUFDQUg7QUFBQUEsTUFDQUQ7QUFBQUEsTUFDQUU7QUFBQUEsTUFDQUM7QUFBQUEsTUFDQUk7QUFBQUEsSUFDRjtBQUFBLEVBQ0YsR0FBRyxDQUFDckMsV0FBV1EsVUFBVVMsYUFBYWQsVUFBVWEsUUFBUUQsTUFBTSxDQUFDO0FBRS9ELFFBQU0sRUFBRXVCLGNBQWNDLFFBQVFDLE9BQU9DLFNBQVMsSUFBSW5hLGNBQWM7QUFBQSxJQUM5RG9hLFlBQVkxQyxVQUFVL007QUFBQUEsSUFDdEIwUCxVQUFVaEM7QUFBQUEsSUFDVmlDLFdBQVdoQztBQUFBQSxJQUNYaUMsY0FBY3BDO0FBQUFBLEVBQ2hCLENBQUM7QUFFRCxRQUFNcUMsaUJBQ0pSLGFBQWFyVSxTQUFTOFUsZUFBZTtBQUV2QyxXQUFTQyxhQUFhbFosS0FBdUI7QUFDM0N3VyxvQkFBZ0IsQ0FBQzNLLFFBQVE7QUFDdkIsWUFBTXdDLE9BQU8sSUFBSW9JLElBQUk1SyxHQUFHO0FBQ3hCLFVBQUl3QyxLQUFLaUosSUFBSXRYLEdBQUcsRUFBR3FPLE1BQUs4SyxPQUFPblosR0FBRztBQUFBO0FBQzdCcU8sYUFBSytLLElBQUlwWixHQUFHO0FBQ2pCLGFBQU9xTztBQUFBQSxJQUNULENBQUM7QUFBQSxFQUNIO0FBRUEsTUFBSTZILFVBQVUvTSxTQUFTLEtBQUssQ0FBQ29PLE9BQU87QUFDbEMsV0FDRSx1QkFBQyxTQUFJLFdBQVUsZUFBYSxtR0FBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUVBO0FBQUEsRUFFSjtBQUVBLFFBQU04QixhQUFheFEsS0FBS1ksSUFBSSxHQUFHWixLQUFLeVEsS0FBS3BELFVBQVUvTSxTQUFTLENBQUMsQ0FBQztBQUM5RCxRQUFNb1EsVUFBVUEsQ0FBQzdCLE1BQ2ZyQixhQUFhLFFBQVFyWSxvQkFBb0IwWixHQUFHLENBQUMsSUFBSWhhLHNCQUFzQmdhLENBQUM7QUFFMUUsUUFBTThCLGFBQWFkLE9BQU8vRSxTQUFTO0FBQ25DLFFBQU04RixXQUFXdkQsVUFBVUEsVUFBVS9NLFNBQVMsQ0FBQztBQUMvQyxRQUFNdVEsWUFBWXhELFVBQVUsQ0FBQztBQUM3QixRQUFNeUQsY0FBY0YsU0FBU3ZVLGFBQWF3VSxVQUFVeFU7QUFDcEQsUUFBTTBVLGlCQUNKRixVQUFVeFUsYUFBYSxJQUNsQnlVLGNBQWNELFVBQVV4VSxhQUFjLE1BQ3ZDO0FBQ04sUUFBTTJVLGdCQUFnQm5ELFNBQVNBLFNBQVN2TixTQUFTLENBQUMsSUFBSTtBQUV0RCxTQUNFO0FBQUEsSUFBQztBQUFBO0FBQUEsTUFDQyxLQUFLcVA7QUFBQUEsTUFDTCxXQUFVO0FBQUEsTUFDVixrQkFBZ0JuQztBQUFBQSxNQUVoQjtBQUFBLCtCQUFDLFNBQUksV0FBVSxxQkFDYjtBQUFBLGlDQUFDLFNBQUksV0FBVSxzQkFDWkEsdUJBQWEsVUFDWixtQ0FDRTtBQUFBLG1DQUFDLFlBQVExWSx5QkFBZThiLFNBQVN2VSxVQUFVLEtBQTNDO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQTZDO0FBQUEsWUFDN0M7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxXQUFXeVUsZUFBZSxJQUFJLGFBQWE7QUFBQSxnQkFFMUNBO0FBQUFBLGlDQUFlLElBQUksTUFBTTtBQUFBLGtCQUN6QmhjLGVBQWVnYyxXQUFXO0FBQUEsa0JBQUU7QUFBQSxrQkFBRzNiLG9CQUFvQjRiLGdCQUFnQixDQUFDO0FBQUEsa0JBQUU7QUFBQTtBQUFBO0FBQUEsY0FKekU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBS0E7QUFBQSxlQVBGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBUUEsSUFFQSxtQ0FDRTtBQUFBLG1DQUFDLFlBQU8sV0FBV0MsaUJBQWlCLElBQUksYUFBYSxZQUNsRDdiLDhCQUFvQjZiLGVBQWUsQ0FBQyxLQUR2QztBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUVBO0FBQUEsWUFDQSx1QkFBQyxVQUFLLFdBQVUsU0FBUTtBQUFBO0FBQUEsY0FBNkIzRCxVQUFVL007QUFBQUEsY0FBTztBQUFBLGlCQUF0RTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFnRjtBQUFBLGVBSmxGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBS0EsS0FqQko7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFtQkE7QUFBQSxVQUNBLHVCQUFDLFNBQUksV0FBVSx1QkFDWmdOO0FBQUFBLDZCQUNDO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsV0FBVTtBQUFBLGdCQUNWLE9BQU92WSxlQUFldVksY0FBYztBQUFBLGdCQUFFO0FBQUE7QUFBQSxrQkFFN0JwWSxtQkFBbUJvWSxjQUFjO0FBQUE7QUFBQTtBQUFBLGNBSjVDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQUtBLElBQ0U7QUFBQSxZQUNKLHVCQUFDLFNBQUksV0FBVSxjQUNiO0FBQUE7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBQ0MsTUFBSztBQUFBLGtCQUNMLFdBQVcsUUFBUUUsYUFBYSxVQUFVLGlCQUFpQixFQUFFO0FBQUEsa0JBQzdELFNBQVMsTUFBTUMsWUFBWSxPQUFPO0FBQUEsa0JBQUU7QUFBQTtBQUFBLGdCQUh0QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FNQTtBQUFBLGNBQ0E7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBQ0MsTUFBSztBQUFBLGtCQUNMLFdBQVcsUUFBUUQsYUFBYSxRQUFRLGlCQUFpQixFQUFFO0FBQUEsa0JBQzNELFNBQVMsTUFBTUMsWUFBWSxLQUFLO0FBQUEsa0JBQUU7QUFBQTtBQUFBLGdCQUhwQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FNQTtBQUFBLGlCQWRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBZUE7QUFBQSxlQXhCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQXlCQTtBQUFBLGFBOUNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUErQ0E7QUFBQSxRQUVBLHVCQUFDLFNBQUksV0FBVSxxQkFDWEQsd0JBQWEsVUFDVixDQUFDLFNBQVMsTUFBTSxJQUNoQixDQUFDLEtBQUssR0FDVHhPLElBQUksQ0FBQzdILFFBQVE7QUFDYixnQkFBTThaLE9BQU9sRSxvQkFBb0I1VixHQUFHO0FBQ3BDLGdCQUFNK1osU0FBU3hELGFBQWFlLElBQUl0WCxHQUFHO0FBQ25DLGlCQUNFO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FFQyxNQUFLO0FBQUEsY0FDTCxXQUFXLDBCQUEwQitaLFNBQVMsZ0NBQWdDLEVBQUU7QUFBQSxjQUNoRixTQUFTLE1BQU1iLGFBQWFsWixHQUFHO0FBQUEsY0FDL0IsZ0JBQWMsQ0FBQytaO0FBQUFBLGNBRWY7QUFBQTtBQUFBLGtCQUFDO0FBQUE7QUFBQSxvQkFDQyxXQUFVO0FBQUEsb0JBQ1YsT0FBTztBQUFBLHNCQUNMNUYsWUFBWTJGLEtBQUsvRCxTQUFTLGdCQUFnQitELEtBQUtqRTtBQUFBQSxzQkFDL0NtRSxhQUFhRixLQUFLakU7QUFBQUEsc0JBQ2xCb0UsYUFBYUgsS0FBSy9ELFNBQVMsV0FBVztBQUFBLG9CQUN4QztBQUFBO0FBQUEsa0JBTkY7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGdCQU1JO0FBQUEsZ0JBRUgrRCxLQUFLMVo7QUFBQUE7QUFBQUE7QUFBQUEsWUFkREo7QUFBQUEsWUFEUDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBZ0JBO0FBQUEsUUFFSixDQUFDLEtBMUJIO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUEyQkE7QUFBQSxRQUVBLHVCQUFDLFNBQUksV0FBVSx1QkFDYjtBQUFBO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxLQUFLeVk7QUFBQUEsY0FDTCxTQUFTLE9BQU85QixDQUFDLElBQUlDLENBQUM7QUFBQSxjQUN0QixXQUFVO0FBQUEsY0FDVixxQkFBb0I7QUFBQSxjQUNwQixNQUFLO0FBQUEsY0FDTCxjQUFXO0FBQUEsY0FDWCxHQUFJK0I7QUFBQUEsY0FFSHBCO0FBQUFBLHNCQUFNZ0IsV0FBVzFRO0FBQUFBLGtCQUFJLENBQUM2UCxHQUFHcFIsTUFDeEIsdUJBQUMsT0FDQztBQUFBO0FBQUEsc0JBQUM7QUFBQTtBQUFBLHdCQUNDLFdBQVU7QUFBQSx3QkFDVixJQUFJdVE7QUFBQUEsd0JBQ0osSUFBSUYsSUFBSUc7QUFBQUEsd0JBQ1IsSUFBSVMsTUFBTVksSUFBSVQsQ0FBQztBQUFBLHdCQUNmLElBQUlILE1BQU1ZLElBQUlULENBQUM7QUFBQTtBQUFBLHNCQUxqQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsb0JBS21CO0FBQUEsb0JBRW5CO0FBQUEsc0JBQUM7QUFBQTtBQUFBLHdCQUNDLFdBQVU7QUFBQSx3QkFDVixHQUFHYixPQUFPO0FBQUEsd0JBQ1YsR0FBR1UsTUFBTVksSUFBSVQsQ0FBQyxJQUFJO0FBQUEsd0JBQ2xCLFlBQVc7QUFBQSx3QkFFVjZCLGtCQUFRN0IsQ0FBQztBQUFBO0FBQUEsc0JBTlo7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG9CQU9BO0FBQUEsdUJBZk0sS0FBS3BSLENBQUMsSUFBZDtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQWdCQTtBQUFBLGdCQUNEO0FBQUEsZ0JBRUErUCxhQUFhLFFBQ1o7QUFBQSxrQkFBQztBQUFBO0FBQUEsb0JBQ0MsV0FBVTtBQUFBLG9CQUNWLElBQUlRO0FBQUFBLG9CQUNKLElBQUlGLElBQUlHO0FBQUFBLG9CQUNSLElBQUlTLE1BQU1ZLElBQUksQ0FBQztBQUFBLG9CQUNmLElBQUlaLE1BQU1ZLElBQUksQ0FBQztBQUFBO0FBQUEsa0JBTGpCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxnQkFLbUIsSUFFakI7QUFBQSxnQkFFSGhCLFlBQVlsTSxTQUFTLE9BQU8sS0FBS29MLGFBQWEsVUFDN0M7QUFBQSxrQkFBQztBQUFBO0FBQUEsb0JBQ0MsV0FBVTtBQUFBLG9CQUNWLEdBQUcsR0FBRy9YLG9CQUFvQmlaLE1BQU1hLFlBQVlyTSxLQUFLLENBQUMsTUFBTXdMLE1BQU1hLFlBQVlyTSxNQUFNd0wsTUFBTWEsWUFBWXJNLE1BQU01QyxTQUFTLENBQUMsRUFBRWtQLENBQUMsSUFBSWQsTUFBTVksSUFBSVosTUFBTVUsR0FBRyxDQUFDLE1BQU1WLE1BQU1hLFlBQVlyTSxNQUFNLENBQUMsRUFBRXNNLENBQUMsSUFBSWQsTUFBTVksSUFBSVosTUFBTVUsR0FBRyxDQUFDO0FBQUE7QUFBQSxrQkFGek07QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGdCQUU4TSxJQUU1TTtBQUFBLGdCQUVIZCxZQUFZdFAsSUFBSSxDQUFDN0gsUUFBUTtBQUN4Qix3QkFBTThaLE9BQU9sRSxvQkFBb0I1VixHQUFHO0FBQ3BDLHdCQUFNa2EsTUFBTTNDLE1BQU1hLFlBQVlwWSxHQUFHO0FBQ2pDLHlCQUNFO0FBQUEsb0JBQUM7QUFBQTtBQUFBLHNCQUVDLFdBQVU7QUFBQSxzQkFDVixHQUFHMUIsb0JBQW9CNGIsR0FBRztBQUFBLHNCQUMxQixRQUFRSixLQUFLakU7QUFBQUEsc0JBQ2IsaUJBQWlCaUUsS0FBSy9ELFNBQVMsUUFBUW9FO0FBQUFBLHNCQUN2QyxhQUFhbmEsUUFBUSxXQUFXQSxRQUFRLFFBQVEsTUFBTTtBQUFBO0FBQUEsb0JBTGpELFFBQVFBLEdBQUc7QUFBQSxvQkFEbEI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFNNEQ7QUFBQSxnQkFHaEUsQ0FBQztBQUFBLGdCQUVBa1csVUFBVXJPLElBQUksQ0FBQ0YsR0FBR3JCLE1BQU07QUFDdkIsc0JBQUlBLElBQUkrUyxlQUFlLEtBQUsvUyxNQUFNNFAsVUFBVS9NLFNBQVMsRUFBRyxRQUFPO0FBQy9ELHlCQUNFO0FBQUEsb0JBQUM7QUFBQTtBQUFBLHNCQUVDLFdBQVU7QUFBQSxzQkFDVixHQUFHb08sTUFBTVcsSUFBSTVSLENBQUM7QUFBQSxzQkFDZCxHQUFHc1EsSUFBSUksT0FBTztBQUFBLHNCQUNkLFlBQVc7QUFBQSxzQkFFVm5aLDBCQUFnQjhKLEVBQUV4SCxJQUFJO0FBQUE7QUFBQSxvQkFObEIsTUFBTW1HLENBQUM7QUFBQSxvQkFEZDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGtCQVFBO0FBQUEsZ0JBRUosQ0FBQztBQUFBLGdCQUVBa1QsZUFBZSxPQUNkLHVCQUFDLE9BQUUsZUFBYyxRQUNmO0FBQUE7QUFBQSxvQkFBQztBQUFBO0FBQUEsc0JBQ0MsV0FBVTtBQUFBLHNCQUNWLElBQUlqQyxNQUFNVyxJQUFJc0IsVUFBVTtBQUFBLHNCQUN4QixJQUFJakMsTUFBTVcsSUFBSXNCLFVBQVU7QUFBQSxzQkFDeEIsSUFBSXpDO0FBQUFBLHNCQUNKLElBQUlILElBQUlJO0FBQUFBO0FBQUFBLG9CQUxWO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFLZTtBQUFBLGtCQUVkRyxZQUFZdFAsSUFBSSxDQUFDN0gsUUFBUTtBQUN4QiwwQkFBTThaLE9BQU9sRSxvQkFBb0I1VixHQUFHO0FBQ3BDLDBCQUFNc1MsSUFBSWlGLE1BQU1hLFlBQVlwWSxHQUFHLEVBQUV3WixVQUFVO0FBQzNDLDJCQUNFO0FBQUEsc0JBQUM7QUFBQTtBQUFBLHdCQUVDLFdBQVU7QUFBQSx3QkFDVixJQUFJbEgsRUFBRStGO0FBQUFBLHdCQUNOLElBQUkvRixFQUFFZ0c7QUFBQUEsd0JBQ04sR0FBRztBQUFBLHdCQUNILE1BQU13QixLQUFLakU7QUFBQUE7QUFBQUEsc0JBTE4sTUFBTTdWLEdBQUc7QUFBQSxzQkFEaEI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxvQkFNbUI7QUFBQSxrQkFHdkIsQ0FBQztBQUFBLHFCQXJCSDtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQXNCQSxJQUNFO0FBQUE7QUFBQTtBQUFBLFlBcEdOO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQXFHQTtBQUFBLFVBRUN3WixlQUFlLFFBQVFkLFFBQ3RCO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxHQUFHQSxNQUFNMEI7QUFBQUEsY0FDVCxHQUFHMUIsTUFBTTJCO0FBQUFBLGNBQ1Q7QUFBQSxjQUNBLE9BQU96YyxlQUFlc1ksVUFBVXNELFVBQVUsRUFBRXJaLElBQUk7QUFBQSxjQUNoRCxPQUFPa1csYUFBYSxVQUNmO0FBQUEsZ0JBQ0M7QUFBQSxrQkFDRWpXLE9BQU87QUFBQSxrQkFDUDJMLE9BQU9wTyxlQUFldVksVUFBVXNELFVBQVUsRUFBRXRVLFVBQVU7QUFBQSxrQkFDdEQyUSxPQUFPRCxvQkFBb0I3SixNQUFNOEo7QUFBQUEsZ0JBQ25DO0FBQUEsZ0JBQ0E7QUFBQSxrQkFDRXpWLE9BQU87QUFBQSxrQkFDUDJMLE9BQU9wTyxlQUFldVksVUFBVXNELFVBQVUsRUFBRWxMLFNBQVM7QUFBQSxrQkFDckR1SCxPQUFPRCxvQkFBb0JFLEtBQUtEO0FBQUFBLGdCQUNsQztBQUFBLGdCQUNBO0FBQUEsa0JBQ0V6VixPQUFPO0FBQUEsa0JBQ1AyTCxPQUFPcE8sZUFBZXVZLFVBQVVzRCxVQUFVLEVBQUVuTyxRQUFRO0FBQUEsZ0JBQ3REO0FBQUEsY0FBQyxJQUVGO0FBQUEsZ0JBQ0M7QUFBQSxrQkFDRWpMLE9BQU87QUFBQSxrQkFDUDJMLE9BQU8vTjtBQUFBQSxvQkFDTHVaLE1BQU1FLFlBQVl6QixJQUFJd0QsVUFBVTtBQUFBLG9CQUNoQztBQUFBLGtCQUNGO0FBQUEsa0JBQ0EzRCxPQUFPRCxvQkFBb0JJLElBQUlIO0FBQUFBLGdCQUNqQztBQUFBLGdCQUNBO0FBQUEsa0JBQ0V6VixPQUFPO0FBQUEsa0JBQ1AyTCxPQUFPcE8sZUFBZXVZLFVBQVVzRCxVQUFVLEVBQUV0VSxVQUFVO0FBQUEsZ0JBQ3hEO0FBQUEsZ0JBQ0E7QUFBQSxrQkFDRTlFLE9BQU87QUFBQSxrQkFDUDJMLE9BQU9wTyxlQUFldVksVUFBVXNELFVBQVUsRUFBRWxMLFNBQVM7QUFBQSxnQkFDdkQ7QUFBQSxjQUFDLEdBRUx6RyxJQUFJLENBQUNxQixPQUFPLEVBQUUsR0FBR0EsRUFBRSxFQUFFO0FBQUE7QUFBQSxZQXhDekI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBd0MyQixJQUV6QjtBQUFBLGFBbkpOO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFvSkE7QUFBQTtBQUFBO0FBQUEsSUF2T0Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBd09BO0FBRUo7QUFBQ2tOLElBL1ZRSCx1QkFBcUI7QUFBQSxVQTJFc0J6WCxhQUFhO0FBQUE7QUFBQSxNQTNFeER5WDtBQTZXVCxNQUFNcUUscUJBR0Y7QUFBQSxFQUNGcFQsT0FBTyxFQUFFOUcsT0FBTyxvQkFBb0J5VixPQUFPLFVBQVU7QUFBQSxFQUNyRDlKLE9BQU8sRUFBRTNMLE9BQU8sbUJBQW1CeVYsT0FBTyxVQUFVO0FBQ3REO0FBRUEsU0FBUzBFLGdCQUFnQixFQUFFQyxLQUFxQyxHQUFHO0FBQUFDLE1BQUE7QUFDakUsUUFBTSxDQUFDbEUsY0FBY0MsZUFBZSxJQUFJbFo7QUFBQUEsSUFDdEMsTUFBTSxvQkFBSW1aLElBQUk7QUFBQSxFQUNoQjtBQUVBLFFBQU1FLElBQUk7QUFDVixRQUFNQyxJQUFJO0FBQ1YsUUFBTUMsT0FBTztBQUNiLFFBQU1DLE9BQU87QUFDYixRQUFNQyxPQUFPO0FBQ2IsUUFBTUMsT0FBTztBQUNiLFFBQU1DLFNBQVNOLElBQUlFLE9BQU9DO0FBQzFCLFFBQU1JLFNBQVNOLElBQUlHLE9BQU9DO0FBRTFCLFFBQU1HLGNBQWMvWjtBQUFBQSxJQUNsQixNQUFPLENBQUMsU0FBUyxPQUFPLEVBQVl5SCxPQUFPLENBQUN3UyxNQUFNLENBQUNkLGFBQWFlLElBQUlELENBQUMsQ0FBQztBQUFBLElBQ3RFLENBQUNkLFlBQVk7QUFBQSxFQUNmO0FBRUEsUUFBTWdCLFFBQVFuYSxRQUFRLE1BQU07QUFDMUIsUUFBSW9kLEtBQUtyUixTQUFTLEVBQUcsUUFBTztBQUU1QixVQUFNdVIsU0FBU0YsS0FBSzNTLElBQUksQ0FBQ3FCLE1BQU1BLEVBQUVoQyxLQUFLO0FBQ3RDLFVBQU13TCxTQUFTOEgsS0FBSzNTLElBQUksQ0FBQ3FCLE1BQU1BLEVBQUU1SSxRQUFRO0FBRXpDLFVBQU1tWCxjQUFpRDtBQUFBLE1BQ3JEdlEsT0FBT3dUO0FBQUFBLE1BQ1AzTyxPQUFPMkc7QUFBQUEsSUFDVDtBQUVBLFVBQU1pSSxnQkFBZ0J4RCxZQUFZUyxRQUFRLENBQUNQLE1BQU1JLFlBQVlKLENBQUMsQ0FBQztBQUMvRCxVQUFNUSxLQUFLaFAsS0FBS1ksSUFBSSxHQUFHa1IsZUFBZSxDQUFDO0FBQ3ZDLFVBQU03QyxLQUFLalAsS0FBS3VJLElBQUksR0FBR3VKLGVBQWUsQ0FBQztBQUN2QyxVQUFNNUMsT0FBT0YsS0FBS0MsTUFBTTtBQUN4QixVQUFNRSxNQUFNSCxLQUFLRSxPQUFPO0FBQ3hCLFVBQU1FLE1BQU1wUCxLQUFLWSxJQUFJLEdBQUdxTyxLQUFLQyxPQUFPLElBQUk7QUFFeEMsVUFBTUcsTUFBTUEsQ0FBQzVSLE1BQ1h1USxRQUNDMkQsS0FBS3JSLFdBQVcsSUFDYjhOLFNBQVMsSUFDUjNRLEtBQUtrVSxLQUFLclIsU0FBUyxLQUFNOE47QUFDaEMsVUFBTWtCLE1BQU1BLENBQUNULE1BQ1hYLE9BQU9HLFVBQVdRLElBQUlPLFFBQVFELE1BQU1DLE9BQVFmO0FBRTlDLFFBQUkwRCxXQUFXLEtBQUsxQyxJQUFJLENBQUMsQ0FBQyxJQUFJQyxJQUFJdUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUM1QyxhQUFTcFUsSUFBSSxHQUFHQSxJQUFJa1UsS0FBS3JSLFFBQVE3QyxLQUFLO0FBQ3BDc1Usa0JBQVksTUFBTTFDLElBQUk1UixDQUFDLENBQUMsTUFBTTZSLElBQUl1QyxPQUFPcFUsQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUM5QztBQUNBLFVBQU11VSxXQUFXLEdBQUdELFFBQVEsTUFBTTFDLElBQUlzQyxLQUFLclIsU0FBUyxDQUFDLENBQUMsSUFBSWdQLElBQUlGLEdBQUcsQ0FBQyxNQUFNQyxJQUFJLENBQUMsQ0FBQyxJQUFJQyxJQUFJRixHQUFHLENBQUM7QUFFMUYsVUFBTTZDLGNBQWNwSSxPQUFPN0ssSUFBSSxDQUFDNlAsR0FBR3BSLE9BQU8sRUFBRStSLEdBQUdILElBQUk1UixDQUFDLEdBQUdnUyxHQUFHSCxJQUFJVCxDQUFDLEVBQUUsRUFBRTtBQUNuRSxVQUFNcUQsY0FBY0wsT0FBTzdTLElBQUksQ0FBQzZQLEdBQUdwUixPQUFPLEVBQUUrUixHQUFHSCxJQUFJNVIsQ0FBQyxHQUFHZ1MsR0FBR0gsSUFBSVQsQ0FBQyxFQUFFLEVBQUU7QUFFbkUsVUFBTWEsYUFBYWhhLFVBQVUwWixLQUFLRCxLQUFLLENBQUM7QUFFeEMsV0FBTztBQUFBLE1BQ0xQO0FBQUFBLE1BQ0F1RCxXQUFXMWMsb0JBQW9Cd2MsV0FBVztBQUFBLE1BQzFDRjtBQUFBQSxNQUNBQztBQUFBQSxNQUNBQztBQUFBQSxNQUNBQztBQUFBQSxNQUNBeEM7QUFBQUEsTUFDQUo7QUFBQUEsTUFDQUQ7QUFBQUEsSUFDRjtBQUFBLEVBQ0YsR0FBRyxDQUFDc0MsTUFBTXJELGFBQWFELFFBQVFELE1BQU0sQ0FBQztBQUV0QyxRQUFNLEVBQUV1QixjQUFjQyxRQUFRQyxPQUFPQyxTQUFTLElBQUluYSxjQUFjO0FBQUEsSUFDOURvYSxZQUFZNEIsS0FBS3JSO0FBQUFBLElBQ2pCMFAsVUFBVWhDO0FBQUFBLElBQ1ZpQyxXQUFXaEM7QUFBQUEsSUFDWGlDLGNBQWNwQztBQUFBQSxFQUNoQixDQUFDO0FBRUQsV0FBU3VDLGFBQWFsWixLQUFzQjtBQUMxQ3dXLG9CQUFnQixDQUFDM0ssUUFBUTtBQUN2QixZQUFNd0MsT0FBTyxJQUFJb0ksSUFBSTVLLEdBQUc7QUFDeEIsVUFBSXdDLEtBQUtpSixJQUFJdFgsR0FBRyxFQUFHcU8sTUFBSzhLLE9BQU9uWixHQUFHO0FBQUE7QUFDN0JxTyxhQUFLK0ssSUFBSXBaLEdBQUc7QUFDakIsYUFBT3FPO0FBQUFBLElBQ1QsQ0FBQztBQUFBLEVBQ0g7QUFFQSxNQUFJbU0sS0FBS3JSLFNBQVMsS0FBSyxDQUFDb08sT0FBTztBQUM3QixXQUNFLHVCQUFDLFNBQUksV0FBVSxlQUFhLCtEQUE1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBRUE7QUFBQSxFQUVKO0FBRUEsUUFBTThCLGFBQWF4USxLQUFLWSxJQUFJLEdBQUdaLEtBQUt5USxLQUFLa0IsS0FBS3JSLFNBQVMsQ0FBQyxDQUFDO0FBQ3pELFFBQU1xUSxhQUFhZCxPQUFPL0UsU0FBUztBQUNuQyxRQUFNcUYsaUJBQWlCUixhQUFhclUsU0FBUzhVLGVBQWU7QUFFNUQsU0FDRSx1QkFBQyxTQUFJLEtBQUtULGNBQWMsV0FBVSxjQUNoQztBQUFBLDJCQUFDLFNBQUksV0FBVSxxQkFDWCxXQUFDLFNBQVMsT0FBTyxFQUFZM1EsSUFBSSxDQUFDN0gsUUFBUTtBQUMxQyxZQUFNOFosT0FBT1EsbUJBQW1CdGEsR0FBRztBQUNuQyxZQUFNK1osU0FBU3hELGFBQWFlLElBQUl0WCxHQUFHO0FBQ25DLGFBQ0U7QUFBQSxRQUFDO0FBQUE7QUFBQSxVQUVDLE1BQUs7QUFBQSxVQUNMLFdBQVcsMEJBQTBCK1osU0FBUyxnQ0FBZ0MsRUFBRTtBQUFBLFVBQ2hGLFNBQVMsTUFBTWIsYUFBYWxaLEdBQUc7QUFBQSxVQUMvQixnQkFBYyxDQUFDK1o7QUFBQUEsVUFFZjtBQUFBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsV0FBVTtBQUFBLGdCQUNWLE9BQU8sRUFBRTVGLFlBQVkyRixLQUFLakUsT0FBT21FLGFBQWFGLEtBQUtqRSxNQUFNO0FBQUE7QUFBQSxjQUYzRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFFNkQ7QUFBQSxZQUU1RGlFLEtBQUsxWjtBQUFBQTtBQUFBQTtBQUFBQSxRQVZESjtBQUFBQSxRQURQO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFZQTtBQUFBLElBRUosQ0FBQyxLQW5CSDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBb0JBO0FBQUEsSUFFQSx1QkFBQyxTQUFJLFdBQVUsdUJBQ2I7QUFBQTtBQUFBLFFBQUM7QUFBQTtBQUFBLFVBQ0MsS0FBS3lZO0FBQUFBLFVBQ0wsU0FBUyxPQUFPOUIsQ0FBQyxJQUFJQyxDQUFDO0FBQUEsVUFDdEIsV0FBVTtBQUFBLFVBQ1YscUJBQW9CO0FBQUEsVUFDcEIsTUFBSztBQUFBLFVBQ0wsY0FBVztBQUFBLFVBQ1gsR0FBSStCO0FBQUFBLFVBRUhwQjtBQUFBQSxrQkFBTWdCLFdBQVcxUTtBQUFBQSxjQUFJLENBQUM2UCxHQUFHcFIsTUFDeEIsdUJBQUMsT0FDQztBQUFBO0FBQUEsa0JBQUM7QUFBQTtBQUFBLG9CQUNDLFdBQVU7QUFBQSxvQkFDVixJQUFJdVE7QUFBQUEsb0JBQ0osSUFBSUYsSUFBSUc7QUFBQUEsb0JBQ1IsSUFBSVMsTUFBTVksSUFBSVQsQ0FBQztBQUFBLG9CQUNmLElBQUlILE1BQU1ZLElBQUlULENBQUM7QUFBQTtBQUFBLGtCQUxqQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBS21CO0FBQUEsZ0JBRW5CO0FBQUEsa0JBQUM7QUFBQTtBQUFBLG9CQUNDLFdBQVU7QUFBQSxvQkFDVixHQUFHYixPQUFPO0FBQUEsb0JBQ1YsR0FBR1UsTUFBTVksSUFBSVQsQ0FBQyxJQUFJO0FBQUEsb0JBQ2xCLFlBQVc7QUFBQSxvQkFFVmhhLGdDQUFzQmdhLENBQUM7QUFBQTtBQUFBLGtCQU4xQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBT0E7QUFBQSxtQkFmTSxLQUFLcFIsQ0FBQyxJQUFkO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBZ0JBO0FBQUEsWUFDRDtBQUFBLFlBRUE2USxZQUFZbE0sU0FBUyxPQUFPLElBQzNCLG1DQUNFO0FBQUEscUNBQUMsVUFBSyxXQUFVLHdCQUF1QixHQUFHc00sTUFBTXNELFlBQWhEO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQXlEO0FBQUEsY0FDekQ7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBQ0MsV0FBVTtBQUFBLGtCQUNWLEdBQUd0RCxNQUFNcUQ7QUFBQUEsa0JBQ1QsUUFBUU4sbUJBQW1CcFQsTUFBTTJPO0FBQUFBO0FBQUFBLGdCQUhuQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FHeUM7QUFBQSxpQkFMM0M7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFPQSxJQUNFO0FBQUEsWUFFSHNCLFlBQVlsTSxTQUFTLE9BQU8sSUFDM0I7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxXQUFVO0FBQUEsZ0JBQ1YsR0FBR3NNLE1BQU15RDtBQUFBQSxnQkFDVCxRQUFRVixtQkFBbUJ2TyxNQUFNOEo7QUFBQUEsZ0JBQ2pDLGFBQWE7QUFBQTtBQUFBLGNBSmY7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBSW1CLElBRWpCO0FBQUEsWUFFSDJFLEtBQUszUyxJQUFJLENBQUNxQixHQUFHNUMsTUFBTTtBQUNsQixrQkFBSUEsSUFBSStTLGVBQWUsS0FBSy9TLE1BQU1rVSxLQUFLclIsU0FBUyxFQUFHLFFBQU87QUFDMUQscUJBQ0U7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBRUMsV0FBVTtBQUFBLGtCQUNWLEdBQUdvTyxNQUFNVyxJQUFJNVIsQ0FBQztBQUFBLGtCQUNkLEdBQUdzUSxJQUFJSSxPQUFPO0FBQUEsa0JBQ2QsWUFBVztBQUFBLGtCQUVWblosMEJBQWdCcUwsRUFBRS9JLElBQUk7QUFBQTtBQUFBLGdCQU5sQixNQUFNK0ksRUFBRXFDLEVBQUU7QUFBQSxnQkFEakI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxjQVFBO0FBQUEsWUFFSixDQUFDO0FBQUEsWUFFQWlPLGVBQWUsT0FDZCx1QkFBQyxPQUFFLGVBQWMsUUFDZjtBQUFBO0FBQUEsZ0JBQUM7QUFBQTtBQUFBLGtCQUNDLFdBQVU7QUFBQSxrQkFDVixJQUFJakMsTUFBTVcsSUFBSXNCLFVBQVU7QUFBQSxrQkFDeEIsSUFBSWpDLE1BQU1XLElBQUlzQixVQUFVO0FBQUEsa0JBQ3hCLElBQUl6QztBQUFBQSxrQkFDSixJQUFJSCxJQUFJSTtBQUFBQTtBQUFBQSxnQkFMVjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FLZTtBQUFBLGNBRWRHLFlBQVlsTSxTQUFTLE9BQU8sSUFDM0I7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBQ0MsV0FBVTtBQUFBLGtCQUNWLElBQUlzTSxNQUFNd0QsWUFBWXZCLFVBQVUsRUFBRW5CO0FBQUFBLGtCQUNsQyxJQUFJZCxNQUFNd0QsWUFBWXZCLFVBQVUsRUFBRWxCO0FBQUFBLGtCQUNsQyxHQUFHO0FBQUEsa0JBQ0gsTUFBTWdDLG1CQUFtQnBULE1BQU0yTztBQUFBQTtBQUFBQSxnQkFMakM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGNBS3VDLElBRXJDO0FBQUEsY0FDSHNCLFlBQVlsTSxTQUFTLE9BQU8sSUFDM0I7QUFBQSxnQkFBQztBQUFBO0FBQUEsa0JBQ0MsV0FBVTtBQUFBLGtCQUNWLElBQUlzTSxNQUFNdUQsWUFBWXRCLFVBQVUsRUFBRW5CO0FBQUFBLGtCQUNsQyxJQUFJZCxNQUFNdUQsWUFBWXRCLFVBQVUsRUFBRWxCO0FBQUFBLGtCQUNsQyxHQUFHO0FBQUEsa0JBQ0gsTUFBTWdDLG1CQUFtQnZPLE1BQU04SjtBQUFBQTtBQUFBQSxnQkFMakM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGNBS3VDLElBRXJDO0FBQUEsaUJBekJOO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBMEJBLElBQ0U7QUFBQTtBQUFBO0FBQUEsUUE1Rk47QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BNkZBO0FBQUEsTUFFQzJELGVBQWUsUUFBUWQsUUFDdEI7QUFBQSxRQUFDO0FBQUE7QUFBQSxVQUNDLEdBQUdBLE1BQU0wQjtBQUFBQSxVQUNULEdBQUcxQixNQUFNMkI7QUFBQUEsVUFDVDtBQUFBLFVBQ0EsT0FBTyxHQUFHemMsZUFBZTRjLEtBQUtoQixVQUFVLEVBQUVyWixJQUFJLENBQUMsTUFBTXFhLEtBQUtoQixVQUFVLEVBQUVwWixLQUFLO0FBQUEsVUFDM0UsTUFBTTtBQUFBLFlBQ0o7QUFBQSxjQUNFQSxPQUFPO0FBQUEsY0FDUDJMLE9BQU9wTyxlQUFlNmMsS0FBS2hCLFVBQVUsRUFBRXRTLEtBQUs7QUFBQSxjQUM1QzJPLE9BQU95RSxtQkFBbUJwVCxNQUFNMk87QUFBQUEsWUFDbEM7QUFBQSxZQUNBO0FBQUEsY0FDRXpWLE9BQU87QUFBQSxjQUNQMkwsT0FBT3BPLGVBQWU2YyxLQUFLaEIsVUFBVSxFQUFFbFosUUFBUTtBQUFBLGNBQy9DdVYsT0FBT3lFLG1CQUFtQnZPLE1BQU04SjtBQUFBQSxZQUNsQztBQUFBLFlBQ0E7QUFBQSxjQUNFelYsT0FBTztBQUFBLGNBQ1AyTCxPQUFPLEdBQUd5TyxLQUFLaEIsVUFBVSxFQUFFdFAsWUFBWSxJQUFJLE1BQU0sRUFBRSxHQUFHdk0sZUFBZTZjLEtBQUtoQixVQUFVLEVBQUV0UCxRQUFRLENBQUMsS0FBS2xNLG9CQUFvQndjLEtBQUtoQixVQUFVLEVBQUVyUCxRQUFRLENBQUMsQ0FBQztBQUFBLFlBQ3JKO0FBQUEsWUFDQTtBQUFBLGNBQ0UvSixPQUFPO0FBQUEsY0FDUDJMLE9BQ0V5TyxLQUFLaEIsVUFBVSxFQUFFblosV0FBVyxJQUN4QixNQUNBLEdBQUdtYSxLQUFLaEIsVUFBVSxFQUFFblosU0FBUyxJQUFJLE1BQU0sRUFBRSxHQUFHMUMsZUFBZTZjLEtBQUtoQixVQUFVLEVBQUVuWixNQUFNLENBQUM7QUFBQSxZQUMzRjtBQUFBLFVBQUM7QUFBQTtBQUFBLFFBMUJMO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQTJCSSxJQUVGO0FBQUEsU0E5SE47QUFBQTtBQUFBO0FBQUE7QUFBQSxXQStIQTtBQUFBLE9BdEpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0F1SkE7QUFFSjtBQUFDb2EsSUEzUFFGLGlCQUFlO0FBQUEsVUFxRTRCL2IsYUFBYTtBQUFBO0FBQUEsTUFyRXhEK2I7QUE2UFQsU0FBU1UsaUJBQWlCO0FBQUEsRUFDeEJDO0FBR0YsR0FBRztBQUNELE1BQUlBLE1BQU0vUixXQUFXLEdBQUc7QUFDdEIsV0FBTyx1QkFBQyxTQUFJLFdBQVUsZUFBYyx1QkFBN0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUFvQztBQUFBLEVBQzdDO0FBQ0EsUUFBTVUsU0FBUyxDQUFDLEdBQUdxUixLQUFLLEVBQUV0VixLQUFLLENBQUNrRSxHQUFHQyxNQUFNQSxFQUFFOUIsU0FBUzZCLEVBQUU3QixNQUFNO0FBQzVELFFBQU1rVCxNQUFNdFIsT0FBTyxDQUFDLEdBQUc1QixVQUFVO0FBQ2pDLFNBQ0UsdUJBQUMsU0FBSSxXQUFVLHFCQUNaNEIsaUJBQU9oQyxJQUFJLENBQUM4SSxNQUFNckssTUFBTTtBQUN2QixVQUFNOFUsV0FBWXpLLEtBQUsxSSxTQUFTa1QsTUFBTztBQUN2QyxXQUNFLHVCQUFDLFNBQUksV0FBVSxjQUNiO0FBQUEsNkJBQUMsVUFBSyxXQUFVLGVBQWU3VSxjQUFJLEtBQW5DO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBcUM7QUFBQSxNQUNyQyx1QkFBQyxZQUFPLFdBQVUsZ0JBQWdCcUssZUFBS3ZRLFNBQXZDO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBNkM7QUFBQSxNQUM3Qyx1QkFBQyxTQUFJLFdBQVUsZ0JBQ2I7QUFBQSxRQUFDO0FBQUE7QUFBQSxVQUNDLFdBQVU7QUFBQSxVQUNWLE9BQU87QUFBQSxZQUNMcVEsT0FBTyxHQUFHMkssUUFBUTtBQUFBLFlBQ2xCakgsWUFBWUQsY0FBYzVOLENBQUM7QUFBQSxVQUM3QjtBQUFBO0FBQUEsUUFMRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLSSxLQU5OO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFRQTtBQUFBLE1BQ0EsdUJBQUMsVUFBSyxXQUFVLGlCQUFpQnhJLHdCQUFjNlMsS0FBSzFJLE1BQU0sS0FBMUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUE0RDtBQUFBLE1BQzVELHVCQUFDLFVBQUssV0FBVSxnQkFBZ0J2SyxnQ0FBc0JpVCxLQUFLNUUsS0FBSyxLQUFoRTtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQWtFO0FBQUEsU0FibkM0RSxLQUFLM1EsS0FBdEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQWNBO0FBQUEsRUFFSixDQUFDLEtBcEJIO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FxQkE7QUFFSjtBQUFDcWIsTUFsQ1FKO0FBNkNULFNBQVNLLHNCQUFzQixFQUFFalYsTUFBaUMsR0FBRztBQUFBa1YsTUFBQTtBQUNuRSxRQUFNLENBQUN0SSxTQUFTQyxVQUFVLElBQUk1VixTQUF3QixJQUFJO0FBQzFELFFBQU1rYixlQUFlbmIsT0FBOEIsSUFBSTtBQUN2RCxRQUFNb00sTUFBTXBELE1BQU1mLE9BQU8sQ0FBQ2tXLEdBQUc5VCxNQUFNbUIsS0FBS1ksSUFBSStSLEdBQUc5VCxFQUFFUixLQUFLLEdBQUcsQ0FBQztBQUUxRCxNQUFJdUMsUUFBUSxHQUFHO0FBQ2IsV0FDRSx1QkFBQyxTQUFJLFdBQVUsZUFBYSxzRkFBNUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUVBO0FBQUEsRUFFSjtBQUVBLFFBQU11UCxpQkFBaUJSLGFBQWFyVSxTQUFTOFUsZUFBZTtBQUM1RCxRQUFNd0MsY0FBY3hJLFlBQVksT0FBTzVNLE1BQU00TSxPQUFPLElBQUk7QUFFeEQsU0FDRSx1QkFBQyxTQUFJLEtBQUt1RixjQUFjLFdBQVUscUJBQ2hDO0FBQUEsMkJBQUMsU0FBSSxXQUFVLDBCQUNablMsZ0JBQU13QixJQUFJLENBQUM2VCxNQUFNcFYsTUFBTTtBQUN0QixZQUFNcVYsWUFBWWxTLE1BQU0sSUFBS2lTLEtBQUt4VSxRQUFRdUMsTUFBTyxNQUFNO0FBQ3ZELGFBQ0U7QUFBQSxRQUFDO0FBQUE7QUFBQSxVQUVDLE1BQUs7QUFBQSxVQUNMLFdBQVcsZ0JBQWdCaVMsS0FBS3hVLFVBQVUsSUFBSSx3QkFBd0IsRUFBRSxJQUFJK0wsWUFBWTNNLElBQUkseUJBQXlCLEVBQUU7QUFBQSxVQUN2SCxnQkFBZ0IsTUFBTTRNLFdBQVc1TSxDQUFDO0FBQUEsVUFDbEMsZ0JBQWdCLE1BQU00TSxXQUFXLElBQUk7QUFBQSxVQUNyQyxTQUFTLE1BQU1BLFdBQVc1TSxDQUFDO0FBQUEsVUFDM0IsUUFBUSxNQUFNNE0sV0FBVyxJQUFJO0FBQUEsVUFDN0IsY0FBWSxHQUFHd0ksS0FBS3RiLEtBQUssS0FBS3pDLGVBQWUrZCxLQUFLeFUsS0FBSyxDQUFDO0FBQUEsVUFFeEQ7QUFBQSxtQ0FBQyxVQUFLLFdBQVUsc0JBQ2Q7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxXQUFVO0FBQUEsZ0JBQ1YsT0FBTyxFQUFFMFUsUUFBUSxHQUFHRCxTQUFTLElBQUk7QUFBQTtBQUFBLGNBRm5DO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQUVxQyxLQUh2QztBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUtBO0FBQUEsWUFDQSx1QkFBQyxVQUFLLFdBQVUsdUJBQ2JELGVBQUt4VSxVQUFVLElBQUksTUFBTXhKLHNCQUFzQmdlLEtBQUt4VSxLQUFLLEtBRDVEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBRUE7QUFBQSxZQUNBLHVCQUFDLFVBQUssV0FBVSxzQkFBc0J3VSxlQUFLdGIsU0FBM0M7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBaUQ7QUFBQTtBQUFBO0FBQUEsUUFsQjVDc2IsS0FBSzFiO0FBQUFBLFFBRFo7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQW9CQTtBQUFBLElBRUosQ0FBQyxLQTFCSDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBMkJBO0FBQUEsSUFFQ3liLGVBQWVBLFlBQVl0VSxRQUFRZ0MsU0FBUyxJQUMzQztBQUFBLE1BQUM7QUFBQTtBQUFBLFFBQ0MsR0FBRzZQLGlCQUFpQjtBQUFBLFFBQ3BCLEdBQUc7QUFBQSxRQUNIO0FBQUEsUUFDQSxPQUFPLEdBQUd5QyxZQUFZcmIsS0FBSyxNQUFNekMsZUFBZThkLFlBQVl2VSxLQUFLLENBQUM7QUFBQSxRQUNsRSxNQUFNdVUsWUFBWXRVLFFBQVFVLElBQUksQ0FBQ29DLFdBQVc7QUFBQSxVQUN4QzdKLE9BQU8sR0FBRzZKLE1BQU05SyxNQUFNLE1BQU10QixnQkFBZ0JvTSxNQUFNOUosSUFBSSxDQUFDO0FBQUEsVUFDdkQ0TCxPQUFPcE8sZUFBZXNNLE1BQU01SixNQUFNO0FBQUEsUUFDcEMsRUFBRTtBQUFBO0FBQUEsTUFSSjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFRTSxJQUVKO0FBQUEsT0F6Q047QUFBQTtBQUFBO0FBQUE7QUFBQSxTQTBDQTtBQUVKO0FBQUNrYixJQTdEUUQsdUJBQXFCO0FBQUEsTUFBckJBO0FBK0RULFNBQVNPLFFBQVE7QUFBQSxFQUNmWDtBQUdGLEdBQUc7QUFDRCxNQUFJQSxNQUFNL1IsV0FBVyxHQUFHO0FBQ3RCLFdBQU8sdUJBQUMsU0FBSSxXQUFVLGVBQWMsdUJBQTdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBb0M7QUFBQSxFQUM3QztBQUVBLFFBQU0yUyxjQUFjWixNQUFNNVYsT0FBTyxDQUFDcUMsR0FBR3JCLE1BQU1xQixJQUFJckIsRUFBRTJCLFFBQVEsQ0FBQztBQUcxRCxRQUFNdVMsT0FBdUI7QUFDN0IsTUFBSXVCLFlBQVksQ0FBQyxHQUFHYixLQUFLO0FBQ3pCLE1BQUljLGtCQUFrQkY7QUFFdEIsU0FBT0MsVUFBVTVTLFNBQVMsR0FBRztBQUMzQixRQUFJOFMsT0FBTztBQUNYLFFBQUlDLFlBQVlDO0FBRWhCLGFBQVN2UixRQUFRLEdBQUdBLFNBQVNtUixVQUFVNVMsUUFBUXlCLFNBQVM7QUFDdEQsWUFBTTVFLFFBQVErVixVQUFVL1YsTUFBTSxHQUFHNEUsS0FBSztBQUN0QyxZQUFNd1IsY0FBY3BXLE1BQU1WLE9BQU8sQ0FBQ3FDLEdBQUdyQixNQUFNcUIsSUFBSXJCLEVBQUUyQixRQUFRLENBQUM7QUFDMUQsWUFBTW9VLGNBQWNELGNBQWNOO0FBQ2xDLFlBQU1RLGFBQWF6VCxLQUFLWTtBQUFBQSxRQUN0QixHQUFHekQsTUFBTTZCLElBQUksQ0FBQ3ZCLE1BQU07QUFDbEIsZ0JBQU1pVyxJQUFJalcsRUFBRTJCLFNBQVNtVTtBQUNyQixnQkFBTUksU0FBU0gsY0FBYyxJQUFLRSxJQUFJRixjQUFlO0FBQ3JELGlCQUFPeFQsS0FBS1ksSUFBSStTLFFBQVEsS0FBS0EsVUFBVSxFQUFFO0FBQUEsUUFDM0MsQ0FBQztBQUFBLE1BQ0g7QUFDQSxVQUFJRixjQUFjSixXQUFXO0FBQzNCQSxvQkFBWUk7QUFDWkwsZUFBT3JSO0FBQUFBLE1BQ1QsT0FBTztBQUNMO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFFQTRQLFNBQUs1VCxLQUFLbVYsVUFBVS9WLE1BQU0sR0FBR2lXLElBQUksQ0FBQztBQUNsQyxVQUFNUSxhQUFhVixVQUFVL1YsTUFBTSxHQUFHaVcsSUFBSSxFQUFFM1csT0FBTyxDQUFDcUMsR0FBR3JCLE1BQU1xQixJQUFJckIsRUFBRTJCLFFBQVEsQ0FBQztBQUM1RStULHVCQUFtQlM7QUFDbkJWLGdCQUFZQSxVQUFVL1YsTUFBTWlXLElBQUk7QUFBQSxFQUNsQztBQUVBLE1BQUlTLFdBQVc7QUFFZixTQUNFLHVCQUFDLFNBQUksV0FBVSxxQkFDYixpQ0FBQyxTQUFJLFdBQVUsZ0JBQ1psQyxlQUFLM1MsSUFBSSxDQUFDMkIsS0FBS21ULE9BQU87QUFDckIsVUFBTUMsWUFBWXBULElBQUlsRSxPQUFPLENBQUNxQyxHQUFHdUIsTUFBTXZCLElBQUl1QixFQUFFakIsUUFBUSxDQUFDO0FBQ3RELFdBQ0U7QUFBQSxNQUFDO0FBQUE7QUFBQSxRQUVDLFdBQVU7QUFBQSxRQUNWLE9BQU8sRUFBRTRVLFVBQVVELFdBQVdFLFlBQVksR0FBR0MsV0FBVyxFQUFFO0FBQUEsUUFFekR2VCxjQUFJM0IsSUFBSSxDQUFDOEksU0FBUztBQUNqQixnQkFBTXFNLEtBQUtOO0FBQ1gsZ0JBQU10QixXQUFZekssS0FBSzFJLFNBQVMyVSxZQUFhO0FBQzdDLGlCQUNFO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FFQyxXQUFVO0FBQUEsY0FDVixPQUNFO0FBQUEsZ0JBQ0UsZ0JBQWdCMUksY0FBYzhJLEVBQUU7QUFBQSxnQkFDaEN2TSxPQUFPLEdBQUcySyxRQUFRO0FBQUEsY0FDcEI7QUFBQSxjQUVGLE9BQU8sR0FBR3pLLEtBQUt2USxLQUFLLEtBQUt6QyxlQUFlZ1QsS0FBSzVFLEtBQUssQ0FBQyxLQUFLak8sY0FBYzZTLEtBQUsxSSxNQUFNLENBQUM7QUFBQSxjQUVsRjtBQUFBLHVDQUFDLFlBQVEwSSxlQUFLdlEsU0FBZDtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUFvQjtBQUFBLGdCQUNwQix1QkFBQyxVQUFNdEMsd0JBQWM2UyxLQUFLMUksTUFBTSxLQUFoQztBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUFrQztBQUFBLGdCQUNsQyx1QkFBQyxXQUFPdEsseUJBQWVnVCxLQUFLNUUsS0FBSyxLQUFqQztBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUFtQztBQUFBO0FBQUE7QUFBQSxZQVo5QjRFLEtBQUszUTtBQUFBQSxZQURaO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsVUFjQTtBQUFBLFFBRUosQ0FBQztBQUFBO0FBQUEsTUF4QkkyYztBQUFBQSxNQURQO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUEwQkE7QUFBQSxFQUVKLENBQUMsS0FoQ0g7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQWlDQSxLQWxDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBbUNBO0FBRUo7QUFBQ00sT0FyRlFwQjtBQXlGVCxTQUFTcUIsWUFBWTtBQUFBLEVBQ25CQztBQUFBQSxFQUNBQztBQUFBQSxFQUNBQztBQUtGLEdBQUc7QUFBQUMsTUFBQTtBQUNELFFBQU0sQ0FBQ0MsT0FBT0MsUUFBUSxJQUFJbGdCLFNBQVMsRUFBRTtBQUNyQyxRQUFNLENBQUNtZ0IsUUFBUUMsU0FBUyxJQUFJcGdCLFNBQXFCLEVBQUU7QUFDbkQsUUFBTSxDQUFDa1gsTUFBTUMsT0FBTyxJQUFJblgsU0FBUyxLQUFLO0FBQ3RDLFFBQU1xZ0IsVUFBVXRnQixPQUF5QixJQUFJO0FBRTdDRixZQUFVLE1BQU07QUFDZHlnQixVQUFNLGlCQUFpQixFQUNwQkMsS0FBSyxDQUFDM1UsTUFBTUEsRUFBRTRVLEtBQUssQ0FBQyxFQUNwQkQsS0FBSyxDQUFDM1osU0FBUztBQUNkLFVBQUlFLE1BQU1DLFFBQVFILElBQUksRUFBR3daLFdBQVV4WixJQUFJO0FBQUEsSUFDekMsQ0FBQyxFQUNBNlosTUFBTSxNQUFNO0FBQUEsSUFBQyxDQUFDO0FBQUEsRUFDbkIsR0FBRyxFQUFFO0FBRUw1Z0IsWUFBVSxNQUFNO0FBQ2QsYUFBUzZnQixZQUFZM04sR0FBZTtBQUNsQyxVQUFJc04sUUFBUXhaLFdBQVcsQ0FBQ3daLFFBQVF4WixRQUFReVEsU0FBU3ZFLEVBQUU3SSxNQUFjLEdBQUc7QUFDbEVpTixnQkFBUSxLQUFLO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFDQXpGLGFBQVM2RixpQkFBaUIsYUFBYW1KLFdBQVc7QUFDbEQsV0FBTyxNQUFNaFAsU0FBUzhGLG9CQUFvQixhQUFha0osV0FBVztBQUFBLEVBQ3BFLEdBQUcsRUFBRTtBQUVMLFFBQU1sVCxJQUFJeVMsTUFBTTVRLFlBQVk7QUFDNUIsUUFBTTNCLFdBQVd1UyxNQUFNcFUsU0FBUyxJQUM1QnNVLE9BQ0c1WTtBQUFBQSxJQUNDLENBQUM4QyxNQUNDQSxFQUFFeEksT0FBTzhMLFNBQVNILENBQUMsS0FDbkJuRCxFQUFFdkksS0FBS3VOLFlBQVksRUFBRTFCLFNBQVNILENBQUM7QUFBQSxFQUNuQyxFQUNDOUUsTUFBTSxHQUFHLENBQUMsSUFDYjtBQUVKLE1BQUlvWCxVQUFVO0FBQ1osV0FDRSx1QkFBQyxXQUFNLFdBQVUsNEJBQ2Y7QUFBQSw2QkFBQyxVQUFLLHFCQUFOO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBVztBQUFBLE1BQ1gsdUJBQUMsU0FBSSxXQUFVLGtCQUNiO0FBQUEsK0JBQUMsVUFBTUEsc0JBQVA7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUFnQjtBQUFBLFFBQ2hCLHVCQUFDLFlBQU8sTUFBSyxVQUFTLFdBQVUsZUFBYyxTQUFTQyxTQUFRLGlCQUEvRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBRUE7QUFBQSxXQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFLQTtBQUFBLFNBUEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQVFBO0FBQUEsRUFFSjtBQUVBLFNBQ0UsdUJBQUMsV0FBTSxXQUFVLDRCQUEyQixLQUFLTSxTQUMvQztBQUFBLDJCQUFDLFVBQUssNEJBQU47QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUFrQjtBQUFBLElBQ2xCO0FBQUEsTUFBQztBQUFBO0FBQUEsUUFDQyxPQUFPSjtBQUFBQSxRQUNQLFVBQVUsQ0FBQ2xOLE1BQU07QUFDZm1OLG1CQUFTbk4sRUFBRTdJLE9BQU91RSxLQUFLO0FBQ3ZCMEksa0JBQVEsSUFBSTtBQUFBLFFBQ2Q7QUFBQSxRQUNBLFNBQVMsTUFBTThJLE1BQU1wVSxTQUFTLEtBQUtzTCxRQUFRLElBQUk7QUFBQSxRQUMvQyxhQUFZO0FBQUEsUUFDWixjQUFhO0FBQUE7QUFBQSxNQVJmO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQVFvQjtBQUFBLElBRW5CRCxRQUFReEosU0FBUzdCLFNBQVMsS0FDekIsdUJBQUMsU0FBSSxXQUFVLGtCQUNaNkIsbUJBQVNuRDtBQUFBQSxNQUFJLENBQUNGLE1BQ2I7QUFBQSxRQUFDO0FBQUE7QUFBQSxVQUVDLE1BQUs7QUFBQSxVQUNMLFdBQVU7QUFBQSxVQUNWLFNBQVMsTUFBTTtBQUNid1YscUJBQVN4VixDQUFDO0FBQ1Y2VixxQkFBUyxFQUFFO0FBQ1gvSSxvQkFBUSxLQUFLO0FBQUEsVUFDZjtBQUFBLFVBRUE7QUFBQSxtQ0FBQyxZQUFROU0sWUFBRXhJLFVBQVg7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBa0I7QUFBQSxZQUNsQix1QkFBQyxVQUFNd0ksWUFBRXZJLFFBQVQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBYztBQUFBLFlBQ2QsdUJBQUMsV0FBT3VJLFlBQUV0SSxVQUFWO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQWlCO0FBQUE7QUFBQTtBQUFBLFFBWFpzSSxFQUFFeEk7QUFBQUEsUUFEVDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BYUE7QUFBQSxJQUNELEtBaEJIO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FpQkE7QUFBQSxPQTlCSjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBZ0NBO0FBRUo7QUFBQ21lLElBN0ZRSixhQUFXO0FBQUEsT0FBWEE7QUErRlQsZUFBZTNjO0FBQUksSUFBQTBkLElBQUEzTSxLQUFBd0IsS0FBQW9MLEtBQUFDLEtBQUE1SSxLQUFBSSxLQUFBeUksS0FBQUMsS0FBQWhELEtBQUFpRCxLQUFBckIsTUFBQXNCO0FBQUEsYUFBQU4sSUFBQTtBQUFBLGFBQUEzTSxLQUFBO0FBQUEsYUFBQXdCLEtBQUE7QUFBQSxhQUFBb0wsS0FBQTtBQUFBLGFBQUFDLEtBQUE7QUFBQSxhQUFBNUksS0FBQTtBQUFBLGFBQUFJLEtBQUE7QUFBQSxhQUFBeUksS0FBQTtBQUFBLGFBQUFDLEtBQUE7QUFBQSxhQUFBaEQsS0FBQTtBQUFBLGFBQUFpRCxLQUFBO0FBQUEsYUFBQXJCLE1BQUE7QUFBQSxhQUFBc0IsTUFBQSIsIm5hbWVzIjpbInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsImNvbXB1dGVQb3J0Zm9saW8iLCJjb21wdXRlVHdySW5kZXgiLCJjcmVhdGVJZCIsImZvcm1hdENvbXBhY3RDdXJyZW5jeSIsImZvcm1hdEN1cnJlbmN5IiwiZm9ybWF0RGF0ZUxvbmciLCJmb3JtYXREYXRlU2hvcnQiLCJmb3JtYXRQZXJjZW50IiwiZm9ybWF0UmVsYXRpdmVUaW1lIiwiZm9ybWF0U2lnbmVkUGVyY2VudCIsInBhcnNlSG9sZGluZ3NDc3YiLCJzYW1wbGVIb2xkaW5ncyIsInN0b3JhZ2VLZXkiLCJ4aXJyIiwiQ2hhcnRUb29sdGlwIiwiYnVpbGRDYXRtdWxsUm9tUGF0aCIsIm5pY2VUaWNrcyIsInVzZUNoYXJ0SG92ZXIiLCJhcHBseU1hcmtldERhdGEiLCJmZXRjaERpdmlkZW5kcyIsImZldGNoTWFya2V0RGF0YSIsImxvYWRQb3J0Zm9saW9Gcm9tRGlzayIsInNhdmVQb3J0Zm9saW9Ub0Rpc2siLCJjYXNoU3RvcmFnZUtleSIsInRhcmdldFN0b3JhZ2VLZXkiLCJpbnZlc3RTdG9yYWdlS2V5IiwiaGlzdG9yeVN0b3JhZ2VLZXkiLCJlbXB0eURyYWZ0IiwidGlja2VyIiwibmFtZSIsInNlY3RvciIsInNoYXJlcyIsInByaWNlIiwiY29zdEJhc2lzIiwiZGF5Q2hhbmdlUGN0IiwiZGl2aWRlbmRQZXJTaGFyZSIsInBheW91dERhdGUiLCJlbXB0eUNhc2hCdWNrZXRzIiwiYXZhaWxhYmxlIiwiZW1wdHlUYXJnZXREcmFmdCIsIm1vZGUiLCJrZXkiLCJ0YXJnZXRXZWlnaHRQY3QiLCJlbXB0eUludmVzdG1lbnREcmFmdCIsImRhdGUiLCJsYWJlbCIsImFtb3VudCIsInZhbHVlRW9tIiwiQXBwIiwiX3MiLCJob2xkaW5ncyIsInNldEhvbGRpbmdzIiwibG9hZEhvbGRpbmdzIiwiZHJhZnQiLCJzZXREcmFmdCIsImNhc2hEcmFmdCIsInNldENhc2hEcmFmdCIsImxvYWRDYXNoQnVja2V0cyIsInRhcmdldHMiLCJzZXRUYXJnZXRzIiwibG9hZFRhcmdldHMiLCJ0YXJnZXREcmFmdCIsInNldFRhcmdldERyYWZ0IiwidGFyZ2V0RmlsdGVyIiwic2V0VGFyZ2V0RmlsdGVyIiwidGFyZ2V0U3RhdHVzRmlsdGVyIiwic2V0VGFyZ2V0U3RhdHVzRmlsdGVyIiwidGFyZ2V0U29ydCIsInNldFRhcmdldFNvcnQiLCJ0cmVlbWFwTW9kZSIsInNldFRyZWVtYXBNb2RlIiwiYWxsb2NhdGlvblZpZXciLCJzZXRBbGxvY2F0aW9uVmlldyIsInBhZ2UiLCJzZXRQYWdlIiwiaW52ZXN0bWVudHMiLCJzZXRJbnZlc3RtZW50cyIsImxvYWRJbnZlc3RtZW50cyIsImludmVzdERyYWZ0Iiwic2V0SW52ZXN0RHJhZnQiLCJpbnZlc3RFcnJvciIsInNldEludmVzdEVycm9yIiwiaGlzdG9yeSIsInNldEhpc3RvcnkiLCJsb2FkSGlzdG9yeSIsImhvbGRpbmdzU2VhcmNoIiwic2V0SG9sZGluZ3NTZWFyY2giLCJob2xkaW5nc1NvcnQiLCJzZXRIb2xkaW5nc1NvcnQiLCJkaXIiLCJmZXRjaGluZyIsInNldEZldGNoaW5nIiwibGFzdEZldGNoZWRBdCIsInNldExhc3RGZXRjaGVkQXQiLCJkcmFmdEVycm9yIiwic2V0RHJhZnRFcnJvciIsImNhc2hFcnJvciIsInNldENhc2hFcnJvciIsInRhcmdldEVycm9yIiwic2V0VGFyZ2V0RXJyb3IiLCJ3aW5kb3ciLCJsb2NhbFN0b3JhZ2UiLCJzZXRJdGVtIiwiSlNPTiIsInN0cmluZ2lmeSIsImh5ZHJhdGVkUmVmIiwiY2FuY2VsbGVkIiwiZGF0YSIsImN1cnJlbnQiLCJBcnJheSIsImlzQXJyYXkiLCJjYXNoIiwiaG9sZGluZ3NXaXRoQ2FzaCIsImJ1aWxkSG9sZGluZ3NXaXRoQ2FzaCIsInBvcnRmb2xpbyIsInNlY3RvcnMiLCJidWlsZFNlY3RvckJ1Y2tldHMiLCJub25DYXNoUG9ydGZvbGlvIiwiZmlsdGVyIiwiaG9sZGluZyIsInRvTG93ZXJDYXNlIiwidG9wSG9sZGluZyIsImNhc2hXZWlnaHQiLCJ0b3RhbFZhbHVlIiwiY2FzaE1lc3NhZ2UiLCJnZXRDYXNoRGVwbG95bWVudElkZWEiLCJhbm51YWxpemVkRGl2aWRlbmRJbmNvbWUiLCJyZWR1Y2UiLCJzdW0iLCJlcXVpdHlDb3N0IiwiY29zdFZhbHVlIiwieWllbGRPbkNvc3QiLCJ1cGNvbWluZ0RpdmlkZW5kcyIsInNvcnQiLCJsZWZ0IiwicmlnaHQiLCJsb2NhbGVDb21wYXJlIiwic2xpY2UiLCJkaXZpZGVuZENhbGVuZGFyIiwibW9udGhzQWhlYWQiLCJub3ciLCJEYXRlIiwiY2VsbHMiLCJpIiwiZCIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJ5ZWFyIiwibW9udGgiLCJwdXNoIiwiU3RyaW5nIiwicGFkU3RhcnQiLCJJbnRsIiwiRGF0ZVRpbWVGb3JtYXQiLCJmb3JtYXQiLCJ0b3RhbCIsImVudHJpZXMiLCJwZCIsIk51bWJlciIsImlzRmluaXRlIiwiZ2V0VGltZSIsInRhcmdldCIsImZpbmQiLCJjIiwicyIsInNlY3RvcldlaWdodE1hcCIsIm1hcCIsIk1hcCIsImJ1Y2tldCIsInNldCIsIndlaWdodCIsInRpY2tlcldlaWdodE1hcCIsInRpY2tlclByaWNlTWFwIiwiaCIsInRhcmdldFJvd3MiLCJsb29rdXAiLCJjdXJyZW50V2VpZ2h0IiwiZ2V0IiwiZHJpZnQiLCJ0YXJnZXRXZWlnaHQiLCJnYXBWYWx1ZSIsImFic0RyaWZ0IiwiTWF0aCIsImFicyIsInN0YXR1cyIsImRyaWZ0U3VtbWFyeSIsIm92ZXIiLCJyIiwibGVuZ3RoIiwidW5kZXIiLCJvblRyYWNrIiwidG90YWxEZXZpYXRpb24iLCJyZWJhbGFuY2VTdWdnZXN0aW9ucyIsInJvdyIsIm1heCIsImJ1eVN1Z2dlc3Rpb25zIiwic2VsbFN1Z2dlc3Rpb25zIiwiaW52ZXN0bWVudFJvd3MiLCJzb3J0ZWQiLCJhIiwiYiIsInJ1bm5pbmciLCJlbnRyeSIsInBubFZhbHVlIiwicG5sUGN0IiwiaW52ZXN0bWVudFN1bW1hcnkiLCJsYXN0IiwidG90YWxJbnZlc3RlZCIsImxhdGVzdFZhbHVlIiwieGlyclBjdCIsImZsb3dzIiwidGVybWluYWxEYXRlIiwicmF0ZSIsImNvdW50Iiwic29ydGVkSG9sZGluZ3MiLCJxIiwidHJpbSIsImZpbHRlcmVkIiwiaW5jbHVkZXMiLCJtdWx0IiwidmFsdWVPZiIsIm1hcmtldFZhbHVlIiwiZ2Fpbkxvc3MiLCJhQ2FzaCIsImlkIiwic3RhcnRzV2l0aCIsImJDYXNoIiwidmEiLCJ2YiIsInRvZ2dsZVNvcnQiLCJjdXIiLCJ0cmVlbWFwSXRlbXMiLCJ2YWx1ZSIsIndhdGVyZmFsbFJvd3MiLCJtYXhXYXRlcmZhbGwiLCJ0b3BNb3ZlcnMiLCJoYW5kbGVJbXBvcnQiLCJmaWxlIiwidGV4dCIsImltcG9ydGVkIiwibm9ybWFsaXplSG9sZGluZyIsImFkZE1hbnVhbEhvbGRpbmciLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwidG9VcHBlckNhc2UiLCJhY2NvdW50Iiwic2F2ZUNhc2hCdWNrZXRzIiwiYWRkVGFyZ2V0QWxsb2NhdGlvbiIsIm5vcm1hbGl6ZWRLZXkiLCJyZW1vdmVUYXJnZXQiLCJhZGRJbnZlc3RtZW50IiwicmVtb3ZlSW52ZXN0bWVudCIsInJlbW92ZUhvbGRpbmciLCJyZWZyZXNoUHJpY2VzIiwibm9uQ2FzaCIsInF1b3RlcyIsImRpdmlkZW5kcyIsIlByb21pc2UiLCJhbGwiLCJ1cGRhdGVkIiwidG9JU09TdHJpbmciLCJlcXVpdHlPbmx5IiwiaXNDYXNoSG9sZGluZyIsInNuYXBzaG90IiwiaXNXZWVrZGF5IiwiYWZ0ZXJDbG9zZSIsInBrRGF0ZSIsInBzeENsb3NlU3RhdHVzIiwic29tZSIsInBrRGF0ZU9mIiwibmV4dCIsInRvdGFsQ29zdCIsInRvdGFsR2Fpbkxvc3MiLCJleHBvcnRQb3J0Zm9saW8iLCJleHBvcnRlZEF0IiwiYmxvYiIsIkJsb2IiLCJ0eXBlIiwidXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiaHJlZiIsImRvd25sb2FkIiwiY2xpY2siLCJyZXZva2VPYmplY3RVUkwiLCJpbXBvcnRQb3J0Zm9saW8iLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwib25sb2FkIiwicmVzdWx0IiwicGFyc2UiLCJjb25maXJtIiwiZXJyIiwiYWxlcnQiLCJFcnJvciIsIm1lc3NhZ2UiLCJyZWFkQXNUZXh0IiwiZmlsZXMiLCJzdG9jayIsInZhbCIsImUiLCJzY2FsZSIsImN1cnJlbnRQY3QiLCJ0YXJnZXRQY3QiLCJ3aWR0aCIsInRvRml4ZWQiLCJpdGVtIiwicGN0IiwiaXNQb3MiLCJjb250cmlidXRpb24iLCJzeW50aGV0aWNDYXNoIiwidG9Mb2NhbGVTdHJpbmciLCJGaWVsZCIsIm9uQ2hhbmdlIiwicGxhY2Vob2xkZXIiLCJtaW4iLCJzdGVwIiwiX2MyIiwicmF3IiwiZ2V0SXRlbSIsInBhcnNlZCIsInBrUGFydHMiLCJmbXQiLCJ0aW1lWm9uZSIsImRheSIsImhvdXIiLCJtaW51dGUiLCJob3VyMTIiLCJ3ZWVrZGF5IiwicGFydHMiLCJPYmplY3QiLCJmcm9tRW50cmllcyIsImZvcm1hdFRvUGFydHMiLCJwIiwiaXNvIiwiaXNOYU4iLCJjYXNoUG9zaXRpb24iLCJ2YWx1ZXMiLCJTdGF0Q2FyZCIsImRldGFpbCIsInRvbmUiLCJfYzMiLCJQaWVDaGFydCIsIl9zMiIsImhvdmVyZWQiLCJzZXRIb3ZlcmVkIiwicGFkIiwic2l6ZSIsInN0cm9rZSIsInJhZGl1cyIsImNpcmN1bWZlcmVuY2UiLCJQSSIsImRhc2hPZmZzZXQiLCJob3ZlcmVkSG9sZGluZyIsImluZGV4IiwiZGFzaExlbmd0aCIsImN1cnJlbnRPZmZzZXQiLCJpc0hvdmVyZWQiLCJpc0RpbW1lZCIsInN0cm9rZURhc2hhcnJheSIsInN0cm9rZURhc2hvZmZzZXQiLCJnZXRTbGljZUNvbG9yIiwiYmFja2dyb3VuZCIsInBhbGV0dGUiLCJDb21ib2JveCIsIm9wdGlvbnMiLCJfczMiLCJvcGVuIiwic2V0T3BlbiIsInJlZiIsIm9uRG9jQ2xpY2siLCJjb250YWlucyIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibyIsIm9wdCIsIlNvcnRIZWFkZXIiLCJzb3J0S2V5Iiwib25DbGljayIsImFsaWduIiwiYWN0aXZlIiwiYXJyb3ciLCJfYzYiLCJBY3Rpb25Sb3ciLCJraW5kIiwiaW1wYWN0IiwiX2M3IiwiSElTVE9SWV9TRVJJRVNfTUVUQSIsImNvbG9yIiwiY29zdCIsImRhc2hlZCIsInR3ciIsIlBvcnRmb2xpb0hpc3RvcnlDaGFydCIsInNuYXBzaG90cyIsImxhc3RGZXRjaGVkSXNvIiwiX3M0Iiwidmlld01vZGUiLCJzZXRWaWV3TW9kZSIsImhpZGRlblNlcmllcyIsInNldEhpZGRlblNlcmllcyIsIlNldCIsInR3ckluZGV4IiwiVyIsIkgiLCJwYWRMIiwicGFkUiIsInBhZFQiLCJwYWRCIiwiaW5uZXJXIiwiaW5uZXJIIiwidmlzaWJsZUtleXMiLCJrZXlzIiwiayIsImhhcyIsImNoYXJ0IiwiY29zdHMiLCJzZXJpZXNCeUtleSIsInYiLCJhbGxWaXNpYmxlIiwiZmxhdE1hcCIsImhpIiwibG8iLCJzcGFuIiwieUhpIiwieUxvIiwieE9mIiwieU9mIiwicG9pbnRzQnlLZXkiLCJ4IiwieSIsInRpY2tWYWx1ZXMiLCJjb250YWluZXJSZWYiLCJzdmdSZWYiLCJob3ZlciIsImhhbmRsZXJzIiwicG9pbnRDb3VudCIsInBsb3RMZWZ0IiwicGxvdFJpZ2h0Iiwidmlld0JveFdpZHRoIiwiY29udGFpbmVyV2lkdGgiLCJjbGllbnRXaWR0aCIsInRvZ2dsZVNlcmllcyIsImRlbGV0ZSIsImFkZCIsImxhYmVsRXZlcnkiLCJjZWlsIiwiZm9ybWF0WSIsImhvdmVyZWRJZHgiLCJsYXN0U25hcCIsImZpcnN0U25hcCIsInZhbHVlQ2hhbmdlIiwidmFsdWVDaGFuZ2VQY3QiLCJ0d3JDdW11bGF0aXZlIiwibWV0YSIsImhpZGRlbiIsImJvcmRlckNvbG9yIiwiYm9yZGVyU3R5bGUiLCJwdHMiLCJ1bmRlZmluZWQiLCJjb250YWluZXJYIiwiY29udGFpbmVyWSIsIklOVkVTVF9TRVJJRVNfTUVUQSIsIkludmVzdG1lbnRDaGFydCIsInJvd3MiLCJfczUiLCJ0b3RhbHMiLCJ2aXNpYmxlU2VyaWVzIiwic3RlcFBhdGgiLCJzdGVwQXJlYSIsInZhbHVlUG9pbnRzIiwidG90YWxQb2ludHMiLCJ2YWx1ZVBhdGgiLCJSYW5rZWRBbGxvY2F0aW9uIiwiaXRlbXMiLCJ0b3AiLCJ3aWR0aFBjdCIsIl9jMCIsIkRpdmlkZW5kQ2FsZW5kYXJDaGFydCIsIl9zNiIsIm0iLCJob3ZlcmVkQ2VsbCIsImNlbGwiLCJoZWlnaHRQY3QiLCJoZWlnaHQiLCJUcmVlbWFwIiwidG90YWxXZWlnaHQiLCJyZW1haW5pbmciLCJyZW1haW5pbmdXZWlnaHQiLCJiZXN0IiwiYmVzdFJhdGlvIiwiSW5maW5pdHkiLCJzbGljZVdlaWdodCIsInJvd0ZyYWN0aW9uIiwid29yc3RSYXRpbyIsInciLCJhc3BlY3QiLCJ1c2VkV2VpZ2h0IiwiY29sb3JJZHgiLCJyaSIsInJvd1dlaWdodCIsImZsZXhHcm93IiwiZmxleFNocmluayIsImZsZXhCYXNpcyIsImNpIiwiX2MxMCIsIlN0b2NrU2VhcmNoIiwib25TZWxlY3QiLCJzZWxlY3RlZCIsIm9uQ2xlYXIiLCJfczciLCJxdWVyeSIsInNldFF1ZXJ5Iiwic3RvY2tzIiwic2V0U3RvY2tzIiwid3JhcFJlZiIsImZldGNoIiwidGhlbiIsImpzb24iLCJjYXRjaCIsImhhbmRsZUNsaWNrIiwiX2MiLCJfYzQiLCJfYzUiLCJfYzgiLCJfYzkiLCJfYzEiLCJfYzExIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkFwcC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgdHlwZSB7IEhvbGRpbmcgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHtcbiAgY29tcHV0ZVBvcnRmb2xpbyxcbiAgY29tcHV0ZVR3ckluZGV4LFxuICBjcmVhdGVJZCxcbiAgZm9ybWF0Q29tcGFjdEN1cnJlbmN5LFxuICBmb3JtYXRDdXJyZW5jeSxcbiAgZm9ybWF0RGF0ZUxvbmcsXG4gIGZvcm1hdERhdGVTaG9ydCxcbiAgZm9ybWF0UGVyY2VudCxcbiAgZm9ybWF0UmVsYXRpdmVUaW1lLFxuICBmb3JtYXRTaWduZWRQZXJjZW50LFxuICBwYXJzZUhvbGRpbmdzQ3N2LFxuICBzYW1wbGVIb2xkaW5ncyxcbiAgc3RvcmFnZUtleSxcbiAgeGlycixcbn0gZnJvbSBcIi4vdXRpbHNcIjtcbmltcG9ydCB7XG4gIENoYXJ0VG9vbHRpcCxcbiAgYnVpbGRDYXRtdWxsUm9tUGF0aCxcbiAgbmljZVRpY2tzLFxuICB1c2VDaGFydEhvdmVyLFxufSBmcm9tIFwiLi9jaGFydEhlbHBlcnNcIjtcbmltcG9ydCB7IGFwcGx5TWFya2V0RGF0YSwgZmV0Y2hEaXZpZGVuZHMsIGZldGNoTWFya2V0RGF0YSB9IGZyb20gXCIuL3NlcnZpY2VzL3BzeC1zY3JhcGVyXCI7XG5pbXBvcnQgeyBsb2FkUG9ydGZvbGlvRnJvbURpc2ssIHNhdmVQb3J0Zm9saW9Ub0Rpc2sgfSBmcm9tIFwiLi9zZXJ2aWNlcy9wb3J0Zm9saW8tc3RvcmVcIjtcblxudHlwZSBTZWN0b3JCdWNrZXQgPSB7XG4gIHNlY3Rvcjogc3RyaW5nO1xuICB2YWx1ZTogbnVtYmVyO1xuICB3ZWlnaHQ6IG51bWJlcjtcbiAgaG9sZGluZ3M6IG51bWJlcjtcbn07XG5cbnR5cGUgRHJhZnRIb2xkaW5nID0gT21pdDxIb2xkaW5nLCBcImlkXCIgfCBcImFjY291bnRcIj47XG5cbnR5cGUgQ2FzaEJ1Y2tldHMgPSB7XG4gIGF2YWlsYWJsZTogbnVtYmVyO1xufTtcblxudHlwZSBUYXJnZXRBbGxvY2F0aW9uID0ge1xuICBpZDogc3RyaW5nO1xuICBtb2RlOiBcInNlY3RvclwiIHwgXCJ0aWNrZXJcIjtcbiAga2V5OiBzdHJpbmc7XG4gIHRhcmdldFdlaWdodDogbnVtYmVyO1xufTtcblxudHlwZSBEcmFmdFRhcmdldCA9IHtcbiAgbW9kZTogXCJzZWN0b3JcIiB8IFwidGlja2VyXCI7XG4gIGtleTogc3RyaW5nO1xuICB0YXJnZXRXZWlnaHRQY3Q6IG51bWJlcjtcbn07XG5cbnR5cGUgSW52ZXN0bWVudEVudHJ5ID0ge1xuICBpZDogc3RyaW5nO1xuICBkYXRlOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGFtb3VudDogbnVtYmVyO1xuICB2YWx1ZUVvbTogbnVtYmVyO1xufTtcblxudHlwZSBEcmFmdEludmVzdG1lbnQgPSB7XG4gIGRhdGU6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgYW1vdW50OiBudW1iZXI7XG4gIHZhbHVlRW9tOiBudW1iZXI7XG59O1xuXG50eXBlIFBvcnRmb2xpb1NuYXBzaG90ID0ge1xuICBkYXRlOiBzdHJpbmc7XG4gIHRvdGFsVmFsdWU6IG51bWJlcjtcbiAgdG90YWxDb3N0OiBudW1iZXI7XG4gIGdhaW5Mb3NzOiBudW1iZXI7XG59O1xuXG50eXBlIFNvcnREaXIgPSBcImFzY1wiIHwgXCJkZXNjXCI7XG50eXBlIEhvbGRpbmdzU29ydEtleSA9XG4gIHwgXCJ0aWNrZXJcIlxuICB8IFwibmFtZVwiXG4gIHwgXCJzZWN0b3JcIlxuICB8IFwic2hhcmVzXCJcbiAgfCBcImNvc3RCYXNpc1wiXG4gIHwgXCJwcmljZVwiXG4gIHwgXCJkYXlDaGFuZ2VQY3RcIlxuICB8IFwiZGl2WWllbGRcIlxuICB8IFwibWFya2V0VmFsdWVcIlxuICB8IFwid2VpZ2h0XCJcbiAgfCBcInBubFRvZGF5XCJcbiAgfCBcImdhaW5Mb3NzXCI7XG5cbmNvbnN0IGNhc2hTdG9yYWdlS2V5ID0gYCR7c3RvcmFnZUtleX06Y2FzaC1idWNrZXRzYDtcbmNvbnN0IHRhcmdldFN0b3JhZ2VLZXkgPSBgJHtzdG9yYWdlS2V5fTp0YXJnZXRzYDtcbmNvbnN0IGludmVzdFN0b3JhZ2VLZXkgPSBgJHtzdG9yYWdlS2V5fTppbnZlc3RtZW50c2A7XG5jb25zdCBoaXN0b3J5U3RvcmFnZUtleSA9IGAke3N0b3JhZ2VLZXl9Omhpc3RvcnlgO1xuXG5jb25zdCBlbXB0eURyYWZ0OiBEcmFmdEhvbGRpbmcgPSB7XG4gIHRpY2tlcjogXCJcIixcbiAgbmFtZTogXCJcIixcbiAgc2VjdG9yOiBcIlVuY2F0ZWdvcml6ZWRcIixcbiAgc2hhcmVzOiAwLFxuICBwcmljZTogMCxcbiAgY29zdEJhc2lzOiAwLFxuICBkYXlDaGFuZ2VQY3Q6IDAsXG4gIGRpdmlkZW5kUGVyU2hhcmU6IDAsXG4gIHBheW91dERhdGU6IFwiXCIsXG59O1xuXG5jb25zdCBlbXB0eUNhc2hCdWNrZXRzOiBDYXNoQnVja2V0cyA9IHtcbiAgYXZhaWxhYmxlOiAwLFxufTtcblxuY29uc3QgZW1wdHlUYXJnZXREcmFmdDogRHJhZnRUYXJnZXQgPSB7XG4gIG1vZGU6IFwic2VjdG9yXCIsXG4gIGtleTogXCJcIixcbiAgdGFyZ2V0V2VpZ2h0UGN0OiAwLFxufTtcblxuY29uc3QgZW1wdHlJbnZlc3RtZW50RHJhZnQ6IERyYWZ0SW52ZXN0bWVudCA9IHtcbiAgZGF0ZTogXCJcIixcbiAgbGFiZWw6IFwiXCIsXG4gIGFtb3VudDogMCxcbiAgdmFsdWVFb206IDAsXG59O1xuXG5mdW5jdGlvbiBBcHAoKSB7XG4gIGNvbnN0IFtob2xkaW5ncywgc2V0SG9sZGluZ3NdID0gdXNlU3RhdGU8SG9sZGluZ1tdPigoKSA9PiBsb2FkSG9sZGluZ3MoKSk7XG4gIGNvbnN0IFtkcmFmdCwgc2V0RHJhZnRdID0gdXNlU3RhdGU8RHJhZnRIb2xkaW5nPihlbXB0eURyYWZ0KTtcbiAgY29uc3QgW2Nhc2hEcmFmdCwgc2V0Q2FzaERyYWZ0XSA9IHVzZVN0YXRlPENhc2hCdWNrZXRzPigoKSA9PiBsb2FkQ2FzaEJ1Y2tldHMoKSk7XG4gIGNvbnN0IFt0YXJnZXRzLCBzZXRUYXJnZXRzXSA9IHVzZVN0YXRlPFRhcmdldEFsbG9jYXRpb25bXT4oKCkgPT4gbG9hZFRhcmdldHMoKSk7XG4gIGNvbnN0IFt0YXJnZXREcmFmdCwgc2V0VGFyZ2V0RHJhZnRdID0gdXNlU3RhdGU8RHJhZnRUYXJnZXQ+KGVtcHR5VGFyZ2V0RHJhZnQpO1xuICBjb25zdCBbdGFyZ2V0RmlsdGVyLCBzZXRUYXJnZXRGaWx0ZXJdID0gdXNlU3RhdGUoXCJcIik7XG4gIGNvbnN0IFt0YXJnZXRTdGF0dXNGaWx0ZXIsIHNldFRhcmdldFN0YXR1c0ZpbHRlcl0gPSB1c2VTdGF0ZTxcImFsbFwiIHwgXCJvdmVyXCIgfCBcInVuZGVyXCIgfCBcIm9udHJhY2tcIj4oXCJhbGxcIik7XG4gIGNvbnN0IFt0YXJnZXRTb3J0LCBzZXRUYXJnZXRTb3J0XSA9IHVzZVN0YXRlPFwiZHJpZnRcIiB8IFwibmFtZVwiIHwgXCJ3ZWlnaHRcIj4oXCJkcmlmdFwiKTtcbiAgY29uc3QgW3RyZWVtYXBNb2RlLCBzZXRUcmVlbWFwTW9kZV0gPSB1c2VTdGF0ZTxcInNlY3RvclwiIHwgXCJ0aWNrZXJcIj4oXCJzZWN0b3JcIik7XG4gIGNvbnN0IFthbGxvY2F0aW9uVmlldywgc2V0QWxsb2NhdGlvblZpZXddID0gdXNlU3RhdGU8XCJtYXBcIiB8IFwicmFua2VkXCI+KFwibWFwXCIpO1xuICBjb25zdCBbcGFnZSwgc2V0UGFnZV0gPSB1c2VTdGF0ZTxcIm92ZXJ2aWV3XCIgfCBcImhvbGRpbmdzXCIgfCBcInRhcmdldHNcIiB8IFwiaW5jb21lXCIgfCBcImludmVzdFwiPihcIm92ZXJ2aWV3XCIpO1xuICBjb25zdCBbaW52ZXN0bWVudHMsIHNldEludmVzdG1lbnRzXSA9IHVzZVN0YXRlPEludmVzdG1lbnRFbnRyeVtdPigoKSA9PiBsb2FkSW52ZXN0bWVudHMoKSk7XG4gIGNvbnN0IFtpbnZlc3REcmFmdCwgc2V0SW52ZXN0RHJhZnRdID0gdXNlU3RhdGU8RHJhZnRJbnZlc3RtZW50PihlbXB0eUludmVzdG1lbnREcmFmdCk7XG4gIGNvbnN0IFtpbnZlc3RFcnJvciwgc2V0SW52ZXN0RXJyb3JdID0gdXNlU3RhdGUoXCJcIik7XG4gIGNvbnN0IFtoaXN0b3J5LCBzZXRIaXN0b3J5XSA9IHVzZVN0YXRlPFBvcnRmb2xpb1NuYXBzaG90W10+KCgpID0+IGxvYWRIaXN0b3J5KCkpO1xuICBjb25zdCBbaG9sZGluZ3NTZWFyY2gsIHNldEhvbGRpbmdzU2VhcmNoXSA9IHVzZVN0YXRlKFwiXCIpO1xuICBjb25zdCBbaG9sZGluZ3NTb3J0LCBzZXRIb2xkaW5nc1NvcnRdID0gdXNlU3RhdGU8eyBrZXk6IEhvbGRpbmdzU29ydEtleSB8IG51bGw7IGRpcjogU29ydERpciB9Pih7XG4gICAga2V5OiBudWxsLFxuICAgIGRpcjogXCJkZXNjXCIsXG4gIH0pO1xuXG4gIGNvbnN0IFtmZXRjaGluZywgc2V0RmV0Y2hpbmddID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbbGFzdEZldGNoZWRBdCwgc2V0TGFzdEZldGNoZWRBdF0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2RyYWZ0RXJyb3IsIHNldERyYWZ0RXJyb3JdID0gdXNlU3RhdGUoXCJcIik7XG4gIGNvbnN0IFtjYXNoRXJyb3IsIHNldENhc2hFcnJvcl0gPSB1c2VTdGF0ZShcIlwiKTtcbiAgY29uc3QgW3RhcmdldEVycm9yLCBzZXRUYXJnZXRFcnJvcl0gPSB1c2VTdGF0ZShcIlwiKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShob2xkaW5ncykpO1xuICB9LCBbaG9sZGluZ3NdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShjYXNoU3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkoY2FzaERyYWZ0KSk7XG4gIH0sIFtjYXNoRHJhZnRdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0YXJnZXRTdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeSh0YXJnZXRzKSk7XG4gIH0sIFt0YXJnZXRzXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oaW52ZXN0U3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkoaW52ZXN0bWVudHMpKTtcbiAgfSwgW2ludmVzdG1lbnRzXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oaGlzdG9yeVN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KGhpc3RvcnkpKTtcbiAgfSwgW2hpc3RvcnldKTtcblxuICBjb25zdCBoeWRyYXRlZFJlZiA9IHVzZVJlZihmYWxzZSk7XG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgbG9hZFBvcnRmb2xpb0Zyb21EaXNrKCk7XG4gICAgICBpZiAoY2FuY2VsbGVkIHx8ICFkYXRhKSB7XG4gICAgICAgIGh5ZHJhdGVkUmVmLmN1cnJlbnQgPSB0cnVlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmhvbGRpbmdzKSkgc2V0SG9sZGluZ3MoZGF0YS5ob2xkaW5ncyBhcyBIb2xkaW5nW10pO1xuICAgICAgaWYgKGRhdGEuY2FzaCAmJiB0eXBlb2YgZGF0YS5jYXNoID09PSBcIm9iamVjdFwiKSBzZXRDYXNoRHJhZnQoZGF0YS5jYXNoIGFzIENhc2hCdWNrZXRzKTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEudGFyZ2V0cykpIHNldFRhcmdldHMoZGF0YS50YXJnZXRzIGFzIFRhcmdldEFsbG9jYXRpb25bXSk7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmludmVzdG1lbnRzKSkgc2V0SW52ZXN0bWVudHMoZGF0YS5pbnZlc3RtZW50cyBhcyBJbnZlc3RtZW50RW50cnlbXSk7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmhpc3RvcnkpKSBzZXRIaXN0b3J5KGRhdGEuaGlzdG9yeSBhcyBQb3J0Zm9saW9TbmFwc2hvdFtdKTtcbiAgICAgIGh5ZHJhdGVkUmVmLmN1cnJlbnQgPSB0cnVlO1xuICAgIH0pKCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFoeWRyYXRlZFJlZi5jdXJyZW50KSByZXR1cm47XG4gICAgc2F2ZVBvcnRmb2xpb1RvRGlzayh7XG4gICAgICBob2xkaW5ncyxcbiAgICAgIGNhc2g6IGNhc2hEcmFmdCxcbiAgICAgIHRhcmdldHMsXG4gICAgICBpbnZlc3RtZW50cyxcbiAgICAgIGhpc3RvcnksXG4gICAgfSk7XG4gIH0sIFtob2xkaW5ncywgY2FzaERyYWZ0LCB0YXJnZXRzLCBpbnZlc3RtZW50cywgaGlzdG9yeV0pO1xuXG4gIGNvbnN0IGhvbGRpbmdzV2l0aENhc2ggPSB1c2VNZW1vKFxuICAgICgpID0+IGJ1aWxkSG9sZGluZ3NXaXRoQ2FzaChob2xkaW5ncywgY2FzaERyYWZ0KSxcbiAgICBbaG9sZGluZ3MsIGNhc2hEcmFmdF0sXG4gICk7XG5cbiAgY29uc3QgcG9ydGZvbGlvID0gdXNlTWVtbyhcbiAgICAoKSA9PiBjb21wdXRlUG9ydGZvbGlvKGhvbGRpbmdzV2l0aENhc2gpLFxuICAgIFtob2xkaW5nc1dpdGhDYXNoXSxcbiAgKTtcbiAgY29uc3Qgc2VjdG9ycyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gYnVpbGRTZWN0b3JCdWNrZXRzKHBvcnRmb2xpby5ob2xkaW5ncyksXG4gICAgW3BvcnRmb2xpby5ob2xkaW5nc10sXG4gICk7XG5cbiAgY29uc3Qgbm9uQ2FzaFBvcnRmb2xpbyA9IHBvcnRmb2xpby5ob2xkaW5ncy5maWx0ZXIoXG4gICAgKGhvbGRpbmcpID0+IGhvbGRpbmcuc2VjdG9yLnRvTG93ZXJDYXNlKCkgIT09IFwiY2FzaFwiLFxuICApO1xuXG4gIGNvbnN0IHRvcEhvbGRpbmcgPSBwb3J0Zm9saW8uaG9sZGluZ3NbMF07XG4gIGNvbnN0IGNhc2hXZWlnaHQgPSBwb3J0Zm9saW8udG90YWxWYWx1ZSA+IDAgPyBjYXNoRHJhZnQuYXZhaWxhYmxlIC8gcG9ydGZvbGlvLnRvdGFsVmFsdWUgOiAwO1xuICBjb25zdCBjYXNoTWVzc2FnZSA9IGdldENhc2hEZXBsb3ltZW50SWRlYShjYXNoV2VpZ2h0KTtcblxuICBjb25zdCBhbm51YWxpemVkRGl2aWRlbmRJbmNvbWUgPSBub25DYXNoUG9ydGZvbGlvLnJlZHVjZShcbiAgICAoc3VtLCBob2xkaW5nKSA9PiBzdW0gKyBob2xkaW5nLnNoYXJlcyAqIGhvbGRpbmcuZGl2aWRlbmRQZXJTaGFyZSxcbiAgICAwLFxuICApO1xuICBjb25zdCBlcXVpdHlDb3N0ID0gbm9uQ2FzaFBvcnRmb2xpby5yZWR1Y2UoKHN1bSwgaG9sZGluZykgPT4gc3VtICsgaG9sZGluZy5jb3N0VmFsdWUsIDApO1xuICBjb25zdCB5aWVsZE9uQ29zdCA9IGVxdWl0eUNvc3QgPiAwID8gYW5udWFsaXplZERpdmlkZW5kSW5jb21lIC8gZXF1aXR5Q29zdCA6IDA7XG4gIGNvbnN0IHVwY29taW5nRGl2aWRlbmRzID0gWy4uLm5vbkNhc2hQb3J0Zm9saW9dXG4gICAgLmZpbHRlcigoaG9sZGluZykgPT4gaG9sZGluZy5wYXlvdXREYXRlKVxuICAgIC5zb3J0KChsZWZ0LCByaWdodCkgPT4gbGVmdC5wYXlvdXREYXRlLmxvY2FsZUNvbXBhcmUocmlnaHQucGF5b3V0RGF0ZSkpXG4gICAgLnNsaWNlKDAsIDQpO1xuXG4gIGNvbnN0IGRpdmlkZW5kQ2FsZW5kYXIgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBtb250aHNBaGVhZCA9IDEyO1xuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgY2VsbHM6IEFycmF5PHtcbiAgICAgIGtleTogc3RyaW5nO1xuICAgICAgbGFiZWw6IHN0cmluZztcbiAgICAgIHllYXI6IG51bWJlcjtcbiAgICAgIG1vbnRoOiBudW1iZXI7XG4gICAgICB0b3RhbDogbnVtYmVyO1xuICAgICAgZW50cmllczogeyB0aWNrZXI6IHN0cmluZzsgYW1vdW50OiBudW1iZXI7IGRhdGU6IHN0cmluZyB9W107XG4gICAgfT4gPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1vbnRoc0FoZWFkOyBpKyspIHtcbiAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShub3cuZ2V0RnVsbFllYXIoKSwgbm93LmdldE1vbnRoKCkgKyBpLCAxKTtcbiAgICAgIGNvbnN0IHllYXIgPSBkLmdldEZ1bGxZZWFyKCk7XG4gICAgICBjb25zdCBtb250aCA9IGQuZ2V0TW9udGgoKTtcbiAgICAgIGNlbGxzLnB1c2goe1xuICAgICAgICBrZXk6IGAke3llYXJ9LSR7U3RyaW5nKG1vbnRoICsgMSkucGFkU3RhcnQoMiwgXCIwXCIpfWAsXG4gICAgICAgIGxhYmVsOiBuZXcgSW50bC5EYXRlVGltZUZvcm1hdChcImVuLUdCXCIsIHtcbiAgICAgICAgICBtb250aDogXCJzaG9ydFwiLFxuICAgICAgICAgIHllYXI6IFwiMi1kaWdpdFwiLFxuICAgICAgICB9KS5mb3JtYXQoZCksXG4gICAgICAgIHllYXIsXG4gICAgICAgIG1vbnRoLFxuICAgICAgICB0b3RhbDogMCxcbiAgICAgICAgZW50cmllczogW10sXG4gICAgICB9KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBob2xkaW5nIG9mIG5vbkNhc2hQb3J0Zm9saW8pIHtcbiAgICAgIGlmICghaG9sZGluZy5wYXlvdXREYXRlIHx8IGhvbGRpbmcuZGl2aWRlbmRQZXJTaGFyZSA8PSAwKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHBkID0gbmV3IERhdGUoaG9sZGluZy5wYXlvdXREYXRlKTtcbiAgICAgIGlmICghTnVtYmVyLmlzRmluaXRlKHBkLmdldFRpbWUoKSkpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgdGFyZ2V0ID0gY2VsbHMuZmluZChcbiAgICAgICAgKGMpID0+IGMueWVhciA9PT0gcGQuZ2V0RnVsbFllYXIoKSAmJiBjLm1vbnRoID09PSBwZC5nZXRNb250aCgpLFxuICAgICAgKTtcbiAgICAgIGlmICghdGFyZ2V0KSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGFtb3VudCA9IGhvbGRpbmcuc2hhcmVzICogaG9sZGluZy5kaXZpZGVuZFBlclNoYXJlO1xuICAgICAgdGFyZ2V0LnRvdGFsICs9IGFtb3VudDtcbiAgICAgIHRhcmdldC5lbnRyaWVzLnB1c2goe1xuICAgICAgICB0aWNrZXI6IGhvbGRpbmcudGlja2VyLFxuICAgICAgICBhbW91bnQsXG4gICAgICAgIGRhdGU6IGhvbGRpbmcucGF5b3V0RGF0ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCB0b3RhbCA9IGNlbGxzLnJlZHVjZSgocywgYykgPT4gcyArIGMudG90YWwsIDApO1xuICAgIHJldHVybiB7IGNlbGxzLCB0b3RhbCB9O1xuICB9LCBbbm9uQ2FzaFBvcnRmb2xpb10pO1xuXG4gIGNvbnN0IHNlY3RvcldlaWdodE1hcCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBidWNrZXQgb2Ygc2VjdG9ycykge1xuICAgICAgbWFwLnNldChidWNrZXQuc2VjdG9yLnRvTG93ZXJDYXNlKCksIGJ1Y2tldC53ZWlnaHQpO1xuICAgIH1cbiAgICByZXR1cm4gbWFwO1xuICB9LCBbc2VjdG9yc10pO1xuXG4gIGNvbnN0IHRpY2tlcldlaWdodE1hcCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBob2xkaW5nIG9mIHBvcnRmb2xpby5ob2xkaW5ncykge1xuICAgICAgbWFwLnNldChob2xkaW5nLnRpY2tlci50b0xvd2VyQ2FzZSgpLCBob2xkaW5nLndlaWdodCk7XG4gICAgfVxuICAgIHJldHVybiBtYXA7XG4gIH0sIFtwb3J0Zm9saW8uaG9sZGluZ3NdKTtcblxuICBjb25zdCB0aWNrZXJQcmljZU1hcCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBoIG9mIHBvcnRmb2xpby5ob2xkaW5ncykge1xuICAgICAgbWFwLnNldChoLnRpY2tlci50b0xvd2VyQ2FzZSgpLCBoLnByaWNlKTtcbiAgICB9XG4gICAgcmV0dXJuIG1hcDtcbiAgfSwgW3BvcnRmb2xpby5ob2xkaW5nc10pO1xuXG4gIGNvbnN0IHRhcmdldFJvd3MgPSB0YXJnZXRzLm1hcCgodGFyZ2V0KSA9PiB7XG4gICAgY29uc3QgbG9va3VwID0gdGFyZ2V0Lm1vZGUgPT09IFwic2VjdG9yXCIgPyBzZWN0b3JXZWlnaHRNYXAgOiB0aWNrZXJXZWlnaHRNYXA7XG4gICAgY29uc3QgY3VycmVudFdlaWdodCA9IGxvb2t1cC5nZXQodGFyZ2V0LmtleS50b0xvd2VyQ2FzZSgpKSA/PyAwO1xuICAgIGNvbnN0IGRyaWZ0ID0gY3VycmVudFdlaWdodCAtIHRhcmdldC50YXJnZXRXZWlnaHQ7XG4gICAgY29uc3QgZ2FwVmFsdWUgPSAodGFyZ2V0LnRhcmdldFdlaWdodCAtIGN1cnJlbnRXZWlnaHQpICogcG9ydGZvbGlvLnRvdGFsVmFsdWU7XG4gICAgY29uc3QgYWJzRHJpZnQgPSBNYXRoLmFicyhkcmlmdCk7XG4gICAgY29uc3Qgc3RhdHVzOiBcInNldmVyZVwiIHwgXCJtb2RlcmF0ZVwiIHwgXCJvbnRyYWNrXCIgPVxuICAgICAgYWJzRHJpZnQgPj0gMC4wNSA/IFwic2V2ZXJlXCIgOiBhYnNEcmlmdCA+PSAwLjAyID8gXCJtb2RlcmF0ZVwiIDogXCJvbnRyYWNrXCI7XG4gICAgY29uc3QgcHJpY2UgPSB0YXJnZXQubW9kZSA9PT0gXCJ0aWNrZXJcIiA/IHRpY2tlclByaWNlTWFwLmdldCh0YXJnZXQua2V5LnRvTG93ZXJDYXNlKCkpID8/IDAgOiAwO1xuICAgIGNvbnN0IHNoYXJlcyA9IHByaWNlID4gMCA/IE1hdGguYWJzKGdhcFZhbHVlKSAvIHByaWNlIDogMDtcblxuICAgIHJldHVybiB7XG4gICAgICAuLi50YXJnZXQsXG4gICAgICBjdXJyZW50V2VpZ2h0LFxuICAgICAgZHJpZnQsXG4gICAgICBnYXBWYWx1ZSxcbiAgICAgIGFic0RyaWZ0LFxuICAgICAgc3RhdHVzLFxuICAgICAgcHJpY2UsXG4gICAgICBzaGFyZXMsXG4gICAgfTtcbiAgfSk7XG5cbiAgY29uc3QgZHJpZnRTdW1tYXJ5ID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgb3ZlciA9IHRhcmdldFJvd3MuZmlsdGVyKChyKSA9PiByLmRyaWZ0ID4gMC4wMDUpLmxlbmd0aDtcbiAgICBjb25zdCB1bmRlciA9IHRhcmdldFJvd3MuZmlsdGVyKChyKSA9PiByLmRyaWZ0IDwgLTAuMDA1KS5sZW5ndGg7XG4gICAgY29uc3Qgb25UcmFjayA9IHRhcmdldFJvd3MubGVuZ3RoIC0gb3ZlciAtIHVuZGVyO1xuICAgIGNvbnN0IHRvdGFsRGV2aWF0aW9uID0gdGFyZ2V0Um93cy5yZWR1Y2UoKHMsIHIpID0+IHMgKyByLmFic0RyaWZ0LCAwKTtcbiAgICByZXR1cm4geyBvdmVyLCB1bmRlciwgb25UcmFjaywgdG90YWxEZXZpYXRpb24gfTtcbiAgfSwgW3RhcmdldFJvd3NdKTtcblxuICBjb25zdCByZWJhbGFuY2VTdWdnZXN0aW9ucyA9IHRhcmdldFJvd3NcbiAgICAuZmlsdGVyKFxuICAgICAgKHJvdykgPT5cbiAgICAgICAgTWF0aC5hYnMocm93LmdhcFZhbHVlKSA+IE1hdGgubWF4KDUwMDAsIHBvcnRmb2xpby50b3RhbFZhbHVlICogMC4wMSksXG4gICAgKVxuICAgIC5zb3J0KChsZWZ0LCByaWdodCkgPT4gTWF0aC5hYnMocmlnaHQuZ2FwVmFsdWUpIC0gTWF0aC5hYnMobGVmdC5nYXBWYWx1ZSkpXG4gICAgLnNsaWNlKDAsIDgpO1xuXG4gIGNvbnN0IGJ1eVN1Z2dlc3Rpb25zID0gcmViYWxhbmNlU3VnZ2VzdGlvbnMuZmlsdGVyKChyKSA9PiByLmdhcFZhbHVlID4gMCk7XG4gIGNvbnN0IHNlbGxTdWdnZXN0aW9ucyA9IHJlYmFsYW5jZVN1Z2dlc3Rpb25zLmZpbHRlcigocikgPT4gci5nYXBWYWx1ZSA8IDApO1xuXG4gIGNvbnN0IGludmVzdG1lbnRSb3dzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3Qgc29ydGVkID0gWy4uLmludmVzdG1lbnRzXS5zb3J0KChhLCBiKSA9PiBhLmRhdGUubG9jYWxlQ29tcGFyZShiLmRhdGUpKTtcbiAgICBsZXQgcnVubmluZyA9IDA7XG4gICAgcmV0dXJuIHNvcnRlZC5tYXAoKGVudHJ5KSA9PiB7XG4gICAgICBydW5uaW5nICs9IGVudHJ5LmFtb3VudDtcbiAgICAgIGNvbnN0IHRvdGFsID0gcnVubmluZztcbiAgICAgIGNvbnN0IHBubFZhbHVlID0gZW50cnkudmFsdWVFb20gLSB0b3RhbDtcbiAgICAgIGNvbnN0IHBubFBjdCA9IHRvdGFsID4gMCA/IChwbmxWYWx1ZSAvIHRvdGFsKSAqIDEwMCA6IDA7XG4gICAgICByZXR1cm4geyAuLi5lbnRyeSwgdG90YWwsIHBubFZhbHVlLCBwbmxQY3QgfTtcbiAgICB9KTtcbiAgfSwgW2ludmVzdG1lbnRzXSk7XG5cbiAgY29uc3QgaW52ZXN0bWVudFN1bW1hcnkgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBsYXN0ID0gaW52ZXN0bWVudFJvd3NbaW52ZXN0bWVudFJvd3MubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdG90YWxJbnZlc3RlZCA9IGxhc3Q/LnRvdGFsID8/IDA7XG4gICAgY29uc3QgbGF0ZXN0VmFsdWUgPSBsYXN0Py52YWx1ZUVvbSA/PyAwO1xuICAgIGNvbnN0IHBubFZhbHVlID0gbGF0ZXN0VmFsdWUgLSB0b3RhbEludmVzdGVkO1xuICAgIGNvbnN0IHBubFBjdCA9IHRvdGFsSW52ZXN0ZWQgPiAwID8gKHBubFZhbHVlIC8gdG90YWxJbnZlc3RlZCkgKiAxMDAgOiAwO1xuXG4gICAgbGV0IHhpcnJQY3QgPSAwO1xuICAgIGlmIChpbnZlc3RtZW50Um93cy5sZW5ndGggPj0gMiAmJiBsYXRlc3RWYWx1ZSA+IDApIHtcbiAgICAgIGNvbnN0IGZsb3dzID0gaW52ZXN0bWVudFJvd3NcbiAgICAgICAgLmZpbHRlcigocm93KSA9PiByb3cuYW1vdW50ICE9PSAwKVxuICAgICAgICAubWFwKChyb3cpID0+ICh7XG4gICAgICAgICAgZGF0ZTogbmV3IERhdGUocm93LmRhdGUpLFxuICAgICAgICAgIGFtb3VudDogLXJvdy5hbW91bnQsXG4gICAgICAgIH0pKTtcbiAgICAgIGNvbnN0IHRlcm1pbmFsRGF0ZSA9IG5ldyBEYXRlKGxhc3QhLmRhdGUpO1xuICAgICAgZmxvd3MucHVzaCh7IGRhdGU6IHRlcm1pbmFsRGF0ZSwgYW1vdW50OiBsYXRlc3RWYWx1ZSB9KTtcbiAgICAgIGNvbnN0IHJhdGUgPSB4aXJyKGZsb3dzLCAwLjEpO1xuICAgICAgeGlyclBjdCA9IE51bWJlci5pc0Zpbml0ZShyYXRlKSA/IHJhdGUgKiAxMDAgOiAwO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB0b3RhbEludmVzdGVkLFxuICAgICAgbGF0ZXN0VmFsdWUsXG4gICAgICBwbmxWYWx1ZSxcbiAgICAgIHBubFBjdCxcbiAgICAgIHhpcnJQY3QsXG4gICAgICBjb3VudDogaW52ZXN0bWVudFJvd3MubGVuZ3RoLFxuICAgIH07XG4gIH0sIFtpbnZlc3RtZW50Um93c10pO1xuXG4gIGNvbnN0IHNvcnRlZEhvbGRpbmdzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgcSA9IGhvbGRpbmdzU2VhcmNoLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGZpbHRlcmVkID0gcVxuICAgICAgPyBwb3J0Zm9saW8uaG9sZGluZ3MuZmlsdGVyKFxuICAgICAgICAgIChoKSA9PlxuICAgICAgICAgICAgaC50aWNrZXIudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgICAgICAgaC5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcbiAgICAgICAgICAgIGguc2VjdG9yLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSksXG4gICAgICAgIClcbiAgICAgIDogWy4uLnBvcnRmb2xpby5ob2xkaW5nc107XG5cbiAgICBjb25zdCB7IGtleSwgZGlyIH0gPSBob2xkaW5nc1NvcnQ7XG4gICAgaWYgKCFrZXkpIHJldHVybiBmaWx0ZXJlZDtcblxuICAgIGNvbnN0IG11bHQgPSBkaXIgPT09IFwiYXNjXCIgPyAxIDogLTE7XG4gICAgY29uc3QgdmFsdWVPZiA9IChoOiB0eXBlb2YgZmlsdGVyZWRbbnVtYmVyXSk6IHN0cmluZyB8IG51bWJlciA9PiB7XG4gICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICBjYXNlIFwidGlja2VyXCI6IHJldHVybiBoLnRpY2tlcjtcbiAgICAgICAgY2FzZSBcIm5hbWVcIjogcmV0dXJuIGgubmFtZTtcbiAgICAgICAgY2FzZSBcInNlY3RvclwiOiByZXR1cm4gaC5zZWN0b3I7XG4gICAgICAgIGNhc2UgXCJzaGFyZXNcIjogcmV0dXJuIGguc2hhcmVzO1xuICAgICAgICBjYXNlIFwiY29zdEJhc2lzXCI6IHJldHVybiBoLmNvc3RCYXNpcztcbiAgICAgICAgY2FzZSBcInByaWNlXCI6IHJldHVybiBoLnByaWNlO1xuICAgICAgICBjYXNlIFwiZGF5Q2hhbmdlUGN0XCI6IHJldHVybiBoLmRheUNoYW5nZVBjdDtcbiAgICAgICAgY2FzZSBcImRpdllpZWxkXCI6IHJldHVybiBoLmNvc3RCYXNpcyA+IDAgPyAoaC5kaXZpZGVuZFBlclNoYXJlIC8gaC5jb3N0QmFzaXMpICogMTAwIDogMDtcbiAgICAgICAgY2FzZSBcIm1hcmtldFZhbHVlXCI6IHJldHVybiBoLm1hcmtldFZhbHVlO1xuICAgICAgICBjYXNlIFwid2VpZ2h0XCI6IHJldHVybiBoLndlaWdodDtcbiAgICAgICAgY2FzZSBcInBubFRvZGF5XCI6IHJldHVybiBoLm1hcmtldFZhbHVlICogaC5kYXlDaGFuZ2VQY3QgLyAoMTAwICsgaC5kYXlDaGFuZ2VQY3QgfHwgMSk7XG4gICAgICAgIGNhc2UgXCJnYWluTG9zc1wiOiByZXR1cm4gaC5nYWluTG9zcztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZmlsdGVyZWQuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgYUNhc2ggPSBhLmlkLnN0YXJ0c1dpdGgoXCJjYXNoLVwiKTtcbiAgICAgIGNvbnN0IGJDYXNoID0gYi5pZC5zdGFydHNXaXRoKFwiY2FzaC1cIik7XG4gICAgICBpZiAoYUNhc2ggJiYgIWJDYXNoKSByZXR1cm4gMTtcbiAgICAgIGlmICghYUNhc2ggJiYgYkNhc2gpIHJldHVybiAtMTtcbiAgICAgIGNvbnN0IHZhID0gdmFsdWVPZihhKTtcbiAgICAgIGNvbnN0IHZiID0gdmFsdWVPZihiKTtcbiAgICAgIGlmICh0eXBlb2YgdmEgPT09IFwic3RyaW5nXCIgJiYgdHlwZW9mIHZiID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJldHVybiB2YS5sb2NhbGVDb21wYXJlKHZiKSAqIG11bHQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gKCh2YSBhcyBudW1iZXIpIC0gKHZiIGFzIG51bWJlcikpICogbXVsdDtcbiAgICB9KTtcblxuICAgIHJldHVybiBmaWx0ZXJlZDtcbiAgfSwgW3BvcnRmb2xpby5ob2xkaW5ncywgaG9sZGluZ3NTZWFyY2gsIGhvbGRpbmdzU29ydF0pO1xuXG4gIGZ1bmN0aW9uIHRvZ2dsZVNvcnQoa2V5OiBIb2xkaW5nc1NvcnRLZXkpIHtcbiAgICBzZXRIb2xkaW5nc1NvcnQoKGN1cikgPT4ge1xuICAgICAgaWYgKGN1ci5rZXkgIT09IGtleSkgcmV0dXJuIHsga2V5LCBkaXI6IFwiZGVzY1wiIH07XG4gICAgICBpZiAoY3VyLmRpciA9PT0gXCJkZXNjXCIpIHJldHVybiB7IGtleSwgZGlyOiBcImFzY1wiIH07XG4gICAgICByZXR1cm4geyBrZXk6IG51bGwsIGRpcjogXCJkZXNjXCIgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRyZWVtYXBJdGVtcyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICh0cmVlbWFwTW9kZSA9PT0gXCJzZWN0b3JcIikge1xuICAgICAgcmV0dXJuIHNlY3RvcnMubWFwKChzZWN0b3IpID0+ICh7XG4gICAgICAgIGtleTogc2VjdG9yLnNlY3RvcixcbiAgICAgICAgbGFiZWw6IHNlY3Rvci5zZWN0b3IsXG4gICAgICAgIHZhbHVlOiBzZWN0b3IudmFsdWUsXG4gICAgICAgIHdlaWdodDogc2VjdG9yLndlaWdodCxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcG9ydGZvbGlvLmhvbGRpbmdzLnNsaWNlKDAsIDEyKS5tYXAoKGhvbGRpbmcpID0+ICh7XG4gICAgICBrZXk6IGhvbGRpbmcuaWQsXG4gICAgICBsYWJlbDogaG9sZGluZy50aWNrZXIsXG4gICAgICB2YWx1ZTogaG9sZGluZy5tYXJrZXRWYWx1ZSxcbiAgICAgIHdlaWdodDogaG9sZGluZy53ZWlnaHQsXG4gICAgfSkpO1xuICB9LCBbdHJlZW1hcE1vZGUsIHNlY3RvcnMsIHBvcnRmb2xpby5ob2xkaW5nc10pO1xuXG4gIGNvbnN0IHdhdGVyZmFsbFJvd3MgPSBbLi4ubm9uQ2FzaFBvcnRmb2xpb11cbiAgICAuc29ydCgobGVmdCwgcmlnaHQpID0+IE1hdGguYWJzKHJpZ2h0LmdhaW5Mb3NzKSAtIE1hdGguYWJzKGxlZnQuZ2Fpbkxvc3MpKVxuICAgIC5zbGljZSgwLCAxMCk7XG5cbiAgY29uc3QgbWF4V2F0ZXJmYWxsID1cbiAgICB3YXRlcmZhbGxSb3dzLmxlbmd0aCA+IDBcbiAgICAgID8gTWF0aC5tYXgoLi4ud2F0ZXJmYWxsUm93cy5tYXAoKGhvbGRpbmcpID0+IE1hdGguYWJzKGhvbGRpbmcuZ2Fpbkxvc3MpKSlcbiAgICAgIDogMTtcblxuICBjb25zdCB0b3BNb3ZlcnMgPSBbLi4ubm9uQ2FzaFBvcnRmb2xpb11cbiAgICAuc29ydCgobGVmdCwgcmlnaHQpID0+IHJpZ2h0LmRheUNoYW5nZVBjdCAtIGxlZnQuZGF5Q2hhbmdlUGN0KVxuICAgIC5zbGljZSgwLCA2KTtcblxuICBhc3luYyBmdW5jdGlvbiBoYW5kbGVJbXBvcnQoZmlsZTogRmlsZSkge1xuICAgIGNvbnN0IHRleHQgPSBhd2FpdCBmaWxlLnRleHQoKTtcbiAgICBjb25zdCBpbXBvcnRlZCA9IHBhcnNlSG9sZGluZ3NDc3YodGV4dCkubWFwKG5vcm1hbGl6ZUhvbGRpbmcpO1xuXG4gICAgaWYgKGltcG9ydGVkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNldEhvbGRpbmdzKGltcG9ydGVkKTtcbiAgICBzZXREcmFmdChlbXB0eURyYWZ0KTtcbiAgICBzZXREcmFmdEVycm9yKFwiXCIpO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkTWFudWFsSG9sZGluZyhldmVudDogUmVhY3QuRm9ybUV2ZW50PEhUTUxGb3JtRWxlbWVudD4pIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgY29uc3QgdGlja2VyID0gZHJhZnQudGlja2VyLnRyaW0oKTtcbiAgICBjb25zdCBuYW1lID0gZHJhZnQubmFtZS50cmltKCk7XG5cbiAgICBpZiAoIXRpY2tlciB8fCAhbmFtZSkge1xuICAgICAgc2V0RHJhZnRFcnJvcihcIlRpY2tlciBhbmQgbmFtZSBhcmUgcmVxdWlyZWQuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChkcmFmdC5zaGFyZXMgPD0gMCB8fCBkcmFmdC5wcmljZSA8IDAgfHwgZHJhZnQuY29zdEJhc2lzIDwgMCkge1xuICAgICAgc2V0RHJhZnRFcnJvcihcbiAgICAgICAgXCJTaGFyZXMgbXVzdCBiZSBwb3NpdGl2ZSwgYW5kIGF2Zy9jdXJyZW50IHByaWNlIGNhbm5vdCBiZSBuZWdhdGl2ZS5cIixcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaG9sZGluZzogSG9sZGluZyA9IHtcbiAgICAgIGlkOiBjcmVhdGVJZCgpLFxuICAgICAgdGlja2VyOiB0aWNrZXIudG9VcHBlckNhc2UoKSxcbiAgICAgIG5hbWUsXG4gICAgICBzZWN0b3I6IGRyYWZ0LnNlY3Rvci50cmltKCkgfHwgXCJVbmNhdGVnb3JpemVkXCIsXG4gICAgICBhY2NvdW50OiBcIlBTWFwiLFxuICAgICAgc2hhcmVzOiBkcmFmdC5zaGFyZXMsXG4gICAgICBwcmljZTogZHJhZnQucHJpY2UsXG4gICAgICBjb3N0QmFzaXM6IGRyYWZ0LmNvc3RCYXNpcyxcbiAgICAgIGRheUNoYW5nZVBjdDogZHJhZnQuZGF5Q2hhbmdlUGN0LFxuICAgICAgZGl2aWRlbmRQZXJTaGFyZTogZHJhZnQuZGl2aWRlbmRQZXJTaGFyZSxcbiAgICAgIHBheW91dERhdGU6IGRyYWZ0LnBheW91dERhdGUsXG4gICAgfTtcblxuICAgIHNldEhvbGRpbmdzKChjdXJyZW50KSA9PiBbaG9sZGluZywgLi4uY3VycmVudF0pO1xuICAgIHNldERyYWZ0KGVtcHR5RHJhZnQpO1xuICAgIHNldERyYWZ0RXJyb3IoXCJcIik7XG4gIH1cblxuICBmdW5jdGlvbiBzYXZlQ2FzaEJ1Y2tldHMoZXZlbnQ6IFJlYWN0LkZvcm1FdmVudDxIVE1MRm9ybUVsZW1lbnQ+KSB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIGlmIChjYXNoRHJhZnQuYXZhaWxhYmxlIDwgMCkge1xuICAgICAgc2V0Q2FzaEVycm9yKFwiQ2FzaCB2YWx1ZSBjYW5ub3QgYmUgbmVnYXRpdmUuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNldENhc2hFcnJvcihcIlwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRhcmdldEFsbG9jYXRpb24oZXZlbnQ6IFJlYWN0LkZvcm1FdmVudDxIVE1MRm9ybUVsZW1lbnQ+KSB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIGNvbnN0IGtleSA9IHRhcmdldERyYWZ0LmtleS50cmltKCk7XG4gICAgaWYgKCFrZXkpIHtcbiAgICAgIHNldFRhcmdldEVycm9yKFwiVGFyZ2V0IGtleSBpcyByZXF1aXJlZC5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldERyYWZ0LnRhcmdldFdlaWdodFBjdCA8PSAwIHx8IHRhcmdldERyYWZ0LnRhcmdldFdlaWdodFBjdCA+IDEwMCkge1xuICAgICAgc2V0VGFyZ2V0RXJyb3IoXCJUYXJnZXQgd2VpZ2h0IG11c3QgYmUgYmV0d2VlbiAwIGFuZCAxMDAuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRLZXkgPVxuICAgICAgdGFyZ2V0RHJhZnQubW9kZSA9PT0gXCJ0aWNrZXJcIiA/IGtleS50b1VwcGVyQ2FzZSgpIDoga2V5O1xuXG4gICAgc2V0VGFyZ2V0cygoY3VycmVudCkgPT4gW1xuICAgICAge1xuICAgICAgICBpZDogY3JlYXRlSWQoKSxcbiAgICAgICAgbW9kZTogdGFyZ2V0RHJhZnQubW9kZSxcbiAgICAgICAga2V5OiBub3JtYWxpemVkS2V5LFxuICAgICAgICB0YXJnZXRXZWlnaHQ6IHRhcmdldERyYWZ0LnRhcmdldFdlaWdodFBjdCAvIDEwMCxcbiAgICAgIH0sXG4gICAgICAuLi5jdXJyZW50LFxuICAgIF0pO1xuXG4gICAgc2V0VGFyZ2V0RHJhZnQoZW1wdHlUYXJnZXREcmFmdCk7XG4gICAgc2V0VGFyZ2V0RXJyb3IoXCJcIik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVUYXJnZXQoaWQ6IHN0cmluZykge1xuICAgIHNldFRhcmdldHMoKGN1cnJlbnQpID0+IGN1cnJlbnQuZmlsdGVyKCh0YXJnZXQpID0+IHRhcmdldC5pZCAhPT0gaWQpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZEludmVzdG1lbnQoZXZlbnQ6IFJlYWN0LkZvcm1FdmVudDxIVE1MRm9ybUVsZW1lbnQ+KSB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIGlmICghaW52ZXN0RHJhZnQuZGF0ZSkge1xuICAgICAgc2V0SW52ZXN0RXJyb3IoXCJEYXRlIHJlcXVpcmVkLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhbW91bnQgPSBOdW1iZXIoaW52ZXN0RHJhZnQuYW1vdW50KTtcbiAgICBjb25zdCB2YWx1ZUVvbSA9IE51bWJlcihpbnZlc3REcmFmdC52YWx1ZUVvbSk7XG5cbiAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShhbW91bnQpKSB7XG4gICAgICBzZXRJbnZlc3RFcnJvcihcIkFtb3VudCBtdXN0IGJlIGEgbnVtYmVyLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIU51bWJlci5pc0Zpbml0ZSh2YWx1ZUVvbSkgfHwgdmFsdWVFb20gPCAwKSB7XG4gICAgICBzZXRJbnZlc3RFcnJvcihcIlZhbHVlIEVPTSBtdXN0IGJlIGEgbm9uLW5lZ2F0aXZlIG51bWJlci5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2V0SW52ZXN0bWVudHMoKGN1cnJlbnQpID0+IFtcbiAgICAgIC4uLmN1cnJlbnQsXG4gICAgICB7XG4gICAgICAgIGlkOiBjcmVhdGVJZCgpLFxuICAgICAgICBkYXRlOiBpbnZlc3REcmFmdC5kYXRlLFxuICAgICAgICBsYWJlbDogaW52ZXN0RHJhZnQubGFiZWwudHJpbSgpIHx8IGBNb250aCAke2N1cnJlbnQubGVuZ3RofWAsXG4gICAgICAgIGFtb3VudCxcbiAgICAgICAgdmFsdWVFb20sXG4gICAgICB9LFxuICAgIF0pO1xuICAgIHNldEludmVzdERyYWZ0KGVtcHR5SW52ZXN0bWVudERyYWZ0KTtcbiAgICBzZXRJbnZlc3RFcnJvcihcIlwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUludmVzdG1lbnQoaWQ6IHN0cmluZykge1xuICAgIHNldEludmVzdG1lbnRzKChjdXJyZW50KSA9PiBjdXJyZW50LmZpbHRlcigoZW50cnkpID0+IGVudHJ5LmlkICE9PSBpZCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSG9sZGluZyhpZDogc3RyaW5nKSB7XG4gICAgc2V0SG9sZGluZ3MoKGN1cnJlbnQpID0+IGN1cnJlbnQuZmlsdGVyKChob2xkaW5nKSA9PiBob2xkaW5nLmlkICE9PSBpZCkpO1xuICB9XG5cblxuICBhc3luYyBmdW5jdGlvbiByZWZyZXNoUHJpY2VzKCkge1xuICAgIGNvbnN0IG5vbkNhc2ggPSBob2xkaW5ncy5maWx0ZXIoKGgpID0+ICFoLmlkLnN0YXJ0c1dpdGgoXCJjYXNoLVwiKSk7XG4gICAgaWYgKG5vbkNhc2gubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2V0RmV0Y2hpbmcodHJ1ZSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgW3F1b3RlcywgZGl2aWRlbmRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgZmV0Y2hNYXJrZXREYXRhKCksXG4gICAgICAgIGZldGNoRGl2aWRlbmRzKG5vbkNhc2gubWFwKChoKSA9PiBoLnRpY2tlcikpLFxuICAgICAgXSk7XG4gICAgICBjb25zdCB7IGhvbGRpbmdzOiB1cGRhdGVkIH0gPSBhcHBseU1hcmtldERhdGEoaG9sZGluZ3MsIHF1b3RlcywgZGl2aWRlbmRzKTtcbiAgICAgIHNldEhvbGRpbmdzKHVwZGF0ZWQpO1xuICAgICAgc2V0TGFzdEZldGNoZWRBdChuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpO1xuXG4gICAgICBjb25zdCBlcXVpdHlPbmx5ID0gdXBkYXRlZC5maWx0ZXIoKGgpID0+ICFpc0Nhc2hIb2xkaW5nKGgpKTtcbiAgICAgIGNvbnN0IHNuYXBzaG90ID0gY29tcHV0ZVBvcnRmb2xpbyhlcXVpdHlPbmx5KTtcbiAgICAgIGNvbnN0IHsgaXNXZWVrZGF5LCBhZnRlckNsb3NlLCBwa0RhdGUgfSA9IHBzeENsb3NlU3RhdHVzKCk7XG4gICAgICBpZiAoaXNXZWVrZGF5ICYmIGFmdGVyQ2xvc2UpIHtcbiAgICAgICAgc2V0SGlzdG9yeSgoY3VyKSA9PiB7XG4gICAgICAgICAgaWYgKGN1ci5zb21lKChzKSA9PiBwa0RhdGVPZihzLmRhdGUpID09PSBwa0RhdGUpKSByZXR1cm4gY3VyO1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBbXG4gICAgICAgICAgICAuLi5jdXIsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgdG90YWxWYWx1ZTogc25hcHNob3QudG90YWxWYWx1ZSxcbiAgICAgICAgICAgICAgdG90YWxDb3N0OiBzbmFwc2hvdC50b3RhbENvc3QsXG4gICAgICAgICAgICAgIGdhaW5Mb3NzOiBzbmFwc2hvdC50b3RhbEdhaW5Mb3NzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdO1xuICAgICAgICAgIHJldHVybiBuZXh0LnNsaWNlKC0zNjUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIGlnbm9yZVxuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRGZXRjaGluZyhmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZXhwb3J0UG9ydGZvbGlvKCkge1xuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICBob2xkaW5ncyxcbiAgICAgIGNhc2g6IGNhc2hEcmFmdCxcbiAgICAgIHRhcmdldHMsXG4gICAgICBpbnZlc3RtZW50cyxcbiAgICAgIGhpc3RvcnksXG4gICAgICBleHBvcnRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfTtcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW0pTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpXSwgeyB0eXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9KTtcbiAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcbiAgICBhLmhyZWYgPSB1cmw7XG4gICAgYS5kb3dubG9hZCA9IGBwc3gtcG9ydGZvbGlvLSR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKX0uanNvbmA7XG4gICAgYS5jbGljaygpO1xuICAgIFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGltcG9ydFBvcnRmb2xpbyhmaWxlOiBGaWxlKSB7XG4gICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdGV4dCA9IFN0cmluZyhyZWFkZXIucmVzdWx0KTtcbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgIGlmICghY29uZmlybShcIlJlcGxhY2UgY3VycmVudCBkYXRhIHdpdGggaW1wb3J0ZWQgZmlsZT8gVGhpcyBjYW5ub3QgYmUgdW5kb25lLlwiKSkgcmV0dXJuO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmhvbGRpbmdzKSkgc2V0SG9sZGluZ3MoZGF0YS5ob2xkaW5ncyk7XG4gICAgICAgIGlmIChkYXRhLmNhc2ggJiYgdHlwZW9mIGRhdGEuY2FzaCA9PT0gXCJvYmplY3RcIikgc2V0Q2FzaERyYWZ0KGRhdGEuY2FzaCk7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEudGFyZ2V0cykpIHNldFRhcmdldHMoZGF0YS50YXJnZXRzKTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YS5pbnZlc3RtZW50cykpIHNldEludmVzdG1lbnRzKGRhdGEuaW52ZXN0bWVudHMpO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmhpc3RvcnkpKSBzZXRIaXN0b3J5KGRhdGEuaGlzdG9yeSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgYWxlcnQoYEltcG9ydCBmYWlsZWQ6ICR7ZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFwiSW52YWxpZCBmaWxlXCJ9YCk7XG4gICAgICB9XG4gICAgfTtcbiAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPG1haW4gY2xhc3NOYW1lPVwiYXBwLXNoZWxsXCI+XG4gICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJoZXJvLWJhclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImhlcm8tdGl0bGVcIj5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJleWVicm93XCI+UFNYIHBvcnRmb2xpbyB0b29sczwvcD5cbiAgICAgICAgICA8aDE+UG9ydGZvbGlvIGNvbW1hbmQgY2VudGVyPC9oMT5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaGVyby1hY3Rpb25zXCI+XG4gICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJ1dHRvblwiIGh0bWxGb3I9XCJpbXBvcnQtZmlsZVwiPlxuICAgICAgICAgICAgSW1wb3J0IENTVlxuICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICBpZD1cImltcG9ydC1maWxlXCJcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInNyLW9ubHlcIlxuICAgICAgICAgICAgdHlwZT1cImZpbGVcIlxuICAgICAgICAgICAgYWNjZXB0PVwiLmNzdix0ZXh0L2NzdlwiXG4gICAgICAgICAgICBvbkNoYW5nZT17KGV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBldmVudC50YXJnZXQuZmlsZXM/LlswXTtcbiAgICAgICAgICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgICAgICAgICB2b2lkIGhhbmRsZUltcG9ydChmaWxlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiYnV0dG9uIGJ1dHRvbi1wcmltYXJ5XCJcbiAgICAgICAgICAgIG9uQ2xpY2s9e3JlZnJlc2hQcmljZXN9XG4gICAgICAgICAgICBkaXNhYmxlZD17ZmV0Y2hpbmcgfHwgaG9sZGluZ3MubGVuZ3RoID09PSAwfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtmZXRjaGluZyA/IFwiRmV0Y2hpbmcuLi5cIiA6IFwiUmVmcmVzaCBwcmljZXNcIn1cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJidXR0b25cIiBvbkNsaWNrPXtleHBvcnRQb3J0Zm9saW99PlxuICAgICAgICAgICAgRXhwb3J0XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJ1dHRvblwiIGh0bWxGb3I9XCJpbXBvcnQtcG9ydGZvbGlvLWZpbGVcIj5cbiAgICAgICAgICAgIEltcG9ydFxuICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICBpZD1cImltcG9ydC1wb3J0Zm9saW8tZmlsZVwiXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJzci1vbmx5XCJcbiAgICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICAgIGFjY2VwdD1cIi5qc29uLGFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICAgICAgb25DaGFuZ2U9eyhldmVudCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBmaWxlID0gZXZlbnQudGFyZ2V0LmZpbGVzPy5bMF07XG4gICAgICAgICAgICAgIGlmIChmaWxlKSBpbXBvcnRQb3J0Zm9saW8oZmlsZSk7XG4gICAgICAgICAgICAgIGV2ZW50LnRhcmdldC52YWx1ZSA9IFwiXCI7XG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9zZWN0aW9uPlxuXG4gICAgICA8bmF2IGNsYXNzTmFtZT1cInBhZ2UtbmF2XCI+XG4gICAgICAgIHsoW1xuICAgICAgICAgIFtcIm92ZXJ2aWV3XCIsIFwiT3ZlcnZpZXdcIl0sXG4gICAgICAgICAgW1wiaG9sZGluZ3NcIiwgXCJIb2xkaW5nc1wiXSxcbiAgICAgICAgICBbXCJ0YXJnZXRzXCIsIFwiVGFyZ2V0c1wiXSxcbiAgICAgICAgICBbXCJpbmNvbWVcIiwgXCJJbmNvbWVcIl0sXG4gICAgICAgICAgW1wiaW52ZXN0XCIsIFwiSW52ZXN0XCJdLFxuICAgICAgICBdIGFzIGNvbnN0KS5tYXAoKFtrZXksIGxhYmVsXSkgPT4gKFxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIGtleT17a2V5fVxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzc05hbWU9e2BwYWdlLW5hdi10YWIgJHtwYWdlID09PSBrZXkgPyBcInBhZ2UtbmF2LXRhYi0tYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRQYWdlKGtleSl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAge2xhYmVsfVxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICApKX1cbiAgICAgIDwvbmF2PlxuXG4gICAgICB7cGFnZSA9PT0gXCJob2xkaW5nc1wiICYmIChcbiAgICAgICAgPHNlY3Rpb24gY2xhc3NOYW1lPVwicXVpY2stYWRkLWNhcmQgcGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBhbmVsLWhlYWRlciBjb21wYWN0XCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5RdWljayBhZGQ8L3A+XG4gICAgICAgICAgICAgIDxoMj5NYW51YWwgaG9sZGluZzwvaDI+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInBhbmVsLW1ldGFcIj5ObyBDU1YgcmVxdWlyZWQ8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8Zm9ybSBvblN1Ym1pdD17YWRkTWFudWFsSG9sZGluZ30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvcm0tZ3JpZFwiPlxuICAgICAgICAgICAgICA8U3RvY2tTZWFyY2hcbiAgICAgICAgICAgICAgICBvblNlbGVjdD17KHN0b2NrKSA9PlxuICAgICAgICAgICAgICAgICAgc2V0RHJhZnQoKGN1cnJlbnQpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICAgICAgICAgIHRpY2tlcjogc3RvY2sudGlja2VyLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBzdG9jay5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBzZWN0b3I6IHN0b2NrLnNlY3RvcixcbiAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzZWxlY3RlZD17ZHJhZnQudGlja2VyID8gYCR7ZHJhZnQudGlja2VyfSDigJQgJHtkcmFmdC5uYW1lfWAgOiBcIlwifVxuICAgICAgICAgICAgICAgIG9uQ2xlYXI9eygpID0+XG4gICAgICAgICAgICAgICAgICBzZXREcmFmdCgoY3VycmVudCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICAgICAgdGlja2VyOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICBzZWN0b3I6IFwiVW5jYXRlZ29yaXplZFwiLFxuICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8RmllbGRcbiAgICAgICAgICAgICAgICBsYWJlbD1cIlNoYXJlc1wiXG4gICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXG4gICAgICAgICAgICAgICAgbWluPXswfVxuICAgICAgICAgICAgICAgIHN0ZXA9XCIxXCJcbiAgICAgICAgICAgICAgICB2YWx1ZT17U3RyaW5nKGRyYWZ0LnNoYXJlcyl9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9eyh2YWx1ZSkgPT5cbiAgICAgICAgICAgICAgICAgIHNldERyYWZ0KChjdXJyZW50KSA9PiAoeyAuLi5jdXJyZW50LCBzaGFyZXM6IE51bWJlcih2YWx1ZSkgfSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8RmllbGRcbiAgICAgICAgICAgICAgICBsYWJlbD1cIkF2ZyBwcmljZVwiXG4gICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXG4gICAgICAgICAgICAgICAgbWluPXswfVxuICAgICAgICAgICAgICAgIHN0ZXA9XCIwLjAxXCJcbiAgICAgICAgICAgICAgICB2YWx1ZT17U3RyaW5nKGRyYWZ0LmNvc3RCYXNpcyl9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9eyh2YWx1ZSkgPT5cbiAgICAgICAgICAgICAgICAgIHNldERyYWZ0KChjdXJyZW50KSA9PiAoeyAuLi5jdXJyZW50LCBjb3N0QmFzaXM6IE51bWJlcih2YWx1ZSkgfSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIHtkcmFmdEVycm9yID8gPHAgY2xhc3NOYW1lPVwiZm9ybS1lcnJvclwiPntkcmFmdEVycm9yfTwvcD4gOiBudWxsfVxuXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvcm0tYWN0aW9uc1wiPlxuICAgICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJzdWJtaXRcIiBjbGFzc05hbWU9XCJidXR0b24gYnV0dG9uLXByaW1hcnlcIj5cbiAgICAgICAgICAgICAgICBBZGQgcmVjb3JkXG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9mb3JtPlxuICAgICAgICA8L3NlY3Rpb24+XG4gICAgICApfVxuXG4gICAgICB7cGFnZSA9PT0gXCJvdmVydmlld1wiICYmICg8PlxuICAgICAgPHNlY3Rpb24gY2xhc3NOYW1lPVwic3RhdHMtZ3JpZFwiPlxuICAgICAgICA8U3RhdENhcmRcbiAgICAgICAgICBsYWJlbD1cIlRvdGFsIHZhbHVlXCJcbiAgICAgICAgICB2YWx1ZT17Zm9ybWF0Q3VycmVuY3kocG9ydGZvbGlvLnRvdGFsVmFsdWUpfVxuICAgICAgICAgIGRldGFpbD17YCR7cG9ydGZvbGlvLmhvbGRpbmdzLmxlbmd0aH0gcG9zaXRpb25zYH1cbiAgICAgICAgLz5cbiAgICAgICAgPFN0YXRDYXJkXG4gICAgICAgICAgbGFiZWw9XCJUb3RhbCBhdmcgY29zdFwiXG4gICAgICAgICAgdmFsdWU9e2Zvcm1hdEN1cnJlbmN5KHBvcnRmb2xpby50b3RhbENvc3QpfVxuICAgICAgICAgIGRldGFpbD1cIkNvc3QgYmFzaXMgb2YgYWxsIHBvc2l0aW9uc1wiXG4gICAgICAgIC8+XG4gICAgICAgIDxTdGF0Q2FyZFxuICAgICAgICAgIGxhYmVsPVwiVW5yZWFsaXplZCBQL0xcIlxuICAgICAgICAgIHZhbHVlPXtmb3JtYXRDdXJyZW5jeShwb3J0Zm9saW8udG90YWxHYWluTG9zcyl9XG4gICAgICAgICAgZGV0YWlsPXtcbiAgICAgICAgICAgIHBvcnRmb2xpby50b3RhbEdhaW5Mb3NzID49IDAgPyBcIlBvc2l0aXZlIGRyaWZ0XCIgOiBcIkRvd25zaWRlIHJpc2tcIlxuICAgICAgICAgIH1cbiAgICAgICAgICB0b25lPXtwb3J0Zm9saW8udG90YWxHYWluTG9zcyA+PSAwID8gXCJwb3NpdGl2ZVwiIDogXCJuZWdhdGl2ZVwifVxuICAgICAgICAvPlxuICAgICAgICA8U3RhdENhcmRcbiAgICAgICAgICBsYWJlbD1cIlRvcCBwb3NpdGlvblwiXG4gICAgICAgICAgdmFsdWU9e1xuICAgICAgICAgICAgdG9wSG9sZGluZ1xuICAgICAgICAgICAgICA/IGAke3RvcEhvbGRpbmcudGlja2VyfSAke2Zvcm1hdFBlcmNlbnQodG9wSG9sZGluZy53ZWlnaHQpfWBcbiAgICAgICAgICAgICAgOiBcIk5vbmVcIlxuICAgICAgICAgIH1cbiAgICAgICAgICBkZXRhaWw9e3RvcEhvbGRpbmcgPyB0b3BIb2xkaW5nLm5hbWUgOiBcIkltcG9ydCBob2xkaW5ncyB0byBiZWdpblwifVxuICAgICAgICAvPlxuICAgICAgPC9zZWN0aW9uPlxuXG4gICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJzdGF0cy1ncmlkIHNlY29uZGFyeVwiPlxuICAgICAgICA8U3RhdENhcmRcbiAgICAgICAgICBsYWJlbD1cIkNhc2hcIlxuICAgICAgICAgIHZhbHVlPXtmb3JtYXRDdXJyZW5jeShjYXNoRHJhZnQuYXZhaWxhYmxlKX1cbiAgICAgICAgICBkZXRhaWw9e2Ake2Zvcm1hdFBlcmNlbnQoY2FzaFdlaWdodCl9IG9mIHBvcnRmb2xpb2B9XG4gICAgICAgIC8+XG4gICAgICAgIDxTdGF0Q2FyZFxuICAgICAgICAgIGxhYmVsPVwiWWllbGQgb24gY29zdFwiXG4gICAgICAgICAgdmFsdWU9e2Zvcm1hdFBlcmNlbnQoeWllbGRPbkNvc3QpfVxuICAgICAgICAgIGRldGFpbD17YFRUTSBkaXZpZGVuZHMgJHtmb3JtYXRDb21wYWN0Q3VycmVuY3koYW5udWFsaXplZERpdmlkZW5kSW5jb21lKX0gLyBlcXVpdHkgY29zdGB9XG4gICAgICAgIC8+XG4gICAgICA8L3NlY3Rpb24+XG5cbiAgICAgIDxzZWN0aW9uIGNsYXNzTmFtZT1cInBhbmVsXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInBhbmVsLWtpY2tlclwiPkhpc3Rvcnk8L3A+XG4gICAgICAgICAgICA8aDI+UG9ydGZvbGlvIHZhbHVlIG92ZXIgdGltZTwvaDI+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYW5lbC1tZXRhLXJvd1wiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicGFuZWwtbWV0YVwiPntoaXN0b3J5Lmxlbmd0aH0gc25hcHNob3R7aGlzdG9yeS5sZW5ndGggPT09IDEgPyBcIlwiIDogXCJzXCJ9IMK3IDEvZGF5IGFmdGVyIFBTWCBjbG9zZSAoMTU6MzAgUEtUKTwvc3Bhbj5cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJ1dHRvbiBidXR0b24tZ2hvc3RcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGhpc3RvcnkubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgICAgICAgICAgICAgaWYgKCFjb25maXJtKGBDbGVhciBhbGwgJHtoaXN0b3J5Lmxlbmd0aH0gY2hhcnQgc25hcHNob3Qocyk/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS5gKSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIHNldEhpc3RvcnkoW10pO1xuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBkaXNhYmxlZD17aGlzdG9yeS5sZW5ndGggPT09IDB9XG4gICAgICAgICAgICAgIHRpdGxlPVwiVGVtcDogd2lwZSBwb3J0Zm9saW8gY2hhcnQgaGlzdG9yeVwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIENsZWFyIGhpc3RvcnlcbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPFBvcnRmb2xpb0hpc3RvcnlDaGFydCBzbmFwc2hvdHM9e2hpc3Rvcnl9IGxhc3RGZXRjaGVkSXNvPXtsYXN0RmV0Y2hlZEF0fSAvPlxuICAgICAgPC9zZWN0aW9uPlxuXG4gICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJkYXNoYm9hcmQtZ3JpZCBkdWFsXCI+XG4gICAgICAgIDxhcnRpY2xlIGNsYXNzTmFtZT1cInBhbmVsIGNoYXJ0LXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYW5lbC1oZWFkZXJcIj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInBhbmVsLWtpY2tlclwiPkFsbG9jYXRpb248L3A+XG4gICAgICAgICAgICAgIDxoMj5Qb3J0Zm9saW8gd2VpZ2h0YWdlPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicGFuZWwtbWV0YVwiPlxuICAgICAgICAgICAgICB7bGFzdEZldGNoZWRBdFxuICAgICAgICAgICAgICAgID8gYFVwZGF0ZWQgJHtmb3JtYXRSZWxhdGl2ZVRpbWUobGFzdEZldGNoZWRBdCl9YFxuICAgICAgICAgICAgICAgIDogXCJJbnRlcmFjdGl2ZSBkb251dFwifVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIHtmZXRjaGluZyA/IDxkaXYgY2xhc3NOYW1lPVwiY2hhcnQtc2tlbGV0b25cIiBhcmlhLWhpZGRlbj1cInRydWVcIiAvPiA6IG51bGx9XG4gICAgICAgICAgPFBpZUNoYXJ0IGhvbGRpbmdzPXtwb3J0Zm9saW8uaG9sZGluZ3N9IC8+XG4gICAgICAgIDwvYXJ0aWNsZT5cblxuICAgICAgICA8YXJ0aWNsZSBjbGFzc05hbWU9XCJwYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5cbiAgICAgICAgICAgICAgICB7YWxsb2NhdGlvblZpZXcgPT09IFwibWFwXCIgPyBcIlRyZWVtYXBcIiA6IFwiUmFua2VkXCJ9XG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPGgyPkNvbmNlbnRyYXRpb24ge2FsbG9jYXRpb25WaWV3ID09PSBcIm1hcFwiID8gXCJtYXBcIiA6IFwibGVhZGVyYm9hcmRcIn08L2gyPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFsbG9jYXRpb24tdG9nZ2xlc1wiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRvZ2dsZS1yb3dcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGNoaXAgJHt0cmVlbWFwTW9kZSA9PT0gXCJzZWN0b3JcIiA/IFwiYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRUcmVlbWFwTW9kZShcInNlY3RvclwiKX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBTZWN0b3JcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGNoaXAgJHt0cmVlbWFwTW9kZSA9PT0gXCJ0aWNrZXJcIiA/IFwiYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRUcmVlbWFwTW9kZShcInRpY2tlclwiKX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBUaWNrZXJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidG9nZ2xlLXJvd1wiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgY2hpcCAke2FsbG9jYXRpb25WaWV3ID09PSBcIm1hcFwiID8gXCJhY3RpdmVcIiA6IFwiXCJ9YH1cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFsbG9jYXRpb25WaWV3KFwibWFwXCIpfVxuICAgICAgICAgICAgICAgICAgdGl0bGU9XCJTcXVhcmlmaWVkIHRyZWVtYXBcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIE1hcFxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgY2hpcCAke2FsbG9jYXRpb25WaWV3ID09PSBcInJhbmtlZFwiID8gXCJhY3RpdmVcIiA6IFwiXCJ9YH1cbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFsbG9jYXRpb25WaWV3KFwicmFua2VkXCIpfVxuICAgICAgICAgICAgICAgICAgdGl0bGU9XCJTb3J0ZWQgaG9yaXpvbnRhbCBiYXJzXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBSYW5rZWRcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICB7YWxsb2NhdGlvblZpZXcgPT09IFwibWFwXCIgPyAoXG4gICAgICAgICAgICA8VHJlZW1hcCBpdGVtcz17dHJlZW1hcEl0ZW1zfSAvPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8UmFua2VkQWxsb2NhdGlvbiBpdGVtcz17dHJlZW1hcEl0ZW1zfSAvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvYXJ0aWNsZT5cbiAgICAgIDwvc2VjdGlvbj5cbiAgICAgIDwvPil9XG5cbiAgICAgIHtwYWdlID09PSBcInRhcmdldHNcIiAmJiAoXG4gICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJpbnNpZ2h0LWdyaWQgdGFyZ2V0cy1ncmlkXCI+XG4gICAgICAgIDxhcnRpY2xlIGNsYXNzTmFtZT1cInBhbmVsIHRhcmdldC1wYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5UYXJnZXRzPC9wPlxuICAgICAgICAgICAgICA8aDI+QWxsb2NhdGlvbiBkcmlmdCBhbGVydHM8L2gyPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8Zm9ybSBjbGFzc05hbWU9XCJ0YXJnZXQtZm9ybVwiIG9uU3VibWl0PXthZGRUYXJnZXRBbGxvY2F0aW9ufT5cbiAgICAgICAgICAgIDxzZWxlY3RcbiAgICAgICAgICAgICAgdmFsdWU9e3RhcmdldERyYWZ0Lm1vZGV9XG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+XG4gICAgICAgICAgICAgICAgc2V0VGFyZ2V0RHJhZnQoKGN1cnJlbnQpID0+ICh7XG4gICAgICAgICAgICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICAgICAgICAgICAgbW9kZTogZXZlbnQudGFyZ2V0LnZhbHVlIGFzIFwic2VjdG9yXCIgfCBcInRpY2tlclwiLFxuICAgICAgICAgICAgICAgICAga2V5OiBcIlwiLFxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJzZWN0b3JcIj5TZWN0b3I8L29wdGlvbj5cbiAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cInRpY2tlclwiPlRpY2tlcjwvb3B0aW9uPlxuICAgICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgICAgICA8Q29tYm9ib3hcbiAgICAgICAgICAgICAgdmFsdWU9e3RhcmdldERyYWZ0LmtleX1cbiAgICAgICAgICAgICAgb25DaGFuZ2U9eyh2YWwpID0+XG4gICAgICAgICAgICAgICAgc2V0VGFyZ2V0RHJhZnQoKGN1cnJlbnQpID0+ICh7IC4uLmN1cnJlbnQsIGtleTogdmFsIH0pKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIG9wdGlvbnM9e1xuICAgICAgICAgICAgICAgIHRhcmdldERyYWZ0Lm1vZGUgPT09IFwic2VjdG9yXCJcbiAgICAgICAgICAgICAgICAgID8gc2VjdG9ycy5tYXAoKHMpID0+IHMuc2VjdG9yKVxuICAgICAgICAgICAgICAgICAgOiBwb3J0Zm9saW8uaG9sZGluZ3MubWFwKChoKSA9PiBoLnRpY2tlcilcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17dGFyZ2V0RHJhZnQubW9kZSA9PT0gXCJzZWN0b3JcIiA/IFwiU2VhcmNoIHNlY3Rvci4uLlwiIDogXCJTZWFyY2ggdGlja2VyLi4uXCJ9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxuICAgICAgICAgICAgICBtaW49ezB9XG4gICAgICAgICAgICAgIG1heD17MTAwfVxuICAgICAgICAgICAgICBzdGVwPVwiMC4xXCJcbiAgICAgICAgICAgICAgdmFsdWU9e3RhcmdldERyYWZ0LnRhcmdldFdlaWdodFBjdH1cbiAgICAgICAgICAgICAgb25DaGFuZ2U9eyhldmVudCkgPT5cbiAgICAgICAgICAgICAgICBzZXRUYXJnZXREcmFmdCgoY3VycmVudCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICAgICAgICB0YXJnZXRXZWlnaHRQY3Q6IE51bWJlcihldmVudC50YXJnZXQudmFsdWUpLFxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiV2VpZ2h0ICVcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDxidXR0b24gdHlwZT1cInN1Ym1pdFwiIGNsYXNzTmFtZT1cImJ1dHRvblwiPlxuICAgICAgICAgICAgICBBZGRcbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvZm9ybT5cblxuICAgICAgICAgIHt0YXJnZXRFcnJvciA/IDxwIGNsYXNzTmFtZT1cImZvcm0tZXJyb3JcIj57dGFyZ2V0RXJyb3J9PC9wPiA6IG51bGx9XG5cbiAgICAgICAgICB7dGFyZ2V0Um93cy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZHJpZnQtc3VtbWFyeVwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZHJpZnQtc3RhdCBkcmlmdC1zdGF0LS1vdmVyXCI+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1zdGF0LW51bVwiPntkcmlmdFN1bW1hcnkub3Zlcn08L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1zdGF0LWxhYmVsXCI+T3Zlcjwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRyaWZ0LXN0YXQgZHJpZnQtc3RhdC0tdW5kZXJcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRyaWZ0LXN0YXQtbnVtXCI+e2RyaWZ0U3VtbWFyeS51bmRlcn08L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1zdGF0LWxhYmVsXCI+VW5kZXI8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJkcmlmdC1zdGF0IGRyaWZ0LXN0YXQtLW9udHJhY2tcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRyaWZ0LXN0YXQtbnVtXCI+e2RyaWZ0U3VtbWFyeS5vblRyYWNrfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRyaWZ0LXN0YXQtbGFiZWxcIj5PbiB0cmFjazwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRyaWZ0LXN0YXRcIj5cbiAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRyaWZ0LXN0YXQtbnVtXCI+e2Zvcm1hdFBlcmNlbnQoZHJpZnRTdW1tYXJ5LnRvdGFsRGV2aWF0aW9uKX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1zdGF0LWxhYmVsXCI+VG90YWwgZHJpZnQ8L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZHJpZnQtY29udHJvbHNcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNoaXAtZ3JvdXBcIj5cbiAgICAgICAgICAgICAgICAgIHsoW1wiYWxsXCIsIFwib3ZlclwiLCBcInVuZGVyXCIsIFwib250cmFja1wiXSBhcyBjb25zdCkubWFwKChzKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e3N9XG4gICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgY2hpcCAke3RhcmdldFN0YXR1c0ZpbHRlciA9PT0gcyA/IFwiY2hpcC0tYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0VGFyZ2V0U3RhdHVzRmlsdGVyKHMpfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge3MgPT09IFwiYWxsXCIgPyBcIkFsbFwiIDogcyA9PT0gXCJvdmVyXCIgPyBcIk92ZXJcIiA6IHMgPT09IFwidW5kZXJcIiA/IFwiVW5kZXJcIiA6IFwiT24gdHJhY2tcIn1cbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJkcmlmdC1zb3J0XCJcbiAgICAgICAgICAgICAgICAgIHZhbHVlPXt0YXJnZXRTb3J0fVxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRUYXJnZXRTb3J0KGUudGFyZ2V0LnZhbHVlIGFzIHR5cGVvZiB0YXJnZXRTb3J0KX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiZHJpZnRcIj5Tb3J0OiBEcmlmdDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIm5hbWVcIj5Tb3J0OiBOYW1lPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwid2VpZ2h0XCI+U29ydDogV2VpZ2h0PC9vcHRpb24+XG4gICAgICAgICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgICAgICAgICAge3RhcmdldFJvd3MubGVuZ3RoID4gMyAmJiAoXG4gICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGFyZ2V0LWZpbHRlclwiXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXt0YXJnZXRGaWx0ZXJ9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0VGFyZ2V0RmlsdGVyKGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2guLi5cIlxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvPlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRhcmdldC1saXN0XCI+XG4gICAgICAgICAgICB7dGFyZ2V0Um93cy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cIm11dGVkLW5vdGVcIj5ObyB0YXJnZXRzIHlldC4gQWRkIHNlY3RvciBvciB0aWNrZXIgdGFyZ2V0cy48L3A+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICB0YXJnZXRSb3dzXG4gICAgICAgICAgICAgIC5maWx0ZXIoKHJvdykgPT4gIXRhcmdldEZpbHRlciB8fCByb3cua2V5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModGFyZ2V0RmlsdGVyLnRvTG93ZXJDYXNlKCkpKVxuICAgICAgICAgICAgICAuZmlsdGVyKChyb3cpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U3RhdHVzRmlsdGVyID09PSBcImFsbFwiKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U3RhdHVzRmlsdGVyID09PSBcIm92ZXJcIikgcmV0dXJuIHJvdy5kcmlmdCA+IDAuMDA1O1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRTdGF0dXNGaWx0ZXIgPT09IFwidW5kZXJcIikgcmV0dXJuIHJvdy5kcmlmdCA8IC0wLjAwNTtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5hYnMocm93LmRyaWZ0KSA8PSAwLjAwNTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U29ydCA9PT0gXCJkcmlmdFwiKSByZXR1cm4gYi5hYnNEcmlmdCAtIGEuYWJzRHJpZnQ7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFNvcnQgPT09IFwibmFtZVwiKSByZXR1cm4gYS5rZXkubG9jYWxlQ29tcGFyZShiLmtleSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGIudGFyZ2V0V2VpZ2h0IC0gYS50YXJnZXRXZWlnaHQ7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5tYXAoKHJvdykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gTWF0aC5tYXgocm93LmN1cnJlbnRXZWlnaHQsIHJvdy50YXJnZXRXZWlnaHQsIDAuMDEpICogMS4xO1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRQY3QgPSAocm93LmN1cnJlbnRXZWlnaHQgLyBzY2FsZSkgKiAxMDA7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGN0ID0gKHJvdy50YXJnZXRXZWlnaHQgLyBzY2FsZSkgKiAxMDA7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtyb3cuaWR9IGNsYXNzTmFtZT17YGRyaWZ0LWNhcmQgZHJpZnQtY2FyZC0tJHtyb3cuc3RhdHVzfWB9PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRyaWZ0LXJvdy10b3BcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRyaWZ0LWtleVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHN0cm9uZz57cm93LmtleX08L3N0cm9uZz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRyaWZ0LWJhZGdlXCI+e3Jvdy5tb2RlfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRyaWZ0LXBlcmNlbnRhZ2VzXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1jdXJyZW50LW51bVwiPntmb3JtYXRQZXJjZW50KHJvdy5jdXJyZW50V2VpZ2h0KX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1hcnJvd1wiPuKGkjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRyaWZ0LXRhcmdldC1udW1cIj57Zm9ybWF0UGVyY2VudChyb3cudGFyZ2V0V2VpZ2h0KX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJkcmlmdC1yZW1vdmVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcmVtb3ZlVGFyZ2V0KHJvdy5pZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiUmVtb3ZlIHRhcmdldFwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgw5dcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZHJpZnQtdHJhY2stY29tYmluZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BkcmlmdC1maWxsLWN1cnJlbnQgJHtyb3cuZHJpZnQgPj0gMCA/IFwiZHJpZnQtZmlsbC0tb3ZlclwiIDogXCJkcmlmdC1maWxsLS11bmRlclwifWB9XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogYCR7Y3VycmVudFBjdH0lYCB9fVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZHJpZnQtdGFyZ2V0LW1hcmtlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBsZWZ0OiBgJHt0YXJnZXRQY3R9JWAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPXtgVGFyZ2V0ICR7Zm9ybWF0UGVyY2VudChyb3cudGFyZ2V0V2VpZ2h0KX1gfVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRyaWZ0LXJvdy1ib3R0b21cIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9e2BkcmlmdC1hY3Rpb24tdGFnICR7cm93LmdhcFZhbHVlID4gMCA/IFwiYnV5XCIgOiBcInNlbGxcIn1gfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtyb3cuZ2FwVmFsdWUgPiAwID8gXCJCVVlcIiA6IFwiU0VMTFwifSB7Zm9ybWF0Q3VycmVuY3koTWF0aC5hYnMocm93LmdhcFZhbHVlKSl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT17YGRyaWZ0LWRlbHRhICR7cm93LmRyaWZ0ID49IDAgPyBcIm5lZ2F0aXZlXCIgOiBcInBvc2l0aXZlXCJ9YH0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7cm93LmRyaWZ0ID49IDAgPyBcIuKWslwiIDogXCLilrxcIn0ge2Zvcm1hdFBlcmNlbnQoTWF0aC5hYnMocm93LmRyaWZ0KSl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIHtyb3cubW9kZSA9PT0gXCJ0aWNrZXJcIiAmJiByb3cuc2hhcmVzID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkcmlmdC1zaGFyZXNcIj5+e3Jvdy5zaGFyZXMudG9GaXhlZCgwKX0gc2g8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9hcnRpY2xlPlxuXG4gICAgICAgIDxhcnRpY2xlIGNsYXNzTmFtZT1cInBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYW5lbC1oZWFkZXJcIj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInBhbmVsLWtpY2tlclwiPlJlYmFsYW5jZTwvcD5cbiAgICAgICAgICAgICAgPGgyPlN1Z2dlc3RlZCBhY3Rpb25zPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicGFuZWwtbWV0YVwiPntyZWJhbGFuY2VTdWdnZXN0aW9ucy5sZW5ndGh9IGFjdGlvbntyZWJhbGFuY2VTdWdnZXN0aW9ucy5sZW5ndGggPT09IDEgPyBcIlwiIDogXCJzXCJ9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cIm11dGVkLW5vdGVcIj57Y2FzaE1lc3NhZ2V9PC9wPlxuICAgICAgICAgIHtyZWJhbGFuY2VTdWdnZXN0aW9ucy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJtdXRlZC1ub3RlXCI+Tm8gbWFqb3IgZHJpZnQgZGV0ZWN0ZWQgZnJvbSBjdXJyZW50IHRhcmdldHMuPC9wPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFjdGlvbi1ncm91cHNcIj5cbiAgICAgICAgICAgICAge2J1eVN1Z2dlc3Rpb25zLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWN0aW9uLWdyb3VwXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFjdGlvbi1ncm91cC1oZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiYWN0aW9uLWdyb3VwLWxhYmVsIGJ1eVwiPkJVWTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiYWN0aW9uLWdyb3VwLXRvdGFsXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KGJ1eVN1Z2dlc3Rpb25zLnJlZHVjZSgocywgcikgPT4gcyArIE1hdGguYWJzKHIuZ2FwVmFsdWUpLCAwKSl9XG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAge2J1eVN1Z2dlc3Rpb25zLm1hcCgoaXRlbSkgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8QWN0aW9uUm93IGtleT17aXRlbS5pZH0gaXRlbT17aXRlbX0ga2luZD1cImJ1eVwiIHRvdGFsPXtwb3J0Zm9saW8udG90YWxWYWx1ZX0gLz5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7c2VsbFN1Z2dlc3Rpb25zLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWN0aW9uLWdyb3VwXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFjdGlvbi1ncm91cC1oZWFkZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiYWN0aW9uLWdyb3VwLWxhYmVsIHNlbGxcIj5TRUxMPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJhY3Rpb24tZ3JvdXAtdG90YWxcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0Q3VycmVuY3koc2VsbFN1Z2dlc3Rpb25zLnJlZHVjZSgocywgcikgPT4gcyArIE1hdGguYWJzKHIuZ2FwVmFsdWUpLCAwKSl9XG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAge3NlbGxTdWdnZXN0aW9ucy5tYXAoKGl0ZW0pID0+IChcbiAgICAgICAgICAgICAgICAgICAgPEFjdGlvblJvdyBrZXk9e2l0ZW0uaWR9IGl0ZW09e2l0ZW19IGtpbmQ9XCJzZWxsXCIgdG90YWw9e3BvcnRmb2xpby50b3RhbFZhbHVlfSAvPlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L2FydGljbGU+XG4gICAgICA8L3NlY3Rpb24+XG4gICAgICApfVxuXG4gICAgICB7cGFnZSA9PT0gXCJpbmNvbWVcIiAmJiAoXG4gICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJpbnNpZ2h0LWdyaWRcIj5cbiAgICAgICAgPGFydGljbGUgY2xhc3NOYW1lPVwicGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBhbmVsLWhlYWRlclwiPlxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwicGFuZWwta2lja2VyXCI+Q2FzaDwvcD5cbiAgICAgICAgICAgICAgPGgyPkF2YWlsYWJsZSBjYXNoPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicGFuZWwtbWV0YVwiPlJlZmxlY3RlZCBpbiBwb3J0Zm9saW88L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGZvcm0gY2xhc3NOYW1lPVwiY2FzaC1zZWN0aW9uXCIgb25TdWJtaXQ9e3NhdmVDYXNoQnVja2V0c30+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhc2gtZ3JpZFwiPlxuICAgICAgICAgICAgICA8RmllbGRcbiAgICAgICAgICAgICAgICBsYWJlbD1cIkNhc2ggYW1vdW50XCJcbiAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcbiAgICAgICAgICAgICAgICBtaW49ezB9XG4gICAgICAgICAgICAgICAgc3RlcD1cIjAuMDFcIlxuICAgICAgICAgICAgICAgIHZhbHVlPXtTdHJpbmcoY2FzaERyYWZ0LmF2YWlsYWJsZSl9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9eyh2YWx1ZSkgPT5cbiAgICAgICAgICAgICAgICAgIHNldENhc2hEcmFmdCh7IGF2YWlsYWJsZTogTnVtYmVyKHZhbHVlKSB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAge2Nhc2hFcnJvciA/IDxwIGNsYXNzTmFtZT1cImZvcm0tZXJyb3JcIj57Y2FzaEVycm9yfTwvcD4gOiBudWxsfVxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmb3JtLWFjdGlvbnNcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwic3VibWl0XCIgY2xhc3NOYW1lPVwiYnV0dG9uIGJ1dHRvbi1wcmltYXJ5XCI+XG4gICAgICAgICAgICAgICAgVXBkYXRlIGNhc2hcbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Zvcm0+XG4gICAgICAgIDwvYXJ0aWNsZT5cblxuICAgICAgICA8YXJ0aWNsZSBjbGFzc05hbWU9XCJwYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5EaXZpZGVuZHM8L3A+XG4gICAgICAgICAgICAgIDxoMj5JbmNvbWUgdHJhY2tpbmc8L2gyPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJwYW5lbC1tZXRhXCI+QXV0by1mZXRjaGVkIGZyb20gUFNYPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3VnZ2VzdGlvbi1saXN0XCI+XG4gICAgICAgICAgICB7dXBjb21pbmdEaXZpZGVuZHMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJtdXRlZC1ub3RlXCI+Q2xpY2sgUmVmcmVzaCBwcmljZXMgdG8gZmV0Y2ggZGl2aWRlbmQgZGF0YS48L3A+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICB1cGNvbWluZ0RpdmlkZW5kcy5tYXAoKGhvbGRpbmcpID0+IChcbiAgICAgICAgICAgICAgICA8ZGl2IGtleT17aG9sZGluZy5pZH0gY2xhc3NOYW1lPVwic3VnZ2VzdGlvbi1yb3dcIj5cbiAgICAgICAgICAgICAgICAgIDxzdHJvbmc+e2hvbGRpbmcudGlja2VyfTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgICAgPHNwYW4+RFBTOiB7Zm9ybWF0Q3VycmVuY3koaG9sZGluZy5kaXZpZGVuZFBlclNoYXJlKX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8c21hbGw+XG4gICAgICAgICAgICAgICAgICAgIEFubnVhbCBpbmNvbWUge2Zvcm1hdEN1cnJlbmN5KGhvbGRpbmcuc2hhcmVzICogaG9sZGluZy5kaXZpZGVuZFBlclNoYXJlKX1cbiAgICAgICAgICAgICAgICAgICAge2hvbGRpbmcucGF5b3V0RGF0ZSA/IGAgwrcgQm9vayBjbG9zdXJlICR7aG9sZGluZy5wYXlvdXREYXRlfWAgOiBcIlwifVxuICAgICAgICAgICAgICAgICAgPC9zbWFsbD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvYXJ0aWNsZT5cblxuICAgICAgICA8YXJ0aWNsZSBjbGFzc05hbWU9XCJwYW5lbCBpbnNpZ2h0LWdyaWQtc3BhblwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5DYWxlbmRhcjwvcD5cbiAgICAgICAgICAgICAgPGgyPkV4cGVjdGVkIGRpdmlkZW5kIHBheW1lbnRzPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicGFuZWwtbWV0YVwiPlxuICAgICAgICAgICAgICB7Zm9ybWF0Q29tcGFjdEN1cnJlbmN5KGRpdmlkZW5kQ2FsZW5kYXIudG90YWwpfSBvdmVyIG5leHQgMTIgbW9udGhzXG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPERpdmlkZW5kQ2FsZW5kYXJDaGFydCBjZWxscz17ZGl2aWRlbmRDYWxlbmRhci5jZWxsc30gLz5cbiAgICAgICAgPC9hcnRpY2xlPlxuICAgICAgPC9zZWN0aW9uPlxuICAgICAgKX1cblxuICAgICAge3BhZ2UgPT09IFwib3ZlcnZpZXdcIiAmJiAoXG4gICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJpbnNpZ2h0LWdyaWQgZHVhbFwiPlxuICAgICAgICA8YXJ0aWNsZSBjbGFzc05hbWU9XCJwYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5XYXRlcmZhbGw8L3A+XG4gICAgICAgICAgICAgIDxoMj5QL0wgY29udHJpYnV0aW9uPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicGFuZWwtbWV0YVwiPkJpZ2dlc3QgaW1wYWN0IHBvc2l0aW9uczwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIndhdGVyZmFsbC1saXN0IHdhdGVyZmFsbC1saXN0LS1jZW50ZXJlZFwiPlxuICAgICAgICAgICAge3dhdGVyZmFsbFJvd3MubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJtdXRlZC1ub3RlXCI+Tm8gcG9zaXRpb25zIHRvIGV2YWx1YXRlIHlldC48L3A+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICB3YXRlcmZhbGxSb3dzLm1hcCgoaG9sZGluZykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBjdCA9IChNYXRoLmFicyhob2xkaW5nLmdhaW5Mb3NzKSAvIG1heFdhdGVyZmFsbCkgKiA1MDtcbiAgICAgICAgICAgICAgICBjb25zdCBpc1BvcyA9IGhvbGRpbmcuZ2Fpbkxvc3MgPj0gMDtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250cmlidXRpb24gPVxuICAgICAgICAgICAgICAgICAgTWF0aC5hYnMocG9ydGZvbGlvLnRvdGFsR2Fpbkxvc3MpID4gMFxuICAgICAgICAgICAgICAgICAgICA/IChob2xkaW5nLmdhaW5Mb3NzIC8gTWF0aC5hYnMocG9ydGZvbGlvLnRvdGFsR2Fpbkxvc3MpKSAqIDEwMFxuICAgICAgICAgICAgICAgICAgICA6IDA7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAga2V5PXtob2xkaW5nLmlkfVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3YXRlcmZhbGwtcm93XCJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU9e2Ake2hvbGRpbmcudGlja2VyfTogJHtmb3JtYXRDdXJyZW5jeShob2xkaW5nLmdhaW5Mb3NzKX0gwrcgJHtmb3JtYXRTaWduZWRQZXJjZW50KGNvbnRyaWJ1dGlvbiwgMSl9IG9mIHRvdGFsIFAmTGB9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+e2hvbGRpbmcudGlja2VyfTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIndhdGVyZmFsbC10cmFjayB3YXRlcmZhbGwtdHJhY2stLWNlbnRlcmVkXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwid2F0ZXJmYWxsLXplcm9cIiAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B3YXRlcmZhbGwtYmFyIHdhdGVyZmFsbC1iYXItLWNlbnRlcmVkICR7aXNQb3MgPyBcInBvc2l0aXZlXCIgOiBcIm5lZ2F0aXZlXCJ9YH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNQb3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHsgbGVmdDogXCI1MCVcIiwgd2lkdGg6IGAke3BjdH0lYCB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiB7IHJpZ2h0OiBcIjUwJVwiLCB3aWR0aDogYCR7cGN0fSVgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2B3YXRlcmZhbGwtdmFsdWUgJHtpc1BvcyA/IFwicG9zaXRpdmVcIiA6IFwibmVnYXRpdmVcIn1gfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KGhvbGRpbmcuZ2Fpbkxvc3MpfVxuICAgICAgICAgICAgICAgICAgICAgIDxzbWFsbD57Zm9ybWF0U2lnbmVkUGVyY2VudChjb250cmlidXRpb24sIDEpfTwvc21hbGw+XG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2FydGljbGU+XG5cbiAgICAgICAgPGFydGljbGUgY2xhc3NOYW1lPVwicGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBhbmVsLWhlYWRlclwiPlxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwicGFuZWwta2lja2VyXCI+VG9wIG1vdmVyczwvcD5cbiAgICAgICAgICAgICAgPGgyPkRhaWx5IGNoYW5nZSB3YXRjaDwvaDI+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInBhbmVsLW1ldGFcIj5MaXZlIGZyb20gUFNYPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3VnZ2VzdGlvbi1saXN0XCI+XG4gICAgICAgICAgICB7dG9wTW92ZXJzLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwibXV0ZWQtbm90ZVwiPk5vIG1vdmVyIGRhdGEgeWV0LjwvcD5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIHRvcE1vdmVycy5tYXAoKGhvbGRpbmcpID0+IChcbiAgICAgICAgICAgICAgICA8ZGl2IGtleT17aG9sZGluZy5pZH0gY2xhc3NOYW1lPVwic3VnZ2VzdGlvbi1yb3dcIj5cbiAgICAgICAgICAgICAgICAgIDxzdHJvbmc+e2hvbGRpbmcudGlja2VyfTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtob2xkaW5nLmRheUNoYW5nZVBjdCA+PSAwID8gXCJwb3NpdGl2ZVwiIDogXCJuZWdhdGl2ZVwifT5cbiAgICAgICAgICAgICAgICAgICAge2hvbGRpbmcuZGF5Q2hhbmdlUGN0LnRvRml4ZWQoMil9JVxuICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgPHNtYWxsPntob2xkaW5nLm5hbWV9PC9zbWFsbD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKSlcbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvYXJ0aWNsZT5cbiAgICAgIDwvc2VjdGlvbj5cbiAgICAgICl9XG5cbiAgICAgIHtwYWdlID09PSBcImhvbGRpbmdzXCIgJiYgKFxuICAgICAgPHNlY3Rpb24gY2xhc3NOYW1lPVwicGFuZWwgdGFibGUtcGFuZWxcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYW5lbC1oZWFkZXJcIj5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwicGFuZWwta2lja2VyXCI+SG9sZGluZ3M8L3A+XG4gICAgICAgICAgICA8aDI+UG9ydGZvbGlvIGJyZWFrZG93bjwvaDI+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJob2xkaW5ncy1zZWFyY2hcIlxuICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZWFyY2ggdGlja2VyLCBuYW1lLCBzZWN0b3IuLi5cIlxuICAgICAgICAgICAgdmFsdWU9e2hvbGRpbmdzU2VhcmNofVxuICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRIb2xkaW5nc1NlYXJjaChlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0YWJsZS13cmFwXCI+XG4gICAgICAgICAgPHRhYmxlPlxuICAgICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPFNvcnRIZWFkZXIgbGFiZWw9XCJUaWNrZXJcIiBzb3J0S2V5PVwidGlja2VyXCIgc29ydD17aG9sZGluZ3NTb3J0fSBvbkNsaWNrPXt0b2dnbGVTb3J0fSAvPlxuICAgICAgICAgICAgICAgIDxTb3J0SGVhZGVyIGxhYmVsPVwiTmFtZVwiIHNvcnRLZXk9XCJuYW1lXCIgc29ydD17aG9sZGluZ3NTb3J0fSBvbkNsaWNrPXt0b2dnbGVTb3J0fSAvPlxuICAgICAgICAgICAgICAgIDxTb3J0SGVhZGVyIGxhYmVsPVwiU2VjdG9yXCIgc29ydEtleT1cInNlY3RvclwiIHNvcnQ9e2hvbGRpbmdzU29ydH0gb25DbGljaz17dG9nZ2xlU29ydH0gLz5cbiAgICAgICAgICAgICAgICA8U29ydEhlYWRlciBsYWJlbD1cIlNoYXJlc1wiIHNvcnRLZXk9XCJzaGFyZXNcIiBzb3J0PXtob2xkaW5nc1NvcnR9IG9uQ2xpY2s9e3RvZ2dsZVNvcnR9IGFsaWduPVwicmlnaHRcIiAvPlxuICAgICAgICAgICAgICAgIDxTb3J0SGVhZGVyIGxhYmVsPVwiQXZnIHByaWNlXCIgc29ydEtleT1cImNvc3RCYXNpc1wiIHNvcnQ9e2hvbGRpbmdzU29ydH0gb25DbGljaz17dG9nZ2xlU29ydH0gYWxpZ249XCJyaWdodFwiIC8+XG4gICAgICAgICAgICAgICAgPFNvcnRIZWFkZXIgbGFiZWw9XCJDdXJyZW50IHByaWNlXCIgc29ydEtleT1cInByaWNlXCIgc29ydD17aG9sZGluZ3NTb3J0fSBvbkNsaWNrPXt0b2dnbGVTb3J0fSBhbGlnbj1cInJpZ2h0XCIgLz5cbiAgICAgICAgICAgICAgICA8U29ydEhlYWRlciBsYWJlbD1cIkRheSAlXCIgc29ydEtleT1cImRheUNoYW5nZVBjdFwiIHNvcnQ9e2hvbGRpbmdzU29ydH0gb25DbGljaz17dG9nZ2xlU29ydH0gYWxpZ249XCJyaWdodFwiIC8+XG4gICAgICAgICAgICAgICAgPFNvcnRIZWFkZXIgbGFiZWw9XCJEaXYgeWllbGRcIiBzb3J0S2V5PVwiZGl2WWllbGRcIiBzb3J0PXtob2xkaW5nc1NvcnR9IG9uQ2xpY2s9e3RvZ2dsZVNvcnR9IGFsaWduPVwicmlnaHRcIiAvPlxuICAgICAgICAgICAgICAgIDxTb3J0SGVhZGVyIGxhYmVsPVwiTWFya2V0IHZhbHVlXCIgc29ydEtleT1cIm1hcmtldFZhbHVlXCIgc29ydD17aG9sZGluZ3NTb3J0fSBvbkNsaWNrPXt0b2dnbGVTb3J0fSBhbGlnbj1cInJpZ2h0XCIgLz5cbiAgICAgICAgICAgICAgICA8U29ydEhlYWRlciBsYWJlbD1cIldlaWdodFwiIHNvcnRLZXk9XCJ3ZWlnaHRcIiBzb3J0PXtob2xkaW5nc1NvcnR9IG9uQ2xpY2s9e3RvZ2dsZVNvcnR9IGFsaWduPVwicmlnaHRcIiAvPlxuICAgICAgICAgICAgICAgIDxTb3J0SGVhZGVyIGxhYmVsPVwiUCZMIHRvZGF5XCIgc29ydEtleT1cInBubFRvZGF5XCIgc29ydD17aG9sZGluZ3NTb3J0fSBvbkNsaWNrPXt0b2dnbGVTb3J0fSBhbGlnbj1cInJpZ2h0XCIgLz5cbiAgICAgICAgICAgICAgICA8U29ydEhlYWRlciBsYWJlbD1cIlAmTCB0b3RhbFwiIHNvcnRLZXk9XCJnYWluTG9zc1wiIHNvcnQ9e2hvbGRpbmdzU29ydH0gb25DbGljaz17dG9nZ2xlU29ydH0gYWxpZ249XCJyaWdodFwiIC8+XG4gICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInJpZ2h0XCI+QWN0aW9uPC90aD5cbiAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgIHtzb3J0ZWRIb2xkaW5ncy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgPHRkIGNvbFNwYW49ezE0fSBjbGFzc05hbWU9XCJlbXB0eS1zdGF0ZVwiPlxuICAgICAgICAgICAgICAgICAgICB7aG9sZGluZ3NTZWFyY2ggPyBcIk5vIG1hdGNoZXMuXCIgOiBcIkltcG9ydCBhIENTViBvciBsb2FkIHNhbXBsZSBkYXRhIHRvIHBvcHVsYXRlIHRoZSBkYXNoYm9hcmQuXCJ9XG4gICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgc29ydGVkSG9sZGluZ3MubWFwKChob2xkaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBzeW50aGV0aWNDYXNoID0gaG9sZGluZy5pZC5zdGFydHNXaXRoKFwiY2FzaC1cIik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtob2xkaW5nLmlkfT5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQ+e2hvbGRpbmcudGlja2VyfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkPntob2xkaW5nLm5hbWV9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQ+e2hvbGRpbmcuc2VjdG9yfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInJpZ2h0XCI+e2hvbGRpbmcuc2hhcmVzLnRvTG9jYWxlU3RyaW5nKCl9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicmlnaHRcIj57Zm9ybWF0Q3VycmVuY3koaG9sZGluZy5jb3N0QmFzaXMpfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInJpZ2h0XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0Q3VycmVuY3koaG9sZGluZy5wcmljZSl9XG4gICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPXtgcmlnaHQgJHtob2xkaW5nLmRheUNoYW5nZVBjdCA+PSAwID8gXCJwb3NpdGl2ZVwiIDogXCJuZWdhdGl2ZVwifWB9PlxuICAgICAgICAgICAgICAgICAgICAgICAge3N5bnRoZXRpY0Nhc2ggPyBcIi1cIiA6IGAke2hvbGRpbmcuZGF5Q2hhbmdlUGN0LnRvRml4ZWQoMil9JWB9XG4gICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicmlnaHRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtzeW50aGV0aWNDYXNoIHx8IGhvbGRpbmcuY29zdEJhc2lzIDw9IDAgfHwgaG9sZGluZy5kaXZpZGVuZFBlclNoYXJlIDw9IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIi1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICA6IGAkeygoaG9sZGluZy5kaXZpZGVuZFBlclNoYXJlIC8gaG9sZGluZy5jb3N0QmFzaXMpICogMTAwKS50b0ZpeGVkKDIpfSVgfVxuICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInJpZ2h0XCI+e2Zvcm1hdEN1cnJlbmN5KGhvbGRpbmcubWFya2V0VmFsdWUpfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInJpZ2h0XCI+e2Zvcm1hdFBlcmNlbnQoaG9sZGluZy53ZWlnaHQpfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT17YHJpZ2h0ICR7aG9sZGluZy5kYXlDaGFuZ2VQY3QgPj0gMCA/IFwicG9zaXRpdmVcIiA6IFwibmVnYXRpdmVcIn1gfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtzeW50aGV0aWNDYXNoID8gXCItXCIgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KGhvbGRpbmcubWFya2V0VmFsdWUgKiBob2xkaW5nLmRheUNoYW5nZVBjdCAvICgxMDAgKyBob2xkaW5nLmRheUNoYW5nZVBjdCkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxiciAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzbWFsbD57aG9sZGluZy5kYXlDaGFuZ2VQY3QgPj0gMCA/IFwiK1wiIDogXCJcIn17aG9sZGluZy5kYXlDaGFuZ2VQY3QudG9GaXhlZCgyKX0lPC9zbWFsbD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2ByaWdodCAke2hvbGRpbmcuZ2Fpbkxvc3MgPj0gMCA/IFwicG9zaXRpdmVcIiA6IFwibmVnYXRpdmVcIn1gfVxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtmb3JtYXRDdXJyZW5jeShob2xkaW5nLmdhaW5Mb3NzKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHshc3ludGhldGljQ2FzaCAmJiBob2xkaW5nLmNvc3RWYWx1ZSA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxiciAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzbWFsbD57aG9sZGluZy5nYWluTG9zcyA+PSAwID8gXCIrXCIgOiBcIlwifXsoKGhvbGRpbmcuZ2Fpbkxvc3MgLyBob2xkaW5nLmNvc3RWYWx1ZSkgKiAxMDApLnRvRml4ZWQoMil9JTwvc21hbGw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJyaWdodFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAge3N5bnRoZXRpY0Nhc2ggPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiLVwiXG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicmVtb3ZlLWJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcmVtb3ZlSG9sZGluZyhob2xkaW5nLmlkKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlbW92ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L3NlY3Rpb24+XG4gICAgICApfVxuXG4gICAgICB7cGFnZSA9PT0gXCJpbnZlc3RcIiAmJiAoXG4gICAgICA8PlxuICAgICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJpbnZlc3Qtc3VtbWFyeVwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaW52ZXN0LXN0YXRcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImludmVzdC1zdGF0LW51bVwiPntmb3JtYXRDdXJyZW5jeShpbnZlc3RtZW50U3VtbWFyeS50b3RhbEludmVzdGVkKX08L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJpbnZlc3Qtc3RhdC1sYWJlbFwiPlRvdGFsIGludmVzdGVkPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaW52ZXN0LXN0YXRcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImludmVzdC1zdGF0LW51bVwiPntmb3JtYXRDdXJyZW5jeShpbnZlc3RtZW50U3VtbWFyeS5sYXRlc3RWYWx1ZSl9PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW52ZXN0LXN0YXQtbGFiZWxcIj5MYXRlc3QgdmFsdWU8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpbnZlc3Qtc3RhdFwiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtgaW52ZXN0LXN0YXQtbnVtICR7aW52ZXN0bWVudFN1bW1hcnkucG5sVmFsdWUgPj0gMCA/IFwicG9zaXRpdmVcIiA6IFwibmVnYXRpdmVcIn1gfT5cbiAgICAgICAgICAgICAge2ludmVzdG1lbnRTdW1tYXJ5LnBubFZhbHVlID49IDAgPyBcIitcIiA6IFwiXCJ9e2Zvcm1hdEN1cnJlbmN5KGludmVzdG1lbnRTdW1tYXJ5LnBubFZhbHVlKX1cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImludmVzdC1zdGF0LWxhYmVsXCI+UCZhbXA7TDwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImludmVzdC1zdGF0XCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9e2BpbnZlc3Qtc3RhdC1udW0gJHtpbnZlc3RtZW50U3VtbWFyeS5wbmxQY3QgPj0gMCA/IFwicG9zaXRpdmVcIiA6IFwibmVnYXRpdmVcIn1gfT5cbiAgICAgICAgICAgICAge2ludmVzdG1lbnRTdW1tYXJ5LnBubFBjdCA+PSAwID8gXCIrXCIgOiBcIlwifXtpbnZlc3RtZW50U3VtbWFyeS5wbmxQY3QudG9GaXhlZCgyKX0lXG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJpbnZlc3Qtc3RhdC1sYWJlbFwiIHRpdGxlPVwiQ3VtdWxhdGl2ZSBQJkwgb3ZlciB0b3RhbCBkZXBsb3llZDsgaWdub3JlcyBkZXBvc2l0IHRpbWluZy5cIj5cbiAgICAgICAgICAgICAgQ3VtdWxhdGl2ZSAlXG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpbnZlc3Qtc3RhdFwiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtgaW52ZXN0LXN0YXQtbnVtICR7aW52ZXN0bWVudFN1bW1hcnkueGlyclBjdCA+PSAwID8gXCJwb3NpdGl2ZVwiIDogXCJuZWdhdGl2ZVwifWB9PlxuICAgICAgICAgICAgICB7aW52ZXN0bWVudFN1bW1hcnkuY291bnQgPj0gMlxuICAgICAgICAgICAgICAgID8gYCR7aW52ZXN0bWVudFN1bW1hcnkueGlyclBjdCA+PSAwID8gXCIrXCIgOiBcIlwifSR7aW52ZXN0bWVudFN1bW1hcnkueGlyclBjdC50b0ZpeGVkKDIpfSVgXG4gICAgICAgICAgICAgICAgOiBcIuKAlFwifVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW52ZXN0LXN0YXQtbGFiZWxcIiB0aXRsZT1cIk1vbmV5LXdlaWdodGVkIHJldHVybiAoWElSUik6IGFubnVhbGl6ZWQgcmF0ZSB0aGF0IGRpc2NvdW50cyBlYWNoIGNhc2hmbG93IHRvIHRvZGF5J3MgdmFsdWUuIEluZHVzdHJ5IHN0YW5kYXJkIGZvciBwZXJzb25hbCBpbnZlc3RpbmcgcGVyZm9ybWFuY2UuXCI+XG4gICAgICAgICAgICAgIEFubnVhbGl6ZWQgKFhJUlIpXG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvc2VjdGlvbj5cblxuICAgICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJwYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5JbnZlc3RtZW50IHRyYWNrZXI8L3A+XG4gICAgICAgICAgICAgIDxoMj5BZGQgaW5zdGFsbG1lbnQ8L2gyPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJwYW5lbC1tZXRhXCI+e2ludmVzdG1lbnRTdW1tYXJ5LmNvdW50fSBlbnRyaWVzPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxmb3JtIGNsYXNzTmFtZT1cImludmVzdC1mb3JtXCIgb25TdWJtaXQ9e2FkZEludmVzdG1lbnR9PlxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImZpZWxkXCI+XG4gICAgICAgICAgICAgIDxzcGFuPkRhdGU8L3NwYW4+XG4gICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgIHR5cGU9XCJkYXRlXCJcbiAgICAgICAgICAgICAgICB2YWx1ZT17aW52ZXN0RHJhZnQuZGF0ZX1cbiAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEludmVzdERyYWZ0KChjKSA9PiAoeyAuLi5jLCBkYXRlOiBlLnRhcmdldC52YWx1ZSB9KSl9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImZpZWxkXCI+XG4gICAgICAgICAgICAgIDxzcGFuPkxhYmVsPC9zcGFuPlxuICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJlLmcuIE1vbnRoIDFcIlxuICAgICAgICAgICAgICAgIHZhbHVlPXtpbnZlc3REcmFmdC5sYWJlbH1cbiAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEludmVzdERyYWZ0KChjKSA9PiAoeyAuLi5jLCBsYWJlbDogZS50YXJnZXQudmFsdWUgfSkpfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJmaWVsZFwiPlxuICAgICAgICAgICAgICA8c3Bhbj5BbW91bnQgKCsvLSk8L3NwYW4+XG4gICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxuICAgICAgICAgICAgICAgIHN0ZXA9XCIwLjAxXCJcbiAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjBcIlxuICAgICAgICAgICAgICAgIHZhbHVlPXtpbnZlc3REcmFmdC5hbW91bnQgPT09IDAgPyBcIlwiIDogaW52ZXN0RHJhZnQuYW1vdW50fVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0SW52ZXN0RHJhZnQoKGMpID0+ICh7IC4uLmMsIGFtb3VudDogTnVtYmVyKGUudGFyZ2V0LnZhbHVlKSB9KSl9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImZpZWxkXCI+XG4gICAgICAgICAgICAgIDxzcGFuPlxuICAgICAgICAgICAgICAgIFZhbHVlIEVPTVxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiaW52ZXN0LWZpbGwtY3VycmVudFwiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRJbnZlc3REcmFmdCgoYykgPT4gKHsgLi4uYywgdmFsdWVFb206IHBvcnRmb2xpby50b3RhbFZhbHVlIH0pKX1cbiAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRmlsbCB3aXRoIGN1cnJlbnQgcG9ydGZvbGlvIHRvdGFsIHZhbHVlXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICBVc2UgY3VycmVudFxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxuICAgICAgICAgICAgICAgIHN0ZXA9XCIwLjAxXCJcbiAgICAgICAgICAgICAgICBtaW49ezB9XG4gICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCIwXCJcbiAgICAgICAgICAgICAgICB2YWx1ZT17aW52ZXN0RHJhZnQudmFsdWVFb20gPT09IDAgPyBcIlwiIDogaW52ZXN0RHJhZnQudmFsdWVFb219XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRJbnZlc3REcmFmdCgoYykgPT4gKHsgLi4uYywgdmFsdWVFb206IE51bWJlcihlLnRhcmdldC52YWx1ZSkgfSkpfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgIDxidXR0b24gdHlwZT1cInN1Ym1pdFwiIGNsYXNzTmFtZT1cImJ1dHRvbiBidXR0b24tcHJpbWFyeSBpbnZlc3QtZm9ybS1hZGRcIj5BZGQ8L2J1dHRvbj5cbiAgICAgICAgICA8L2Zvcm0+XG4gICAgICAgICAge2ludmVzdEVycm9yID8gPHAgY2xhc3NOYW1lPVwiZm9ybS1lcnJvclwiPntpbnZlc3RFcnJvcn08L3A+IDogbnVsbH1cbiAgICAgICAgPC9zZWN0aW9uPlxuXG4gICAgICAgIDxzZWN0aW9uIGNsYXNzTmFtZT1cInBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYW5lbC1oZWFkZXJcIj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInBhbmVsLWtpY2tlclwiPkNoYXJ0PC9wPlxuICAgICAgICAgICAgICA8aDI+VG90YWwgJmFtcDsgVmFsdWUgRU9NPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxJbnZlc3RtZW50Q2hhcnQgcm93cz17aW52ZXN0bWVudFJvd3N9IC8+XG4gICAgICAgIDwvc2VjdGlvbj5cblxuICAgICAgICA8c2VjdGlvbiBjbGFzc05hbWU9XCJwYW5lbCB0YWJsZS1wYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicGFuZWwtaGVhZGVyXCI+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJwYW5lbC1raWNrZXJcIj5FbnRyaWVzPC9wPlxuICAgICAgICAgICAgICA8aDI+SW5zdGFsbG1lbnQgbGVkZ2VyPC9oMj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGFibGUtc2Nyb2xsXCI+XG4gICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwiaG9sZGluZ3MtdGFibGVcIj5cbiAgICAgICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgIDx0aD5EYXRlPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aD5MYWJlbDwvdGg+XG4gICAgICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicmlnaHRcIj5BbW91bnQ8L3RoPlxuICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInJpZ2h0XCI+VG90YWw8L3RoPlxuICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInJpZ2h0XCI+VmFsdWUgRU9NPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJyaWdodFwiPlAmYW1wO0w8L3RoPlxuICAgICAgICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT1cInJpZ2h0XCI+UCZhbXA7TCAlPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJyaWdodFwiPkFjdGlvbjwvdGg+XG4gICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgIHtpbnZlc3RtZW50Um93cy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgIDx0ZCBjb2xTcGFuPXs4fSBjbGFzc05hbWU9XCJlbXB0eS1zdGF0ZVwiPlxuICAgICAgICAgICAgICAgICAgICAgIE5vIGVudHJpZXMgeWV0LiBBZGQgYW4gaW5zdGFsbG1lbnQgYWJvdmUgdG8gc3RhcnQgdHJhY2tpbmcuXG4gICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICBpbnZlc3RtZW50Um93cy5tYXAoKHJvdykgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtyb3cuaWR9PlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZD57cm93LmRhdGV9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQ+e3Jvdy5sYWJlbH08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9e2ByaWdodCAke3Jvdy5hbW91bnQgPj0gMCA/IFwiXCIgOiBcIm5lZ2F0aXZlXCJ9YH0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0Q3VycmVuY3kocm93LmFtb3VudCl9XG4gICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicmlnaHRcIj57Zm9ybWF0Q3VycmVuY3kocm93LnRvdGFsKX08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJyaWdodFwiPntmb3JtYXRDdXJyZW5jeShyb3cudmFsdWVFb20pfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT17YHJpZ2h0ICR7cm93LnBubFZhbHVlID49IDAgPyBcInBvc2l0aXZlXCIgOiBcIm5lZ2F0aXZlXCJ9YH0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7cm93LnBubFZhbHVlID49IDAgPyBcIitcIiA6IFwiXCJ9e2Zvcm1hdEN1cnJlbmN5KHJvdy5wbmxWYWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPXtgcmlnaHQgJHtyb3cucG5sUGN0ID49IDAgPyBcInBvc2l0aXZlXCIgOiBcIm5lZ2F0aXZlXCJ9YH0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7cm93LnBubFBjdCA+PSAwID8gXCIrXCIgOiBcIlwifXtyb3cucG5sUGN0LnRvRml4ZWQoMil9JVxuICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInJpZ2h0XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyZW1vdmUtYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gcmVtb3ZlSW52ZXN0bWVudChyb3cuaWQpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBSZW1vdmVcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L3NlY3Rpb24+XG4gICAgICA8Lz5cbiAgICAgICl9XG4gICAgPC9tYWluPlxuICApO1xufVxuXG5mdW5jdGlvbiBGaWVsZCh7XG4gIGxhYmVsLFxuICB2YWx1ZSxcbiAgb25DaGFuZ2UsXG4gIHBsYWNlaG9sZGVyLFxuICB0eXBlID0gXCJ0ZXh0XCIsXG4gIG1pbixcbiAgbWF4LFxuICBzdGVwLFxufToge1xuICBsYWJlbDogc3RyaW5nO1xuICB2YWx1ZTogc3RyaW5nO1xuICBvbkNoYW5nZTogKHZhbHVlOiBzdHJpbmcpID0+IHZvaWQ7XG4gIHBsYWNlaG9sZGVyPzogc3RyaW5nO1xuICB0eXBlPzogc3RyaW5nO1xuICBtaW4/OiBudW1iZXI7XG4gIG1heD86IG51bWJlcjtcbiAgc3RlcD86IHN0cmluZztcbn0pIHtcbiAgcmV0dXJuIChcbiAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZmllbGRcIj5cbiAgICAgIDxzcGFuPntsYWJlbH08L3NwYW4+XG4gICAgICA8aW5wdXRcbiAgICAgICAgdHlwZT17dHlwZX1cbiAgICAgICAgbWluPXttaW59XG4gICAgICAgIG1heD17bWF4fVxuICAgICAgICBzdGVwPXtzdGVwfVxuICAgICAgICB2YWx1ZT17dmFsdWV9XG4gICAgICAgIHBsYWNlaG9sZGVyPXtwbGFjZWhvbGRlcn1cbiAgICAgICAgb25DaGFuZ2U9eyhldmVudCkgPT4gb25DaGFuZ2UoZXZlbnQudGFyZ2V0LnZhbHVlKX1cbiAgICAgIC8+XG4gICAgPC9sYWJlbD5cbiAgKTtcbn1cblxuZnVuY3Rpb24gbG9hZEhvbGRpbmdzKCk6IEhvbGRpbmdbXSB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgcmV0dXJuIHNhbXBsZUhvbGRpbmdzLm1hcChub3JtYWxpemVIb2xkaW5nKTtcbiAgfVxuXG4gIGNvbnN0IHJhdyA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgaWYgKCFyYXcpIHtcbiAgICByZXR1cm4gc2FtcGxlSG9sZGluZ3MubWFwKG5vcm1hbGl6ZUhvbGRpbmcpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJhdykgYXMgSG9sZGluZ1tdO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZClcbiAgICAgID8gcGFyc2VkLm1hcChub3JtYWxpemVIb2xkaW5nKVxuICAgICAgOiBzYW1wbGVIb2xkaW5ncy5tYXAobm9ybWFsaXplSG9sZGluZyk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBzYW1wbGVIb2xkaW5ncy5tYXAobm9ybWFsaXplSG9sZGluZyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbG9hZENhc2hCdWNrZXRzKCk6IENhc2hCdWNrZXRzIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gZW1wdHlDYXNoQnVja2V0cztcbiAgfVxuXG4gIGNvbnN0IHJhdyA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShjYXNoU3RvcmFnZUtleSk7XG4gIGlmICghcmF3KSB7XG4gICAgcmV0dXJuIGVtcHR5Q2FzaEJ1Y2tldHM7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3KSBhcyBQYXJ0aWFsPENhc2hCdWNrZXRzPjtcbiAgICByZXR1cm4ge1xuICAgICAgYXZhaWxhYmxlOiBOdW1iZXIocGFyc2VkLmF2YWlsYWJsZSA/PyAwKSxcbiAgICB9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZW1wdHlDYXNoQnVja2V0cztcbiAgfVxufVxuXG5mdW5jdGlvbiBsb2FkVGFyZ2V0cygpOiBUYXJnZXRBbGxvY2F0aW9uW10ge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IHJhdyA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0YXJnZXRTdG9yYWdlS2V5KTtcbiAgaWYgKCFyYXcpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3KSBhcyBUYXJnZXRBbGxvY2F0aW9uW107XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtdO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuZnVuY3Rpb24gbG9hZEludmVzdG1lbnRzKCk6IEludmVzdG1lbnRFbnRyeVtdIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCByYXcgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oaW52ZXN0U3RvcmFnZUtleSk7XG4gIGlmICghcmF3KSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHJhdykgYXMgSW52ZXN0bWVudEVudHJ5W107XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtdO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuZnVuY3Rpb24gbG9hZEhpc3RvcnkoKTogUG9ydGZvbGlvU25hcHNob3RbXSB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSBcInVuZGVmaW5lZFwiKSByZXR1cm4gW107XG4gIGNvbnN0IHJhdyA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShoaXN0b3J5U3RvcmFnZUtleSk7XG4gIGlmICghcmF3KSByZXR1cm4gW107XG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyYXcpIGFzIFBvcnRmb2xpb1NuYXBzaG90W107XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtdO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLy8gUFNYIHRyYWRpbmcgd2luZG93IGVuZHMgMTU6MzAgUEtUIE1vbuKAk1RodTsgRnJpIGxhZGRlciBlbmRzIDE2OjMwLiBVc2UgMTU6MzBcbi8vIHdlZWtkYXkgY3V0b2ZmIOKAlCBkYWlseSBzbmFwc2hvdCBvbmx5IHBlcnNpc3RzIG9uY2UgbWFya2V0IGhhcyBjbG9zZWQuXG5mdW5jdGlvbiBwa1BhcnRzKG5vdzogRGF0ZSkge1xuICBjb25zdCBmbXQgPSBuZXcgSW50bC5EYXRlVGltZUZvcm1hdChcImVuLUNBXCIsIHtcbiAgICB0aW1lWm9uZTogXCJBc2lhL0thcmFjaGlcIixcbiAgICB5ZWFyOiBcIm51bWVyaWNcIixcbiAgICBtb250aDogXCIyLWRpZ2l0XCIsXG4gICAgZGF5OiBcIjItZGlnaXRcIixcbiAgICBob3VyOiBcIjItZGlnaXRcIixcbiAgICBtaW51dGU6IFwiMi1kaWdpdFwiLFxuICAgIGhvdXIxMjogZmFsc2UsXG4gICAgd2Vla2RheTogXCJzaG9ydFwiLFxuICB9KTtcbiAgY29uc3QgcGFydHMgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgZm10LmZvcm1hdFRvUGFydHMobm93KS5tYXAoKHApID0+IFtwLnR5cGUsIHAudmFsdWVdKSxcbiAgKSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICByZXR1cm4ge1xuICAgIGRhdGU6IGAke3BhcnRzLnllYXJ9LSR7cGFydHMubW9udGh9LSR7cGFydHMuZGF5fWAsXG4gICAgaG91cjogTnVtYmVyKHBhcnRzLmhvdXIpLFxuICAgIG1pbnV0ZTogTnVtYmVyKHBhcnRzLm1pbnV0ZSksXG4gICAgd2Vla2RheTogcGFydHMud2Vla2RheSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcHN4Q2xvc2VTdGF0dXMobm93OiBEYXRlID0gbmV3IERhdGUoKSkge1xuICBjb25zdCBwID0gcGtQYXJ0cyhub3cpO1xuICBjb25zdCBpc1dlZWtkYXkgPSAhW1wiU2F0XCIsIFwiU3VuXCJdLmluY2x1ZGVzKHAud2Vla2RheSk7XG4gIGNvbnN0IGFmdGVyQ2xvc2UgPSBwLmhvdXIgPiAxNSB8fCAocC5ob3VyID09PSAxNSAmJiBwLm1pbnV0ZSA+PSAzMCk7XG4gIHJldHVybiB7IGlzV2Vla2RheSwgYWZ0ZXJDbG9zZSwgcGtEYXRlOiBwLmRhdGUgfTtcbn1cblxuZnVuY3Rpb24gcGtEYXRlT2YoaXNvOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBkID0gbmV3IERhdGUoaXNvKTtcbiAgaWYgKE51bWJlci5pc05hTihkLmdldFRpbWUoKSkpIHJldHVybiBpc28uc2xpY2UoMCwgMTApO1xuICByZXR1cm4gcGtQYXJ0cyhkKS5kYXRlO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVIb2xkaW5nKGhvbGRpbmc6IEhvbGRpbmcpOiBIb2xkaW5nIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5ob2xkaW5nLFxuICAgIGRheUNoYW5nZVBjdDogTnVtYmVyKGhvbGRpbmcuZGF5Q2hhbmdlUGN0ID8/IDApLFxuICAgIGRpdmlkZW5kUGVyU2hhcmU6IE51bWJlcihob2xkaW5nLmRpdmlkZW5kUGVyU2hhcmUgPz8gMCksXG4gICAgcGF5b3V0RGF0ZTogaG9sZGluZy5wYXlvdXREYXRlID8/IFwiXCIsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGlzQ2FzaEhvbGRpbmcoaDogSG9sZGluZyk6IGJvb2xlYW4ge1xuICBpZiAoaC5pZD8uc3RhcnRzV2l0aChcImNhc2gtXCIpKSByZXR1cm4gdHJ1ZTtcbiAgY29uc3QgdGlja2VyID0gKGgudGlja2VyID8/IFwiXCIpLnRyaW0oKS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBzZWN0b3IgPSAoaC5zZWN0b3IgPz8gXCJcIikudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiB0aWNrZXIgPT09IFwiQ0FTSFwiIHx8IHNlY3RvciA9PT0gXCJjYXNoXCI7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkSG9sZGluZ3NXaXRoQ2FzaChcbiAgaG9sZGluZ3M6IEhvbGRpbmdbXSxcbiAgY2FzaDogQ2FzaEJ1Y2tldHMsXG4pOiBIb2xkaW5nW10ge1xuICBjb25zdCBub25DYXNoID0gaG9sZGluZ3MuZmlsdGVyKChob2xkaW5nKSA9PiAhaG9sZGluZy5pZC5zdGFydHNXaXRoKFwiY2FzaC1cIikpO1xuXG4gIGlmIChjYXNoLmF2YWlsYWJsZSA8PSAwKSByZXR1cm4gbm9uQ2FzaDtcblxuICBjb25zdCBjYXNoUG9zaXRpb246IEhvbGRpbmcgPSB7XG4gICAgaWQ6IFwiY2FzaC1hdmFpbGFibGVcIixcbiAgICB0aWNrZXI6IFwiQ0FTSFwiLFxuICAgIG5hbWU6IFwiQXZhaWxhYmxlIENhc2hcIixcbiAgICBzZWN0b3I6IFwiQ2FzaFwiLFxuICAgIGFjY291bnQ6IFwiUFNYXCIsXG4gICAgc2hhcmVzOiAxLFxuICAgIHByaWNlOiBjYXNoLmF2YWlsYWJsZSxcbiAgICBjb3N0QmFzaXM6IGNhc2guYXZhaWxhYmxlLFxuICAgIGRheUNoYW5nZVBjdDogMCxcbiAgICBkaXZpZGVuZFBlclNoYXJlOiAwLFxuICAgIHBheW91dERhdGU6IFwiXCIsXG4gIH07XG5cbiAgcmV0dXJuIFtjYXNoUG9zaXRpb24sIC4uLm5vbkNhc2hdO1xufVxuXG5mdW5jdGlvbiBidWlsZFNlY3RvckJ1Y2tldHMoXG4gIGhvbGRpbmdzOiB7IHNlY3Rvcjogc3RyaW5nOyBtYXJrZXRWYWx1ZTogbnVtYmVyOyB3ZWlnaHQ6IG51bWJlciB9W10sXG4pOiBTZWN0b3JCdWNrZXRbXSB7XG4gIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBTZWN0b3JCdWNrZXQ+KCk7XG5cbiAgZm9yIChjb25zdCBob2xkaW5nIG9mIGhvbGRpbmdzKSB7XG4gICAgY29uc3QgY3VycmVudCA9IG1hcC5nZXQoaG9sZGluZy5zZWN0b3IpID8/IHtcbiAgICAgIHNlY3RvcjogaG9sZGluZy5zZWN0b3IsXG4gICAgICB2YWx1ZTogMCxcbiAgICAgIHdlaWdodDogMCxcbiAgICAgIGhvbGRpbmdzOiAwLFxuICAgIH07XG4gICAgY3VycmVudC52YWx1ZSArPSBob2xkaW5nLm1hcmtldFZhbHVlO1xuICAgIGN1cnJlbnQud2VpZ2h0ICs9IGhvbGRpbmcud2VpZ2h0O1xuICAgIGN1cnJlbnQuaG9sZGluZ3MgKz0gMTtcbiAgICBtYXAuc2V0KGhvbGRpbmcuc2VjdG9yLCBjdXJyZW50KTtcbiAgfVxuXG4gIHJldHVybiBbLi4ubWFwLnZhbHVlcygpXS5zb3J0KChsZWZ0LCByaWdodCkgPT4gcmlnaHQudmFsdWUgLSBsZWZ0LnZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2FzaERlcGxveW1lbnRJZGVhKGNhc2hXZWlnaHQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChjYXNoV2VpZ2h0ID49IDAuMjUpIHtcbiAgICByZXR1cm4gXCJDYXNoIGlzIGFib3ZlIDI1JS4gQ29uc2lkZXIgZGVwbG95aW5nIGludG8gdW5kZXJ3ZWlnaHQgdGFyZ2V0cyBncmFkdWFsbHkuXCI7XG4gIH1cblxuICBpZiAoY2FzaFdlaWdodCA+PSAwLjEpIHtcbiAgICByZXR1cm4gXCJDYXNoIGlzIGhlYWx0aHkuIEtlZXAgd2F0Y2hsaXN0IGVudHJpZXMgcmVhZHkgZm9yIHB1bGxiYWNrcy5cIjtcbiAgfVxuXG4gIHJldHVybiBcIkNhc2ggaXMgdGlnaHQuIFByaW9yaXRpemUgdHJpbXMgZnJvbSBvdmVyd2VpZ2h0IHRhcmdldHMgYmVmb3JlIG5ldyBidXlzLlwiO1xufVxuXG5mdW5jdGlvbiBTdGF0Q2FyZCh7XG4gIGxhYmVsLFxuICB2YWx1ZSxcbiAgZGV0YWlsLFxuICB0b25lID0gXCJuZXV0cmFsXCIsXG59OiB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGRldGFpbDogc3RyaW5nO1xuICB0b25lPzogXCJuZXV0cmFsXCIgfCBcInBvc2l0aXZlXCIgfCBcIm5lZ2F0aXZlXCI7XG59KSB7XG4gIHJldHVybiAoXG4gICAgPGFydGljbGUgY2xhc3NOYW1lPXtgc3RhdC1jYXJkICR7dG9uZX1gfT5cbiAgICAgIDxwPntsYWJlbH08L3A+XG4gICAgICA8c3Ryb25nPnt2YWx1ZX08L3N0cm9uZz5cbiAgICAgIDxzcGFuPntkZXRhaWx9PC9zcGFuPlxuICAgIDwvYXJ0aWNsZT5cbiAgKTtcbn1cblxuZnVuY3Rpb24gUGllQ2hhcnQoe1xuICBob2xkaW5ncyxcbn06IHtcbiAgaG9sZGluZ3M6IHsgdGlja2VyOiBzdHJpbmc7IG1hcmtldFZhbHVlOiBudW1iZXI7IHdlaWdodDogbnVtYmVyIH1bXTtcbn0pIHtcbiAgY29uc3QgW2hvdmVyZWQsIHNldEhvdmVyZWRdID0gdXNlU3RhdGU8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHBhZCA9IDEyO1xuICBjb25zdCBzaXplID0gMjgwO1xuICBjb25zdCBzdHJva2UgPSAzMjtcbiAgY29uc3QgcmFkaXVzID0gKHNpemUgLSBzdHJva2UpIC8gMjtcbiAgY29uc3QgY2lyY3VtZmVyZW5jZSA9IDIgKiBNYXRoLlBJICogcmFkaXVzO1xuICBjb25zdCB0b3RhbFZhbHVlID0gaG9sZGluZ3MucmVkdWNlKFxuICAgIChzdW0sIGhvbGRpbmcpID0+IHN1bSArIGhvbGRpbmcubWFya2V0VmFsdWUsXG4gICAgMCxcbiAgKTtcbiAgbGV0IGRhc2hPZmZzZXQgPSAwO1xuXG4gIGlmICh0b3RhbFZhbHVlID09PSAwKSB7XG4gICAgcmV0dXJuIDxkaXYgY2xhc3NOYW1lPVwiY2hhcnQtZW1wdHlcIj5ObyBob2xkaW5ncyB5ZXQ8L2Rpdj47XG4gIH1cblxuICBjb25zdCBob3ZlcmVkSG9sZGluZyA9IGhvdmVyZWQgIT09IG51bGwgPyBob2xkaW5nc1tob3ZlcmVkXSA6IG51bGw7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInBpZS1sYXlvdXRcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZG9udXQtY29udGFpbmVyXCI+XG4gICAgICAgIDxzdmdcbiAgICAgICAgICB2aWV3Qm94PXtgJHstcGFkfSAkey1wYWR9ICR7c2l6ZSArIHBhZCAqIDJ9ICR7c2l6ZSArIHBhZCAqIDJ9YH1cbiAgICAgICAgICBjbGFzc05hbWU9XCJwaWUtY2hhcnRcIlxuICAgICAgICAgIHJvbGU9XCJpbWdcIlxuICAgICAgICAgIGFyaWEtbGFiZWw9XCJQb3J0Zm9saW8gYWxsb2NhdGlvbiBjaGFydFwiXG4gICAgICAgICAgb25Nb3VzZUxlYXZlPXsoKSA9PiBzZXRIb3ZlcmVkKG51bGwpfVxuICAgICAgICA+XG4gICAgICAgICAgPGNpcmNsZSBjeD17c2l6ZSAvIDJ9IGN5PXtzaXplIC8gMn0gcj17cmFkaXVzfSBjbGFzc05hbWU9XCJwaWUtYmFzZVwiIC8+XG4gICAgICAgICAge2hvbGRpbmdzLm1hcCgoaG9sZGluZywgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRhc2hMZW5ndGggPSBob2xkaW5nLndlaWdodCAqIGNpcmN1bWZlcmVuY2U7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50T2Zmc2V0ID0gZGFzaE9mZnNldDtcbiAgICAgICAgICAgIGRhc2hPZmZzZXQgKz0gZGFzaExlbmd0aDtcbiAgICAgICAgICAgIGNvbnN0IGlzSG92ZXJlZCA9IGhvdmVyZWQgPT09IGluZGV4O1xuICAgICAgICAgICAgY29uc3QgaXNEaW1tZWQgPSBob3ZlcmVkICE9PSBudWxsICYmICFpc0hvdmVyZWQ7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8Y2lyY2xlXG4gICAgICAgICAgICAgICAga2V5PXtob2xkaW5nLnRpY2tlcn1cbiAgICAgICAgICAgICAgICBjeD17c2l6ZSAvIDJ9XG4gICAgICAgICAgICAgICAgY3k9e3NpemUgLyAyfVxuICAgICAgICAgICAgICAgIHI9e3JhZGl1c31cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BwaWUtc2xpY2UgJHtpc0hvdmVyZWQgPyBcInBpZS1zbGljZS0tYWN0aXZlXCIgOiBcIlwifSAke2lzRGltbWVkID8gXCJwaWUtc2xpY2UtLWRpbVwiIDogXCJcIn1gfVxuICAgICAgICAgICAgICAgIHN0eWxlPXtcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3Ryb2tlRGFzaGFycmF5OiBgJHtkYXNoTGVuZ3RofSAke2NpcmN1bWZlcmVuY2UgLSBkYXNoTGVuZ3RofWAsXG4gICAgICAgICAgICAgICAgICAgIHN0cm9rZURhc2hvZmZzZXQ6IC1jdXJyZW50T2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICBbXCItLXNsaWNlLWNvbG9yXCIgYXMgbmV2ZXJdOiBnZXRTbGljZUNvbG9yKGluZGV4KSxcbiAgICAgICAgICAgICAgICAgIH0gYXMgUmVhY3QuQ1NTUHJvcGVydGllc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9eygpID0+IHNldEhvdmVyZWQoaW5kZXgpfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9zdmc+XG4gICAgICAgIHtob3ZlcmVkSG9sZGluZyA/IChcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRvbnV0LWNlbnRlclwiPlxuICAgICAgICAgICAgPHN0cm9uZz57aG92ZXJlZEhvbGRpbmcudGlja2VyfTwvc3Ryb25nPlxuICAgICAgICAgICAgPHNwYW4+e2Zvcm1hdEN1cnJlbmN5KGhvdmVyZWRIb2xkaW5nLm1hcmtldFZhbHVlKX08L3NwYW4+XG4gICAgICAgICAgICA8c21hbGw+e2Zvcm1hdFBlcmNlbnQoaG92ZXJlZEhvbGRpbmcud2VpZ2h0KX08L3NtYWxsPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZG9udXQtY2VudGVyXCI+XG4gICAgICAgICAgICA8c3Ryb25nPlRvdGFsPC9zdHJvbmc+XG4gICAgICAgICAgICA8c3Bhbj57Zm9ybWF0Q3VycmVuY3kodG90YWxWYWx1ZSl9PC9zcGFuPlxuICAgICAgICAgICAgPHNtYWxsPntob2xkaW5ncy5sZW5ndGh9IHBvc2l0aW9uczwvc21hbGw+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICl9XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJwaWUtbGVnZW5kXCI+XG4gICAgICAgIHtob2xkaW5ncy5zbGljZSgwLCA4KS5tYXAoKGhvbGRpbmcsIGluZGV4KSA9PiAoXG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAga2V5PXtob2xkaW5nLnRpY2tlcn1cbiAgICAgICAgICAgIGNsYXNzTmFtZT17YGxlZ2VuZC1yb3cgJHtob3ZlcmVkID09PSBpbmRleCA/IFwibGVnZW5kLXJvdy0tYWN0aXZlXCIgOiBcIlwifSAke2hvdmVyZWQgIT09IG51bGwgJiYgaG92ZXJlZCAhPT0gaW5kZXggPyBcImxlZ2VuZC1yb3ctLWRpbVwiIDogXCJcIn1gfVxuICAgICAgICAgICAgb25Nb3VzZUVudGVyPXsoKSA9PiBzZXRIb3ZlcmVkKGluZGV4KX1cbiAgICAgICAgICAgIG9uTW91c2VMZWF2ZT17KCkgPT4gc2V0SG92ZXJlZChudWxsKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsZWdlbmQtc3dhdGNoXCJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgYmFja2dyb3VuZDogZ2V0U2xpY2VDb2xvcihpbmRleCkgfX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8c3Ryb25nPntob2xkaW5nLnRpY2tlcn08L3N0cm9uZz5cbiAgICAgICAgICAgICAgPHNwYW4+e2Zvcm1hdFBlcmNlbnQoaG9sZGluZy53ZWlnaHQpfSBvZiBwb3J0Zm9saW88L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKSl9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2xpY2VDb2xvcihpbmRleDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgcGFsZXR0ZSA9IFtcbiAgICBcIiM0Y2M5ZjBcIixcbiAgICBcIiM1ZWVhZDRcIixcbiAgICBcIiNmOTczMTZcIixcbiAgICBcIiNmYWNjMTVcIixcbiAgICBcIiNhNzhiZmFcIixcbiAgICBcIiNmNDcyYjZcIixcbiAgICBcIiMzOGJkZjhcIixcbiAgICBcIiMzNGQzOTlcIixcbiAgXTtcbiAgcmV0dXJuIHBhbGV0dGVbaW5kZXggJSBwYWxldHRlLmxlbmd0aF07XG59XG5cbmZ1bmN0aW9uIENvbWJvYm94KHtcbiAgdmFsdWUsXG4gIG9uQ2hhbmdlLFxuICBvcHRpb25zLFxuICBwbGFjZWhvbGRlcixcbn06IHtcbiAgdmFsdWU6IHN0cmluZztcbiAgb25DaGFuZ2U6ICh2YWw6IHN0cmluZykgPT4gdm9pZDtcbiAgb3B0aW9uczogc3RyaW5nW107XG4gIHBsYWNlaG9sZGVyPzogc3RyaW5nO1xufSkge1xuICBjb25zdCBbb3Blbiwgc2V0T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IHJlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudD4obnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBmdW5jdGlvbiBvbkRvY0NsaWNrKGU6IE1vdXNlRXZlbnQpIHtcbiAgICAgIGlmIChyZWYuY3VycmVudCAmJiAhcmVmLmN1cnJlbnQuY29udGFpbnMoZS50YXJnZXQgYXMgTm9kZSkpIHNldE9wZW4oZmFsc2UpO1xuICAgIH1cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIG9uRG9jQ2xpY2spO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIG9uRG9jQ2xpY2spO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgZmlsdGVyZWQgPSBvcHRpb25zLmZpbHRlcigobykgPT5cbiAgICAhdmFsdWUgPyB0cnVlIDogby50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHZhbHVlLnRvTG93ZXJDYXNlKCkpLFxuICApO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJjb21ib2JveFwiIHJlZj17cmVmfT5cbiAgICAgIDxpbnB1dFxuICAgICAgICB2YWx1ZT17dmFsdWV9XG4gICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xuICAgICAgICAgIG9uQ2hhbmdlKGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICBzZXRPcGVuKHRydWUpO1xuICAgICAgICB9fVxuICAgICAgICBvbkZvY3VzPXsoKSA9PiBzZXRPcGVuKHRydWUpfVxuICAgICAgICBwbGFjZWhvbGRlcj17cGxhY2Vob2xkZXJ9XG4gICAgICAgIGF1dG9Db21wbGV0ZT1cIm9mZlwiXG4gICAgICAvPlxuICAgICAge29wZW4gJiYgZmlsdGVyZWQubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29tYm9ib3gtbGlzdFwiPlxuICAgICAgICAgIHtmaWx0ZXJlZC5zbGljZSgwLCA1MCkubWFwKChvcHQpID0+IChcbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAga2V5PXtvcHR9XG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2Bjb21ib2JveC1vcHRpb24gJHtvcHQgPT09IHZhbHVlID8gXCJjb21ib2JveC1vcHRpb24tLWFjdGl2ZVwiIDogXCJcIn1gfVxuICAgICAgICAgICAgICBvbk1vdXNlRG93bj17KGUpID0+IHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgb25DaGFuZ2Uob3B0KTtcbiAgICAgICAgICAgICAgICBzZXRPcGVuKGZhbHNlKTtcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge29wdH1cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmZ1bmN0aW9uIFNvcnRIZWFkZXIoe1xuICBsYWJlbCxcbiAgc29ydEtleSxcbiAgc29ydCxcbiAgb25DbGljayxcbiAgYWxpZ24sXG59OiB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHNvcnRLZXk6IEhvbGRpbmdzU29ydEtleTtcbiAgc29ydDogeyBrZXk6IEhvbGRpbmdzU29ydEtleSB8IG51bGw7IGRpcjogU29ydERpciB9O1xuICBvbkNsaWNrOiAoazogSG9sZGluZ3NTb3J0S2V5KSA9PiB2b2lkO1xuICBhbGlnbj86IFwicmlnaHRcIjtcbn0pIHtcbiAgY29uc3QgYWN0aXZlID0gc29ydC5rZXkgPT09IHNvcnRLZXk7XG4gIGNvbnN0IGFycm93ID0gYWN0aXZlID8gKHNvcnQuZGlyID09PSBcImFzY1wiID8gXCIg4payXCIgOiBcIiDilrxcIikgOiBcIlwiO1xuICByZXR1cm4gKFxuICAgIDx0aCBjbGFzc05hbWU9e2FsaWduID09PSBcInJpZ2h0XCIgPyBcInJpZ2h0IHNvcnRhYmxlXCIgOiBcInNvcnRhYmxlXCJ9PlxuICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3NOYW1lPVwic29ydC1idG5cIiBvbkNsaWNrPXsoKSA9PiBvbkNsaWNrKHNvcnRLZXkpfT5cbiAgICAgICAge2xhYmVsfVxuICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzb3J0LWFycm93XCI+e2Fycm93fTwvc3Bhbj5cbiAgICAgIDwvYnV0dG9uPlxuICAgIDwvdGg+XG4gICk7XG59XG5cbmZ1bmN0aW9uIEFjdGlvblJvdyh7XG4gIGl0ZW0sXG4gIGtpbmQsXG4gIHRvdGFsLFxufToge1xuICBpdGVtOiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICBrZXk6IHN0cmluZztcbiAgICBtb2RlOiBcInNlY3RvclwiIHwgXCJ0aWNrZXJcIjtcbiAgICBnYXBWYWx1ZTogbnVtYmVyO1xuICAgIGRyaWZ0OiBudW1iZXI7XG4gICAgdGFyZ2V0V2VpZ2h0OiBudW1iZXI7XG4gICAgY3VycmVudFdlaWdodDogbnVtYmVyO1xuICAgIHByaWNlOiBudW1iZXI7XG4gICAgc2hhcmVzOiBudW1iZXI7XG4gIH07XG4gIGtpbmQ6IFwiYnV5XCIgfCBcInNlbGxcIjtcbiAgdG90YWw6IG51bWJlcjtcbn0pIHtcbiAgY29uc3QgaW1wYWN0ID0gdG90YWwgPiAwID8gKE1hdGguYWJzKGl0ZW0uZ2FwVmFsdWUpIC8gdG90YWwpICogMTAwIDogMDtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT17YGFjdGlvbi1yb3cgYWN0aW9uLXJvdy0tJHtraW5kfWB9PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJhY3Rpb24tcm93LW1haW5cIj5cbiAgICAgICAgPHN0cm9uZz57aXRlbS5rZXl9PC9zdHJvbmc+XG4gICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImFjdGlvbi1yb3ctbW9kZVwiPntpdGVtLm1vZGV9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJhY3Rpb24tcm93LWFtb3VudFwiPntmb3JtYXRDdXJyZW5jeShNYXRoLmFicyhpdGVtLmdhcFZhbHVlKSl9PC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImFjdGlvbi1yb3ctZGV0YWlsXCI+XG4gICAgICAgIDxzcGFuPlxuICAgICAgICAgIHtmb3JtYXRQZXJjZW50KGl0ZW0uY3VycmVudFdlaWdodCl9IOKGkiB7Zm9ybWF0UGVyY2VudChpdGVtLnRhcmdldFdlaWdodCl9XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgICAge2l0ZW0ubW9kZSA9PT0gXCJ0aWNrZXJcIiAmJiBpdGVtLnNoYXJlcyA+IDAgJiYgKFxuICAgICAgICAgIDxzcGFuPn57aXRlbS5zaGFyZXMudG9GaXhlZCgwKX0gc2ggQCB7Zm9ybWF0Q3VycmVuY3koaXRlbS5wcmljZSl9PC9zcGFuPlxuICAgICAgICApfVxuICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJhY3Rpb24tcm93LWltcGFjdFwiPntpbXBhY3QudG9GaXhlZCgxKX0lIG9mIGJvb2s8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxudHlwZSBIaXN0b3J5U2VyaWVzS2V5ID0gXCJ2YWx1ZVwiIHwgXCJjb3N0XCIgfCBcInR3clwiO1xuXG5jb25zdCBISVNUT1JZX1NFUklFU19NRVRBOiBSZWNvcmQ8XG4gIEhpc3RvcnlTZXJpZXNLZXksXG4gIHsgbGFiZWw6IHN0cmluZzsgY29sb3I6IHN0cmluZzsgZGFzaGVkPzogYm9vbGVhbiB9XG4+ID0ge1xuICB2YWx1ZTogeyBsYWJlbDogXCJNYXJrZXQgdmFsdWVcIiwgY29sb3I6IFwiI2U0ZWNmZlwiIH0sXG4gIGNvc3Q6IHsgbGFiZWw6IFwiQ29zdCBiYXNpc1wiLCBjb2xvcjogXCIjZmJiZjI0XCIsIGRhc2hlZDogdHJ1ZSB9LFxuICB0d3I6IHsgbGFiZWw6IFwiVHJ1ZSByZXR1cm4gKFRXUilcIiwgY29sb3I6IFwiIzVlZWFkNFwiIH0sXG59O1xuXG5mdW5jdGlvbiBQb3J0Zm9saW9IaXN0b3J5Q2hhcnQoe1xuICBzbmFwc2hvdHMsXG4gIGxhc3RGZXRjaGVkSXNvLFxufToge1xuICBzbmFwc2hvdHM6IFBvcnRmb2xpb1NuYXBzaG90W107XG4gIGxhc3RGZXRjaGVkSXNvPzogc3RyaW5nIHwgbnVsbDtcbn0pIHtcbiAgY29uc3QgW3ZpZXdNb2RlLCBzZXRWaWV3TW9kZV0gPSB1c2VTdGF0ZTxcInZhbHVlXCIgfCBcInR3clwiPihcInZhbHVlXCIpO1xuICBjb25zdCBbaGlkZGVuU2VyaWVzLCBzZXRIaWRkZW5TZXJpZXNdID0gdXNlU3RhdGU8U2V0PEhpc3RvcnlTZXJpZXNLZXk+PihcbiAgICAoKSA9PiBuZXcgU2V0KCksXG4gICk7XG5cbiAgY29uc3QgdHdySW5kZXggPSB1c2VNZW1vKCgpID0+IGNvbXB1dGVUd3JJbmRleChzbmFwc2hvdHMpLCBbc25hcHNob3RzXSk7XG5cbiAgY29uc3QgVyA9IDgwMDtcbiAgY29uc3QgSCA9IDMwMDtcbiAgY29uc3QgcGFkTCA9IDc4O1xuICBjb25zdCBwYWRSID0gMjQ7XG4gIGNvbnN0IHBhZFQgPSAyNDtcbiAgY29uc3QgcGFkQiA9IDQ4O1xuICBjb25zdCBpbm5lclcgPSBXIC0gcGFkTCAtIHBhZFI7XG4gIGNvbnN0IGlubmVySCA9IEggLSBwYWRUIC0gcGFkQjtcblxuICBjb25zdCB2aXNpYmxlS2V5cyA9IHVzZU1lbW88SGlzdG9yeVNlcmllc0tleVtdPigoKSA9PiB7XG4gICAgY29uc3Qga2V5czogSGlzdG9yeVNlcmllc0tleVtdID1cbiAgICAgIHZpZXdNb2RlID09PSBcInZhbHVlXCIgPyBbXCJ2YWx1ZVwiLCBcImNvc3RcIl0gOiBbXCJ0d3JcIl07XG4gICAgcmV0dXJuIGtleXMuZmlsdGVyKChrKSA9PiAhaGlkZGVuU2VyaWVzLmhhcyhrKSk7XG4gIH0sIFt2aWV3TW9kZSwgaGlkZGVuU2VyaWVzXSk7XG5cbiAgY29uc3QgY2hhcnQgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoc25hcHNob3RzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgdmFsdWVzID0gc25hcHNob3RzLm1hcCgocykgPT4gcy50b3RhbFZhbHVlKTtcbiAgICBjb25zdCBjb3N0cyA9IHNuYXBzaG90cy5tYXAoKHMpID0+IHMudG90YWxDb3N0KTtcblxuICAgIGNvbnN0IHNlcmllc0J5S2V5OiBSZWNvcmQ8SGlzdG9yeVNlcmllc0tleSwgbnVtYmVyW10+ID0ge1xuICAgICAgdmFsdWU6IHZhbHVlcyxcbiAgICAgIGNvc3Q6IGNvc3RzLFxuICAgICAgdHdyOiB0d3JJbmRleC5tYXAoKHYpID0+IHYgLSAxMDApLFxuICAgIH07XG5cbiAgICBjb25zdCBhbGxWaXNpYmxlID0gdmlzaWJsZUtleXMuZmxhdE1hcCgoaykgPT4gc2VyaWVzQnlLZXlba10pO1xuICAgIGNvbnN0IGhpID0gTWF0aC5tYXgoLi4uYWxsVmlzaWJsZSk7XG4gICAgY29uc3QgbG8gPSBNYXRoLm1pbiguLi5hbGxWaXNpYmxlLCB2aWV3TW9kZSA9PT0gXCJ0d3JcIiA/IDAgOiBoaSk7XG4gICAgY29uc3Qgc3BhbiA9IGhpIC0gbG8gfHwgMTtcbiAgICBjb25zdCB5SGkgPSBoaSArIHNwYW4gKiAwLjA4O1xuICAgIGNvbnN0IHlMbyA9IHZpZXdNb2RlID09PSBcInR3clwiID8gbG8gLSBzcGFuICogMC4wOCA6IE1hdGgubWF4KDAsIGxvIC0gc3BhbiAqIDAuMDgpO1xuXG4gICAgY29uc3QgeE9mID0gKGk6IG51bWJlcikgPT5cbiAgICAgIHBhZEwgK1xuICAgICAgKHNuYXBzaG90cy5sZW5ndGggPT09IDFcbiAgICAgICAgPyBpbm5lclcgLyAyXG4gICAgICAgIDogKGkgLyAoc25hcHNob3RzLmxlbmd0aCAtIDEpKSAqIGlubmVyVyk7XG4gICAgY29uc3QgeU9mID0gKHY6IG51bWJlcikgPT5cbiAgICAgIHBhZFQgKyBpbm5lckggLSAoKHYgLSB5TG8pIC8gKHlIaSAtIHlMbykpICogaW5uZXJIO1xuXG4gICAgY29uc3QgcG9pbnRzQnlLZXk6IFJlY29yZDxIaXN0b3J5U2VyaWVzS2V5LCB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH1bXT4gPSB7XG4gICAgICB2YWx1ZTogdmFsdWVzLm1hcCgodiwgaSkgPT4gKHsgeDogeE9mKGkpLCB5OiB5T2YodikgfSkpLFxuICAgICAgY29zdDogY29zdHMubWFwKCh2LCBpKSA9PiAoeyB4OiB4T2YoaSksIHk6IHlPZih2KSB9KSksXG4gICAgICB0d3I6IHNlcmllc0J5S2V5LnR3ci5tYXAoKHYsIGkpID0+ICh7IHg6IHhPZihpKSwgeTogeU9mKHYpIH0pKSxcbiAgICB9O1xuXG4gICAgY29uc3QgdGlja1ZhbHVlcyA9IG5pY2VUaWNrcyh5TG8sIHlIaSwgNSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc2VyaWVzQnlLZXksXG4gICAgICBwb2ludHNCeUtleSxcbiAgICAgIHlMbyxcbiAgICAgIHlIaSxcbiAgICAgIHhPZixcbiAgICAgIHlPZixcbiAgICAgIHRpY2tWYWx1ZXMsXG4gICAgfTtcbiAgfSwgW3NuYXBzaG90cywgdHdySW5kZXgsIHZpc2libGVLZXlzLCB2aWV3TW9kZSwgaW5uZXJILCBpbm5lclddKTtcblxuICBjb25zdCB7IGNvbnRhaW5lclJlZiwgc3ZnUmVmLCBob3ZlciwgaGFuZGxlcnMgfSA9IHVzZUNoYXJ0SG92ZXIoe1xuICAgIHBvaW50Q291bnQ6IHNuYXBzaG90cy5sZW5ndGgsXG4gICAgcGxvdExlZnQ6IHBhZEwsXG4gICAgcGxvdFJpZ2h0OiBwYWRSLFxuICAgIHZpZXdCb3hXaWR0aDogVyxcbiAgfSk7XG5cbiAgY29uc3QgY29udGFpbmVyV2lkdGggPVxuICAgIGNvbnRhaW5lclJlZi5jdXJyZW50Py5jbGllbnRXaWR0aCA/PyA2MDA7XG5cbiAgZnVuY3Rpb24gdG9nZ2xlU2VyaWVzKGtleTogSGlzdG9yeVNlcmllc0tleSkge1xuICAgIHNldEhpZGRlblNlcmllcygoY3VyKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChjdXIpO1xuICAgICAgaWYgKG5leHQuaGFzKGtleSkpIG5leHQuZGVsZXRlKGtleSk7XG4gICAgICBlbHNlIG5leHQuYWRkKGtleSk7XG4gICAgICByZXR1cm4gbmV4dDtcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChzbmFwc2hvdHMubGVuZ3RoIDwgMiB8fCAhY2hhcnQpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjaGFydC1lbXB0eVwiPlxuICAgICAgICBSZWZyZXNoIHByaWNlcyBhZnRlciBQU1ggY2xvc2UgKDE1OjMwIFBLVCkgb24gMisgd2Vla2RheXMgdG8gY2hhcnQgdmFsdWUgb3ZlciB0aW1lLlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IGxhYmVsRXZlcnkgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwoc25hcHNob3RzLmxlbmd0aCAvIDYpKTtcbiAgY29uc3QgZm9ybWF0WSA9ICh2OiBudW1iZXIpOiBzdHJpbmcgPT5cbiAgICB2aWV3TW9kZSA9PT0gXCJ0d3JcIiA/IGZvcm1hdFNpZ25lZFBlcmNlbnQodiwgMSkgOiBmb3JtYXRDb21wYWN0Q3VycmVuY3kodik7XG5cbiAgY29uc3QgaG92ZXJlZElkeCA9IGhvdmVyPy5pbmRleCA/PyBudWxsO1xuICBjb25zdCBsYXN0U25hcCA9IHNuYXBzaG90c1tzbmFwc2hvdHMubGVuZ3RoIC0gMV07XG4gIGNvbnN0IGZpcnN0U25hcCA9IHNuYXBzaG90c1swXTtcbiAgY29uc3QgdmFsdWVDaGFuZ2UgPSBsYXN0U25hcC50b3RhbFZhbHVlIC0gZmlyc3RTbmFwLnRvdGFsVmFsdWU7XG4gIGNvbnN0IHZhbHVlQ2hhbmdlUGN0ID1cbiAgICBmaXJzdFNuYXAudG90YWxWYWx1ZSA+IDBcbiAgICAgID8gKHZhbHVlQ2hhbmdlIC8gZmlyc3RTbmFwLnRvdGFsVmFsdWUpICogMTAwXG4gICAgICA6IDA7XG4gIGNvbnN0IHR3ckN1bXVsYXRpdmUgPSB0d3JJbmRleFt0d3JJbmRleC5sZW5ndGggLSAxXSAtIDEwMDtcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIHJlZj17Y29udGFpbmVyUmVmfVxuICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydFwiXG4gICAgICBkYXRhLXZpZXctbW9kZT17dmlld01vZGV9XG4gICAgPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWhlYWRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtc3VtbWFyeVwiPlxuICAgICAgICAgIHt2aWV3TW9kZSA9PT0gXCJ2YWx1ZVwiID8gKFxuICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgPHN0cm9uZz57Zm9ybWF0Q3VycmVuY3kobGFzdFNuYXAudG90YWxWYWx1ZSl9PC9zdHJvbmc+XG4gICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXt2YWx1ZUNoYW5nZSA+PSAwID8gXCJwb3NpdGl2ZVwiIDogXCJuZWdhdGl2ZVwifVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge3ZhbHVlQ2hhbmdlID49IDAgPyBcIitcIiA6IFwiXCJ9XG4gICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KHZhbHVlQ2hhbmdlKX0gKHtmb3JtYXRTaWduZWRQZXJjZW50KHZhbHVlQ2hhbmdlUGN0LCAyKX0pXG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgIDwvPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8PlxuICAgICAgICAgICAgICA8c3Ryb25nIGNsYXNzTmFtZT17dHdyQ3VtdWxhdGl2ZSA+PSAwID8gXCJwb3NpdGl2ZVwiIDogXCJuZWdhdGl2ZVwifT5cbiAgICAgICAgICAgICAgICB7Zm9ybWF0U2lnbmVkUGVyY2VudCh0d3JDdW11bGF0aXZlLCAyKX1cbiAgICAgICAgICAgICAgPC9zdHJvbmc+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIm11dGVkXCI+ZGVwb3NpdC1uZXV0cmFsIHJldHVybiBvdmVyIHtzbmFwc2hvdHMubGVuZ3RofSBzbmFwc2hvdHM8L3NwYW4+XG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWNvbnRyb2xzXCI+XG4gICAgICAgICAge2xhc3RGZXRjaGVkSXNvID8gKFxuICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydC1zdGFsZVwiXG4gICAgICAgICAgICAgIHRpdGxlPXtmb3JtYXREYXRlTG9uZyhsYXN0RmV0Y2hlZElzbyl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFVwZGF0ZWQge2Zvcm1hdFJlbGF0aXZlVGltZShsYXN0RmV0Y2hlZElzbyl9XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjaGlwLWdyb3VwXCI+XG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2BjaGlwICR7dmlld01vZGUgPT09IFwidmFsdWVcIiA/IFwiY2hpcC0tYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFZpZXdNb2RlKFwidmFsdWVcIil9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIFZhbHVlXG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT17YGNoaXAgJHt2aWV3TW9kZSA9PT0gXCJ0d3JcIiA/IFwiY2hpcC0tYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFZpZXdNb2RlKFwidHdyXCIpfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBUcnVlIHJldHVybiAlXG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWxlZ2VuZFwiPlxuICAgICAgICB7KHZpZXdNb2RlID09PSBcInZhbHVlXCJcbiAgICAgICAgICA/IChbXCJ2YWx1ZVwiLCBcImNvc3RcIl0gYXMgY29uc3QpXG4gICAgICAgICAgOiAoW1widHdyXCJdIGFzIGNvbnN0KVxuICAgICAgICApLm1hcCgoa2V5KSA9PiB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IEhJU1RPUllfU0VSSUVTX01FVEFba2V5XTtcbiAgICAgICAgICBjb25zdCBoaWRkZW4gPSBoaWRkZW5TZXJpZXMuaGFzKGtleSk7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAga2V5PXtrZXl9XG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2BsaW5lLWNoYXJ0LWxlZ2VuZC1pdGVtICR7aGlkZGVuID8gXCJsaW5lLWNoYXJ0LWxlZ2VuZC1pdGVtLS1vZmZcIiA6IFwiXCJ9YH1cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gdG9nZ2xlU2VyaWVzKGtleSl9XG4gICAgICAgICAgICAgIGFyaWEtcHJlc3NlZD17IWhpZGRlbn1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWxlZ2VuZC1zd2F0Y2hcIlxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBtZXRhLmRhc2hlZCA/IFwidHJhbnNwYXJlbnRcIiA6IG1ldGEuY29sb3IsXG4gICAgICAgICAgICAgICAgICBib3JkZXJDb2xvcjogbWV0YS5jb2xvcixcbiAgICAgICAgICAgICAgICAgIGJvcmRlclN0eWxlOiBtZXRhLmRhc2hlZCA/IFwiZGFzaGVkXCIgOiBcInNvbGlkXCIsXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAge21ldGEubGFiZWx9XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICApO1xuICAgICAgICB9KX1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtc3ZnLXdyYXBcIj5cbiAgICAgICAgPHN2Z1xuICAgICAgICAgIHJlZj17c3ZnUmVmfVxuICAgICAgICAgIHZpZXdCb3g9e2AwIDAgJHtXfSAke0h9YH1cbiAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LXN2Z1wiXG4gICAgICAgICAgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIlxuICAgICAgICAgIHJvbGU9XCJpbWdcIlxuICAgICAgICAgIGFyaWEtbGFiZWw9XCJQb3J0Zm9saW8gaGlzdG9yeSBsaW5lIGNoYXJ0XCJcbiAgICAgICAgICB7Li4uaGFuZGxlcnN9XG4gICAgICAgID5cbiAgICAgICAgICB7Y2hhcnQudGlja1ZhbHVlcy5tYXAoKHYsIGkpID0+IChcbiAgICAgICAgICAgIDxnIGtleT17YHktJHtpfWB9PlxuICAgICAgICAgICAgICA8bGluZVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtZ3JpZFwiXG4gICAgICAgICAgICAgICAgeDE9e3BhZEx9XG4gICAgICAgICAgICAgICAgeDI9e1cgLSBwYWRSfVxuICAgICAgICAgICAgICAgIHkxPXtjaGFydC55T2Yodil9XG4gICAgICAgICAgICAgICAgeTI9e2NoYXJ0LnlPZih2KX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPHRleHRcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWF4aXNcIlxuICAgICAgICAgICAgICAgIHg9e3BhZEwgLSAxMH1cbiAgICAgICAgICAgICAgICB5PXtjaGFydC55T2YodikgKyA0fVxuICAgICAgICAgICAgICAgIHRleHRBbmNob3I9XCJlbmRcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2Zvcm1hdFkodil9XG4gICAgICAgICAgICAgIDwvdGV4dD5cbiAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICApKX1cblxuICAgICAgICAgIHt2aWV3TW9kZSA9PT0gXCJ0d3JcIiA/IChcbiAgICAgICAgICAgIDxsaW5lXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtemVyb1wiXG4gICAgICAgICAgICAgIHgxPXtwYWRMfVxuICAgICAgICAgICAgICB4Mj17VyAtIHBhZFJ9XG4gICAgICAgICAgICAgIHkxPXtjaGFydC55T2YoMCl9XG4gICAgICAgICAgICAgIHkyPXtjaGFydC55T2YoMCl9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkgOiBudWxsfVxuXG4gICAgICAgICAge3Zpc2libGVLZXlzLmluY2x1ZGVzKFwidmFsdWVcIikgJiYgdmlld01vZGUgPT09IFwidmFsdWVcIiA/IChcbiAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtYXJlYVwiXG4gICAgICAgICAgICAgIGQ9e2Ake2J1aWxkQ2F0bXVsbFJvbVBhdGgoY2hhcnQucG9pbnRzQnlLZXkudmFsdWUpfSBMICR7Y2hhcnQucG9pbnRzQnlLZXkudmFsdWVbY2hhcnQucG9pbnRzQnlLZXkudmFsdWUubGVuZ3RoIC0gMV0ueH0gJHtjaGFydC55T2YoY2hhcnQueUxvKX0gTCAke2NoYXJ0LnBvaW50c0J5S2V5LnZhbHVlWzBdLnh9ICR7Y2hhcnQueU9mKGNoYXJ0LnlMbyl9IFpgfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApIDogbnVsbH1cblxuICAgICAgICAgIHt2aXNpYmxlS2V5cy5tYXAoKGtleSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWV0YSA9IEhJU1RPUllfU0VSSUVTX01FVEFba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IHB0cyA9IGNoYXJ0LnBvaW50c0J5S2V5W2tleV07XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgIGtleT17YGxpbmUtJHtrZXl9YH1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWxpbmVcIlxuICAgICAgICAgICAgICAgIGQ9e2J1aWxkQ2F0bXVsbFJvbVBhdGgocHRzKX1cbiAgICAgICAgICAgICAgICBzdHJva2U9e21ldGEuY29sb3J9XG4gICAgICAgICAgICAgICAgc3Ryb2tlRGFzaGFycmF5PXttZXRhLmRhc2hlZCA/IFwiNCA0XCIgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgc3Ryb2tlV2lkdGg9e2tleSA9PT0gXCJ2YWx1ZVwiIHx8IGtleSA9PT0gXCJ0d3JcIiA/IDIuNCA6IDEuNn1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG5cbiAgICAgICAgICB7c25hcHNob3RzLm1hcCgocywgaSkgPT4ge1xuICAgICAgICAgICAgaWYgKGkgJSBsYWJlbEV2ZXJ5ICE9PSAwICYmIGkgIT09IHNuYXBzaG90cy5sZW5ndGggLSAxKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDx0ZXh0XG4gICAgICAgICAgICAgICAga2V5PXtgeGwtJHtpfWB9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydC1heGlzXCJcbiAgICAgICAgICAgICAgICB4PXtjaGFydC54T2YoaSl9XG4gICAgICAgICAgICAgICAgeT17SCAtIHBhZEIgKyAyMn1cbiAgICAgICAgICAgICAgICB0ZXh0QW5jaG9yPVwibWlkZGxlXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtmb3JtYXREYXRlU2hvcnQocy5kYXRlKX1cbiAgICAgICAgICAgICAgPC90ZXh0PlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cblxuICAgICAgICAgIHtob3ZlcmVkSWR4ICE9PSBudWxsID8gKFxuICAgICAgICAgICAgPGcgcG9pbnRlckV2ZW50cz1cIm5vbmVcIj5cbiAgICAgICAgICAgICAgPGxpbmVcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWNyb3NzaGFpclwiXG4gICAgICAgICAgICAgICAgeDE9e2NoYXJ0LnhPZihob3ZlcmVkSWR4KX1cbiAgICAgICAgICAgICAgICB4Mj17Y2hhcnQueE9mKGhvdmVyZWRJZHgpfVxuICAgICAgICAgICAgICAgIHkxPXtwYWRUfVxuICAgICAgICAgICAgICAgIHkyPXtIIC0gcGFkQn1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAge3Zpc2libGVLZXlzLm1hcCgoa2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWV0YSA9IEhJU1RPUllfU0VSSUVTX01FVEFba2V5XTtcbiAgICAgICAgICAgICAgICBjb25zdCBwID0gY2hhcnQucG9pbnRzQnlLZXlba2V5XVtob3ZlcmVkSWR4XTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgPGNpcmNsZVxuICAgICAgICAgICAgICAgICAgICBrZXk9e2BoZC0ke2tleX1gfVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWhvdmVyLWRvdFwiXG4gICAgICAgICAgICAgICAgICAgIGN4PXtwLnh9XG4gICAgICAgICAgICAgICAgICAgIGN5PXtwLnl9XG4gICAgICAgICAgICAgICAgICAgIHI9ezV9XG4gICAgICAgICAgICAgICAgICAgIGZpbGw9e21ldGEuY29sb3J9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICA8L3N2Zz5cblxuICAgICAgICB7aG92ZXJlZElkeCAhPT0gbnVsbCAmJiBob3ZlciA/IChcbiAgICAgICAgICA8Q2hhcnRUb29sdGlwXG4gICAgICAgICAgICB4PXtob3Zlci5jb250YWluZXJYfVxuICAgICAgICAgICAgeT17aG92ZXIuY29udGFpbmVyWX1cbiAgICAgICAgICAgIGNvbnRhaW5lcldpZHRoPXtjb250YWluZXJXaWR0aH1cbiAgICAgICAgICAgIHRpdGxlPXtmb3JtYXREYXRlTG9uZyhzbmFwc2hvdHNbaG92ZXJlZElkeF0uZGF0ZSl9XG4gICAgICAgICAgICByb3dzPXsodmlld01vZGUgPT09IFwidmFsdWVcIlxuICAgICAgICAgICAgICA/IChbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIk1hcmtldCB2YWx1ZVwiLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZm9ybWF0Q3VycmVuY3koc25hcHNob3RzW2hvdmVyZWRJZHhdLnRvdGFsVmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICBjb2xvcjogSElTVE9SWV9TRVJJRVNfTUVUQS52YWx1ZS5jb2xvcixcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIkNvc3QgYmFzaXNcIixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGZvcm1hdEN1cnJlbmN5KHNuYXBzaG90c1tob3ZlcmVkSWR4XS50b3RhbENvc3QpLFxuICAgICAgICAgICAgICAgICAgICBjb2xvcjogSElTVE9SWV9TRVJJRVNfTUVUQS5jb3N0LmNvbG9yLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiVW5yZWFsaXplZCBQJkxcIixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGZvcm1hdEN1cnJlbmN5KHNuYXBzaG90c1tob3ZlcmVkSWR4XS5nYWluTG9zcyksXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0gYXMgY29uc3QpXG4gICAgICAgICAgICAgIDogKFtcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiVFdSIGN1bXVsYXRpdmVcIixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGZvcm1hdFNpZ25lZFBlcmNlbnQoXG4gICAgICAgICAgICAgICAgICAgICAgY2hhcnQuc2VyaWVzQnlLZXkudHdyW2hvdmVyZWRJZHhdLFxuICAgICAgICAgICAgICAgICAgICAgIDIsXG4gICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yOiBISVNUT1JZX1NFUklFU19NRVRBLnR3ci5jb2xvcixcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIk1hcmtldCB2YWx1ZVwiLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZm9ybWF0Q3VycmVuY3koc25hcHNob3RzW2hvdmVyZWRJZHhdLnRvdGFsVmFsdWUpLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiQ29zdCBiYXNpc1wiLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZm9ybWF0Q3VycmVuY3koc25hcHNob3RzW2hvdmVyZWRJZHhdLnRvdGFsQ29zdCksXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0gYXMgY29uc3QpXG4gICAgICAgICAgICApLm1hcCgocikgPT4gKHsgLi4uciB9KSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgKSA6IG51bGx9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxudHlwZSBJbnZlc3RtZW50Q2hhcnRSb3cgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIGRhdGU6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgYW1vdW50OiBudW1iZXI7XG4gIHRvdGFsOiBudW1iZXI7XG4gIHZhbHVlRW9tOiBudW1iZXI7XG4gIHBubFZhbHVlOiBudW1iZXI7XG4gIHBubFBjdDogbnVtYmVyO1xufTtcblxudHlwZSBJbnZlc3RTZXJpZXNLZXkgPSBcInRvdGFsXCIgfCBcInZhbHVlXCI7XG5jb25zdCBJTlZFU1RfU0VSSUVTX01FVEE6IFJlY29yZDxcbiAgSW52ZXN0U2VyaWVzS2V5LFxuICB7IGxhYmVsOiBzdHJpbmc7IGNvbG9yOiBzdHJpbmcgfVxuPiA9IHtcbiAgdG90YWw6IHsgbGFiZWw6IFwiQ2FwaXRhbCBkZXBsb3llZFwiLCBjb2xvcjogXCIjNWVhNWVhXCIgfSxcbiAgdmFsdWU6IHsgbGFiZWw6IFwiUG9ydGZvbGlvIHZhbHVlXCIsIGNvbG9yOiBcIiNlNGVjZmZcIiB9LFxufTtcblxuZnVuY3Rpb24gSW52ZXN0bWVudENoYXJ0KHsgcm93cyB9OiB7IHJvd3M6IEludmVzdG1lbnRDaGFydFJvd1tdIH0pIHtcbiAgY29uc3QgW2hpZGRlblNlcmllcywgc2V0SGlkZGVuU2VyaWVzXSA9IHVzZVN0YXRlPFNldDxJbnZlc3RTZXJpZXNLZXk+PihcbiAgICAoKSA9PiBuZXcgU2V0KCksXG4gICk7XG5cbiAgY29uc3QgVyA9IDgwMDtcbiAgY29uc3QgSCA9IDMyMDtcbiAgY29uc3QgcGFkTCA9IDc4O1xuICBjb25zdCBwYWRSID0gMjQ7XG4gIGNvbnN0IHBhZFQgPSAyNDtcbiAgY29uc3QgcGFkQiA9IDUyO1xuICBjb25zdCBpbm5lclcgPSBXIC0gcGFkTCAtIHBhZFI7XG4gIGNvbnN0IGlubmVySCA9IEggLSBwYWRUIC0gcGFkQjtcblxuICBjb25zdCB2aXNpYmxlS2V5cyA9IHVzZU1lbW88SW52ZXN0U2VyaWVzS2V5W10+KFxuICAgICgpID0+IChbXCJ0b3RhbFwiLCBcInZhbHVlXCJdIGFzIGNvbnN0KS5maWx0ZXIoKGspID0+ICFoaWRkZW5TZXJpZXMuaGFzKGspKSxcbiAgICBbaGlkZGVuU2VyaWVzXSxcbiAgKTtcblxuICBjb25zdCBjaGFydCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmIChyb3dzLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgdG90YWxzID0gcm93cy5tYXAoKHIpID0+IHIudG90YWwpO1xuICAgIGNvbnN0IHZhbHVlcyA9IHJvd3MubWFwKChyKSA9PiByLnZhbHVlRW9tKTtcblxuICAgIGNvbnN0IHNlcmllc0J5S2V5OiBSZWNvcmQ8SW52ZXN0U2VyaWVzS2V5LCBudW1iZXJbXT4gPSB7XG4gICAgICB0b3RhbDogdG90YWxzLFxuICAgICAgdmFsdWU6IHZhbHVlcyxcbiAgICB9O1xuXG4gICAgY29uc3QgdmlzaWJsZVNlcmllcyA9IHZpc2libGVLZXlzLmZsYXRNYXAoKGspID0+IHNlcmllc0J5S2V5W2tdKTtcbiAgICBjb25zdCBoaSA9IE1hdGgubWF4KC4uLnZpc2libGVTZXJpZXMsIDApO1xuICAgIGNvbnN0IGxvID0gTWF0aC5taW4oLi4udmlzaWJsZVNlcmllcywgMCk7XG4gICAgY29uc3Qgc3BhbiA9IGhpIC0gbG8gfHwgMTtcbiAgICBjb25zdCB5SGkgPSBoaSArIHNwYW4gKiAwLjA4O1xuICAgIGNvbnN0IHlMbyA9IE1hdGgubWF4KDAsIGxvIC0gc3BhbiAqIDAuMDQpO1xuXG4gICAgY29uc3QgeE9mID0gKGk6IG51bWJlcikgPT5cbiAgICAgIHBhZEwgK1xuICAgICAgKHJvd3MubGVuZ3RoID09PSAxXG4gICAgICAgID8gaW5uZXJXIC8gMlxuICAgICAgICA6IChpIC8gKHJvd3MubGVuZ3RoIC0gMSkpICogaW5uZXJXKTtcbiAgICBjb25zdCB5T2YgPSAodjogbnVtYmVyKSA9PlxuICAgICAgcGFkVCArIGlubmVySCAtICgodiAtIHlMbykgLyAoeUhpIC0geUxvKSkgKiBpbm5lckg7XG5cbiAgICBsZXQgc3RlcFBhdGggPSBgTSAke3hPZigwKX0gJHt5T2YodG90YWxzWzBdKX1gO1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgcm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgc3RlcFBhdGggKz0gYCBIICR7eE9mKGkpfSBWICR7eU9mKHRvdGFsc1tpXSl9YDtcbiAgICB9XG4gICAgY29uc3Qgc3RlcEFyZWEgPSBgJHtzdGVwUGF0aH0gTCAke3hPZihyb3dzLmxlbmd0aCAtIDEpfSAke3lPZih5TG8pfSBMICR7eE9mKDApfSAke3lPZih5TG8pfSBaYDtcblxuICAgIGNvbnN0IHZhbHVlUG9pbnRzID0gdmFsdWVzLm1hcCgodiwgaSkgPT4gKHsgeDogeE9mKGkpLCB5OiB5T2YodikgfSkpO1xuICAgIGNvbnN0IHRvdGFsUG9pbnRzID0gdG90YWxzLm1hcCgodiwgaSkgPT4gKHsgeDogeE9mKGkpLCB5OiB5T2YodikgfSkpO1xuXG4gICAgY29uc3QgdGlja1ZhbHVlcyA9IG5pY2VUaWNrcyh5TG8sIHlIaSwgNSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc2VyaWVzQnlLZXksXG4gICAgICB2YWx1ZVBhdGg6IGJ1aWxkQ2F0bXVsbFJvbVBhdGgodmFsdWVQb2ludHMpLFxuICAgICAgc3RlcFBhdGgsXG4gICAgICBzdGVwQXJlYSxcbiAgICAgIHZhbHVlUG9pbnRzLFxuICAgICAgdG90YWxQb2ludHMsXG4gICAgICB0aWNrVmFsdWVzLFxuICAgICAgeU9mLFxuICAgICAgeE9mLFxuICAgIH07XG4gIH0sIFtyb3dzLCB2aXNpYmxlS2V5cywgaW5uZXJILCBpbm5lclddKTtcblxuICBjb25zdCB7IGNvbnRhaW5lclJlZiwgc3ZnUmVmLCBob3ZlciwgaGFuZGxlcnMgfSA9IHVzZUNoYXJ0SG92ZXIoe1xuICAgIHBvaW50Q291bnQ6IHJvd3MubGVuZ3RoLFxuICAgIHBsb3RMZWZ0OiBwYWRMLFxuICAgIHBsb3RSaWdodDogcGFkUixcbiAgICB2aWV3Qm94V2lkdGg6IFcsXG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHRvZ2dsZVNlcmllcyhrZXk6IEludmVzdFNlcmllc0tleSkge1xuICAgIHNldEhpZGRlblNlcmllcygoY3VyKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChjdXIpO1xuICAgICAgaWYgKG5leHQuaGFzKGtleSkpIG5leHQuZGVsZXRlKGtleSk7XG4gICAgICBlbHNlIG5leHQuYWRkKGtleSk7XG4gICAgICByZXR1cm4gbmV4dDtcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChyb3dzLmxlbmd0aCA8IDIgfHwgIWNoYXJ0KSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2hhcnQtZW1wdHlcIj5cbiAgICAgICAgQWRkIGF0IGxlYXN0IDIgaW52ZXN0bWVudCBlbnRyaWVzIHRvIHNlZSBjaGFydC5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBjb25zdCBsYWJlbEV2ZXJ5ID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKHJvd3MubGVuZ3RoIC8gNikpO1xuICBjb25zdCBob3ZlcmVkSWR4ID0gaG92ZXI/LmluZGV4ID8/IG51bGw7XG4gIGNvbnN0IGNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyUmVmLmN1cnJlbnQ/LmNsaWVudFdpZHRoID8/IDYwMDtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgcmVmPXtjb250YWluZXJSZWZ9IGNsYXNzTmFtZT1cImxpbmUtY2hhcnRcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibGluZS1jaGFydC1sZWdlbmRcIj5cbiAgICAgICAgeyhbXCJ0b3RhbFwiLCBcInZhbHVlXCJdIGFzIGNvbnN0KS5tYXAoKGtleSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBJTlZFU1RfU0VSSUVTX01FVEFba2V5XTtcbiAgICAgICAgICBjb25zdCBoaWRkZW4gPSBoaWRkZW5TZXJpZXMuaGFzKGtleSk7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAga2V5PXtrZXl9XG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2BsaW5lLWNoYXJ0LWxlZ2VuZC1pdGVtICR7aGlkZGVuID8gXCJsaW5lLWNoYXJ0LWxlZ2VuZC1pdGVtLS1vZmZcIiA6IFwiXCJ9YH1cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gdG9nZ2xlU2VyaWVzKGtleSl9XG4gICAgICAgICAgICAgIGFyaWEtcHJlc3NlZD17IWhpZGRlbn1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWxlZ2VuZC1zd2F0Y2hcIlxuICAgICAgICAgICAgICAgIHN0eWxlPXt7IGJhY2tncm91bmQ6IG1ldGEuY29sb3IsIGJvcmRlckNvbG9yOiBtZXRhLmNvbG9yIH19XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIHttZXRhLmxhYmVsfVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgKTtcbiAgICAgICAgfSl9XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LXN2Zy13cmFwXCI+XG4gICAgICAgIDxzdmdcbiAgICAgICAgICByZWY9e3N2Z1JlZn1cbiAgICAgICAgICB2aWV3Qm94PXtgMCAwICR7V30gJHtIfWB9XG4gICAgICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydC1zdmdcIlxuICAgICAgICAgIHByZXNlcnZlQXNwZWN0UmF0aW89XCJub25lXCJcbiAgICAgICAgICByb2xlPVwiaW1nXCJcbiAgICAgICAgICBhcmlhLWxhYmVsPVwiSW52ZXN0bWVudCBncm93dGggY2hhcnRcIlxuICAgICAgICAgIHsuLi5oYW5kbGVyc31cbiAgICAgICAgPlxuICAgICAgICAgIHtjaGFydC50aWNrVmFsdWVzLm1hcCgodiwgaSkgPT4gKFxuICAgICAgICAgICAgPGcga2V5PXtgeS0ke2l9YH0+XG4gICAgICAgICAgICAgIDxsaW5lXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydC1ncmlkXCJcbiAgICAgICAgICAgICAgICB4MT17cGFkTH1cbiAgICAgICAgICAgICAgICB4Mj17VyAtIHBhZFJ9XG4gICAgICAgICAgICAgICAgeTE9e2NoYXJ0LnlPZih2KX1cbiAgICAgICAgICAgICAgICB5Mj17Y2hhcnQueU9mKHYpfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8dGV4dFxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtYXhpc1wiXG4gICAgICAgICAgICAgICAgeD17cGFkTCAtIDEwfVxuICAgICAgICAgICAgICAgIHk9e2NoYXJ0LnlPZih2KSArIDR9XG4gICAgICAgICAgICAgICAgdGV4dEFuY2hvcj1cImVuZFwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7Zm9ybWF0Q29tcGFjdEN1cnJlbmN5KHYpfVxuICAgICAgICAgICAgICA8L3RleHQ+XG4gICAgICAgICAgICA8L2c+XG4gICAgICAgICAgKSl9XG5cbiAgICAgICAgICB7dmlzaWJsZUtleXMuaW5jbHVkZXMoXCJ0b3RhbFwiKSA/IChcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIDxwYXRoIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtc3RlcC1maWxsXCIgZD17Y2hhcnQuc3RlcEFyZWF9IC8+XG4gICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydC1zdGVwXCJcbiAgICAgICAgICAgICAgICBkPXtjaGFydC5zdGVwUGF0aH1cbiAgICAgICAgICAgICAgICBzdHJva2U9e0lOVkVTVF9TRVJJRVNfTUVUQS50b3RhbC5jb2xvcn1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvPlxuICAgICAgICAgICkgOiBudWxsfVxuXG4gICAgICAgICAge3Zpc2libGVLZXlzLmluY2x1ZGVzKFwidmFsdWVcIikgPyAoXG4gICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWxpbmVcIlxuICAgICAgICAgICAgICBkPXtjaGFydC52YWx1ZVBhdGh9XG4gICAgICAgICAgICAgIHN0cm9rZT17SU5WRVNUX1NFUklFU19NRVRBLnZhbHVlLmNvbG9yfVxuICAgICAgICAgICAgICBzdHJva2VXaWR0aD17Mi40fVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApIDogbnVsbH1cblxuICAgICAgICAgIHtyb3dzLm1hcCgociwgaSkgPT4ge1xuICAgICAgICAgICAgaWYgKGkgJSBsYWJlbEV2ZXJ5ICE9PSAwICYmIGkgIT09IHJvd3MubGVuZ3RoIC0gMSkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8dGV4dFxuICAgICAgICAgICAgICAgIGtleT17YHhsLSR7ci5pZH1gfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtYXhpc1wiXG4gICAgICAgICAgICAgICAgeD17Y2hhcnQueE9mKGkpfVxuICAgICAgICAgICAgICAgIHk9e0ggLSBwYWRCICsgMjJ9XG4gICAgICAgICAgICAgICAgdGV4dEFuY2hvcj1cIm1pZGRsZVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7Zm9ybWF0RGF0ZVNob3J0KHIuZGF0ZSl9XG4gICAgICAgICAgICAgIDwvdGV4dD5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG5cbiAgICAgICAgICB7aG92ZXJlZElkeCAhPT0gbnVsbCA/IChcbiAgICAgICAgICAgIDxnIHBvaW50ZXJFdmVudHM9XCJub25lXCI+XG4gICAgICAgICAgICAgIDxsaW5lXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibGluZS1jaGFydC1jcm9zc2hhaXJcIlxuICAgICAgICAgICAgICAgIHgxPXtjaGFydC54T2YoaG92ZXJlZElkeCl9XG4gICAgICAgICAgICAgICAgeDI9e2NoYXJ0LnhPZihob3ZlcmVkSWR4KX1cbiAgICAgICAgICAgICAgICB5MT17cGFkVH1cbiAgICAgICAgICAgICAgICB5Mj17SCAtIHBhZEJ9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIHt2aXNpYmxlS2V5cy5pbmNsdWRlcyhcInRvdGFsXCIpID8gKFxuICAgICAgICAgICAgICAgIDxjaXJjbGVcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxpbmUtY2hhcnQtaG92ZXItZG90XCJcbiAgICAgICAgICAgICAgICAgIGN4PXtjaGFydC50b3RhbFBvaW50c1tob3ZlcmVkSWR4XS54fVxuICAgICAgICAgICAgICAgICAgY3k9e2NoYXJ0LnRvdGFsUG9pbnRzW2hvdmVyZWRJZHhdLnl9XG4gICAgICAgICAgICAgICAgICByPXs1fVxuICAgICAgICAgICAgICAgICAgZmlsbD17SU5WRVNUX1NFUklFU19NRVRBLnRvdGFsLmNvbG9yfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICAgICAgICB7dmlzaWJsZUtleXMuaW5jbHVkZXMoXCJ2YWx1ZVwiKSA/IChcbiAgICAgICAgICAgICAgICA8Y2lyY2xlXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJsaW5lLWNoYXJ0LWhvdmVyLWRvdFwiXG4gICAgICAgICAgICAgICAgICBjeD17Y2hhcnQudmFsdWVQb2ludHNbaG92ZXJlZElkeF0ueH1cbiAgICAgICAgICAgICAgICAgIGN5PXtjaGFydC52YWx1ZVBvaW50c1tob3ZlcmVkSWR4XS55fVxuICAgICAgICAgICAgICAgICAgcj17NX1cbiAgICAgICAgICAgICAgICAgIGZpbGw9e0lOVkVTVF9TRVJJRVNfTUVUQS52YWx1ZS5jb2xvcn1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICApIDogbnVsbH1cbiAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICApIDogbnVsbH1cbiAgICAgICAgPC9zdmc+XG5cbiAgICAgICAge2hvdmVyZWRJZHggIT09IG51bGwgJiYgaG92ZXIgPyAoXG4gICAgICAgICAgPENoYXJ0VG9vbHRpcFxuICAgICAgICAgICAgeD17aG92ZXIuY29udGFpbmVyWH1cbiAgICAgICAgICAgIHk9e2hvdmVyLmNvbnRhaW5lcll9XG4gICAgICAgICAgICBjb250YWluZXJXaWR0aD17Y29udGFpbmVyV2lkdGh9XG4gICAgICAgICAgICB0aXRsZT17YCR7Zm9ybWF0RGF0ZUxvbmcocm93c1tob3ZlcmVkSWR4XS5kYXRlKX0gwrcgJHtyb3dzW2hvdmVyZWRJZHhdLmxhYmVsfWB9XG4gICAgICAgICAgICByb3dzPXtbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBsYWJlbDogXCJDYXBpdGFsIGRlcGxveWVkXCIsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGZvcm1hdEN1cnJlbmN5KHJvd3NbaG92ZXJlZElkeF0udG90YWwpLFxuICAgICAgICAgICAgICAgIGNvbG9yOiBJTlZFU1RfU0VSSUVTX01FVEEudG90YWwuY29sb3IsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBsYWJlbDogXCJQb3J0Zm9saW8gdmFsdWVcIixcbiAgICAgICAgICAgICAgICB2YWx1ZTogZm9ybWF0Q3VycmVuY3kocm93c1tob3ZlcmVkSWR4XS52YWx1ZUVvbSksXG4gICAgICAgICAgICAgICAgY29sb3I6IElOVkVTVF9TRVJJRVNfTUVUQS52YWx1ZS5jb2xvcixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxhYmVsOiBcIlAmTFwiLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBgJHtyb3dzW2hvdmVyZWRJZHhdLnBubFZhbHVlID49IDAgPyBcIitcIiA6IFwiXCJ9JHtmb3JtYXRDdXJyZW5jeShyb3dzW2hvdmVyZWRJZHhdLnBubFZhbHVlKX0gKCR7Zm9ybWF0U2lnbmVkUGVyY2VudChyb3dzW2hvdmVyZWRJZHhdLnBubFBjdCwgMil9KWAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBsYWJlbDogXCJFbnRyeSBhbW91bnRcIixcbiAgICAgICAgICAgICAgICB2YWx1ZTpcbiAgICAgICAgICAgICAgICAgIHJvd3NbaG92ZXJlZElkeF0uYW1vdW50ID09PSAwXG4gICAgICAgICAgICAgICAgICAgID8gXCLigJRcIlxuICAgICAgICAgICAgICAgICAgICA6IGAke3Jvd3NbaG92ZXJlZElkeF0uYW1vdW50ID4gMCA/IFwiK1wiIDogXCJcIn0ke2Zvcm1hdEN1cnJlbmN5KHJvd3NbaG92ZXJlZElkeF0uYW1vdW50KX1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXX1cbiAgICAgICAgICAvPlxuICAgICAgICApIDogbnVsbH1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBSYW5rZWRBbGxvY2F0aW9uKHtcbiAgaXRlbXMsXG59OiB7XG4gIGl0ZW1zOiB7IGtleTogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyB2YWx1ZTogbnVtYmVyOyB3ZWlnaHQ6IG51bWJlciB9W107XG59KSB7XG4gIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gPGRpdiBjbGFzc05hbWU9XCJjaGFydC1lbXB0eVwiPk5vIGRhdGE8L2Rpdj47XG4gIH1cbiAgY29uc3Qgc29ydGVkID0gWy4uLml0ZW1zXS5zb3J0KChhLCBiKSA9PiBiLndlaWdodCAtIGEud2VpZ2h0KTtcbiAgY29uc3QgdG9wID0gc29ydGVkWzBdPy53ZWlnaHQgfHwgMTtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInJhbmtlZC1hbGxvY2F0aW9uXCI+XG4gICAgICB7c29ydGVkLm1hcCgoaXRlbSwgaSkgPT4ge1xuICAgICAgICBjb25zdCB3aWR0aFBjdCA9IChpdGVtLndlaWdodCAvIHRvcCkgKiAxMDA7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyYW5rZWQtcm93XCIga2V5PXtpdGVtLmtleX0+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJyYW5rZWQtcmFua1wiPntpICsgMX08L3NwYW4+XG4gICAgICAgICAgICA8c3Ryb25nIGNsYXNzTmFtZT1cInJhbmtlZC1sYWJlbFwiPntpdGVtLmxhYmVsfTwvc3Ryb25nPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyYW5rZWQtdHJhY2tcIj5cbiAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyYW5rZWQtZmlsbFwiXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIHdpZHRoOiBgJHt3aWR0aFBjdH0lYCxcbiAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IGdldFNsaWNlQ29sb3IoaSksXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicmFua2VkLXdlaWdodFwiPntmb3JtYXRQZXJjZW50KGl0ZW0ud2VpZ2h0KX08L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJyYW5rZWQtdmFsdWVcIj57Zm9ybWF0Q29tcGFjdEN1cnJlbmN5KGl0ZW0udmFsdWUpfTwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICAgIH0pfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG50eXBlIERpdmlkZW5kQ2VsbCA9IHtcbiAga2V5OiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHllYXI6IG51bWJlcjtcbiAgbW9udGg6IG51bWJlcjtcbiAgdG90YWw6IG51bWJlcjtcbiAgZW50cmllczogeyB0aWNrZXI6IHN0cmluZzsgYW1vdW50OiBudW1iZXI7IGRhdGU6IHN0cmluZyB9W107XG59O1xuXG5mdW5jdGlvbiBEaXZpZGVuZENhbGVuZGFyQ2hhcnQoeyBjZWxscyB9OiB7IGNlbGxzOiBEaXZpZGVuZENlbGxbXSB9KSB7XG4gIGNvbnN0IFtob3ZlcmVkLCBzZXRIb3ZlcmVkXSA9IHVzZVN0YXRlPG51bWJlciB8IG51bGw+KG51bGwpO1xuICBjb25zdCBjb250YWluZXJSZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgbWF4ID0gY2VsbHMucmVkdWNlKChtLCBjKSA9PiBNYXRoLm1heChtLCBjLnRvdGFsKSwgMCk7XG5cbiAgaWYgKG1heCA9PT0gMCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNoYXJ0LWVtcHR5XCI+XG4gICAgICAgIE5vIGRpdmlkZW5kIHBheW91dCBkYXRlcyB5ZXQuIFJlZnJlc2ggcHJpY2VzIHRvIHBvcHVsYXRlIHRoZSBjYWxlbmRhci5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBjb25zdCBjb250YWluZXJXaWR0aCA9IGNvbnRhaW5lclJlZi5jdXJyZW50Py5jbGllbnRXaWR0aCA/PyA2MDA7XG4gIGNvbnN0IGhvdmVyZWRDZWxsID0gaG92ZXJlZCAhPT0gbnVsbCA/IGNlbGxzW2hvdmVyZWRdIDogbnVsbDtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgcmVmPXtjb250YWluZXJSZWZ9IGNsYXNzTmFtZT1cImRpdmlkZW5kLWNhbGVuZGFyXCI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImRpdmlkZW5kLWNhbGVuZGFyLWJhcnNcIj5cbiAgICAgICAge2NlbGxzLm1hcCgoY2VsbCwgaSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGhlaWdodFBjdCA9IG1heCA+IDAgPyAoY2VsbC50b3RhbCAvIG1heCkgKiAxMDAgOiAwO1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIGtleT17Y2VsbC5rZXl9XG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2BkaXZpZGVuZC1iYXIgJHtjZWxsLnRvdGFsID09PSAwID8gXCJkaXZpZGVuZC1iYXItLWVtcHR5XCIgOiBcIlwifSAke2hvdmVyZWQgPT09IGkgPyBcImRpdmlkZW5kLWJhci0tYWN0aXZlXCIgOiBcIlwifWB9XG4gICAgICAgICAgICAgIG9uUG9pbnRlckVudGVyPXsoKSA9PiBzZXRIb3ZlcmVkKGkpfVxuICAgICAgICAgICAgICBvblBvaW50ZXJMZWF2ZT17KCkgPT4gc2V0SG92ZXJlZChudWxsKX1cbiAgICAgICAgICAgICAgb25Gb2N1cz17KCkgPT4gc2V0SG92ZXJlZChpKX1cbiAgICAgICAgICAgICAgb25CbHVyPXsoKSA9PiBzZXRIb3ZlcmVkKG51bGwpfVxuICAgICAgICAgICAgICBhcmlhLWxhYmVsPXtgJHtjZWxsLmxhYmVsfTogJHtmb3JtYXRDdXJyZW5jeShjZWxsLnRvdGFsKX1gfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJkaXZpZGVuZC1iYXItdHJhY2tcIj5cbiAgICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZGl2aWRlbmQtYmFyLWZpbGxcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgaGVpZ2h0OiBgJHtoZWlnaHRQY3R9JWAgfX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImRpdmlkZW5kLWJhci1hbW91bnRcIj5cbiAgICAgICAgICAgICAgICB7Y2VsbC50b3RhbCA9PT0gMCA/IFwi4oCUXCIgOiBmb3JtYXRDb21wYWN0Q3VycmVuY3koY2VsbC50b3RhbCl9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZGl2aWRlbmQtYmFyLWxhYmVsXCI+e2NlbGwubGFiZWx9PC9zcGFuPlxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgKTtcbiAgICAgICAgfSl9XG4gICAgICA8L2Rpdj5cblxuICAgICAge2hvdmVyZWRDZWxsICYmIGhvdmVyZWRDZWxsLmVudHJpZXMubGVuZ3RoID4gMCA/IChcbiAgICAgICAgPENoYXJ0VG9vbHRpcFxuICAgICAgICAgIHg9e2NvbnRhaW5lcldpZHRoIC8gMn1cbiAgICAgICAgICB5PXsyMH1cbiAgICAgICAgICBjb250YWluZXJXaWR0aD17Y29udGFpbmVyV2lkdGh9XG4gICAgICAgICAgdGl0bGU9e2Ake2hvdmVyZWRDZWxsLmxhYmVsfSDCtyAke2Zvcm1hdEN1cnJlbmN5KGhvdmVyZWRDZWxsLnRvdGFsKX1gfVxuICAgICAgICAgIHJvd3M9e2hvdmVyZWRDZWxsLmVudHJpZXMubWFwKChlbnRyeSkgPT4gKHtcbiAgICAgICAgICAgIGxhYmVsOiBgJHtlbnRyeS50aWNrZXJ9IMK3ICR7Zm9ybWF0RGF0ZVNob3J0KGVudHJ5LmRhdGUpfWAsXG4gICAgICAgICAgICB2YWx1ZTogZm9ybWF0Q3VycmVuY3koZW50cnkuYW1vdW50KSxcbiAgICAgICAgICB9KSl9XG4gICAgICAgIC8+XG4gICAgICApIDogbnVsbH1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gVHJlZW1hcCh7XG4gIGl0ZW1zLFxufToge1xuICBpdGVtczogeyBrZXk6IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgdmFsdWU6IG51bWJlcjsgd2VpZ2h0OiBudW1iZXIgfVtdO1xufSkge1xuICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIDxkaXYgY2xhc3NOYW1lPVwiY2hhcnQtZW1wdHlcIj5ObyBkYXRhPC9kaXY+O1xuICB9XG5cbiAgY29uc3QgdG90YWxXZWlnaHQgPSBpdGVtcy5yZWR1Y2UoKHMsIGkpID0+IHMgKyBpLndlaWdodCwgMCk7XG5cbiAgLy8gU3F1YXJpZmllZCBsYXlvdXQ6IHNwbGl0IGludG8gcm93cywgYWltaW5nIGZvciBhc3BlY3QgcmF0aW9zIGNsb3NlIHRvIDFcbiAgY29uc3Qgcm93czogdHlwZW9mIGl0ZW1zW10gPSBbXTtcbiAgbGV0IHJlbWFpbmluZyA9IFsuLi5pdGVtc107XG4gIGxldCByZW1haW5pbmdXZWlnaHQgPSB0b3RhbFdlaWdodDtcblxuICB3aGlsZSAocmVtYWluaW5nLmxlbmd0aCA+IDApIHtcbiAgICBsZXQgYmVzdCA9IDE7XG4gICAgbGV0IGJlc3RSYXRpbyA9IEluZmluaXR5O1xuXG4gICAgZm9yIChsZXQgY291bnQgPSAxOyBjb3VudCA8PSByZW1haW5pbmcubGVuZ3RoOyBjb3VudCsrKSB7XG4gICAgICBjb25zdCBzbGljZSA9IHJlbWFpbmluZy5zbGljZSgwLCBjb3VudCk7XG4gICAgICBjb25zdCBzbGljZVdlaWdodCA9IHNsaWNlLnJlZHVjZSgocywgaSkgPT4gcyArIGkud2VpZ2h0LCAwKTtcbiAgICAgIGNvbnN0IHJvd0ZyYWN0aW9uID0gc2xpY2VXZWlnaHQgLyB0b3RhbFdlaWdodDtcbiAgICAgIGNvbnN0IHdvcnN0UmF0aW8gPSBNYXRoLm1heChcbiAgICAgICAgLi4uc2xpY2UubWFwKChpKSA9PiB7XG4gICAgICAgICAgY29uc3QgdyA9IGkud2VpZ2h0IC8gc2xpY2VXZWlnaHQ7XG4gICAgICAgICAgY29uc3QgYXNwZWN0ID0gcm93RnJhY3Rpb24gPiAwID8gKHcgLyByb3dGcmFjdGlvbikgOiAxO1xuICAgICAgICAgIHJldHVybiBNYXRoLm1heChhc3BlY3QsIDEgLyAoYXNwZWN0IHx8IDEpKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgICAgaWYgKHdvcnN0UmF0aW8gPD0gYmVzdFJhdGlvKSB7XG4gICAgICAgIGJlc3RSYXRpbyA9IHdvcnN0UmF0aW87XG4gICAgICAgIGJlc3QgPSBjb3VudDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJvd3MucHVzaChyZW1haW5pbmcuc2xpY2UoMCwgYmVzdCkpO1xuICAgIGNvbnN0IHVzZWRXZWlnaHQgPSByZW1haW5pbmcuc2xpY2UoMCwgYmVzdCkucmVkdWNlKChzLCBpKSA9PiBzICsgaS53ZWlnaHQsIDApO1xuICAgIHJlbWFpbmluZ1dlaWdodCAtPSB1c2VkV2VpZ2h0O1xuICAgIHJlbWFpbmluZyA9IHJlbWFpbmluZy5zbGljZShiZXN0KTtcbiAgfVxuXG4gIGxldCBjb2xvcklkeCA9IDA7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInRyZWVtYXAtY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInRyZWVtYXAtZ3JpZFwiPlxuICAgICAgICB7cm93cy5tYXAoKHJvdywgcmkpID0+IHtcbiAgICAgICAgICBjb25zdCByb3dXZWlnaHQgPSByb3cucmVkdWNlKChzLCByKSA9PiBzICsgci53ZWlnaHQsIDApO1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGtleT17cml9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRyZWVtYXAtcm93XCJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgZmxleEdyb3c6IHJvd1dlaWdodCwgZmxleFNocmluazogMSwgZmxleEJhc2lzOiAwIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtyb3cubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2kgPSBjb2xvcklkeCsrO1xuICAgICAgICAgICAgICAgIGNvbnN0IHdpZHRoUGN0ID0gKGl0ZW0ud2VpZ2h0IC8gcm93V2VpZ2h0KSAqIDEwMDtcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW0ua2V5fVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0cmVlbWFwLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e1xuICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiLS10cmVlLWNvbG9yXCI6IGdldFNsaWNlQ29sb3IoY2kpLFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IGAke3dpZHRoUGN0fSVgLFxuICAgICAgICAgICAgICAgICAgICAgIH0gYXMgUmVhY3QuQ1NTUHJvcGVydGllc1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlPXtgJHtpdGVtLmxhYmVsfTogJHtmb3JtYXRDdXJyZW5jeShpdGVtLnZhbHVlKX0gKCR7Zm9ybWF0UGVyY2VudChpdGVtLndlaWdodCl9KWB9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+e2l0ZW0ubGFiZWx9PC9zdHJvbmc+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuPntmb3JtYXRQZXJjZW50KGl0ZW0ud2VpZ2h0KX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxzbWFsbD57Zm9ybWF0Q3VycmVuY3koaXRlbS52YWx1ZSl9PC9zbWFsbD5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKTtcbiAgICAgICAgfSl9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxudHlwZSBQc3hTdG9jayA9IHsgdGlja2VyOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgc2VjdG9yOiBzdHJpbmcgfTtcblxuZnVuY3Rpb24gU3RvY2tTZWFyY2goe1xuICBvblNlbGVjdCxcbiAgc2VsZWN0ZWQsXG4gIG9uQ2xlYXIsXG59OiB7XG4gIG9uU2VsZWN0OiAoc3RvY2s6IFBzeFN0b2NrKSA9PiB2b2lkO1xuICBzZWxlY3RlZDogc3RyaW5nO1xuICBvbkNsZWFyOiAoKSA9PiB2b2lkO1xufSkge1xuICBjb25zdCBbcXVlcnksIHNldFF1ZXJ5XSA9IHVzZVN0YXRlKFwiXCIpO1xuICBjb25zdCBbc3RvY2tzLCBzZXRTdG9ja3NdID0gdXNlU3RhdGU8UHN4U3RvY2tbXT4oW10pO1xuICBjb25zdCBbb3Blbiwgc2V0T3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IHdyYXBSZWYgPSB1c2VSZWY8SFRNTExhYmVsRWxlbWVudD4obnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBmZXRjaChcIi9hcGkvcHN4L3N0b2Nrc1wiKVxuICAgICAgLnRoZW4oKHIpID0+IHIuanNvbigpKVxuICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHNldFN0b2NrcyhkYXRhKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKCkgPT4ge30pO1xuICB9LCBbXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBmdW5jdGlvbiBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgICBpZiAod3JhcFJlZi5jdXJyZW50ICYmICF3cmFwUmVmLmN1cnJlbnQuY29udGFpbnMoZS50YXJnZXQgYXMgTm9kZSkpIHtcbiAgICAgICAgc2V0T3BlbihmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgaGFuZGxlQ2xpY2spO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGhhbmRsZUNsaWNrKTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IHEgPSBxdWVyeS50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBmaWx0ZXJlZCA9IHF1ZXJ5Lmxlbmd0aCA+IDBcbiAgICA/IHN0b2Nrc1xuICAgICAgICAuZmlsdGVyKFxuICAgICAgICAgIChzKSA9PlxuICAgICAgICAgICAgcy50aWNrZXIuaW5jbHVkZXMocSkgfHxcbiAgICAgICAgICAgIHMubmFtZS50b1VwcGVyQ2FzZSgpLmluY2x1ZGVzKHEpLFxuICAgICAgICApXG4gICAgICAgIC5zbGljZSgwLCA4KVxuICAgIDogW107XG5cbiAgaWYgKHNlbGVjdGVkKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJmaWVsZCBzdG9jay1zZWFyY2gtZmllbGRcIj5cbiAgICAgICAgPHNwYW4+U3RvY2s8L3NwYW4+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3RvY2stc2VsZWN0ZWRcIj5cbiAgICAgICAgICA8c3Bhbj57c2VsZWN0ZWR9PC9zcGFuPlxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzTmFtZT1cInN0b2NrLWNsZWFyXCIgb25DbGljaz17b25DbGVhcn0+XG4gICAgICAgICAgICAmdGltZXM7XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9sYWJlbD5cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZmllbGQgc3RvY2stc2VhcmNoLWZpZWxkXCIgcmVmPXt3cmFwUmVmfT5cbiAgICAgIDxzcGFuPlNlYXJjaCBzdG9jazwvc3Bhbj5cbiAgICAgIDxpbnB1dFxuICAgICAgICB2YWx1ZT17cXVlcnl9XG4gICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xuICAgICAgICAgIHNldFF1ZXJ5KGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICBzZXRPcGVuKHRydWUpO1xuICAgICAgICB9fVxuICAgICAgICBvbkZvY3VzPXsoKSA9PiBxdWVyeS5sZW5ndGggPiAwICYmIHNldE9wZW4odHJ1ZSl9XG4gICAgICAgIHBsYWNlaG9sZGVyPVwiVHlwZSB0aWNrZXIgb3IgY29tcGFueSBuYW1lLi4uXCJcbiAgICAgICAgYXV0b0NvbXBsZXRlPVwib2ZmXCJcbiAgICAgIC8+XG4gICAgICB7b3BlbiAmJiBmaWx0ZXJlZC5sZW5ndGggPiAwICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzdG9jay1kcm9wZG93blwiPlxuICAgICAgICAgIHtmaWx0ZXJlZC5tYXAoKHMpID0+IChcbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAga2V5PXtzLnRpY2tlcn1cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInN0b2NrLW9wdGlvblwiXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICBvblNlbGVjdChzKTtcbiAgICAgICAgICAgICAgICBzZXRRdWVyeShcIlwiKTtcbiAgICAgICAgICAgICAgICBzZXRPcGVuKGZhbHNlKTtcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHN0cm9uZz57cy50aWNrZXJ9PC9zdHJvbmc+XG4gICAgICAgICAgICAgIDxzcGFuPntzLm5hbWV9PC9zcGFuPlxuICAgICAgICAgICAgICA8c21hbGw+e3Muc2VjdG9yfTwvc21hbGw+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuICAgIDwvbGFiZWw+XG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFwcDtcbiJdLCJmaWxlIjoiQzovZGV2L3BzeC9zcmMvQXBwLnRzeCJ9