import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { valueTableCard } from "@/lib/quote-card";
import { cardPath, valueTablePath } from "@/lib/card-link";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { firstPaymentLines } from "@/lib/first-payment";
import { coverIn, peopleIn } from "@/lib/assistant/common";
import { priceFollowUps, type GuideItem, type PriceGap } from "./guide";

/**
 * Premiums for the plans the Messenger brains never learned.
 *
 * The brains speak for two products and cost nine hundred lines each, because each one holds
 * a whole conversation: its own FAQ, its own prompts, its own way of reading a message. The
 * other four plans do not need any of that here. What they need is the one path from a
 * question to a figure, and every piece of that path is already plan-agnostic — `quote()`
 * prices any plan in the registry, `/api/card` draws any of them, and the rules are already
 * in the knowledge.
 *
 * So this is the wiring and nothing more. Where a plan differs, it is asked about rather than
 * assumed: only Life Protect has a default package in the registry, and the difference
 * between paying for five years and paying for twenty is most of the premium.
 */

const money = (satang: number) => Math.round(satang / 100).toLocaleString("en-US");

/** The plans this can price, by the names a person writes. Life Protect is not here — it has a brain. */
const PLANS: [code: string, label: string, re: RegExp][] = [
  ["PLB", "Protection Life (PLB)", /protection\s*life|\bplb\b|โพรเทคชั่น\s*ไลฟ์|พีแอลบี/i],
  ["ISMART", "iSmart 80/6", /i\s*-?\s*smart|ไอ\s*สมาร์ท/i],
  ["LIFETREASURE", "Life Treasure", /life\s*treasure|ไลฟ์\s*(?:เทรเชอร์|ทรีเชอร์|เทรชเชอร์)/i],
  ["ISHIELD", "iShield", /i\s*-?\s*shield|ไอ\s*ชิลด์/i],
  ["EASYPROTECT", "อีซี่ โพรเทค 6", /easy\s*protect|อีซี่\s*โพรเทค|อีซี่\s*โปรเทค/i],
];

/**
 * The plans this file will put a figure on, asked rather than listed.
 *
 * The knowledge base has to tell the model which plans the chat can price, and the first
 * version of that was a hand-kept list holding one plan. It stayed at one after this file
 * taught the chat three more — so the assistant spent a while telling customers to go to
 * another page for a premium it could have produced in the next sentence. A list that can
 * disagree with the code will.
 */
export function pricedHere(): Set<string> {
  return new Set(PLANS.filter(([code]) => !getPlan(code)?.rules.base.premiumBasis).map(([code]) => code));
}

export function planNamedIn(text: string): { code: string; label: string } | undefined {
  const hit = PLANS.find(([, , re]) => re.test(text));
  return hit ? { code: hit[0], label: hit[1] } : undefined;
}

/**
 * The message with the plan's own name taken out of it, before the facts are read.
 *
 * Because a product name can contain numbers, and the readers cannot tell those from a
 * customer's. "iSmart 80/6 ชาย 40 ทุน 1 ล้าน" was read as a six-year-old — the reader pairs a
 * number with the sex word beside it, found "6 ชาย" first, and the quotation came back
 * refused for an age outside the plan's range. The name is on the page, on the card and in
 * the guide button, so it is exactly what a person types.
 *
 * A model number is removed only where it sits against the name it belongs to, so a sum, an
 * age or a paying term standing on its own is never touched.
 */
function withoutPlanName(text: string): string {
  let out = text;
  for (const [, , re] of PLANS) {
    out = out.replace(new RegExp(`(${re.source})\\s*\\d{1,3}\\s*/\\s*\\d{1,3}`, "gi"), " ");
    out = out.replace(new RegExp(re.source, "gi"), " ");
  }
  return out;
}

export interface PriceReply {
  text: string;
  cards?: string[];
  /** true when a figure was produced, so the page can say it came from the engine */
  priced: boolean;
  /**
   * The next questions, as buttons.
   *
   * They matter most exactly where the answer is a refusal: being told a paying term is
   * needed and being handed the four terms on offer are very different experiences of the
   * same sentence.
   */
  guide?: GuideItem[];
  /**
   * The sales page's PDF of the quote on the first card, when a page prints this plan. The
   * dispatcher puts it on the message beside that card, where it is remembered (pdf.ts).
   */
  pdfPath?: string;
}

/**
 * The years a package is paid for, read off the label rather than the code.
 *
 * The code was the obvious place and it is wrong in two families out of four: iSmart's
 * W80F06 opens with the age it covers to, and Life Treasure's H99F12A with ninety-nine — so
 * the first two digits are 80 and 99, not six and twelve. The labels are the company's own
 * words and every one of them says ชำระเบี้ย N ปี.
 */
function yearsOf(label: string | undefined): number | undefined {
  const m = label?.match(/ชำระเบี้ย\s*(\d{1,2})\s*ปี/);
  return m ? Number(m[1]) : undefined;
}

