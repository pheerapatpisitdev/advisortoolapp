import { peopleIn, coverIn } from "@/lib/assistant/common";
import {
  availablePensionAges, PENSION_AGES, premiumRange, quotePension, WAIVER_LABEL,
  type PensionBasis, type PensionMode, type PensionPay, type PensionRiders, type WaiverOption,
} from "@/calc/pension/engine";
import { pensionTablePath } from "@/lib/card-link";
import type { GuideItem } from "./guide";
import type { PriceReply } from "./price";

/**
 * บำนาญ สมาร์ท 95 in the chat, from one message.
 *
 * It cannot go through ./price, because that file asks every plan for a sum and this one is
 * mostly asked for an income: "อยากได้เดือนละ 10,000 ตอน 60". So it reads three things the
 * others never need — which age the pension starts, whether the premiums run six years or
 * until then, and whether the figure given is a pension, a premium or a sum — and prices
 * through the same engine as the /bumnan95 page, so the two cannot disagree.
 *
 * Nothing is assumed. The paying term alone moves the premium several times over, and a
 * figure quoted on a guessed term arrives looking exactly like a right one.
 */

export const PENSION_LABEL = "บำนาญ สมาร์ท 95";

/** "บำนาญ", "บำนาญ สมาร์ท 95", "smart 95", "pension". */
const NAMED = /บำนาญ|pension|สมาร์ท\s*95|smart\s*95/i;

export function pensionNamedIn(text: string): boolean {
  return NAMED.test(text);
}

/**
 * The message with the product's name taken out.
 *
 * "บำนาญ 95 ชาย 40" otherwise reads as a ninety-five-year-old man — the person reader pairs a
 * number with the sex word beside it and the product's own number is the nearer one.
 */
function withoutName(text: string): string {
  return text
    .replace(/(?:บำนาญ\s*)?(?:สมาร์ท|smart)\s*95(?:\s*\/\s*\d{1,2})?(?:\s*A\d{2})?/gi, " ")
    .replace(/บำนาญ\s*95(?:\s*\/\s*\d{1,2})?/g, "บำนาญ ");
}

/** 10,000 · 10000 · 1 หมื่น · 1.5 หมื่น · 5 พัน · 2 แสน */
const AMOUNT = String.raw`(\d+(?:\.\d+)?)\s*(หมื่น|พัน|แสน|ล้าน)|(\d[\d,]*)`;
const UNIT: Record<string, number> = { พัน: 1_000, หมื่น: 10_000, แสน: 100_000, ล้าน: 1_000_000 };

function amountOf(m: RegExpMatchArray, at: number): number {
  return m[at] ? Number(m[at]) * UNIT[m[at + 1]] : Number(m[at + 2].replace(/,/g, ""));
}

/** the instalment is left open only for a premium said without one: "มีงบ 50,000" */
interface Asked { basis: PensionBasis; amount: number; mode?: PensionMode }

/** words that make the figure after them money going in, not a pension coming out */
const PAYING = String.raw`(?:จ่าย|ชำระ|ผ่อน|ส่ง|งบ|เก็บ(?:เงิน)?|ออม(?:เงิน)?|เบี้ย|งวดละ)`;
/** what may stand between those words and the figure: "จ่ายได้ไม่เกิน", "มีงบประมาณ" */
const FILLER = String.raw`(?:\s|ได้|ไหว|ประมาณ|ไม่เกิน|สัก|แค่|เบี้ย|ประกัน|ละ)*`;
/** an instalment: 6 and 3 before เดือน first, or "จ่าย 6 เดือนละ" is read as monthly */
const PERIOD = String.raw`(6\s*เดือน|3\s*เดือน|ครึ่งปี|ไตรมาส|เดือน|ปี)`;

function modeOf(period: string): PensionMode {
  const p = period.replace(/\s/g, "");
  return p === "6เดือน" || p === "ครึ่งปี" ? "semi" : p === "3เดือน" || p === "ไตรมาส" ? "quarterly"
    : p === "เดือน" ? "monthly" : "annual";
}

