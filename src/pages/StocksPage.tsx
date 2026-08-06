import { useMemo, useState } from "react";
import type { LedgerState, RealizedSlice, Transaction } from "../ledger/types";
import type { StockLedgerRow } from "../ledger/perStock";
import type { TableStore } from "../hooks/useTableView";
import { useTableView } from "../hooks/useTableView";
import { TABLE } from "../constants";
import { METRIC_INFO } from "../metricInfo";
import { pageHref, stockHref } from "../routes";
import type { ChipOption } from "../components/ui/ChipGroup";
import { ChipGroup } from "../components/ui/ChipGroup";
import { InfoTip } from "../components/ui/InfoTip";
import { Pagination } from "../components/ui/Pagination";
import { SortHeader } from "../components/ui/SortHeader";
import type { TableSpec } from "../table/tableView";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateShort,
  formatSignedPercent,
} from "../utils";

export type StocksPageProps = {
  stockRows: StockLedgerRow[];
  state: LedgerState;
  transactions: Transaction[];
  /**
   * Selected ticker. Optional so the page still works uncontrolled — omit both
   * props and selection stays local, which is what the smoke tests rely on.
   */
  selected?: string | null;
  onSelect?: (ticker: string | null) => void;
  /** Omit and the table's view state stays local instead of in the URL. */
  tableStore?: TableStore;
};

type StockSortKey =
  | "ticker"
  | "shares"
  | "avgCost"
  | "price"
  | "marketValue"
  | "unrealized"
  | "realized"
  | "dividends"
  | "totalNet"
  | "totalReturnPct"
  | "feeDragPct";

/** Module-level: closes over nothing, so it stays referentially stable. */
const STOCK_SPEC: TableSpec<StockLedgerRow, StockSortKey> = {
  columns: [
    { key: "ticker", label: "Ticker", value: (r) => r.ticker, defaultDir: "asc" },
    { key: "shares", label: "Shares", value: (r) => r.shares || null, align: "right" },
    { key: "avgCost", label: "Avg cost", value: (r) => r.avgCost || null, align: "right" },
    { key: "price", label: "Price", value: (r) => r.price || null, align: "right" },
    { key: "marketValue", label: "Market value", value: (r) => r.marketValue, align: "right" },
    { key: "unrealized", label: "Unrealized", value: (r) => r.unrealized, align: "right" },
    { key: "realized", label: "Realized", value: (r) => r.realized, align: "right" },
    { key: "dividends", label: "Dividends", value: (r) => r.dividends, align: "right" },
    { key: "totalNet", label: "Net P&L", value: (r) => r.totalNet, align: "right" },
    { key: "totalReturnPct", label: "Return", value: (r) => r.totalReturnPct, align: "right" },
    { key: "feeDragPct", label: "Fee drag", value: (r) => r.feeDragPct, align: "right" },
  ],
  // Name and sector aren't columns but are worth searching — a superset of the
  // visible fields is the point of a search box.
  search: (r) => [r.ticker, r.name, r.sector],
};

