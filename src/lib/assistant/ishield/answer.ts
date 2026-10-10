import { getPlan } from "@/calc/plans/registry";
import { quote } from "@/calc/quote";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";
import { modePremiumsFrom } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { cardPath, diseaseCardPath, valueTablePath } from "@/lib/card-link";
import { valueTableCard } from "@/lib/quote-card";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { ISHIELD_SUMS } from "@/lib/quote-pdf/pages";
import diseases from "../../../../data/riders/ishield-diseases.json";
import {
  aboutCompany, asksAboutCompany, asksDiseaseList, budgetIn, BUDGET_INVITE, coverIn, type Budget, FORM_RECEIVED, handOverForm, HEALTH_DECLARATION, HEALTH_QUESTION,
  ageAlone, peopleIn, saysFormDone, saysUnwell, stallReply, stalls, thanksOnly, THANKS_REPLY, WANTS_IN, wantsToBuy, type Reply,
} from "../common";
import { writtenFor, type Channel } from "../channel";
import { CHOOSE_HEALTH, CHOOSE_LEGACY } from "../choose";

export const ISHIELD = "ISHIELD";

/**
 * The paying terms, shortest first, and the one the conversation opens on.
 *
 * WLCI10 because that is where the sales page opens too: the same arrangement quoted by the
 * bot and by the page is the same arrangement, and a customer who reads one and then asks the
 * other should not be shown two different figures for having used two different doors.
 */
const TERMS = ["WLCI05", "WLCI10", "WLCI15", "WLCI20"] as const;
const OPENS_ON = "WLCI10";

/**
 * What this brain remembers between turns.
 *
 * The sum is held rather than the saving, because the sum is what the contract is written
 * for: a customer who says "เดือนละ 3,000" is answered with the cover that buys, and it is
 * that cover the next question is about.
 */
export interface IShieldSlots {
  product: "ishield";
  age?: number;
  sex?: "M" | "F";
  /** the paying term, e.g. WLCI10 */
  variant?: string;
  /** the customer named the term; it outlives a change of age that it still takes */
  termChosen?: true;
  /** the sum assured in baht, once a saving or a sum has settled it */
  sumAssured?: number;
  /**
   * Whether this arrangement has already introduced itself.
   *
   * Not "is this the first turn": a customer who taps across from another quotation arrives
   * carrying their age and sex, which used to read as a conversation already under way — so
   * they pressed a button naming a plan they had never been told anything about, and were
   * answered with a question. The leaflet belongs to the plan, so the plan records whether it
   * has handed it over.
   */
  told?: true;
  /** the application form has gone; the bot says nothing more in this thread */
  formSent?: true;
  /**
   * What the customer said they can pay, while the sum on the table was bought with it. Held so
   * a tap on another term, or another age, is answered from the same money; dropped the moment
   * a sum is named outright.
   */
  budget?: Budget;
  /** the customer has been invited to name a budget, once, under their first quotation */
  budgetAsked?: true;
}

export type IShieldAnswer = Reply & { slots: IShieldSlots };

const rules = () => getPlan(ISHIELD)?.rules;
const rates = () => getPlan(ISHIELD)?.rates;

/** How many illnesses the contract names, counted rather than written down. */
function illnesses(): { early: number; major: number; earlyPercent: number } {
  const d = diseases as { early: string[]; major: string[] };
  return { early: d.early.length, major: d.major.length, earlyPercent: 25 };
}

/**
 * What the customer is told the moment they press the button.
 *
 * Built from the plan's own rules and its own list of illnesses, not typed out: the day a
 * disease is added to the contract this sentence counts it, and the day the maturity age
 * moves this sentence moves. A leaflet that can disagree with the engine will.
 */