/** how a premium is said back, on the buttons; each form reads back as the same premium */
const PAY_WORDS: Record<PensionMode, string> = {
  annual: "จ่ายปีละ", semi: "จ่าย 6 เดือนละ", quarterly: "จ่าย 3 เดือนละ", monthly: "จ่ายเดือนละ",
};

/**
 * Which of the three figures the message gave.
 *
 * A premium first, because only a premium is written with a paying word in front — จ่าย,
 * ผ่อน, ส่ง, งบ, เก็บเงิน, เบี้ย: "งบเดือนละ 3,000" is an instalment, "ได้เดือนละ 10,000" is a
 * pension. A bare "ปีละ" is a premium too (the pension is asked for by the month), unless
 * ได้/รับ/บำนาญ stands before it. After that a bare "เดือนละ" is a pension, since that is what
 * this plan is bought for; and a sum is last.
 */
function figureIn(said: string): Asked | undefined {
  // "จ่ายเดือนละ 3,000", "จ่าย 6 เดือนละ 25,000", "จ่ายทุก 3 เดือน 10,000", "งบปีละ 5 หมื่น"
  const before = said.match(new RegExp(String.raw`${PAYING}${FILLER}(?:ทุก|ราย)?\s*${PERIOD}\s*(?:ละ)?\s*(?:${AMOUNT})`));
  if (before) return { basis: "premium", amount: amountOf(before, 2), mode: modeOf(before[1]) };
  // "จ่ายได้ 3,000 ต่อเดือน", "เบี้ย 3000/เดือน", "มีงบ 50,000 ต่อปี"
  const after = said.match(new RegExp(String.raw`${PAYING}${FILLER}(?:${AMOUNT})\s*(?:บาท)?\s*(?:ต่อ|\/|ทุก|ราย)\s*${PERIOD}`));
  if (after) return { basis: "premium", amount: amountOf(after, 1), mode: modeOf(after[4]) };
  // "จ่ายงวดละ 3000 รายเดือน", "มีงบ 50,000" — the instalment said elsewhere, or not at all;
  // "จ่าย 6 ปี" is the paying term, not six baht
  const bare = said.match(new RegExp(String.raw`${PAYING}${FILLER}(?:${AMOUNT})(?!\s*(?:ปี|เดือน|งวด|\d))`));
  if (bare && amountOf(bare, 1) >= 100) {
    const elsewhere = said.match(new RegExp(String.raw`(?:ราย|ทุก)\s*${PERIOD}`));
    return { basis: "premium", amount: amountOf(bare, 1), ...(elsewhere ? { mode: modeOf(elsewhere[1]) } : {}) };
  }
  const yearly = said.match(new RegExp(String.raw`(ได้|รับ|บำนาญ)?\s*ปีละ\s*(?:${AMOUNT})`));
  if (yearly && !yearly[1]) return { basis: "premium", amount: amountOf(yearly, 2), mode: "annual" };

  const pension = said.match(new RegExp(String.raw`เดือนละ\s*(?:${AMOUNT})`))
    ?? said.match(new RegExp(String.raw`(?:${AMOUNT})\s*(?:บาท)?\s*(?:ต่อ|\/)\s*เดือน`));
  if (pension) return { basis: "monthlyPension", amount: amountOf(pension, 1), mode: "annual" };
  const sum = coverIn(said);
  return sum === undefined ? undefined : { basis: "sumAssured", amount: sum, mode: "annual" };
}

/** "รับบำนาญ 60", "เริ่มรับตอนอายุ 65", "เกษียณ 55", "95/60". */
function pensionAgeIn(text: string): { age: number; rest: string } | undefined {
  const res = [
    // "ตอนนี้อายุ 55" is the person's age, not the pension's
    /(?:รับ|เริ่ม|เกษียณ|ตอน(?!นี้))[^\d]{0,20}?(55|60|65|70)(?!\d)/,
    /95\s*\/\s*(?:6\s*A)?(55|60|65|70)(?!\d)/,
    /(?:A|a)(55|60|65|70)(?!\d)/,
  ];
  for (const re of res) {
    const m = text.match(re);
    if (m) return { age: Number(m[1]), rest: text.replace(m[0], " ") };
  }
  return undefined;
}

