import type { CardRiders } from "@/lib/card-link";
import { riderWords } from "@/lib/lifeprotect-cta";
import { medicalPlansAt, needsParent, pickedRider, riderSoldAt } from "@/lib/lifeprotect-quote";
import type { LifeProtectTable } from "@/lib/lifeprotect-table";

/**
 * The riders a customer asks a chat for, and the card they are answered with.
 *
 * A chat card used to carry none, so "เพิ่ม beyond ให้ด้วย" was handed to the admin though the
 * sales page has priced the same rider since 2026-10-06. What is asked for is read off the
 * message — never by the model, because a rider is a price and a price is the table's.
 */

/**
 * What the customer has asked for so far, as they said it: a part they did not name stays
 * open for the age to settle, so "เพิ่ม Beyond" is a flavour and not yet a contract.
 */
export interface RidersWanted {
  /** the premium waiver, which of the two contracts and which flavour; either may be open */
  waiver?: { code?: "PB" | "WP"; option?: "FIT" | "BEYOND" };
  /**
   * The medical rider, which the owner calls the daily compensation: in hospital, it pays a
   * sum a day (2026-10-07). "any" is a customer who did not name the sum.
   */
  medical?: number | "any";
  /** the parent a child's พีบี is priced off, once they have been asked */
  payer?: { sex: "M" | "F"; age: number };
  /** "ไม่เอาสัญญาเพิ่มเติม": what had been chosen is dropped */
  none?: true;
}

/** The sum a day offered when the customer does not name one. */
const DEFAULT_DAILY = 1000;

const NONE = /(?:ไม่\s*(?:เอา|ต้อง(?:การ)?|รับ)|ยกเลิก|เอาออก)\s*(?:สัญญาเพิ่มเติม|สัญญาแนบ|สัญญาเสริม|ไรเดอร์|rider|meb|พีบี|pb|wp|ดับบลิวพี|beyond|บียอนด์)/i;
/** the medical rider: its name, and the ways a customer says "money for the nights in hospital" */
const MEDICAL = /(?<![a-z])meb(?![a-z])|เอ็ม\s*อี\s*บี|ชดเชยรายวัน|ค่าห้อง|นอน\s*(?:โรงพยาบาล|รพ)|แอดมิด|admit|สัญญา(?:เพิ่มเติม)?\s*ค่ารักษา/i;
const DAILY_SUM = /(?:วันละ|meb|แผน)\s*([\d,]{3,5})/i;
/** "ผู้ชำระเบี้ย" is left out on purpose: it is the question of whose health is declared, not a rider */
const PB = /(?<![a-z])pb(?![a-z])|พี\s*บี/i;
const WP = /(?<![a-z])wp(?![a-z])|ดับบลิว\s*พี|ดับเบิ้ลยู\s*พี|ยกเว้นเบี้ย/i;
const BEYOND = /beyond|บียอนด์|บียอน|บีออนด์/i;
const FIT = /(?<![a-z])fit(?![a-z])|ฟิต/i;
const BROAD = /สัญญาเพิ่มเติม|สัญญาแนบ|สัญญาเสริม|ไรเดอร์|(?<![a-z])riders?(?![a-z])/i;

/** The sums the medical rider is written in, so a stray number is not taken for one. */
function plannedSum(text: string): number | undefined {
  const m = DAILY_SUM.exec(text);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isInteger(n) && n >= 500 && n <= 5000 && n % 500 === 0 ? n : undefined;
}

/** What a message asks for in riders; undefined when it asks for none. */
export function ridersIn(text: string): RidersWanted | undefined {
  if (NONE.test(text)) return { none: true };
  const medical = MEDICAL.test(text) ? plannedSum(text) ?? "any" : undefined;
  const code = PB.test(text) ? "PB" as const : WP.test(text) ? "WP" as const : undefined;
  const option = BEYOND.test(text) ? "BEYOND" as const : FIT.test(text) ? "FIT" as const : undefined;
  // a broad "สัญญาเพิ่มเติม" with the medical rider named is about the medical rider alone
  const waiver = code || option || (BROAD.test(text) && medical === undefined)
    ? { ...(code ? { code } : {}), ...(option ? { option } : {}) }
    : undefined;
  if (!waiver && medical === undefined) return undefined;
  return { ...(waiver ? { waiver } : {}), ...(medical !== undefined ? { medical } : {}) };
}

/**
 * A parent, as the answer to "ขออายุกับเพศของผู้ปกครอง": "แม่ 35", "คุณพ่ออายุ 41 ปี",
 * "ผู้ปกครองหญิง 38". Both halves are needed, or it is not an answer.
 */
export function payerIn(text: string): { sex: "M" | "F"; age: number } | undefined {
  const age = /(\d{2})(?!\d)/.exec(text);
  if (!age) return undefined;
  const sex = /แม่|มารดา|หญิง|ผญ|(?<![ก-๛])ญ(?![ก-๛])/.test(text)
    ? "F"
    : /พ่อ|บิดา|ชาย|ผช|(?<![ก-๛])ช(?![ก-๛])/.test(text) ? "M" : undefined;
  return sex ? { sex, age: Number(age[1]) } : undefined;
}

/**
 * The riders as this code could have written them, or undefined. On the website the slots go
 * to the browser and come back, so whatever arrives may have been written by anyone: every
 * field is checked against what `ridersIn` and `payerIn` produce, and a field that fails is
 * dropped. The table still decides what may be sold; this only keeps the shape honest.
 */
