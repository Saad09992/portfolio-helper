type Tone = "accent" | "positive" | "negative" | "warn" | "muted";

const TONE_VAR: Record<Tone, string> = {
  accent: "var(--accent)",
  positive: "var(--pos)",
  negative: "var(--neg)",
  warn: "var(--warn)",
  muted: "var(--muted)",
};

export function Sparkline({
  data,
  tone = "accent",
  fill = false,
  width = 96,
  height = 28,
}: {
  data: number[];
  tone?: Tone;
  fill?: boolean;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + (1 - (v - min) / span) * h;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const color = TONE_VAR[tone];
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill && (
        <polygon
          points={`${pad},${height - pad} ${line} ${width - pad},${height - pad}`}
          fill={color}
          opacity={0.12}
        />
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={1.8} fill={color} />
    </svg>
  );
}
