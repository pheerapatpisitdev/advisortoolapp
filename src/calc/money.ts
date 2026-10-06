/**
 * All premium arithmetic is done in integer satang (1 baht = 100 satang)
 * so results match Excel's ROUNDDOWN(...,2) exactly, with no float drift.
 *
 * Rates per 1,000 baht of sum assured are stored with 2 decimals in the JSON,
 * so `toHundredths(rate)` is an exact integer ("rate100").
 */

/** 6.47 → 647. Only for values with at most 2 decimals. */
export function toHundredths(n: number): number {
  return Math.round(n * 100);
}

export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/**
 * Excel: ROUNDDOWN(rate * SA / 1000, 2), returned in satang.
 * rate100 = rate * 100 (integer). Result = floor(rate100 * SA / 1000).
 */
export function premiumPerThousand(rate100: number, sumAssured: number): number {
  return floorDiv(rate100 * sumAssured, 1000);
}

/**
 * Excel: ROUNDDOWN(rate * SA / 1000 * factor, 2), returned in satang.
 * factor100 = factor * 100 (annual 100, semi 52, monthly 9).
 * Result = floor(rate100 * SA * factor100 / 100000).
 */
export function applyModeFactor(rate100: number, sumAssured: number, factor100: number): number {
  return floorDiv(rate100 * sumAssured * factor100, 100_000);
}

/** Excel: ROUNDDOWN(annualBaht * factor, 2) for fixed premiums. annual100 in satang. */
export function applyModeFactorToFixed(annual100: number, factor100: number): number {
  return floorDiv(annual100 * factor100, 100);
}

export function satangToBaht(satang: number): number {
  return satang / 100;
}

/**
 * A premium for display, in whole baht. The satang are dropped, not rounded by — the same
 * ROUNDDOWN the premiums themselves are built on, so the figure on screen never claims a
 * baht the arithmetic did not reach. That arithmetic stays exact to the satang above.
 */
export function formatBaht(satang: number): string {
  return Math.floor(satang / 100).toLocaleString("en-US");
}

/**
 * A premium to the satang, for the parts of a total. Parts dropped to whole baht one by one
 * can come to a baht or two less than their total dropped once (1,629.00 + 93.66 + 85.50 is
 * 1,808 whole, 1,807 part by part), so a breakdown shows what each part really is.
 */
export function formatSatang(satang: number): string {
  return (satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