function payIn(text: string): PensionPay | undefined {
  if (/(?:จ่าย|ชำระ|ผ่อน)\s*(?:เบี้ย)?\s*6\s*ปี|95\s*\/\s*6/.test(text)) return "6";
  if (/จน(?:ถึง)?(?:อายุ)?\s*(?:รับ|เกษียณ)|ถึงอายุรับบำนาญ|ตลอด|ทุกปีจน/.test(text)) return "untilAnnuity";
  return undefined;
}

const floorBaht = (n: number) => Math.floor(n).toLocaleString("en-US");

/**
 * The riders a message asked for, and the message without them.
 *
 * Read and cut out before anything else, because each one carries words the main readers
 * would take for their own: "DCI 1 ล้าน" is a sum assured to `coverIn`, "ภรรยา หญิง 38" is a
 * person to `peopleIn`, and "ยกเว้นเบี้ย" has เบี้ย in it.
 *
 * What is missing is said rather than filled in. Fit and Beyond are different contracts at
 * different prices, and a payer's age is the whole of PB's rate.
 */
interface RidersAsked {
  riders: PensionRiders;
  /** the same riders as words this file reads back, for the buttons */
  words: string[];
  missing: string[];
  guide: { label: string; add: string; drop: string }[];
  rest: string;
}

const OPTION = /beyond|บียอนด์|บียอน/i;
const FIT = /\bfit\b|ฟิต/i;
const PAYER_WORD = /(ภรรยา|ภริยา|สามี|ผู้ชำระ(?:เบี้ย)?)\s*(?:เป็น)?\s*(ผู้ชาย|ผู้หญิง|ชาย|หญิง|ผช|ผญ|ช|ญ)?\s*(?:อายุ)?\s*(\d{2})(?!\d)/;

function ridersIn(text: string): RidersAsked {
  let rest = text;
  const out: RidersAsked = { riders: {}, words: [], missing: [], guide: [], rest };
  const cut = (m: RegExpMatchArray | null) => { if (m) rest = rest.replace(m[0], " "); return m; };

  const optionIn = (phrase: string): WaiverOption | undefined =>
    OPTION.test(phrase) ? "BEYOND" : FIT.test(phrase) ? "FIT" : undefined;

  const wp = cut(rest.match(/(?:\bWP\b|ดับบลิว\s*พี|ยกเว้นเบี้ย)\s*(beyond|บียอนด์|บียอน|fit|ฟิต)?/i));
  if (wp) {
    const option = optionIn(wp[0]);
    if (option) { out.riders.wp = { option }; out.words.push(`WP ${WAIVER_LABEL[option]}`); }
    else {
      out.missing.push("WP เอาแผน Fit (เสียชีวิต/ทุพพลภาพ) หรือ Beyond (+โรคร้ายแรง)");
      for (const o of ["FIT", "BEYOND"] as const) out.guide.push({ label: `WP ${WAIVER_LABEL[o]}`, add: `WP ${WAIVER_LABEL[o]}`, drop: "WP" });
    }
  }

  const pb = cut(rest.match(/(?:\bPB\b|พี\s*บี)\s*(beyond|บียอนด์|บียอน|fit|ฟิต)?/i));
  if (pb) {
    const option = optionIn(pb[0]);
    const payer = cut(rest.match(PAYER_WORD));
    const sexWord = payer?.[2] ?? "";
    const payerSex = /ภรรยา|ภริยา/.test(payer?.[1] ?? "") ? "F" as const
      : /สามี/.test(payer?.[1] ?? "") ? "M" as const
        : sexWord ? (sexWord.includes("ญ") ? "F" as const : "M" as const) : undefined;
    if (!option) {
      out.missing.push("PB เอาแผน Fit หรือ Beyond");
      for (const o of ["FIT", "BEYOND"] as const) {
        out.guide.push({ label: `PB ${WAIVER_LABEL[o]}`, add: `PB ${WAIVER_LABEL[o]}`, drop: "PB" });
      }
    }
    if (!payer || !payerSex) out.missing.push("อายุและเพศของผู้ชำระเบี้ย (เช่น “ภรรยา 38” หรือ “ผู้ชำระ ชาย 45”)");
    const payerWords = payer && payerSex ? ` ผู้ชำระ ${payerSex === "F" ? "หญิง" : "ชาย"} ${Number(payer[3])}` : "";
    if (option && payer && payerSex) {
      out.riders.pb = { option, payerAge: Number(payer[3]), payerSex };
    }
    // carried as far as it was said, so a button that fills the rest keeps it
    out.words.push(`PB${option ? ` ${WAIVER_LABEL[option]}` : ""}${payerWords}`);
  }

  // "โรคร้ายโซชิลด์" is another rider, which this chat does not price
  const dci = cut(rest.match(new RegExp(String.raw`(?:\bDCI\b|ดีซีไอ|โรคร้าย(?:แรง)?(?!\s*โซ))\s*(?:ทุน)?\s*(?:${AMOUNT})?`, "i")));
  if (dci) {
    const amount = dci[1] || dci[3] ? amountOf(dci, 1) : undefined;
    if (amount) { out.riders.dci = { sumAssured: amount }; out.words.push(`DCI ${amount.toLocaleString("en-US")}`); }
    else {
      out.missing.push("ทุน DCI (200,000–10,000,000 บาท)");
      for (const n of [500_000, 1_000_000]) {
        out.guide.push({ label: `DCI ${n.toLocaleString("en-US")}`, add: `DCI ${n.toLocaleString("en-US")}`, drop: "DCI" });
      }
    }
  }
  out.rest = rest;
  return out;
}

