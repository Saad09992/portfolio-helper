// Server-side smoke render of the ledger UI. Catches the runtime mistakes types
// can't: a bad map access, a missing guard on an empty ledger, a nullish field
// dereferenced during render.
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LedgerPage } from "./LedgerPage";
import { StocksPage } from "./StocksPage";
import { TaxPage } from "./TaxPage";
import { SettingsPage } from "./SettingsPage";
import { HoldingsPage } from "./HoldingsPage";
import { IncomePage } from "./IncomePage";
import { deriveHoldings } from "../ledger/deriveHoldings";
import { computePortfolio } from "../utils";
import { replayLedger } from "../ledger/replay";
import { buildStockRows } from "../ledger/perStock";
import { buildTaxYears } from "../ledger/tax";
import { DEFAULT_FEE_CONFIG } from "../ledger/feeConfig";
import type { Transaction, TxnType } from "../ledger/types";
import type { Holding } from "../types";

const txn = (
  o: Partial<Transaction> & { id: string; date: string; type: TxnType },
): Transaction => ({
  ticker: "",
  name: "",
  sector: "",
  shares: 0,
  price: 0,
  amount: 0,
  note: "",
  ...o,
});

const transactions: Transaction[] = [
  txn({ id: "d1", date: "2025-01-01", type: "DEPOSIT", amount: 5_000_000 }),
  txn({ id: "b1", date: "2025-01-10", type: "BUY", ticker: "LUCK", name: "Lucky Cement", sector: "Materials", shares: 100, price: 14500 }),
  txn({ id: "s1", date: "2025-06-10", type: "SELL", ticker: "LUCK", shares: 30, price: 16000 }),
  txn({ id: "v1", date: "2025-07-10", type: "DIVIDEND", ticker: "LUCK", price: 250 }),
  txn({ id: "x1", date: "2025-08-10", type: "SELL", ticker: "LUCK", shares: 9999, price: 16000 }),
];

const state = replayLedger(transactions, DEFAULT_FEE_CONFIG);
const stockRows = buildStockRows(
  state,
  new Map([["LUCK", 16_500]]),
  DEFAULT_FEE_CONFIG,
  "2026-07-23",
);
const taxYears = buildTaxYears(state, DEFAULT_FEE_CONFIG);

const storedHolding: Holding = {
  id: "h1",
  ticker: "OGDC",
  name: "Oil & Gas Development Co.",
  sector: "Energy",
  account: "PSX",
  shares: 500,
  price: 14_620,
  costBasis: 12_840,
  dayChangePct: 1.2,
  dividendPerShare: 0,
  payoutDate: "",
};

const noop = () => {};

describe("LedgerPage", () => {
  it("renders entries, the issue banner and the cash balance", () => {
    const html = renderToString(
      <LedgerPage
        transactions={transactions}
        feeConfig={DEFAULT_FEE_CONFIG}
        state={state}
        cash={state.cash}
        hasLedger
        storedHoldings={[storedHolding]}
        storedCash={0}
        today="2026-07-23"
        addTransaction={noop}
        addTransactions={noop}
        removeTransaction={noop}
      />,
    );
    expect(html).toContain("LUCK");
    expect(html).toContain("could not");   // the oversell issue banner
    expect(html).toContain("Cash:");
  });

  it("offers the one-time migration when the ledger is empty", () => {
    const empty = replayLedger([], DEFAULT_FEE_CONFIG);
    const html = renderToString(
      <LedgerPage
        transactions={[]}
        feeConfig={DEFAULT_FEE_CONFIG}
        state={empty}
        cash={0}
        hasLedger={false}
        storedHoldings={[storedHolding]}
        storedCash={250_000}
        today="2026-07-23"
        addTransaction={noop}
        addTransactions={noop}
        removeTransaction={noop}
      />,
    );
    expect(html).toContain("Import current positions");
    expect(html).toContain("OGDC");
    expect(html).toContain("No entries yet");
  });
});

