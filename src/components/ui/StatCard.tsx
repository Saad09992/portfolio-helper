export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong className="num">{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
