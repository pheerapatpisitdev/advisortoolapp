import type { ThemeKey } from "./theme-keys";
import type { FestivalKey } from "./festival";
import type { CardRiders, PlanCardInput } from "@/lib/card-link";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { iHealthyFacts as benefitSheet } from "@/lib/ihealthy-facts";
import { setupQuery } from "./ihealthy-setup";
import { iShieldTable } from "@/lib/ishield-table";
import { LIFEPROTECT_PLAN } from "@/lib/lifeprotect-card";
import { quoteCard, valueTableCard, type ValueTableRow } from "@/lib/quote-card";
import type { PensionPay } from "@/calc/pension/engine";
import { pensionVideoFacts, roughBaht, type PensionVideoFacts } from "./pension";
import { legacyVideoFacts, type LegacyVideoFacts } from "./legacy";
import { plbVideoFacts, termsSaid, type PlbVariant, type PlbVideoFacts } from "./plb";
import { gsavingVideoFacts, gsIndexLine, gsLeadLine, gsMoney, rateLabel, type GsVideoFacts } from "./gsaving";
import type { SceneMotion, VideoSize } from "./timeline";
import type { VideoBrief, WrittenLines } from "./brief";
import { extraVoice, linesOf, loops, sceneOrder, type Told } from "./told";
import { VIDEO_WORDS, type VideoLang } from "./video-words";
import { WORDS } from "@/lib/ihealthy-words";
import { foreignScript } from "./ihealthy-foreign";

/**
 * วิดีโอนำเสนอ (owner, 2026-10-11): what the scenes show and say, taken from the same quote the
 * cards and the value table are drawn from — the voice never says a figure a card does not.
 *
 * Three products: Life Protect (มรดก), iShield (a lump sum on a critical illness) and iHealthy
 * Ultra (a health plan, compared against the plans the agent picks). The spoken lines are the
 * owner's casual wording, approved in the mockups the same day: no "เบี้ย", "เสียชีวิต" or
 * "เวนคืน" in the voice — "ถ้าเป็นอะไรไป", "ขอเงินก้อนคืน" — and for the plans that build a
 * cash value, "ออม" where it said "จ่าย" (owner, 2026-10-11: ออมต่อปี, ออมเพียง 19 ปี).
 * บำนาญ สมาร์ท 95 is the fourth (owner, 2026-10-13; pension.ts): a monthly pension from an age.
 * มรดกเพื่อครอบครัว is the fifth (owner, 2026-10-14; legacy.ts): the /legacy bundle, a tier of 1–10 million.
 * Protection Life is the sixth (owner, 2026-10-14; plb.ts): the /plb term cover, 5–15 years.
 * Global Savings 15/8 is the seventh (owner, 2026-10-20; gsaving.ts): the /global-saving index-linked savings plan.
 * iHealthy Ultra, มรดก and Protection Life keep "ค่าใช้จ่าย": none builds anything to save. The screen keeps the
 * cards' own words. Words in a line are separated by single spaces: the subtitles light up one
 * of those pieces at a time.
 */

export type Product = "LIFEPROTECT" | "ISHIELD" | "IHEALTHY" | "PENSION" | "LEGACY" | "PLB" | "GSAVING";
export type SceneKey = "lead" | "price" | "cover" | "value" | "compare" | "contact"
  /** มรดก's fourth scene, where the others have their value table: the critical-illness lump sum */
  | "critical"
  /** Protection Life's fourth scene, where the others have their value table: the four terms side by side */
  | "terms"
  /** Global Savings' fourth scene: the seven index returns as bars, the picked one gold (gsaving.ts) */
  | "index"
  /** the longer clips' own (told.ts, owner 2026-10-13): the customer's story, a comparison, two questions, how to start */
  | "story" | "versus" | "qa" | "steps";

/** What the agent asked for. A row written before products existed has no `product`: Life Protect. */
export type VideoInput = (
  /** `riders`: Life Protect only, the riders its page priced in (owner, 2026-10-17, 1ก); absent = the plan alone */
  | { product?: "LIFEPROTECT" | "ISHIELD"; variant: string; age: number; sex: "M" | "F"; sumAssured: number; riders?: CardRiders }
  /** `setup`: the iHealthy Ultra page's base, sum, territory, coverage and riders as its address writes them (ihealthy-setup.ts); absent = the page's defaults */
  /** `lang`: the language the clip is told in (owner, 2026-10-15; video-words.ts); absent = Thai */
  | { product: "IHEALTHY"; age: number; sex: "M" | "F"; plan: string; compare: string[]; setup?: string; lang?: VideoLang }
  /** the sum the pension is paid from; the form may send the monthly pension instead (pension.ts checkedPension) */
  | { product: "PENSION"; age: number; sex: "M" | "F"; annuityAge: number; pay: PensionPay; sumAssured: number; monthly?: number }
  /** มรดกเพื่อครอบครัว: the tier, 1–10, which is the millions the family receives (legacy.ts) */
  | { product: "LEGACY"; age: number; sex: "M" | "F"; tier: number }
  /** Protection Life: a term (paid and covered alike) and a sum from the /plb page's steps (plb.ts) */
  | { product: "PLB"; variant: PlbVariant; age: number; sex: "M" | "F"; sumAssured: number }
  /** Global Savings 15/8: the yearly premium and the index's return, % a year, the clip's example is worked at (gsaving.ts) */
  | { product: "GSAVING"; age: number; sex: "M" | "F"; premium: number; rate: number }
) & {
  /** who reads it (owner, 2026-10-11): a woman (Kore) unless a man is asked for */
  narrator?: "F" | "M";
  /** an ElevenLabs voice's id when the clip is read by one, Gemini's narrator otherwise (owner, 2026-10-11) */
  voice?: string;
  /** one of Gemini's 30 voices by name (owner, 2026-10-17); none = the narrator's own, Kore or Orus */
  gemini?: string;
  /** แบบปกติ (photo, card, table) or Motion Graphic, the Premium one (owner, 2026-10-11) */
  style?: VideoStyle;
  /** a Motion Graphic clip's look (owner, 2026-10-17; theme-keys.ts); absent = น้ำเงินทอง. Read with readTheme: a row from before 2026-10-20 may name one taken away */
  theme?: ThemeKey;
  /** ธีมเทศกาล's festival, kept from the day the clip was asked for (festival.ts); with theme "festival" only */
  festival?: FestivalKey;
  /** who draws a Motion Graphic clip: Remotion on Cloud Run (owner, 2026-10-17; remotion.ts, set when made by the /admin/ai switch); absent = the satori frames */
  engine?: "remotion";
  /** the whole story (~50 s) or the 15-second one for a Page's Reels (owner, 2026-10-11) */
  length?: VideoLength;
  /** portrait unless a square or landscape Motion Graphic clip was asked for (owner, 2026-10-11; timeline.ts) */
  size?: VideoSize;
  /** the clip began from what the customer can save: the sum or plan above is what that buys (budget.ts) */
  budget?: { baht: number; per: "month" | "year" };
  /** โจทย์การเล่า (owner, 2026-10-13; brief.ts): how it opens, the story, the customer, whether it loops */
  brief?: VideoBrief;
  /** the sentences written to the brief, checked (writer.ts); absent until they are written */
  lines?: WrittenLines;
};

/** 15 s, ~50 s, ~90 s, ~2 min (owner, 2026-10-13: "สูงสุดถึง 2 นาที"; told.ts sceneOrder) */
export type VideoLength = "short" | "full" | "long" | "max";

export type VideoStyle = "classic" | "motion";

/** A man ends his sentences with ครับ, a woman with ค่ะ / นะคะ (owner, 2026-10-11). */
export function spokenBy(line: string, narrator: "F" | "M" = "F"): string {
  // a question's คะ too, where it ends a word (not คะแนน)
  return narrator === "M" ? line.replace(/นะคะ/g, "นะครับ").replace(/ค่ะ/g, "ครับ").replace(/คะ(?=\s|$)/g, "ครับ") : line;
}

export const productOf = (v: VideoInput): Product => v.product ?? "LIFEPROTECT";

/** `per`: the instalment a row is, where its label is not the Thai one (a clip in another language) */
export interface PriceRow { label: string; amount: string; main: boolean; per?: "month" | "year" | "half" }
export interface CoverRow { label: string; amount: string; mark: boolean }
export interface ComparePlan { name: string; ceiling: string; room: string; opd: string; monthly: string; main: boolean; ceilingBaht?: number }