export function ishieldOpening(): string {
  const r = rules();
  const ill = illnesses();
  const maturity = r?.base.maturity;
  return [
    "มรดก + ออม + โรคร้ายแรง — จ่ายสั้น คุ้มยาว ได้เงินคืนครับ 🌱",
    `• เจอโรคร้าย **${ill.early + ill.major} โรค** — ระยะเริ่มต้นรับ ${ill.earlyPercent}% ของทุน ระยะรุนแรงรับสูงสุด 100%`,
    maturity
      ? `• **อยู่ถึงอายุ ${maturity.age} ปี รับเงินคืน ${maturity.percentOfSumAssured}% ของทุน** — เบี้ยไม่ทิ้ง`
      : "• มีเงินคืนเมื่อครบสัญญา",
    "• **จ่ายแค่ 5 / 10 / 15 / 20 ปี** แล้วจบ แต่คุ้มครองชีวิตตลอดชีพ",
    "• เสียชีวิต ครอบครัวรับทุนประกัน หรือเบี้ยที่จ่ายมาแล้ว แล้วแต่จำนวนใดมากกว่า",
  ].join("\n");
}

const ASK_PERSON = "ขอทราบเพศกับอายุหน่อยครับ เดี๋ยวคิดให้เลย (เช่น ช 35)";

/**
 * The sum, asked for outright.
 *
 * It was asked the other way round for a while — "อยากออมเดือนละเท่าไหร่" — because the rate
 * table runs both ways and a saving is the easier thing to name. What the inbox showed is
 * that a customer who came for an inheritance is thinking in cover, and the six sums this
 * plan is actually sold in are a shorter decision than a number typed from nothing.
 *
 * The saving is never asked for now. It is still read where a customer volunteers one —
 * "เดือนละ 3,000" priced rather than met with the same question again — but nothing the bot
 * says puts that word in front of them.
 */
const ASK_COVER = "อยากได้ทุนประกันเท่าไหร่ครับ เลือกได้เลย เดี๋ยวคิดเบี้ยให้";

/**
 * The sums on the buttons.
 *
 * Every one of them is inside the contract's own limits — it is written for 100,000 up to
 * 5,000,000 — and every one is a phrase `coverIn` reads back, because a tap arrives as
 * nothing but its own title.
 */
export const COVER_CHOICES = [
  "ทุน 500,000", "ทุน 1,000,000", "ทุน 2,000,000",
  "ทุน 3,000,000", "ทุน 4,000,000", "ทุน 5,000,000",
];

/** The smallest monthly saving worth reading as one, below which a number is something else. */
const SMALLEST_SAVING = 500;
const LARGEST_SAVING = 500_000;

/**
 * The monthly saving a message names.
 *
 * Deliberately narrow. A bare number in this conversation is as likely to be an age as a
 * premium, so one is only read where the customer said what it was — "เดือนละ 3000", "3,000
 * บาท" — or where the message is nothing but the number, which is what an answer to the
 * question actually looks like.
 */
export function savingIn(text: string): number | undefined {
  const said = text.replace(/[฿,]/g, "").trim();
  const named = said.match(/(?:เดือนละ|งวดละ|ออม|จ่าย)\s*(\d{3,7})|(\d{3,7})\s*(?:บาท|฿)/);
  const alone = /^\d{3,7}$/.test(said) ? said : undefined;
  const found = named?.[1] ?? named?.[2] ?? alone;
  if (!found) return undefined;
  const baht = Number(found);
  if (baht < SMALLEST_SAVING || baht > LARGEST_SAVING) return undefined;
  return baht;
}

/**
 * The paying term to quote at this age.
 *
 * The one the page opens on where the age allows it — the terms end at different ages, 51 for
 * the ten-year and 56 for the fifteen — and otherwise the longest one that still takes them,
 * because a term that refuses is not an option and being told so is not an answer.
 */
export function termFor(age: number): string | undefined {
  if (!rules()) return undefined;
  if (takes(OPENS_ON, age)) return OPENS_ON;
  return TERMS.find((v) => takes(v, age));
}

/** Whether this paying term is issued at this age. */
function takes(variant: string, age: number): boolean {
  const r = rules();
  if (!r) return false;
  const { min, max } = baseAgeRange(r, variant, rates());
  return age >= min && age <= max;
}

