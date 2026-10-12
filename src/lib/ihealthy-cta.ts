import { formatBaht } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { PER } from "@/lib/legacy-cta";
import { deathBenefitRows } from "@/lib/death-benefit";
import type { IHealthyShown } from "@/lib/ihealthy-quote";
import { WORDS, type IHealthyWords } from "@/lib/ihealthy-words";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };
const INSTALMENT_ORDER: PayMode[] = ["monthly", "semi", "annual"];

/**
 * How a coverage reads inside a sentence, as against the bare words the picker lists.
 *
 * Full Coverage is the empty one: it is the contract as the whole page describes it, and
 * naming it would make the ordinary arrangement sound like a variant of something else. The
 * other two change what the customer pays on a claim, so they are never left unsaid.
 */
const COVERAGE_WORD: Record<string, string> = {
  "Full Coverage": "",
  Deductible: "แบบมีความรับผิดส่วนแรก",
  "Co-Payment": "แบบร่วมจ่าย",
};

/**
 * Everything the two texts below are written from — which is everything the card prints, and
 * nothing else.
 *
 * That includes the agent's fold: `shown` is derived from a pricing the fold's riders are
 * part of, so its total and its own named line are both in here. What is not here is the
 * fold itemised — a summary that listed every tick would be the panel written out twice.
 */
export interface IHealthyCtaFacts {
  /**
   * What is being priced: the health plan, where it covers, and how a bill is shared. The
   * five travel together or not at all — undefined is an age the company has no arrangement
   * to sell at, which the card says in its own words and these say in the customer's.
   */
  arrangement?: {
    /** the health plan's own name, e.g. "โกลด์" */
    planName: string;
    /** what the plan pays for treatment in one policy year, in baht */
    annualMax: number;
    territory: string;
    /** as the rate key spells it: "Full Coverage", "Deductible", "Co-Payment" */
    coverage: string;
    /** what the customer carries before the plan pays, in baht */
    deductible: number;
  };
  /** the share of a covered bill a co-payment arrangement leaves with the customer */
  copayPercent: number;
  age: number;
  sex: Sex;
  /** what prose calls the base plan, e.g. "ไลฟ์ โพรเทค+ x 2" */
  baseLabel: string;
  sumAssured: number;
  death: DeathBenefit;
  mode: PayMode;
  /** the company's smallest monthly instalment, in baht */
  minMonthly: number;
  /**
   * The three figures on the card, or nothing at all — the page's single "may a price be
   * quoted" gate. An expired rate set and an arrangement with no rate both arrive here as
   * undefined, so neither text below has a second question to ask. Its `others` already
   * exclude any instalment the company refuses, so nothing below has to ask that either.
   */
  shown: IHealthyShown | undefined;
  /**
   * What the attached riders are called, a line each, already in the reader's language. The
   * engine names them in Thai, and `shown.standard.label` is that Thai; left out, the Thai is
   * used.
   */
  standardLabel?: string | string[];
}

/**
 * What the customer's chat opens with, so whoever answers starts from the figures already on
 * screen.
 *
 * Each shortfall says what it wants instead of falling silent: an age with no arrangement
 * behind it asks for one that fits, and a withheld price asks for the current one — the
 * customer still wants that arrangement, they just cannot be told here what it costs.
 */
