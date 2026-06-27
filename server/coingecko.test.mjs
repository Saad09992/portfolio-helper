import { describe, it, expect } from "vitest";
import { mapSimplePrice } from "./coingecko.mjs";

describe("mapSimplePrice", () => {
  const json = {
    bitcoin: { pkr: 16790088, pkr_24h_change: 1.78, usd: 60277, usd_24h_change: 1.71 },
    ethereum: { pkr: 440766, pkr_24h_change: -3.05, usd: 1582.36, usd_24h_change: -2.99 },
  };

  it("maps PKR price, USD secondary, and 24h change by id", () => {
    const out = mapSimplePrice(json, ["bitcoin", "ethereum"]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      coinId: "bitcoin",
      current: 16790088,
      usdPrice: 60277,
      changePct: 1.78,
      source: "coingecko",
    });
    expect(out[1].changePct).toBe(-3.05);
  });

  it("skips ids missing from the response or lacking a PKR price", () => {
    expect(mapSimplePrice(json, ["dogecoin"])).toEqual([]);
    expect(mapSimplePrice({ x: { usd: 1 } }, ["x"])).toEqual([]);
  });
});