/**
 * A paying term said with the word that makes it one — "ส่ง 20 ปี", "ชำระเบี้ย 15 ปี", "แบบ 5
 * ปี", "20 ปีจบ" — and only in the four this plan is sold in.
 *
 * Never a bare number of years, for the reason the life plan gives: "อายุ 20 ปี" is an
 * insured. Without this the term was never read at all, and a customer who asked for the
 * twenty-year premium was sent the ten-year quotation again (the inbox, 2026-10-02).
 */
const TERM_NAMED = /(?:(?:จ่าย|ส่ง|ชำระ)(?:เบี้ย)?|แบบ)\s*(5|10|15|20)\s*ปี|(?<!\d)(5|10|15|20)\s*ปีจบ/;

export function ishieldTermIn(text: string): string | undefined {
  const m = text.match(TERM_NAMED);
  const years = m?.[1] ?? m?.[2];
  return years ? `WLCI${years.padStart(2, "0")}` : undefined;
}

/**
 * A term said with nothing else — "20ปี", "15 ปี" — read only once the age is already known.
 *
 * Before that it is as likely to be the age the bot just asked for. After it, it can only be
 * one of the four terms the leaflet listed: a man of 35 on the website typed "20ปี" and was
 * quoted the ten-year term (2026-10-08).
 */
const TERM_ALONE = /^\s*(5|10|15|20)\s*ปี\s*$/;

function bareTermIn(text: string): string | undefined {
  const years = text.match(TERM_ALONE)?.[1];
  return years ? `WLCI${years.padStart(2, "0")}` : undefined;
}

/**
 * A sum typed as nothing but its figure — "1000000", "1,000,000".
 *
 * The bot asks for the sum and never for a saving, so a bare figure of a sum's size answers
 * the question it was asked. It was tried as a monthly saving, which stops at 500,000, and a
 * million came back as nothing (the website, 2026-10-08). Smaller bare figures — "3000" —
 * are still a saving: no sum this plan sells is that small.
 */
const SMALLEST_BARE_SUM = 100_000;

function bareSumIn(text: string): number | undefined {
  const said = text.trim();
  if (!/^\d{1,3}(?:,\d{3})+$|^\d+$/.test(said)) return undefined;
  const baht = Number(said.replace(/,/g, ""));
  return baht >= SMALLEST_BARE_SUM ? baht : undefined;
}

/** The widest age this plan is issued at under any of its terms, for the refusal to quote. */
function ageSpan(): { min: number; max: number } {
  const r = rules();
  if (!r) return { min: 0, max: 0 };
  const spans = TERMS.map((v) => baseAgeRange(r, v, rates()));
  return {
    min: Math.min(...spans.map((s) => s.min)),
    max: Math.max(...spans.map((s) => s.max)),
  };
}

/** What a budget buys on one term: the sum, its instalment in satang, and whether the monthly floor lifted it. */
export interface BudgetFit {
  sum: number;
  total: number;
  /** the instalment is over the budget, because the smallest monthly instalment the company takes is */
  over: boolean;
}

/**
 * The biggest sum a budget buys on one paying term, or undefined when it does not reach the
 * plan's smallest sum.
 *
 * The sums are the sales page's own list (ISHIELD_SUMS), so what a budget buys is a sum the
 * page can open and the PDF can print. Each is priced forwards, by the engine, in the mode the
 * budget was named in: the figure given back is what that sum costs, never what the customer
 * said they would pay. The plan's minimum is a hard floor — a budget under it is told so, not
 * lifted to it. The one thing allowed over the budget is the company's monthly floor, and it
 * is said.
 */
