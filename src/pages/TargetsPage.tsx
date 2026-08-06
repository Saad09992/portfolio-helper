import { useState } from "react";
import type { DerivedHolding, RebalanceCadence, SectorBucket } from "../types";
import type { TargetRow } from "../derivedTypes";
import { DRIFT } from "../constants";
import { formatCurrency, formatPercent } from "../utils";
import { Combobox } from "../components/ui/Combobox";
import { ChipGroup } from "../components/ui/ChipGroup";
import { CadenceBadge } from "../components/CadenceBadge";
import { ActionRow } from "../components/ActionRow";
import { StatCard } from "../components/ui/StatCard";
import { TargetDonut } from "../components/charts/TargetDonut";

type DraftTarget = {
  mode: "sector" | "ticker";
  key: string;
  targetWeightPct: number;
  warnPct: number;
  criticalPct: number;
  cadence: RebalanceCadence;
};

type StatusFilter = "all" | "over" | "under" | "ontrack" | "due";
type ModeCoverage = { sum: number; untargeted: number; count: number };
type SortKey = "key" | "mode" | "current" | "target" | "drift" | "gap";
type SortState = { key: SortKey; dir: "asc" | "desc" };

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
  availableCash: number;
  coverage: { sector: ModeCoverage; ticker: ModeCoverage };
  turnover: {
    buyTotal: number;
    sellTotal: number;
    net: number;
    gross: number;
    turnoverPct: number;
  };
  presets: { name: string }[];
  saveTargetPreset: (name: string) => void;
  applyTargetPreset: (name: string) => void;
  deleteTargetPreset: (name: string) => void;
};

