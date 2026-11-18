import type { ModePremium } from "@/calc/mode-premiums";
import type { Sex } from "@/calc/types";
import { formatBaht, formatSatang } from "@/calc/money";
import { PER, perDayText } from "@/lib/legacy-cta";
import { ageWord, instalmentLines, lifeProtectFootnote } from "@/lib/lifeprotect-cta";
import { excelRound } from "@/lib/twelvepl-benefits";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const baht = (n: number) => excelRound(n).toLocaleString("en-US");

export interface TwelvePlQuoteFacts {
  sumAssured: number;
  age: number;
  sex: Sex;
  coverToAge: number;
  /** every instalment the company will take, headline first */
  modes: ModePremium[];
  parts?: { base: ModePremium; riders: { name: string; own: ModePremium }[] };
  /** the plan's own yearly premium, in satang, and the total over the 12 years */
  annualBase: number;
  totalBase: number;
  /** guaranteed: cash backs over the contract, and the maturity at 85 with its last cash back */
  cashBacks: number;
  maturity: number;
  /** the dividend example on the page (ตัวอย่างที่ 2 or 3), when one is shown */
  dividend?: { example: number; total: number };
  renewing: string[];
  deathExtra: string[];
}

/** The quote as the agent pastes it into a chat, in the order the page shows it. */
export function twelvePlQuoteText(f: TwelvePlQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  return [
    "🛡️ 12 พีแอล (12PL)",
    `ทุน ${baht(f.sumAssured)} บาท · คุ้มครองถึงอายุ ${f.coverToAge}`,
    `${SEX_WORD[f.sex]} อายุ ${ageWord(f.age)} · ชำระเบี้ย 12 ปี`,
    "",
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    ...(f.parts && f.parts.riders.length > 0
      ? [
        `- สัญญาหลัก ${formatSatang(f.parts.base.total)} บาท${PER[f.parts.base.mode]}`,
        ...f.parts.riders.map((r) => `- ${r.name} ${formatSatang(r.own.total)} บาท${PER[r.own.mode]}`),
      ]
      : []),
    ...instalmentLines(f.modes),
    `เบี้ยสัญญาหลักรวม 12 ปี ${formatBaht(f.totalBase)} บาท`,
    "",
    "🎁 ผลประโยชน์รับรอง",
    `- เงินคืนทุกปี ตั้งแต่ปีที่ 2 รวม ${baht(f.cashBacks)} บาท`,
    `- ครบสัญญาอายุ ${f.coverToAge} รับ ${baht(f.maturity)} บาท`,
    `- รวมรับรอง ${baht(f.cashBacks + f.maturity)} บาท`,
    ...(f.dividend && f.dividend.total > 0
      ? [`- เงินปันผล (ไม่รับรอง ตัวอย่างที่ ${f.dividend.example}) รวม ${baht(f.dividend.total)} บาท`]
      : []),
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    `- ทุกช่วงอายุ ถึงอายุ ${f.coverToAge} ${baht(f.sumAssured)} บาท (หรือมูลค่าเวนคืน หากมากกว่า)`,
    ...f.deathExtra,
    "",
    `📌 ${lifeProtectFootnote(f.renewing)}`,
  ].join("\n");
}
