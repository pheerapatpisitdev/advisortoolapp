import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, perDayText } from "@/lib/legacy-cta";
import { ageWord } from "@/lib/lifeprotect-cta";
import type { CashRow } from "@/lib/lifeprotect-quote";
import { firstPaymentLines } from "@/lib/first-payment";

/** The age picker's value: an age some term still takes, or "over" for everyone past the last. */
export type IShieldAge = number | "over";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

export interface IShieldCtaFacts {
  sumAssured: number;
  /** the term as the button words it, e.g. "ชำระเบี้ย 10 ปี" */
  termLabel: string;
  age: IShieldAge;
  sex: Sex;
  /** the last age any term issues at, named in the message an older customer sends */
  ageMax: number;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already
 * on screen.
 */
export function iShieldMessage(f: IShieldCtaFacts): string {
  const head = `สนใจ iShield ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} ${f.termLabel} อายุ${f.age === 0 ? "" : " "}${ageWord(f.age)} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface IShieldQuoteFacts {
  sumAssured: number;
  termLabel: string;
  age: number;
  sex: Sex;
  /** every instalment the company will take, headline first */
  modes: ModePremium[];
  /** what a diagnosis pays, in baht */
  illness: { early: number; major: number };
  /** how many illnesses each stage names, and the days before either is covered */
  counts: { earlyCount: number; majorCount: number; waitingDays: number };
  maturityAge: number;
  cash: CashRow[];
}

/**
 * The quote as the agent pastes it into a chat. iShield's order is not Life Protect's: what
 * a diagnosis pays comes before what death pays, because that is the half of the contract a
 * customer is deciding about.
 */
export function iShieldQuoteText(f: IShieldQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  const lines = [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    "🛡️ iShield — ชีวิตและโรคร้ายแรง",
    `ทุน ${baht(f.sumAssured)} บาท · คุ้มครองถึงอายุ ${f.maturityAge}`,
    "",
    `${SEX_WORD[f.sex]} อายุ ${ageWord(f.age)} · ${f.termLabel}`,
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}`
      + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    "",
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      return m ? [`${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`, ...firstPaymentLines(m)] : [];
    }),
    "",
    "🩺 ตรวจพบโรคร้ายแรง",
    `- ระยะเริ่มต้น ${f.counts.earlyCount} โรค ${baht(f.illness.early)} บาทต่อโรค`,
    `- ระยะรุนแรง ${f.counts.majorCount} โรค สูงสุด ${baht(f.illness.major)} บาท`,
    "",
    "👪 เสียชีวิต",
    `- ${baht(f.sumAssured)} บาท`,
    "",
    `🎁 อยู่ครบสัญญาอายุ ${f.maturityAge}`,
    `- รับคืน ${baht(f.sumAssured)} บาท`,
  ];
  if (f.cash.length > 0) {
    lines.push("", "🏦 มูลค่าเงินสดสะสม (หากเวนคืน)", ...f.cash.map((r) => `- อายุ ${r.age} ปี ${baht(r.amount)} บาท`));
  }
  lines.push(
    "",
    `📌 โรคร้ายแรงคุ้มครองหลังกรมธรรม์มีผล ${f.counts.waitingDays} วัน`,
    "เบี้ยคงที่ตลอดระยะเวลาชำระ · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
  );
  return lines.join("\n");
}