/**
 * Which package the message asked for, when it named a paying term.
 *
 * "จ่าย 10 ปี" is unambiguous and is read first. A bare "10 ปี" is read too, because that is
 * how the term is usually written once the plan has been named — "PLB หญิง 30 ทุน 5 แสน 15
 * ปี" says everything, and asking again for something already in the message is the rudest
 * thing a form can do.
 *
 * The bare reading is fenced twice, because the same words carry an age. A number is taken
 * only when some package is actually sold for that many years, and never when it is this
 * person's age or is written behind อายุ: "ไลฟ์ เทรเชอร์ ชาย 18 ปี" is an eighteen-year-old,
 * not the eighteen-year package. Someone who is both says "จ่าย 18 ปี" and is understood.
 */
export function variantAskedFor(
  text: string, variants: string[], labels: Record<string, string>, age?: number,
): string | undefined {
  const byTerm = (years: number) => variants.find((v) => yearsOf(labels[v]) === years);

  const said = text.match(/(?:จ่าย|ชำระ|ผ่อน)\s*(?:เบี้ย)?\s*(\d{1,2})\s*ปี/);
  if (said) return byTerm(Number(said[1]));

  for (const m of text.matchAll(/(อายุ\s*)?(\d{1,2})\s*ปี/g)) {
    if (m[1]) continue;
    const years = Number(m[2]);
    if (years === age) continue;
    const hit = byTerm(years);
    if (hit) return hit;
  }
  return undefined;
}

/** What a message asks of a plan: who, how much, how long — each only if it said so. */
export interface PlanAsk {
  people: { age: number; sex: "M" | "F" }[];
  sum: number | undefined;
  variant: string | undefined;
}

/**
 * Read a message for what it asks of one plan. Nothing is priced here, which is what lets a
 * brain keep the answer across turns and price it when the last piece arrives.
 */
export function readPlanAsk(text: string, code: string): PlanAsk {
  const plan = getPlan(code);
  const said = withoutPlanName(text);
  const people = peopleIn(said);
  const sum = coverIn(said);
  const variants = plan?.rates.base.variants ?? [];
  const variant = variants.length === 1
    ? variants[0]
    : plan ? variantAskedFor(said, variants, plan.variantLabels, people[0]?.age) : undefined;
  return { people, sum, variant };
}

/**
 * Price one plan from one message, or say exactly what is missing.
 *
 * Nothing is guessed. A premium quoted from an assumed paying term is a premium for a
 * contract nobody asked about, and it would arrive looking like every correct one.
 */
export function priceNamedPlan(text: string, code: string, label: string): PriceReply {
  return pricePlan(code, label, readPlanAsk(text, code));
}

