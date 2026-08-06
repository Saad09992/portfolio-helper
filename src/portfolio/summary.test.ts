import { describe, expect, it } from "vitest";
import type { DerivedHolding, InvestmentEntry, SectorBucket } from "../types";
import type { PortfolioSnapshot } from "../utils";
import { DEFAULT_FEE_CONFIG } from "../ledger/feeConfig";
import {
  buildPortfolioSummary,
  type PortfolioSummaryInput,
  type SummaryTargetRow,
} from "./summary";

function holding(over: Partial<DerivedHolding>): DerivedHolding {
  return {
    id: "h",
    ticker: "X",
    name: "Stock X",
    sector: "Misc",
    account: "PSX",
    shares: 100,
    price: 100,
    costBasis: 90,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
    marketValue: 10000,
    costValue: 9000,
    gainLoss: 1000,
    weight: 1,
    ...over,
  };
}

function baseInput(over: Partial<PortfolioSummaryInput> = {}): PortfolioSummaryInput {
  return {
    generatedAt: "2026-06-12T10:00:00Z",
    lastFetchedAt: "2026-06-12T08:00:00Z",
    totals: {
      totalValue: 100000,
      equityMarketValue: 95000,
      totalCost: 80000,
      unrealizedPnL: 15000,
      dayPnL: 1200,
    },
    cash: { available: 5000, weight: 0.05 },
    holdings: [],
    sectors: [],
    targets: [],
    upcomingDividends: [],
    investments: {
      totalInvested: 0,
      latestValue: 0,
      pnlValue: 0,
      pnlPct: 0,
      count: 0,
    },
    investmentLedger: [],
    history: [],
    twrLatest: null,
    ...over,
  };
}

function countTableDataRows(md: string, sectionTitle: string): number {
  const idx = md.indexOf(sectionTitle);
  if (idx === -1) return 0;
  const rest = md.slice(idx);
  const nextHeading = rest.indexOf("\n## ", 1);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const lines = section.split("\n");
  let count = 0;
  let sawSep = false;
  for (const line of lines) {
    if (/^\| ---/.test(line)) {
      sawSep = true;
      continue;
    }
    if (sawSep && line.startsWith("|")) count++;
  }
  return count;
}

