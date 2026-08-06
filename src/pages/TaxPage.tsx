import { useState } from "react";
import type { DividendReceipt, RealizedSlice } from "../ledger/types";
import type { TaxYear } from "../ledger/tax";
import { LOSS_CARRY_FORWARD_YEARS } from "../ledger/tax";
import type { TableStore } from "../hooks/useTableView";
import { useTableView } from "../hooks/useTableView";
import { METRIC_INFO } from "../metricInfo";
import type { ChipOption } from "../components/ui/ChipGroup";
import { ChipGroup } from "../components/ui/ChipGroup";
import { InfoTip } from "../components/ui/InfoTip";
import { Pagination } from "../components/ui/Pagination";
import { SortHeader } from "../components/ui/SortHeader";
import type { TableSpec } from "../table/tableView";
import { formatCurrency, formatDateShort } from "../utils";
import { taxHref } from "../routes";

export type TaxPageProps = {
  taxYears: TaxYear[];
  /**
   * Selected fiscal year. Optional so the page still works uncontrolled — see
   * StocksPage. Navigation itself happens through the chip anchors, so there is
   * no onSelect counterpart.
   */
  selectedFy?: string | null;
  /** Omit and the tables' view state stays local instead of in the URL. */
  tableStore?: TableStore;
};

const signed = (paisa: number) =>
  `${paisa > 0 ? "+" : paisa < 0 ? "-" : ""}${formatCurrency(Math.abs(paisa))}`;

type SaleSortKey =
  | "sellDate"
  | "ticker"
  | "buyDate"
  | "shares"
  | "proceeds"
  | "cost"
  | "gain"
  | "cgtRatePct"
  | "cgt";

const SALES_SPEC: TableSpec<RealizedSlice, SaleSortKey> = {
  columns: [
    { key: "sellDate", label: "Sold", value: (r) => r.sellDate },
    { key: "ticker", label: "Ticker", value: (r) => r.ticker, defaultDir: "asc" },
    { key: "buyDate", label: "Acquired", value: (r) => r.buyDate },
    { key: "shares", label: "Shares", value: (r) => r.shares, align: "right" },
    { key: "proceeds", label: "Proceeds", value: (r) => r.proceeds, align: "right" },
    { key: "cost", label: "Cost", value: (r) => r.cost, align: "right" },
    { key: "gain", label: "Gain", value: (r) => r.gain, align: "right" },
    { key: "cgtRatePct", label: "Rate", value: (r) => r.cgtRatePct, align: "right" },
    { key: "cgt", label: "CGT", value: (r) => r.cgt, align: "right" },
  ],
  search: (r) => [r.ticker],
};

const OUTCOME_OPTIONS: readonly ChipOption<"all" | "gains" | "losses">[] = [
  { value: "all", label: "All" },
  { value: "gains", label: "Gains" },
  { value: "losses", label: "Losses" },
];

const SALES_FILTERS = {
  keys: ["out"] as const,
  toPredicates: (filters: Record<string, string>) => {
    if (filters.out === "gains") return [(r: RealizedSlice) => r.gain > 0];
    if (filters.out === "losses") return [(r: RealizedSlice) => r.gain < 0];
    return [];
  },
};

type DividendSortKey = "date" | "ticker" | "shares" | "gross" | "wht" | "net";

const DIVIDEND_SPEC: TableSpec<DividendReceipt, DividendSortKey> = {
  columns: [
    { key: "date", label: "Date", value: (r) => r.date },
    { key: "ticker", label: "Ticker", value: (r) => r.ticker, defaultDir: "asc" },
    { key: "shares", label: "Shares", value: (r) => r.shares, align: "right" },
    { key: "gross", label: "Gross", value: (r) => r.gross, align: "right" },
    { key: "wht", label: "Withheld", value: (r) => r.wht, align: "right" },
    { key: "net", label: "Net", value: (r) => r.net, align: "right" },
  ],
  search: (r) => [r.ticker],
};

// Stable empties, so the hooks can run before the empty-state return without
// handing a fresh array to the memo on every render.
const NO_SALES: RealizedSlice[] = [];
const NO_DIVIDENDS: DividendReceipt[] = [];

