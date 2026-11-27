import type { ThemeKey } from "./theme-keys";
import type { FestivalKey } from "./festival";
import type { MyColor } from "@/lib/card-theme";
import type { CardRiders, PlanCardInput } from "@/lib/card-link";
import { iHealthyCard, plainRows } from "@/lib/ihealthy-card";
import { iHealthyFacts as benefitSheet } from "@/lib/ihealthy-facts";
import { setupQuery } from "./ihealthy-setup";
import { iShieldTable } from "@/lib/ishield-table";
import { LIFEPROTECT_PLAN } from "@/lib/lifeprotect-card";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { quoteCard, valueTableCard, type ValueTableRow } from "@/lib/quote-card";
import type { PensionPay } from "@/calc/pension/engine";
import { pensionVideoFacts, roughBaht, type PensionVideoFacts } from "./pension";
import { legacyVideoFacts, type LegacyVideoFacts } from "./legacy";
import { plbVideoFacts, termsSaid, type PlbVariant, type PlbVideoFacts } from "./plb";
import { gsavingVideoFacts, gsIndexLine, gsLeadLine, gsMoney, rateLabel, type GsVideoFacts } from "./gsaving";
import { easyProtectVideoFacts, epFamily, epMoney, epSixLine, epTotalLine, epValueLine, type EasyProtectVideoFacts } from "./easyprotect";
import { lifeTreasureVideoFacts, ltFamily, ltLeadLine, ltMoney, ltPriceLine, ltTermsLine, ltTotalLine, ltValueLine, type LifeTreasureVariant, type LifeTreasureVideoFacts } from "./lifetreasure";
import { ci123VideoFacts, ciBaseLine, ciLeadLine, ciMoney, ciMoreLine, ciPriceLine, ciStairsLine, type Ci123VideoFacts } from "./ci123";
import { caDailyLine, caLeadLine, caMoney, caPriceLine, caStairsLine, caTotalLine, cancerVideoFacts, type CancerVideoFacts } from "./cancer";
import { paCoverLine, paInjuryLine, paLeadLine, paPriceLine, paRenewLine, paSixth, paVideoFacts, type PaVideoFacts } from "./pa";
import { grContactLine, grLeadFact, grLeadLine, grLifeLine, grMeLine, grOpdLine, grPaCoverLine, grPriceLine, grStayLine, groupPlanWord, groupVideoFacts, type GroupKind, type GroupPick, type GroupVideoFacts } from "./group";
import { tpCashLine, tpFamilyLine, tpLeadLine, tpMoney, tpPriceLine, tpTotalLine, twelvePlVideoFacts, type TwelvePlDividend, type TwelvePlVideoFacts } from "./twelvepl";
import type { SceneMotion, VideoSize } from "./timeline";
import type { VideoBrief, WrittenLines } from "./brief";
import type { RecipeKey } from "./recipes";
import type { AdPlan } from "@/lib/ad-video/keys";
import { extraVoice, linesOf, loops, sceneOrder, type Told } from "./told";
import { VIDEO_WORDS, type VideoLang } from "./video-words";
import { figure } from "@/lib/ihealthy-lang";
import { WORDS } from "@/lib/ihealthy-words";
import { foreignScript } from "./ihealthy-foreign";
import type { AllPlansFacts } from "./ihealthy-all-plans";
import { allPlansCaption, allPlansScript, allPlansVideoFacts } from "./ihealthy-all-plans-script";
import type { PayMode } from "@/calc/types";
import { shows } from "@/lib/pay-prefs";

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
 * 12 พีแอล is the eighth (owner, 2026-11-26; twelvepl.ts): the /12pl plan, its cash backs, maturity and dividend example.
 * อีซี่ โพรเทค 6 is the ninth (owner, 2026-11-26; easyprotect.ts): the /easyprotect plan, six years paid and covered to 99.
 * ไลฟ์เทรเชอร์ is the tenth (owner, 2026-11-26; lifetreasure.ts): the /lifetreasure plan, a sum set for the family, 6, 12 or 18 years paid.
 * CI 123 is the eleventh (owner, 2026-11-26; ci123.ts): the /ci123 set, the critical-illness rider paid by stage on Life Protect x2.
 * ประกันมะเร็ง is the twelfth (owner, 2026-11-26; cancer.ts): the /cancer set, CPR paid by the stage of a cancer and HIC's daily sum.
 * PA is the thirteenth (owner, 2026-11-26; pa.ts): the /pa accident plans, the first priced by plan and occupation class
 * alone — its input has no age or sex, and its clip says none (personOf, pricedByPlan).
 * ประกันกลุ่ม is the fourteenth (owner, 2026-11-26, ข; group.ts): the /group-insurance page's health or PA group, told to
 * the employer — a head a year, about a month, the whole company. Priced by plan, business type and head count: no person.
 * iHealthy Ultra, มรดก and Protection Life keep "ค่าใช้จ่าย": none builds anything to save. The screen keeps the
 * cards' own words. Words in a line are separated by single spaces: the subtitles light up one
 * of those pieces at a time.
 */

export type Product = "LIFEPROTECT" | "ISHIELD" | "IHEALTHY" | "PENSION" | "LEGACY" | "PLB" | "GSAVING" | "TWELVEPL" | "EASYPROTECT" | "LIFETREASURE" | "CI123" | "CANCER" | "PA" | "GROUP";
export type SceneKey = "lead" | "price" | "cover" | "value" | "compare" | "contact"
  /** มรดก's fourth scene, where the others have their value table: the critical-illness lump sum (CI 123's third: its stages as stairs; its fourth, "cover", what else it pays; its fifth, "family", the base contract's life cover) */
  | "critical"
  /** Protection Life's fourth scene, where the others have their value table: the four terms side by side (ไลฟ์เทรเชอร์'s third: its three paying terms) */
  | "terms"
  /** Global Savings' fourth scene: the seven index returns as bars, the picked one gold (gsaving.ts) */
  | "index"
  /** 12 พีแอล's fourth and fifth scenes: what the family receives to 85, and what is paid beside what comes back (twelvepl.ts; อีซี่ โพรเทค 6's fourth: its premiums beside what the family receives) */
  | "family" | "total"
  /** the longer clips' own (told.ts, owner 2026-10-13): the customer's story, a comparison, two questions, how to start */
  | "story" | "versus" | "qa" | "steps"
  /**
   * Life Protect with riders (owner, 2026-11-21, ก ก ก on https://claude.ai/artifact/HvVdgdGq4oajv1Hjd1ZBv2): the
   * package at a glance, one scene for each rider with its own picture, and what each event pays
   */
  | "riders" | RiderKey | "payout";

/** one scene a rider, in the page's order: at most six (WP, MEB, DCI, CI 123, AP, ECARE) */
export const RIDER_KEYS = ["rider1", "rider2", "rider3", "rider4", "rider5", "rider6"] as const;
export type RiderKey = (typeof RIDER_KEYS)[number];
/** which rider a scene shows, 0 first; undefined for a scene that is not a rider's */
export const riderIndex = (key: string): number | undefined => {
  const i = (RIDER_KEYS as readonly string[]).indexOf(key);
  return i < 0 ? undefined : i;
};

/**
 * One Life Protect rider as its scene shows it (owner, 2026-11-21): its name on screen and in the voice,
 * its share of the spoken instalment in whole baht where the split gives one, what it pays, and the
 * figures its picture is drawn from.
 */
export type RiderScene = {
  code: string;
  /** the scene's heading, "ยกเว้นเบี้ย", and the line under it, "ดับบลิวพี ฟิต" */
  title: string;
  sub: string;
  /** the overview's badge, "ชดเชยรายวัน" */
  badge: string;
  /** the name the voice says, "สัญญาโรคร้ายแรง DCI" */
  said: string;
  /** its share of the spoken instalment, whole baht, "362"; absent where the split does not say it */
  price?: string;
  /** its premium moves with age (the medical plan's) */
  rises?: boolean;
  /** what it pays, said the owner's way */
  what: string;
} & (
  | { kind: "waiver"; plus: boolean; startAge: number; paid: number; left: number }
  | { kind: "medical"; perDay: number; days: number }
  | { kind: "dci"; sum: number; diseases: number; coverToAge?: number }
  | { kind: "ci123"; sum: number; diseases: number; stairs: CiStage[]; more: CiStage[] }
  | { kind: "ap"; sum: number; coverToAge?: number }
  | { kind: "ecare"; sum: number; care: number; coverToAge?: number }
);
/** a stage of CI 123: its name, its share ("25%", "20% ไม่เกิน 100,000") and what it pays on this sum */
export interface CiStage { label: string; share: string; amount: number }
/** a row of "เกิดเรื่องนี้ ได้เท่าไร": the event, the contracts that pay, what they come to */
export interface PayoutRow { tone: "early" | "major" | "hospital" | "accident" | "waiver"; event: string; from: string; amount: string }

