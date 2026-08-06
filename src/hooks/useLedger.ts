// Ledger state + everything derived from it, kept out of App.tsx.
//
// The replay is pure, so all derivation is a `useMemo` chain keyed on the
// transactions, the rate config and the current price map. Editing a rate or a
// trade re-derives holdings, per-stock rows and the tax view in one pass.

import { useCallback, useMemo, useState } from "react";
import { createId } from "../utils";
import { pkDateOf } from "../portfolio/calendar";
import type { Holding } from "../types";
import { DEFAULT_FEE_CONFIG, normalizeFeeConfig, type FeeConfig } from "../ledger/feeConfig";
import { replayLedger } from "../ledger/replay";
import { deriveHoldings, ledgerTotals } from "../ledger/deriveHoldings";
import { buildStockRows, type StockLedgerRow } from "../ledger/perStock";
import { buildTaxYears, cgtReserve, type TaxYear } from "../ledger/tax";
import type { LedgerState, Transaction } from "../ledger/types";
import {
  loadFeeConfig,
  loadTransactions,
  saveFeeConfig,
  saveTransactions,
} from "../portfolio/storage";

/** A new entry as the forms build it — the id is assigned here. */
export type TransactionDraft = Omit<Transaction, "id">;

export type LedgerApi = {
  transactions: Transaction[];
  feeConfig: FeeConfig;
  state: LedgerState;
  stockRows: StockLedgerRow[];
  taxYears: TaxYear[];
  totals: ReturnType<typeof ledgerTotals>;
  /** Holdings to render: ledger-derived once the ledger exists, else the stored rows. */
  holdings: Holding[];
  /** paisa — cash implied by the ledger; reconciles with the broker statement */
  cash: number;
  /** paisa — CGT accrued but not yet debited by NCCPL, held against `cash` */
  cgtReserve: number;
  /** false until the first transaction is recorded (pre-migration state) */
  hasLedger: boolean;
  addTransaction: (draft: TransactionDraft) => Transaction;
  addTransactions: (drafts: TransactionDraft[]) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  replaceTransactions: (next: Transaction[]) => void;
  updateFeeConfig: (patch: Partial<FeeConfig>) => void;
  replaceFeeConfig: (next: unknown) => void;
};

/**
 * @param storedHoldings rows carrying scraped market data (price, day change,
 *   payouts). Share counts and cost basis on them are ignored once the ledger
 *   has entries.
 */
export function useLedger(storedHoldings: Holding[]): LedgerApi {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(() => loadFeeConfig());

  const persistTransactions = useCallback((next: Transaction[]) => {
    setTransactions(next);
    saveTransactions(next);
  }, []);

  const state = useMemo(
    () => replayLedger(transactions, feeConfig),
    [transactions, feeConfig],
  );

  const priceByTicker = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of storedHoldings) {
      if (h.id.startsWith("cash-")) continue;
      if (h.price > 0) map.set(h.ticker.toUpperCase(), h.price);
    }
    return map;
  }, [storedHoldings]);

  const hasLedger = transactions.length > 0;

  const holdings = useMemo(
    () => (hasLedger ? deriveHoldings(state, storedHoldings) : storedHoldings),
    [hasLedger, state, storedHoldings],
  );

  const stockRows = useMemo(
    () => buildStockRows(state, priceByTicker, feeConfig, pkDateOf(new Date().toISOString())),
    [state, priceByTicker, feeConfig],
  );

  const taxYears = useMemo(() => buildTaxYears(state, feeConfig), [state, feeConfig]);

  const reserve = useMemo(() => cgtReserve(taxYears), [taxYears]);

  const totals = useMemo(() => ledgerTotals(state, priceByTicker), [state, priceByTicker]);

  const addTransaction = useCallback(
    (draft: TransactionDraft) => {
      const txn: Transaction = { ...draft, id: createId() };
      persistTransactions([...transactions, txn]);
      return txn;
    },
    [transactions, persistTransactions],
  );

  const addTransactions = useCallback(
    (drafts: TransactionDraft[]) => {
      if (drafts.length === 0) return;
      persistTransactions([
        ...transactions,
        ...drafts.map((draft) => ({ ...draft, id: createId() })),
      ]);
    },
    [transactions, persistTransactions],
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) => {
      persistTransactions(
        transactions.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
      );
    },
    [transactions, persistTransactions],
  );

  const removeTransaction = useCallback(
    (id: string) => {
      persistTransactions(transactions.filter((t) => t.id !== id));
    },
    [transactions, persistTransactions],
  );

  const replaceTransactions = useCallback(
    (next: Transaction[]) => persistTransactions(next),
    [persistTransactions],
  );

  const replaceFeeConfig = useCallback((next: unknown) => {
    const normalized = normalizeFeeConfig(next);
    setFeeConfig(normalized);
    saveFeeConfig(normalized);
  }, []);

  const updateFeeConfig = useCallback(
    (patch: Partial<FeeConfig>) => {
      const normalized = normalizeFeeConfig({ ...feeConfig, ...patch });
      setFeeConfig(normalized);
      saveFeeConfig(normalized);
    },
    [feeConfig],
  );

  return {
    transactions,
    feeConfig,
    state,
    stockRows,
    taxYears,
    totals,
    holdings,
    cash: state.cash,
    cgtReserve: reserve,
    hasLedger,
    addTransaction,
    addTransactions,
    updateTransaction,
    removeTransaction,
    replaceTransactions,
    updateFeeConfig,
    replaceFeeConfig,
  };
}

export { DEFAULT_FEE_CONFIG };
