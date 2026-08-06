import { useCallback, useRef } from "react";

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  /** Optional native tooltip — used for the terser chips ("Map", "Ranked"). */
  title?: string;
};

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

      let next = current;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (current + 1) % options.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (current - 1 + options.length) % options.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = options.length - 1;
      } else {
        return;
      }

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