export function cleanRiders(raw: unknown): RidersWanted | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const { waiver, medical, payer } = raw as Record<string, unknown>;
  const w = waiver && typeof waiver === "object" && !Array.isArray(waiver) ? waiver as Record<string, unknown> : undefined;
  const p = payer && typeof payer === "object" && !Array.isArray(payer) ? payer as Record<string, unknown> : undefined;
  const code = w?.code === "PB" || w?.code === "WP" ? w.code : undefined;
  const option = w?.option === "FIT" || w?.option === "BEYOND" ? w.option : undefined;
  const sum = medical === "any" || (typeof medical === "number" && Number.isInteger(medical) && medical >= 500 && medical <= 5000)
    ? medical as number | "any" : undefined;
  const parent = p && (p.sex === "M" || p.sex === "F") && typeof p.age === "number" && Number.isInteger(p.age)
    && p.age >= 0 && p.age <= 120
    ? { sex: p.sex as "M" | "F", age: p.age } : undefined;
  const out: RidersWanted = {
    ...(w ? { waiver: { ...(code ? { code } : {}), ...(option ? { option } : {}) } } : {}),
    ...(sum !== undefined ? { medical: sum } : {}),
    ...(parent ? { payer: parent } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** What was chosen before, changed only where the new message speaks. */
export function mergeRiders(before: RidersWanted | undefined, now: RidersWanted | undefined): RidersWanted | undefined {
  if (!now) return before;
  if (now.none) return undefined;
  const waiver = before?.waiver || now.waiver ? { ...before?.waiver, ...now.waiver } : undefined;
  const medical = now.medical ?? before?.medical;
  const payer = now.payer ?? before?.payer;
  return {
    ...(waiver ? { waiver } : {}),
    ...(medical !== undefined ? { medical } : {}),
    ...(payer ? { payer } : {}),
  };
}

export type Resolved =
  | { kind: "ok"; riders: CardRiders }
  /** a child's พีบี is priced off a parent the chat has not been given, or was given out of range */
  | { kind: "payer"; payerMin: number; payerMax: number }
  /** this age cannot have what was asked for; `text` says why, `replies` are what it may have */
  | { kind: "unsold"; text: string; replies?: string[] };

/** The button for a sum a day, worded so the router reads it back. */
export const dailyButton = (plan: number): string => `นอน รพ. วันละ ${plan.toLocaleString("en-US")}`;

/**
 * What the riders asked for come to on this insured, or why they cannot.
 *
 * Nothing is guessed: a rider the age may not buy is said so, and a child's พีบี waits for a
 * parent. The premium is the page's, from lifeProtectPriced, once this has said it is sold.
 */
export function resolveRiders(
  table: LifeProtectTable, who: { age: number; sex: "M" | "F" }, wanted: RidersWanted,
): Resolved {
  const riders: CardRiders = {};

  if (wanted.waiver) {
    // an adult pays their own premium, so the waiver is theirs; a child's is the parent's
    const code = wanted.waiver.code ?? (who.age < (table.riders.find((r) => r.code === "WP")?.ageMin ?? 16) ? "PB" : "WP");
    const option = wanted.waiver.option ?? "FIT";
    const picked = pickedRider(table, { code, option });
    if (!picked || !riderSoldAt(picked.rider, who.age)) {
      const wp = table.riders.find((r) => r.code === "WP");
      const pb = table.riders.find((r) => r.code === "PB");
      return {
        kind: "unsold",
        text: code === "WP" && wp
          ? `ดับบลิวพีขายตั้งแต่อายุ ${wp.ageMin} ปีครับ สำหรับเด็กใช้พีบีที่ผู้ปกครองเป็นผู้ชำระเบี้ย`
          : `${picked ? riderWords(picked.rider.name).short : "สัญญานี้"}ไม่ขายที่อายุ ${who.age} ปีครับ`
            + (pb && wp ? ` (พีบีอายุ ${pb.ageMin}-${pb.ageMax} ปี หรือเด็กที่ผู้ปกครองจ่ายเบี้ย · ดับบลิวพีอายุ ${wp.ageMin}-${wp.ageMax} ปี)` : ""),
      };
    }
    if (needsParent(picked.rider, who.age)) {
      const child = picked.rider.child!;
      const payer = wanted.payer;
      if (!payer || payer.age < child.payerMin || payer.age > child.payerMax) {
        return { kind: "payer", payerMin: child.payerMin, payerMax: child.payerMax };
      }
      riders.payer = payer;
    }
    riders.waiver = { code, option };
  }

  if (wanted.medical !== undefined) {
    const medical = table.medical;
    const plans = medical ? medicalPlansAt(table, medical, who.age) : [];
    if (!medical || plans.length === 0) {
      return {
        kind: "unsold",
        text: `ค่าชดเชยรายวัน (MEB) ขายอายุ ${medical?.ageMin ?? 6}-${medical?.ageMax ?? 65} ปีครับ ที่อายุ ${who.age} ปีทำไม่ได้`,
      };
    }
    if (wanted.medical === "any") {
      // a thousand a day, or the most the age may have below it
      riders.medical = [...plans].reverse().find((p) => p <= DEFAULT_DAILY) ?? plans[0];
    } else if (plans.includes(wanted.medical)) {
      riders.medical = wanted.medical;
    } else {
      return {
        kind: "unsold",
        text: `อายุ ${who.age} ปี ซื้อค่าชดเชยรายวัน (MEB) ได้วันละ ${plans.map((p) => p.toLocaleString("en-US")).join(", ")} บาทครับ`,
        replies: plans.slice(-3).map(dailyButton),
      };
    }
  }
  return { kind: "ok", riders };
}