/** What the agent asked for. A row written before products existed has no `product`: Life Protect. */
export type VideoInput = (
  /** `riders`: Life Protect only, the riders its page priced in (owner, 2026-10-17, 1ก); absent = the plan alone */
  | { product?: "LIFEPROTECT" | "ISHIELD"; variant: string; age: number; sex: "M" | "F"; sumAssured: number; riders?: CardRiders }
  /** `setup`: the iHealthy Ultra page's base, sum, territory, coverage and riders as its address writes them (ihealthy-setup.ts); absent = the page's defaults */
  /** `lang`: the language the clip is told in (owner, 2026-10-15; video-words.ts); absent = Thai */
  /** `allPlans`: วิดีโอเทียบ 4 แผน (owner chose ข, 2026-11-11), the iHealthy Ultra Package page in this instalment; `plan`, `compare` and `setup` are then unused */
  | { product: "IHEALTHY"; age: number; sex: "M" | "F"; plan: string; compare: string[]; setup?: string; lang?: VideoLang; allPlans?: PayMode }
  /** the sum the pension is paid from; the form may send the monthly pension instead (pension.ts checkedPension) */
  | { product: "PENSION"; age: number; sex: "M" | "F"; annuityAge: number; pay: PensionPay; sumAssured: number; monthly?: number }
  /** มรดกเพื่อครอบครัว: the tier, 1–10, which is the millions the family receives (legacy.ts) */
  | { product: "LEGACY"; age: number; sex: "M" | "F"; tier: number }
  /** Protection Life: a term (paid and covered alike) and a sum from the /plb page's steps (plb.ts) */
  | { product: "PLB"; variant: PlbVariant; age: number; sex: "M" | "F"; sumAssured: number }
  /** Global Savings 15/8: the yearly premium and the index's return, % a year, the clip's example is worked at (gsaving.ts) */
  /** `plan`: "25/5" for Global Savings Plus 25/5 (owner, 2026-11-16); absent = 15/8 */
  | { product: "GSAVING"; age: number; sex: "M" | "F"; premium: number; rate: number; plan?: "25/5" }
  /** 12 พีแอล: the sum, the riders its page sells, and the company's dividend example shown (0 = none) (twelvepl.ts) */
  | { product: "TWELVEPL"; age: number; sex: "M" | "F"; sumAssured: number; dividend: TwelvePlDividend; riders?: CardRiders }
  /** อีซี่ โพรเทค 6: one of its page's sums (easyprotect.ts) */
  | { product: "EASYPROTECT"; age: number; sex: "M" | "F"; sumAssured: number }
  /** ไลฟ์เทรเชอร์: one of its page's sums and one of its three paying terms (lifetreasure.ts) */
  | { product: "LIFETREASURE"; variant: LifeTreasureVariant; age: number; sex: "M" | "F"; sumAssured: number }
  /** CI 123: one of its page's seven CI sums, on the base the set always has (ci123.ts) */
  | { product: "CI123"; age: number; sex: "M" | "F"; sumAssured: number }
  /** ประกันมะเร็ง: one of its page's eight packages, named by its CPR sum (cancer.ts) */
  | { product: "CANCER"; age: number; sex: "M" | "F"; sumAssured: number }
  /**
   * PA: a plan by its company code ("PAP02") and an occupation class, 1–3 (pa.ts). No age, no sex: the price is the
   * plan's and the class's alone (personOf answers undefined); the group plan is the next of this kind
   */
  | { product: "PA"; plan: string; cls: number }
  /**
   * ประกันกลุ่ม: health or PA, and every employee group the page had (group.ts) — the first is the one the clip tells,
   * the head count and the company's total are all of them. No age, no sex (personOf answers undefined)
   */
  | { product: "GROUP"; kind: GroupKind; groups: GroupPick[] }
) & {
  /** who reads it (owner, 2026-10-11): a woman (Kore) unless a man is asked for */
  narrator?: "F" | "M";
  /** an ElevenLabs voice's id when the clip is read by one, Gemini's narrator otherwise (owner, 2026-10-11) */
  voice?: string;
  /** one of Gemini's 30 voices by name (owner, 2026-10-17); none = the narrator's own, Kore or Orus */
  gemini?: string;
  /** แบบปกติ (photo, card, table) or Motion Graphic, the Premium one (owner, 2026-10-11) */
  style?: VideoStyle;
  /** a Motion Graphic clip's look (owner, 2026-10-17; theme-keys.ts); absent = DEFAULT_THEME (ไวท์บอร์ด since 2026-11-17). Read with readTheme: a row from before 2026-10-20 may name one taken away */
  theme?: ThemeKey;
  /** ธีมเทศกาล's festival, kept from the day the clip was asked for (festival.ts); with theme "festival" only */
  festival?: FestivalKey;
  /** สีของฉัน's colour, as the agent keeps it (card-theme.ts MY_COLORS); with theme "mine" only */
  myColor?: MyColor;
  /** น้องโล่ in the corner (owner, 2026-10-20; mascot.tsx); absent = none, as clips before it */
  mascot?: boolean;
  /** the next scene's figure carried over each join (owner, 2026-10-20; carry.tsx); absent = the plain joins */
  carry?: boolean;
  /** ลูกเล่นคลิปใหม่ (fx.ts): made with the music, the sounds and the moving icons; the agent turned the music off */
  fx?: true;
  noMusic?: true;
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
  /**
   * สูตรคลิป Motion (owner, 2026-11-11, mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88, ก ก ก; recipes.ts):
   * the whole clip told as this recipe. Read only with style motion, portrait, and while it fits the quote (recipeOf);
   * absent on every other clip
   */
  recipe?: RecipeKey;
  /**
   * ตั้งค่าส่วนตัว (owner, 2026-11-14; src/lib/pay-prefs.ts): the instalments the agent who made the clip
   * switched off, kept with the job so a re-render says the same. Absent (every clip before it) = nothing hidden
   */
  hide?: PayMode[];
  /**
   * แสดงคำอธิบายในตาราง (owner, 2026-11-14; src/lib/pay-prefs.ts): false when the agent who made the clip
   * switched the table's pen notes off, kept with the job. Absent (every clip before it) = notes drawn
   */
  pen?: boolean;
  /**
   * วิดีโอโฆษณา (owner chose ก ×6 on the mockup, 2026-11-22; src/lib/ad-video): the ad's plan, told in place of the
   * standing clip's lines. Absent on every other clip
   */
  ad?: AdPlan;
  /** an ad's photos as filed, one a scene (lead, bodies…, contact): null for a scene drawn without one, or whose photo failed */
  pictures?: (string | null)[];
};

/** what a job's input hides; anything unreadable, and every clip made before the setting, hides nothing */
export function hideOf(v: { hide?: unknown }): PayMode[] {
  const h: unknown[] = Array.isArray(v.hide) ? v.hide : [];
  return (["semi", "monthly"] as const).filter((m) => h.includes(m));
}

/** whether the agent who made a clip (any kind: a story clip keeps `hide` too) hid the monthly instalment */
export const noMonthly = (input: { hide?: unknown }): boolean => hideOf(input).includes("monthly");

/** 15 s, ~50 s, ~90 s, ~2 min (owner, 2026-10-13: "สูงสุดถึง 2 นาที"; told.ts sceneOrder) */
export type VideoLength = "short" | "full" | "long" | "max";

/** แชทถาม-ตอบ (owner, 2026-10-20; chat.tsx): drawn by Remotion as Motion Graphic is, priced as แบบปกติ */
export type VideoStyle = "classic" | "motion" | "chat";

/** A man ends his sentences with ครับ, a woman with ค่ะ / นะคะ (owner, 2026-10-11). */
export function spokenBy(line: string, narrator: "F" | "M" = "F"): string {
  // a question's คะ too, where it ends a word (not คะแนน): before a space, the end, or punctuation ("ไหมคะ?", R12 2026-11-22)
  return narrator === "M" ? line.replace(/นะคะ/g, "นะครับ").replace(/ค่ะ/g, "ครับ").replace(/คะ(?=[\s?!.,…]|$)/g, "ครับ") : line;
}

export const productOf = (v: VideoInput): Product => v.product ?? "LIFEPROTECT";

/**
 * The insured an input is priced for: its age and sex; undefined for a plan priced by plan alone (PA, by plan and
 * occupation class; the group plan next), whose input carries neither (owner, 2026-11-26).
 */
export function personOf(v: VideoInput): { age: number; sex: "M" | "F" } | undefined {
  return "age" in v && "sex" in v ? { age: v.age, sex: v.sex } : undefined;
}

/** a clip of a plan priced by plan alone: no face is drawn, no age said, `insuredWho` names what the price is by */
export const pricedByPlan = (f: QuoteVideoFacts): boolean => f.sex === undefined;

/** `per`: the instalment a row is, where its label is not the Thai one (a clip in another language) */
export interface PriceRow { label: string; amount: string; main: boolean; per?: "month" | "year" | "half" }
export interface CoverRow { label: string; amount: string; mark: boolean }
/** `monthly` is "" and `yearly` the price shown when the agent hid the monthly instalment (facts `comparePer`) */
export interface ComparePlan { name: string; ceiling: string; room: string; opd: string; monthly: string; main: boolean; ceilingBaht?: number; yearly?: string }

