import {
  CARE_LABEL, DECIDER_LABEL, HELP_LABEL, PLACE_LABEL, TIE_LABEL, WORRY_LABEL, ageOn, budgetWord, thaiDay, yearlyOf,
  type SurveyAnswers, type WorryKey,
} from "./answers";

/**
 * "สรุปก่อนนัด": what the agent takes to the meeting, read off the answers. Each worry opens the
 * calculator the owner matched to it (2026-10-22): ค่ารักษา → iHealthy Ultra, เกษียณ → บำนาญ 95,
 * ทุนการศึกษา → Global Savings 15/8, รายได้ครอบครัว → Life Protect; a health worry also offers
 * iShield for critical illness. Links carry the customer's age and sex, and the yearly budget
 * where the calculator takes a premium.
 */

export interface CalcLink {
  worry: WorryKey;
  name: string;
  href: string;
}

const CALC_NAME: Record<WorryKey, string> = {
  health: "iHealthy Ultra", retire: "บำนาญ 95", education: "Global Savings 15/8", income: "Life Protect",
};

/** Life Protect and iShield open a quote only from a whole one: their own opening sum and term */
const LP_OPEN = { sum: 1_000_000, variant: "WLF19H" };
const ISHIELD_OPEN = { sum: 1_000_000, variant: "WLCI10" };

export function calcLink(worry: WorryKey, age: number, sex: "M" | "F", yearly: number): CalcLink {
  const q = new URLSearchParams({ age: String(age), sex });
  const href = (() => {
    switch (worry) {
      case "health": return `/ihealthy-ultra?${q}`;
      case "retire": if (yearly) q.set("premium", String(yearly)); return `/bumnan95?${q}`;
      case "education": if (yearly) q.set("premium", String(yearly)); return `/global-saving?${q}`;
      case "income": q.set("sum", String(LP_OPEN.sum)); q.set("variant", LP_OPEN.variant); return `/lifeprotect?${q}`;
    }
  })();
  return { worry, name: CALC_NAME[worry], href };
}

export function ishieldLink(age: number, sex: "M" | "F"): string {
  return `/ishield?${new URLSearchParams({ age: String(age), sex, sum: String(ISHIELD_OPEN.sum), variant: ISHIELD_OPEN.variant })}`;
}

export interface Summary {
  age: number;
  meeting: string;
  rows: [string, string][];
  /** the first is the worry ranked top; then the others */
  calcs: CalcLink[];
  ishield: string | null;
  promised: string[];
}

export function summarize(a: SurveyAnswers, today: string): Summary {
  const age = ageOn(a.birth, today) ?? 0;
  const yearly = yearlyOf(a.budget);
  const worries = [...(a.top ? [a.top] : []), ...a.also];
  const meeting = `${thaiDay(a.date)} ${a.time} น.${a.place ? ` · ${PLACE_LABEL[a.place]}` : ""}`;
  const kids = a.kids !== null ? ` · ลูก ${a.kids} คน${a.eldest !== null ? ` คนโต ${a.eldest} ปี` : ""}` : "";
  const held = a.companies.length
    ? `${a.companies.join(", ")}${a.years !== null ? ` ${a.years} ปี` : ""}${a.tie ? ` · ตัวแทนเป็น${TIE_LABEL[a.tie]}` : ""}${a.care ? ` ${CARE_LABEL[a.care]}` : ""}`
    : "ยังไม่มีประกัน";

  const rows: [string, string][] = [["นัด", meeting]];
  if (a.decider && a.decider !== "self") rows.push(["ร่วมฟัง", `${DECIDER_LABEL[a.decider]} ต้องอยู่ด้วย`]);
  if (a.top) rows.push(["ห่วงที่สุด", `${WORRY_LABEL[a.top]}${a.top === "education" ? kids : ""}`]);
  if (a.also.length) rows.push(["ห่วงด้วย", a.also.map((k) => `${WORRY_LABEL[k]}${k === "education" ? kids : ""}`).join(", ")]);
  if (a.budget) rows.push(["งบ", budgetWord(a.budget)]);
  rows.push(["ประกันเดิม", held]);
  if (a.planned !== null) rows.push(["วางแผนการเงิน", a.planned ? "เคยมีคนวางแผนให้" : "ยังไม่เคย"]);
  rows.push(["อายุ", `${age} ปี · ${a.sex === "F" ? "หญิง" : "ชาย"}`]);

  return {
    age, meeting, rows,
    calcs: worries.map((k) => calcLink(k, age, a.sex, yearly)),
    ishield: worries.includes("health") ? ishieldLink(age, a.sex) : null,
    promised: a.help.map((h) => `${HELP_LABEL[h]}${a.companies.length ? ` (${a.companies.join(", ")})` : ""}`),
  };
}

/** The summary as text, for the agent to copy to their own notes or LINE. */
export function summaryText(a: SurveyAnswers, s: Summary): string {
  const lines = [`สรุปก่อนนัด · คุณ${a.name}`, `โทร ${a.phone}`, ...s.rows.map(([k, v]) => `${k}: ${v}`)];
  if (a.address) lines.push(`ที่อยู่: ${a.address}`);
  if (s.calcs.length) lines.push("", "เตรียมไปวันนัด", ...s.calcs.map((c, i) => `• ${c.name}${i === 0 && a.top ? " (ห่วงที่สุด)" : ""}`));
  if (s.promised.length) lines.push(...s.promised.map((p) => `• รับปากไว้: ${p}`));
  return lines.join("\n");
}