/** A person's premium, split and totalled, in the instalments a customer can pick from. */
function totalsFor(input: Parameters<typeof quotePension>[0], sumAssured: number) {
  return (["annual", "semi", "quarterly", "monthly"] as const).map((mode) => {
    const r = quotePension({ ...input, basis: "sumAssured", amount: sumAssured, mode });
    return { mode, total: r.ok ? r.quote.totalModePremium : 0 };
  });
}

/** A whole question for a button, with the plan named so it arrives here again. */
function ask(parts: string[]): string {
  return [PENSION_LABEL, ...parts].join(" ");
}

/** Whether the message is a pricing question at all, rather than one about the plan's rules. */
export function asksPensionPrice(text: string): boolean {
  const said = ridersIn(withoutName(text)).rest;
  return /เบี้ย|ราคา|กี่บาท|คิดให้|premium|เดือนละ|ปีละ/i.test(said)
    || peopleIn(said).length > 0
    || figureIn(said) !== undefined;
}

export function pricePension(text: string): PriceReply {
  const asked = ridersIn(withoutName(text));
  const cleaned = asked.rest;
  const at = pensionAgeIn(cleaned);
  const said = at?.rest ?? cleaned;
  const who = peopleIn(said)[0];
  const figure = figureIn(said);
  const pay = payIn(cleaned);

  // what was given, carried on every button so pressing one does not lose the rest
  const given = [
    ...(who ? [`${who.sex === "F" ? "หญิง" : "ชาย"} ${who.age}`] : []),
    ...(at ? [`รับบำนาญ ${at.age}`] : []),
    ...(pay === "6" ? ["จ่าย 6 ปี"] : pay ? ["จ่ายจนรับบำนาญ"] : []),
    ...(figure ? [figure.basis === "monthlyPension" ? `เดือนละ ${figure.amount.toLocaleString("en-US")}`
      : figure.basis === "premium" ? (figure.mode ? `${PAY_WORDS[figure.mode]} ${figure.amount.toLocaleString("en-US")}` : `งบ ${figure.amount.toLocaleString("en-US")}`)
        : `ทุน ${figure.amount.toLocaleString("en-US")}`] : []),
    ...asked.words,
  ];

  const missing: string[] = [];
  const guide: GuideItem[] = [];
  if (!who) missing.push("อายุกับเพศ (เช่น “ชาย 40”)");
  if (!figure) {
    missing.push("อยากได้บำนาญเดือนละเท่าไหร่ (เช่น “เดือนละ 10,000”) หรือจ่ายเบี้ยได้ปีละเท่าไหร่ หรือทุนประกัน");
    if (who) for (const n of [10_000, 20_000]) guide.push({ label: `เดือนละ ${n.toLocaleString("en-US")}`, ask: ask([...given, `เดือนละ ${n.toLocaleString("en-US")}`]) });
  }
  if (figure?.basis === "premium" && !figure.mode) {
    const n = figure.amount.toLocaleString("en-US");
    missing.push(`เบี้ย ${n} บาท จ่ายเป็นรายปีหรือรายเดือน`);
    const rest = given.filter((w) => !w.startsWith("งบ "));
    for (const m of ["annual", "monthly"] as const) guide.push({ label: `${PAY_WORDS[m]} ${n}`, ask: ask([...rest, `${PAY_WORDS[m]} ${n}`]) });
  }
  const ages = who ? availablePensionAges(who.age, pay ?? "untilAnnuity") : PENSION_AGES;
  if (!at) {
    missing.push(`เริ่มรับบำนาญอายุเท่าไหร่ — เลือกได้ ${ages.join(" · ")}`);
    if (who && figure) for (const a of ages) guide.push({ label: `รับบำนาญอายุ ${a}`, ask: ask([...given, `รับบำนาญ ${a}`]) });
  }
  if (!pay) {
    missing.push("จ่ายเบี้ยแบบไหน — 6 ปี หรือ จ่ายทุกปีจนถึงอายุรับบำนาญ");
    if (who && figure && at) {
      guide.push({ label: "จ่ายเบี้ย 6 ปี", ask: ask([...given, "จ่าย 6 ปี"]) });
      guide.push({ label: "จ่ายจนรับบำนาญ", ask: ask([...given, "จ่ายจนรับบำนาญ"]) });
    }
  }
  // the riders' own gaps come last: the contract they ride on has to exist first
  missing.push(...asked.missing);
  if (who && figure && at && pay) {
    for (const g of asked.guide) {
      guide.push({ label: g.label, ask: ask([...given.filter((w) => !w.startsWith(g.drop)), g.add]) });
    }
  }
  if (missing.length) {
    return {
      priced: false,
      text: `คิดเบี้ย **${PENSION_LABEL}** ให้ได้ครับ ขอเพิ่มอีกนิด:\n\n${missing.map((m) => `- ${m}`).join("\n")}`,
      ...(guide.length ? { guide } : {}),
    };
  }

  const input = {
    age: who!.age, sex: who!.sex, annuityAge: at!.age, pay: pay!, mode: figure!.mode ?? "annual", basis: figure!.basis, amount: figure!.amount,
    riders: asked.riders,
  };
  const result = quotePension(input);
  if (!result.ok) {
    // a premium out of range comes back with the one that fits, one press away
    const range = premiumRange(input);
    const fit = range && (figure!.amount < range.min ? range.min : figure!.amount > range.max ? range.max : undefined);
    const words = fit === undefined ? undefined : `${PAY_WORDS[input.mode]} ${fit.toLocaleString("en-US")}`;
    return {
      priced: false,
      text: `แบบ **${PENSION_LABEL}** ยังคิดให้ไม่ได้ด้วยเงื่อนไขนี้ครับ\n\n- ${result.error}\n\nลองปรับดู หรือใช้ [เครื่องคิดบำนาญ](/bumnan95)`,
      ...(words ? { guide: [{ label: words, ask: ask([...given.filter((w) => !w.startsWith("จ่าย") || w === "จ่าย 6 ปี" || w === "จ่ายจนรับบำนาญ"), words]) }] } : {}),
    };
  }
  const q = result.quote;
  const first = q.bands[0];
  const lastBand = q.bands[q.bands.length - 1];
  const payWords = pay === "6" ? "ชำระเบี้ย 6 ปี" : `ชำระเบี้ยจนถึงอายุ ${q.plan.annuityStartAge} (${q.payYears} ปี)`;
  const lines = [
    `**${PENSION_LABEL}** · รับบำนาญอายุ ${q.plan.annuityStartAge}–95 · ${payWords}`,
    `${who!.sex === "F" ? "หญิง" : "ชาย"} อายุ ${who!.age} ปี · ทุน ${q.sumAssured.toLocaleString("en-US")} บาท`,
    "",
    ...premiumLines(q, totalsFor(input, q.sumAssured), figure!.basis === "premium" ? input.mode : "annual"),
    "",
    `🎁 บำนาญช่วงแรก เดือนละ **${q.monthlyPension.toLocaleString("en-US")} บาท** (หรือปีละ ${first.annual.toLocaleString("en-US")}) อายุ ${first.fromAge}–${first.toAge}`,
    `เพิ่มเป็นปีละ ${lastBand.annual.toLocaleString("en-US")} บาท ตั้งแต่อายุ ${lastBand.fromAge} · รับประกันจ่าย 15 ปีแรก`,
    `รวมรับบำนาญถึงอายุ 95 ประมาณ ${q.totalPension.toLocaleString("en-US")} บาท จากเบี้ย${q.riders.length ? "สัญญาหลัก" : ""}รวม ${floorBaht(q.totalPremium)} บาท`,
    "",
    // the yearly table goes as a picture under these words (owner, 2026-10-11)
    "เบี้ยใช้ลดหย่อนภาษีได้ตามเกณฑ์สรรพากร · ตารางรายปีอยู่ในรูปด้านล่าง · คำนวณภาษีได้ที่ [เครื่องคิดบำนาญ](/bumnan95)",
    `เบี้ยมาตรฐาน ตารางเวอร์ชัน A2026-1 · อาจต่างไปตามผลพิจารณารับประกัน${q.riders.length ? "" : " · ยังไม่รวมสัญญาเพิ่มเติม"}`,
  ];
  const others = availablePensionAges(who!.age, pay!).filter((a) => a !== q.plan.annuityStartAge);
  const keep = given.filter((g) => !g.startsWith("รับบำนาญ"));
  return {
    priced: true,
    text: lines.join("\n"),
    // the year-by-year table, with the /bumnan95 page's pen notes, drawn for the chat to send
    cards: [pensionTablePath({ age: who!.age, sex: who!.sex, start: q.plan.annuityStartAge, pay: pay!, sumAssured: q.sumAssured })],
    guide: [
      ...others.map((a) => ({ label: `ถ้ารับบำนาญอายุ ${a}`, ask: ask([...keep, `รับบำนาญ ${a}`]) })),
      pay === "6"
        ? { label: "ถ้าจ่ายจนรับบำนาญ", ask: ask([...given.filter((g) => g !== "จ่าย 6 ปี"), "จ่ายจนรับบำนาญ"]) }
        : { label: "ถ้าจ่ายเบี้ย 6 ปี", ask: ask([...given.filter((g) => g !== "จ่ายจนรับบำนาญ"), "จ่าย 6 ปี"]) },
    ],
  };
}

