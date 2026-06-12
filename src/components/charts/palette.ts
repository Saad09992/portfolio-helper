const PALETTE = [
  "#4cc9f0",
  "#5eead4",
  "#f97316",
  "#facc15",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#34d399",
];

export function getSliceColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