/** Everything the clip shows, as the cards state it. Parts a product has not got are absent. */
export interface QuoteVideoFacts {
  product: Product;
  /** the language the screen and the voice are in; absent = Thai (only iHealthy Ultra has others) */
  lang?: VideoLang;
  planLine: string;
  insuredWho: string;
  insuredLine: string;
  sex: "M" | "F";
  age: number;
  /** the figure the clip opens on, counted up: มรดก, the lump sum, the yearly ceiling */
  lead: { label: string; amount: string; baht: number; note?: string };
  /** the highlighted line under it: "ตกวันละ 79 บาท"; iHealthy's first-year monthly price */
  leadMark: string;
  /** the price scene's highlighted line where it is not the lead's (บำนาญ 95: the monthly instalment) */
  priceMark?: string;
  /** the Motion price scene's big figure where it is not the daily or first-year monthly price (บำนาญ 95: ออมปีละ) */
  priceBig?: { label: string; amount: string; unit: string };
  /** "79"; none for iHealthy, whose price is a first year's and not a standing daily one */
  perDayAmount?: string;
  priceTitle: string;
  prices: PriceRow[];
  spokenPrice: { per: string; amount: string };
  /** the highlighted phrases under the price box */
  pills: string[];
  /** the red pen under them */
  penNote?: string;
  /** small print under the price box (iHealthy: what the price includes, and that it is a first year's) */
  priceNotes: string[];
  coverTitle: string;
  cover: CoverRow[];
  /** Life Protect draws its two death benefits as bars; บำนาญ 95 its pension's steps; มรดก its bands as a staircase; Protection Life one flat bar; Global Savings its paybacks on a timeline (the classic clip lists them); the others list their rows */
  coverStyle: "bars" | "rows" | "steps" | "bands" | "flat" | "payback";
  coverPen?: string;
  coverNote?: string;
  coverToAge: number;
  payYears?: number;
  lastPayAge?: number;
  /** premiums run to the end of the contract (Life Protect's จ่ายถึงอายุ 99): there is no "จบ" to say */
  payToEnd?: boolean;
  rows?: ValueTableRow[];
  totalPaid?: string;
  breakEven?: { age: number; cash: string; index: number };
  compare?: ComparePlan[];
  /** the clip began from a budget: the instalment the customer saves, in the mode they named */
  budget?: { per: "month" | "year"; amount: string };
  /** iShield: how many illnesses each stage covers */
  illness?: { early: number; major: number; total: number };
  /** iHealthy: the plan's name, "Gold" */
  planName?: string;
  /** iHealthy: what each kind of cover pays, for the voice */
  benefits?: { label: string; amount: string }[];
  /** iHealthy: what the price is made of, as said aloud: "ประกันชีวิต", "ค่าชดเชยรายวัน", "สัญญาเพิ่มเติม" */
  includes?: string[];
  /** iHealthy: each rider the page attached, said in full in the clip's language — "โรคร้ายแรง DCI ทุน 200,000 บาท" (owner, 2026-10-17, ก) */
  riderNames?: string[];
  /**
   * Life Protect quoted with its page's riders (owner, 2026-10-17, 1ก): what the price includes as
   * said aloud ("สัญญายกเว้นเบี้ย และค่าชดเชยรายวัน"), and the part whose premium moves with age, if any.
   * The longer clips also say the instalment contract by contract (`split`, in the spoken
   * instalment, whole baht) and what each rider pays out (`parts`) (owner, 2026-10-17,
   * mockup https://claude.ai/artifact/XaTkLWYU8twVqtMfrYFLGN, ก)
   */
  riders?: { said: string; rises?: string; split?: { name: string; baht: string }[]; parts: { name: string; what: string }[] };
  footNote?: string;
  /** บำนาญ 95: the pension's schedule (pension.ts) */
  pension?: PensionVideoFacts;
  /** มรดก: the bands, the critical-illness sum, the first year's price (legacy.ts) */
  legacy?: LegacyVideoFacts;
  /** Protection Life: the term, the sum, the four terms side by side (plb.ts) */
  plb?: PlbVideoFacts;
  /** Global Savings 15/8: the guarantee, the bonus at the picked return, the seven returns (gsaving.ts) */
  gsaving?: GsVideoFacts;
}

/**
 * a phrase kept whole on one line: a word joiner between its words, where Chrome (Remotion) would
 * otherwise break a Thai line; never between a letter and its marks, which would draw them apart
 */
export const KEEP_ONE_LINE = (...words: string[]) => words.join("\u2060");
const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));
const SEX_WHO = { M: "คุณผู้ชาย", F: "คุณผู้หญิง" } as const;

export const planInput = (v: Extract<VideoInput, { variant: string }>): PlanCardInput => ({
  kind: "plan", planCode: productOf(v), variant: v.variant, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
  ...("riders" in v && v.riders && productOf(v) === LIFEPROTECT_PLAN ? { riders: v.riders } : {}),
});

/** each waiver as the voice says it; the medical plan (MEB) is "ค่าชดเชยรายวัน", as the chat and the pages call it */
const WAIVER_SAID: Record<string, string> = { WP: "สัญญายกเว้นเบี้ย", PB: "สัญญาผู้ชำระเบี้ย" };
const MEDICAL_SAID = "ค่าชดเชยรายวัน";

/**
 * What each waiver pays out, said the owner's way ("เป็นอะไรไป", never "เสียชีวิต"): the
 * wording of data/riders/waiver-benefits.json, by code and flavour.
 */
const WAIVER_WHAT: Record<string, string> = {
  "WP.FIT": "ถ้าทุพพลภาพสิ้นเชิงถาวร ไม่ต้องจ่ายเบี้ยที่เหลือ แต่ความคุ้มครองยังอยู่ครบ",
  "WP.BEYOND": "ถ้าทุพพลภาพสิ้นเชิงถาวร หรือเป็นโรคร้ายแรง ไม่ต้องจ่ายเบี้ยที่เหลือ แต่ความคุ้มครองยังอยู่ครบ",
  "PB.FIT": "ถ้าผู้ชำระเบี้ยเป็นอะไรไป หรือทุพพลภาพสิ้นเชิงถาวร บริษัทจ่ายเบี้ยที่เหลือแทนจนครบ",
  "PB.BEYOND": "ถ้าผู้ชำระเบี้ยเป็นอะไรไป ทุพพลภาพสิ้นเชิงถาวร หรือเป็นโรคร้ายแรง บริษัทจ่ายเบี้ยที่เหลือแทนจนครบ",
};

/**
 * Each share said in whole baht (the screen keeps the satang), rounded so they add up to the
 * whole premium rounded — row by row the voice's parts could miss the total by ฿1 (owner,
 * 2026-10-18): the baht left over go to the shares with the largest fractions.
 */
export function wholeShares(amounts: string[]): string[] {
  const n = amounts.map((a) => Number(a.replace(/[^\d.]/g, "")) || 0);
  const target = Math.round(n.reduce((a, b) => a + b, 0) * 100) / 100;
  const floors = n.map(Math.floor);
  let left = Math.round(target) - floors.reduce((a, b) => a + b, 0);
  const order = n.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) { if (left <= 0) break; floors[i]++; left--; }
  return floors.map((x) => x.toLocaleString("en-US"));
}

/** a split row's contract as the screen names it: "ดับบลิวพี ฟิต", "ค่ารักษาพยาบาล MEB แผน 1,000" */
export const riderShort = (label: string) => label.replace(/^สัญญาเพิ่มเติม/, "").replace(/\((MEB)\)/, "$1").replace(/\s+/g, " ").trim();

/**
 * What the riders add to a Life Protect clip: the voice's words for them, and whether their
 * premium moves while the plan's stays level (the medical plan's rises with age) — read off the
 * value table's own rider column, so it is never said where the table does not show it.
 */
