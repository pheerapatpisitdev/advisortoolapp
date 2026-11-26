import { ciMoney, ciRowSub, type Ci123VideoFacts } from "./ci123";
import type { AmountRow, Stair } from "./stage-pictures";

/**
 * CI 123's three scenes of its own (owner, 2026-11-26, ข on https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p), as
 * words and figures for the shared pictures (stage-pictures.tsx): the stages that climb to the whole sum, what else
 * it pays, and the base contract's life cover. Every drawer reads these, so the four cannot say it differently.
 */

export const CI_STAIRS_KICKER = "เจอเร็ว ได้เร็ว";
export const CI_STAIRS_SUB = "ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะ";
export const CI_STAIRS_FOOT = "ระยะรุนแรงจ่ายเต็มทุน หักส่วนที่จ่ายไปแล้ว";
export const CI_MORE_KICKER = "คุ้มครองเพิ่มอีก";
export const CI_BASE_KICKER = "แบบหลักคุ้มครองชีวิตด้วย";
export const CI_BASE_SUB = "ถ้าเป็นอะไรไป ครอบครัวได้";
export const ciBaseFoot = (g: Ci123VideoFacts) => `Life Protect x2 ทุน ${ciMoney(g.baseSum)} บาท`;

/** the stairs: "ก่อนเริ่มต้น" over "6 โรค", what each pays */
export const ciStairs = (g: Ci123VideoFacts): Stair[] => g.stairs.map((r) => ({ label: r.short, sub: `${r.count} โรค`, amount: r.amount }));

/** what else it pays, critical care lit; each with how many conditions, its share, and its own limit under it */
export const ciMoreRows = (g: Ci123VideoFacts): AmountRow[] => g.more.map((r) => ({
  label: r.key === "special conditions" ? "โรคภายใต้เงื่อนไขพิเศษ" : r.label,
  sub: ciRowSub(r), ...(r.note ? { note: r.note } : {}), amount: r.amount, on: r.key === "critical care benefit",
}));

/** the base contract's life cover by age */
export const ciBaseRows = (g: Ci123VideoFacts): AmountRow[] => g.deathRows.map((r) => ({ label: r.label, sub: "ครอบครัวได้", amount: r.amount, on: r.on }));
