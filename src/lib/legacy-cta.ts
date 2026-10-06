import type { ModePremium } from "@/calc/mode-premiums";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { deathBenefitRows } from "@/lib/death-benefit";
import { firstPaymentLines } from "@/lib/first-payment";

/**
 * The instalment to put in the largest type. A customer reads a monthly figure as what the
 * plan costs, so it is preferred — but only while the company will actually take it. Under
 * its monthly floor the instalment is not a price anyone can pay, so the yearly premium
 * takes the headline rather than a number the application would be refused for.
 *
 * Undefined means no price may be shown: the rate table has expired, or the arrangement
 * could not be priced at all.
 */
export function displayPremium(
  modes: ModePremium[] | undefined, expired: boolean,
): ModePremium | undefined {
  if (!modes || expired) return undefined;
  const monthly = modes.find((m) => m.mode === "monthly");
  if (monthly && !monthly.belowMinimum) return monthly;
  return modes.find((m) => m.mode === "annual");
}

/**
 * The yearly premium as whole baht a day — the figure that makes a five-digit number feel
 * like something. Rounded up rather than down: a day rate the premium does not actually
 * reach would be an understatement of the price.
 */
export function perDay(annualSatang: number): number {
  return Math.ceil(annualSatang / 100 / 365);
}

/**
 * The same figure grouped for reading. A premium big enough to cost four figures a day is
 * rare but real — ten million of ไลฟ์เทรเชอร์ is over a thousand baht a day — and "1014"
 * printed beside grouped numbers everywhere else reads as a typo.
 */
export function perDayText(annualSatang: number): string {
  return perDay(annualSatang).toLocaleString("en-US");
}

/** How each instalment reads after a figure, where the customer says it out loud. */
export const PER: Record<PayMode, string> = { annual: "/ปี", semi: "/6 เดือน", monthly: "/เดือน" };

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

export interface LegacyFacts {
  /** the tier, as the round number of millions the family receives */
  millions: number;
  /** an age the bundle takes, "other" for everyone outside it, "" before one is picked */
  age: LegacyAge;
  sex: Sex;
  /** the ages the bundle issues at, named in the message an outsider sends */
  range: { min: number; max: number };
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

/**
 * The age picker's value. Whether the bundle can take the age is the shape of this value
 * rather than a flag beside it, so the two cannot disagree.
 */
export type LegacyAge = number | "other" | "";

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already
 * on screen instead of asking for them again.
 *
 * Each shortfall says what it wants instead of falling silent: no age yet asks about the
 * sum, an age the bundle refuses asks for a plan that fits it, and a withheld price asks
 * for the current one.
 */
export function legacyMessage(facts: LegacyFacts): string {
  const head = `สนใจมรดกเพื่อครอบครัว ${facts.millions} ล้าน`;
  if (facts.age === "") return head;
  if (facts.age === "other") {
    return `${head} อายุนอกช่วง ${facts.range.min}–${facts.range.max} ปี ขอแบบที่เหมาะกับอายุนี้`;
  }
  const who = `${head} อายุ ${facts.age} ${SEX_WORD[facts.sex]}`;
  if (!facts.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(facts.premium.total)} บาท${PER[facts.premium.mode]}`;
}

/** The agency's Facebook Page, LuckyPlanner โชคดีที่มีแพลน — the one place a customer is sent to talk to a person. */
export const FACEBOOK_PAGE = "105982528649026";

/** Where the agent answers the people who wrote to that Page. */
export const PAGE_INBOX_URL = "https://business.facebook.com/latest/inbox";

/**
 * The chat is opened with the message waiting in the input box, never sent for the
 * customer: the first thing they do in the chat should still be their own doing.
 */
export function messengerUrl(text: string): string {
  return `https://m.me/${FACEBOOK_PAGE}?text=${encodeURIComponent(text)}`;
}

export interface LegacyQuoteFacts {
  millions: number;
  age: number;
  sex: Sex;
  /** every instalment the arrangement prices, including one the company would refuse */
  modes: ModePremium[];
  /** the smallest monthly instalment the company accepts, in baht */
  minMonthly: number;
  /** what the insured receives on a critical illness claim, in baht */
  critical: number;
  death: DeathBenefit;
  diseaseCount: number;
}

/**
 * The quote as the agent pastes it into a chat: every figure the card shows, in the order
 * the card shows it, so what the customer reads in the chat is what they saw on the page.
 */
export function legacyQuoteText(f: LegacyQuoteFacts): string {
  const headline = displayPremium(f.modes, false)!;
  const annual = f.modes.find((m) => m.mode === "annual");
  const baht = (n: number) => n.toLocaleString("en-US");
  return [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    `🛡️ มรดกเพื่อครอบครัว ${f.millions} ล้าน`,
    `${SEX_WORD[f.sex]} อายุ ${f.age}`,
    `💰 เบี้ยประมาณ ${formatBaht(headline.total)} บาท${PER[headline.mode]}` + (annual ? ` (ตกวันละ ${perDayText(annual.total)} บาท)` : ""),
    // one instalment a line, smallest first. An instalment the company refuses is still
    // named, with the reason: an agent asked for it by name should not have to guess why
    // the quote left it out.
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = f.modes.find((x) => x.mode === mode);
      if (!m) return [];
      const line = `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`;
      return [m.belowMinimum ? `${line} (ต่ำกว่าขั้นต่ำ ${baht(f.minMonthly)} บาท บริษัทไม่รับชำระรายเดือน)` : line, ...firstPaymentLines(m)];
    }),
    "",
    `🏥 ตรวจพบโรคร้ายแรง รับเงินสดเอง ${baht(f.critical)} บาท`,
    "(จ่ายครั้งเดียวแล้วสัญญาโรคร้ายแรงสิ้นสุด ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว)",
    "",
    "👪 ครอบครัวได้รับเมื่อเสียชีวิต",
    ...deathBenefitRows(f.death).map((r) => `- ${r.label} ${baht(r.amount)} บาท`),
    "",
    "📌 เบี้ยปีแรก ส่วนสัญญาโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไป",
    `โรคร้ายแรงเป็นไปตามคำนิยาม 1 ใน ${f.diseaseCount} โรคในกรมธรรม์`,
  ].join("\n");
}

const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];