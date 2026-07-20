import type { MetricInfo } from "../../metricInfo";
import { InfoTip } from "./InfoTip";
import { Sparkline } from "./Sparkline";

type Tone = "accent" | "positive" | "negative" | "warn" | "muted";

export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
  series,
  seriesTone,
  delta,
  deltaTone,
  info,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
  series?: number[];
  seriesTone?: Tone;
  delta?: string;
  deltaTone?: "positive" | "negative";
  info?: MetricInfo;
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <p className="stat-card-label">
        {label}
        {info ? <InfoTip title={label} what={info.what} reading={info.reading} /> : null}
      </p>
      <strong className="num">{value}</strong>
      {series && series.length >= 2 ? (
        <div className="stat-spark">
          <Sparkline data={series} tone={seriesTone ?? "accent"} fill />
          {delta ? (
            <span className={`stat-delta num ${deltaTone ?? ""}`}>{delta}</span>
          ) : null}
        </div>
      ) : null}
      <span>{detail}</span>
    </article>
  );
}