export function TaxPage({
  taxYears,
  selectedFy: selectedFyProp,
  tableStore,
}: TaxPageProps) {
  const latest = taxYears[taxYears.length - 1];
  const [localFy, setLocalFy] = useState<string | null>(null);
  const selectedFy = selectedFyProp !== undefined ? selectedFyProp : localFy;
  const year = taxYears.find((y) => y.fy === selectedFy) ?? latest;

  // Hooks run before the empty-state return, so they see stable empty arrays
  // rather than being called conditionally. `resetKey` clears search and paging
  // when the user switches fiscal year — a different year is a different dataset.
  const salesView = useTableView<RealizedSlice, SaleSortKey>(
    year?.sales ?? NO_SALES,
    SALES_SPEC,
    {
      store: tableStore,
      ns: "tx",
      defaultSort: { key: "sellDate", dir: "desc" },
      filters: SALES_FILTERS,
      resetKey: year?.fy ?? null,
    },
  );

  const dividendsView = useTableView<DividendReceipt, DividendSortKey>(
    year?.dividends ?? NO_DIVIDENDS,
    DIVIDEND_SPEC,
    { ns: "dv", defaultSort: { key: "date", dir: "desc" }, resetKey: year?.fy ?? null },
  );

  if (!year) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Tax</p>
            <h2>Nothing to report yet</h2>
          </div>
        </div>
        <p className="empty-state">
          Sales, dividends and bonus issues recorded on the Ledger tab are
          grouped into Pakistani tax years (1 July – 30 June) here.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Tax year</p>
            <h2>
              FY {year.fy} · {formatDateShort(year.startDate)} –{" "}
              {formatDateShort(year.endDate)}
            </h2>
          </div>
          {/* Anchors so a tax year is linkable; the onClick keeps the page working
              when it's rendered uncontrolled (no `selectedFy` prop). */}
          <div className="chip-group" role="group" aria-label="Tax year">
            {taxYears.map((y) => (
              <a
                key={y.fy}
                className={`chip ${y.fy === year.fy ? "chip--active" : ""}`}
                href={taxHref(y.fy)}
                aria-current={y.fy === year.fy ? "true" : undefined}
                onClick={() => setLocalFy(y.fy)}
              >
                {y.fy}
              </a>
            ))}
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-tile">
            <p>Realized gains</p>
            <strong className="num positive">{formatCurrency(year.gains)}</strong>
            <span>before any set-off</span>
          </div>
          <div className="kpi-tile">
            <p>Realized losses</p>
            <strong className="num negative">{formatCurrency(year.losses)}</strong>
            <span>this year</span>
          </div>
          <div className="kpi-tile">
            <p>
              Carried in
              <InfoTip
                title="Loss carry-forward"
                what={METRIC_INFO.cgtCarryForward.what}
                reading={METRIC_INFO.cgtCarryForward.reading}
              />
            </p>
            <strong className="num">{formatCurrency(year.carryIn)}</strong>
            <span>losses from earlier years</span>
          </div>
          <div className="kpi-tile">
            <p>Taxable gain</p>
            <strong className="num">{formatCurrency(year.taxable)}</strong>
            <span>after {formatCurrency(year.offsetUsed)} set off</span>
          </div>
          <div className="kpi-tile">
            <p>CGT due</p>
            <strong className="num">{formatCurrency(year.cgtDue)}</strong>
            <span>at {year.effectiveRatePct.toFixed(2)}% blended</span>
          </div>
          <div className="kpi-tile">
            <p>Gross CGT</p>
            <strong className="num">{formatCurrency(year.cgtCharged)}</strong>
            <span>accrued before set-off</span>
          </div>
          <div className="kpi-tile">
            <p>CGT paid</p>
            <strong className="num">{formatCurrency(year.cgtPaid)}</strong>
            <span>debited by NCCPL</span>
          </div>
          <div className="kpi-tile">
            <p>
              {year.cgtOutstanding >= 0 ? "Still owed" : "Overpaid"}
              <InfoTip
                title="Outstanding CGT"
                what={METRIC_INFO.cgtOutstanding.what}
                reading={METRIC_INFO.cgtOutstanding.reading}
              />
            </p>
            <strong className={`num ${year.cgtOutstanding > 0 ? "negative" : "positive"}`}>
              {formatCurrency(Math.abs(year.cgtOutstanding))}
            </strong>
            <span>due less paid</span>
          </div>
          <div className="kpi-tile">
            <p>Carried out</p>
            <strong className="num">{formatCurrency(year.carryOut)}</strong>
            <span>expires after {LOSS_CARRY_FORWARD_YEARS} years</span>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-tile">
            <p>Dividends received</p>
            <strong className="num">{formatCurrency(year.dividendGross)}</strong>
            <span>{formatCurrency(year.dividendWht)} withheld</span>
          </div>
          <div className="kpi-tile">
            <p>Bonus share tax</p>
            <strong className="num">{formatCurrency(year.bonusTax)}</strong>
            <span>on issue value</span>
          </div>
          <div className="kpi-tile">
            <p>Brokerage on sales</p>
            <strong className="num">{formatCurrency(year.sellFees)}</strong>
            <span>fees and statutory charges</span>
          </div>
          <div className="kpi-tile">
            <p>Total tax</p>
            <strong className="num">
              {formatCurrency(year.cgtDue + year.dividendWht + year.bonusTax)}
            </strong>
            <span>CGT + withholding + bonus</span>
          </div>
        </div>

        <p className="muted-note">
          CGT is estimated from your own ledger using FIFO lot matching and the
          rates on the Settings tab. NCCPL computes the official figure; treat
          this as a close check, not a filing. Nothing is deducted from your cash
          when you sell — record each NCCPL debit as a <strong>Tax</strong> entry
          on the Ledger tab and the amount still owed falls to match.
        </p>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">FY {year.fy}</p>
            <h2>Sales</h2>
          </div>
          <span className="panel-meta">
            {salesView.active
              ? `${salesView.total} of ${year.sales.length} matched lots`
              : `${year.sales.length} matched lots`}
          </span>
        </div>

        {/* Gated on the unfiltered set: filtering down to nothing must show "no
            matches", not make the whole panel disappear. */}
        {year.sales.length > 0 ? (
          <div className="table-controls table-controls--stacked">
            <input
              type="text"
              className="table-search"
              placeholder="Search ticker..."
              value={salesView.query}
              onChange={(e) => salesView.setQuery(e.target.value)}
            />
            <ChipGroup
              options={OUTCOME_OPTIONS}
              value={(salesView.filters.out as "all" | "gains" | "losses") ?? "all"}
              onChange={(next) => salesView.setFilter("out", next === "all" ? null : next)}
              ariaLabel="Filter by outcome"
            />
          </div>
        ) : null}

        {/* The year's figures above are whole-year and never narrow with the
            table. Saying so prevents reading a filtered CGT column as a changed
            tax bill. */}
        {salesView.active ? (
          <p className="muted-note">
            Filters apply to this table only — the figures above cover the whole
            year.
          </p>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {SALES_SPEC.columns.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    sortKey={column.key}
                    sort={salesView.sort}
                    onClick={salesView.toggleSort}
                    align={column.align}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {salesView.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    {year.sales.length === 0 ? "No sales in this tax year." : "No matches."}
                  </td>
                </tr>
              ) : (
                salesView.rows.map((slice, i) => (
                  <tr key={`${slice.txnId}-${i}`}>
                    <td>{formatDateShort(slice.sellDate)}</td>
                    <td>{slice.ticker}</td>
                    <td>{formatDateShort(slice.buyDate)}</td>
                    <td className="right num">{slice.shares.toLocaleString()}</td>
                    <td className="right num">{formatCurrency(slice.proceeds)}</td>
                    <td className="right num">{formatCurrency(slice.cost)}</td>
                    <td className={`right num ${slice.gain >= 0 ? "positive" : "negative"}`}>
                      {signed(slice.gain)}
                    </td>
                    <td className="right num">{slice.cgtRatePct}%</td>
                    <td className="right num">{formatCurrency(slice.cgt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          label="Tax year sales"
          page={salesView.page}
          pageCount={salesView.pageCount}
          pageSize={salesView.pageSize}
          from={salesView.from}
          to={salesView.to}
          total={salesView.total}
          onPage={salesView.setPage}
          onPageSize={salesView.setPageSize}
        />
      </section>

      {year.dividends.length > 0 ? (
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">FY {year.fy}</p>
              <h2>Dividends</h2>
            </div>
            <span className="panel-meta">
              {dividendsView.active
                ? `${dividendsView.total} of ${year.dividends.length} received`
                : `${year.dividends.length} received`}
            </span>
          </div>

          {year.dividends.length > 1 ? (
            <div className="table-controls table-controls--stacked">
              <input
                type="text"
                className="table-search"
                placeholder="Search ticker..."
                value={dividendsView.query}
                onChange={(e) => dividendsView.setQuery(e.target.value)}
              />
            </div>
          ) : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {DIVIDEND_SPEC.columns.map((column) => (
                    <SortHeader
                      key={column.key}
                      label={column.label}
                      sortKey={column.key}
                      sort={dividendsView.sort}
                      onClick={dividendsView.toggleSort}
                      align={column.align}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {dividendsView.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No matches.
                    </td>
                  </tr>
                ) : (
                  dividendsView.rows.map((receipt) => (
                    <tr key={receipt.txnId}>
                      <td>{formatDateShort(receipt.date)}</td>
                      <td>{receipt.ticker}</td>
                      <td className="right num">{receipt.shares.toLocaleString()}</td>
                      <td className="right num">{formatCurrency(receipt.gross)}</td>
                      <td className="right num">{formatCurrency(receipt.wht)}</td>
                      <td className="right num">{formatCurrency(receipt.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            label="Tax year dividends"
            page={dividendsView.page}
            pageCount={dividendsView.pageCount}
            pageSize={dividendsView.pageSize}
            from={dividendsView.from}
            to={dividendsView.to}
            total={dividendsView.total}
            onPage={dividendsView.setPage}
            onPageSize={dividendsView.setPageSize}
          />
        </section>
      ) : null}
    </>
  );
}
