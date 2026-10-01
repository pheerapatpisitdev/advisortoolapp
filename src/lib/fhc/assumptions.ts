/**
 * The Financial Health Check's rules of thumb, each named in one place, so the owner can move
 * a threshold without reading the scoring. Agreed 2026-09-25 — see
 * docs/superpowers/specs/2026-09-25-fhc-design.md.
 */

/** อายุเฉลี่ยตั้งต้น */
export const DEFAULT_EXPECTANCY = 85;
/** เงินสำรองฉุกเฉิน (เงินสด + ฝากประจำ): กี่เดือนของค่าใช้จ่าย — ตั้งแต่ green = เขียว, ตั้งแต่ yellow = เหลือง */
export const EMERGENCY_MONTHS = { green: 6, yellow: 3 } as const;
/** เงินเหลือต่อเดือน เทียบรายได้ */
export const SAVING_SHARE = { green: 0.2, yellow: 0.1 } as const;
/**
 * หนี้ไม่รวมบ้าน (รถ + บัตรเครดิต/อื่นๆ) เทียบรายได้ต่อปี (น้อยดี): ต่ำกว่า green = เขียว, ไม่เกิน yellow = เหลือง.
 * หนี้บ้านไม่นับ: ผ่อนบ้านหลายเท่าของรายได้เป็นเรื่องปกติ (owner, 2026-10-01) — ยังนับในทุนชีวิตและสินทรัพย์สุทธิ
 */
export const DEBT_YEARS = { green: 1, yellow: 3 } as const;
/** ความคุ้มครองชีวิตและเงินเกษียณ: ที่มี เทียบที่ควรมี */
export const COVER_SHARE = { green: 1, yellow: 0.5 } as const;

export type WorkAbility = "full" | "partial" | "none";
export const WORK_ABILITY_LABEL: Record<WorkAbility, string> = {
  full: "ทำงานได้เต็มที่",
  partial: "ทำงานได้บางส่วน",
  none: "ทำงานไม่ได้",
};
/** ค่าความสามารถในการทำงาน: ทำงานได้บางส่วน นับเท่านี้ของรายได้ตลอดปีที่เหลือ */
export const PARTIAL_WORK_SHARE = 0.5;

export type Relation = "child" | "spouse" | "parent" | "other";
export const RELATION_LABEL: Record<Relation, string> = {
  child: "ลูก",
  spouse: "คู่สมรส",
  parent: "พ่อแม่",
  other: "อื่นๆ",
};
/** แถวคนในความดูแลที่ให้กรอก */
export const MAX_PEOPLE = 4;

/** FHC's five events, in its own order */
export type EventKey = "illness" | "accident" | "disability" | "death" | "jobLoss";
export const EVENTS: { key: EventKey; name: string }[] = [
  { key: "illness", name: "การเจ็บป่วย" },
  { key: "accident", name: "อุบัติเหตุ" },
  { key: "disability", name: "ทุพพลภาพถาวร" },
  { key: "death", name: "การจากไปโดยไม่ทันตั้งตัว" },
  { key: "jobLoss", name: "การตกงาน" },
];
