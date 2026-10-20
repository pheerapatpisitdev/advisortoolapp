/**
 * The plan calculators, for members only (owner, 2026-10-20: "เฉพาะสมาชิกเท่านั้นที่สามารถเข้าไป
 * คำนวณเบี้ยได้ … สมาชิกหมายถึงคนที่ทดลองใช้ด้วย"). Each page calls `gateCalc`
 * (src/lib/auth/viewer.ts); /fhc was signed-in only already. Plain data, so the bots can read
 * it without the session code: a customer is never sent a link to one of these.
 */
export const CALC_PATHS = [
  "/lifeprotect", "/ihealthy-ultra", "/ishield", "/bumnan95", "/global-saving", "/legacy", "/plb",
  "/cancer", "/ci123", "/easyprotect", "/lifetreasure", "/group-insurance", "/fhc",
] as const;

export type CalcPath = (typeof CALC_PATHS)[number];

/** whether a path of this site (query and all) is one of the calculators or under one */
export function isCalcPath(path: string): boolean {
  const bare = path.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  return CALC_PATHS.some((p) => bare === p || bare.startsWith(`${p}/`));
}
