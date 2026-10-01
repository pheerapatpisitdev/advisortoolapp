/**
 * What the owner types on /admin/wallet, read on the server: the browser is not the guard
 * (the same rule as src/app/admin/ai/budget.ts).
 */

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