export function fitBudget(
  who: { age: number; sex: "M" | "F"; variant: string }, budget: Budget, today: Date = new Date(),
): BudgetFit | undefined {
  const r = rules();
  if (!r) return undefined;
  const { min, max } = baseSumAssuredLimits(r, who.variant);
  const mode = budget.per === "month" ? "monthly" : "annual";
  const sums = ISHIELD_SUMS.filter((sum) => sum >= min && sum <= (max ?? Infinity));
  const price = (sum: number) =>
    modePremiumsFrom((m) => quote({ planCode: ISHIELD, ...who, sumAssured: sum, riders: [], mode: m }, today))
      ?.find((m) => m.mode === mode);

  let best = -1;
  sums.forEach((sum, i) => {
    const p = price(sum);
    if (p && p.total <= budget.baht * 100) best = i;
  });
  if (best < 0) return undefined;
  const fits = price(sums[best])!;
  if (!fits.belowMinimum) return { sum: sums[best], total: fits.total, over: false };

  // under the company's monthly floor: the next sum up is the smallest that can be sold
  const up = sums[best + 1] === undefined ? undefined : price(sums[best + 1]);
  return up && !up.belowMinimum ? { sum: sums[best + 1], total: up.total, over: true } : undefined;
}

/** The paying term as a customer says it, and as a button says it. */
const termLabel = (variant: string) => `ส่ง ${Number(variant.replace(/\D/g, ""))} ปี`;

/**
 * An age on its own, from a customer whose sex is already known: "อายุ 53", "ไม่ใช่ อายุ43", or
 * just "53". `peopleIn` wants both beside each other, so a customer correcting the age alone
 * was answered with the old quotation twelve times running (LINE, 2026-10-09).
 *
 * What counts as an age alone is `ageAlone`'s: "20 ปี" on its own is a paying term here.
 */
function ageForKnownSex(asked: string, slots: IShieldSlots): { age: number; sex: "M" | "F" } | undefined {
  const age = ageAlone(asked);
  return slots.sex && age !== undefined ? { age, sex: slots.sex } : undefined;
}

/** "ไม่ใช่", "ขอเปลี่ยนอายุ": the customer says the bot has them wrong, and says nothing to put it right. */
const CORRECTING = /ไม่ใช่|ไม่ถูก|ผิด|(?:เปลี่ยน|แก้)\s*(?:อายุ|เพศ)/;

/** Everything the message adds to what was already known. */
function filled(previous: IShieldSlots | null, asked: string): IShieldSlots {
  const slots: IShieldSlots = { product: "ishield", ...previous };
  const person = peopleIn(asked)[0] ?? ageForKnownSex(asked, slots);
  if (person) {
    slots.age = person.age;
    slots.sex = person.sex;
    // the term depends on the age, so an age that moves takes the term with it — unless the
    // customer chose that term and it still takes them
    const kept = slots.termChosen && slots.variant && takes(slots.variant, person.age);
    if (!kept) {
      slots.variant = termFor(person.age);
      delete slots.termChosen;
    }
  } else if (slots.age !== undefined && !slots.variant) {
    /**
     * An age that arrived by another road still needs a term.
     *
     * The dispatcher carries a person across from whichever plan they were asking about
     * before, and that person has an age and no paying term — so without this the customer
     * who taps over from a legacy quotation is told this plan will not take them, at an age
     * it takes perfectly well.
     */
    slots.variant = termFor(slots.age);
  }

  // a term named is the term, where it takes the customer; where it does not, the answer says so
  const named = ishieldTermIn(asked) ?? (previous?.age !== undefined ? bareTermIn(asked) : undefined);
  if (named && (slots.age === undefined || takes(named, slots.age))) {
    slots.variant = named;
    slots.termChosen = true;
    if (slots.sumAssured !== undefined) {
      // the sum held was settled under another term, whose limits may not be this one's
      const { min, max } = baseSumAssuredLimits(rules()!, named);
      slots.sumAssured = Math.min(Math.max(slots.sumAssured, min), max ?? slots.sumAssured);
    }
  }

  /**
   * A budget is read first, because it names its period and so cannot be mistaken for a sum or
   * an age; a sum said outright ends the shopping by budget; and a bare monthly figure is the
   * older, looser reading of a saving, tried last.
   */
  const periodic = budgetIn(asked);
  const cover = periodic ? undefined : coverIn(asked) ?? bareSumIn(asked);
  const saving = periodic || cover !== undefined ? undefined : savingIn(asked);
  if (cover !== undefined) delete slots.budget;
  else if (periodic) slots.budget = periodic;
  else if (saving !== undefined) slots.budget = { baht: saving, per: "month" };

  if (slots.age !== undefined && slots.sex && slots.variant) {
    if (cover !== undefined) {
      const { min, max } = baseSumAssuredLimits(rules()!, slots.variant);
      slots.sumAssured = Math.min(Math.max(cover, min), max ?? cover);
    } else if (slots.budget) {
      // undefined when the money does not reach the plan's smallest sum: the answer says so
      slots.sumAssured = fitBudget({ age: slots.age, sex: slots.sex, variant: slots.variant }, slots.budget)?.sum;
    }
  }
  return slots;
}