describe("buildPortfolioSummary — header & empty", () => {
  it("renders header with date and last refresh line", () => {
    const md = buildPortfolioSummary(baseInput(), "comprehensive");
    expect(md).toMatch(/^# Portfolio Summary —/);
    expect(md).toMatch(/Last price refresh/);
  });

  it("omits last refresh line when lastFetchedAt is null", () => {
    const md = buildPortfolioSummary(
      baseInput({ lastFetchedAt: null }),
      "comprehensive",
    );
    expect(md).not.toMatch(/Last price refresh/);
  });

  it("shows _Empty portfolio_ for holdings when zero", () => {
    const md = buildPortfolioSummary(baseInput(), "compact");
    expect(md).toMatch(/Empty portfolio/);
  });
});

describe("buildPortfolioSummary — depth gating", () => {
  const holdings = [holding({ ticker: "OGDC", marketValue: 50000, weight: 0.5 })];
  const sectors: SectorBucket[] = [
    { sector: "Energy", value: 50000, weight: 0.5, holdings: 1 },
  ];
  const targets: SummaryTargetRow[] = [
    {
      mode: "sector",
      key: "Energy",
      currentWeight: 0.5,
      targetWeight: 0.4,
      drift: 0.1,
      absDrift: 0.1,
      gapValue: -10000,
      status: "warn",
    },
  ];
  const history: PortfolioSnapshot[] = [
    { date: "2026-06-10T10:00:00Z", totalValue: 99000, totalCost: 80000, gainLoss: 19000 },
    { date: "2026-06-11T10:00:00Z", totalValue: 99500, totalCost: 80000, gainLoss: 19500 },
    { date: "2026-06-12T10:00:00Z", totalValue: 100000, totalCost: 80000, gainLoss: 20000 },
  ];
  const ledger: InvestmentEntry[] = [
    { id: "i1", date: "2026-05-01", label: "May", amount: 50000, valueEom: 51000 },
    { id: "i2", date: "2026-06-01", label: "Jun", amount: 30000, valueEom: 82000 },
  ];

  const input = baseInput({ holdings, sectors, targets, history, investmentLedger: ledger });

  it("headline mode shows top holdings, omits full tables/ledger/history", () => {
    const md = buildPortfolioSummary(input, "headline");
    expect(md).toMatch(/## Top holdings/);
    expect(md).not.toMatch(/## Holdings\n/);
    expect(md).not.toMatch(/## Sector allocation/);
    expect(md).not.toMatch(/## Targets vs current/);
    expect(md).not.toMatch(/## Recent history/);
    expect(md).not.toMatch(/## Investment ledger/);
    expect(md).toMatch(/## Performance/);
  });

  it("compact mode shows tables but omits history/ledger", () => {
    const md = buildPortfolioSummary(input, "compact");
    expect(md).toMatch(/## Holdings/);
    expect(md).toMatch(/## Sector allocation/);
    expect(md).toMatch(/## Targets vs current/);
    expect(md).toMatch(/## Performance/);
    expect(md).toMatch(/## Upcoming dividends/);
    expect(md).not.toMatch(/## Recent history/);
    expect(md).not.toMatch(/## Investment ledger/);
  });

  it("comprehensive mode includes all sections", () => {
    const md = buildPortfolioSummary(input, "comprehensive");
    expect(md).toMatch(/## Holdings/);
    expect(md).toMatch(/## Sector allocation/);
    expect(md).toMatch(/## Targets vs current/);
    expect(md).toMatch(/## Performance/);
    expect(md).toMatch(/## Upcoming dividends/);
    expect(md).toMatch(/## Recent history/);
    expect(md).toMatch(/## Investment ledger/);
  });
});

describe("buildPortfolioSummary — tables & math", () => {
  it("holdings table row count matches input length", () => {
    const holdings = [
      holding({ id: "a", ticker: "A", marketValue: 30000, weight: 0.3 }),
      holding({ id: "b", ticker: "B", marketValue: 20000, weight: 0.2 }),
      holding({ id: "c", ticker: "C", marketValue: 10000, weight: 0.1 }),
    ];
    const md = buildPortfolioSummary(baseInput({ holdings }), "compact");
    expect(countTableDataRows(md, "## Holdings")).toBe(3);
  });

  it("targets section omitted when no targets", () => {
    const holdings = [holding({})];
    const md = buildPortfolioSummary(baseInput({ holdings }), "compact");
    expect(md).not.toMatch(/## Targets vs current/);
  });

  it("day P/L row math: 10000 @ 2% → ~196.08", () => {
    // marketValue is paisa: ₨10,000 = 1,000,000 paisa.
    const holdings = [holding({ marketValue: 1_000_000, dayChangePct: 2 })];
    const md = buildPortfolioSummary(baseInput({ holdings }), "compact");
    expect(md).toMatch(/\+Rs\s*196\.08/);
  });

  it("recent history shows newest first", () => {
    const history: PortfolioSnapshot[] = [
      { date: "2026-06-01T10:00:00Z", totalValue: 100, totalCost: 100, gainLoss: 0 },
      { date: "2026-06-02T10:00:00Z", totalValue: 110, totalCost: 100, gainLoss: 10 },
      { date: "2026-06-03T10:00:00Z", totalValue: 120, totalCost: 100, gainLoss: 20 },
    ];
    const holdings = [holding({})];
    const md = buildPortfolioSummary(
      baseInput({ holdings, history }),
      "comprehensive",
    );
    const histIdx = md.indexOf("## Recent history");
    const nextH = md.indexOf("\n## ", histIdx + 1);
    const section = md.slice(histIdx, nextH === -1 ? undefined : nextH);
    const firstRow = section.split("\n").find((l) => l.startsWith("| 03"));
    expect(firstRow).toBeDefined();
  });

  it("TWR renders — when twrLatest is null", () => {
    const md = buildPortfolioSummary(baseInput(), "comprehensive");
    expect(md).toMatch(/TWR index \(latest\): —/);
  });

  it("TWR renders a numeric value when present", () => {
    const md = buildPortfolioSummary(
      baseInput({ twrLatest: 118.4 }),
      "comprehensive",
    );
    expect(md).toMatch(/TWR index \(latest\): 118\.40/);
  });

  it("upcoming dividends section shows empty note when none", () => {
    const holdings = [holding({})];
    const md = buildPortfolioSummary(baseInput({ holdings }), "compact");
    expect(md).toMatch(/No upcoming dividends in window/);
  });

  it("dividends limited to 4 in compact, 10 in comprehensive", () => {
    const divs = Array.from({ length: 12 }, (_, i) => ({
      ticker: `T${i}`,
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      dps: 1,
      expectedIncome: 100,
    }));
    const holdings = [holding({})];
    const compact = buildPortfolioSummary(
      baseInput({ holdings, upcomingDividends: divs }),
      "compact",
    );
    const comp = buildPortfolioSummary(
      baseInput({ holdings, upcomingDividends: divs }),
      "comprehensive",
    );
    expect(countTableDataRows(compact, "## Upcoming dividends")).toBe(4);
    expect(countTableDataRows(comp, "## Upcoming dividends")).toBe(10);
  });
});

describe("ledger sections", () => {
  const stocks = [
    {
      ticker: "LUCK",
      name: "Lucky Cement",
      sector: "Materials",
      shares: 120,
      avgCost: 14_800,
      openCost: 1_776_000,
      price: 16_000,
      marketValue: 1_920_000,
      unrealized: 144_000,
      exitFees: 2900,
      exitCgt: 21_165,
      netIfSoldToday: 119_935,
      realized: 36_819,
      dividends: 25_500,
      totalNet: 206_319,
      invested: 2_214_800,
      returned: 505_000,
      totalReturnPct: 9.31,
      feesPaid: 4952,
      taxesPaid: 30_197,
      feeDragPct: 1.59,
      firstDate: "2025-01-10",
      lastDate: "2025-07-10",
      holdingDays: 320,
      closed: { count: 1, wins: 1, winRatePct: 100, best: 43_316, worst: 43_316 },
      contributionPct: 100,
      isClosed: false,
    },
  ];

  const taxYears = [
    {
      fy: "2024-25",
      startDate: "2024-07-01",
      endDate: "2025-06-30",
      gains: 43_316,
      losses: 0,
      carryIn: 0,
      offsetUsed: 0,
      taxable: 43_316,
      effectiveRatePct: 15,
      cgtDue: 6497,
      cgtCharged: 6497,
      cgtPaid: 0,
      cgtOutstanding: 6497,
      carryOut: 0,
      dividendGross: 30_000,
      dividendWht: 4500,
      bonusTax: 19_200,
      sellFees: 2208,
      sales: [],
      dividends: [],
      bonuses: [],
    },
  ];

  const transactions = [
    {
      id: "t1",
      date: "2025-01-10",
      type: "BUY" as const,
      ticker: "LUCK",
      name: "Lucky Cement",
      sector: "Materials",
      shares: 150,
      price: 14_800,
      amount: 0,
      note: "opening",
    },
    {
      id: "t2",
      date: "2025-06-10",
      type: "SELL" as const,
      ticker: "LUCK",
      name: "",
      sector: "",
      shares: 30,
      price: 16_000,
      amount: 0,
      note: "trim",
    },
    {
      id: "t3",
      date: "2025-01-01",
      type: "DEPOSIT" as const,
      ticker: "",
      name: "",
      sector: "",
      shares: 0,
      price: 0,
      amount: 5_000_000,
      note: "opening cash",
    },
  ];

  const realized = [
    {
      txnId: "t2",
      ticker: "LUCK",
      sellDate: "2025-06-10",
      buyDate: "2025-01-10",
      shares: 30,
      proceeds: 480_000,
      fees: 800,
      cost: 444_000,
      gain: 35_200,
      cgtRatePct: 15,
      cgt: 5280,
    },
  ];

  const ledgerInput = {
    stocks,
    taxYears,
    transactions,
    realized,
    dividends: [],
    bonusTaxes: [],
    feeConfig: DEFAULT_FEE_CONFIG,
  };

  it("shows the per-stock scoreboard from compact up", () => {
    const md = buildPortfolioSummary(baseInput(ledgerInput), "compact");
    expect(md).toMatch(/## Per-stock P\/L \(net of fees and taxes\)/);
    expect(md).toMatch(/Portfolio net P\/L/);
    // Detail and the trade ledger stay out of compact.
    expect(md).not.toMatch(/## Stock detail/);
    expect(md).not.toMatch(/## Trade ledger/);
  });

  it("adds stock detail, trade ledger and taxes in comprehensive mode", () => {
    const md = buildPortfolioSummary(baseInput(ledgerInput), "comprehensive");
    expect(md).toMatch(/## Per-stock P\/L/);
    expect(md).toMatch(/## Stock detail/);
    expect(md).toMatch(/### LUCK — Lucky Cement/);
    expect(md).toMatch(/## Taxes by fiscal year/);
    expect(md).toMatch(/## Trade ledger/);
    // Every transaction appears in the ledger, cash movements included.
    expect(md).toMatch(/DEPOSIT/);
    expect(md).toMatch(/SELL/);
    // The sale's CGT surfaces in the stock detail's realized-sales table.
    expect(md).toMatch(/2024-25/);
  });

  it("itemizes the sale under its stock's detail block", () => {
    const md = buildPortfolioSummary(baseInput(ledgerInput), "comprehensive");
    const detail = md.slice(md.indexOf("## Stock detail"));
    expect(detail).toMatch(/Sold \| Bought \| Shares/);
  });

  it("omits every ledger section when there is no ledger", () => {
    const md = buildPortfolioSummary(baseInput(), "comprehensive");
    expect(md).not.toMatch(/## Per-stock P\/L/);
    expect(md).not.toMatch(/## Stock detail/);
    expect(md).not.toMatch(/## Trade ledger/);
    expect(md).not.toMatch(/## Taxes by fiscal year/);
  });
});
