import { useEffect, useMemo, useRef, useState } from "react";
import {
  PAGES,
  PAGE_LABELS,
  goTo,
  pageHref,
  stockHref,
  taxHref,
} from "../routes";

export type PaletteTicker = { ticker: string; name: string };

type Command = {
  id: string;
  /** What the user reads. */
  label: string;
  /** Secondary line — a company name, or the destination. */
  hint: string;
  /** Group heading. */
  group: "Stocks" | "Pages" | "Tax years";
  href: string;
  /** Lowercased haystack for matching. */
  search: string;
};

const MAX_RESULTS = 12;

function buildCommands(
  tickers: PaletteTicker[],
  fiscalYears: string[],
): Command[] {
  const stocks: Command[] = tickers.map((t) => ({
    id: `stock:${t.ticker}`,
    label: t.ticker,
    hint: t.name,
    group: "Stocks",
    href: stockHref(t.ticker),
    search: `${t.ticker} ${t.name}`.toLowerCase(),
  }));

  const pages: Command[] = PAGES.map((page) => ({
    id: `page:${page}`,
    label: PAGE_LABELS[page],
    hint: pageHref(page),
    group: "Pages",
    href: pageHref(page),
    search: `${PAGE_LABELS[page]} ${page}`.toLowerCase(),
  }));

  const years: Command[] = fiscalYears.map((fy) => ({
    id: `fy:${fy}`,
    label: `FY ${fy}`,
    hint: "Tax year",
    group: "Tax years",
    href: taxHref(fy),
    search: `fy ${fy} tax`.toLowerCase(),
  }));

  return [...stocks, ...pages, ...years];
}

/**
 * Rank matches so an exact or prefix ticker hit always beats a substring buried
 * in a company name — typing "OG" should offer OGDC before "Oil & Gas" matches
 * elsewhere.
 */
function score(command: Command, query: string): number {
  const label = command.label.toLowerCase();
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  const at = command.search.indexOf(query);
  if (at === -1) return Number.POSITIVE_INFINITY;
  return 2 + at;
}

/**
 * Jump-to-anything overlay, opened with Cmd/Ctrl-K.
 *
 * Structured as a combobox rather than a list of focusable rows: focus stays in
 * the input and Arrow keys move `aria-activedescendant`, which is what lets a
 * user type and choose without ever leaving the field.
 */
export function CommandPalette({
  tickers,
  fiscalYears,
  onClose,
}: {
  tickers: PaletteTicker[];
  fiscalYears: string[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(
    () => buildCommands(tickers, fiscalYears),
    [tickers, fiscalYears],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // No query: offer pages, which is the only sensible default ordering.
      return commands.filter((c) => c.group === "Pages").slice(0, MAX_RESULTS);
    }
    return commands
      .map((c) => ({ c, s: score(c, q) }))
      .filter((r) => Number.isFinite(r.s))
      .sort((a, b) => a.s - b.s || a.c.label.localeCompare(b.c.label))
      .slice(0, MAX_RESULTS)
      .map((r) => r.c);
  }, [commands, query]);

  /**
   * Results bucketed by group for rendering, each item keeping its index in the
   * flat `results` list so arrow-key highlighting stays a single counter.
   */
  const grouped = useMemo(() => {
    const buckets: { group: Command["group"]; items: { command: Command; index: number }[] }[] = [];
    results.forEach((command, index) => {
      const last = buckets[buckets.length - 1];
      if (last && last.group === command.group) last.items.push({ command, index });
      else buckets.push({ group: command.group, items: [{ command, index }] });
    });
    return buckets;
  }, [results]);

  // Keep the highlight in range as the result set shrinks under typing.
  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the highlighted row visible when arrowing past the visible window.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    goTo(command.href);
    onClose();
  };

  return (
    <div
      className="palette-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette-card">
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          value={query}
          placeholder="Jump to a stock, page or tax year…"
          role="combobox"
          // Always expanded: the list is part of the overlay, not a disclosure.
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (results.length ? (i + 1) % results.length : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) =>
                results.length ? (i - 1 + results.length) % results.length : 0,
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            }
          }}
        />

        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <p className="palette-empty">No matches for “{query}”.</p>
          ) : (
            /* A listbox may only contain options or groups of options, so each
               heading gets a real role="group" wrapper rather than a bare div —
               otherwise the option relationship is broken for screen readers. */
            grouped.map(({ group, items }) => (
              <div key={group} role="group" aria-label={group}>
                <p className="palette-group" aria-hidden="true">
                  {group}
                </p>
                {items.map(({ command, index }) => (
                  /* An anchor, so cmd-click and middle-click behave; the Enter
                     path goes through `choose` so the palette also closes. */
                  <a
                    key={command.id}
                    id={`palette-${command.id}`}
                    className={`palette-row ${index === active ? "palette-row--active" : ""}`}
                    role="option"
                    aria-selected={index === active}
                    data-active={index === active}
                    href={command.href}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => onClose()}
                  >
                    <strong>{command.label}</strong>
                    <span>{command.hint}</span>
                  </a>
                ))}
              </div>
            ))
          )}
        </div>

        <p className="palette-footnote">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open ·{" "}
          <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