/** Everything the clip shows, as the cards state it. Parts a product has not got are absent. */
export interface QuoteVideoFacts {
  product: Product;
  /** the language the screen and the voice are in; absent = Thai (only iHealthy Ultra has others) */
  lang?: VideoLang;
  planLine: string;
  insuredWho: string;
  insuredLine: string;
  /**
   * The insured, where the price is a person's (owner, 2026-11-26): absent where it is by plan alone (PA, by plan and
   * occupation class; the group plan after it) — then no face is drawn, `insuredWho` names what the price is by, and
   * `age` is only the youngest the plan takes, never shown or said (pricedByPlan).
   */
  sex?: "M" | "F";
  age: number;
  /** the figure the clip opens on, counted up: มรดก, the lump sum, the yearly ceiling; `unit` where it is not baht (ประกันกลุ่ม: คน) */
  lead: { label: string; amount: string; baht: number; note?: string; unit?: string };
  /** the highlighted line under it: "ตกวันละ 79 บาท"; iHealthy's first-year monthly price */
  leadMark: string;
  /** the closing card's second line where the plan has its own (ไลฟ์เทรเชอร์: แบ่งให้ใครเท่าไร ระบุได้); the narrator's "ยินดีช่วยดูแผนให้" otherwise */
  contactLine?: string;
  /** a second pill under the opening's mark (อีซี่ โพรเทค 6: the day's price; ไลฟ์เทรเชอร์: that the sum is set in advance) */
  leadPill?: string;
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
  /** Life Protect draws its two death benefits as bars; บำนาญ 95 its pension's steps; มรดก its bands as a staircase; Protection Life one flat bar; Global Savings its paybacks on a timeline (the classic clip lists them); 12 พีแอล its cash backs rising to the maturity; อีซี่ โพรเทค 6 its six premiums and the cover after them; the others list their rows */
  coverStyle: "bars" | "rows" | "steps" | "bands" | "flat" | "payback" | "cashback" | "paidup";
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
  /** iHealthy: the base plan's sum, said after "ประกันชีวิต" ("ประกันชีวิตทุน 150,000 บาท") */
  lifeSum?: number;
  /**
   * iHealthy: the cover scene in three groups (owner, 2026-10-20, mockup
   * https://claude.ai/artifact/Uw3cgf8SmZrKbvYmvWML6o, ก) — สัญญาหลัก with the life sum, the health
   * plan's rows, สัญญาเพิ่มเติม (the daily cash and the fold's riders). Motion draws these in place of
   * `cover`; the classic clip, which names the base in its header, keeps `cover`.
   */
  coverGroups?: { title: string; rows: (CoverRow & { main?: boolean })[] }[];
  /** iHealthy: each rider the page attached, said in full in the clip's language — "โรคร้ายแรง DCI ทุน 200,000 บาท" (owner, 2026-10-17, ก) */
  riderNames?: string[];
  /**
   * Life Protect quoted with its page's riders (owner, 2026-10-17, 1ก): what the price includes as
   * said aloud ("สัญญายกเว้นเบี้ย และค่าชดเชยรายวัน"), and the part whose premium moves with age, if any.
   * The longer clips also say the instalment contract by contract (`split`, in the spoken
   * instalment, whole baht) and what each rider pays out (`parts`) (owner, 2026-10-17,
   * mockup https://claude.ai/artifact/XaTkLWYU8twVqtMfrYFLGN, ก)
   */
  riders?: {
    said: string; rises?: string; split?: { name: string; baht: string }[]; parts: { name: string; what: string }[];
    /** each rider's own scene (owner, 2026-11-21, ก) */
    scenes: RiderScene[];
    /** what each event pays across the contracts (owner, 2026-11-21, ก); said only with two rows or more */
    payout: PayoutRow[];
  };
  footNote?: string;
  /** a line kept small at the foot of every scene but the contact card (12 พีแอล: surrendering early may pay back less) */
  screenNote?: string;
  /** บำนาญ 95: the pension's schedule (pension.ts) */
  pension?: PensionVideoFacts;
  /** มรดก: the bands, the critical-illness sum, the first year's price (legacy.ts) */
  legacy?: LegacyVideoFacts;
  /** Protection Life: the term, the sum, the four terms side by side (plb.ts) */
  plb?: PlbVideoFacts;
  /** Global Savings 15/8: the guarantee, the bonus at the picked return, the seven returns (gsaving.ts) */
  gsaving?: GsVideoFacts;
  /** 12 พีแอล: the cash backs, the maturity, what is paid, the dividend example (twelvepl.ts) */
  twelvepl?: TwelvePlVideoFacts;
  /** อีซี่ โพรเทค 6: the six premiums, the multiple, the cover's floor (easyprotect.ts) */
  easyprotect?: EasyProtectVideoFacts;
  /** ไลฟ์เทรเชอร์: the chosen term, the three terms, the multiple, the cash at the end (lifetreasure.ts) */
  lifetreasure?: LifeTreasureVideoFacts;
  /** CI 123: the stages, what else it pays, the base contract's life cover, the first year's price (ci123.ts) */
  ci123?: Ci123VideoFacts;
  /** ประกันมะเร็ง: the four stages, the daily sum, what every contract pays together, the first year's price (cancer.ts) */
  cancer?: CancerVideoFacts;
  /** PA: the plan, the class, what it covers, the injury cover, the sum each renewal year (pa.ts) */
  pa?: PaVideoFacts;
  /** ประกันกลุ่ม: the kind, the first group's plan and what it pays, the head counts, a head's price and the company's (group.ts) */
  group?: GroupVideoFacts;
  /** วิดีโอเทียบ 4 แผน: the iHealthy Ultra Package page's table (ihealthy-all-plans.ts) */
  allPlans?: AllPlansFacts;
  /** ตั้งค่าส่วนตัว: what the agent hid (src/lib/pay-prefs.ts); present only when something is */
  hide?: PayMode[];
  /** the comparison prices each plan yearly (`yearly`) because the agent hid the monthly instalment */
  comparePer?: "year";
  /** false when the agent switched the table's pen notes off (src/lib/pay-prefs.ts); absent = drawn */
  pen?: false;
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
  // the card leaves out what the agent hid, and its headline and split follow (quote-card.ts)
  ...(hideOf(v).length ? { hide: hideOf(v) } : {}),
});

/** each waiver as the voice says it; the medical plan (MEB) is "ค่าชดเชยรายวัน", as the chat and the pages call it */
const WAIVER_SAID: Record<string, string> = { WP: "สัญญายกเว้นเบี้ย", PB: "สัญญาผู้ชำระเบี้ย" };
const MEDICAL_SAID = "ค่าชดเชยรายวัน";
/** the critical-illness riders the Life Protect page adds (owner, 2026-10-28), and what each pays, said the owner's way */
const ILLNESS_SAID: Record<string, string> = {
  DCI: "สัญญาโรคร้ายแรง DCI", CI123: "สัญญาโรคร้ายแรง CI 123",
  // the accident riders (owner, 2026-11-18)
  AP: "สัญญาอุบัติเหตุ AP", ECARE: "สัญญาอุบัติเหตุ ECARE",
};
const illnessWhat = (code: string, sum: number): string => {
  const baht = sum.toLocaleString("en-US");
  if (code === "AP") return `ถ้าเป็นอะไรไปหรือสูญเสียอวัยวะจากอุบัติเหตุ รับสูงสุด ${baht} บาท`;
  if (code === "ECARE") return `อุบัติเหตุ ทุน ${baht} บาท รวมทุพพลภาพ นอนโรงพยาบาล และค่ารักษาไม่เกิน 5% ของทุน`;
  return code === "DCI"
    ? `ถ้าเป็นอะไรไป หรือเป็นโรคร้ายแรง รับเงินก้อน ${baht} บาท`
    : `เป็นโรคร้ายแรง จ่ายตั้งแต่ระยะเริ่มต้นตามระยะของโรค ทุน ${baht} บาท`;
};

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

/** a split row's contract as the screen names it: "ดับบลิวพี ฟิต", "ค่าชดเชยรายวัน ระหว่างนอน รพ. (MEB) แผน 1,000" */
export const riderShort = (label: string) => label.replace(/^สัญญาเพิ่มเติม/, "").replace(/\s+/g, " ").trim();

/**
 * What the riders add to a Life Protect clip: the voice's words for them, and whether their
 * premium moves while the plan's stays level (the medical plan's rises with age) — read off the
 * value table's own rider column, so it is never said where the table does not show it.
 */
