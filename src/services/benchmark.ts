import { apiFetch } from "./api-url";

export type BenchmarkQuote = {
  current: number;
  asOf: string;
  changePct: number;
};

/** Latest KSE100 level (PKR index points). Returns null if unavailable. */
export async function fetchBenchmark(): Promise<BenchmarkQuote | null> {
  try {
    const res = await apiFetch("/api/psx/benchmark");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.current !== "number") return null;
    return data as BenchmarkQuote;
  } catch {
    return null;
  }
}