/** One turn of the iShield conversation. No model: the plan's two unknowns are both read here. */
export function answerIShield(
  asked: string, previous: IShieldSlots | null, channel: Channel = "web", today: Date = new Date(),
): IShieldAnswer {
  const slots = filled(previous, asked);
  const said = (text: string) => writtenFor(channel, text);
  const priced = previous?.sumAssured !== undefined;

  /**
   * The three things a customer says that are not about this contract's numbers.
   *
   * They were the life plan's alone, and a customer who typed "สมัครยังไง" at either of the
   * new arrangements was answered with the next question about a sum. The words are the same
   * words and the agency's answer is the same answer — a form, and a person to follow it — so
   * they are read here by the same code rather than by a second copy of it.
   *
   * Checked before the slots are acted on, because "สนใจสมัคร" is not a tier and not a saving,
   * and because a customer leaving to think it over must not be asked one more question.
   */
  /** the seventy, as a picture — see the note on `asksDiseaseList` */
  if (asksDiseaseList(asked)) {
    const ill = illnesses();
    return {
      messages: [{
        text: said(`รายชื่อโรคร้ายแรงทั้ง ${ill.early + ill.major} โรคที่คุ้มครองครับ 🙏`
          + " กดที่รูปเพื่อดูเต็ม บันทึกส่งต่อให้ที่บ้านดูได้เลย"),
        card: diseaseCardPath("ISHIELD"),
      }],
      slots,
    };
  }

  /**
   * A condition, answered before the form is.
   *
   * "เป็นเบาหวานสมัครได้ไหม" holds the word "สมัคร", and was sent the application form: the
   * one reply on a critical-illness contract that tells a customer with a condition to go
   * ahead. Whether they can be insured is the underwriter's answer, so they are told about
   * the declaration — the same words the life and health plans use — and nothing is sent.
   */
  if (saysUnwell(asked)) return { messages: [{ text: said(HEALTH_DECLARATION) }], slots };

  // "บริษัทอะไร" was answered with the quote again: the life brain had this check and these
  // two did not. The agency's own sentence, whatever else the conversation is about.
  if (asksAboutCompany(asked)) return { messages: [{ text: said(aboutCompany(asked)) }], slots };

  // told they are wrong and not told what is right: ask, rather than quote the same person again
  if (CORRECTING.test(asked) && previous && slots.age === previous.age && slots.sex === previous.sex
    && slots.variant === previous.variant && slots.sumAssured === previous.sumAssured) {
    return {
      messages: [{ text: said("ขออภัยครับ 🙏 ขอทราบเพศกับอายุที่ถูกต้องอีกครั้งหน่อยครับ (เช่น ช 35)") }],
      slots,
    };
  }

  if (wantsToBuy(asked, priced)) {
    const form = handOverForm(priced);
    // the flag the report counts and the inbox reads as "an agent has this one now"
    return {
      ...form,
      messages: form.messages.map((m) => ({ ...m, text: said(m.text) })),
      slots: { ...slots, formSent: true },
    };
  }
  if (saysFormDone(asked)) {
    return { messages: [{ text: said(FORM_RECEIVED) }], formDone: true, slots };
  }
  // a bare thank-you is not a request: left to the rest it is read as the sum again and priced
  if (thanksOnly(asked)) return { messages: [{ text: said(THANKS_REPLY) }], slots };
  if (stalls(asked)) {
    return { messages: [{ text: said(stallReply(priced)) }], slots };
  }

  /**
   * The question comes before the leaflet.
   *
   * Someone who has just pressed a button will answer one thing, and that willingness was
   * being spent on reading: four lines of contract terms arrived first, and the question they
   * were meant to answer sat underneath them. So the plan asks who it is pricing for, and
   * introduces itself on the turn after — beside the next question, when the customer has
   * already shown they are answering.
   */
  if (slots.age === undefined || !slots.sex) {
    // the money is kept in the slots, so it is acknowledged rather than asked for again
    return {
      messages: [{
        text: said(slots.budget
          ? `ได้เลยครับ งบ${perWord(slots.budget)}ละ ${slots.budget.baht.toLocaleString("en-US")} บาท 👍\n`
            + "ขอเพศกับอายุด้วยครับ เดี๋ยวคิดให้ว่าได้ทุนเท่าไหร่ (เช่น ช 35)"
          : ASK_PERSON),
      }],
      slots,
    };
  }

  // said once per arrangement, and once per arrangement means once for this one — a customer
  // who tapped across from another quotation has been told nothing about this plan yet
  const opening = previous?.told ? [] : [{ text: said(ishieldOpening()) }];
  slots.told = true;

  if (!slots.variant) {
    const { min, max } = ageSpan();
    return {
      messages: [{
        text: said(`แบบนี้รับประกันอายุ ${min}–${max} ปีครับ อายุ ${slots.age} สมัครแบบนี้ไม่ได้`
          + " แต่แบบมรดกเบี้ยไม่ทิ้งยังทำได้อยู่ สนใจให้คิดเบี้ยให้ไหมครับ"),
      }],
      slots: { product: "ishield" },
    };
  }

  const named = ishieldTermIn(asked);
  if (named && named !== slots.variant) {
    const max = baseAgeRange(rules()!, named, rates()).max;
    const open = TERMS.filter((v) => takes(v, slots.age!));
    return {
      messages: [{
        text: said(`แบบ${termLabel(named)} รับอายุไม่เกิน ${max} ปีครับ อายุ ${slots.age} เลือกได้แบบ${open.map(termLabel).join(" / ")}`),
      }],
      replies: open.map(termLabel),
      slots,
    };
  }

  if (slots.sumAssured === undefined && slots.budget) {
    return { ...budgetShort(slots as IShieldSlots & { age: number; sex: "M" | "F"; variant: string }, slots.budget, said, today), slots };
  }

  if (slots.sumAssured === undefined) {
    return { messages: [...opening, { text: said(ASK_COVER) }], replies: COVER_CHOICES, slots };
  }

  return quoted(slots as IShieldSlots & { age: number; sex: "M" | "F"; variant: string; sumAssured: number }, said, today);
}