describe("StocksPage", () => {
  it("renders a row per traded stock", () => {
    const html = renderToString(
      <StocksPage stockRows={stockRows} state={state} transactions={transactions} />,
    );
    expect(html).toContain("LUCK");
    expect(html).toContain("Net P&amp;L");
  });

  it("shows an empty state with no ledger", () => {
    const empty = replayLedger([], DEFAULT_FEE_CONFIG);
    const html = renderToString(
      <StocksPage stockRows={[]} state={empty} transactions={[]} />,
    );
    expect(html).toContain("No stocks tracked yet");
  });
});

describe("TaxPage", () => {
  it("renders the latest fiscal year by default", () => {
    const html = renderToString(<TaxPage taxYears={taxYears} />);
    expect(html).toContain("FY ");
    expect(html).toContain("CGT due");
  });

  it("shows an empty state with no realized activity", () => {
    expect(renderToString(<TaxPage taxYears={[]} />)).toContain("Nothing to report yet");
  });
});

describe("SettingsPage", () => {
  it("renders the rate form and the worked example", () => {
    const html = renderToString(
      <SettingsPage
        feeConfig={DEFAULT_FEE_CONFIG}
        updateFeeConfig={noop}
        replaceFeeConfig={noop}
      />,
    );
    expect(html).toContain("Brokerage");
    expect(html).toContain("Worked example");
    expect(html).toContain("Commission");
  });
});

describe("HoldingsPage under the ledger", () => {
  const derived = computePortfolio(deriveHoldings(state)).holdings;

  it("renders positions read-only with the ledger columns", () => {
    const html = renderToString(
      <HoldingsPage
        draft={{
          ticker: "",
          name: "",
          sector: "",
          shares: 0,
          price: 0,
          costBasis: 0,
          dayChangePct: 0,
          dividendPerShare: 0,
          payoutDate: "",
        }}
        setDraft={noop}
        draftError=""
        addManualHolding={noop}
        holdingsSearch=""
        setHoldingsSearch={noop}
        sortedHoldings={derived}
        holdingsSort={{ key: null, dir: "desc" }}
        toggleSort={noop}
        updateHoldingShares={noop}
        updateHoldingCostBasis={noop}
        removeHolding={noop}
        quoteSources={{}}
        ledgerActive
        stockRows={stockRows}
        onOpenLedger={noop}
      />,
    );
    expect(html).toContain("derived from your trade ledger");
    expect(html).toContain("Realized");
    // No inline editors once the ledger owns the numbers.
    expect(html).not.toContain("Edit shares");
  });

  it("keeps the manual quick-add before the ledger exists", () => {
    const html = renderToString(
      <HoldingsPage
        draft={{
          ticker: "",
          name: "",
          sector: "",
          shares: 0,
          price: 0,
          costBasis: 0,
          dayChangePct: 0,
          dividendPerShare: 0,
          payoutDate: "",
        }}
        setDraft={noop}
        draftError=""
        holdingsSearch=""
        addManualHolding={noop}
        setHoldingsSearch={noop}
        sortedHoldings={derived}
        holdingsSort={{ key: null, dir: "desc" }}
        toggleSort={noop}
        updateHoldingShares={noop}
        updateHoldingCostBasis={noop}
        removeHolding={noop}
        quoteSources={{}}
        ledgerActive={false}
        stockRows={[]}
        onOpenLedger={noop}
      />,
    );
    expect(html).toContain("Manual holding");
    expect(html).toContain("Edit shares");
  });
});

describe("IncomePage", () => {
  it("shows the derived balance and cash entry once the ledger is active", () => {
    const html = renderToString(
      <IncomePage
        cashDraft={{ available: 0 }}
        setCashDraft={noop}
        cashError=""
        saveCashBuckets={noop}
        ledgerActive
        ledgerCash={state.cash}
        today="2026-07-23"
        addCashEntry={noop}
      />,
    );
    expect(html).toContain("Derived from the ledger");
    expect(html).toContain("Record deposit");
  });

  it("keeps the manual cash field before the ledger exists", () => {
    const html = renderToString(
      <IncomePage
        cashDraft={{ available: 12_345 }}
        setCashDraft={noop}
        cashError=""
        saveCashBuckets={noop}
        ledgerActive={false}
        ledgerCash={0}
        today="2026-07-23"
        addCashEntry={noop}
      />,
    );
    expect(html).toContain("Update cash");
  });
});