/** Price what has been asked, or say exactly what is missing — the half of the above that is not reading. */
export function pricePlan(code: string, label: string, { people, sum, variant }: PlanAsk): PriceReply {
  const plan = getPlan(code);
  if (!plan) return { text: `ไม่พบข้อมูลแบบ ${label} ในระบบครับ`, priced: false };

  /**
   * iShield is not priced here on purpose.
   *
   * Its rules carry `premiumBasis`: the figure a person gives it is the premium they want to
   * pay, and the sum assured is what comes back. Every other plan on this page works the
   * other way round, and a page that reads "1 ล้าน" as a sum for three plans and a premium
   * for the fourth is a page that will be misread — by a customer and eventually by whoever
   * maintains it.
   */
  if (plan.rules.base.premiumBasis) {
    return {
      priced: false,
      text: `แบบ **${label}** คิดเบี้ยแบบกรอกทุนไม่ได้ครับ — แบบนี้ทำกลับกัน คือ**กรอกเบี้ยที่อยากจ่าย แล้วระบบบอกว่าได้ทุนเท่าไหร่**\n\n`
        + `ใช้ที่ [หน้าแบบประกันอื่นๆ](/other-plans) จะเห็นช่องกรอกที่ถูกต้องครับ\n\n`
        + `ส่วนเงื่อนไขของ ${label} เช่น ช่วงอายุหรือสัญญาเพิ่มเติม ถามผมได้เลย`,
    };
  }

  const variants = plan.rates.base.variants ?? [];

  const missing: string[] = [];
  /** the same gaps as `missing`, named rather than written out, for the buttons that fill them */
  const needs: PriceGap["needs"] = [];
  if (people.length === 0) { missing.push("อายุกับเพศ (เช่น “ชาย 35”)"); needs.push("person"); }
  if (sum === undefined) {
    /**
     * The example has to be a sum this plan will actually accept. "ทุน 1 ล้าน" was the
     * example for every plan, and Life Treasure starts at ten million — so the one customer
     * who did exactly as they were asked got told their sum was too small.
     */
    const min = baseSumAssuredLimits(plan.rules, variant ?? variants[0] ?? "").min;
    const example = min && min > 1_000_000 ? min : 1_000_000;
    missing.push(`ทุนประกัน (เช่น “ทุน ${(example / 1_000_000).toLocaleString("en-US")} ล้าน”)`);
    needs.push("sum");
  }
  if (!variant && variants.length > 1) {
    const choices = variants.map((v) => plan.variantLabels[v] ?? v).join(" · ");
    missing.push(`ระยะเวลาชำระเบี้ย — ${label} มีให้เลือก: ${choices}`);
    needs.push("term");
  }
  if (missing.length) {
    const gap: PriceGap = {
      planCode: code, planLabel: label, variant, needs,
      ...(people[0] ? { age: people[0].age, sex: people[0].sex } : {}),
      ...(sum === undefined ? {} : { sumAssured: sum }),
    };
    return {
      priced: false,
      text: `คิดเบี้ย **${label}** ให้ได้ครับ ขอเพิ่มอีกนิด:\n\n${missing.map((m) => `- ${m}`).join("\n")}`,
      guide: priceFollowUps(gap),
    };
  }

  const who = people[0];
  const input = {
    planCode: code, variant: variant!, age: who.age, sex: who.sex,
    mode: "annual" as const, sumAssured: sum!, riders: [],
  };

  let result;
  try {
    result = quote(input);
  } catch (e) {
    console.error("คิดเบี้ยไม่สำเร็จ:", e);
    return { text: `คิดเบี้ย ${label} ไม่สำเร็จครับ ลองที่ [หน้าแบบประกันอื่นๆ](/other-plans) ดูนะครับ`, priced: false };
  }

  /**
   * A refusal from the engine is the answer, not an error to paper over. It is the same
   * sentence the calculator shows, and it is usually the one thing the asker needed to hear.
   */
  const blocking = result.warnings.filter((w) => w.level === "error");
  if (blocking.length || result.totalAnnual <= 0) {
    return {
      priced: false,
      text: `แบบ **${label}** ยังคิดให้ไม่ได้ด้วยเงื่อนไขนี้ครับ\n\n`
        + (blocking.length ? blocking.map((w) => `- ${w.message}`).join("\n") : "- อยู่นอกช่วงที่แบบนี้รับประกัน")
        + `\n\nลองปรับอายุหรือทุนดู หรือดูที่ [หน้าแบบประกันอื่นๆ](/other-plans)`,
    };
  }

  const modes = quoteModePremiums(input) ?? [];
  const per = (m: string) => modes.find((x) => x.mode === m);
  const termLabel = plan.variantLabels[variant!] ?? variant!;
  const sexWord = who.sex === "F" ? "หญิง" : "ชาย";

  const lines = [
    `**${label}** · ${termLabel}`,
    `${sexWord} อายุ ${who.age} ปี · ทุน ${result.sumAssured.toLocaleString("en-US")} บาท`,
    "",
    `💰 เบี้ยปีละ **${money(result.totalAnnual)} บาท**`,
  ];
  /**
   * Only instalments that can be bought. `quoteModePremiums` divides the year up whatever the
   * figure comes to, and on a small PLB the monthly share lands under the company's floor —
   * every calculator on the site drops those, and a chat that prints "รายเดือน 462 บาท" is
   * quoting an instalment no branch will accept.
   */
  const half = per("semi");
  const monthly = per("monthly");
  if (half && !half.belowMinimum) lines.push(`ราย 6 เดือน ${money(half.total)} บาท`);
  if (monthly && !monthly.belowMinimum) {
    // what paying monthly takes up front, as the card's box and every sales page say it
    lines.push(`รายเดือน ${money(monthly.total)} บาท`, ...firstPaymentLines(monthly));
  }
  if (result.deathBenefit) lines.push("", "👪 ความคุ้มครองชีวิตเป็นไปตามตารางผลประโยชน์ของแบบนี้");
  if (result.meta.expired) {
    lines.push("", `⚠️ ตารางเบี้ยชุดนี้ (${result.meta.version}) หมดอายุ ${result.meta.expiresOn} แล้ว — ขอราคาปัจจุบันจากบริษัทก่อนใช้`);
  } else {
    lines.push("", `เบี้ยมาตรฐาน ตารางเวอร์ชัน ${result.meta.version} · อาจต่างไปตามผลพิจารณารับประกัน`);
  }

  /**
   * The value table is offered only where the engine can draw one.
   *
   * It needs the plan's benefit sheet, and two of these four have not had theirs read — so
   * the link this used to attach unconditionally answered 400, and the customer was sent a
   * broken picture. Asking the drawing function itself, rather than repeating its condition
   * here, is what keeps the two from drifting apart.
   */
  const who2 = { age: who.age, sex: who.sex, sumAssured: result.sumAssured };
  const card = { kind: "plan" as const, planCode: code, variant: variant!, ...who2 };
  const hasTable = Boolean(valueTableCard(card));
  // undefined for a plan with no page of its own (iSmart) or a sum its slider does not stop at
  const pdfPath = quotePdfPath(card);

  return {
    priced: true,
    text: lines.join("\n"),
    cards: hasTable ? [cardPath(card), valueTablePath(card)] : [cardPath(card)],
    ...(pdfPath ? { pdfPath } : {}),
    guide: priceFollowUps({
      planCode: code, planLabel: label, variant: variant!,
      age: who.age, sex: who.sex, sumAssured: result.sumAssured, needs: [],
    }),
  };
}