const perWord = (b: Budget) => (b.per === "month" ? "เดือน" : "ปี");

/**
 * The money does not reach the plan's smallest sum on this term. Said plainly, with the
 * figure it would take — a customer told only "ไม่ได้ครับ" has nothing to decide with — and
 * with the other terms that the same money does reach, as buttons. Never quoted at a sum the
 * budget does not buy.
 */
function budgetShort(
  slots: IShieldSlots & { age: number; sex: "M" | "F"; variant: string }, budget: Budget,
  said: (text: string) => string, today: Date,
): Pick<IShieldAnswer, "messages" | "replies"> {
  const per = perWord(budget);
  const money = (n: number) => n.toLocaleString("en-US");
  const { min } = baseSumAssuredLimits(rules()!, slots.variant);
  const floor = ISHIELD_SUMS.find((sum) => sum >= min) ?? min;
  const mode = budget.per === "month" ? "monthly" : "annual";
  const least = modePremiumsFrom((m) => quote({
    planCode: ISHIELD, variant: slots.variant, age: slots.age, sex: slots.sex, sumAssured: floor, riders: [], mode: m,
  }, today))?.find((m) => m.mode === mode);

  const years = (v: string) => Number(v.replace(/\D/g, ""));
  const reach = TERMS.filter((v) => v !== slots.variant && takes(v, slots.age)).flatMap((v) => {
    const fit = fitBudget({ age: slots.age, sex: slots.sex, variant: v }, budget, today);
    return fit ? [{ variant: v, fit }] : [];
  });
  const lines = [
    `งบ${per}ละ ${money(budget.baht)} บาท ยังไม่ถึงทุนขั้นต่ำของแบบชำระเบี้ย ${years(slots.variant)} ปีครับ 🙏`,
    ...(least ? [`ทุนต่ำสุดคือ ${money(floor)} บาท เบี้ย ${formatBaht(least.total)} บาท/${per}`] : []),
    ...(reach.length
      ? [
        "แต่งบเท่านี้ทำแบบอื่นได้ครับ",
        ...reach.map((r) => `• ชำระเบี้ย ${years(r.variant)} ปี — ทุน ${money(r.fit.sum)} บาท เบี้ย ${formatBaht(r.fit.total)} บาท/${per}`),
      ]
      : ["ถ้าสนใจแบบนี้ ปรับงบหรือบอกได้เลยครับ"]),
  ];
  return { messages: [{ text: said(lines.join("\n")) }], replies: reach.map((r) => termLabel(r.variant)) };
}

