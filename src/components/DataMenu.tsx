import { useEffect, useRef, useState } from "react";
import {
  buildPortfolioSummary,
  type PortfolioSummaryInput,
  type SummaryDepth,
} from "../portfolio/summary";
import { pushToast } from "../hooks/useToast";

type Props = {
  summaryInput: PortfolioSummaryInput;
  onExport: () => void;
  onImport: (file: File) => void;
  /** True before there is anything worth copying — the copy items go quiet. */
  copyDisabled?: boolean;
};

const DEPTH_OPTIONS: { value: SummaryDepth; label: string; hint: string }[] = [
  { value: "headline", label: "Copy headline", hint: "Totals, P/L, top 5, performance" },
  {
    value: "compact",
    label: "Copy compact",
    hint: "+ Holdings, sectors, targets, per-stock P/L",
  },
  {
    value: "comprehensive",
    label: "Copy comprehensive",
    hint: "+ Stock detail, trade ledger, taxes, history",
  },
];

/**
 * Export, import and the three summary depths behind one button.
 *
 * They were five buttons in the hero row, all the same visual weight as Refresh
 * prices even though none of them is used more than occasionally. Flattened
 * rather than nested — the copy depths sit alongside export and import instead
 * of behind a second menu, because a submenu costs more than it saves at five
 * items.
 */
export function DataMenu({ summaryInput, onExport, onImport, copyDisabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setOpen(false);
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
    <div className="action-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Data ▾
      </button>
      {open && (
        <div className="action-menu" role="menu">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              className="action-menu-item"
              disabled={copyDisabled}
              onClick={() => copy(opt.value)}
            >
              <span className="action-menu-item-label">{opt.label}</span>
              <span className="action-menu-item-hint">{opt.hint}</span>
            </button>
          ))}
          <hr className="action-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="action-menu-item"
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            <span className="action-menu-item-label">Export backup</span>
            <span className="action-menu-item-hint">Every holding, trade and setting as JSON</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="action-menu-item"
            onClick={() => fileRef.current?.click()}
          >
            <span className="action-menu-item-label">Import backup</span>
            <span className="action-menu-item-hint">Replaces everything — asks first</span>
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Closing before the confirm dialog opens, so the menu is not left
          // hanging over it.
          setOpen(false);
          if (file) onImport(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
