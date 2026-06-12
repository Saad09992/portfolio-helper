// PSX trading window ends 15:30 PKT Mon–Thu; Fri ladder ends 16:30. Use 15:30
// weekday cutoff — daily snapshot only persists once market has closed.

export function pkParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

export function psxCloseStatus(now: Date = new Date()) {
  const p = pkParts(now);
  const isWeekday = !["Sat", "Sun"].includes(p.weekday);
  const afterClose = p.hour > 15 || (p.hour === 15 && p.minute >= 30);
  return { isWeekday, afterClose, pkDate: p.date };
}

export function pkDateOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return pkParts(d).date;
}