function riderFacts(
  riders: CardRiders | undefined, rows: ValueTableRow[], split: { title: string; rows: { label: string; amount: string }[] }, spokenLabel: string,
  at: { age: number; payYears: number; today: Date },
): QuoteVideoFacts["riders"] {
  if (!riders?.waiver && riders?.medical === undefined && !riders?.illness?.length) return undefined;
  const illness = (riders.illness ?? []).map((r) => ({ ...r, name: ILLNESS_SAID[r.code] ?? "สัญญาเพิ่มเติม" }));
  const said = [
    ...(riders.waiver ? [WAIVER_SAID[riders.waiver.code] ?? "สัญญาเพิ่มเติม"] : []),
    ...(riders.medical !== undefined ? [MEDICAL_SAID] : []),
    ...illness.map((r) => r.name),
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
  const names = [
    ...(waiverName ? [waiverName] : []), ...(riders.medical !== undefined ? [MEDICAL_SAID] : []), ...illness.map((r) => r.name),
  ];
  // said only where the split is of the instalment the voice says, and has a row for every rider
  const split_ = main && whole && split.title.endsWith(spokenLabel)
    ? ((b) => [{ name: "สัญญาหลัก", baht: b[0] }, ...rest.map((_, i) => ({ name: names[i], baht: b[i + 1] }))])(wholeShares([main.amount, ...rest.map((r) => r.amount)]))
    : undefined;
  const parts = [
    ...(riders.waiver && waiverName && WAIVER_WHAT[`${riders.waiver.code}.${riders.waiver.option}`]
      ? [{ name: waiverName, what: WAIVER_WHAT[`${riders.waiver.code}.${riders.waiver.option}`] }] : []),
    ...(riders.medical !== undefined
      ? [{ name: MEDICAL_SAID, what: `นอนโรงพยาบาลรับเงินวันละ ${riders.medical.toLocaleString("en-US")} บาท` }] : []),
    ...illness.map((r) => ({ name: r.name, what: illnessWhat(r.code, r.sumAssured) })),
  ];
  const scenes = riderScenes(riders, waiverName, names, parts, split_, at);
  return {
    said: said.length > 1 ? `${said.slice(0, -1).join(" ")} และ${said[said.length - 1]}` : said[0],
    ...(moves ? { rises: riders.medical !== undefined ? MEDICAL_SAID : "สัญญาเพิ่มเติม" } : {}),
    ...(split_ ? { split: split_ } : {}),
    parts,
    scenes,
    payout: [],
  };
}

/** CI 123's parts by the rate sheet's names (data/rates/lifeprotect.json), as the clip names them */
const CI_PART: Record<string, string> = {
  "pre-early ci": "ระยะก่อนเริ่มต้น", "early to intermediate ci": "ระยะเริ่มต้นถึงปานกลาง", "major ci": "ระยะรุนแรง",
  "critical care benefit": "กรณีวิกฤต", "juvenile ci": "โรคเด็ก", "special conditions": "เงื่อนไขพิเศษ",
};
/** the three stages CI 123's stairs climb, lowest first; the rest go under them as small print */
const CI_STAIRS = ["pre-early ci", "early to intermediate ci", "major ci"];
/** the juvenile illnesses cover the insured to 18 (data/riders/ci123-diseases.json) */
const JUVENILE_TO = 18;
/** a page's "31 โรค" */
const diseasesIn = (what: string) => Number(what.match(/(\d+)\s*โรค/)?.[1] ?? 0);
const pct = (share: number) => `${Math.round(share * 100)}%`;
/** "1 ล้าน", "1.5 ล้าน", "500,000": a sum as the picture and the payout table write it short */
export const sumShort = (baht: number) => (baht >= 1_000_000 && baht % 100_000 === 0
  ? `${(baht / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`
  : baht.toLocaleString("en-US"));

/**
 * Each rider's scene (owner, 2026-11-21, ก): in the order the split and the voice name them — the
 * waiver, the medical plan, then the critical-illness and accident riders as the page lists them.
 */
function riderScenes(
  riders: CardRiders, waiverName: string | undefined, names: string[], parts: { name: string; what: string }[],
  split: { name: string; baht: string }[] | undefined, at: { age: number; payYears: number; today: Date },
): RiderScene[] {
  const table = lifeProtectTable(at.today);
  const priceAt = (i: number) => (split?.[i + 1] ? { price: split[i + 1].baht } : {});
  const whatOf = (name: string) => parts.find((p) => p.name === name)?.what ?? "";
  const out: RiderScene[] = [];
  let i = 0;
  if (riders.waiver && waiverName) {
    // the instalments paid until an example disability a little past half way, the rest waived
    const paid = Math.min(at.payYears - 1, Math.max(1, Math.round(at.payYears * 0.55)));
    out.push({
      code: riders.waiver.code, title: "ยกเว้นเบี้ย", sub: waiverName, badge: "ยกเว้นเบี้ย", said: waiverName, ...priceAt(i),
      what: whatOf(waiverName), kind: "waiver", plus: riders.waiver.option === "BEYOND", startAge: at.age, paid, left: at.payYears - paid,
    });
    i++;
  }
  if (riders.medical !== undefined) {
    out.push({
      code: "MEB", title: MEDICAL_SAID, sub: `MEB แผน ${riders.medical.toLocaleString("en-US")}`, badge: "ชดเชยรายวัน", said: MEDICAL_SAID,
      ...priceAt(i), rises: true, what: whatOf(MEDICAL_SAID), kind: "medical", perDay: riders.medical, days: 5,
    });
    i++;
  }
  for (const r of riders.illness ?? []) {
    const name = names[i];
    const row = table.illness.find((x) => x.code === r.code);
    const sum = r.sumAssured;
    const head = { code: r.code, badge: row?.short ?? r.code, said: name, ...priceAt(i), what: whatOf(name) };
    const cover = row?.coverToAge !== undefined ? ` · คุ้มครองถึงอายุ ${row.coverToAge}` : "";
    if (r.code === "CI123" && row) {
      const stages = row.parts.flatMap((p) => {
        const label = p.key ? CI_PART[p.key] : undefined;
        if (!label || !p.key) return [];
        const amount = Math.round(Math.min(sum * p.share, p.cap ?? Infinity));
        return [{ key: p.key, label, share: p.cap ? `${pct(p.share)} ไม่เกิน ${p.cap.toLocaleString("en-US")}` : pct(p.share), amount }];
      });
      const stage = (x: (typeof stages)[number]): CiStage => ({ label: x.label, share: x.share, amount: x.amount });
      const stairs = CI_STAIRS.flatMap((k) => stages.filter((x) => x.key === k)).map(stage);
      const more = stages.filter((x) => !CI_STAIRS.includes(x.key) && (x.key !== "juvenile ci" || at.age <= JUVENILE_TO)).map(stage);
      const diseases = diseasesIn(row.what);
      out.push({ ...head, title: "โรคร้ายแรง CI 123", sub: `ทุน ${sum.toLocaleString("en-US")}${diseases ? ` · ${diseases} โรค` : ""}`, kind: "ci123", sum, diseases, stairs, more });
    } else if (r.code === "DCI") {
      out.push({ ...head, title: "โรคร้ายแรง DCI", sub: `ทุน ${sum.toLocaleString("en-US")}${cover}`, kind: "dci", sum, diseases: diseasesIn(row?.what ?? ""), ...(row?.coverToAge !== undefined ? { coverToAge: row.coverToAge } : {}) });
    } else if (r.code === "AP") {
      out.push({ ...head, title: "อุบัติเหตุ AP", sub: `ทุน ${sum.toLocaleString("en-US")}${cover}`, kind: "ap", sum, ...(row?.coverToAge !== undefined ? { coverToAge: row.coverToAge } : {}) });
    } else if (r.code === "ECARE") {
      out.push({ ...head, title: "อุบัติเหตุ ECARE", sub: `ทุน ${sum.toLocaleString("en-US")}${cover}`, kind: "ecare", sum, care: Math.round(sum * 0.05), ...(row?.coverToAge !== undefined ? { coverToAge: row.coverToAge } : {}) });
    }
    i++;
  }
  return out.slice(0, RIDER_KEYS.length);
}

/** the life cover as the rider scenes state it: the first of the cover rows, or 12 พีแอล's sum (its cover rows are its cash backs) */
export const lifeRow = (f: Pick<QuoteVideoFacts, "cover" | "twelvepl">): CoverRow | undefined =>
  (f.twelvepl ? { label: "", amount: f.twelvepl.sum.toLocaleString("en-US"), mark: true } : f.cover[0]);

/**
 * "เกิดเรื่องนี้ ได้เท่าไร" (owner, 2026-11-21, ก): what each event pays, the contracts that pay it added up.
 * Where a stage might be paid less after an earlier claim (CI 123's major stage), it says สูงสุด.
 */
export function payoutRows(f: Pick<QuoteVideoFacts, "cover" | "riders" | "twelvepl">): PayoutRow[] {
  const sc = f.riders?.scenes ?? [];
  const ci = sc.find((x) => x.kind === "ci123");
  const dci = sc.find((x) => x.kind === "dci");
  const med = sc.find((x) => x.kind === "medical");
  const ap = sc.find((x) => x.kind === "ap");
  const wp = sc.find((x) => x.kind === "waiver");
  const rows: PayoutRow[] = [];
  if (ci?.kind === "ci123") {
    const early = ci.stairs.find((x) => x.label === CI_PART["early to intermediate ci"]);
    if (early) rows.push({ tone: "early", event: "ป่วยโรคร้ายแรง ระยะเริ่มต้น", from: "CI 123", amount: early.amount.toLocaleString("en-US") });
  }
  if (dci?.kind === "dci" || ci?.kind === "ci123") {
    const from = [
      ...(dci?.kind === "dci" ? [`DCI ${sumShort(dci.sum)}`] : []),
      ...(ci?.kind === "ci123" ? [`CI 123 สูงสุด ${sumShort(ci.sum)}`] : []),
    ];
    const total = (dci?.kind === "dci" ? dci.sum : 0) + (ci?.kind === "ci123" ? ci.sum : 0);
    rows.push({ tone: "major", event: ci ? "ป่วยโรคร้ายแรง ระยะรุนแรง" : "ป่วยโรคร้ายแรง", from: from.join(" + "), amount: total.toLocaleString("en-US") });
  }
  if (med?.kind === "medical") rows.push({ tone: "hospital", event: "นอนโรงพยาบาล", from: MEDICAL_SAID, amount: `${med.perDay.toLocaleString("en-US")}/วัน` });
  const life = lifeRow(f);
  if (ap?.kind === "ap" && life) {
    const lifeBaht = digits(life.amount);
    const before = !f.twelvepl && f.cover.length > 1 ? life.label.match(/ก่อนอายุ\s*(\d+)/)?.[1] : undefined;
    const total = lifeBaht + (dci?.kind === "dci" ? dci.sum : 0) + ap.sum;
    const from = [`ชีวิต ${sumShort(lifeBaht)}`, ...(dci?.kind === "dci" ? [`DCI ${sumShort(dci.sum)}`] : []), `AP ${sumShort(ap.sum)}`];
    rows.push({ tone: "accident", event: `อุบัติเหตุถึงชีวิต${before ? ` ก่อนอายุ ${before}` : ""}`, from: from.join(" + "), amount: total.toLocaleString("en-US") });
  }
  if (wp?.kind === "waiver") rows.push({ tone: "waiver", event: `ทุพพลภาพสิ้นเชิงถาวร${wp.plus ? " หรือโรคร้ายแรง" : ""}`, from: wp.sub, amount: "หยุดจ่ายเบี้ย" });
  return rows;
}

const PER_MODE: Record<NonNullable<PriceRow["per"]>, PayMode> = { month: "monthly", half: "semi", year: "annual" };
const LABEL_MODE: Record<string, PayMode> = { รายเดือน: "monthly", "ราย 6 เดือน": "semi", รายปี: "annual" };
/** the instalment a price row is; undefined for a row that is not one (วิดีโอเทียบ 4 แผน's plans) */
const rowMode = (r: PriceRow): PayMode | undefined => (r.per ? PER_MODE[r.per] : LABEL_MODE[r.label]);
const SPOKEN_MODE: Record<string, PayMode> = { เดือนละ: "monthly", งวดละ: "semi", ปีละ: "annual", ...LABEL_MODE };

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14): a clip made by an agent who hid an instalment never shows or says it.
 * The price rows lose it (the yearly row is then the main one), and a spoken price in it becomes the
 * yearly one. What each product says beyond that is its own builder's (iHealthy, มรดก, Protection Life).
 */
export function hidePay(f: QuoteVideoFacts, hide: readonly PayMode[]): QuoteVideoFacts {
  if (!hide.length) return f;
  const kept = f.prices.filter((r) => { const m = rowMode(r); return !m || shows(hide, m); });
  const prices = !kept.length || kept.some((r) => r.main) ? kept : kept.map((r) => ({ ...r, main: rowMode(r) === "annual" }));
  const yearly = prices.find((r) => rowMode(r) === "annual");
  const spokenMode = SPOKEN_MODE[f.spokenPrice.per];
  const spokenPrice = spokenMode && !shows(hide, spokenMode) && yearly ? { per: "ปีละ", amount: yearly.amount } : f.spokenPrice;
  const noMonthly = !shows(hide, "monthly");
  // each rider's price is its share of the instalment the voice said: another one leaves them unsaid
  const riders = f.riders && spokenPrice !== f.spokenPrice
    ? { ...f.riders, split: undefined, scenes: f.riders.scenes.map((r) => { const { price, ...rest } = r; void price; return rest as RiderScene; }) }
    : f.riders;
  return {
    ...f, prices, spokenPrice, hide: [...hide], ...(riders ? { riders } : {}),
    // บำนาญ 95's highlighted line is its monthly instalment: the yearly one instead
    ...(f.product === "PENSION" && noMonthly && yearly ? { priceMark: `ปีละ ${yearly.amount} บาท` } : {}),
    ...(f.legacy && noMonthly ? { legacy: { ...f.legacy, monthly: undefined } } : {}),
    ...(f.plb ? { plb: { ...f.plb, ...(noMonthly ? { monthly: undefined } : {}), ...(!shows(hide, "semi") ? { semi: undefined } : {}) } } : {}),
  };
}

/** The facts for an arrangement; undefined for anything the clip cannot state (no price, not sold). */
export function quoteVideoFacts(v: VideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const hide = hideOf(v);
  const built = v.product === "IHEALTHY" ? iHealthyFacts(v, today, hide)
    : v.product === "PENSION" ? pensionVideoFacts(v)
    : v.product === "LEGACY" ? legacyVideoFacts(v, today)
    : v.product === "PLB" ? plbVideoFacts(v, today)
    : v.product === "GSAVING" ? gsavingVideoFacts(v)
    : v.product === "TWELVEPL" ? withPayout(twelvePlVideoFacts(v, today, riderFacts))
    : v.product === "EASYPROTECT" ? easyProtectVideoFacts(v, today)
    : v.product === "LIFETREASURE" ? lifeTreasureVideoFacts(v, today)
    : v.product === "CI123" ? ci123VideoFacts(v, today)
    : v.product === "CANCER" ? cancerVideoFacts(v, today)
    : v.product === "PA" ? paVideoFacts(v)
    : v.product === "GROUP" ? groupVideoFacts(v)
    : planFacts(v, today);
  const paid = built && hide.length ? hidePay(built, hide) : built;
  // แสดงคำอธิบายในตาราง: a table drawn without its pen notes (table-pen.tsx, pension-table.tsx, gsaving-table.tsx)
  const f = paid && v.pen === false ? { ...paid, pen: false as const } : paid;
  if (!f || !v.budget) return f;
  // a clip begun from a budget says what the customer saves, in the instalment they named
  const per = v.budget.per;
  const row = f.prices.find((p) => (p.per ? p.per === per : p.label === (per === "month" ? "รายเดือน" : "รายปี")));
  return row ? { ...f, budget: { per: v.budget.per, amount: row.amount } } : f;
}

