import { useMemo, useState } from "react";
import type { LedgerState, Transaction } from "../ledger/types";
import type { StockLedgerRow } from "../ledger/perStock";
import { METRIC_INFO } from "../metricInfo";
import { InfoTip } from "../components/ui/InfoTip";
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
};

const signed = (paisa: number) =>
  `${paisa > 0 ? "+" : paisa < 0 ? "-" : ""}${formatCurrency(Math.abs(paisa))}`;

const tone = (value: number) => (value >= 0 ? "positive" : "negative");

export function StocksPage({ stockRows, state, transactions }: StocksPageProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const active = stockRows.find((row) => row.ticker === selected) ?? null;

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
          onClose={() => setSelected(null)}
        />
      ) : null}

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Per stock</p>
            <h2>Profit &amp; loss by stock</h2>
          </div>
          <span className="panel-meta">Net of fees, CGT and withholding</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="right">Shares</th>
                <th className="right">Avg cost</th>
                <th className="right">Price</th>
                <th className="right">Market value</th>
                <th className="right">Unrealized</th>
                <th className="right">Realized</th>
                <th className="right">Dividends</th>
                <th className="right">Net P&amp;L</th>
                <th className="right">Return</th>
                <th className="right">Fee drag</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row) => (
                <tr
                  key={row.ticker}
                  className="stock-row"
                  onClick={() => setSelected(row.ticker === selected ? null : row.ticker)}
                >
                  <td>
                    <button type="button" className="stock-row-link">
                      {row.ticker}
                    </button>
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
              ))}
            </tbody>
          </table>
        </div>
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

  return (
    <section className="panel stock-detail">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">{row.sector}</p>
          <h2>
            {row.ticker} — {row.name}
          </h2>
        </div>
        <button type="button" className="button button-sm" onClick={onClose}>
          Close
        </button>
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

      {position && position.lots.length > 0 ? (
        <>
          <h3 className="settings-group-title">Open lots</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Acquired</th>
                  <th className="right">Shares</th>
                  <th className="right">Cost</th>
                  <th className="right">Cost / share</th>
                  <th className="right">Value now</th>
                  <th className="right">Unrealized</th>
                </tr>
              </thead>
              <tbody>
                {position.lots.map((lot, i) => {
                  const value = lot.shares * row.price;
                  return (
                    <tr key={`${lot.txnId}-${i}`}>
                      <td>{formatDateShort(lot.date)}</td>
                      <td className="right num">{lot.shares.toLocaleString()}</td>
                      <td className="right num">{formatCurrency(lot.cost)}</td>
                      <td className="right num">
                        {formatCurrency(Math.round(lot.cost / Math.max(1, lot.shares)))}
                      </td>
                      <td className="right num">{formatCurrency(value)}</td>
                      <td className={`right num ${tone(value - lot.cost)}`}>
                        {signed(value - lot.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {sales.length > 0 ? (
        <>
          <h3 className="settings-group-title">Realized sales</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sold</th>
                  <th>Bought</th>
                  <th className="right">Shares</th>
                  <th className="right">Proceeds</th>
                  <th className="right">Cost</th>
                  <th className="right">Fees</th>
                  <th className="right">Gain</th>
                  <th className="right">CGT</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((slice, i) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h3 className="settings-group-title">Ledger entries</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th className="right">Shares</th>
              <th className="right">Price</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((txn) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
