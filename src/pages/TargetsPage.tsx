import type { DerivedHolding, RebalanceCadence, SectorBucket } from "../types";
import type { TargetRow } from "../derivedTypes";
import { DRIFT } from "../constants";
import { formatCurrency, formatPercent } from "../utils";
import { Combobox } from "../components/ui/Combobox";
import { CadenceBadge } from "../components/CadenceBadge";
import { ActionRow } from "../components/ActionRow";

type DraftTarget = {
  mode: "sector" | "ticker";
  key: string;
  targetWeightPct: number;
  warnPct: number;
  criticalPct: number;
  cadence: RebalanceCadence;
};

type StatusFilter = "all" | "over" | "under" | "ontrack" | "due";
type TargetSort = "drift" | "name" | "weight";

export type TargetsPageProps = {
  targetDraft: DraftTarget;
  setTargetDraft: React.Dispatch<React.SetStateAction<DraftTarget>>;
  targetError: string;
  addTargetAllocation: (event: React.FormEvent<HTMLFormElement>) => void;
  sectors: SectorBucket[];
  holdings: DerivedHolding[];
  targetRows: TargetRow[];
  driftSummary: {
    over: number;
    under: number;
    onTrack: number;
    due: number;
    totalDeviation: number;
  };
  targetStatusFilter: StatusFilter;
  setTargetStatusFilter: (s: StatusFilter) => void;
  targetSort: TargetSort;
  setTargetSort: (s: TargetSort) => void;
  targetFilter: string;
  setTargetFilter: (s: string) => void;
  markTargetRebalanced: (id: string) => void;
  removeTarget: (id: string) => void;
  updateTargetThreshold: (
    id: string,
    field: "warnThreshold" | "criticalThreshold",
    valuePct: number,
  ) => void;
  updateTargetCadence: (id: string, cadence: RebalanceCadence) => void;
  rebalanceSuggestions: TargetRow[];
  buySuggestions: TargetRow[];
  sellSuggestions: TargetRow[];
  cashMessage: string;
  totalValue: number;
};