export function iHealthyMessage(f: IHealthyCtaFacts): string {
  const head = "สนใจประกันสุขภาพ iHealthy Ultra";
  const someone = `${SEX_WORD[f.sex]} ${f.age} ปี`;
  const a = f.arrangement;
  if (a === undefined) return `${head} ${someone} ขอแบบที่เหมาะกับอายุนี้`;
  const cover = COVERAGE_WORD[a.coverage] ?? "";
  const who = `${head} ${a.planName} ${a.territory}${cover ? ` ${cover}` : ""} ${someone}`;
  if (!f.shown) return `${who} ขอราคาปัจจุบัน`;
  // A total the company will not accept in this instalment is not a price to open a chat
  // with: the pasted quote flags it, and this one would have advertised it bare.
  if (f.shown.belowMinimum) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยรวมประมาณ ${formatBaht(f.shown.total)} บาท${PER[f.mode]}`;
}

/**
 * The quote as text, for the agent to paste into whichever chat the customer is already in.
 *
 * A pasted quote outlives the page it came from: nothing around it will ever say again that
 * this is a first-year premium on a rider that re-prices at every birthday, so that sentence
 * and the occupation class it assumes are part of the quote rather than part of the page.
 *
 * For the same reason it carries no per-day figure, though every other plan on the site
 * does. Theirs are level for the whole paying term, so "ตกวันละ 126 บาท" stays true;
 * this one would read as a standing subscription price and quietly contradict the line
 * underneath it.
 *
 * Undefined when no price may be shown — `ContactButtons` then hides the copy button, and
 * there is no half-quote for an agent to send by mistake.
 *
 * Written in the page's language, `w`, since it goes to the customer the page is being read
 * for. Thai unless told otherwise, which is also what the bot sends.
 */
export function iHealthyQuoteText(f: IHealthyCtaFacts, w: IHealthyWords = WORDS.th): string | undefined {
  const shown = f.shown;
  // the two cannot in fact disagree — nothing is priced without an arrangement to price it
  // for — but the types say they might, and a summary is not worth guessing a plan name for
  const a = f.arrangement;
  if (!shown || a === undefined) return undefined;
  const baht = (n: number) => n.toLocaleString("en-US");
  // what the plan pays and what the customer keeps of the bill, exactly as the card pairs them
  const s = w.share;
  const ceiling = s.ceiling(a.annualMax)
    + (a.coverage === "Deductible" ? ` · ${w.deductible(a.deductible)}` : "")
    + (a.coverage === "Co-Payment" ? ` · ${w.copay(f.copayPercent)}` : "");
  const instalments = [{ mode: f.mode, total: shown.total }, ...shown.others];
  return [
    // an emoji a heading, no more: the text is pasted into a customer's chat, where a wall
    // of them reads as a broadcast rather than as an agent answering
    `🏥 iHealthy Ultra ${a.planName}`,
    `${ceiling} · ${s.territory(w.territory[a.territory] ?? a.territory)}`,
    "",
    s.insured(w.sex[f.sex], f.age),
    // the total, and under it what that total buys — named, not priced. This text is pasted
    // into a customer's chat, and a split there reads as an invitation to take one half out
    `💰 ${s.total(formatBaht(shown.total), f.mode)}`,
    `- ${s.baseLine(f.baseLabel, f.sumAssured)}`,
    `- ${s.treatment}`,
    // the daily cash the agency attaches as standard; above the age it is written at there
    // is no line rather than a line of nothing. Its premium is what says whether it is on the
    // arrangement at all, which is the last thing a premium is read for here.
    ...(shown.standard && shown.standard.total > 0
      ? [f.standardLabel ?? shown.standard.label].flat().map((l) => `- ${l}`)
      : []),
    "",
    // one instalment a line, smallest first, whichever the card is showing
    ...INSTALMENT_ORDER.flatMap((mode) => {
      const m = instalments.find((x) => x.mode === mode);
      if (!m) return [];
      const line = s.instalment(w.mode[mode], formatBaht(m.total));
      // The flag belongs to the instalment the card is showing. Any other instalment the
      // company refuses never reaches `others` at all — `shownAt` drops it, the way every
      // sibling calculator does — and is named instead by the line below this list.
      return [mode === f.mode && shown.belowMinimum
        ? `${line} ${s.monthlyRefused(f.minMonthly)}`
        : line];
    }),
    "",
    `👪 ${s.family}`,
    ...deathBenefitRows(f.death, w.death).map((r) => `- ${r.label} ${baht(r.amount)} ${w.baht}`),
    "",
    // The instalments that are missing from the list above, and why. A reader who counted
    // three ways to pay on the page and two here is owed the reason.
    ...(shown.refused.length > 0
      ? [w.refused(shown.refused.map((m) => w.mode[m]), f.minMonthly)]
      : []),
    `📌 ${s.firstYear}`,
    s.fineprint,
    // a translation says which version binds, here as on the page: the text outlives the page
    ...(w.translationNote ? [w.translationNote] : []),
  ].join("\n");
}
