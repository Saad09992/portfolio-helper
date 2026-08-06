import { describe, expect, it } from "vitest";
import { buildLedgerSummary } from "./summary";
import { buildStockRows } from "./perStock";
import { replayLedger } from "./replay";
import { DEFAULT_FEE_CONFIG } from "./feeConfig";
import {
  partiallySoldTransactions,
  mixedPrices,
  mixedTransactions,
} from "./testFixtures";

const AS_OF = "2026-01-01";

function rowsFor(txns = mixedTransactions, prices = mixedPrices) {
  const state = replayLedger(txns, DEFAULT_FEE_CONFIG);
  return buildStockRows(state, prices, DEFAULT_FEE_CONFIG, AS_OF);
}

describe("buildLedgerSummary", () => {
  it("reports not-ready zeros for an empty ledger", () => {
    const s = buildLedgerSummary([]);
    expect(s.ready).toBe(false);
    expect(s.netTotal).toBe(0);
    expect(s.netReturnPct).toBe(0);
    expect(s.feeDragPct).toBe(0);
    expect(s.topContributor).toBeUndefined();
    expect(s.worstContributor).toBeUndefined();
  });

  it("does NOT subtract fees or taxes a second time", () => {
    // The regression this whole module exists to prevent. `realized` is already
    // net of sell fees and accrued CGT, and `dividends` is already net of
    // withholding, so the headline is a plain sum of the three components.
    // Subtracting feesPaid/taxesBooked again would double-count every cost.
    const rows = rowsFor();
    const s = buildLedgerSummary(rows);

    expect(s.netTotal).toBe(s.realized + s.unrealized + s.dividends);
    expect(s.feesPaid).toBeGreaterThan(0);
    expect(s.netTotal).not.toBe(
      s.realized + s.unrealized + s.dividends - s.feesPaid - s.taxesBooked,
    );
  });

  it("matches a straight reduce over the per-stock rows", () => {
    const rows = rowsFor();
    const s = buildLedgerSummary(rows);
    const sum = (pick: (r: (typeof rows)[number]) => number) =>
      rows.reduce((acc, r) => acc + pick(r), 0);

    expect(s.realized).toBe(sum((r) => r.realized));
    expect(s.unrealized).toBe(sum((r) => r.unrealized));
    expect(s.dividends).toBe(sum((r) => r.dividends));
    expect(s.feesPaid).toBe(sum((r) => r.feesPaid));
    expect(s.taxesBooked).toBe(sum((r) => r.taxesPaid));
    expect(s.invested).toBe(sum((r) => r.invested));
    expect(s.returned).toBe(sum((r) => r.returned));
    expect(s.netIfSoldToday).toBe(sum((r) => r.netIfSoldToday));
    expect(s.netTotal).toBe(sum((r) => r.totalNet));
  });

  it("splits open and closed positions", () => {
    const s = buildLedgerSummary(rowsFor());
    // LUCK and OGDC are sold out; ENGRO is still held.
    expect(s.openPositions).toBe(1);
    expect(s.closedPositions).toBe(2);
    expect(s.unrealized).not.toBe(0);
  });

  it("computes win rate over realized slices", () => {
    const rows = rowsFor();
    const s = buildLedgerSummary(rows);
    expect(s.closedTrades).toBe(
      rows.reduce((acc, r) => acc + r.closed.count, 0),
    );
    // One winning sale (LUCK), one losing sale (OGDC).
    expect(s.wins).toBe(1);
    expect(s.closedTrades).toBe(2);
    expect(s.winRatePct).toBeCloseTo(50, 6);
    expect(s.bestTrade).toBeGreaterThan(0);
    expect(s.worstTrade).toBeLessThan(0);
  });

  it("ranks the best and worst contributor by net P&L", () => {
    const s = buildLedgerSummary(rowsFor());
    // ENGRO tops it on unrealized gain plus dividends, ahead of LUCK's realized
    // profit — the ranking is on total net, not on realized alone.
    expect(s.topContributor?.ticker).toBe("ENGRO");
    expect(s.worstContributor?.ticker).toBe("OGDC");
    expect(s.topContributor!.totalNet).toBeGreaterThan(
      s.worstContributor!.totalNet,
    );
  });

  it("expresses return and fee drag against capital contributed", () => {
    const contributions = 500_000;
    const s = buildLedgerSummary(rowsFor(), contributions);
    expect(s.contributions).toBe(contributions);
    expect(s.netReturnPct).toBeCloseTo((s.netTotal / contributions) * 100, 6);
    expect(s.feeDragPct).toBeCloseTo(
      ((s.feesPaid + s.taxesBooked) / contributions) * 100,
      6,
    );
    expect(s.feeDragPct).toBeGreaterThan(0);
  });

  /**
   * `invested` sums what every buy cost, so recycling the same money inflates
   * it without any new capital arriving. Dividing by it would shrink a return
   * in proportion to how often the account trades.
   */
  it("does not measure return against turnover", () => {
    const contributions = 500_000;
    const s = buildLedgerSummary(rowsFor(), contributions);
    expect(s.invested).toBeGreaterThan(contributions);
    expect(s.netReturnPct).not.toBeCloseTo((s.netTotal / s.invested) * 100, 6);
  });

  it("reports zero percentages rather than dividing by no capital", () => {
    const s = buildLedgerSummary(rowsFor(), 0);
    expect(s.netReturnPct).toBe(0);
    expect(s.feeDragPct).toBe(0);
  });

  it("still reconciles on a partially-sold position", () => {
    // The oversized SELL in this fixture is rejected outright rather than
    // clamped, so 70 shares stay open and carry unrealized P&L alongside the
    // realized slice and the dividend.
    const s = buildLedgerSummary(
      rowsFor(partiallySoldTransactions, new Map([["LUCK", 16_500]])),
    );
    expect(s.ready).toBe(true);
    expect(s.openPositions).toBe(1);
    expect(s.closedPositions).toBe(0);
    expect(s.unrealized).toBeGreaterThan(0);
    // Exit costs make the after-liquidation figure strictly worse.
    expect(s.netIfSoldToday).toBeLessThan(s.unrealized);
    expect(s.netTotal).toBe(s.realized + s.unrealized + s.dividends);
  });
});
