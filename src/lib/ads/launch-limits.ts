/**
 * The two checks that run before any request that can spend money: how much a day, and where
 * the ad sends people. Kept free of the database and of Meta so the form and the launch core
 * can both call them, and so a test can pin every edge without touching either.
 */

/** Baht a day, until ADS_MAX_DAILY_BUDGET_THB says otherwise. A typo in a box is cheaper to stop here than to refund. */
export const DEFAULT_MAX_DAILY_BUDGET_THB = 500;

/**
 * The cap in baht. Only a positive whole number in the env counts; anything else (empty,
 * "-1", "1.5", words) falls back to the default rather than turning the cap off or into NaN,
 * which every comparison would then let through.
 */
export function maxDailyBudgetThb(env: Record<string, string | undefined> = process.env): number {
  const raw = env.ADS_MAX_DAILY_BUDGET_THB?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_MAX_DAILY_BUDGET_THB;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : DEFAULT_MAX_DAILY_BUDGET_THB;
}

export type BudgetCheck = { ok: true; minor: number } | { ok: false; error: string };

/**
 * A daily budget in whole baht, 1 up to the cap. `minor` is what Meta takes: THB counts in
 * satang, so baht x 100. Other currencies are refused rather than guessed at — their minor
 * units differ (JPY has none), and sending the wrong one would spend 100x or 1/100 of it.
 */
export function checkDailyBudget(baht: number, currency: string | null, max: number = maxDailyBudgetThb()): BudgetCheck {
  if (currency !== "THB") return { ok: false, error: "รองรับเฉพาะบัญชีโฆษณาสกุลบาท (THB)" };
  if (!Number.isInteger(baht) || baht < 1) return { ok: false, error: "งบต่อวันต้องเป็นบาทเต็มจำนวน อย่างน้อย 1 บาท" };
  if (baht > max) return { ok: false, error: `งบต่อวันสูงสุด ${max} บาท` };
  return { ok: true, minor: baht * 100 };
}

export type LinkCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * The page the ad's button opens. Only web links with a host: `javascript:` and friends would
 * parse as a URL too, and a bare "x.test" does not parse at all, so the scheme is checked
 * rather than trusting `new URL` to throw.
 */
export function checkLink(raw: string): LinkCheck {
  const text = raw.trim();
  if (!text) return { ok: false, error: "ใส่ลิงก์ปลายทาง" };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "ลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://" };
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) {
    return { ok: false, error: "ลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://" };
  }
  return { ok: true, url: url.toString() };
}