function buildPlanCsv(rows: TargetRow[]): string {
  const header = "action,key,mode,current_pct,target_pct,gap_pkr,shares";
  const lines = rows.map((r) =>
    [
      r.gapValue > 0 ? "BUY" : "SELL",
      r.key,
      r.mode,
      (r.currentWeight * 100).toFixed(2),
      (r.targetWeight * 100).toFixed(2),
      // gapValue is paisa → export rupees
      (Math.abs(r.gapValue) / 100).toFixed(2),
      r.mode === "ticker" ? r.shares.toFixed(0) : "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function buildPlanText(rows: TargetRow[]): string {
  return rows
    .map(
      (r) =>
        `${r.gapValue > 0 ? "BUY " : "SELL"} ${r.key} (${r.mode})  ${formatCurrency(
          Math.abs(r.gapValue),
        )}  ${formatPercent(r.currentWeight)} → ${formatPercent(r.targetWeight)}${
          r.mode === "ticker" && r.shares > 0 ? `  ~${r.shares.toFixed(0)} sh` : ""
        }`,
    )
    .join("\n");
}

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
  availableCash,
  coverage,
  turnover,
  presets,
  saveTargetPreset,
  applyTargetPreset,
  deleteTargetPreset,
}: TargetsPageProps) {
  const hasSectorTargets = coverage.sector.count > 0;
  const hasTickerTargets = coverage.ticker.count > 0;
  const [donutMode, setDonutMode] = useState<"sector" | "ticker">(
    hasSectorTargets || !hasTickerTargets ? "sector" : "ticker",
  );
  const [sort, setSort] = useState<SortState>({ key: "drift", dir: "desc" });
  const [presetName, setPresetName] = useState("");
  const [formOpen, setFormOpen] = useState(targetRows.length === 0);

  const activeCoverage = donutMode === "sector" ? coverage.sector : coverage.ticker;
  const totalTargets = coverage.sector.count + coverage.ticker.count;
  const overAllocated = activeCoverage.sum > 1.0001;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "key" || key === "mode" ? "asc" : "desc" },
    );
  }

  const visibleRows = targetRows
    .filter((row) => !targetFilter || row.key.toLowerCase().includes(targetFilter.toLowerCase()))
    .filter((row) => {
      if (targetStatusFilter === "all") return true;
      if (targetStatusFilter === "over") return row.drift > DRIFT.COUNT_THRESHOLD;
      if (targetStatusFilter === "under") return row.drift < -DRIFT.COUNT_THRESHOLD;
      if (targetStatusFilter === "due")
        return row.cadenceState === "due" || row.cadenceState === "overdue";
      return Math.abs(row.drift) <= DRIFT.COUNT_THRESHOLD;
    })
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "key":
          return a.key.localeCompare(b.key) * dir;
        case "mode":
          return a.mode.localeCompare(b.mode) * dir;
        case "current":
          return (a.currentWeight - b.currentWeight) * dir;
        case "target":
          return (a.targetWeight - b.targetWeight) * dir;
        case "gap":
          return (Math.abs(a.gapValue) - Math.abs(b.gapValue)) * dir;
        default:
          return (a.absDrift - b.absDrift) * dir;
      }
    });

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(buildPlanText(rebalanceSuggestions));
    } catch {
      /* clipboard unavailable */
    }
  }

  function exportCsv() {
    const blob = new Blob([buildPlanCsv(rebalanceSuggestions)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rebalance-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const arrowFor = (key: SortKey) =>
    sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "";

  // Cash-aware funding: buys are funded by available cash + proceeds from sells.
  // Allocate greedily to the largest drifts first; the rest is deferred.
  const availableFunds = availableCash + turnover.sellTotal;
  const buyShortfall = Math.max(0, turnover.buyTotal - availableFunds);
  const fundedBuy = new Map<string, number>();
  {
    let remaining = availableFunds;
    for (const r of [...buySuggestions].sort(
      (a, b) => Math.abs(b.gapValue) - Math.abs(a.gapValue),
    )) {
      const need = Math.abs(r.gapValue);
      const funded = Math.min(need, Math.max(0, remaining));
      remaining -= funded;
      fundedBuy.set(r.id, funded);
    }
  }

  return (
    <div className="dashboard-grid targets-dashboard">
      {/* KPI header row */}
      <section className="stats-grid">
        <StatCard
          label="Targets"
          value={String(totalTargets)}
          detail={`${coverage.sector.count} sector · ${coverage.ticker.count} ticker`}
        />
        <StatCard
          label={`${donutMode === "sector" ? "Sector" : "Ticker"} coverage`}
          value={formatPercent(activeCoverage.sum)}
          detail={`${formatPercent(activeCoverage.untargeted)} untargeted`}
          tone={overAllocated ? "negative" : "neutral"}
        />
        <StatCard
          label="Total drift"
          value={formatPercent(driftSummary.totalDeviation)}
          detail={`${driftSummary.over} over · ${driftSummary.under} under`}
        />
        <StatCard
          label="Due"
          value={String(driftSummary.due)}
          detail={`${driftSummary.onTrack} on track`}
          tone={driftSummary.due > 0 ? "negative" : "positive"}
        />
        <StatCard
          label="Rebalance turnover"
          value={formatCurrency(turnover.gross)}
          detail={`${formatPercent(turnover.turnoverPct)} of book`}
        />
      </section>

      {/* Coverage validator banner */}
      {totalTargets > 0 && (
        <div className={`coverage-banner ${overAllocated ? "coverage-banner--warn" : "coverage-banner--ok"}`}>
          <span className="coverage-banner-dot" />
          <span>
            {hasSectorTargets && (
              <>
                <strong>Sector</strong> {formatPercent(coverage.sector.sum)} targeted ·{" "}
                {formatPercent(coverage.sector.untargeted)} free
              </>
            )}
            {hasSectorTargets && hasTickerTargets && <span className="coverage-sep"> | </span>}
            {hasTickerTargets && (
              <>
                <strong>Ticker</strong> {formatPercent(coverage.ticker.sum)} targeted ·{" "}
                {formatPercent(coverage.ticker.untargeted)} free
              </>
            )}
          </span>
          {overAllocated && (
            <span className="coverage-banner-flag">
              Over-allocated — {donutMode} targets exceed 100%
            </span>
          )}
        </div>
      )}

      <section className="insight-grid dual targets-split">
        {/* Donut panel */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Allocation</p>
              <h2>Current vs target</h2>
            </div>
            {hasSectorTargets && hasTickerTargets && (
              <ChipGroup
                ariaLabel="Allocation mode"
                value={donutMode}
                onChange={setDonutMode}
                options={[
                  { value: "sector", label: "Sector" },
                  { value: "ticker", label: "Ticker" },
                ]}
              />
            )}
          </div>
          <TargetDonut rows={targetRows} mode={donutMode} />

          <div className="preset-bar">
            <input
              className="preset-input"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name…"
              aria-label="Preset name"
            />
            <button
              type="button"
              className="button button-ghost button-sm"
              onClick={() => {
                saveTargetPreset(presetName);
                setPresetName("");
              }}
            >
              Save preset
            </button>
            {presets.length > 0 && (
              <select
                className="preset-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) applyTargetPreset(e.target.value);
                  e.target.value = "";
                }}
                aria-label="Apply preset"
              >
                <option value="">Load preset…</option>
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {presets.length > 0 && (
            <div className="preset-chips">
              {presets.map((p) => (
                <span key={p.name} className="preset-chip">
                  {p.name}
                  <button
                    type="button"
                    className="preset-chip-del"
                    onClick={() => deleteTargetPreset(p.name)}
                    aria-label={`Delete preset ${p.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Rebalance panel */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Rebalance</p>
              <h2>Suggested actions</h2>
            </div>
            <span className="panel-meta">
              {rebalanceSuggestions.length} action{rebalanceSuggestions.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="muted-note">{cashMessage}</p>

          {rebalanceSuggestions.length === 0 ? (
            <p className="muted-note">No major drift detected from current targets.</p>
          ) : (
            <>
              <div className="turnover-summary">
                <div className="turnover-stat">
                  <span className="turnover-label buy">Buy need</span>
                  <span className="num">{formatCurrency(turnover.buyTotal)}</span>
                </div>
                <div className="turnover-stat">
                  <span className="turnover-label">Cash + sells</span>
                  <span className="num">{formatCurrency(availableFunds)}</span>
                </div>
                <div className="turnover-stat">
                  <span className={`turnover-label ${buyShortfall > 0 ? "sell" : ""}`}>Shortfall</span>
                  <span className={`num ${buyShortfall > 0 ? "negative" : ""}`}>
                    {formatCurrency(buyShortfall)}
                  </span>
                </div>
                <div className="turnover-actions">
                  <button type="button" className="button button-ghost button-sm" onClick={copyPlan}>
                    Copy plan
                  </button>
                  <button type="button" className="button button-ghost button-sm" onClick={exportCsv}>
                    Export CSV
                  </button>
                </div>
              </div>
              {buyShortfall > 0 && (
                <p className="fund-warn">
                  Buys need {formatCurrency(turnover.buyTotal)} but only{" "}
                  {formatCurrency(availableFunds)} available
                  {turnover.sellTotal > 0 ? " (cash + sells)" : " in cash"}. Buys below are
                  funded largest-drift first; the rest is deferred until you add cash or trim
                  an untargeted holding.
                </p>
              )}
              <div className="action-groups">
                {buySuggestions.length > 0 && (
                  <div className="action-group">
                    <div className="action-group-header">
                      <span className="action-group-label buy">BUY</span>
                      <span className="action-group-total num">
                        {formatCurrency(buySuggestions.reduce((s, r) => s + Math.abs(r.gapValue), 0))}
                      </span>
                    </div>
                    {buySuggestions.map((item) => {
                      const funded = fundedBuy.get(item.id) ?? 0;
                      const need = Math.abs(item.gapValue);
                      const full = funded >= need - 0.01;
                      return (
                        <div key={item.id} className="rebalance-buy">
                          <ActionRow item={item} kind="buy" total={totalValue} />
                          {!full && (
                            <span className={`fund-flag ${funded <= 0 ? "fund-flag--none" : ""}`}>
                              {funded <= 0
                                ? "no cash — deferred"
                                : `only ${formatCurrency(funded)} funded`}
                            </span>
                          )}
                        </div>
                      );
                    })}
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
            </>
          )}
        </article>
      </section>

      {/* Drift table panel */}
      <article className="panel target-table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Targets</p>
            <h2>Allocation drift</h2>
          </div>
          <button
            type="button"
            className="button button-ghost button-sm"
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? "Close" : "+ Add target"}
          </button>
        </div>

        {formOpen && (
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
                onChange={(val) => setTargetDraft((current) => ({ ...current, key: val }))}
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
            <label
              className="target-form-field"
              title="Warn threshold — row turns yellow when |drift| crosses this"
            >
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
            <label
              className="target-form-field"
              title="Critical threshold — row turns red; trim/expand required"
            >
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
        )}

        {targetError ? <p className="form-error">{targetError}</p> : null}

        {targetRows.length > 0 && (
          <div className="drift-controls">
            <ChipGroup
              ariaLabel="Drift status filter"
              value={targetStatusFilter}
              onChange={setTargetStatusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "over", label: "Over" },
                { value: "under", label: "Under" },
                { value: "ontrack", label: "On track" },
                { value: "due", label: "Due" },
              ]}
            />
            {targetRows.length > 3 && (
              <input
                className="target-filter"
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                placeholder="Search..."
              />
            )}
          </div>
        )}

        {targetRows.length === 0 ? (
          <p className="muted-note">No targets yet. Add sector or ticker targets.</p>
        ) : (
          <div className="table-wrap">
            <table className="target-table">
              <thead>
                <tr>
                  <th className="sortable">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("key")}>
                      Key<span className="sort-arrow">{arrowFor("key")}</span>
                    </button>
                  </th>
                  <th className="sortable">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("mode")}>
                      Mode<span className="sort-arrow">{arrowFor("mode")}</span>
                    </button>
                  </th>
                  <th className="right sortable">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("current")}>
                      Current<span className="sort-arrow">{arrowFor("current")}</span>
                    </button>
                  </th>
                  <th className="right sortable">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("target")}>
                      Target<span className="sort-arrow">{arrowFor("target")}</span>
                    </button>
                  </th>
                  <th className="right sortable">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("drift")}>
                      Drift<span className="sort-arrow">{arrowFor("drift")}</span>
                    </button>
                  </th>
                  <th className="right sortable">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("gap")}>
                      Action<span className="sort-arrow">{arrowFor("gap")}</span>
                    </button>
                  </th>
                  <th className="right">Warn %</th>
                  <th className="right">Crit %</th>
                  <th>Cadence</th>
                  <th>Due</th>
                  <th className="right">·</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const warnPctValue = (row.warnThreshold * 100).toFixed(1);
                  const criticalPctValue = (row.criticalThreshold * 100).toFixed(1);
                  return (
                    <tr key={row.id} className={`target-row target-row--${row.status}`}>
                      <td>
                        <strong>{row.key}</strong>
                      </td>
                      <td>
                        <span className="drift-badge">{row.mode}</span>
                      </td>
                      <td className="right num">{formatPercent(row.currentWeight)}</td>
                      <td className="right num">{formatPercent(row.targetWeight)}</td>
                      <td className="right">
                        <span className={`drift-delta num ${row.drift >= 0 ? "negative" : "positive"}`}>
                          {row.drift >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(row.drift))}
                        </span>
                      </td>
                      <td className="right">
                        <span className={`drift-action-tag ${row.gapValue > 0 ? "buy" : "sell"}`}>
                          {row.gapValue > 0 ? "BUY" : "SELL"}{" "}
                          <span className="num">{formatCurrency(Math.abs(row.gapValue))}</span>
                        </span>
                        {row.mode === "ticker" && row.shares > 0 && (
                          <span className="drift-shares num"> ~{row.shares.toFixed(0)} sh</span>
                        )}
                      </td>
                      <td className="right">
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
                      </td>
                      <td className="right">
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
                      </td>
                      <td>
                        <select
                          className="drift-cadence-select"
                          value={row.cadence}
                          onChange={(e) =>
                            updateTargetCadence(row.id, e.target.value as RebalanceCadence)
                          }
                          title="Rebalance cadence"
                          aria-label="Rebalance cadence"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </td>
                      <td>
                        <CadenceBadge state={row.cadenceState} days={row.daysUntilDue} />
                      </td>
                      <td className="right">
                        <div className="target-row-actions">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