function riderFacts(
  riders: CardRiders | undefined, rows: ValueTableRow[], split: { title: string; rows: { label: string; amount: string }[] }, spokenLabel: string,
): QuoteVideoFacts["riders"] {
  if (!riders?.waiver && riders?.medical === undefined) return undefined;
  const said = [
    ...(riders.waiver ? [WAIVER_SAID[riders.waiver.code] ?? "สัญญาเพิ่มเติม"] : []),
    ...(riders.medical !== undefined ? [MEDICAL_SAID] : []),
  ];
  const paying = rows.filter((r) => r.due !== "—").map((r) => r.rider);
  const moves = paying.some((x) => x !== paying[0]);
  // the split's rows run สัญญาหลัก, the waiver, the medical plan (lifeprotect-card.ts): the voice
  // names them its own way, the waiver by its flavour without the payer the screen adds
  const [main, ...rest] = split.rows;
  const whole = rest.length === said.length;
  const waiverName = riders.waiver
    ? whole ? riderShort(rest[0].label).replace(/\s*\(.*\)$/, "") : WAIVER_SAID[riders.waiver.code] ?? "สัญญาเพิ่มเติม"
    : undefined;
  const names = [...(waiverName ? [waiverName] : []), ...(riders.medical !== undefined ? [MEDICAL_SAID] : [])];
  // said only where the split is of the instalment the voice says, and has a row for every rider
  const split_ = main && whole && split.title.endsWith(spokenLabel)
    ? ((b) => [{ name: "สัญญาหลัก", baht: b[0] }, ...rest.map((_, i) => ({ name: names[i], baht: b[i + 1] }))])(wholeShares([main.amount, ...rest.map((r) => r.amount)]))
    : undefined;
  const parts = [
    ...(riders.waiver && waiverName && WAIVER_WHAT[`${riders.waiver.code}.${riders.waiver.option}`]
      ? [{ name: waiverName, what: WAIVER_WHAT[`${riders.waiver.code}.${riders.waiver.option}`] }] : []),
    ...(riders.medical !== undefined
      ? [{ name: MEDICAL_SAID, what: `นอนโรงพยาบาลรับเงินวันละ ${riders.medical.toLocaleString("en-US")} บาท` }] : []),
  ];
  return {
    said: said.length > 1 ? `${said.slice(0, -1).join(" ")} และ${said[said.length - 1]}` : said[0],
    ...(moves ? { rises: riders.medical !== undefined ? MEDICAL_SAID : "สัญญาเพิ่มเติม" } : {}),
    ...(split_ ? { split: split_ } : {}),
    parts,
  };
}

/** The facts for an arrangement; undefined for anything the clip cannot state (no price, not sold). */
export function quoteVideoFacts(v: VideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const f = v.product === "IHEALTHY" ? iHealthyFacts(v, today)
    : v.product === "PENSION" ? pensionVideoFacts(v)
    : v.product === "LEGACY" ? legacyVideoFacts(v, today)
    : v.product === "PLB" ? plbVideoFacts(v, today)
    : v.product === "GSAVING" ? gsavingVideoFacts(v)
    : planFacts(v, today);
  if (!f || !v.budget) return f;
  // a clip begun from a budget says what the customer saves, in the instalment they named
  const per = v.budget.per;
  const row = f.prices.find((p) => (p.per ? p.per === per : p.label === (per === "month" ? "รายเดือน" : "รายปี")));
  return row ? { ...f, budget: { per: v.budget.per, amount: row.amount } } : f;
}

function planFacts(v: Exclude<Extract<VideoInput, { variant: string }>, { product: "PLB" }>, today: Date): QuoteVideoFacts | undefined {
  const product = productOf(v);
  const input = planInput(v);
  const card = quoteCard(input, today);
  const table = valueTableCard(input, today);
  if (!card || !table || !card.summary || !card.perDay || !card.legacy) return undefined;
  const section = card.sections[0];
  if (!section || section.rows.length === 0) return undefined;
  const paying = table.rows.filter((r) => r.due !== "—");
  const last = table.rows[table.rows.length - 1];
  const lastPaid = [...table.rows].reverse().find((r) => r.paid !== null);
  if (!paying.length || !last || !lastPaid?.paid) return undefined;
  const beIndex = table.rows.findIndex((r) => r.breakEven);
  const be = beIndex >= 0 ? table.rows[beIndex] : undefined;
  const main = card.summary.rows.find((r) => r.main) ?? card.summary.rows[0];
  const spoken = card.summary.rows.find((r) => r.label === "รายเดือน") ?? main;
  const lifeProtect = product === LIFEPROTECT_PLAN;
  const coverToAge = last.age + 1;
  const payToEnd = paying.length === table.rows.length;
  const riders = lifeProtect && card.summary.split ? riderFacts(input.riders, table.rows, card.summary.split, spoken.label) : undefined;
  // the plan's own premium is level; with a medical plan beside it the whole instalment is not
  const level = riders?.rises ? "เบี้ยสัญญาหลักคงที่" : "เบี้ยคงที่ตลอด";
  const facts: QuoteVideoFacts = {
    product,
    planLine: card.planLine,
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: v.sex,
    age: v.age,
    lead: { label: "มรดก", amount: card.legacy.amount, baht: digits(card.legacy.amount), ...(card.legacy.note ? { note: card.legacy.note } : {}) },
    leadMark: card.perDay,
    perDayAmount: card.perDay.replace(/[^\d,]/g, ""),
    priceTitle: card.summary.title,
    prices: card.summary.rows.map((r) => ({ label: r.label, amount: r.amount, main: r.main })),
    spokenPrice: { per: spoken.label === "รายปี" ? "ปีละ" : spoken.label === "ราย 6 เดือน" ? "งวดละ" : "เดือนละ", amount: spoken.amount },
    pills: payToEnd
      ? [`จ่ายเบี้ยถึงอายุ ${coverToAge}`, level]
      : lifeProtect ? [`จ่ายเบี้ยแค่ ${paying.length} ปี`, level] : [`จ่ายเบี้ยแค่ ${paying.length} ปี`, `คุ้มครองถึงอายุ ${coverToAge}`],
    ...(payToEnd ? {} : { penNote: `จ่ายครบอายุ ${paying[paying.length - 1].age} แล้วหยุดส่ง` }),
    ...(payToEnd ? { payToEnd } : {}),
    // what the headline instalment is made of, as the card's box splits it (owner, 2026-10-17, 1ก)
    priceNotes: riders && card.summary.split
      ? [card.summary.split.title, ...card.summary.split.rows.map((r) => `${riderShort(r.label)}  ${r.amount} บาท`)]
      : [],
    ...(riders ? { riders } : {}),
    coverTitle: section.title,
    cover: section.rows.map((r) => ({ label: r.label, amount: r.amount, mark: Boolean(r.mark) })),
    coverStyle: lifeProtect ? "bars" : "rows",
    coverPen: `คุ้มครองถึงอายุ ${coverToAge} ปี`,
    ...(lifeProtect || !card.footNotes?.[0] ? {} : { coverNote: card.footNotes[0] }),
    coverToAge,
    payYears: paying.length,
    lastPayAge: paying[paying.length - 1].age,
    rows: table.rows,
    totalPaid: lastPaid.paid,
    ...(be?.cash ? { breakEven: { age: be.age, cash: be.cash, index: beIndex } } : {}),
    ...(card.footNotes?.[0] ? { footNote: card.footNotes[0] } : {}),
  };
  return lifeProtect ? facts : iShieldShape(facts, card.footNotes?.[0], paying.length, coverToAge);
}

/**
 * iShield as its own page tells it (owner, 2026-10-11: the first script was wrong): a lump sum
 * from the early stage of 70 illnesses, the early stage read first and claimable again for
 * another illness; the major stage pays up to the whole sum less what the early stage paid;
 * the death and maturity sums are the full sum only when nothing was claimed. The premium is
 * level. Sources: the iShield page FAQ (removed 2026-10-14, in git history) and src/lib/assistant/ishield/faq.ts.
 */
