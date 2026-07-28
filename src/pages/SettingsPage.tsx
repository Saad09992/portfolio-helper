import { useState } from "react";
import { Field } from "../components/ui/Field";
import { formatCurrency } from "../utils";
import { paisaToRupees, rupeesToPaisa } from "../money";
import { DEFAULT_FEE_CONFIG, type FeeConfig } from "../ledger/feeConfig";
import { computeTradeCosts, tradeValue } from "../ledger/fees";

export type SettingsPageProps = {
  feeConfig: FeeConfig;
  updateFeeConfig: (patch: Partial<FeeConfig>) => void;
  replaceFeeConfig: (next: unknown) => void;
};

/** Trade the worked example prices out, so a rate typo is obvious immediately. */
const EXAMPLE_SHARES = 100;
const EXAMPLE_PRICE = 14500; // Rs 145.00

export function SettingsPage({
  feeConfig,
  updateFeeConfig,
  replaceFeeConfig,
}: SettingsPageProps) {
  const [exampleShares, setExampleShares] = useState(String(EXAMPLE_SHARES));
  const [examplePrice, setExamplePrice] = useState(String(paisaToRupees(EXAMPLE_PRICE)));

  const shares = Math.max(0, Number(exampleShares) || 0);
  const price = rupeesToPaisa(Number(examplePrice) || 0);
  const value = tradeValue(shares, price);
  const fees = computeTradeCosts(shares, price, feeConfig);

  const money = (paisa: number, patch: (rupees: number) => Partial<FeeConfig>) => ({
    value: String(paisaToRupees(paisa)),
    onChange: (raw: string) => updateFeeConfig(patch(Number(raw) || 0)),
  });

  const pct = (current: number, key: keyof FeeConfig) => ({
    value: String(current),
    onChange: (raw: string) => updateFeeConfig({ [key]: Number(raw) || 0 } as Partial<FeeConfig>),
  });

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Settings</p>
            <h2>Brokerage &amp; tax rates</h2>
          </div>
          <button
            type="button"
            className="button button-sm"
            onClick={() => replaceFeeConfig(DEFAULT_FEE_CONFIG)}
          >
            Reset to defaults
          </button>
        </div>

        <p className="muted-note">
          These rates drive every fee, CGT and withholding figure in the ledger.
          The defaults are starting points — check them against a real broker
          note and edit anything that differs. Changing a rate re-derives the
          whole ledger, including trades already entered.
        </p>

        <h3 className="settings-group-title">Brokerage commission</h3>
        <div className="form-grid">
          <Field
            label="Slab cutoff price (Rs)"
            type="number"
            min={0}
            step="0.01"
            {...money(feeConfig.commissionCutoff, (rupees) => ({
              commissionCutoff: rupeesToPaisa(rupees),
            }))}
          />
          <Field
            label="Per share at/below cutoff (Rs)"
            type="number"
            min={0}
            step="0.01"
            {...money(feeConfig.commissionPerShare, (rupees) => ({
              commissionPerShare: rupeesToPaisa(rupees),
            }))}
          />
          <Field
            label="Percent of value above cutoff"
            type="number"
            min={0}
            step="0.001"
            {...pct(feeConfig.commissionPct, "commissionPct")}
          />
          <Field
            label="Broker minimum per trade (Rs)"
            type="number"
            min={0}
            step="0.01"
            {...money(feeConfig.commissionMin, (rupees) => ({
              commissionMin: rupeesToPaisa(rupees),
            }))}
          />
        </div>

        <h3 className="settings-group-title">Statutory charges (% of trade value)</h3>
        <div className="form-grid">
          <Field
            label="Sales tax on commission (%)"
            type="number"
            min={0}
            step="0.1"
            {...pct(feeConfig.salesTaxOnCommissionPct, "salesTaxOnCommissionPct")}
          />
          <Field
            label="CDC charge (%)"
            type="number"
            min={0}
            step="0.001"
            {...pct(feeConfig.cdcPct, "cdcPct")}
          />
          <Field
            label="NCCPL charge (%)"
            type="number"
            min={0}
            step="0.001"
            {...pct(feeConfig.nccplPct, "nccplPct")}
          />
          <Field
            label="SECP / PSX levy (%)"
            type="number"
            min={0}
            step="0.0001"
            {...pct(feeConfig.secpPct, "secpPct")}
          />
          <Field
            label="Flat charge per trade (Rs)"
            type="number"
            min={0}
            step="0.01"
            {...money(feeConfig.flatFeePerTrade, (rupees) => ({
              flatFeePerTrade: rupeesToPaisa(rupees),
            }))}
          />
        </div>

        <h3 className="settings-group-title">Taxes</h3>
        <div className="form-grid">
          <Field
            label="CGT rate (%)"
            type="number"
            min={0}
            step="0.5"
            {...pct(feeConfig.cgtRatePct, "cgtRatePct")}
          />
          <Field
            label="CGT rate before cutoff (%)"
            type="number"
            min={0}
            step="0.5"
            {...pct(feeConfig.cgtLegacyRatePct, "cgtLegacyRatePct")}
          />
          <Field
            label="CGT tier cutoff date"
            type="date"
            value={feeConfig.cgtLegacyCutoff}
            onChange={(raw) => updateFeeConfig({ cgtLegacyCutoff: raw })}
          />
          <Field
            label="Dividend withholding (%)"
            type="number"
            min={0}
            step="0.5"
            {...pct(feeConfig.dividendWhtPct, "dividendWhtPct")}
          />
          <Field
            label="Bonus share tax (%)"
            type="number"
            min={0}
            step="0.5"
            {...pct(feeConfig.bonusTaxPct, "bonusTaxPct")}
          />
        </div>
        <p className="muted-note">
          Shares bought before the cutoff date are taxed at the earlier rate when
          sold. Each lot keeps its own acquisition date, so a position built
          across the cutoff is taxed tranche by tranche.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Check</p>
            <h2>Worked example</h2>
          </div>
          <span className="panel-meta">Compare against a broker note</span>
        </div>

        <div className="form-grid">
          <Field
            label="Shares"
            type="number"
            min={0}
            step="1"
            value={exampleShares}
            onChange={setExampleShares}
          />
          <Field
            label="Price (Rs)"
            type="number"
            min={0}
            step="0.01"
            value={examplePrice}
            onChange={setExamplePrice}
          />
        </div>

        <table className="cost-preview">
          <tbody>
            <tr>
              <td>Trade value</td>
              <td className="right num">{formatCurrency(value)}</td>
            </tr>
            <tr>
              <td>Commission</td>
              <td className="right num">{formatCurrency(fees.commission)}</td>
            </tr>
            <tr>
              <td>Sales tax on commission</td>
              <td className="right num">{formatCurrency(fees.salesTax)}</td>
            </tr>
            <tr>
              <td>CDC</td>
              <td className="right num">{formatCurrency(fees.cdc)}</td>
            </tr>
            <tr>
              <td>NCCPL</td>
              <td className="right num">{formatCurrency(fees.nccpl)}</td>
            </tr>
            <tr>
              <td>SECP / PSX</td>
              <td className="right num">{formatCurrency(fees.secp)}</td>
            </tr>
            <tr>
              <td>Flat charge</td>
              <td className="right num">{formatCurrency(fees.flatFee)}</td>
            </tr>
            <tr className="cost-preview-total">
              <td>Total costs</td>
              <td className="right num">{formatCurrency(fees.total)}</td>
            </tr>
            <tr className="cost-preview-total">
              <td>Cash out on a buy</td>
              <td className="right num">{formatCurrency(value + fees.total)}</td>
            </tr>
            <tr>
              <td>Cash in on a sell (before CGT)</td>
              <td className="right num">{formatCurrency(value - fees.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
