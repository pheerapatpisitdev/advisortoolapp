import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, perDayText } from "@/lib/legacy-cta";
import { firstPaymentLines } from "@/lib/first-payment";

/** The age picker's value: an age the plan takes, or "over" for everyone past the last. */
export type PlbAge = number | "over";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

export interface PlbCtaFacts {
  sumAssured: number;
  /** the term as the button words it, e.g. "ชำระเบี้ย 12 ปี" */
  termLabel: string;
  age: PlbAge;
  sex: Sex;
  /** the oldest age the plan issues at, named in the message an older customer sends */
  ageMax: number;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already
 * on screen.
 */
export function plbMessage(f: PlbCtaFacts): string {
  const head = `สนใจ Protection Life ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} ${f.termLabel} อายุ ${f.age} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface PlbQuoteFacts {
  sumAssured: number;
  termLabel: string;
  age: number;
  sex: Sex;
  /** how many years the premium is paid, which is how many years it covers */
  years: number;
  /** the age the cover ends at */
  endsAtAge: number;
  /** every instalment the company will take, headline first */
  modes: ModePremium[];
  /** every premium over the whole term, in satang */
  total: number;
}

/**
 * The quote as the agent pastes it into a chat.
 *
 * It ends on what the plan does not do. A contract with no surrender value and no maturity
 * payment is the one thing about PLB a customer can find out late and feel sold to over, so
 * it is written into the quote itself rather than left for the agent to remember.
 */
export function plbQuoteText(f: PlbQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  return [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    "🛡️ Protection Life — คุ้มครองชีวิต",
    `ทุน ${baht(f.sumAssured)} บาท · คุ้มครอง ${f.years} ปี (ถึงอายุ ${f.endsAtAge})`,
    "",
    `${SEX_WORD[f.sex]} อายุ ${f.age} · ${f.termLabel}`,
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}`
      + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    "",
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      return m ? [`${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`, ...firstPaymentLines(m)] : [];
    }),
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    `- ${baht(f.sumAssured)} บาท ตลอด ${f.years} ปีที่คุ้มครอง`,
    "",
    "📌 เบี้ยคงที่ตลอดสัญญา รวมทั้งหมด " + `${formatBaht(f.total)} บาท`,
    `แบบนี้เป็นความคุ้มครองล้วน อยู่ครบ ${f.years} ปีแล้วสัญญาสิ้นสุด ไม่มีเงินคืน`,
    "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
  ].join("\n");
}