function iShieldShape(f: QuoteVideoFacts, footNote: string | undefined, payYears: number, coverToAge: number): QuoteVideoFacts {
  const ill = iShieldTable().illness;
  const find = (re: RegExp) => f.cover.find((r) => re.test(r.label));
  const major = find(/ระยะรุนแรง/);
  const early = find(/ระยะเริ่มต้น/);
  const death = find(/เสียชีวิต/);
  const maturity = find(/ครบสัญญา/);
  const cover: CoverRow[] = [
    // "ต่อโรค" kept on one line: Chrome (Remotion) would split it ต่อ / โรค (owner chose ก, 2026-10-19)
    ...(early ? [{ label: `ตรวจพบระยะเริ่มต้น (${ill.earlyCount} โรค) ${KEEP_ONE_LINE("ต่อ", "โรค")}`, amount: early.amount, mark: true }] : []),
    ...(major ? [{ label: `ระยะรุนแรง (${ill.majorCount} โรค) รวมสูงสุด`, amount: major.amount, mark: true }] : []),
    ...(death ? [{ label: "เสียชีวิต", amount: death.amount, mark: true }] : []),
    ...(maturity ? [{ label: maturity.label, amount: maturity.amount, mark: true }] : []),
  ];
  return {
    ...f,
    lead: {
      label: "รับเงินก้อนสูงสุดเมื่อตรวจพบโรคร้ายแรง",
      amount: major?.amount ?? f.lead.amount,
      baht: digits(major?.amount ?? f.lead.amount),
      note: `คุ้มครอง ${ill.earlyCount + ill.majorCount} โรค · จ่ายตั้งแต่ระยะเริ่มต้น`,
    },
    pills: [`จ่ายเบี้ยแค่ ${payYears} ปี`, "เบี้ยเท่าเดิมทุกปี"],
    penNote: `คุ้มครองถึงอายุ ${coverToAge}`,
    cover,
    coverPen: undefined,
    coverNote: `ระยะรุนแรงหักส่วนที่จ่ายระยะเริ่มต้นไปแล้ว · รับระยะเริ่มต้นแล้ว ทุนและมูลค่าเวนคืนลดลงตามสัดส่วน · ไม่คุ้มครองโรคร้ายแรง ${ill.waitingDays} วันแรก`,
    ...(footNote ? { footNote } : {}),
    illness: { early: ill.earlyCount, major: ill.majorCount, total: ill.earlyCount + ill.majorCount },
  };
}

/** the iHealthy card's row of this name, at this column */
function cellOf(rows: { label: string; cells: { text: string }[]; span?: string }[], label: string, i: number): string | undefined {
  const row = rows.find((r) => r.label === label);
  return row?.span ?? row?.cells[i]?.text;
}

function iHealthyFacts(v: Extract<VideoInput, { product: "IHEALTHY" }>, today: Date): QuoteVideoFacts | undefined {
  const query = setupQuery(v);
  const card = iHealthyCard(query, today);
  // another language: the same card read in it (ihealthy-card.ts `l=`), row for row and column
  // for column; the Thai card is still the one looked into, its labels being the keys
  const lang: VideoLang = v.lang ?? "th";
  const shown = lang === "th" ? card : iHealthyCard(new URLSearchParams([...query, ["l", lang]]), today);
  const w = WORDS[lang];
  const vw = VIDEO_WORDS[lang];
  const at = card.columns.findIndex((c) => c.selected);
  const col = card.columns[at];
  if (!col || !col.sold || !card.premium) return undefined;
  // the card settles an age the plan cannot be sold at onto one it can: a clip says what was asked or nothing
  if (!card.insuredWho.endsWith(` ${v.age} ปี`)) return undefined;
  const price = (label: string, i: number) => card.premiumRows.find((r) => r.label === label)?.cells[i]?.text ?? "";
  const monthly = price("รายเดือน", at);
  const PER: Record<string, PriceRow["per"]> = { รายเดือน: "month", รายปี: "year", "ราย 6 เดือน": "half" };
  const prices = card.premiumRows
    .map((r, k) => ({ label: shown.premiumRows[k]?.label ?? r.label, amount: r.cells[at]?.text ?? "", main: r.label === "รายเดือน", per: PER[r.label] }))
    .filter((r) => digits(r.amount) > 0);
  if (!monthly || prices.length === 0) return undefined;
  /** a benefit row in Thai, for the voice, and as it is shown */
  const kept = card.rows
    .map((r, k) => ({ r, k }))
    .filter(({ r }) => r.label !== "วงเงินค่ารักษาต่อปี");
  const amountOf = (r: (typeof card.rows)[number]) => (r.span ? r.span.split(" · ")[0] : r.cells[at]?.text ?? "");
  const both = kept
    .map(({ r, k }) => ({
      thai: { label: r.label, amount: amountOf(r) },
      // the card's "as charged" runs long in Russian and Burmese: the clip's row says it shorter
      shown: { label: shown.rows[k]?.label ?? r.label, amount: amountOf(r) === "ตามที่จ่ายจริง" ? vw.asCharged : shown.rows[k] ? amountOf(shown.rows[k]) : amountOf(r) },
    }))
    .filter((b) => b.thai.amount && b.thai.amount !== "-");
  const benefits = both.map((b) => b.thai);
  // the base plan and the health plan are the card's first two lines; the rest are what the page attached
  const daily = benefits.some((b) => b.label === "ค่าชดเชยรายวัน");
  const riders = Math.max(0, card.lines.length - 2 - (daily ? 1 : 0));
  const includes = ["ประกันชีวิต", ...(daily ? ["ค่าชดเชยรายวัน"] : []), ...(riders ? ["สัญญาเพิ่มเติม"] : [])];
  const wanted = new Set([v.plan, ...v.compare]);
  const codes = iHealthyPlanCodes();
  const perDay = new RegExp(`\\s*${w.perDay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`);
  const compare = card.columns
    .map((c, i) => ({ c, i, code: codes[i] }))
    .filter(({ c, code }) => c.sold && code && wanted.has(code))
    .slice(0, 3)
    .map(({ c, i }) => ({
      name: c.name, ceiling: shown.columns[i]?.ceiling ?? c.ceiling, main: i === at,
      room: (cellOf(shown.rows, shown.rows[cardRowAt(card.rows, "ค่าห้องและค่าอาหาร")]?.label ?? "", i) ?? "-").replace(perDay, ""),
      opd: cellOf(shown.rows, shown.rows[cardRowAt(card.rows, "ผู้ป่วยนอก OPD")]?.label ?? "", i) ?? "-",
      monthly: price("รายเดือน", i),
      ceilingBaht: ceilingBaht(c.ceiling),
    }));
  const ceiling = ceilingBaht(col.ceiling);
  if (!Number.isFinite(ceiling) || ceiling <= 0) return undefined;
  return {
    product: "IHEALTHY",
    ...(lang !== "th" ? { lang } : {}),
    planLine: shown.planLine,
    insuredWho: shown.insuredWho,
    insuredLine: shown.insuredLine,
    sex: v.sex,
    age: v.age,
    planName: col.name,
    lead: { label: w.annualLimit, amount: ceiling.toLocaleString("en-US"), baht: ceiling },
    leadMark: vw.leadMark(monthly),
    priceTitle: vw.priceTitle,
    prices,
    spokenPrice: { per: "เดือนละ", amount: monthly },
    pills: [],
    priceNotes: [shown.lines.map((l) => l.label).join(" · "), w.firstYearOnly],
    coverTitle: vw.coverTitle(col.name),
    cover: both.map((b) => ({ label: b.shown.label, amount: b.shown.amount, mark: true })),
    coverStyle: "rows",
    coverToAge: 98,
    benefits,
    includes,
    ...(shown.riderNames.length ? { riderNames: shown.riderNames } : {}),
    ...(compare.length >= 2 ? { compare } : {}),
  };
}

/** where the Thai card has the row of this name, so the same row of a card in another language is found */
const cardRowAt = (rows: { label: string }[], label: string) => rows.findIndex((r) => r.label === label);

/** "15 ล้าน" → 15,000,000 */
function ceilingBaht(thai: string): number {
  const n = Number.parseFloat(thai.replace(/,/g, ""));
  return Math.round(n * (thai.includes("ล้าน") ? 1_000_000 : 1));
}

/** the iHealthy plans in the card's column order, by code: the card draws every plan, in the benefit sheet's order, when no `fit` is asked for */
export const iHealthyPlanCodes = (): string[] => benefitSheet().plans.map((p) => p.code);

