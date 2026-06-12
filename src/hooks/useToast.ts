import { useEffect, useState } from "react";

export type ToastSeverity = "info" | "warn" | "error";

export type Toast = {
  id: string;
  message: string;
  severity: ToastSeverity;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn(toasts);
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_TTL_MS = 5000;

export function pushToast(message: string, severity: ToastSeverity = "info", ttlMs = DEFAULT_TTL_MS) {
  const id = nextId();
  toasts = [...toasts, { id, message, severity }];
  emit();
  if (ttlMs > 0) {
    setTimeout(() => dismissToast(id), ttlMs);
  }
  return id;
}

export function dismissToast(id: string) {
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) emit();
}

export function useToasts(): Toast[] {
  const [snapshot, setSnapshot] = useState<Toast[]>(toasts);
  useEffect(() => {
    const fn: Listener = (next) => setSnapshot(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return snapshot;
}
