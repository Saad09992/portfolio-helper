import { useState } from "react";
import type { TaxYear } from "../ledger/tax";
import { LOSS_CARRY_FORWARD_YEARS } from "../ledger/tax";
import { METRIC_INFO } from "../metricInfo";
import { InfoTip } from "../components/ui/InfoTip";
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
};

const signed = (paisa: number) =>
  `${paisa > 0 ? "+" : paisa < 0 ? "-" : ""}${formatCurrency(Math.abs(paisa))}`;

export function TaxPage({ taxYears, selectedFy: selectedFyProp }: TaxPageProps) {
  const latest = taxYears[taxYears.length - 1];
  const [localFy, setLocalFy] = useState<string | null>(null);
  const selectedFy = selectedFyProp !== undefined ? selectedFyProp : localFy;
  const year = taxYears.find((y) => y.fy === selectedFy) ?? latest;

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
          <span className="panel-meta">{year.sales.length} matched lots</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sold</th>
                <th>Ticker</th>
                <th>Acquired</th>
                <th className="right">Shares</th>
                <th className="right">Proceeds</th>
                <th className="right">Cost</th>
                <th className="right">Gain</th>
                <th className="right">Rate</th>
                <th className="right">CGT</th>
              </tr>
            </thead>
            <tbody>
              {year.sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No sales in this tax year.
                  </td>
                </tr>
              ) : (
                year.sales.map((slice, i) => (
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
      </section>

      {year.dividends.length > 0 ? (
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">FY {year.fy}</p>
              <h2>Dividends</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  <th className="right">Shares</th>
                  <th className="right">Gross</th>
                  <th className="right">Withheld</th>
                  <th className="right">Net</th>
                </tr>
              </thead>
              <tbody>
                {year.dividends.map((receipt) => (
                  <tr key={receipt.txnId}>
                    <td>{formatDateShort(receipt.date)}</td>
                    <td>{receipt.ticker}</td>
                    <td className="right num">{receipt.shares.toLocaleString()}</td>
                    <td className="right num">{formatCurrency(receipt.gross)}</td>
                    <td className="right num">{formatCurrency(receipt.wht)}</td>
                    <td className="right num">{formatCurrency(receipt.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