/** "1 ล้าน", "1.5 ล้าน", "800,000" — how a sum is said aloud */
export function spokenBaht(baht: number): string {
  if (baht >= 1_000_000 && baht % 100_000 === 0) return `${(baht / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  return baht.toLocaleString("en-US");
}

/** "2 ล้านบาท" runs together as it is said; a figure in digits keeps its space */
const spokenWithBaht = (baht: number) => {
  const s = spokenBaht(baht);
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};

/**
 * A customer's name as the clip says it: "คุณ" taken off (the voice adds its own), letters,
 * marks and spaces only, at most 30 characters. Empty when nothing usable is left.
 */
export function cleanCustomerName(raw: string | undefined | null): string {
  const s = (raw ?? "").normalize("NFC").replace(/^\s*คุณ\s*/, "").replace(/[^\p{L}\p{M}\s.]/gu, "").replace(/\s+/g, " ").trim();
  return s.slice(0, 30).trim();
}

export interface SceneScript { key: SceneKey; voice: string }

/** "ถ้าออมเดือนละ 2,970 บาท " — what the customer saves, when the clip began from a budget; nothing otherwise */
function budgetLead(f: QuoteVideoFacts, lead: string): string {
  if (!f.budget) return "";
  return `${lead}${f.budget.per === "month" ? "เดือนละ" : "ปีละ"} ${f.budget.amount} บาท `;
}

/**
 * What the price includes, as said: "ประกันชีวิต" with the daily cash and the riders. `full` names each
 * rider and its sum where the short clip says "สัญญาเพิ่มเติม" (owner, 2026-10-17, ก).
 */
export const includesList = (f: QuoteVideoFacts, full = false): string[] =>
  (f.includes ?? ["ประกันชีวิต"]).flatMap((x) => (full && x === "สัญญาเพิ่มเติม" && f.riderNames?.length ? f.riderNames : [x]));

/** "ประกันชีวิต", "ประกันชีวิตและค่าชดเชยรายวัน" (or กับ), "ประกันชีวิต ค่าชดเชยรายวัน และสัญญาเพิ่มเติม" */
export function includesSaid(f: QuoteVideoFacts, and = "และ", full = false): string {
  const w = includesList(f, full);
  if (w.length === 1) return w[0];
  if (w.length === 2) return `${w[0]}${and}${w[1]}`;
  return `${w.slice(0, -1).join(" ")} และ${w[w.length - 1]}`;
}

/** How each kind of iHealthy cover is said aloud */
const SAID: Record<string, string> = {
  "Day Surgery": "ผ่าตัดเล็ก",
  "อุบัติเหตุ OPD 24 ชม": "อุบัติเหตุ",
  "มะเร็ง รังสีรักษา": "รักษามะเร็ง",
};

function healthCoverLine(f: QuoteVideoFacts): string {
  const b = f.benefits ?? [];
  const room = b.find((x) => x.label === "ค่าห้องและค่าอาหาร");
  const actual = b.filter((x) => x.amount === "ตามที่จ่ายจริง" && SAID[x.label]).map((x) => SAID[x.label]);
  const opd = b.find((x) => x.label === "ผู้ป่วยนอก OPD");
  const daily = b.find((x) => x.label === "ค่าชดเชยรายวัน");
  const parts: string[] = [];
  if (room) parts.push(`ค่าห้องวันละ ${room.amount.replace(" ต่อวัน", "")} บาท`);
  if (actual.length) parts.push(`${actual.length > 1 ? `${actual.slice(0, -1).join(" ")} และ${actual[actual.length - 1]}` : actual[0]} จ่ายตามจริง`);
  if (opd) parts.push(opd.amount === "ตามที่จ่ายจริง" ? "ผู้ป่วยนอกก็จ่ายตามจริง" : `มีผู้ป่วยนอกปีละ ${opd.amount} บาท`);
  if (daily) parts.push(`และนอนโรงพยาบาลรับเพิ่มวันละ ${daily.amount.replace(/[^\d,]/g, "")} บาท`);
  return `${parts.join(" ")}ค่ะ`;
}

/**
 * The spoken lines, in the owner's casual wording (mockups, 2026-10-11), with the narrator's ending.
 *
 * Told to a brief (owner, 2026-10-13; told.ts): the hook opens before the plan's own lead sentence
 * and the closing ends on the brief's line; a looping clip asks for the chat at the end of its
 * price scene and closes on a hanging line that runs into the opening. The longer lengths add the
 * customer's story, a comparison, two questions and how to start. The price, cover and value
 * lines are always the fixed ones: the value table's pen notes are timed to their words.
 */
export function quoteVideoScript(f: QuoteVideoFacts, customer?: string, narrator: "F" | "M" = "F", length: VideoLength = "full", told: Told = {}): SceneScript[] {
  const short = length === "short";
  const name = short ? "" : cleanCustomerName(customer);
  // another language (owner, 2026-10-15): its own fixed lines, the 15-second clip or the whole one, no brief
  if (f.lang && f.lang !== "th") return foreignScript(f, f.lang, name, short);
  const base = short ? shortScript(f) : femaleScript(f, name);
  const middle = base.filter((s) => s.key !== "lead" && s.key !== "contact");
  const w = linesOf(f, told);
  const loop = loops(told);
  let lead = base[0].voice;
  let contact = base[base.length - 1].voice;
  if (w) {
    // the name opens the clip, unless it loops: then the opening follows the closing's hanging line
    lead = `${name && !loop ? `คุณ${name} ` : ""}${w.hook} ${short ? base[0].voice : leadFact(f, name)}`;
    if (loop) contact = w.loopClose ?? "";
    else if (!short) contact = `${name ? `คุณ${name}` : ""}สนใจ ทักมาคุยกันได้เลยนะคะ ${w.close ?? ""}`;
  }
  const lines: SceneScript[] = sceneOrder(middle.map((m) => m.key), length).map((key) => {
    if (key === "lead") return { key, voice: lead };
    if (key === "contact") return { key, voice: contact };
    const own = middle.find((m) => m.key === key);
    if (own) return own;
    return { key, voice: extraVoice(key as "story" | "qa" | "versus" | "steps", f, told) };
  });
  if (loop) {
    // the invitation moves to the end of the price scene (owner's choice ก): the closing is the loop's
    const price = lines.find((l) => l.key === "price");
    if (price) price.voice = `${price.voice} ${short ? "ทักมาขอใบเสนอได้เลยนะคะ" : `${name ? `คุณ${name}` : ""}สนใจ ทักมาคุยกันได้เลยนะคะ`}`;
  }
  return lines.map((s) => ({ key: s.key, voice: spokenBy(s.voice.replace(/\s+/g, " ").trim(), narrator) }));
}

/** The plan's lead sentence without a greeting: what follows a written hook. */
function leadFact(f: QuoteVideoFacts, name: string): string {
  const who = name ? `อายุ ${f.age}` : `${SEX_WHO[f.sex]}อายุ ${f.age}`;
  if (f.product === "PENSION" && f.pension) {
    return `แผนนี้ ${name ? "" : `${who} `}${budgetLead(f, "ถ้าออม")}ตั้งแต่อายุ ${f.pension.start} รับบำนาญเดือนละ ${f.pension.monthly} บาท ไปจนถึงอายุ 95 เลยค่ะ`;
  }
  if (f.product === "LEGACY" && f.legacy) {
    return `แผนนี้ ${name ? "" : `${who} ปี `}${budgetLead(f, "ด้วยค่าใช้จ่าย")}ทำมรดก ${f.legacy.tier} ล้าน ${legacyLeadLine(f.legacy)}`;
  }
  if (f.product === "PLB" && f.plb) {
    return `แผนนี้ ${name ? "" : `${who} ปี `}${budgetLead(f, "ด้วยค่าใช้จ่าย")}${plbLeadLine(f.plb)}`;
  }
  if (f.product === "GSAVING" && f.gsaving) {
    return `แผนออมนี้ ${name ? "" : `${who} ปี `}${budgetLead(f, "ถ้าออม")}${gsLeadLine(f.gsaving)}`;
  }
  if (f.product === "IHEALTHY") {
    return `แผน ${f.planName} ${name ? "" : `${who} `}${budgetLead(f, "ด้วยงบ")}เหมาจ่ายค่ารักษาสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ต่อปีค่ะ`;
  }
  const sum = spokenBaht(digits(f.insuredLine));
  if (f.product === "ISHIELD") {
    return `แผนนี้ ${who} ${budgetLead(f, "ถ้าออม")}ทำทุน ${sum} คุ้มครองโรคร้ายแรง${f.illness ? ` ${f.illness.total} โรค` : ""} จ่ายเป็นเงินก้อนตั้งแต่ระยะเริ่มต้นเลยค่ะ`;
  }
  return `แผนนี้ ${who} ${budgetLead(f, "ถ้าออม")}ทำทุน ${sum} ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ค่ะ`;
}

/**
 * The 15-second clip for a Page's Reels (owner, 2026-10-11): the hook, the price, the invitation —
 * three scenes, three sentences, no greeting and no customer's name, since it goes up in public.
 * The same wording as the long clip's, only less of it.
 */
function shortScript(f: QuoteVideoFacts): SceneScript[] {
  const ask = "ทักมาขอใบเสนอได้เลยนะคะ";
  if (f.product === "PENSION" && f.pension) {
    const p = f.pension;
    return [
      { key: "lead", voice: `${f.budget ? budgetLead(f, "ถ้าออม") : "ออมวันนี้ "}ตั้งแต่อายุ ${p.start} รับบำนาญเดือนละ ${p.monthly} บาท ไปจนถึงอายุ 95 ค่ะ` },
      { key: "price", voice: `ออมเดือนละ ${f.spokenPrice.amount} บาท เพียง ${f.payYears} ปี แถมลดหย่อนภาษีได้ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "LEGACY" && f.legacy) {
    return [
      { key: "lead", voice: `${budgetLead(f, "ด้วยค่าใช้จ่าย")}${f.budget ? "" : "ถ้าเป็นอะไรไป "}ครอบครัวได้เงินก้อนสูงสุดถึง ${bahtSaid(f.lead.baht)}ค่ะ` },
      { key: "price", voice: `ค่าใช้จ่ายปีแรกแค่วันละ ${f.legacy.perDay} บาท คุ้มครองถึงอายุ ${f.legacy.coverToAge} ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "PLB" && f.plb) {
    return [
      { key: "lead", voice: `${budgetLead(f, "ด้วยค่าใช้จ่าย")}ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน ${bahtSaid(f.plb.sum)}ค่ะ` },
      { key: "price", voice: `ค่าใช้จ่ายแค่วันละ ${f.plb.perDay} บาท คุ้มครอง ${f.plb.years} ปีค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "GSAVING" && f.gsaving) {
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}${gsLeadLine(f.gsaving)}` },
      { key: "price", voice: `ออมแค่วันละ ${f.gsaving.perDay} บาท เพียง ${f.gsaving.payYears} ปี แถมลดหย่อนภาษีได้ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "IHEALTHY") {
    return [
      { key: "lead", voice: `${budgetLead(f, "ด้วยงบ")}เหมาจ่ายค่ารักษาสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ต่อปีค่ะ` },
      { key: "price", voice: `ปีแรกเดือนละ ${f.spokenPrice.amount} บาท รวม${includesSaid(f)}ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  const years = f.payToEnd ? `ออมถึงอายุ ${f.coverToAge}` : `ออมเพียง ${f.payYears} ปี`;
  if (f.product === "ISHIELD") {
    const total = f.illness?.total;
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}คุ้มครองโรคร้ายแรง${total ? ` ${total} โรค` : ""} รับเงินก้อนสูงสุด ${spokenWithBaht(f.lead.baht)} ตั้งแต่ระยะเริ่มต้นค่ะ` },
      { key: "price", voice: `ออมแค่วันละ ${f.perDayAmount} บาท ${years} คุ้มครองถึงอายุ ${f.coverToAge} ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  return [
    { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}${f.budget ? "" : "ถ้าเป็นอะไรไป "}ครอบครัวได้เงินก้อนสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ค่ะ` },
    { key: "price", voice: `ออมแค่วันละ ${f.perDayAmount} บาท${f.riders ? ` รวม${f.riders.said}` : ""} ${years} คุ้มครองถึงอายุ ${f.coverToAge} ค่ะ` },
    { key: "contact", voice: ask },
  ];
}

function femaleScript(f: QuoteVideoFacts, customer?: string): SceneScript[] {
  const name = cleanCustomerName(customer);
  const hello = name ? `สวัสดีค่ะ คุณ${name}` : "สวัสดีค่ะ";
  const who = name ? `อายุ ${f.age}` : `${SEX_WHO[f.sex]}อายุ ${f.age}`;
  const closing = name
    ? `คุณ${name}สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ`
    : "สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ";

  if (f.product === "PENSION" && f.pension) return pensionScript(f, f.pension, hello, who, closing, Boolean(name));
  if (f.product === "LEGACY" && f.legacy) return legacyScript(f, f.legacy, hello, who, closing);
  if (f.product === "PLB" && f.plb) return plbScript(f, f.plb, hello, who, closing);
  if (f.product === "GSAVING" && f.gsaving) return gsScript(f, f.gsaving, hello, who, closing);

  if (f.product === "IHEALTHY") {
    const others = (f.compare ?? []).filter((p) => !p.main);
    return [
      { key: "lead", voice: `${hello} ขอเล่าแผนประกันสุขภาพนี้ให้ฟังสั้นๆ นะคะ ${name ? "" : `${who} `}${budgetLead(f, "ด้วยงบ")}แผน ${f.planName} เหมาจ่ายค่ารักษาสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ต่อปีค่ะ`.replace(/\s+/g, " ") },
      { key: "price", voice: `ปีแรกค่าใช้จ่ายเดือนละ ${f.spokenPrice.amount} บาท รวม${includesSaid(f, "กับ", true)}ไว้แล้วค่ะ` },
      { key: "cover", voice: healthCoverLine(f) },
      ...(others.length
        ? [{ key: "compare" as const, voice: `ถ้าอยากเทียบ ${others.map((p) => `แผน ${p.name} วงเงิน ${p.ceiling} เดือนละ ${p.monthly} บาท`).join(" และ")} ต่ออายุได้ถึงอายุ ${f.coverToAge} เลยค่ะ` }]
        : []),
      { key: "contact", voice: closing },
    ];
  }

  const value = f.payToEnd
    ? (f.breakEven
      ? `ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน มูลค่าเงินสดโตขึ้นทุกปี พออายุ ${f.breakEven.age} ขอคืนได้ ${f.breakEven.cash} บาท มากกว่าที่ออมไปทั้งหมดค่ะ`
      : "ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน มูลค่าเงินสดโตขึ้นทุกปี ขอคืนได้ตามตารางเลยค่ะ")
    : f.breakEven
    ? `ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน ออมครบตอนอายุ ${f.lastPayAge} แล้วเงินก็ยังโตทุกปี พออายุ ${f.breakEven.age} ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ ${f.breakEven.cash} บาท มากกว่าที่ออมไปทั้งหมดแล้วค่ะ`
    : `ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน ออมครบตอนอายุ ${f.lastPayAge} แล้วเงินก็ยังโตทุกปี ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ตามตารางเลยค่ะ`;

  if (f.product === "ISHIELD") {
    const row = (re: RegExp) => f.cover.find((r) => re.test(r.label));
    const early = row(/ระยะเริ่มต้น/);
    const major = row(/ระยะรุนแรง/);
    const death = row(/เสียชีวิต/);
    const maturity = row(/ครบสัญญา/);
    const ill = f.illness;
    const parts = [
      early && `เจอระยะเริ่มต้น${ill ? ` ${ill.early} โรค` : ""} รับก่อนเลยโรคละ ${spokenBaht(digits(early.amount))} เป็นคนละโรคก็เคลมได้อีก`,
      major && `ถ้าถึงระยะรุนแรง${ill ? ` ${ill.major} โรค` : ""} รับรวมสูงสุด ${spokenBaht(digits(major.amount))}`,
      death && `ถ้าไม่ได้เคลมเลย เป็นอะไรไปครอบครัวได้ ${spokenBaht(digits(death.amount))}`,
      maturity && `อยู่ครบอายุ ${f.coverToAge} ก็รับคืน ${spokenBaht(digits(maturity.amount))}`,
    ].filter(Boolean);
    return [
      { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ${budgetLead(f, "ถ้าออม")}ทำทุน ${spokenBaht(digits(f.insuredLine))} คุ้มครองโรคร้ายแรง${ill ? ` ${ill.total} โรค` : ""} จ่ายเป็นเงินก้อนตั้งแต่ระยะเริ่มต้นเลยค่ะ` },
      { key: "price", voice: `ออมแค่วันละ ${f.perDayAmount} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท เบี้ยเท่าเดิมทุกปี ออมเพียง ${f.payYears} ปีก็ครบ แต่ดูแลยาวถึงอายุ ${f.coverToAge} เลยค่ะ` },
      { key: "cover", voice: `${parts.join(" ")}ค่ะ` },
      { key: "value", voice: value },
      { key: "contact", voice: closing },
    ];
  }

  // Life Protect
  const [first, second] = f.cover;
  const beforeAge = first?.label.match(/(\d+)/)?.[1];
  const cover = second && beforeAge
    ? `ถ้าเป็นอะไรไปก่อนอายุ ${beforeAge} ครอบครัวได้ ${spokenBaht(digits(first.amount))} หลังจากนั้นได้ ${spokenBaht(digits(second.amount))} และดูแลยาวไปถึงอายุ ${f.coverToAge} เลยค่ะ`
    : `ถ้าเป็นอะไรไป ครอบครัวได้ ${spokenBaht(digits(first.amount))} และดูแลยาวไปถึงอายุ ${f.coverToAge} เลยค่ะ`;
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ${budgetLead(f, "ถ้าออม")}ทำทุน ${spokenBaht(digits(f.insuredLine))} ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ค่ะ` },
    { key: "price", voice: lifeProtectPriceLine(f) },
    { key: "cover", voice: `${cover}${ridersCoverLine(f)}` },
    { key: "value", voice: value },
    { key: "contact", voice: closing },
  ];
}

/**
 * Life Protect's price, said; with riders (owner, 2026-10-17, mockup https://claude.ai/artifact/ESb8JXLfKhv3VVn95SXzEf)
 * the instalment says what it includes, and "เท่าเดิมตลอด" only where the whole of it is level.
 */
function lifeProtectPriceLine(f: QuoteVideoFacts): string {
  const r = f.riders;
  // the instalment contract by contract where it can be said (owner, 2026-10-17, ก); else what it includes
  const parts = r?.split
    ? ` เป็น${r.split.map((p, i) => `${i === r.split!.length - 1 ? "และ" : ""}${p.name} ${p.baht} บาท`).join(" ")}`
    : r ? ` รวม${r.said}ไว้แล้ว` : "";
  const price = `ออมแค่วันละ ${f.perDayAmount} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท${parts}`;
  const years = f.payToEnd ? `ออมสบายๆ ถึงอายุ ${f.coverToAge}` : `ออมเพียง ${f.payYears} ปีก็ครบ`;
  return `${price} ${years} ${r?.rises ? `ส่วน${r.rises}ปรับตามอายุค่ะ` : "ยอดออมเท่าเดิมตลอดค่ะ"}`;
}

/**
 * What each Life Protect rider pays out, after the death benefit (owner, 2026-10-17, mockup
 * https://claude.ai/artifact/XaTkLWYU8twVqtMfrYFLGN, ก): " ยังมีสัญญาเพิ่มเติมอีก 2 ตัว …ค่ะ"; nothing without riders.
 */
function ridersCoverLine(f: QuoteVideoFacts): string {
  const parts = f.riders?.parts ?? [];
  if (!parts.length) return "";
  const each = parts.map((p, i) => `${parts.length > 1 && i === parts.length - 1 ? "และ" : ""}${p.name} ${p.what}`);
  return ` ยังมีสัญญาเพิ่มเติม${parts.length > 1 ? `อีก ${parts.length} ตัว` : ""} ${each.join(" ")}ค่ะ`;
}

/**
 * บำนาญ 95's five lines (owner, 2026-10-13, mockup https://claude.ai/artifact/MYHhrcJkg8h58gk2DZ8ij2):
 * the monthly pension and when it runs, the instalments and the tax, the steps up, the fifteen
 * guaranteed years and the total pension — said roughly, never against the premiums (choice 1ก).
 */
function pensionScript(f: QuoteVideoFacts, p: PensionVideoFacts, hello: string, who: string, closing: string, named: boolean): SceneScript[] {
  const annual = f.prices.find((r) => r.main)?.amount ?? "";
  const later = p.bands.slice(1);
  // "6 ล้านบาท" runs together as it is said; a figure in digits keeps its space
  const rough = roughBaht(p.totalPension);
  const total = rough.endsWith("ล้าน") ? `${rough}บาท` : `${rough} บาท`;
  const steps = later.map((b, i) => (i === 0
    ? `อายุ ${b.from} เพิ่มเป็นปีละ ${b.annual} บาท`
    : i === later.length - 1 ? `และตั้งแต่ ${b.from} ได้ปีละ ${b.annual} บาท` : `อายุ ${b.from} ปีละ ${b.annual} บาท`));
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนบำนาญนี้ให้ฟังสั้นๆ นะคะ ${named ? "" : `${who} `}อยากมีเงินใช้ทุกเดือนหลังเกษียณ ${budgetLead(f, "ถ้าออม")}ตั้งแต่อายุ ${p.start} รับบำนาญเดือนละ ${p.monthly} บาท ไปจนถึงอายุ 95 เลยค่ะ`.replace(/\s+/g, " ") },
    { key: "price", voice: `ออมปีละ ${annual} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท ออมเพียง ${f.payYears} ปีก็ครบ ยอดออมเท่าเดิมตลอด แล้วยังนำไปลดหย่อนภาษีได้ด้วยค่ะ` },
    { key: "cover", voice: `ยิ่งอายุมาก ยิ่งได้มากขึ้นค่ะ ${steps.join(" ")}ค่ะ` },
    { key: "value", voice: `ที่ชอบที่สุดคือ บำนาญ 15 ปีแรกรับประกันจ่าย ถ้าเป็นอะไรไปก่อน ครอบครัวยังได้ส่วนที่เหลือ รวมรับบำนาญถึงอายุ 95 ประมาณ ${total}ค่ะ` },
    { key: "contact", voice: closing },
  ];
}

/** "1,150,000 บาท": a figure said as the mockup says it, in digits (say-numbers.ts reads it out) */
const bahtSaid = (baht: number) => `${baht.toLocaleString("en-US")} บาท`;

/** "ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้เงินก้อนถึง 1,150,000 บาทค่ะ": the most the family receives, and until when */
function legacyLeadLine(l: LegacyVideoFacts): string {
  const [first] = l.bands;
  const before = l.bands.length > 1 ? `ก่อนอายุ ${first.to + 1} ` : "";
  return `ถ้าเป็นอะไรไป${before ? "" : " "}${before}ครอบครัวได้เงินก้อนถึง ${bahtSaid(first.amount)}ค่ะ`;
}

/**
 * มรดกเพื่อครอบครัว's five lines (owner, 2026-10-14, mockup https://claude.ai/artifact/55oEG3PjdupXzKPkTHbU75):
 * the legacy and the most the family receives, the first year's price (ค่าใช้จ่าย, never ออม) and
 * that the critical-illness part rises with age, the bands by age, the critical-illness lump sum.
 */
function legacyScript(f: QuoteVideoFacts, l: LegacyVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  const [a, b] = l.bands;
  const cover = b
    ? `ถ้าเป็นอะไรไปก่อนอายุ ${b.from} ครอบครัวได้ ${bahtSaid(a.amount)} ${l.bands.length > 2 ? `อายุ ${b.from} ถึง ${b.to} ได้ ${bahtSaid(b.amount)} ` : ""}และยังดูแลต่อไปถึงอายุ ${l.coverToAge} ค่ะ`
    : `ถ้าเป็นอะไรไป ครอบครัวได้ ${bahtSaid(a.amount)} ดูแลไปถึงอายุ ${l.coverToAge} ค่ะ`;
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ปี ${budgetLead(f, "ด้วยค่าใช้จ่าย")}ทำมรดก ${l.tier} ล้าน ${legacyLeadLine(l)}` },
    { key: "price", voice: `ค่าใช้จ่ายปีแรกแค่วันละ ${l.perDay} บาท หรือปีละ ${l.annual} บาท${l.monthly ? ` หรือเดือนละ ${l.monthly} บาท` : ""}ค่ะ ส่วนคุ้มครองโรคร้ายแรงจะปรับตามอายุในปีถัดไปนะคะ` },
    { key: "cover", voice: cover },
    { key: "critical", voice: `ที่ชอบที่สุดคือ ถ้าตรวจพบโรคร้ายแรง 1 ใน ${l.diseaseCount} โรค รับเงินก้อนไว้รักษาตัวเอง ${bahtSaid(l.critical)} แล้วประกันชีวิตหลักยังอยู่ต่อให้ครอบครัวค่ะ` },
    { key: "contact", voice: closing },
  ];
}

