import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, perDayText } from "@/lib/legacy-cta";
import { ageWord } from "@/lib/lifeprotect-cta";
import type { CashRow } from "@/lib/lifeprotect-quote";
import { firstPaymentLines } from "@/lib/first-payment";

/** The age picker's value: an age the plan takes, or "over" for everyone past the last. */
export type LifeTreasureAge = number | "over";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

export interface LifeTreasureCtaFacts {
  sumAssured: number;
  /** the term as the button words it, e.g. "ชำระเบี้ย 12 ปี" */
  termLabel: string;
  age: LifeTreasureAge;
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
export function lifeTreasureMessage(f: LifeTreasureCtaFacts): string {
  const head = `สนใจไลฟ์เทรเชอร์ ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} ${f.termLabel} อายุ${f.age === 0 ? "" : " "}${ageWord(f.age)} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface LifeTreasureQuoteFacts {
  sumAssured: number;
  termLabel: string;
  age: number;
  sex: Sex;
  /** how many years the premium is paid */
  years: number;
  /** the age cover runs to */
  coverToAge: number;
  /** every instalment the company will take, headline first */
  modes: ModePremium[];
  /** every premium over the paying term, in satang */
  total: number;
  /** the sum as a multiple of the premiums paid, or null when it is not more than one */
  leverage: number | null;
  cash: CashRow[];
  /** the share of premiums paid the death benefit never falls below */
  premiumFloorPercent: number;
}

/**
 * The quote as the agent pastes it into a chat.
 *
 * The order is the one an estate buyer asks in: what the family receives, what the policy is
 * worth if it is ever cashed in, and only then what the whole thing costs — which is the
 * line this plan is bought or refused on, so it carries the multiple beside it.
 */
export function lifeTreasureQuoteText(f: LifeTreasureQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  const lines = [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    "🏛️ ไลฟ์เทรเชอร์ — มรดกที่ระบุจำนวนได้",
    `ทุน ${baht(f.sumAssured)} บาท · คุ้มครองถึงอายุ ${f.coverToAge}`,
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
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    `- ${baht(f.sumAssured)} บาท ทุกช่วงอายุ`,
    `- และไม่น้อยกว่า ${f.premiumFloorPercent}% ของเบี้ยที่ชำระมาแล้ว หรือมูลค่าเวนคืน แล้วแต่จำนวนใดมากกว่า`,
  ];
  if (f.cash.length > 0) {
    lines.push("", "🏦 มูลค่าเงินสดสะสม (หากเวนคืน)", ...f.cash.map((r) => `- อายุ ${r.age} ปี ${baht(r.amount)} บาท`));
  }
  lines.push(
    "",
    `📌 เบี้ยรวมตลอด ${f.years} ปี ${formatBaht(f.total)} บาท`
      + (f.leverage ? ` (ส่งต่อ ${f.leverage.toFixed(1)} เท่าของเบี้ยที่จ่าย)` : ""),
    "เบี้ยคงที่ตลอดระยะเวลาชำระ · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
  );
  return lines.join("\n");
}
