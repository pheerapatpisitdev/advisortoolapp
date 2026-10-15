/**
 * What the monthly budget box on /admin/ai is allowed to say, checked on the server.
 *
 * Kept apart from actions.ts because a "use server" file may export nothing but async
 * functions, and this wants to be a plain function a test can call with a string.
 *
 * The rules, and why each one is here:
 *
 * An empty box means no limit. Zero used to be accepted and then read two ways at once: the
 * page said "ยังไม่ได้ตั้งงบ", because 0 is falsy, while the AI client read it as a ฿0 ceiling
 * and stopped answering every customer. A box that can switch the bot off by looking like it
 * switches nothing on is not a box to leave that way, so 0 and anything below it are refused,
 * with the way to say "no limit" in the refusal itself.
 *
 * The budget may not be set below เพดานงบใช้ฟรี (ราคาและโปรโมชัน, owner 2026-10-15): agents'
 * free use reaching its own ceiling would then stop every AI call, the bots' included. That
 * ceiling took the place of งบสร้างคอนเทนต์, the second box this page had until the same day.
 *
 * Numbers arrive as the strings the browser sent, not as numbers the browser made: Number()
 * on the client turns "abc" into NaN, and NaN passes `< 0` and `> x` alike, which is how a
 * nonsense value would have reached the database.
 */

/** Far above anything this business spends on AI in a month; a typo guard, not a policy. */
export const MAX_BUDGET_THB = 1_000_000;

export type BudgetCheck = { ok: true; monthly: number | null } | { ok: false; error: string };

const baht = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

/** "" → null; otherwise the number, or NaN for anything that is not one. Commas are forgiven. */
function parse(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").replace(/[,\s฿]/g, "");
  if (s === "") return null;
  // Number("1e3") is 1000 and Number("0x10") is 16; neither is how anybody writes baht
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** `freeCap`: เพดานงบใช้ฟรี as set, null when there is none */
export function checkBudget(monthlyRaw: string | null | undefined, freeCap: number | null): BudgetCheck {
  const monthly = parse(monthlyRaw);
  if (monthly !== null) {
    if (!Number.isFinite(monthly)) return { ok: false, error: "งบต่อเดือนต้องเป็นตัวเลข — ถ้าไม่อยากจำกัดให้เว้นว่าง" };
    if (monthly <= 0) return { ok: false, error: "งบต้องมากกว่า 0 — ถ้าไม่อยากจำกัดให้เว้นว่าง" };
    if (monthly > MAX_BUDGET_THB) return { ok: false, error: `งบต่อเดือนสูงเกินไป ใส่ได้ไม่เกิน ${baht(MAX_BUDGET_THB)}` };
    if (freeCap !== null && monthly < freeCap) {
      return { ok: false, error: `งบต่อเดือนต้องไม่น้อยกว่าเพดานงบใช้ฟรี (${baht(freeCap)}) ที่หน้าราคาและโปรโมชัน` };
    }
  }
  return { ok: true, monthly: monthly === null ? null : Math.round(monthly * 100) / 100 };
}
