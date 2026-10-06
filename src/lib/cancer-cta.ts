import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { displayPremium, PER, perDayText } from "@/lib/legacy-cta";
import { sumWords } from "@/lib/ci123-cta";
import { CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS, cprStagePays } from "@/lib/cancer-benefits";
import { firstPaymentLines } from "@/lib/first-payment";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** The age picker's value, as on the CI 123 page: an age, somebody outside the range, or nobody yet. */
export type CancerAge = number | "other" | "";

export interface CancerMessageFacts {
  cpr: number;
  hic: number;
  age: CancerAge;
  sex: Sex;
  range: { min: number; max: number };
  premium: ModePremium | undefined;
}

/** What the customer's chat opens with, so whoever answers starts from the figures on screen. */
export function cancerMessage(f: CancerMessageFacts): string {
  const head = `สนใจประกันมะเร็ง ทุน ${sumWords(f.cpr)} ชดเชยวันละ ${f.hic.toLocaleString("en-US")}`;
  if (f.age === "") return head;
  if (f.age === "other") return `${head} อายุนอกช่วง ${f.range.min}–${f.range.max} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} อายุ ${f.age} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface CancerQuoteFacts {
  cpr: number;
  hic: number;
  baseSum: number;
  age: number;
  sex: Sex;
  modes: ModePremium[];
  minMonthly: number;
}

const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

/**
 * The quote as the agent pastes it into a chat, in the order the page shows it: the price,
 * what each stage of a cancer pays, the daily sum, and what the three contracts are.
 */
export function cancerQuoteText(f: CancerQuoteFacts): string {
  const headline = displayPremium(f.modes, false)!;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  return [
    `🎗️ ประกันมะเร็ง ทุน ${sumWords(f.cpr)} ชดเชยวันละ ${baht(f.hic)}`,
    `${SEX_WORD[f.sex]} อายุ ${f.age}`,
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      if (!m) return [];
      const line = `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`;
      return [m.belowMinimum ? `${line} (ต่ำกว่าขั้นต่ำ ${baht(f.minMonthly)} บาท บริษัทไม่รับชำระรายเดือน)` : line, ...firstPaymentLines(m)];
    }),
    "",
    "🔬 ตรวจพบมะเร็ง รับเงินก้อนตามระยะ",
    ...CPR_STAGES.map((s) => `- ${s.label} ${baht(cprStagePays(s, f.cpr))} บาท`),
    "",
    "🏥 นอนโรงพยาบาลเพราะมะเร็ง",
    `- วันละ ${baht(f.hic)} บาท สูงสุด ${HIC_MAX_DAYS} วัน (ระยะลุกลามขยายอีก ${HIC_INVASIVE_EXTRA_DAYS} วัน)`,
    "",
    "📄 ชุดนี้ประกอบด้วย",
    `- Life Protect x 2 ชำระเบี้ยถึงอายุ 99 ทุน ${baht(f.baseSum)} บาท`,
    `- สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR) ทุน ${baht(f.cpr)} บาท`,
    `- สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC) วันละ ${baht(f.hic)} บาท`,
    "",
    "📌 เบี้ยปีแรก ส่วน CPR และ HIC เป็นสัญญาปีต่อปี เบี้ยปรับตามอายุ",
    "โรคมะเร็งเป็นไปตามคำนิยามในกรมธรรม์",
  ].join("\n");
}