export function TargetsPage({
  targetDraft,
  setTargetDraft,
  targetError,
  addTargetAllocation,
  sectors,
  holdings,
  targetRows,
  driftSummary,
  targetStatusFilter,
  setTargetStatusFilter,
  targetSort,
  setTargetSort,
  targetFilter,
  setTargetFilter,
  markTargetRebalanced,
  removeTarget,
  updateTargetThreshold,
  updateTargetCadence,
  rebalanceSuggestions,
  buySuggestions,
  sellSuggestions,
  cashMessage,
  totalValue,
}: TargetsPageProps) {
  return (
    <section className="insight-grid targets-grid">
      <article className="panel target-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Targets</p>
            <h2>Allocation drift alerts</h2>
          </div>
        </div>

        <form className="target-form" onSubmit={addTargetAllocation}>
          <label className="target-form-field">
            <span className="target-form-label">Mode</span>
            <select
              value={targetDraft.mode}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  mode: event.target.value as "sector" | "ticker",
                  key: "",
                }))
              }
            >
              <option value="sector">Sector</option>
              <option value="ticker">Ticker</option>
            </select>
          </label>
          <label className="target-form-field target-form-field--grow">
            <span className="target-form-label">
              {targetDraft.mode === "sector" ? "Sector" : "Ticker"}
            </span>
            <Combobox
              value={targetDraft.key}
              onChange={(val) =>
                setTargetDraft((current) => ({ ...current, key: val }))
              }
              options={
                targetDraft.mode === "sector"
                  ? sectors.map((s) => s.sector)
                  : holdings.map((h) => h.ticker)
              }
              placeholder={targetDraft.mode === "sector" ? "Search sector..." : "Search ticker..."}
            />
          </label>
          <label className="target-form-field">
            <span className="target-form-label">Target %</span>
            <input
              type="number"
              className="num"
              min={0}
              max={100}
              step="0.1"
              value={targetDraft.targetWeightPct}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  targetWeightPct: Number(event.target.value),
                }))
              }
              placeholder="e.g. 35"
            />
          </label>
          <label className="target-form-field" title="Warn threshold — card turns yellow when |drift| crosses this">
            <span className="target-form-label">Warn %</span>
            <input
              type="number"
              className="num"
              min={0.1}
              max={100}
              step="0.1"
              value={targetDraft.warnPct}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  warnPct: Number(event.target.value),
                }))
              }
              placeholder="e.g. 5"
            />
          </label>
          <label className="target-form-field" title="Critical threshold — card turns red; trim/expand required">
            <span className="target-form-label">Critical %</span>
            <input
              type="number"
              className="num"
              min={0.1}
              max={100}
              step="0.1"
              value={targetDraft.criticalPct}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  criticalPct: Number(event.target.value),
                }))
              }
              placeholder="e.g. 10"
            />
          </label>
          <label className="target-form-field" title="How often this position should be rebalanced">
            <span className="target-form-label">Cadence</span>
            <select
              value={targetDraft.cadence}
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  cadence: event.target.value as RebalanceCadence,
                }))
              }
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <button type="submit" className="button target-form-submit">
            Add target
          </button>
        </form>

        {targetError ? <p className="form-error">{targetError}</p> : null}

        {targetRows.length > 0 && (
          <>
            <div className="drift-summary">
              <div className="drift-stat drift-stat--over">
                <span className="drift-stat-num num">{driftSummary.over}</span>
                <span className="drift-stat-label">Over</span>
              </div>
              <div className="drift-stat drift-stat--under">
                <span className="drift-stat-num num">{driftSummary.under}</span>
                <span className="drift-stat-label">Under</span>
              </div>
              <div className="drift-stat drift-stat--ontrack">
                <span className="drift-stat-num num">{driftSummary.onTrack}</span>
                <span className="drift-stat-label">On track</span>
              </div>
              <div className="drift-stat drift-stat--due">
                <span className="drift-stat-num num">{driftSummary.due}</span>
                <span className="drift-stat-label">Due</span>
              </div>
              <div className="drift-stat">
                <span className="drift-stat-num num">{formatPercent(driftSummary.totalDeviation)}</span>
                <span className="drift-stat-label">Total drift</span>
              </div>
            </div>

            <div className="drift-controls">
              <div className="chip-group">
                {(["all", "over", "under", "ontrack", "due"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${targetStatusFilter === s ? "chip--active" : ""}`}
                    onClick={() => setTargetStatusFilter(s)}
                  >
                    {s === "all" ? "All" : s === "over" ? "Over" : s === "under" ? "Under" : s === "ontrack" ? "On track" : "Due"}
                  </button>
                ))}
              </div>
              <select
                className="drift-sort"
                value={targetSort}
                onChange={(e) => setTargetSort(e.target.value as TargetSort)}
              >
                <option value="drift">Sort: Drift</option>
                <option value="name">Sort: Name</option>
                <option value="weight">Sort: Weight</option>
              </select>
              {targetRows.length > 3 && (
                <input
                  className="target-filter"
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value)}
                  placeholder="Search..."
                />
              )}
            </div>
          </>
        )}

        <div className="target-list">
          {targetRows.length === 0 ? (
            <p className="muted-note">No targets yet. Add sector or ticker targets.</p>
          ) : (
            targetRows
              .filter((row) => !targetFilter || row.key.toLowerCase().includes(targetFilter.toLowerCase()))
              .filter((row) => {
                if (targetStatusFilter === "all") return true;
                if (targetStatusFilter === "over") return row.drift > DRIFT.COUNT_THRESHOLD;
                if (targetStatusFilter === "under") return row.drift < -DRIFT.COUNT_THRESHOLD;
                if (targetStatusFilter === "due") return row.cadenceState === "due" || row.cadenceState === "overdue";
                return Math.abs(row.drift) <= DRIFT.COUNT_THRESHOLD;
              })
              .sort((a, b) => {
                if (targetSort === "drift") return b.absDrift - a.absDrift;
                if (targetSort === "name") return a.key.localeCompare(b.key);
                return b.targetWeight - a.targetWeight;
              })
              .map((row) => {
                const scale = Math.max(row.currentWeight, row.targetWeight, 0.01) * 1.1;
                const currentPct = (row.currentWeight / scale) * 100;
                const targetPct = (row.targetWeight / scale) * 100;
                const warnPctValue = (row.warnThreshold * 100).toFixed(1);
                const criticalPctValue = (row.criticalThreshold * 100).toFixed(1);
                return (
                  <div key={row.id} className={`drift-card drift-card--${row.status}`}>
                    <div className="drift-row-top">
                      <div className="drift-key">
                        <strong>{row.key}</strong>
                        <span className="drift-badge">{row.mode}</span>
                      </div>
                      <div className="drift-percentages">
                        <span className="drift-current-num num">{formatPercent(row.currentWeight)}</span>
                        <span className="drift-arrow">→</span>
                        <span className="drift-target-num num">{formatPercent(row.targetWeight)}</span>
                      </div>
                      <CadenceBadge state={row.cadenceState} days={row.daysUntilDue} />
                      <button
                        type="button"
                        className="drift-mark"
                        onClick={() => markTargetRebalanced(row.id)}
                        aria-label="Mark rebalanced today"
                        title="Mark rebalanced today"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="drift-remove"
                        onClick={() => removeTarget(row.id)}
                        aria-label="Remove target"
                      >
                        ×
                      </button>
                    </div>
                    <div className="drift-track-combined">
                      <div
                        className={`drift-fill-current ${row.drift >= 0 ? "drift-fill--over" : "drift-fill--under"}`}
                        style={{ width: `${currentPct}%` }}
                      />
                      <div
                        className="drift-target-marker"
                        style={{ left: `${targetPct}%` }}
                        title={`Target ${formatPercent(row.targetWeight)}`}
                      />
                    </div>
                    <div className="drift-row-bottom">
                      <span className={`drift-action-tag ${row.gapValue > 0 ? "buy" : "sell"}`}>
                        {row.gapValue > 0 ? "BUY" : "SELL"} <span className="num">{formatCurrency(Math.abs(row.gapValue))}</span>
                      </span>
                      <span className={`drift-delta num ${row.drift >= 0 ? "negative" : "positive"}`}>
                        {row.drift >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(row.drift))}
                      </span>
                      {row.mode === "ticker" && row.shares > 0 && (
                        <span className="drift-shares num">~{row.shares.toFixed(0)} sh</span>
                      )}
                      <span className="drift-threshold-pill drift-threshold-pill--warn" title="Warn threshold (click to edit)">
                        <span className="drift-threshold-label">Warn</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0.1"
                          max="100"
                          className="inline-edit inline-edit--threshold num"
                          defaultValue={warnPctValue}
                          aria-label="Warn threshold %"
                          onBlur={(e) => {
                            const next = Number(e.currentTarget.value);
                            if (next !== row.warnThreshold * 100) {
                              updateTargetThreshold(row.id, "warnThreshold", next);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              e.currentTarget.value = warnPctValue;
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <span className="drift-threshold-unit">%</span>
                      </span>
                      <span className="drift-threshold-pill drift-threshold-pill--critical" title="Critical threshold (click to edit)">
                        <span className="drift-threshold-label">Crit</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0.1"
                          max="100"
                          className="inline-edit inline-edit--threshold num"
                          defaultValue={criticalPctValue}
                          aria-label="Critical threshold %"
                          onBlur={(e) => {
                            const next = Number(e.currentTarget.value);
                            if (next !== row.criticalThreshold * 100) {
                              updateTargetThreshold(row.id, "criticalThreshold", next);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              e.currentTarget.value = criticalPctValue;
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <span className="drift-threshold-unit">%</span>
                      </span>
                      <select
                        className="drift-cadence-select"
                        value={row.cadence}
                        onChange={(e) => updateTargetCadence(row.id, e.target.value as RebalanceCadence)}
                        title="Rebalance cadence"
                        aria-label="Rebalance cadence"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Rebalance</p>
            <h2>Suggested actions</h2>
          </div>
          <span className="panel-meta">{rebalanceSuggestions.length} action{rebalanceSuggestions.length === 1 ? "" : "s"}</span>
        </div>
        <p className="muted-note">{cashMessage}</p>
        {rebalanceSuggestions.length === 0 ? (
          <p className="muted-note">No major drift detected from current targets.</p>
        ) : (
          <div className="action-groups">
            {buySuggestions.length > 0 && (
              <div className="action-group">
                <div className="action-group-header">
                  <span className="action-group-label buy">BUY</span>
                  <span className="action-group-total num">
                    {formatCurrency(buySuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0))}
                  </span>
                </div>
                {buySuggestions.map((item) => (
                  <ActionRow key={item.id} item={item} kind="buy" total={totalValue} />
                ))}
              </div>
            )}
            {sellSuggestions.length > 0 && (
              <div className="action-group">
                <div className="action-group-header">
                  <span className="action-group-label sell">SELL</span>
                  <span className="action-group-total num">
                    {formatCurrency(sellSuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0))}
                  </span>
                </div>
                {sellSuggestions.map((item) => (
                  <ActionRow key={item.id} item={item} kind="sell" total={totalValue} />
                ))}
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
