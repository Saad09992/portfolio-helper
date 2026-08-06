import { useState } from "react";
import { Field } from "../components/ui/Field";
import { formatCurrency } from "../utils";
import { paisaToRupees, rupeesToPaisa } from "../money";
import { DEFAULT_FEE_CONFIG, type FeeConfig, type OpeningLoss } from "../ledger/feeConfig";
import { fiscalYearOf, LOSS_CARRY_FORWARD_YEARS } from "../ledger/tax";
import { computeTradeCosts, tradeValue } from "../ledger/fees";

export type SettingsPageProps = {
  feeConfig: FeeConfig;
  updateFeeConfig: (patch: Partial<FeeConfig>) => void;
  replaceFeeConfig: (next: unknown) => void;
};

/** Trade the worked example prices out, so a rate typo is obvious immediately. */
const EXAMPLE_SHARES = 100;
const EXAMPLE_PRICE = 14500; // Rs 145.00

/** The fiscal year that just closed — the one a carried-in loss usually came from. */
function priorFiscalYear(iso: string): string {
  const start = Number(fiscalYearOf(iso).slice(0, 4)) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

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

  // Half-typed rows ("2025-2", a blank amount) are dropped by normalizeFeeConfig,
  // so the rows being edited live here and only the valid ones reach the config.
  const [openingLosses, setOpeningLosses] = useState<OpeningLoss[]>(
    () => feeConfig.openingLosses ?? [],
  );

  const commitLosses = (next: OpeningLoss[]) => {
    setOpeningLosses(next);
    updateFeeConfig({ openingLosses: next });
  };

  const patchLoss = (index: number, patch: Partial<OpeningLoss>) =>
    commitLosses(openingLosses.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const removeLoss = (index: number) =>
    commitLosses(openingLosses.filter((_, i) => i !== index));

  const addLoss = () =>
    commitLosses([
      ...openingLosses,
      { fy: priorFiscalYear(new Date().toISOString()), amount: 0 },
    ]);

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
            label="CDC charge (%) — usually 0"
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
            label="PSX laga + SECP levy (%)"
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

        <h3 className="settings-group-title">Losses carried in from before the ledger</h3>
        <p className="muted-note">
          Capital losses from tax years that predate your first entry still
          shelter its gains, but the ledger cannot see them. Take each figure
          from the June NCCPL statement for that year — its{" "}
          <em>Net Capital Gain/(Loss) as of reporting month</em> is the year&apos;s
          closing position. Losses expire {LOSS_CARRY_FORWARD_YEARS} tax years
          after the year they arose.
        </p>

        {openingLosses.length > 0 ? (
          <table className="cost-preview">
            <tbody>
              {openingLosses.map((loss, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      className="inline-edit"
                      placeholder="2025-26"
                      value={loss.fy}
                      onChange={(e) => patchLoss(index, { fy: e.target.value })}
                    />
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      className="inline-edit"
                      min={0}
                      step="0.01"
                      value={String(paisaToRupees(loss.amount))}
                      onChange={(e) =>
                        patchLoss(index, { amount: rupeesToPaisa(Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeLoss(index)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="form-actions">
          <button type="button" className="button button-sm" onClick={addLoss}>
            Add a carried-in loss
          </button>
        </div>
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
              <td>Cash in on a sell</td>
              <td className="right num">{formatCurrency(value - fees.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
