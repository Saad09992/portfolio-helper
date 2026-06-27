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
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
  series?: number[];
  seriesTone?: Tone;
  delta?: string;
  deltaTone?: "positive" | "negative";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
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
