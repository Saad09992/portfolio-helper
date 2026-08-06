import { useEffect, useRef, useState } from "react";
import {
  buildPortfolioSummary,
  type PortfolioSummaryInput,
  type SummaryDepth,
} from "../portfolio/summary";
import { pushToast } from "../hooks/useToast";

type Props = {
  summaryInput: PortfolioSummaryInput;
  disabled?: boolean;
};

const DEPTH_OPTIONS: { value: SummaryDepth; label: string; hint: string }[] = [
  { value: "headline", label: "Headline only", hint: "Totals, P/L, top 5, performance" },
  { value: "compact", label: "Compact", hint: "+ Holdings, sectors, targets, per-stock P/L" },
  { value: "comprehensive", label: "Comprehensive", hint: "+ Stock detail, trade ledger, taxes, history" },
];

export function CopySummaryButton({ summaryInput, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(depth: SummaryDepth) {
    setOpen(false);
    const md = buildPortfolioSummary(summaryInput, depth);
    try {
      await navigator.clipboard.writeText(md);
      pushToast(`Portfolio summary copied (${depth})`, "info");
    } catch (err) {
      pushToast(
        `Copy failed: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    }
  }

  return (
    <div className="copy-summary-wrap" ref={wrapRef}>
      <button
        type="button"
        className="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Copy summary ▾
      </button>
      {open && (
        <div className="copy-summary-menu" role="menu">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              className="copy-summary-item"
              onClick={() => copy(opt.value)}
            >
              <span className="copy-summary-item-label">{opt.label}</span>
              <span className="copy-summary-item-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
