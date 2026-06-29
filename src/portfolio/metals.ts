import type { MetalId, MetalUnit } from "../types";

/** Grams per weight unit. `shares` for metals is always stored in grams. */
export const GRAMS_PER_UNIT: Record<MetalUnit, number> = {
  tola: 11.6638,
  ounce: 31.1034768, // troy ounce
  gram: 1,
};

export const METAL_UNITS: MetalUnit[] = ["tola", "ounce", "gram"];

export const UNIT_LABEL: Record<MetalUnit, string> = {
  tola: "tola",
  ounce: "oz",
  gram: "g",
};

export const METAL_LABEL: Record<MetalId, string> = {
  gold: "Gold",
  silver: "Silver",
};

/** Spot-quote symbols (gold-api.com / LBMA convention). */
export const METAL_SYMBOL: Record<MetalId, string> = {
  gold: "XAU",
  silver: "XAG",
};

export const GRAMS_PER_TROY_OZ = GRAMS_PER_UNIT.ounce;

export function unitToGrams(qty: number, unit: MetalUnit): number {
  return qty * GRAMS_PER_UNIT[unit];
}

export function gramsToUnit(grams: number, unit: MetalUnit): number {
  return grams / GRAMS_PER_UNIT[unit];
}

export function isMetalUnit(value: unknown): value is MetalUnit {
  return value === "tola" || value === "ounce" || value === "gram";
}

export function isMetalId(value: unknown): value is MetalId {
  return value === "gold" || value === "silver";
}

/** Compact quantity formatter — trims trailing zeros, caps at 4 decimals. */
export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(4)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}
