import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { displayPremium, PER, perDayText } from "@/lib/legacy-cta";
import type { Ci123Stage } from "@/lib/ci123-table";
import { firstPaymentLines } from "@/lib/first-payment";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/**
 * What one stage pays on a given CI 123 sum, in baht — the share, held under its cap.
 * The same arithmetic the engine prices the component on (`composite-ci.ts`).
 *
 * Here rather than beside the table, because the calculator runs in the browser and the
 * table's module imports the rate tables.
 */
export function stagePays(stage: Pick<Ci123Stage, "share" | "cap">, sum: number): number {
  const raw = stage.share * sum;
  return stage.cap === null ? raw : Math.min(raw, stage.cap);
}

/** A CI 123 sum as a person says it: "5 แสน", "1 ล้าน". */
export function sumWords(sum: number): string {
  return sum < 1_000_000
    ? `${(sum / 100_000).toLocaleString("en-US")} แสน`
    : `${(sum / 1_000_000).toLocaleString("en-US")} ล้าน`;
}

/** The age picker's value, as on the legacy page: an age, somebody outside the range, or nobody yet. */
export type Ci123Age = number | "other" | "";

export interface Ci123MessageFacts {
  sum: number;
  age: Ci123Age;
  sex: Sex;
  range: { min: number; max: number };
  premium: ModePremium | undefined;
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures on screen.
 * Each shortfall asks for what is missing rather than falling silent, as `legacyMessage` does.
 */
export function ci123Message(f: Ci123MessageFacts): string {
  const head = `สนใจ CI 123 ทุน ${sumWords(f.sum)}`;
  if (f.age === "") return head;
  if (f.age === "other") return `${head} อายุนอกช่วง ${f.range.min}–${f.range.max} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} อายุ ${f.age} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface Ci123QuoteFacts {
  sum: number;
  baseSum: number;
  age: number;
  sex: Sex;
  modes: ModePremium[];
  minMonthly: number;
  stages: Ci123Stage[];
  diseaseCount: number;
}

const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

/**
 * The quote as the agent pastes it into a chat, in the order the page shows it: the price,
 * what each stage of an illness pays, and what the two contracts are.
 */
export function ci123QuoteText(f: Ci123QuoteFacts): string {
  const headline = displayPremium(f.modes, false)!;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  return [
    `🛡️ ประกันโรคร้ายแรง CI 123 ทุน ${sumWords(f.sum)}`,
    `${SEX_WORD[f.sex]} อายุ ${f.age}`,
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      if (!m) return [];
      const line = `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`;
      return [m.belowMinimum ? `${line} (ต่ำกว่าขั้นต่ำ ${baht(f.minMonthly)} บาท บริษัทไม่รับชำระรายเดือน)` : line, ...firstPaymentLines(m)];
    }),
    "",
    `🏥 รับเงินก้อนตามระยะของโรค (${f.diseaseCount} โรค)`,
    ...f.stages.map((s) => `- ${s.label} ${baht(stagePays(s, f.sum))} บาท`),
    "",
    "📄 ชุดนี้ประกอบด้วย",
    `- Life Protect x 2 ชำระเบี้ยถึงอายุ 99 ทุน ${baht(f.baseSum)} บาท`,
    `- สัญญาเพิ่มเติม CI 123 ทุน ${baht(f.sum)} บาท`,
    "",
    "📌 เบี้ยปีแรก ส่วน CI 123 คิดตามอายุ จึงปรับขึ้นในปีถัดไป",
    "โรคร้ายแรงเป็นไปตามคำนิยามในกรมธรรม์",
  ].join("\n");
}
