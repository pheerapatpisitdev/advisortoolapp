import type { ModePremium } from "@/calc/mode-premiums";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, perDayText } from "@/lib/legacy-cta";
import { deathBenefitRows } from "@/lib/death-benefit";
import type { CashRow } from "@/lib/lifeprotect-quote";

/** The age picker's value: an age the plan takes, or "over" for everyone past its last. */
export type LifeProtectAge = number | "over";

export interface LifeProtectCtaFacts {
  sumAssured: number;
  /** the term as the button words it, e.g. "จ่าย 19 ปี" */
  termLabel: string;
  age: LifeProtectAge;
  sex: Sex;
  /** the last age the plan issues at, named in the message an older customer sends */
  ageMax: number;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
  /** the rider on the card, named as the contract names it; absent when none is chosen */
  rider?: string;
}

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** Age zero is a newborn, not "0 ปี", everywhere a person reads it. */
export function ageWord(age: number): string {
  return age === 0 ? "แรกเกิด" : String(age);
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already
 * on screen.
 */
export function lifeProtectMessage(f: LifeProtectCtaFacts): string {
  const head = `สนใจ Life Protect x 2 ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const who = `${head} ${f.termLabel} อายุ${f.age === 0 ? "" : " "}${ageWord(f.age)} ${SEX_WORD[f.sex]}`
    + (f.rider ? ` + ${f.rider}` : "");
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}

export interface LifeProtectQuoteFacts {
  sumAssured: number;
  termLabel: string;
  age: number;
  sex: Sex;
  /** every instalment the company will take, headline first; the whole of what is paid */
  modes: ModePremium[];
  /**
   * What the headline instalment is made of, when riders are part of it: the base plan's
   * share and each rider's own, all in the headline's mode. The total above is the figure
   * the customer pays, so the parts go under it rather than in place of it.
   */
  parts?: { base: ModePremium; riders: { name: string; own: ModePremium }[] };
  death: DeathBenefit;
  cash: CashRow[];
}

/**
 * The quote as the agent pastes it into a chat: the card's figures in the card's order, except
 * the cash values, which the owner sends as a second message (2026-10-03).
 */
export function lifeProtectQuoteText(f: LifeProtectQuoteFacts): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  // the doubled sum is the plan's pitch, so it sits with the sum — unless the insured is
  // already past the age it stops at, when there is no doubling to promise
  const sum = f.death.alreadyPastAge
    ? `ทุน ${baht(f.sumAssured)} บาท`
    : `ทุน ${baht(f.sumAssured)} บาท เพิ่มเป็น ${baht(f.death.sumBefore)} ถึงอายุ ${f.death.beforeAge}`;
  const lines = [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    "🛡️ Life Protect x 2",
    sum,
    `${SEX_WORD[f.sex]} อายุ ${ageWord(f.age)} · ${f.termLabel}`,
    "",
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    // the parts of that figure, so a customer reading a bigger number than the plan's own
    // price can see at once what the rest of it buys
    ...(f.parts && f.parts.riders.length > 0
      ? [
        `- สัญญาหลัก ${formatBaht(f.parts.base.total)} บาท${PER[f.parts.base.mode]}`,
        ...f.parts.riders.map((r) => `- ${r.name} ${formatBaht(r.own.total)} บาท${PER[r.own.mode]}`),
      ]
      : []),
    // one instalment a line, smallest first, whichever the card headlines
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      return m ? [`${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`] : [];
    }),
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    ...deathBenefitRows(f.death).map((r) => `- ${r.label} ${baht(r.amount)} บาท`),
    // the cash values are a message of their own (lifeProtectCashText), sent after this one
    "",
    "📌 เบี้ยคงที่ตลอดระยะเวลาชำระ",
    "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
  ];
  return lines.join("\n");
}

/**
 * What the customer gets back by selling the contract to the company, as a message apart from
 * the quote: read inside the quote it looked to customers like money lost, and the owner
 * would rather send it when they ask (2026-10-03). Undefined when the table has no rows.
 */
export function lifeProtectCashText(cash: CashRow[]): string | undefined {
  if (cash.length === 0) return undefined;
  return ["🏦 หากขายคืนบริษัทจะได้", "", ...cash.map((r) => `- อายุ ${r.age} ปี ${r.amount.toLocaleString("en-US")} บาท`)].join("\n");
}

/**
 * The quote as the chat bot sends it, in the owner's own words (2026-09-23).
 *
 * The copy button on the sales page keeps the plainer text above; only the bot talks like
 * this. The wording is the owner's, kept as written — including the price claim and the tax
 * line, which were raised with them and kept. Every figure still comes from the rate table.
 */
export function lifeProtectChatQuoteText(f: Omit<LifeProtectQuoteFacts, "parts"> & { coverToAge: number }): string {
  const [headline] = f.modes;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  const doubles = !f.death.alreadyPastAge;
  const lines = [
    "🛡️ Life Protect",
    ...(doubles
      ? [
        `ทุน ${baht(f.sumAssured)} บาท เพิ่มเป็น ${baht(f.death.sumBefore)} ถึงอายุ ${f.death.beforeAge}`,
        "ระบบ double ทุน ราคาเบี้ยถูกที่สุดจากประสบการณ์เท่าที่ผู้ขายทำงานมากกว่า 10 ปี",
        "ยังไม่เห็นมีที่ไหนขาย",
      ]
      : [`ทุน ${baht(f.sumAssured)} บาท`]),
    "",
    // "จ่ายถึงอายุ 99" reads "ออมถึงอายุ 99", "จ่าย 9 ปี" reads "ออม 9 ปี"
    `${SEX_WORD[f.sex]} อายุ ${ageWord(f.age)} · อย่างนี้ออม${f.termLabel.replace(/^จ่าย/, "")} คุ้มครอง ${f.coverToAge} ปี`,
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    "ทั้งนี้เราสามารถเลือกระยะเวลาในการออมได้",
    "เช่น 9ปี, 19 ปี, 99 ปี",
    "",
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      return m ? [`${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`] : [];
    }),
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต (ตุยเย่)",
    ...(doubles
      ? [
        `- เสียชีวิตก่อนอายุ ${f.death.beforeAge} ปี ภาระหนี้สินเยอะเลย เพิ่มทุนเป็น ${baht(f.death.sumBefore)} บาท`,
        `- อายุ ${f.death.beforeAge} ปีขึ้นไปรับทุน ${baht(f.death.sumFrom)} บาท ตามเบี้ยจริง`,
      ]
      : deathBenefitRows(f.death).map((r) => `- ${r.label} ${baht(r.amount)} บาท`)),
  ];
  if (f.cash.length > 0) {
    lines.push(
      "", "🏦 มูลค่าเงินสดสะสม (หากเวนคืน)",
      "เมื่อเราอายุมากขึ้น มองซ้ายมองขวา ไม่มีเงินที่ไหน ขายคืนโครงการ",
      "ตามอายุดังนี้รับเงินสดไปเลย",
      ...f.cash.map((r) => `- อายุ ${r.age} ปี ${baht(r.amount)} บาท`),
    );
  }
  lines.push("", "📌 เบี้ยคงที่ตลอดระยะเวลาชำระ", "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน", "ลดหย่อนภาษีได้ 100,000 บาท");
  return lines.join("\n");
}

const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];