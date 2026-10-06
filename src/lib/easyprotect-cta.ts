import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, perDayText } from "@/lib/legacy-cta";
import { ageWord } from "@/lib/lifeprotect-cta";
import type { CashRow } from "@/lib/lifeprotect-quote";
import { firstPaymentLines } from "@/lib/first-payment";

/** The age picker's value: an age the plan takes, or "over" for everyone past the last. */
export type EasyProtectAge = number | "over";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

export interface EasyProtectCtaFacts {
  sumAssured: number;
  age: EasyProtectAge;
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
export function easyProtectMessage(f: EasyProtectCtaFacts): string {
  const head = `สนใจอีซี่ โพรเทค 6 ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} อายุ${f.age === 0 ? "" : " "}${ageWord(f.age)} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface EasyProtectQuoteFacts {
  sumAssured: number;
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
 * It opens on the bargain this plan is: six years in, cover for life. The premium comes
 * first, then what the six years add up to — because the whole decision is whether that
 * total is worth the cover beside it — and the cash values come last, as the answer to
 * "what if I stop".
 */
export function easyProtectQuoteText(f: EasyProtectQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  const lines = [
    "🛡️ อีซี่ โพรเทค 6 — จ่าย 6 ปี คุ้มครองถึง 99",
    `ทุน ${baht(f.sumAssured)} บาท · ${SEX_WORD[f.sex]} อายุ ${ageWord(f.age)}`,
    "",
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}`
      + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    "",
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      return m ? [`${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`, ...firstPaymentLines(m)] : [];
    }),
    "",
    `📌 จ่ายแค่ ${f.years} ปี รวม ${formatBaht(f.total)} บาท แล้วไม่ต้องจ่ายอีก`
      + (f.leverage ? ` (คุ้มครองเป็น ${f.leverage.toFixed(1)} เท่าของเบี้ยที่จ่าย)` : ""),
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    `- ${baht(f.sumAssured)} บาท ทุกช่วงอายุ จนถึงอายุ ${f.coverToAge}`,
    `- และไม่น้อยกว่า ${f.premiumFloorPercent}% ของเบี้ยที่ชำระมาแล้ว หรือมูลค่าเวนคืน แล้วแต่จำนวนใดมากกว่า`,
  ];
  if (f.cash.length > 0) {
    lines.push("", "🏦 มูลค่าเงินสดสะสม (หากเวนคืน)", ...f.cash.map((r) => `- อายุ ${r.age} ปี ${baht(r.amount)} บาท`));
  }
  lines.push(
    "",
    "เบี้ยคงที่ตลอด 6 ปี · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
  );
  return lines.join("\n");
}
