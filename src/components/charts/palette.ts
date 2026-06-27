// Pro Trader Terminal series palette — neon-forward, high contrast on near-black.
const PALETTE = [
  "#00e676", // accent green
  "#4cc9f0", // info cyan
  "#ffb300", // amber
  "#a78bfa", // violet
  "#ff5252", // red
  "#f472b6", // pink
  "#38bdf8", // sky
  "#fbbf24", // gold
];

export function getSliceColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
