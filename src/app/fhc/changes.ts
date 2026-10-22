import { HEALTH_NOW } from "@/components/plan/fields";
import { WORK_ABILITY_LABEL } from "@/lib/fhc/assumptions";
import { AREA_LABEL, GAP_WORD, type Gap } from "@/lib/fhc/gaps";
import type { FhcInput } from "@/lib/fhc/health";
import { HOSPITAL_LABEL, LIFE_WANT_LABEL } from "@/lib/plan/assumptions";

/**
 * What a re-check changed from the check kept in the agent's list, in the form's own words, so
 * the agent can choose to keep the new one (owner, 2026-10-22, mockup MGFQ7GbQGeBxhUVisLjtij ข).
 */

export interface Change {
  label: string;
  from: string;
  to: string;
}

const baht = (v: number) => (v ? Math.round(v).toLocaleString("en-US") : "ไม่มี");
const plain = (v: number) => String(v);

/** In the form's order, each with how its value reads. */
const FIELDS: { key: keyof FhcInput; label: string; show: (v: never) => string }[] = [
  { key: "age", label: "อายุ", show: plain },
  { key: "sex", label: "เพศ", show: (v: FhcInput["sex"]) => (v === "F" ? "หญิง" : "ชาย") },
  { key: "retireAge", label: "อายุเกษียณ", show: plain },
  { key: "expectancy", label: "อายุเฉลี่ย", show: plain },
  { key: "work", label: "ความสามารถในการทำงาน", show: (v: FhcInput["work"]) => WORK_ABILITY_LABEL[v] },
  { key: "expense", label: "ค่าใช้จ่ายต่อเดือน", show: baht },
  { key: "income", label: "รายได้ต่อเดือน", show: baht },
  { key: "cash", label: "เงินสด / ออมทรัพย์", show: baht },
  { key: "fixed", label: "เงินฝากประจำ", show: baht },
  { key: "otherSaving", label: "เงินเก็บอื่นๆ", show: baht },
  { key: "homeLoan", label: "สินเชื่อบ้าน", show: baht },
  { key: "carLoan", label: "สินเชื่อรถ", show: baht },
  { key: "otherDebt", label: "บัตรเครดิต / หนี้อื่นๆ", show: baht },
  { key: "taxFund", label: "กองทุน LTF / RMF / SSF", show: baht },
  { key: "stocks", label: "หุ้น / สินทรัพย์อื่นๆ", show: baht },
  { key: "people", label: "คนในความดูแล", show: (v: FhcInput["people"]) => (v.length ? `${v.length} คน` : "ไม่มี") },
  { key: "lifeCover", label: "ทุนประกันชีวิต", show: baht },
  { key: "ciCover", label: "ทุนประกันโรคร้ายแรง", show: baht },
  { key: "premiumsNow", label: "เบี้ยที่จ่ายอยู่ต่อปี", show: baht },
  { key: "pensionHave", label: "บำนาญที่คาดว่าจะได้", show: baht },
  { key: "retireMonthly", label: "เงินใช้หลังเกษียณต่อเดือน", show: baht },
  { key: "budget", label: "งบเบี้ยเพิ่มต่อเดือน", show: baht },
  { key: "healthNow", label: "สิทธิ์ค่ารักษาตอนนี้", show: (v: FhcInput["healthNow"]) => HEALTH_NOW.find(([k]) => k === v)?.[1] ?? v },
  { key: "healthRoom", label: "ค่าห้องที่ประกันจ่าย", show: baht },
  { key: "hospital", label: "โรงพยาบาลที่อยากใช้", show: (v: FhcInput["hospital"]) => HOSPITAL_LABEL[v] },
  { key: "lifeWant", label: "แบบประกันชีวิตที่อยากได้", show: (v: FhcInput["lifeWant"]) => LIFE_WANT_LABEL[v].title },
];

/** The fields that differ; people count as changed when any relation or age moved, even at the same head count. */
export function formChanges(was: FhcInput, now: FhcInput): Change[] {
  return FIELDS.flatMap(({ key, label, show }): Change[] => {
    const a = was[key];
    const b = now[key];
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    const from = (show as (v: unknown) => string)(a);
    const to = (show as (v: unknown) => string)(b);
    return [{ label, from, to: to === from ? `${to} (แก้อายุหรือความสัมพันธ์)` : to }];
  });
}

/** The covers whose state moved, e.g. ชีวิต ไม่พอ → ขาด. */
export function gapChanges(was: Gap[], now: Gap[]): Change[] {
  return now.flatMap((g): Change[] => {
    const old = was.find((x) => x.key === g.key);
    return old && old.state !== g.state
      ? [{ label: `ประกัน${AREA_LABEL[g.key]}`, from: GAP_WORD[old.state], to: GAP_WORD[g.state] }]
      : [];
  });
}
