import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type InfoTipProps = {
  /** Metric name, shown as the tooltip title and in the trigger's aria-label. */
  title: string;
  /** What the metric measures. */
  what: string;
  /** How to read it — what counts as good or bad. */
  reading: string;
};

const GAP = 8;
const WIDTH = 260;

/**
 * Small ⓘ trigger that explains a metric on hover, focus, or tap.
 *
 * The bubble is portalled to <body> with fixed coordinates so it can't be
 * clipped by a panel's overflow or stacking context.
 */
export function InfoTip({ title, what, reading }: InfoTipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<
    { top: number; left: number; above: boolean } | null
  >(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(
      Math.max(GAP, r.left + r.width / 2 - WIDTH / 2),
      Math.max(GAP, window.innerWidth - WIDTH - GAP),
    );
    // Flip above the trigger when there isn't room below.
    const above = window.innerHeight - r.bottom < 140;
    setCoords({ top: above ? r.top - GAP : r.bottom + GAP, left, above });
  }, []);

  const close = useCallback(() => setCoords(null), []);

  useEffect(() => {
    if (!coords) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [coords, close]);

  const open = coords !== null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="infotip-trigger"
        aria-label={`What is ${title}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={place}
        onMouseLeave={close}
        onFocus={place}
        onBlur={close}
        onClick={() => (open ? close() : place())}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              className="infotip-bubble"
              style={{
                top: coords.top,
                left: coords.left,
                width: WIDTH,
                transform: coords.above ? "translateY(-100%)" : undefined,
              }}
            >
              <p className="infotip-title">{title}</p>
              <p className="infotip-what">{what}</p>
              <p className="infotip-reading">{reading}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