/** "ทำทุน 1 ล้าน ถ้าเป็นอะไรไปในช่วง 12 ปีนี้ ครอบครัวได้เงินก้อน 1,000,000 บาทค่ะ" */
function plbLeadLine(p: PlbVideoFacts): string {
  return `ทำทุน ${p.sumShort} ถ้าเป็นอะไรไปในช่วง ${p.years} ปีนี้ ครอบครัวได้เงินก้อน ${bahtSaid(p.sum)}ค่ะ`;
}

/**
 * Protection Life's five lines (owner, 2026-10-14, mockup https://claude.ai/artifact/WHryu9gcuXHCxg2P2ibBR9):
 * the sum the family receives within the term, the level price (ค่าใช้จ่าย, never ออม), the cover
 * flat to the term's end, and the four terms — tax relief only for the 10-, 12- and 15-year ones.
 * No waiting period, no "from today": neither is confirmed.
 */
function plbScript(f: QuoteVideoFacts, p: PlbVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ปี ${budgetLead(f, "ด้วยค่าใช้จ่าย")}${plbLeadLine(p)}` },
    { key: "price", voice: `ค่าใช้จ่ายแค่วันละ ${p.perDay} บาท หรือปีละ ${p.annual} บาท เท่าเดิมทุกปีตลอด ${p.years} ปีค่ะ` },
    { key: "cover", voice: `คุ้มครองเต็ม ${bahtSaid(p.sum)}ทุกปี ไปจนถึงอายุ ${p.endAge} จ่ายกี่ปี ก็คุ้มครองเท่านั้นปีค่ะ` },
    { key: "terms", voice: `ที่ชอบที่สุดคือ เลือกระยะได้ ${termsSaid(p.terms)} ปี อย่างแผนนี้ ${p.years} ปี รวมจ่ายทั้งหมด ${p.total} บาท แต่ครอบครัวได้ความคุ้มครองถึง ${p.sumShort}${p.tax ? " แถมลดหย่อนภาษีได้ด้วย" : ""}ค่ะ` },
    { key: "contact", voice: closing },
  ];
}

/**
 * Global Savings 15/8's five lines (owner, 2026-10-20, storyboard https://claude.ai/artifact/BKLRMPpKEaG81BdXBKCsv9):
 * the guarantee, the level saving with its tax relief, the paybacks and the maturity (certain), and
 * the index bonus at the return the agent picked — always "ประมาณ" and "ไม่การันตี" (gsaving.ts).
 */
function gsScript(f: QuoteVideoFacts, g: GsVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนออมนี้ให้ฟังสั้นๆ นะคะ ${who} ปี ${budgetLead(f, "ถ้าออม")}${gsLeadLine(g)}` },
    { key: "price", voice: `ออมแค่วันละ ${g.perDay} บาท หรือปีละ ${gsMoney(g.premium)} บาท ออมเพียง ${g.payYears} ปีก็ครบ ยอดออมเท่าเดิมทุกปี แล้วยังนำไปลดหย่อนภาษีได้ด้วยค่ะ` },
    { key: "cover", voice: `ระหว่างทางรับเงินคืน 1% ของทุนทุกปี ครบ ${g.term} ปีรับอีก ${bahtSaid(Math.round(g.maturity))} รวมเงินการันตี ${bahtSaid(Math.round(g.guaranteed))} ได้แน่นอนค่ะ ระหว่างนี้ยังคุ้มครองชีวิตสูงสุด ${bahtSaid(Math.round(g.deathMax))}ด้วยค่ะ` },
    { key: "index", voice: gsIndexLine(g) },
    { key: "contact", voice: closing },
  ];
}