/** Cross-sell by a name the dispatcher routes on, so the comparison costs the customer nothing. */
const CROSS_SELL = CHOOSE_LEGACY;

/**
 * The gap this arrangement leaves, offered to the customer who just bought into it.
 *
 * Nothing here pays a hospital. A critical-illness contract pays a sum once and ends; the
 * room, the doctor and the drugs arrive every time somebody is admitted, and they are
 * somebody else's contract. Saying so after a quotation is not an upsell bolted on, it is
 * the true shape of what the customer has just been shown.
 *
 * After, and never instead. It is not offered among the opening buttons: the advertisement
 * sells the legacies, and a fourth choice from a different half of a person's life is a way
 * of losing a lead that was paid for.
 */
const HEALTH_GAP = "เจอโรคร้ายได้เงินก้อนครั้งเดียว แต่ค่าห้องค่ารักษาที่มาทุกครั้งที่นอนโรงพยาบาล เป็นคนละส่วนกันครับ";

function quoted(
  slots: IShieldSlots & { age: number; sex: "M" | "F"; variant: string; sumAssured: number },
  said: (text: string) => string,
  today: Date,
): IShieldAnswer {
  const input = {
    planCode: ISHIELD, variant: slots.variant, age: slots.age, sex: slots.sex,
    sumAssured: slots.sumAssured, riders: [],
  };
  const modes = modePremiumsFrom((mode) => quote({ ...input, mode }, today));
  const annual = modes?.find((m) => m.mode === "annual");
  if (!annual || annual.total === 0) {
    return {
      messages: [{ text: said("ขออภัยครับ จำนวนนี้กับอายุนี้จัดให้ไม่ได้ ลองบอกจำนวนอื่นดูไหมครับ") }],
      replies: COVER_CHOICES,
      slots: { ...slots, sumAssured: undefined },
    };
  }
  const monthly = modes?.find((m) => m.mode === "monthly" && !m.belowMinimum);
  const r = rules();
  const ill = illnesses();
  const maturity = r?.base.maturity;
  const years = Number(slots.variant.replace(/\D/g, ""));
  const money = (n: number) => n.toLocaleString("en-US");

  // the instalment the customer named their budget in leads; otherwise the monthly one, as before
  const budget = slots.budget;
  const fit = budget ? fitBudget(slots, budget, today) : undefined;
  const premiumLine = budget?.per === "year" || !monthly
    ? `เบี้ย ${formatBaht(annual.total)} บาท/ปี${monthly ? ` (เดือนละ ${formatBaht(monthly.total)} บาท)` : ""} จ่าย ${years} ปีแล้วจบ`
    : `เบี้ย ${formatBaht(monthly.total)} บาท/เดือน (ปีละ ${formatBaht(annual.total)} บาท) จ่าย ${years} ปีแล้วจบ`;
  const lines = [
    ...(budget
      ? [
        `งบ${perWord(budget)}ละ ${money(budget.baht)} บาท ทำทุนได้สูงสุด ${money(slots.sumAssured)} บาท ครับ 💰`,
        ...(fit?.over
          ? [`(แบบชำระรายเดือนขั้นต่ำ ${money(rules()?.minMonthlyTotal ?? 0)} บาท/เดือน เบี้ยจึงเกินงบมานิดหน่อยครับ)`]
          : []),
        "",
      ]
      : []),
    `iShield ชำระเบี้ย ${years} ปี สำหรับ${slots.sex === "M" ? "ชาย" : "หญิง"}อายุ ${slots.age} ปี`,
    `ทุนประกัน ${money(slots.sumAssured)} บาท`,
    premiumLine,
    `เจอโรคร้ายระยะเริ่มต้นรับ ${money(Math.round(slots.sumAssured * ill.earlyPercent / 100))} บาท ระยะรุนแรงรับสูงสุด ${money(slots.sumAssured)} บาท`,
    maturity
      ? `อยู่ถึงอายุ ${maturity.age} ปี รับคืน ${money(Math.round(slots.sumAssured * maturity.percentOfSumAssured / 100))} บาทครับ`
      : "",
  ].filter(Boolean);

  const card = {
    kind: "plan" as const, planCode: ISHIELD, variant: slots.variant,
    age: slots.age, sex: slots.sex, sumAssured: slots.sumAssured, mode: "annual" as const,
  };

  /**
   * The year-by-year table, sent beside the quotation rather than waited for.
   *
   * This is the plan whose whole argument is that the premium comes back, and the table is
   * where that argument is actually made: the cash value at every year, against the premiums
   * paid to get there. Offering it as a next question would be making the customer ask for
   * the evidence of the thing they were just told.
   *
   * Guarded by the drawing itself rather than by a list of plans that can draw one — the list
   * would be a second place to keep in step, and this asks the code that does the work.
   */
  const table = valueTableCard(card, today) ? valueTablePath(card, { characters: true }) : undefined;
  // on the quote and not on the table: the file is the sales page, which is the quote
  const pdfPath = quotePdfPath(card);

  /**
   * The other paying terms this customer can take, as buttons — the same arrangement priced
   * shorter or longer. A customer who wanted the twenty-year premium had no way to know it
   * could be asked for, and the one who typed it was quoted the ten-year again.
   */
  const otherTerms = TERMS.filter((v) => v !== slots.variant && takes(v, slots.age)).map(termLabel);

  // once, after the first price and its table: the way into pricing by what the customer can pay
  const invite = !budget && !slots.budgetAsked;
  if (invite) slots.budgetAsked = true;

  return {
    replies: [WANTS_IN, ...otherTerms, CHOOSE_HEALTH, CROSS_SELL],
    messages: [
      { text: said(lines.join("\n")), card: cardPath(card), ...(pdfPath ? { pdfPath } : {}) },
      ...(table
        ? [{
          // the picture opens with the chart since it moved off the quote card (owner, 2026-10-06)
          text: said(`กราฟและตารางมูลค่าทุกปี\nเบี้ยต่อปี | เวนคืน | ความคุ้มครอง`),
          card: table,
        }]
        : []),
      ...(invite ? [{ text: said(BUDGET_INVITE) }] : []),
      // its own bubble, and last, so the health button under it reads as an answer to it
      { text: said(HEALTH_GAP) },
    ],
    priced: true,
    slots,
  };
}
