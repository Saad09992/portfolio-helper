// Reads the terminal theme tokens from CSS custom properties so JS-drawn charts
// (ECharts / Lightweight Charts) share one source of truth with the stylesheet.

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function chartTokens() {
  return {
    bg: cssVar("--bg", "#05070a"),
    panel: cssVar("--panel-2", "#11161d"),
    border: cssVar("--panel-border", "#1c2430"),
    text: cssVar("--text", "#e6edf3"),
    muted: cssVar("--muted", "#8b97a6"),
    accent: cssVar("--accent", "#00e676"),
    warn: cssVar("--warn", "#ffb300"),
    neg: cssVar("--neg", "#ff5252"),
    pos: cssVar("--pos", "#00e676"),
    info: cssVar("--info", "#4cc9f0"),
    violet: "#a78bfa",
    fontMono:
      cssVar("--font-mono", "JetBrains Mono") +
      ", ui-monospace, monospace",
  };
}
