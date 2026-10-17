/**
 * What the owner types on /admin/wallet, read on the server: the browser is not the guard
 * (the same rule as src/app/admin/ai/budget.ts).
 */
import type { PassSettings } from "@/lib/members/pass";
import type { ReferralSettings } from "@/lib/referrals/referral";
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

/** the member pass's bounds (owner, 2026-10-13): a slip of the finger should not price a month at ฿10,000 */
// Stripe will not charge less than ฿10 (review, 2026-10-13)
export const MIN_PASS_BAHT = 10;
export const MAX_PASS_BAHT = 1000;
export const MAX_TRIAL_DAYS = 30;
/** the most Studio credit the trial or a paid 30 days may carry, in baht */
export const MAX_PASS_CREDIT_BAHT = 1000;

/** A whole number from min to max, or null. */
function wholeIn(s: string, min: number, max: number): number | null {
  const t = String(s ?? "").trim();
  if (!/^-?\d+$/.test(t)) return null;
  const v = Number(t);
  return v >= min && v <= max ? v : null;
}

/**
 * The member pass as typed on /admin/prices (owner, 2026-10-13): the price per 30 days in baht
 * (two decimals at most, ฿1 to ฿1,000), the free trial in days, and the Studio credit in whole
 * baht the trial and every paid 30 days carry (owner, 2026-10-17: ฿15 and ฿50).
 */
export function readPassSettings(raw: { enabled: boolean; baht: string; trialDays: string; trialCredit: string; credit: string }):
  { ok: true; value: PassSettings } | { ok: false; error: string } {
  const t = String(raw?.baht ?? "").trim();
  const baht = Number(t);
  if (!/^\d+(\.\d{1,2})?$/.test(t) || baht < MIN_PASS_BAHT || baht > MAX_PASS_BAHT) {
    return { ok: false, error: `ราคาต่อ 30 วันต้องเป็นบาท ตั้งแต่ ${MIN_PASS_BAHT} ถึง ${MAX_PASS_BAHT.toLocaleString("en-US")} ทศนิยมไม่เกิน 2 ตำแหน่ง` };
  }
  const trialDays = wholeIn(raw?.trialDays, 0, MAX_TRIAL_DAYS);
  if (trialDays === null) return { ok: false, error: `วันทดลองใช้ต้องเป็นจำนวนเต็ม ตั้งแต่ 0 ถึง ${MAX_TRIAL_DAYS}` };
  const trialCredit = wholeIn(raw?.trialCredit, 0, MAX_PASS_CREDIT_BAHT);
  if (trialCredit === null) return { ok: false, error: `เครดิตช่วงทดลองต้องเป็นบาทเต็ม ตั้งแต่ 0 ถึง ${MAX_PASS_CREDIT_BAHT.toLocaleString("en-US")}` };
  const credit = wholeIn(raw?.credit, 0, MAX_PASS_CREDIT_BAHT);
  if (credit === null) return { ok: false, error: `เครดิตต่อ 30 วันต้องเป็นบาทเต็ม ตั้งแต่ 0 ถึง ${MAX_PASS_CREDIT_BAHT.toLocaleString("en-US")}` };
  return {
    ok: true,
    value: { enabled: raw?.enabled === true, satang: Math.round(baht * 100), trialDays, trialCreditSatang: trialCredit * 100, creditSatang: credit * 100 },
  };
}

export const MAX_REFERRAL_DAYS = 30;
export const MAX_REFERRAL_DAYS_CAP = 365;
export const MAX_REFERRAL_BAHT = 100;
export const MAX_REFERRAL_BAHT_CAP = 5000;

/**
 * เพื่อนชวนเพื่อน as typed on /admin/wallet (owner, 2026-10-14): a member's free days per friend
 * and a month's most, and a UnitOS agent's baht per friend and a month's most.
 */
export function readReferralSettings(raw: { enabled: boolean; days: string; daysCap: string; baht: string; bahtCap: string }):
  { ok: true; value: ReferralSettings } | { ok: false; error: string } {
  const days = wholeIn(raw?.days, 0, MAX_REFERRAL_DAYS);
  if (days === null) return { ok: false, error: `วันฟรีต่อเพื่อนต้องเป็นจำนวนเต็ม ตั้งแต่ 0 ถึง ${MAX_REFERRAL_DAYS}` };
  const daysCap = wholeIn(raw?.daysCap, 0, MAX_REFERRAL_DAYS_CAP);
  if (daysCap === null) return { ok: false, error: `วันฟรีสูงสุดต่อเดือนต้องเป็นจำนวนเต็ม ตั้งแต่ 0 ถึง ${MAX_REFERRAL_DAYS_CAP}` };
  const baht = wholeIn(raw?.baht, 0, MAX_REFERRAL_BAHT);
  if (baht === null) return { ok: false, error: `เงินต่อเพื่อนต้องเป็นบาทเต็ม ตั้งแต่ 0 ถึง ${MAX_REFERRAL_BAHT}` };
  const bahtCap = wholeIn(raw?.bahtCap, 0, MAX_REFERRAL_BAHT_CAP);
  if (bahtCap === null) return { ok: false, error: `เงินสูงสุดต่อเดือนต้องเป็นบาทเต็ม ตั้งแต่ 0 ถึง ${MAX_REFERRAL_BAHT_CAP.toLocaleString("en-US")}` };
  return { ok: true, value: { enabled: raw?.enabled === true, days, daysCap, satang: baht * 100, satangCap: bahtCap * 100 } };
}
