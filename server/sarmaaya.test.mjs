import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseSarmaayaQuote, parseSarmaayaDividend } from "./sarmaaya.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
  join(__dirname, "__fixtures__", "sarmaaya-engro.html"),
  "utf-8",
);

describe("parseSarmaayaQuote", () => {
  it("extracts price, signed change %, and asOf from the __next_f payload", () => {
    const q = parseSarmaayaQuote(FIXTURE, "engro");
    expect(q).not.toBeNull();
    expect(q.ticker).toBe("ENGRO");
    expect(q.current).toBe(485.38);
    expect(q.changePct).toBe(1.48);
    expect(q.asOf).toBe("2025-02-25T12:45:26.031Z");
    expect(q.source).toBe("sarmaaya");
  });

  it("applies a negative sign when `change` is negative", () => {
    const html = String.raw`x \"close\":100.5,\"change\":-2.3,\"change_percentage\":2.24 y`;
    const q = parseSarmaayaQuote(html, "TEST");
    expect(q.current).toBe(100.5);
    expect(q.changePct).toBeCloseTo(-2.24, 5);
  });

  it("falls back to the <title> price when no close key is present", () => {
    const html = "<title>HBL - Rs 1,234.50 | Habib Bank | Sarmaaya</title>";
    const q = parseSarmaayaQuote(html, "HBL");
    expect(q.current).toBe(1234.5);
    expect(q.changePct).toBe(0);
  });

  it("returns null on junk HTML with no price", () => {
    expect(parseSarmaayaQuote("<html>no data here</html>", "X")).toBeNull();
  });
});

describe("parseSarmaayaDividend", () => {
  it("returns null when payouts are lazy-loaded (not in HTML) — current reality", () => {
    expect(parseSarmaayaDividend(FIXTURE, "ENGRO")).toBeNull();
  });

  it("parses future, positive payouts when present server-side", () => {
    const future = "2999-01-15";
    const html = String.raw`a \"payouts\":[ \"amount\":12.5 \"ex_date\":\"${future}\" \"record_date\":\"${future}\" ] b`;
    const out = parseSarmaayaDividend(html, "ENGRO", Date.now());
    expect(out).not.toBeNull();
    expect(out.dividendPerShare).toBe(12.5);
    expect(out.payouts[0].bookClosureDate).toBe(future);
    expect(out.source).toBe("sarmaaya");
  });

  it("skips past-dated payouts", () => {
    const html = String.raw`a \"payouts\":[ \"amount\":5 \"ex_date\":\"2000-01-01\" \"record_date\":\"2000-01-10\" ] b`;
    expect(parseSarmaayaDividend(html, "ENGRO", Date.now())).toBeNull();
  });
});