/** a plan's facts with what each event pays worked out from its riders */
function withPayout(f: QuoteVideoFacts | undefined): QuoteVideoFacts | undefined {
  if (f?.riders) f.riders.payout = payoutRows(f);
  return f;
}

function planFacts(v: Exclude<Extract<VideoInput, { variant: string }>, { product: "PLB" | "LIFETREASURE" }>, today: Date): QuoteVideoFacts | undefined {
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
  const riders = lifeProtect && card.summary.split
    ? riderFacts(input.riders, table.rows, card.summary.split, spoken.label, { age: v.age, payYears: paying.length, today })
    : undefined;
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
    // what the headline instalment is made of, as the card's box splits it (owner, 2026-10-17, 1ก);
    // the amount keeps its บาท when a long contract name wraps
    priceNotes: riders && card.summary.split
      ? [card.summary.split.title, ...card.summary.split.rows.map((r) => `${riderShort(r.label)}  ${r.amount}\u00a0บาท`)]
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
  if (facts.riders) facts.riders.payout = payoutRows(facts);
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

function iHealthyFacts(v: Extract<VideoInput, { product: "IHEALTHY" }>, today: Date, hide: readonly PayMode[] = []): QuoteVideoFacts | undefined {
  // an instalment the agent hid is never the one the four plans are priced in: yearly instead
  if (v.allPlans) return allPlansVideoFacts({ ...v, allPlans: shows(hide, v.allPlans) ? v.allPlans : "annual" }, today);
  const query = setupQuery(v);
  // the clip reads the card's table as it was before the rider rows (2026-11-28): one daily-cash row
  const plain = (c: ReturnType<typeof iHealthyCard>) => ({ ...c, rows: plainRows(c) });
  const card = plain(iHealthyCard(query, today));
  // another language: the same card read in it (ihealthy-card.ts `l=`), row for row and column
  // for column; the Thai card is still the one looked into, its labels being the keys
  const lang: VideoLang = v.lang ?? "th";
  const shown = lang === "th" ? card : plain(iHealthyCard(new URLSearchParams([...query, ["l", lang]]), today));
  const w = WORDS[lang];
  const vw = VIDEO_WORDS[lang];
  const at = card.columns.findIndex((c) => c.selected);
  const col = card.columns[at];
  if (!col || !col.sold || !card.premium) return undefined;
  // the card settles an age the plan cannot be sold at onto one it can: a clip says what was asked or nothing
  if (!card.insuredWho.endsWith(` ${v.age} ปี`)) return undefined;
  // every figure the clip shows, grouped as its language writes it: the Thai card's 8,000 is 8.000 in German
  const fig = (text: string) => (lang === "de" ? text.replace(/\d{1,3}(?:,\d{3})+/g, (m) => figure(Number(m.replace(/,/g, "")), lang)) : text);
  const price = (label: string, i: number) => fig(card.premiumRows.find((r) => r.label === label)?.cells[i]?.text ?? "");
  const monthly = price("รายเดือน", at);
  // the agent hid the monthly instalment (ตั้งค่าส่วนตัว): the first year's yearly price is the one said and shown
  const yearOnly = !shows(hide, "monthly");
  const yearly = price("รายปี", at);
  const PER: Record<string, PriceRow["per"]> = { รายเดือน: "month", รายปี: "year", "ราย 6 เดือน": "half" };
  const prices = card.premiumRows
    .map((r, k) => ({ label: shown.premiumRows[k]?.label ?? r.label, amount: fig(r.cells[at]?.text ?? ""), main: r.label === (yearOnly ? "รายปี" : "รายเดือน"), per: PER[r.label] }))
    .filter((r) => digits(r.amount) > 0);
  if (!monthly || prices.length === 0 || (yearOnly && !yearly)) return undefined;
  /** a benefit row in Thai, for the voice, and as it is shown */
  const kept = card.rows
    .map((r, k) => ({ r, k }))
    .filter(({ r }) => r.label !== "วงเงินค่ารักษาต่อปี");
  const amountOf = (r: (typeof card.rows)[number]) => (r.span ? r.span.split(" · ")[0] : r.cells[at]?.text ?? "");
  const both = kept
    .map(({ r, k }) => ({
      thai: { label: r.label, amount: amountOf(r) },
      // the card's "as charged" runs long in Russian and Burmese: the clip's row says it shorter
      shown: { label: shown.rows[k]?.label ?? r.label, amount: fig(amountOf(r) === "ตามที่จ่ายจริง" ? vw.asCharged : shown.rows[k] ? amountOf(shown.rows[k]) : amountOf(r)) },
    }))
    .filter((b) => b.thai.amount && b.thai.amount !== "-");
  const benefits = both.map((b) => b.thai);
  // the base plan and the health plan are the card's first two lines; the rest are what the page attached
  const daily = benefits.some((b) => b.label === "ค่าชดเชยรายวัน");
  const riders = Math.max(0, card.lines.length - 2 - (daily ? 1 : 0));
  const includes = ["ประกันชีวิต", ...(daily ? ["ค่าชดเชยรายวัน"] : []), ...(riders ? ["สัญญาเพิ่มเติม"] : [])];
  // the cover scene's groups: the daily cash moves from the health plan's rows to the riders' (owner, 2026-10-20, ก)
  const isDaily = (b: (typeof both)[number]) => b.thai.label === "ค่าชดเชยรายวัน";
  const care = both.filter((b) => !isDaily(b));
  const addOns = [
    ...both.filter(isDaily).map((b) => ({ label: b.shown.label, amount: b.shown.amount, mark: true })),
    ...shown.riderParts.map((r) => ({ label: r.name, amount: fig(r.sum ?? ""), mark: true })),
  ];
  const wanted = new Set([v.plan, ...v.compare]);
  const codes = iHealthyPlanCodes();
  const perDay = new RegExp(`\\s*${w.perDay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`);
  const compare = card.columns
    .map((c, i) => ({ c, i, code: codes[i] }))
    .filter(({ c, code }) => c.sold && code && wanted.has(code))
    .slice(0, 3)
    .map(({ c, i }) => ({
      name: c.name, ceiling: shown.columns[i]?.ceiling ?? c.ceiling, main: i === at,
      room: fig((cellOf(shown.rows, shown.rows[cardRowAt(card.rows, "ค่าห้องและค่าอาหาร")]?.label ?? "", i) ?? "-").replace(perDay, "")),
      opd: fig(cellOf(shown.rows, shown.rows[cardRowAt(card.rows, "ผู้ป่วยนอก OPD")]?.label ?? "", i) ?? "-"),
      monthly: yearOnly ? "" : price("รายเดือน", i),
      ...(yearOnly ? { yearly: price("รายปี", i) } : {}),
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
    lead: { label: w.annualLimit, amount: figure(ceiling, lang), baht: ceiling },
    leadMark: yearOnly ? vw.leadMarkYear(yearly) : vw.leadMark(monthly),
    ...(yearOnly ? { priceBig: { label: vw.firstYearYearly, amount: yearly, unit: vw.baht } } : {}),
    priceTitle: vw.priceTitle,
    prices,
    spokenPrice: yearOnly ? { per: "ปีละ", amount: yearly } : { per: "เดือนละ", amount: monthly },
    pills: [],
    priceNotes: [shown.lines.map((l) => l.label).join(" · "), w.firstYearOnly],
    coverTitle: vw.coverTitle(col.name),
    cover: both.map((b) => ({ label: b.shown.label, amount: b.shown.amount, mark: true })),
    coverGroups: [
      // the plan's name kept on one line: a long label (Russian) breaks after the "·", not before "2"
      { title: w.base, rows: [{ label: vw.lifeRow(shown.base.name.replace(/ /g, "\u00a0")), amount: figure(shown.base.sum, lang), mark: true, main: true }] },
      { title: vw.careOf(shown.planLine), rows: care.map((b) => ({ label: b.shown.label, amount: b.shown.amount, mark: true })) },
      ...(addOns.length ? [{ title: vw.ridersTitle, rows: addOns }] : []),
    ],
    coverStyle: "rows",
    coverToAge: 98,
    benefits,
    includes,
    lifeSum: card.base.sum,
    ...(shown.riderNames.length ? { riderNames: shown.riderNames } : {}),
    ...(compare.length >= 2 ? { compare, ...(yearOnly ? { comparePer: "year" as const } : {}) } : {}),
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
  (f.includes ?? ["ประกันชีวิต"]).flatMap((x) =>
    full && x === "สัญญาเพิ่มเติม" && f.riderNames?.length ? f.riderNames
    // iHealthy says the base plan's sum with it (owner, 2026-10-20, ก): "ประกันชีวิตทุน 150,000 บาท"
    : x === "ประกันชีวิต" && f.lifeSum ? [`ประกันชีวิตทุน ${f.lifeSum.toLocaleString("en-US")} บาท`]
    : [x]);

/** "ประกันชีวิต", "ประกันชีวิตและค่าชดเชยรายวัน" (or กับ), "ประกันชีวิต ค่าชดเชยรายวัน และสัญญาเพิ่มเติม" */
export function includesSaid(f: QuoteVideoFacts, and = "และ", full = false): string {
  const w = includesList(f, full);
  if (w.length === 1) return w[0];
  // "ประกันชีวิตทุน 150,000 บาท กับค่าชดเชยรายวัน": a space after a figure, as the longer list has
  if (w.length === 2) return `${w[0]}${w[0].endsWith("บาท") ? " " : ""}${and}${w[1]}`;
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
  // วิดีโอเทียบ 4 แผน: its own six lines, at one length, with no brief (the form offers neither)
  if (f.allPlans) return allPlansScript(f, f.allPlans, customer, narrator);
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
  if (f.product === "GROUP" && f.group) return grLeadFact(f.group);
  if (f.product === "PA" && f.pa) return `แผนนี้ ${paLeadLine(f.pa, spokenWithBaht).replace(/^อุบัติเหตุไม่เลือกวัน /, "")}`;
  const who = name || !f.sex ? `อายุ ${f.age}` : `${SEX_WHO[f.sex]}อายุ ${f.age}`;
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
  if (f.product === "TWELVEPL" && f.twelvepl) {
    return `แผนออมนี้ ${name ? "" : `${who} ปี `}${budgetLead(f, "ถ้าออม")}${tpLeadLine(f.twelvepl)}`;
  }
  if (f.product === "EASYPROTECT" && f.easyprotect) {
    return `แผนนี้ ${name ? "" : `${who} `}${epLead(f, f.easyprotect)}`;
  }
  if (f.product === "LIFETREASURE" && f.lifetreasure) {
    return `${name ? "" : `${who} `}เตรียมเงินก้อนไว้ให้ครอบครัว แบบรู้จำนวนแน่นอน ${budgetLead(f, "ถ้าออม")}${ltLeadLine(f.lifetreasure, spokenWithBaht)}`;
  }
  if (f.product === "CI123" && f.ci123) {
    return `แผนนี้ ${name ? "" : `${who} ปี `}${budgetLead(f, "ถ้าออม")}${ciLeadLine(f.ci123, spokenWithBaht).replace(/ค่ะ$/, "")} จ่ายตั้งแต่ระยะก่อนเริ่มต้นค่ะ`;
  }
  if (f.product === "CANCER" && f.cancer) {
    return `แผนนี้ ${name ? "" : `${who} ปี `}${budgetLead(f, "ถ้าออม")}${caLeadLine(f.cancer, spokenWithBaht)}`;
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
      { key: "price", voice: `ออม${f.spokenPrice.per} ${f.spokenPrice.amount} บาท เพียง ${f.payYears} ปี แถมลดหย่อนภาษีได้ค่ะ` },
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
  if (f.product === "TWELVEPL" && f.twelvepl) {
    const g = f.twelvepl;
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}${tpLeadLine(g)}` },
      { key: "price", voice: `ออมแค่วันละ ${f.perDayAmount} บาท${f.riders ? ` รวม${f.riders.said}` : ""}${f.riders && /[A-Za-z0-9]$/.test(f.riders.said) ? " " : ""}${f.riders ? " สัญญาหลัก" : " "}ออมเพียง ${g.payYears} ปี${g.tax !== undefined && !f.riders ? " แถมลดหย่อนภาษีได้" : ""}ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "EASYPROTECT" && f.easyprotect) {
    const g = f.easyprotect;
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}${f.budget ? "" : "ถ้าเป็นอะไรไป "}ครอบครัวได้เงินก้อน${g.atLeast ? "" : " "}${epFamily(g, spokenWithBaht)}ค่ะ` },
      { key: "price", voice: `ออมแค่วันละ ${f.perDayAmount} บาท ออมเพียง ${g.payYears} ปี คุ้มครองถึงอายุ ${g.coverToAge} ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "LIFETREASURE" && f.lifetreasure) {
    const g = f.lifetreasure;
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}${ltLeadLine(g, spokenWithBaht)}` },
      { key: "price", voice: `ออมปีละ ${f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual} บาท จ่าย ${g.payYears} ปีแล้วจบ ส่งต่อให้ครอบครัว ${ltFamily(g, spokenWithBaht)}ค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "GROUP" && f.group) {
    const g = f.group;
    const m = (n: number) => n.toLocaleString("en-US");
    return [
      { key: "lead", voice: `${g.kind === "health" ? "สวัสดิการพนักงาน ประกันสุขภาพกลุ่ม" : "ดูแลพนักงานจากอุบัติเหตุ ประกันอุบัติเหตุกลุ่ม"} สำหรับทีม ${m(g.total)} คนค่ะ` },
      { key: "price", voice: `ตกคนละประมาณเดือนละ ${m(g.perMonth)} บาท ทั้งบริษัท ปีละ ${m(g.grandTotal)} บาทค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "PA" && f.pa) {
    const g = f.pa;
    return [
      { key: "lead", voice: `อุบัติเหตุไม่เลือกวัน คุ้มครองอุบัติเหตุ ทุน ${spokenWithBaht(g.death)} ต่ออายุทุกปีค่ะ` },
      { key: "price", voice: `ตกวันละ ${g.perDay} บาท ราคาเท่ากันทุกอายุค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "CANCER" && f.cancer) {
    const g = f.cancer;
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}ตรวจพบมะเร็ง รับเงินก้อนตามขั้น สูงสุด ${spokenWithBaht(g.cpr)} พร้อมชดเชยนอนโรงพยาบาลวันละ ${caMoney(g.hic)} บาทค่ะ` },
      { key: "price", voice: `ปีแรกออมแค่วันละ ${g.perDay} บาท รวมแบบหลักไว้แล้วค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "CI123" && f.ci123) {
    const g = f.ci123;
    return [
      { key: "lead", voice: `${budgetLead(f, "ถ้าออม")}ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะ สูงสุด ${spokenWithBaht(g.sum)}ค่ะ` },
      { key: "price", voice: `ปีแรกออมแค่วันละ ${g.perDay} บาท คุ้มครองโรคร้ายแรง ${g.diseaseCount} โรคค่ะ` },
      { key: "contact", voice: ask },
    ];
  }
  if (f.product === "IHEALTHY") {
    return [
      { key: "lead", voice: `${budgetLead(f, "ด้วยงบ")}เหมาจ่ายค่ารักษาสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ต่อปีค่ะ` },
      { key: "price", voice: `ปีแรก${f.spokenPrice.per} ${f.spokenPrice.amount} บาท รวม${includesSaid(f)}ค่ะ` },
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
  // a plan priced by plan alone names no one (pricedByPlan): its lines never say `who`
  const who = name || !f.sex ? `อายุ ${f.age}` : `${SEX_WHO[f.sex]}อายุ ${f.age}`;
  const closing = name
    ? `คุณ${name}สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ`
    : "สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ";

  if (f.product === "PENSION" && f.pension) return pensionScript(f, f.pension, hello, who, closing, Boolean(name));
  if (f.product === "LEGACY" && f.legacy) return legacyScript(f, f.legacy, hello, who, closing);
  if (f.product === "PLB" && f.plb) return plbScript(f, f.plb, hello, who, closing);
  if (f.product === "GSAVING" && f.gsaving) return gsScript(f, f.gsaving, hello, who, closing);
  if (f.product === "TWELVEPL" && f.twelvepl) return tpScript(f, f.twelvepl, hello, who, closing);
  if (f.product === "EASYPROTECT" && f.easyprotect) return epScript(f, f.easyprotect, hello, who, closing);
  if (f.product === "LIFETREASURE" && f.lifetreasure) return ltScript(f, f.lifetreasure, hello, who, closing);
  if (f.product === "CI123" && f.ci123) return ciScript(f, f.ci123, hello, who, closing);
  if (f.product === "CANCER" && f.cancer) return caScript(f, f.cancer, hello, who, closing);
  if (f.product === "PA" && f.pa) return paScript(f, f.pa, hello, closing);
  if (f.product === "GROUP" && f.group) return grScript(f.group, hello, name);

  if (f.product === "IHEALTHY") {
    const others = (f.compare ?? []).filter((p) => !p.main);
    return [
      { key: "lead", voice: `${hello} ขอเล่าแผนประกันสุขภาพนี้ให้ฟังสั้นๆ นะคะ ${name ? "" : `${who} `}${budgetLead(f, "ด้วยงบ")}แผน ${f.planName} เหมาจ่ายค่ารักษาสูงสุดถึง ${spokenWithBaht(f.lead.baht)}ต่อปีค่ะ`.replace(/\s+/g, " ") },
      { key: "price", voice: `ปีแรกค่าใช้จ่าย${f.spokenPrice.per} ${f.spokenPrice.amount} บาท รวม${includesSaid(f, "กับ", true)}ไว้แล้วค่ะ` },
      { key: "cover", voice: healthCoverLine(f) },
      ...(others.length
        ? [{ key: "compare" as const, voice: `ถ้าอยากเทียบ ${others.map((p) => `แผน ${p.name} วงเงิน ${p.ceiling} ${f.comparePer === "year" ? `ปีละ ${p.yearly ?? ""}` : `เดือนละ ${p.monthly}`} บาท`).join(" และ")} ต่ออายุได้ถึงอายุ ${f.coverToAge} เลยค่ะ` }]
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
    { key: "cover", voice: f.riders?.scenes.length ? cover : `${cover}${ridersCoverLine(f)}` },
    ...riderLines(f),
    { key: "value", voice: value },
    { key: "contact", voice: closing },
  ];
}

const ORDINAL = ["ตัวแรก", "ตัวที่สอง", "ตัวที่สาม", "ตัวที่สี่", "ตัวที่ห้า"];

/**
 * Life Protect's riders, a scene each (owner, 2026-11-21, ก ก ก on https://claude.ai/artifact/HvVdgdGq4oajv1Hjd1ZBv2):
 * the package first where there are two or more, then each rider with its own price and what it pays,
 * then what each event pays where two or more rows say something.
 */
function riderLines(f: QuoteVideoFacts): SceneScript[] {
  const sc = f.riders?.scenes ?? [];
  if (!sc.length) return [];
  const n = sc.length;
  const lines: SceneScript[] = [];
  if (n > 1) lines.push({ key: "riders", voice: `นอกจากประกันชีวิตแล้ว แผนนี้ยังมีสัญญาเพิ่มเติมอีก ${n} ตัว มาดูทีละตัวกันนะคะ` });
  sc.forEach((r, i) => {
    const ord = n === 1 ? "" : i === n - 1 ? "ตัวสุดท้าย " : `${ORDINAL[i]} `;
    const price = r.price ? ` ${f.spokenPrice.per} ${r.price} บาท` : "";
    const head = `${ord}${r.said}${price}`;
    const voice = r.kind === "waiver" ? `${head} ${r.what}ค่ะ`
      : r.kind === "medical" ? `${head} นอนโรงพยาบาลรับเงินวันละ ${r.perDay.toLocaleString("en-US")} บาท อย่างนอน ${r.days} วันก็รับ ${(r.perDay * r.days).toLocaleString("en-US")} บาทค่ะ`
      : r.kind === "dci" ? `${head} ถ้าเป็นโรคร้ายแรง${r.diseases ? ` 1 ใน ${r.diseases} โรค` : ""} หรือเป็นอะไรไป รับเงินก้อน ${spokenWithBaht(r.sum)}ค่ะ`
      : r.kind === "ci123" ? `${head} ไม่ต้องรอให้เป็นหนัก ${ciEarlySaid(r)}ระยะรุนแรงรับสูงสุด ${spokenWithBaht(r.sum)}${r.diseases ? ` คุ้มครอง ${r.diseases} โรค` : ""} เคลมได้หลายครั้งค่ะ`
      : r.kind === "ap" ? `${head} ถ้าเป็นอะไรไปหรือสูญเสียอวัยวะจากอุบัติเหตุ รับสูงสุด ${spokenWithBaht(r.sum)}${r.coverToAge ? ` คุ้มครองถึงอายุ ${r.coverToAge} ` : ""}ค่ะ`
      : `${head} ${r.what}ค่ะ`;
    lines.push({ key: RIDER_KEYS[i], voice });
  });
  const rows = f.riders?.payout ?? [];
  if (rows.length > 1) lines.push({ key: "payout", voice: payoutSaid(rows) });
  return lines;
}

/** "เจอระยะเริ่มต้นก็รับ 250,000 บาท " */
function ciEarlySaid(r: Extract<RiderScene, { kind: "ci123" }>): string {
  const early = r.stairs.find((x) => x.label === CI_PART["early to intermediate ci"]);
  return early ? `เจอระยะเริ่มต้นก็รับ ${early.amount.toLocaleString("en-US")} บาท ` : "";
}

/** the payout said: the major illness, the hospital, the accident; the early stage and the waiver where fewer are said */
function payoutSaid(rows: PayoutRow[]): string {
  const by = (t: PayoutRow["tone"]) => rows.find((r) => r.tone === t);
  const said: string[] = [];
  const major = by("major");
  if (major) said.push(`${major.event.replace(" ระยะ", "ระยะ")} รับ${major.from.includes("สูงสุด") ? "สูงสุด" : ""} ${spokenWithBaht(digits(major.amount))}`);
  const hospital = by("hospital");
  if (hospital) said.push(`นอนโรงพยาบาลรับวันละ ${hospital.amount.replace("/วัน", "")} บาท`);
  const accident = by("accident");
  if (accident) said.push(`ถ้าเป็นอะไรไปจากอุบัติเหตุ${accident.event.replace("อุบัติเหตุถึงชีวิต", "")} ครอบครัวได้สูงสุด ${spokenWithBaht(digits(accident.amount))}`);
  const early = by("early");
  if (said.length < 2 && early) said.unshift(`ป่วยโรคร้ายแรงระยะเริ่มต้น รับ ${spokenWithBaht(digits(early.amount))}`);
  const waiver = by("waiver");
  if (said.length < 2 && waiver) said.push(`${waiver.event} ไม่ต้องจ่ายเบี้ยต่อ`);
  return `สรุปง่ายๆ นะคะ ${said.join(" ")}ค่ะ`;
}

/**
 * Life Protect's price, said; with riders (owner, 2026-10-17, mockup https://claude.ai/artifact/ESb8JXLfKhv3VVn95SXzEf)
 * the instalment says what it includes, and "เท่าเดิมตลอด" only where the whole of it is level.
 */
function lifeProtectPriceLine(f: QuoteVideoFacts): string {
  const r = f.riders;
  // the instalment contract by contract where it can be said (owner, 2026-10-17, ก); else what it includes
  // with a scene a rider (owner, 2026-11-21) each says its own price there: here only what the total holds
  const parts = r?.scenes.length
    ? ` รวมสัญญาหลักกับ${r.scenes.length > 1 ? `สัญญาเพิ่มเติมอีก ${r.scenes.length} ตัว` : r.scenes[0].said}${/[A-Za-z0-9]$/.test(r.scenes[0].said) && r.scenes.length === 1 ? " " : ""}ไว้แล้ว`
    : r?.split
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
    { key: "price", voice: `ออมปีละ ${annual} บาท${f.spokenPrice.per === "ปีละ" ? "" : ` หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท`} ออมเพียง ${f.payYears} ปีก็ครบ ยอดออมเท่าเดิมตลอด แล้วยังนำไปลดหย่อนภาษีได้ด้วยค่ะ` },
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

/** "ทำทุน 1 ล้าน ออมเพียง 6 ปี ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน 1 ล้านบาทค่ะ" */
const epLead = (f: QuoteVideoFacts, g: EasyProtectVideoFacts) =>
  `${budgetLead(f, "ถ้าออม")}ทำทุน ${spokenBaht(g.sum)} ออมเพียง ${g.payYears} ปี ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน${g.atLeast ? "" : " "}${epFamily(g, spokenWithBaht)}ค่ะ`;

/**
 * อีซี่ โพรเทค 6's six lines (owner, 2026-11-26, ก ก, mockup https://claude.ai/artifact/YCrrpCe5o2uQ14xAoQmZHn): the sum, the
 * price, the six years and nothing after, the premiums beside what the family receives (only where that is more),
 * the cash value.
 */
function epScript(f: QuoteVideoFacts, g: EasyProtectVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who} ${epLead(f, g)}` },
    { key: "price", voice: lifeProtectPriceLine(f) },
    { key: "cover", voice: epSixLine(f, g, spokenWithBaht) },
    ...(g.times ? [{ key: "total" as const, voice: epTotalLine(g, spokenWithBaht) }] : []),
    { key: "value", voice: epValueLine(f, g) },
    { key: "contact", voice: closing },
  ];
}

/**
 * ไลฟ์เทรเชอร์'s six lines (owner, 2026-11-26, ก, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p): the sum set
 * for the family, the yearly saving, the three terms, the premiums beside what the family receives (only from 1.1
 * times up), the cash value along the way.
 */
function ltScript(f: QuoteVideoFacts, g: LifeTreasureVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} ถ้าอยากเตรียมเงินก้อนไว้ให้ครอบครัว แบบรู้จำนวนแน่นอนตั้งแต่วันนี้ ${budgetLead(f, "ถ้าออม")}${ltLeadLine(g, spokenWithBaht)}` },
    { key: "price", voice: ltPriceLine(f, g, who) },
    ...(g.terms.length > 1 ? [{ key: "terms" as const, voice: ltTermsLine(g) }] : []),
    ...(g.times ? [{ key: "total" as const, voice: ltTotalLine(g, spokenWithBaht) }] : []),
    { key: "value", voice: ltValueLine(f, g, spokenWithBaht) },
    { key: "contact", voice: `จะแบ่งให้ใครเท่าไรก็ระบุได้ค่ะ ${closing}` },
  ];
}

/**
 * CI 123's six lines (owner, 2026-11-26, ข, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p): the lump sum on a
 * critical illness, the first year's saving, the stages that climb to the whole sum, what else it pays (the
 * children's illnesses only for an insured of 18 or under), the base contract's life cover.
 */
function ciScript(f: QuoteVideoFacts, g: Ci123VideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} ถ้าวันหนึ่งตรวจพบโรคร้ายแรง เงินก้อนช่วยให้รักษาได้เต็มที่ ${budgetLead(f, "ถ้าออม")}${ciLeadLine(g, spokenWithBaht)}` },
    { key: "price", voice: ciPriceLine(f, g, who) },
    { key: "critical", voice: ciStairsLine(g, spokenWithBaht) },
    ...(g.more.length ? [{ key: "cover" as const, voice: ciMoreLine(g, spokenWithBaht) }] : []),
    { key: "family", voice: ciBaseLine(g, f.age, spokenWithBaht) },
    { key: "contact", voice: `วางแผนไว้ก่อน ไม่ต้องห่วงค่ารักษาค่ะ ${closing}` },
  ];
}

/**
 * ประกันมะเร็ง's six lines (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "ca"): the lump
 * sum a cancer pays and the daily sum, the first year's saving, the four stages, the daily sum and how long it
 * pays, what every contract pays together.
 */
function caScript(f: QuoteVideoFacts, g: CancerVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} มะเร็งรักษานาน ค่าใช้จ่ายก็สูง ${budgetLead(f, "ถ้าออม")}${caLeadLine(g, spokenWithBaht)}` },
    { key: "price", voice: caPriceLine(f, g, who) },
    { key: "critical", voice: caStairsLine(g, spokenWithBaht) },
    { key: "cover", voice: caDailyLine(g) },
    { key: "family", voice: caTotalLine(g, spokenWithBaht) },
    { key: "contact", voice: `เตรียมไว้ก่อน ใจสบายกว่าค่ะ ${closing}` },
  ];
}

/**
 * PA's lines (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "pa"): the accident cover and
 * that it renews, the year's price the same at every age, what it covers, the injury cover where the plan has it
 * (Classic: the medical sum only; Max: none, so five scenes), the sum growing on renewal. No one is named: the price
 * is the plan's and the class's.
 */
function paScript(f: QuoteVideoFacts, g: PaVideoFacts, hello: string, closing: string): SceneScript[] {
  const injury = paInjuryLine(g);
  return [
    { key: "lead", voice: `${hello} ${paLeadLine(g, spokenWithBaht)}` },
    { key: "price", voice: paPriceLine(f, g) },
    { key: "cover", voice: paCoverLine(g, spokenWithBaht) },
    ...(injury ? [{ key: "family" as const, voice: injury }] : []),
    { key: "critical", voice: paRenewLine(g, spokenWithBaht) },
    { key: "contact", voice: `เดินทางทุกวัน มีไว้อุ่นใจค่ะ ${closing}` },
  ];
}

/**
 * ประกันกลุ่ม's lines (owner, 2026-11-26, ข, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "gr"), told to the
 * employer: the team and how few it starts from, a head's price a year and about a month and the company's, then the
 * first group's cover — health: the hospital stay, OPD where it was taken, the life cover (five or six scenes); PA: what
 * an accident pays, the medical expense where ME was taken (four or five). The quotation is asked for at the end.
 */
function grScript(g: GroupVideoFacts, hello: string, name: string): SceneScript[] {
  const own: SceneScript[] = g.kind === "health"
    ? [
      { key: "cover", voice: grStayLine(g) },
      ...(grOpdLine(g) ? [{ key: "family" as const, voice: grOpdLine(g)! }] : []),
      { key: "critical", voice: grLifeLine(g, spokenWithBaht) },
    ]
    : [
      { key: "cover", voice: grPaCoverLine(g, spokenWithBaht) },
      ...(grMeLine(g) ? [{ key: "family" as const, voice: grMeLine(g)! }] : []),
    ];
  return [
    { key: "lead", voice: `${hello} ${grLeadLine(g)}` },
    { key: "price", voice: grPriceLine(g) },
    ...own,
    { key: "contact", voice: grContactLine(name) },
  ];
}

/**
 * 12 พีแอล's six lines (owner, 2026-11-26, ก ก ข, mockup https://claude.ai/artifact/7eC8eVjT4mFAsSaPie4kfm): the
 * guarantee held to 85, the level saving, the cash backs and the maturity, the family's sum, what is paid beside
 * what comes back; then its riders a scene each, as Life Protect's (twelvepl.ts).
 */
function tpScript(f: QuoteVideoFacts, g: TwelvePlVideoFacts, hello: string, who: string, closing: string): SceneScript[] {
  return [
    { key: "lead", voice: `${hello} ขอเล่าแผนออมนี้ให้ฟังสั้นๆ นะคะ ${who} ปี ${budgetLead(f, "ถ้าออม")}${tpLeadLine(g)}` },
    { key: "price", voice: tpPriceLine(f, g) },
    { key: "cover", voice: tpCashLine(g) },
    { key: "family", voice: tpFamilyLine(g) },
    { key: "total", voice: tpTotalLine(g, Boolean(f.riders)) },
    ...riderLines(f),
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
    // Protection Life's chosen term lit, then the total under the rows (ไลฟ์เทรเชอร์'s chosen term, then its multiple)
    case "terms": return { sweeps: 2, spread: true };
    // Global Savings: the picked return lit, then the total at it
    case "index": return { sweeps: 2, spread: true };
    // 12 พีแอล, อีซี่ โพรเทค 6: what the family receives lit, then the years after the last premium; what is paid, then what comes back
    case "family": case "total": return { sweeps: 2, spread: true };
    case "contact": return {};
    // one highlighter a point, a question, a step as the voice reaches it; the comparison counted up
    case "story": return { sweeps: 3, spread: true };
    case "qa": return { sweeps: 2, spread: true };
    case "versus": return { count: true, sweeps: 1 };
    case "steps": return { sweeps: 3, spread: true };
    // Life Protect's riders (owner, 2026-11-21): the package, a rider's picture with its price lit, the payout rows one by one
    case "riders": return { sweeps: 1 };
    case "payout": return { sweeps: f.riders?.payout.length ?? 1, spread: true };
    default: return { sweeps: 1 };
  }
}

/**
 * The words a clip goes up to a Page with (owner, 2026-10-11): from the clip's own figures, never
 * the customer's name — a clip that carries one does not go to a Page at all. The admin edits it.
 */
export function pageCaption(f: QuoteVideoFacts): string {
  const who = f.sex ? `${SEX_WHO[f.sex]}อายุ ${f.age}` : "";
  const ask = "ทักแชทขอใบเสนอของคุณได้เลย";
  if (f.product === "GROUP" && f.group) {
    const g = f.group;
    const m = (n: number) => n.toLocaleString("en-US");
    const several = g.groups > 1;
    return [
      `${g.kindName} สวัสดิการพนักงาน · ทีม ${m(g.total)} คน${several ? ` ${g.groups} กลุ่ม` : ` ลักษณะธุรกิจ ${g.bizNo}`}`,
      `${several ? `กลุ่มแรก ${m(g.count)} คน ` : ""}${groupPlanWord(g.kind, g)}: ตกคนละ ${m(g.perPerson)} บาทต่อปี (ประมาณเดือนละ ${m(g.perMonth)} บาทต่อคน)`,
      `ทั้งบริษัท${several ? ` ${g.groups} กลุ่ม` : ""} ปีละ ${m(g.grandTotal)} บาท`,
      g.health
        ? [`ค่าห้องวันละ ${m(g.health.room)}`, `ICU วันละ ${m(g.health.icu)}`, `ผ่าตัด ${m(g.health.surgery)}`, ...(g.health.opd ? [`OPD ครั้งละ ${m(g.health.opd)} (ปีละ ${g.health.opdVisits} ครั้ง)`] : []), `คุ้มครองชีวิต ${m(g.health.life)} + อุบัติเหตุเพิ่ม ${m(g.health.accident)}`].join(" · ")
        : [`อุบัติเหตุ จากไป หรือทุพพลภาพถาวร ${m(g.pa!.death)}`, `สูญเสียอวัยวะ 2 ข้าง ${m(g.pa!.loss2)}`, `มอเตอร์ไซค์ ${m(g.pa!.motorcycle)}`, ...(g.pa!.me ? [`ค่ารักษาต่ออุบัติเหตุ ${m(g.pa!.me)}`] : [])].join(" · "),
      "",
      "ทักแชทขอใบเสนอให้บริษัทของคุณได้เลย",
    ].join("\n");
  }
  if (f.product === "PA" && f.pa) {
    const g = f.pa;
    return [
      `${f.planLine} คุ้มครองอุบัติเหตุ ทุน ${f.lead.amount} บาท คุ้มครอง 24 ชั่วโมง ทั่วโลก`,
      `อาชีพชั้น ${g.cls} จ่ายปีละ ${f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual.toLocaleString("en-US")} บาท (ตกวันละ ${g.perDay} บาท) ราคาเท่ากันทุกอายุ`,
      [`ถูกฆาตกรรม ลอบทำร้าย ${g.murder.toLocaleString("en-US")}`, `มอเตอร์ไซค์ ${g.motorcycle.toLocaleString("en-US")}`,
        ...(g.medical ? [`ค่ารักษาต่ออุบัติเหตุ ${g.medical.toLocaleString("en-US")}`] : []),
        ...(g.weekly ? [`ชดเชยหยุดงานสัปดาห์ละ ${g.weekly.toLocaleString("en-US")}`] : [])].join(" · "),
      `ต่ออายุต่อเนื่อง ทุนเพิ่มปีละ ${g.stepPercent}% ปีที่ ${g.years.length} ทุน ${paSixth(g).toLocaleString("en-US")} บาท`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "PENSION" && f.pension) {
    const p = f.pension;
    return [
      `บำนาญเดือนละ ${p.monthly} บาท ตั้งแต่อายุ ${p.start} ถึง 95`,
      `${who} ออม${f.spokenPrice.per} ${f.spokenPrice.amount} บาท จ่ายแค่ ${f.payYears} ปี เบี้ยลดหย่อนภาษีได้`,
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
      `${f.planLine} ออม ${g.payYears} ปี รับเงินการันตีรวม ${f.lead.amount} บาท`,
      `${who} ออมปีละ ${gsMoney(g.premium)} บาท (ตกวันละ ${g.perDay} บาท) ลดหย่อนภาษีได้`,
      g.rate > 0
        ? `ถ้าดัชนีโตเฉลี่ยปีละ ${rateLabel(g.rate)} รวมรับประมาณ ${gsMoney(g.total)} บาท (โบนัสดัชนีไม่การันตี)`
        : `ดัชนีไม่โตก็ยังได้เงินการันตีเต็มจำนวน · โบนัสดัชนีไม่การันตี`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "TWELVEPL" && f.twelvepl) {
    const g = f.twelvepl;
    return [
      `${f.planLine} ออม ${g.payYears} ปี ถือครบถึงอายุ ${g.coverToAge} รับเงินการันตีรวม ${f.lead.amount} บาท`,
      `${who} ออมปีละ ${f.spokenPrice.amount} บาท (ตกวันละ ${f.perDayAmount} บาท)${f.riders ? " รวมสัญญาเพิ่มเติม" : g.tax !== undefined ? " ลดหย่อนภาษีได้" : ""}`,
      `เงินคืนทุกปีตั้งแต่ปีที่ 2 · คุ้มครองชีวิต ${tpMoney(g.sum)} บาท ถึงอายุ ${g.coverToAge}${g.dividend ? " · มีเงินปันผล (ไม่การันตี)" : ""}`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "EASYPROTECT" && f.easyprotect) {
    const g = f.easyprotect;
    return [
      `${f.planLine} จ่ายแค่ ${g.payYears} ปี คุ้มครองถึงอายุ ${g.coverToAge} ถ้าเป็นอะไรไป ครอบครัวได้${g.atLeast ? "อย่างน้อย" : ""} ${f.lead.amount} บาท`,
      `${who} ออม${f.spokenPrice.per} ${f.spokenPrice.amount} บาท (ตกวันละ ${f.perDayAmount} บาท) รวม ${g.payYears} ปี ${epMoney(g.paid)} บาท`,
      `ปีที่ ${g.payYears + 1} เป็นต้นไป ไม่ต้องจ่ายอีก${f.breakEven ? ` · มูลค่าเงินสดครบเท่าที่ออมตอนอายุ ${f.breakEven.age}` : ""}`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "LIFETREASURE" && f.lifetreasure) {
    const g = f.lifetreasure;
    return [
      `${f.planLine} ส่งต่อเงินก้อนให้ครอบครัว${g.atLeast ? "อย่างน้อย" : ""} ${f.lead.amount} บาท คุ้มครองถึงอายุ ${g.coverToAge}`,
      `${who} ออมปีละ ${f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual} บาท จ่าย ${g.payYears} ปี รวม ${ltMoney(g.paid)} บาท${g.times ? ` · ส่งต่อได้ ${g.times} เท่าของที่ออม` : ""}`,
      `เลือกจ่ายได้ ${g.terms.map((x) => x.years).join(" / ")} ปี · ระบุจำนวนไว้ล่วงหน้า ไม่ขึ้นกับตลาด`,
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "CI123" && f.ci123) {
    const g = f.ci123;
    return [
      `${f.planLine} ประกันโรคร้ายแรง ทุน ${f.lead.amount} บาท คุ้มครอง ${g.diseaseCount} โรค จ่ายตามระยะ`,
      `${who} ออมปีแรก ${f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual} บาท (ตกวันละ ${g.perDay} บาท) รวมแบบหลัก Life Protect x2`,
      g.stairs.map((r) => `${r.short} ${ciMoney(r.amount)}`).join(" · "),
      "",
      ask,
    ].join("\n");
  }
  if (f.product === "CANCER" && f.cancer) {
    const g = f.cancer;
    return [
      `${f.planLine} ทุน ${f.lead.amount} บาท จ่ายตามขั้นของมะเร็ง ชดเชยนอนโรงพยาบาลวันละ ${caMoney(g.hic)} บาท`,
      `${who} ออมปีแรก ${f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual} บาท (ตกวันละ ${g.perDay} บาท) รวมแบบหลัก Life Protect x2`,
      g.stages.map((s) => `ขั้น ${s.no} ${caMoney(s.amount)}`).join(" · "),
      "",
      ask,
    ].join("\n");
  }
  if (f.allPlans) return allPlansCaption(f, f.allPlans);
  if (f.product === "IHEALTHY") {
    return [
      `ประกันสุขภาพเหมาจ่าย แผน ${f.planName} วงเงิน ${spokenBaht(f.lead.baht)}บาทต่อปี`,
      `${who} ปีแรก${f.spokenPrice.per} ${f.spokenPrice.amount} บาท`,
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
