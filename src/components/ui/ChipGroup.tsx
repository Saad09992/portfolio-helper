import { useCallback, useRef, useState } from "react";

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  /** Optional native tooltip — used for the terser chips ("Map", "Ranked"). */
  title?: string;
};

/** Shared by both groups: which index an arrow/Home/End key moves to, or null. */
function nextIndex(key: string, current: number, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * A single-select row of chips.
 *
 * Not `role="tablist"`: that contract requires associated `tabpanel`s, and these
 * chips filter or re-render a panel in place rather than swapping panels. A
 * `role="group"` of `aria-pressed` toggles is the accurate description.
 *
 * Keyboard: one stop in the tab order (roving tabindex), then Arrow keys move
 * and select, Home/End jump to the ends — the standard radio-group behaviour
 * users already expect from a segmented control.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const focusAt = useCallback((index: number) => {
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("button.chip");
    buttons?.[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = options.findIndex((o) => o.value === value);
      if (current === -1) return;

      const next = nextIndex(event.key, current, options.length);
      if (next === null) return;

      event.preventDefault();
      onChange(options[next].value);
      focusAt(next);
    },
    [focusAt, onChange, options, value],
  );

  return (
    <div
      ref={ref}
      className={`chip-group ${className ?? ""}`.trim()}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`chip ${active ? "chip--active" : ""}`}
            aria-pressed={active}
            // Roving tabindex: the group is one tab stop, arrows move within it.
            tabIndex={active ? 0 : -1}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A multi-select row of chips — the same look and the same `aria-pressed` toggles,
 * but any number can be on at once. Used for the ledger's transaction-type filter,
 * where ten types and "show me buys and sells" is the normal request.
 *
 * Keyboard differs from the single-select group by necessity: with no one active
 * value there is nothing for selection-follows-focus to mean, so Arrow keys move
 * focus only and Space/Enter toggles — the toolbar pattern rather than the radio
 * one. Focus lands on the first selected chip, or the first chip when none are.
 *
 * An empty selection means "no filter", not "hide everything" — the caller decides,
 * but every caller here treats it as unfiltered, which is what makes clearing the
 * last chip feel right rather than blanking the table.
 */
export function MultiChipGroup<T extends string>({
  options,
  values,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly ChipOption<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const focusAt = useCallback((index: number) => {
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("button.chip");
    buttons?.[index]?.focus();
  }, []);

  const toggle = useCallback(
    (value: T) => {
      onChange(
        values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
      );
    },
    [onChange, values],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const next = nextIndex(event.key, focusIndex, options.length);
      if (next === null) return;
      event.preventDefault();
      setFocusIndex(next);
      focusAt(next);
    },
    [focusAt, focusIndex, options.length],
  );

  // The single tab stop: the first selected chip, else whatever was last focused.
  const firstSelected = options.findIndex((o) => values.includes(o.value));
  const tabStop = firstSelected === -1 ? focusIndex : firstSelected;

  return (
    <div
      ref={ref}
      className={`chip-group ${className ?? ""}`.trim()}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const active = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`chip ${active ? "chip--active" : ""}`}
            aria-pressed={active}
            tabIndex={index === tabStop ? 0 : -1}
            title={option.title}
            onFocus={() => setFocusIndex(index)}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