/** How each scene of this clip moves (timeline.ts draws the frames from it). */
export function sceneMotion(f: QuoteVideoFacts, key: SceneKey): SceneMotion {
  switch (key) {
    case "lead": return { count: true, sweeps: 1 };
    case "price": return { count: true, sweeps: f.pills.length ? 2 : 1 };
    // Protection Life's flat bar grown, then its rule lit
    case "cover": return f.coverStyle === "bars" ? { bars: true, sweeps: 1 } : f.coverStyle === "flat" ? { sweeps: 2, spread: true } : { sweeps: f.cover.length, spread: true };
    // the classic table's moves and pen notes come from the voice (table-pen.ts tablePlan)
    case "value": return {};
    case "compare": return { ring: true };
    // มรดก's lump sum counted up, its line under it lit
    case "critical": return { count: true, sweeps: 1 };
    // Protection Life's chosen term lit, then the total under the rows
    case "terms": return { sweeps: 2, spread: true };
    // Global Savings: the picked return lit, then the total at it
    case "index": return { sweeps: 2, spread: true };
    case "contact": return {};
    // one highlighter a point, a question, a step as the voice reaches it; the comparison counted up
    case "story": return { sweeps: 3, spread: true };
    case "qa": return { sweeps: 2, spread: true };
    case "versus": return { count: true, sweeps: 1 };
    case "steps": return { sweeps: 3, spread: true };
  }
}

