// D1 answers valid queries with a transient "D1_ERROR: internal error" often
// enough that one of them took the whole app down with an HTTP 500. Reads retry
// once; writes deliberately do not, since a retry after a write that actually
// landed would apply it twice.

import { describe, expect, it, vi } from "vitest";
import { d1Adapter } from "./db-adapter.mjs";

/** Minimal stand-in for the D1 binding. */
function fakeD1({ firstImpl, allImpl, runImpl }) {
  return {
    prepare() {
      const stmt = {
        bind: () => stmt,
        first: firstImpl,
        all: allImpl,
        run: runImpl,
      };
      return stmt;
    },
    batch: vi.fn(),
  };
}

const transient = () => new Error("D1_ERROR: internal error; reference = romch2vpjnd");

describe("d1Adapter read retries", () => {
  it("retries a transient failure once and returns the second result", async () => {
    const firstImpl = vi
      .fn()
      .mockRejectedValueOnce(transient())
      .mockResolvedValueOnce({ value: "ok" });

    const db = d1Adapter(fakeD1({ firstImpl }));
    await expect(db.first("SELECT 1")).resolves.toEqual({ value: "ok" });
    expect(firstImpl).toHaveBeenCalledTimes(2);
  });

  it("retries all() the same way", async () => {
    const allImpl = vi
      .fn()
      .mockRejectedValueOnce(transient())
      .mockResolvedValueOnce({ results: [{ n: 1 }] });

    const db = d1Adapter(fakeD1({ allImpl }));
    await expect(db.all("SELECT 1")).resolves.toEqual([{ n: 1 }]);
    expect(allImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry rather than looping", async () => {
    const firstImpl = vi.fn().mockRejectedValue(transient());
    const db = d1Adapter(fakeD1({ firstImpl }));

    await expect(db.first("SELECT 1")).rejects.toThrow(/D1_ERROR/);
    expect(firstImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry an error that is not transient", async () => {
    const firstImpl = vi.fn().mockRejectedValue(new Error("no such column: bogus"));
    const db = d1Adapter(fakeD1({ firstImpl }));

    await expect(db.first("SELECT bogus")).rejects.toThrow(/no such column/);
    expect(firstImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry writes", async () => {
    const runImpl = vi.fn().mockRejectedValue(transient());
    const db = d1Adapter(fakeD1({ runImpl }));

    await expect(db.run("DELETE FROM x")).rejects.toThrow(/D1_ERROR/);
    expect(runImpl).toHaveBeenCalledTimes(1);
  });

  it("passes a successful read straight through without a second call", async () => {
    const firstImpl = vi.fn().mockResolvedValue({ value: "v" });
    const db = d1Adapter(fakeD1({ firstImpl }));

    await expect(db.first("SELECT 1")).resolves.toEqual({ value: "v" });
    expect(firstImpl).toHaveBeenCalledTimes(1);
  });

  it("normalises a missing row to null", async () => {
    const db = d1Adapter(fakeD1({ firstImpl: vi.fn().mockResolvedValue(undefined) }));
    await expect(db.first("SELECT 1")).resolves.toBeNull();
  });
});