/**
 * The premium block. Without riders it is the one line every plan in this chat answers with;
 * with them it leads with the total — what the customer actually pays — and itemises under it.
 * Someone who gave a monthly premium is answered in months first: the figure they know.
 */
function premiumLines(
  q: Extract<ReturnType<typeof quotePension>, { ok: true }>["quote"],
  instalments: { mode: PensionMode; total: number }[],
  lead: PensionMode,
): string[] {
  const per = (m: PensionMode) => floorBaht(instalments.find((i) => i.mode === m)!.total);
  const WORD: Record<PensionMode, string> = { annual: "ปีละ", semi: "ราย 6 เดือน", quarterly: "ราย 3 เดือน", monthly: "รายเดือน" };
  const headWord = `${WORD[lead]} `;
  const tail = (["annual", "semi", "monthly"] as const).filter((m) => m !== lead).map((m) => `${WORD[m]} ${per(m)} บาท`);
  if (!q.riders.length) return [`💰 เบี้ย${headWord}**${per(lead)} บาท**`, ...tail];
  // itemised in the lead instalment, which is the mode the quote was taken in
  const own = (annual: number, modal: number) => floorBaht(lead === "annual" ? annual : modal);
  return [
    `💰 เบี้ยรวม${headWord}**${per(lead)} บาท**`,
    ...tail,
    `- สัญญาหลัก ${own(q.annualPremium, q.modePremium)} บาท`,
    ...q.riders.map((r) => r.error
      ? `- ${r.label}: ซื้อไม่ได้ — ${r.error}`
      : `- ${r.label} ${own(r.annual, r.modePremium)} บาท${r.code === "DCI" ? " (เบี้ยปีแรก ปรับขึ้นตามอายุ)" : ""}`),
  ];
}