/**
 * The words a clip goes up to a Page with (owner, 2026-10-11): from the clip's own figures, never
 * the customer's name — a clip that carries one does not go to a Page at all. The admin edits it.
 */
export function pageCaption(f: QuoteVideoFacts): string {
  const who = `${SEX_WHO[f.sex]}อายุ ${f.age}`;
  const ask = "ทักแชทขอใบเสนอของคุณได้เลย";
  if (f.product === "PENSION" && f.pension) {
    const p = f.pension;
    return [
      `บำนาญเดือนละ ${p.monthly} บาท ตั้งแต่อายุ ${p.start} ถึง 95`,
      `${who} ออมเดือนละ ${f.spokenPrice.amount} บาท จ่ายแค่ ${f.payYears} ปี เบี้ยลดหย่อนภาษีได้`,
      `บำนาญเพิ่มตามอายุ · รับประกันจ่าย 15 ปีแรก`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "LEGACY" && f.legacy) {
    const l = f.legacy;
    return [
      `มรดก ${l.tier} ล้าน สำหรับครอบครัว ถ้าเป็นอะไรไป ครอบครัวได้สูงสุด ${f.lead.amount} บาท`,
      `${who} ค่าใช้จ่ายปีแรกตกวันละ ${l.perDay} บาท (ปีละ ${l.annual} บาท)`,
      `ตรวจพบโรคร้ายแรง 1 ใน ${l.diseaseCount} โรค รับเงินก้อน ${l.critical.toLocaleString("en-US")} บาท · คุ้มครองถึงอายุ ${l.coverToAge}`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "PLB" && f.plb) {
    const p = f.plb;
    return [
      `Protection Life คุ้มครองชีวิต ${p.sumShort} ถ้าเป็นอะไรไปภายใน ${p.years} ปี ครอบครัวได้ ${f.lead.amount} บาท`,
      `${who} ค่าใช้จ่ายตกวันละ ${p.perDay} บาท (ปีละ ${p.annual} บาท) เท่าเดิมทุกปี`,
      `คุ้มครองถึงอายุ ${p.endAge} · เลือกระยะได้ ${termsSaid(p.terms)} ปี${p.tax ? " · ลดหย่อนภาษีได้" : ""}`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "GSAVING" && f.gsaving) {
    const g = f.gsaving;
    return [
      `Global Savings 15/8 ออม ${g.payYears} ปี รับเงินการันตีรวม ${f.lead.amount} บาท`,
      `${who} ออมปีละ ${gsMoney(g.premium)} บาท (ตกวันละ ${g.perDay} บาท) ลดหย่อนภาษีได้`,
      g.rate > 0
        ? `ถ้าดัชนีโตเฉลี่ยปีละ ${rateLabel(g.rate)} รวมรับประมาณ ${gsMoney(g.total)} บาท (โบนัสดัชนีไม่การันตี)`
        : `ดัชนีไม่โตก็ยังได้เงินการันตีเต็มจำนวน · โบนัสดัชนีไม่การันตี`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "IHEALTHY") {
    return [
      `ประกันสุขภาพเหมาจ่าย แผน ${f.planName} วงเงิน ${spokenBaht(f.lead.baht)}บาทต่อปี`,
      `${who} ปีแรกเดือนละ ${f.spokenPrice.amount} บาท`,
      `ต่ออายุได้ถึงอายุ ${f.coverToAge}`,
      "",
      ask,
    ].join("\n");
  }
  const sum = spokenBaht(digits(f.insuredLine));
  if (f.product === "ISHIELD") {
    return [
      `โรคร้ายแรง ${f.illness?.total ?? ""} โรค จ่ายเงินก้อนตั้งแต่ระยะเริ่มต้น`.replace("  ", " "),
      `${who} ทุน ${sum} ตกวันละ ${f.perDayAmount} บาท จ่ายแค่ ${f.payYears} ปี เบี้ยเท่าเดิมทุกปี`,
      `คุ้มครองถึงอายุ ${f.coverToAge}`,
      "",
      ask,
    ].join("\n");
  }
  return [
    `มรดก ${spokenBaht(f.lead.baht)} สำหรับครอบครัว`,
    `${who} ทุน ${sum} ตกวันละ ${f.perDayAmount} บาท${f.riders ? ` (รวม${f.riders.said})` : ""} จ่ายแค่ ${f.payYears} ปี`,
    `คุ้มครองถึงอายุ ${f.coverToAge} · เงินไม่หายไปไหน เวนคืนได้`,
    "",
    ask,
  ].join("\n");
}