const POSITION_OPTIONS: readonly ChipOption<"all" | "open" | "closed">[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

function stockPredicates(filters: Record<string, string>) {
  if (filters.pos === "open") return [(r: StockLedgerRow) => !r.isClosed];
  if (filters.pos === "closed") return [(r: StockLedgerRow) => r.isClosed];
  return [];
}

const STOCK_FILTERS = {
  keys: ["pos"] as const,
  toPredicates: stockPredicates,
};

// ── Stock detail sub-tables ──────────────────────────────────────────────────
// All local state: a URL param per nested table would be param soup, and these
// are scoped to whichever stock is open.

/** A lot plus the derived columns the table shows, so sorting can reach them. */
type LotRow = {
  key: string;
  date: string;
  shares: number;
  cost: number;
  costPerShare: number;
  value: number;
  unrealized: number;
};

type LotSortKey = "date" | "shares" | "cost" | "costPerShare" | "value" | "unrealized";

const LOT_SPEC: TableSpec<LotRow, LotSortKey> = {
  columns: [
    // FIFO order is information, so acquisition date ascending is the default.
    { key: "date", label: "Acquired", value: (r) => r.date, defaultDir: "asc" },
    { key: "shares", label: "Shares", value: (r) => r.shares, align: "right" },
    { key: "cost", label: "Cost", value: (r) => r.cost, align: "right" },
    { key: "costPerShare", label: "Cost / share", value: (r) => r.costPerShare, align: "right" },
    { key: "value", label: "Value now", value: (r) => r.value, align: "right" },
    { key: "unrealized", label: "Unrealized", value: (r) => r.unrealized, align: "right" },
  ],
};

type DetailSaleSortKey =
  | "sellDate"
  | "buyDate"
  | "shares"
  | "proceeds"
  | "cost"
  | "fees"
  | "gain"
  | "cgt";

const DETAIL_SALES_SPEC: TableSpec<RealizedSlice, DetailSaleSortKey> = {
  columns: [
    { key: "sellDate", label: "Sold", value: (r) => r.sellDate },
    { key: "buyDate", label: "Bought", value: (r) => r.buyDate },
    { key: "shares", label: "Shares", value: (r) => r.shares, align: "right" },
    { key: "proceeds", label: "Proceeds", value: (r) => r.proceeds, align: "right" },
    { key: "cost", label: "Cost", value: (r) => r.cost, align: "right" },
    { key: "fees", label: "Fees", value: (r) => r.fees, align: "right" },
    { key: "gain", label: "Gain", value: (r) => r.gain, align: "right" },
    { key: "cgt", label: "CGT", value: (r) => r.cgt, align: "right" },
  ],
};

const OUTCOME_OPTIONS: readonly ChipOption<"all" | "gains" | "losses">[] = [
  { value: "all", label: "All" },
  { value: "gains", label: "Gains" },
  { value: "losses", label: "Losses" },
];

const DETAIL_SALES_FILTERS = {
  keys: ["out"] as const,
  toPredicates: (filters: Record<string, string>) => {
    if (filters.out === "gains") return [(r: RealizedSlice) => r.gain > 0];
    if (filters.out === "losses") return [(r: RealizedSlice) => r.gain < 0];
    return [];
  },
};

type EntrySortKey = "date" | "type" | "shares" | "price";

const ENTRY_SPEC: TableSpec<Transaction, EntrySortKey> = {
  columns: [
    { key: "date", label: "Date", value: (r) => r.date },
    { key: "type", label: "Type", value: (r) => r.type, defaultDir: "asc" },
    { key: "shares", label: "Shares", value: (r) => r.shares || null, align: "right" },
    { key: "price", label: "Price", value: (r) => r.price || null, align: "right" },
  ],
  search: (r) => [r.type, r.note, r.date],
};

const signed = (paisa: number) =>
  `${paisa > 0 ? "+" : paisa < 0 ? "-" : ""}${formatCurrency(Math.abs(paisa))}`;

const tone = (value: number) => (value >= 0 ? "positive" : "negative");

export function StocksPage({
  stockRows,
  state,
  transactions,
  selected: selectedProp,
  onSelect,
  tableStore,
}: StocksPageProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : localSelected;
  const select = onSelect ?? setLocalSelected;

  const view = useTableView<StockLedgerRow, StockSortKey>(stockRows, STOCK_SPEC, {
    store: tableStore,
    ns: "s",
    defaultSort: { key: "totalNet", dir: "desc" },
    filters: STOCK_FILTERS,
  });

  const active =
    stockRows.find((row) => row.ticker === (selected ?? "").toUpperCase()) ?? null;
  // A deep link can name a ticker with no ledger history — say so rather than
  // silently rendering the plain list.
  const missing = selected && !active ? selected.toUpperCase() : null;

  if (stockRows.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Per stock</p>
            <h2>No stocks tracked yet</h2>
          </div>
        </div>
        <p className="empty-state">
          Record trades on the Ledger tab and every stock's profit, dividends,
          fees and taxes will be broken out here.
        </p>
      </section>
    );
  }

  return (
    <>
      {active ? (
        <StockDetail
          row={active}
          state={state}
          transactions={transactions}
          onClose={() => select(null)}
        />
      ) : null}

      {missing ? (
        <p className="empty-state">
          No ledger history for {missing}. Pick a stock from the table below.
        </p>
      ) : null}

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Per stock</p>
            <h2>Profit &amp; loss by stock</h2>
          </div>
          <span className="panel-meta">Net of fees, CGT and withholding</span>
        </div>

        <div className="table-controls table-controls--stacked">
          <input
            type="text"
            className="table-search"
            placeholder="Search ticker, name, sector..."
            value={view.query}
            onChange={(e) => view.setQuery(e.target.value)}
          />
          <ChipGroup
            options={POSITION_OPTIONS}
            value={(view.filters.pos as "all" | "open" | "closed") ?? "all"}
            onChange={(next) => view.setFilter("pos", next === "all" ? null : next)}
            ariaLabel="Filter by position status"
          />
          {view.active ? (
            <span className="panel-meta">
              {view.total} of {view.sourceTotal} stocks
            </span>
          ) : null}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {STOCK_SPEC.columns.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    sortKey={column.key}
                    sort={view.sort}
                    onClick={view.toggleSort}
                    align={column.align}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    No matches.
                  </td>
                </tr>
              ) : (
                view.rows.map((row) => (
                <tr
                  key={row.ticker}
                  className="stock-row"
                  aria-current={row.ticker === active?.ticker ? "true" : undefined}
                >
                  <td>
                    {/* An anchor, not a click handler on the <tr>: the row used to
                        wrap a nested <button>, so a click fired both. */}
                    <a className="stock-row-link ticker-link" href={stockHref(row.ticker)}>
                      {row.ticker}
                    </a>
                    {row.isClosed ? <span className="txn-tag">closed</span> : null}
                  </td>
                  <td className="right num">{row.shares.toLocaleString()}</td>
                  <td className="right num">{formatCurrency(row.avgCost)}</td>
                  <td className="right num">{formatCurrency(row.price)}</td>
                  <td className="right num">{formatCurrency(row.marketValue)}</td>
                  <td className={`right num ${tone(row.unrealized)}`}>
                    {signed(row.unrealized)}
                  </td>
                  <td className={`right num ${tone(row.realized)}`}>{signed(row.realized)}</td>
                  <td className="right num">{formatCurrency(row.dividends)}</td>
                  <td className={`right num ${tone(row.totalNet)}`}>{signed(row.totalNet)}</td>
                  <td className={`right num ${tone(row.totalReturnPct)}`}>
                    {formatSignedPercent(row.totalReturnPct, 1)}
                  </td>
                  <td className="right num">{row.feeDragPct.toFixed(2)}%</td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          label="Profit and loss by stock"
          page={view.page}
          pageCount={view.pageCount}
          pageSize={view.pageSize}
          from={view.from}
          to={view.to}
          total={view.total}
          onPage={view.setPage}
          onPageSize={view.setPageSize}
        />
      </section>
    </>
  );
}

function StockDetail({
  row,
  state,
  transactions,
  onClose,
}: {
  row: StockLedgerRow;
  state: LedgerState;
  transactions: Transaction[];
  onClose: () => void;
}) {
  const position = state.positions.get(row.ticker);

  const sales = useMemo(
    () => state.realized.filter((slice) => slice.ticker === row.ticker),
    [state.realized, row.ticker],
  );

  const entries = useMemo(
    () =>
      transactions
        .filter((txn) => txn.ticker.toUpperCase() === row.ticker)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, row.ticker],
  );

  // The derived lot columns are computed once so sorting and rendering agree.
  const lotRows = useMemo<LotRow[]>(
    () =>
      (position?.lots ?? []).map((lot, i) => {
        const value = lot.shares * row.price;
        return {
          key: `${lot.txnId}-${i}`,
          date: lot.date,
          shares: lot.shares,
          cost: lot.cost,
          costPerShare: Math.round(lot.cost / Math.max(1, lot.shares)),
          value,
          unrealized: value - lot.cost,
        };
      }),
    [position?.lots, row.price],
  );

  const lotsView = useTableView<LotRow, LotSortKey>(lotRows, LOT_SPEC, {
    defaultSort: { key: "date", dir: "asc" },
    pageSize: TABLE.DETAIL_PAGE_SIZE,
    resetKey: row.ticker,
  });

  const salesView = useTableView<RealizedSlice, DetailSaleSortKey>(sales, DETAIL_SALES_SPEC, {
    defaultSort: { key: "sellDate", dir: "desc" },
    filters: DETAIL_SALES_FILTERS,
    pageSize: TABLE.DETAIL_PAGE_SIZE,
    resetKey: row.ticker,
  });

  const entriesView = useTableView<Transaction, EntrySortKey>(entries, ENTRY_SPEC, {
    defaultSort: { key: "date", dir: "desc" },
    resetKey: row.ticker,
  });

  return (
    <section className="panel stock-detail">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">{row.sector}</p>
          <h2>
            {row.ticker} — {row.name}
          </h2>
        </div>
        <div className="detail-actions">
          <a className="button button-sm" href={pageHref("ledger")}>
            View in Ledger
          </a>
          <a className="button button-sm" href={pageHref("tax")}>
            Tax years
          </a>
          <button type="button" className="button button-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-tile">
          <p>
            Net P&amp;L
            <InfoTip
              title="Net P&L"
              what={METRIC_INFO.stockNetPnl.what}
              reading={METRIC_INFO.stockNetPnl.reading}
            />
          </p>
          <strong className={`num ${tone(row.totalNet)}`}>{signed(row.totalNet)}</strong>
          <span>{formatSignedPercent(row.totalReturnPct, 1)} on cash invested</span>
        </div>
        <div className="kpi-tile">
          <p>Unrealized</p>
          <strong className={`num ${tone(row.unrealized)}`}>{signed(row.unrealized)}</strong>
          <span>{signed(row.netIfSoldToday)} if sold today</span>
        </div>
        <div className="kpi-tile">
          <p>Realized</p>
          <strong className={`num ${tone(row.realized)}`}>{signed(row.realized)}</strong>
          <span>
            {row.closed.count} closed lot{row.closed.count === 1 ? "" : "s"}
            {row.closed.count > 0 ? `, ${row.closed.winRatePct.toFixed(0)}% winners` : ""}
          </span>
        </div>
        <div className="kpi-tile">
          <p>Dividends</p>
          <strong className="num">{formatCurrency(row.dividends)}</strong>
          <span>after withholding</span>
        </div>
        <div className="kpi-tile">
          <p>
            Fees &amp; taxes
            <InfoTip
              title="Fee drag"
              what={METRIC_INFO.feeDrag.what}
              reading={METRIC_INFO.feeDrag.reading}
            />
          </p>
          <strong className="num">
            {formatCompactCurrency(row.feesPaid + row.taxesPaid)}
          </strong>
          <span>{row.feeDragPct.toFixed(2)}% of cash invested</span>
        </div>
        <div className="kpi-tile">
          <p>Holding period</p>
          <strong className="num">{row.holdingDays.toLocaleString()}d</strong>
          <span>
            since {row.firstDate ? formatDateShort(row.firstDate) : "—"}
            {row.shares > 0 ? ", share-weighted" : ""}
          </span>
        </div>
        <div className="kpi-tile">
          <p>Position</p>
          <strong className="num">{row.shares.toLocaleString()}</strong>
          <span>
            at {formatCurrency(row.avgCost)} avg · {formatCurrency(row.marketValue)}
          </span>
        </div>
      </div>

      {/* Gated on the unfiltered lots, so narrowing the view can never make the
          panel vanish and read as lost data. */}
      {lotRows.length > 0 ? (
        <>
          <h3 className="settings-group-title">Open lots</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {LOT_SPEC.columns.map((column) => (
                    <SortHeader
                      key={column.key}
                      label={column.label}
                      sortKey={column.key}
                      sort={lotsView.sort}
                      onClick={lotsView.toggleSort}
                      align={column.align}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotsView.rows.map((lot) => (
                  <tr key={lot.key}>
                    <td>{formatDateShort(lot.date)}</td>
                    <td className="right num">{lot.shares.toLocaleString()}</td>
                    <td className="right num">{formatCurrency(lot.cost)}</td>
                    <td className="right num">{formatCurrency(lot.costPerShare)}</td>
                    <td className="right num">{formatCurrency(lot.value)}</td>
                    <td className={`right num ${tone(lot.unrealized)}`}>
                      {signed(lot.unrealized)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            label="Open lots"
            page={lotsView.page}
            pageCount={lotsView.pageCount}
            pageSize={lotsView.pageSize}
            from={lotsView.from}
            to={lotsView.to}
            total={lotsView.total}
            onPage={lotsView.setPage}
            onPageSize={lotsView.setPageSize}
            minRows={TABLE.DETAIL_PAGE_SIZE}
          />
        </>
      ) : null}

      {/* Gated on the unfiltered sales, for the same reason as the lots above. */}
      {sales.length > 0 ? (
        <>
          <h3 className="settings-group-title">Realized sales</h3>
          {sales.length > 1 ? (
            <div className="table-controls">
              <ChipGroup
                options={OUTCOME_OPTIONS}
                value={(salesView.filters.out as "all" | "gains" | "losses") ?? "all"}
                onChange={(next) => salesView.setFilter("out", next === "all" ? null : next)}
                ariaLabel="Filter sales by outcome"
              />
            </div>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {DETAIL_SALES_SPEC.columns.map((column) => (
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
                    <td colSpan={8} className="empty-state">
                      No matches.
                    </td>
                  </tr>
                ) : (
                  salesView.rows.map((slice, i) => (
                    <tr key={`${slice.txnId}-${i}`}>
                      <td>{formatDateShort(slice.sellDate)}</td>
                      <td>{formatDateShort(slice.buyDate)}</td>
                      <td className="right num">{slice.shares.toLocaleString()}</td>
                      <td className="right num">{formatCurrency(slice.proceeds)}</td>
                      <td className="right num">{formatCurrency(slice.cost)}</td>
                      <td className="right num">{formatCurrency(slice.fees)}</td>
                      <td className={`right num ${tone(slice.gain)}`}>{signed(slice.gain)}</td>
                      <td className="right num">
                        {formatCurrency(slice.cgt)}
                        <br />
                        <small>@ {slice.cgtRatePct}%</small>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            label="Realized sales"
            page={salesView.page}
            pageCount={salesView.pageCount}
            pageSize={salesView.pageSize}
            from={salesView.from}
            to={salesView.to}
            total={salesView.total}
            onPage={salesView.setPage}
            onPageSize={salesView.setPageSize}
            minRows={TABLE.DETAIL_PAGE_SIZE}
          />
        </>
      ) : null}

      <h3 className="settings-group-title">Ledger entries</h3>
      {entries.length > 1 ? (
        <div className="table-controls">
          <input
            type="text"
            className="table-search"
            placeholder="Search type, note, date..."
            value={entriesView.query}
            onChange={(e) => entriesView.setQuery(e.target.value)}
          />
        </div>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {ENTRY_SPEC.columns.map((column) => (
                <SortHeader
                  key={column.key}
                  label={column.label}
                  sortKey={column.key}
                  sort={entriesView.sort}
                  onClick={entriesView.toggleSort}
                  align={column.align}
                />
              ))}
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {entriesView.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No matches.
                </td>
              </tr>
            ) : (
              entriesView.rows.map((txn) => (
                <tr key={txn.id}>
                  <td>{formatDateShort(txn.date)}</td>
                  <td>
                    <span className={`txn-tag txn-tag--${txn.type.toLowerCase()}`}>
                      {txn.type}
                    </span>
                  </td>
                  <td className="right num">
                    {txn.type === "SPLIT"
                      ? `${txn.ratioFrom}:${txn.ratioTo}`
                      : txn.shares
                        ? txn.shares.toLocaleString()
                        : "—"}
                  </td>
                  <td className="right num">{txn.price ? formatCurrency(txn.price) : "—"}</td>
                  <td>{txn.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        label="Stock ledger entries"
        page={entriesView.page}
        pageCount={entriesView.pageCount}
        pageSize={entriesView.pageSize}
        from={entriesView.from}
        to={entriesView.to}
        total={entriesView.total}
        onPage={entriesView.setPage}
        onPageSize={entriesView.setPageSize}
      />
    </section>
  );
}
