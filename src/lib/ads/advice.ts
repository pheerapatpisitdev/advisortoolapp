/**
 * What ผลแอด suggests for a running ad (spec 2026-10-07), against the Page's cost per chat over
 * the last 30 days across every ad, those built in Ads Manager too. The rules are checked top to
 * bottom and the first that fits wins:
 *
 * | รอดูต่อ  | spend < 1 × baseline (too little to judge) |
 * | ควรหยุด | 0 chats and spend ≥ 2 × baseline |
 * | ควรหยุด | cost per chat ≥ 1.5 × baseline and spend ≥ 3 × baseline |
 * | เพิ่มงบ  | ≥ 3 chats and cost per chat ≤ 0.7 × baseline |
 * | รอดูต่อ  | anything else |
 *
 * Each says why in the numbers it used, whole baht.
 */

/** the baseline of a Page with no chat in 30 days */
export const BASELINE_FALLBACK_THB = 60;

export type AdviceKind = "raise" | "wait" | "stop";
export interface Advice { kind: AdviceKind; reason: string }

const baht = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
/** a ratio to one decimal, without a trailing .0 */
const times = (n: number) => String(Math.floor(n * 10) / 10);

/** The Page's spend over its chats, whole baht; the fallback when it has none. */
export function baselineCost(rows: { spend: number; messaging_started: number }[]): number {
  const spend = rows.reduce((s, r) => s + Number(r.spend), 0);
  const chats = rows.reduce((s, r) => s + Number(r.messaging_started), 0);
  return chats > 0 ? Math.round(spend / chats) : BASELINE_FALLBACK_THB;
}

export function advise(a: { spend: number; chats: number; baseline: number; running: boolean }): Advice | null {
  if (!a.running) return null;
  const { spend, chats, baseline } = a;
  const avg = baht(baseline);
  if (spend < baseline) return { kind: "wait", reason: `ใช้ไป ${baht(spend)} ยังน้อยกว่าค่าเฉลี่ยต่อแชท ${avg} รอดูต่อ` };
  if (chats === 0) {
    if (spend >= 2 * baseline) return { kind: "stop", reason: `ใช้ไป ${baht(spend)} = ${times(spend / baseline)} เท่าของค่าเฉลี่ย ยังไม่มีแชท` };
    return { kind: "wait", reason: `ใช้ไป ${baht(spend)} ยังไม่มีแชท รอดูต่อ` };
  }
  const cost = spend / chats;
  if (cost >= 1.5 * baseline && spend >= 3 * baseline) {
    return { kind: "stop", reason: `${baht(cost)}/แชท แพงกว่าค่าเฉลี่ย ${avg} เกิน 1.5 เท่า` };
  }
  if (chats >= 3 && cost <= 0.7 * baseline) {
    return { kind: "raise", reason: `${baht(cost)}/แชท ถูกกว่าค่าเฉลี่ย ${avg} ได้ ${chats} แชทแล้ว` };
  }
  if (cost <= 0.7 * baseline) return { kind: "wait", reason: `${baht(cost)}/แชท ถูกกว่าค่าเฉลี่ย ${avg} แต่ยังได้แค่ ${chats} แชท รอดูต่อ` };
  if (cost >= 1.5 * baseline) return { kind: "wait", reason: `${baht(cost)}/แชท แพงกว่าค่าเฉลี่ย ${avg} รอดูต่อ` };
  return { kind: "wait", reason: `${baht(cost)}/แชท ใกล้ค่าเฉลี่ย ${avg} รอดูต่อ` };
}
