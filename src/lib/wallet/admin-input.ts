/**
 * What the owner types on /admin/wallet, read on the server: the browser is not the guard
 * (the same rule as src/app/admin/ai/budget.ts).
 */
import { DEFAULT_PRICES, MAX_PRICE_SATANG, PRICE_ITEMS, type Prices } from "./prices";

export const MAX_MULTIPLIER = 10;
/** the most one adjustment moves, either way: a slip of the finger should not be ฿100,000 (owner, 2026-09-30) */
export const MAX_ADJUST_THB = 10000;

export function readMultiplier(s: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = String(s ?? "").trim();
  const v = Number(t);
  if (!t || !Number.isFinite(v) || v < 1 || v > MAX_MULTIPLIER) {
    return { ok: false, error: `ตัวคูณต้องเป็นตัวเลขตั้งแต่ 1 ถึง ${MAX_MULTIPLIER}` };
  }
  return { ok: true, value: v };
}

export function readAdjust(baht: string, note: string): { ok: true; satang: number; note: string } | { ok: false; error: string } {
  const t = String(baht ?? "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return { ok: false, error: "จำนวนเงินต้องเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง ใส่ - นำหน้าเพื่อหักออก" };
  const v = Number(t);
  if (v === 0 || Math.abs(v) > MAX_ADJUST_THB) return { ok: false, error: `ปรับได้ครั้งละไม่เกิน ฿${MAX_ADJUST_THB.toLocaleString("en-US")} และต้องไม่เป็น 0` };
  const reason = String(note ?? "").trim();
  if (!reason) return { ok: false, error: "ต้องใส่เหตุผลทุกครั้ง" };
  return { ok: true, satang: Math.round(v * 100), note: reason.slice(0, 200) };
}

/** the owner's reason for lifting a freeze: always one, as for an adjustment (owner, 2026-10-01) */
export function readUnfreeze(note: string): { ok: true; note: string } | { ok: false; error: string } {
  const reason = String(note ?? "").trim();
  if (!reason) return { ok: false, error: "ต้องใส่เหตุผลทุกครั้ง" };
  return { ok: true, note: reason.slice(0, 200) };
}

/**
 * The owner's price list as typed on /admin/wallet (owner, 2026-10-12): every price in baht, two
 * decimals at most, from ฿0.01 to ฿1,000. All or nothing: one bad price saves none of them.
 */
export function readPrices(raw: Record<string, string>): { ok: true; prices: Prices } | { ok: false; error: string } {
  const prices = { ...DEFAULT_PRICES };
  for (const item of PRICE_ITEMS) {
    const t = String(raw?.[item.key] ?? "").trim();
    const v = Number(t);
    if (!/^\d+(\.\d{1,2})?$/.test(t) || !(v > 0) || v * 100 > MAX_PRICE_SATANG) {
      return { ok: false, error: `ราคา "${item.label}" ต้องเป็นบาท ตั้งแต่ 0.01 ถึง ${(MAX_PRICE_SATANG / 100).toLocaleString("en-US")} ทศนิยมไม่เกิน 2 ตำแหน่ง` };
    }
    prices[item.key] = Math.round(v * 100);
  }
  return { ok: true, prices };
}
