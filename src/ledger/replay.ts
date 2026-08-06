// FIFO ledger replay: transactions in, positions / realized gains / cash out.
//
// Pure and deterministic — no clock, no I/O — so the whole engine is unit
// testable and can run identically on the client and (later) the server.
//
// Money is integer paisa throughout. Lot cost is stored as a TOTAL for the
// remaining shares, so slicing a lot subtracts rather than re-multiplies: the
// parcel's cost is conserved exactly, with no rounding leak across partial sells.

import { roundPaisa } from "../money";
import type { FeeConfig } from "./feeConfig";
import { allocateProRata, computeTradeCosts, manualCosts, tradeValue } from "./fees";
import type {
  LedgerIssue,
  LedgerState,
  Lot,
  PositionState,
  RealizedSlice,
  Transaction,
} from "./types";

/** Calendar day of an ISO timestamp — the granularity FIFO and CGT work at. */
export function dayOf(iso: string): string {
  return String(iso ?? "").slice(0, 10);
}

/**
 * Chronological order, ties broken by the entry's position in the input array.
 * Two trades on the same day therefore replay in the order they were entered,
 * which is the only ordering information available.
 */
export function sortTransactions(txns: Transaction[]): Transaction[] {
  return txns
    .map((txn, index) => ({ txn, index }))
    .sort((a, b) => {
      const cmp = dayOf(a.txn.date).localeCompare(dayOf(b.txn.date));
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((entry) => entry.txn);
}

function emptyPosition(ticker: string): PositionState {
  return {
    ticker,
    name: "",
    sector: "",
    lots: [],
    shares: 0,
    cost: 0,
    realized: 0,
    dividends: 0,
    feesPaid: 0,
    taxesPaid: 0,
    invested: 0,
    returned: 0,
    firstDate: "",
    lastDate: "",
  };
}

/** CGT percentage for a lot, chosen by when the shares were acquired. */
export function cgtRateFor(acquisitionDate: string, cfg: FeeConfig): number {
  return dayOf(acquisitionDate) < cfg.cgtLegacyCutoff
    ? cfg.cgtLegacyRatePct
    : cfg.cgtRatePct;
}

export function replayLedger(
  txns: Transaction[],
  cfg: FeeConfig,
): LedgerState {
  const positions = new Map<string, PositionState>();
  const realized: RealizedSlice[] = [];
  const dividends: LedgerState["dividends"] = [];
  const bonusTaxes: LedgerState["bonusTaxes"] = [];
  const taxPayments: LedgerState["taxPayments"] = [];
  const issues: LedgerIssue[] = [];
  let cash = 0;
  let contributions = 0;

  const fail = (txn: Transaction, message: string) => {
    issues.push({
      txnId: txn.id,
      date: dayOf(txn.date),
      ticker: String(txn.ticker ?? "").toUpperCase(),
      message,
    });
  };

  for (const txn of sortTransactions(txns)) {
    const type = txn.type;
    const ticker = String(txn.ticker ?? "").toUpperCase();
    const day = dayOf(txn.date);
    const shares = Number(txn.shares) || 0;
    const price = Number(txn.price) || 0;
    const amount = Number(txn.amount) || 0;

    if (!day) {
      fail(txn, "Missing date — entry skipped.");
      continue;
    }

    if (type === "DEPOSIT" || type === "WITHDRAW" || type === "TAX") {
      if (amount <= 0) {
        fail(txn, "Cash amount must be positive — entry skipped.");
        continue;
      }
      cash += type === "DEPOSIT" ? amount : -amount;
      if (type === "DEPOSIT") contributions += amount;
      else if (type === "WITHDRAW") contributions -= amount;
      if (type === "TAX") {
        taxPayments.push({ txnId: txn.id, date: day, amount, note: txn.note ?? "" });
      }
      if (cash < 0) {
        fail(
          txn,
          type === "TAX"
            ? "Tax payment takes the cash balance negative."
            : "Withdrawal takes the cash balance negative.",
        );
      }
      continue;
    }

    if (!ticker) {
      fail(txn, `${type} needs a ticker — entry skipped.`);
      continue;
    }

    let pos = positions.get(ticker);
    if (!pos) {
      pos = emptyPosition(ticker);
      positions.set(ticker, pos);
    }
    if (txn.name) pos.name = txn.name;
    if (txn.sector) pos.sector = txn.sector;
    if (!pos.firstDate || day < pos.firstDate) pos.firstDate = day;
    if (day > pos.lastDate) pos.lastDate = day;

    switch (type) {
      case "BUY":
      case "RIGHT": {
        if (shares <= 0) {
          fail(txn, `${type} needs a positive share count — entry skipped.`);
          continue;
        }
        // A rights subscription is not a market trade, so it carries no
        // brokerage costs unless the user copies figures off the letter.
        const fees =
          type === "BUY"
            ? computeTradeCosts(shares, price, cfg, txn.feeOverride)
            : manualCosts(txn.feeOverride);
        const cost = tradeValue(shares, price) + fees.total;

        pos.lots.push({ txnId: txn.id, ticker, date: day, shares, cost });
        pos.shares += shares;
        pos.cost += cost;
        pos.feesPaid += fees.total;
        pos.invested += cost;
        cash -= cost;
        break;
      }

      case "SELL": {
        if (shares <= 0) {
          fail(txn, "SELL needs a positive share count — entry skipped.");
          continue;
        }
        if (shares > pos.shares) {
          fail(
            txn,
            `Sell of ${shares} exceeds the ${pos.shares} shares held on ${day} — entry skipped.`,
          );
          continue;
        }

        const value = tradeValue(shares, price);
        const fees = computeTradeCosts(shares, price, cfg, txn.feeOverride);

        // FIFO: consume the oldest lots first, slicing cost proportionally.
        const consumed: { lot: Lot; shares: number; cost: number }[] = [];
        let remaining = shares;
        for (const lot of pos.lots) {
          if (remaining <= 0) break;
          if (lot.shares <= 0) continue;
          const take = Math.min(lot.shares, remaining);
          const sliceCost =
            take === lot.shares ? lot.cost : roundPaisa((lot.cost * take) / lot.shares);
          lot.shares -= take;
          lot.cost -= sliceCost;
          remaining -= take;
          consumed.push({ lot, shares: take, cost: sliceCost });
        }
        pos.lots = pos.lots.filter((lot) => lot.shares > 0);

        const weights = consumed.map((c) => c.shares);
        const proceedsParts = allocateProRata(value, weights);
        const feeParts = allocateProRata(fees.total, weights);

        let cgtTotal = 0;
        let costTotal = 0;
        consumed.forEach((slice, i) => {
          const proceeds = proceedsParts[i];
          const feeShare = feeParts[i];
          const gain = proceeds - feeShare - slice.cost;
          const rate = cgtRateFor(slice.lot.date, cfg);
          const cgt = gain > 0 ? roundPaisa((gain * rate) / 100) : 0;

          cgtTotal += cgt;
          costTotal += slice.cost;
          realized.push({
            txnId: txn.id,
            ticker,
            sellDate: day,
            buyDate: slice.lot.date,
            shares: slice.shares,
            proceeds,
            fees: feeShare,
            cost: slice.cost,
            gain,
            cgtRatePct: rate,
            cgt,
          });
        });

        // Cash follows the broker note: gross less brokerage, nothing else.
        // CGT is accrued, not deducted — NCCPL nets a whole month of gains and
        // losses before collecting anything, so a per-trade deduction would
        // both overstate the bill and leave `cash` unable to reconcile with the
        // statement. It leaves the account via a TAX entry.
        const proceeds = value - fees.total;
        pos.shares -= shares;
        pos.cost -= costTotal;
        // Trading result only. Deducting the per-slice CGT here would charge a
        // gross, pre-netting figure against a position that may owe nothing
        // once the year's losses and any carry-forward are applied — and the
        // money has not left the account either way. The real liability is the
        // netted `cgtDue`, which is a fiscal-year total and cannot be split
        // across positions; `cgtReserve` reports what is still owed.
        pos.realized += proceeds - costTotal;
        pos.feesPaid += fees.total;
        pos.taxesPaid += cgtTotal;
        pos.returned += proceeds;
        cash += proceeds;
        break;
      }

      case "DIVIDEND": {
        // Prefer an explicit gross amount (matches the payout advice); else
        // dividend-per-share × the shares held on the payout date.
        const onRecord = shares > 0 ? shares : pos.shares;
        const gross = amount > 0 ? amount : roundPaisa(onRecord * price);
        if (gross <= 0) {
          fail(txn, "Dividend has no amount and no shares held — entry skipped.");
          continue;
        }
        const wht = roundPaisa((gross * cfg.dividendWhtPct) / 100);
        const net = gross - wht;

        pos.dividends += net;
        pos.taxesPaid += wht;
        pos.returned += net;
        cash += net;
        dividends.push({
          txnId: txn.id,
          ticker,
          date: day,
          shares: onRecord,
          gross,
          wht,
          net,
        });
        break;
      }

      case "BONUS": {
        if (shares <= 0) {
          fail(txn, "BONUS needs a positive share count — entry skipped.");
          continue;
        }
        // Bonus shares enter at ZERO cost, so the position's average cost falls
        // and the free shares show up as gain when sold — the honest view for a
        // portfolio tracker, which has no "income received" concept to credit a
        // basis against. `price` is only the issue value used for the tax.
        const value = tradeValue(shares, price);
        const tax = roundPaisa((value * cfg.bonusTaxPct) / 100);

        pos.lots.push({ txnId: txn.id, ticker, date: day, shares, cost: 0 });
        pos.shares += shares;
        pos.taxesPaid += tax;
        pos.invested += tax;
        cash -= tax;
        bonusTaxes.push({ txnId: txn.id, ticker, date: day, shares, value, tax });
        break;
      }

      case "SPLIT": {
        const from = Number(txn.ratioFrom) || 0;
        const to = Number(txn.ratioTo) || 0;
        if (from <= 0 || to <= 0) {
          fail(txn, "SPLIT needs a positive from:to ratio — entry skipped.");
          continue;
        }
        if (pos.shares <= 0) {
          fail(txn, "SPLIT on a ticker with no open shares — entry skipped.");
          continue;
        }
        // A split changes the share count, never the cost. Distribute the new
        // total across lots pro rata so the sum matches exactly, and keep each
        // lot's acquisition date so its CGT tier survives.
        const newTotal = Math.round((pos.shares * to) / from);
        const parts = allocateProRata(
          newTotal,
          pos.lots.map((lot) => lot.shares),
        );
        pos.lots.forEach((lot, i) => {
          lot.shares = parts[i];
        });
        pos.lots = pos.lots.filter((lot) => lot.shares > 0);
        pos.shares = pos.lots.reduce((s, lot) => s + lot.shares, 0);
        break;
      }

      default:
        fail(txn, `Unknown transaction type "${String(type)}" — entry skipped.`);
    }
  }

  return {
    positions,
    realized,
    dividends,
    bonusTaxes,
    taxPayments,
    contributions,
    cash,
    issues,
  };
}
