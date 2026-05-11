import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ConfirmOpts = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type PendingOpts = ConfirmOpts & { resolve: (v: boolean) => void };

export function useConfirm() {
  const [pending, setPending] = useState<PendingOpts | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (result: boolean) => {
      setPending((cur) => {
        if (cur) cur.resolve(result);
        return null;
      });
    },
    [],
  );

  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      tone={pending.tone}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onCancel,
  onConfirm,
}: ConfirmOpts & { onCancel: () => void; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={`confirm-card confirm-card--${tone}`}>
        <h3 id="confirm-title" className="confirm-title">
          {title}
        </h3>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button type="button" className="button button-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`button ${tone === "danger" ? "button-danger" : "button-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
