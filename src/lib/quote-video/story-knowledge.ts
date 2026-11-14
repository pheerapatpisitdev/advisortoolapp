import { defaultPartner, faceOf } from "@/lib/story/faces";
import { planName, termShort } from "@/lib/story/plans";
import { cleanCustomerName, noMonthly, spokenBaht, spokenBy } from "./script";
import type { StoryVideoInput } from "./story";
import { AFTER_CLOSE, afterScenes, type AfterTopic } from "./story-after";
import { familyScenes, FAMILY_CLOSE, type FamilyTopic } from "./story-family";
import { healthScenes, HEALTH_CLOSE, type HealthTopic } from "./story-health";
import { lifeScenes, LIFE_CLOSE, type LifeTopic } from "./story-life";
import { objectionScenes, OBJECTION_CLOSE, type ObjectionTopic } from "./story-objection";
import { refundAt, TAX_CAPS, TAX_FOOT, TAX_RATES, TAX_YEAR } from "@/lib/scene-library/tax-th";

/**
 * ความรู้ประกัน 1 นาที (owner, 2026-10-15, mockup https://claude.ai/artifact/LUVQ8Pob2DJbBp5petTsNu):
 * five short episodes in คลิปเล่าเรื่อง, each six scenes — five that teach, and the agent's card.
 * Two shapes: a word explained (a question, the points, a line to remember) and a belief put
 * right (the belief stamped, the fact, the reasons, a line to remember).
 *
 * Each scene is what it shows and what it says. The drawing is story-knowledge-motion.tsx; the
 * words are here, so the voice and the screen are written side by side. Nothing here states a
 * figure the plans' tables did not give: the premiums come in on the clip's input (story.ts).
 */

export type KnowSceneKey = "knowAsk" | "knowOne" | "knowTwo" | "knowThree" | "knowRecap";
export const KNOW_KEYS: KnowSceneKey[] = ["knowAsk", "knowOne", "knowTwo", "knowThree", "knowRecap"];

/** one line of a note: small, or big; red or green where it is a warning or a promise kept */
export interface NoteLine { text: string; big?: boolean; tone?: "red" | "green" }

export type KnowShow =
  /** the one who wonders, with question marks */
  | { layout: "ask"; title: [string, string] }
  /** a belief, stamped ความเชื่อ in red */
  | { layout: "myth"; quote: string[] }
  /** the fact, stamped ความจริง in green, the belief's words struck out */
  | { layout: "fact"; crossed: string; note: NoteLine[] }
  /** money going out (the premium) or coming in (the sum), and a note */
  | { layout: "flow"; title: [string, string]; dir: "out" | "in"; note: NoteLine[] }
  /** the one who wonders and a note; greyed when the news is bad */
  | { layout: "note"; title: [string, string]; dim?: boolean; note: NoteLine[] }
  /** a list on a card: ticks, crosses, empty boxes or warnings */
  | { layout: "list"; title: [string, string]; mark: "check" | "cross" | "box" | "warn"; items: string[] }
  /** the line to remember */
  | { layout: "recap"; lines: NoteLine[] }
  /** premiums at three ages, as bars */
  | { layout: "bars"; lead: [string, string]; rows: { label: string; value: number; text: string }[]; source: string }
  /** a family, and a note */
  | { layout: "family"; title: [string, string]; note: NoteLine[] }
  /** a gift box, and a note */
  | { layout: "gift"; title: [string, string]; note: NoteLine[] }
  /** เรื่องครอบครัว: a row of the family, with the bills that hang on them, a note, a bag of money coming, or question marks */
  | { layout: "kin"; title: [string, string]; people: Kin[]; tags?: { items: string[]; red?: boolean }; note?: NoteLine[]; bag?: boolean; marks?: boolean; hearts?: boolean }
  /** a sum worked out on a card, under a title */
  | { layout: "card"; title: [string, string]; lines: NoteLine[] }
  /** the steps or years ahead, a mark (an age, a day, a number) and what it is, down a line */
  | { layout: "timeline"; title: [string, string]; rows: { at: string; label: string }[] }
  /** หลังการขาย: a drawn thing (the policy, a calendar with its day, a cake, a festival's sign), a face, a note */
  | { layout: "pic"; title: [string, string]; icon: PicIcon; day?: string; face?: string; note?: NoteLine[]; hearts?: boolean }
  /** health devices (scene library): drawn by the story looks, numbers sourced upstream */
  | { layout: "split"; title: [string, string]; parts: string[]; whole: string }
  | { layout: "limit"; title: [string, string]; limit: number; used?: number; planName: string }
  | { layout: "room"; title: [string, string]; plan: number; real?: number; planName: string }
  | { layout: "overflow"; title: [string, string]; bill?: number; limit?: number }
  | { layout: "waiting"; title: [string, string]; rows: { at: string; label: string }[] }
  | { layout: "cashless"; title: [string, string]; note: string }
  | { layout: "groupgap"; title: [string, string]; bill?: number; group?: number }
  | { layout: "agecost"; title: [string, string]; rows: { age: number; annual: number }[]; source: string }
  /*
   * ชีวิต โรคร้าย ภาษี มรดก devices (round 2): every number an input (typed, the brief, the plan, or the tax
   * table), each optional so the device has a words-only form; totals, gaps and refunds are computed by the
   * helpers below, never carried on the show
   */
  /** ทุนชีวิตที่ควรมี: debts + expenses a year × years + education, against what is had */
  | { layout: "lifeneed"; title: [string, string]; debts?: number; expenses?: number; years?: number; education?: number; have?: number }
  /** ผู้รับประโยชน์: up to four names, shares (percent) all given and totalling 100, or none */
  | { layout: "beneficiary"; title: [string, string]; rows: { name: string; share?: number }[] }
  /** เงินก้อนตอนวินิจฉัย: the critical-illness sum, paid as a lump */
  | { layout: "cilump"; title: [string, string]; sum?: number; note?: string }
  /** รายได้หยุดระหว่างรักษา: a month's income, the months off */
  | { layout: "incomestop"; title: [string, string]; monthly?: number; months?: number }
  /** ภาษีที่ได้คืนตามฐาน: a year's life premium, the agent's bracket (one of TAX_RATES) */
  | { layout: "taxback"; title: [string, string]; premium?: number; bracket?: number }
  /** เพดานลดหย่อนรวม: the table's caps, nothing typed */
  | { layout: "taxcap"; title: [string, string] }
  /** แบ่งเงินให้คนในบ้าน: a total split into two or three, amounts all given and within the total, or none */
  | { layout: "moneysplit"; title: [string, string]; total?: number; parts: { label: string; amount?: number }[] }
  /** ส่งต่อสามรุ่น: three generations, the money passed on */
  | { layout: "threegen"; title: [string, string]; rows: string[]; note?: string };

export const HEALTH_LAYOUTS = ["split", "limit", "room", "overflow", "waiting", "cashless", "groupgap", "agecost"] as const;
export type HealthLayout = (typeof HEALTH_LAYOUTS)[number];
export const LIFE_LAYOUTS = ["lifeneed", "beneficiary", "cilump", "incomestop", "taxback", "taxcap", "moneysplit", "threegen"] as const;
export type LifeLayout = (typeof LIFE_LAYOUTS)[number];
/** any system-drawn device: health (round 1) or ชีวิต ภาษี มรดก (round 2) */
export type DeviceLayout = HealthLayout | LifeLayout;
export const DEVICE_LAYOUTS: readonly DeviceLayout[] = [...HEALTH_LAYOUTS, ...LIFE_LAYOUTS];
export type LifeShow<L extends LifeLayout = LifeLayout> = Extract<KnowShow, { layout: L }>;

/**
 * The words the round-2 devices draw themselves, beside their fields and the tax table's rows (tax-th.ts):
 * kept here so knowText hands them to the hand font with the rest.
 */
export const LIFE_WORDS = {
  debts: "หนี้คงเหลือ",
  living: "ค่าใช้จ่ายครอบครัว",
  perYear: "ต่อปี",
  years: "ปี",
  education: "ค่าการศึกษาลูก",
  need: "ควรมีทุนรวม",
  /** lifeneed's card when some inputs are missing: the sum of what was typed, not the whole need */
  partial: "รวมที่กรอกไว้",
  have: "มีอยู่แล้ว",
  gap: "ขาดอีก",
  enough: "ทุนที่มีพอแล้ว",
  needWords: "ทุนชีวิตควรครอบคลุมหนี้และค่าใช้จ่ายของครอบครัว",
  policy: "กรมธรรม์",
  name: "ระบุชื่อและสัดส่วนในใบคำขอ",
  certificate: "ใบรับรองแพทย์",
  lump: "จ่ายเป็นเงินก้อน",
  diagnosed: "เมื่อแพทย์วินิจฉัยตามเงื่อนไขกรมธรรม์",
  income: "รายได้",
  perMonth: "ต่อเดือน",
  stop: "หยุดรักษา",
  months: "เดือน",
  lost: "รายได้หาย",
  bracket: "ฐานภาษี",
  back: "ได้คืน",
  deductible: "ลดหย่อนได้ไม่เกิน",
  /** taxback's subtitle with a premium: the year's premium the ladder is worked on */
  premium: "เบี้ยปีละ",
  exempt: "ยกเว้น",
  year: TAX_YEAR,
  foot: TAX_FOOT,
  total: "เงินก้อน",
  left: "เหลือ",
  pass: "ส่งต่อ",
  /** the digits and marks the devices draw their figures with */
  marks: "0123456789,บาท%×=−→()",
} as const;

/** lifeneed's blocks, each from its inputs: debts, expenses a year × years (both needed), education */
export interface LifeneedTotals {
  blocks: { key: "debts" | "living" | "education"; amount: number }[];
  /** the blocks' sum; none without a block */
  need?: number;
  have?: number;
  /**
   * how far what is had falls short of the need, never below nought; with what is had and all three blocks only (a
   * partial sum is what was typed, not the need, so no gap is drawn against it)
   */
  gap?: number;
}

/** lifeneed's figures, from its inputs only (a total or gap on the show is never read) */
export function lifeneedTotals(show: LifeShow<"lifeneed">): LifeneedTotals {
  const blocks: LifeneedTotals["blocks"] = [];
  if (show.debts !== undefined) blocks.push({ key: "debts", amount: show.debts });
  if (show.expenses !== undefined && show.years !== undefined) blocks.push({ key: "living", amount: show.expenses * show.years });
  if (show.education !== undefined) blocks.push({ key: "education", amount: show.education });
  const out: LifeneedTotals = { blocks };
  if (blocks.length) out.need = blocks.reduce((s, b) => s + b.amount, 0);
  if (show.have !== undefined) out.have = show.have;
  if (out.need !== undefined && out.have !== undefined && blocks.length === 3) out.gap = Math.max(0, out.need - out.have);
  return out;
}

/** incomestop's income lost: a month's income × the months off, with both only */
export const incomestopLost = (show: LifeShow<"incomestop">): number | undefined =>
  show.monthly !== undefined && show.months !== undefined ? show.monthly * show.months : undefined;

/** taxback's ladder: each of the table's rates, its refund on the premium (capped, refundAt) when there is one, the agent's rate on */
export const taxbackLadder = (show: LifeShow<"taxback">): { rate: number; refund?: number; on: boolean }[] =>
  TAX_RATES.map((rate) => ({ rate, ...(show.premium !== undefined ? { refund: refundAt(show.premium, rate) } : {}), on: rate === show.bracket }));

/** taxback's refund at the agent's own rate, with a premium and a rate only */
export const taxbackRefund = (show: LifeShow<"taxback">): number | undefined =>
  show.premium !== undefined && show.bracket !== undefined ? refundAt(show.premium, show.bracket) : undefined;

/** what moneysplit's total keeps once every part has its amount; none when nothing is left or an amount is missing */
export function moneysplitRemainder(show: LifeShow<"moneysplit">): number | undefined {
  if (show.total === undefined || !show.parts.length || show.parts.some((p) => p.amount === undefined)) return undefined;
  const left = show.total - show.parts.reduce((s, p) => s + (p.amount ?? 0), 0);
  return left > 0 ? left : undefined;
}

/**
 * The words the health devices draw themselves, beside the fields they are given (story-knowledge-motion.tsx):
 * kept here so knowText hands them to the hand font with the rest.
 */
export const HEALTH_WORDS = {
  apart: "แยกจ่าย",
  lump: "เหมาจ่าย",
  splitFoot: "ตัวอย่าง ตามเงื่อนไขแต่ละแผน",
  perYear: "ต่อปี",
  used: "ใช้ไป",
  left: "เหลืออีก",
  full: "ใช้ครบวงเงินแล้ว",
  realRoom: "ค่าห้องจริง",
  planPays: "แผนจ่าย",
  planNight: "แผนจ่ายต่อคืน",
  ownNight: "จ่ายเองต่อคืน",
  enough: "แผนนี้จ่ายพอ",
  roomWords: "ค่าห้อง รพ. เอกชนมักเกินวงเงินของแผนเล็ก",
  example: "ตัวอย่าง",
  terms: "ตามเงื่อนไข",
  bill: "ค่ารักษา",
  insurerPays: "ประกันจ่าย",
  own: "จ่ายเอง",
  limit: "วงเงิน",
  withinYear: "อยู่ในวงเงินต่อปี",
  choose: "เลือกวงเงินให้พอ",
  chooseFoot: "กับ รพ. ที่ใช้",
  baht: "บาท",
  waitFoot: "ตามเงื่อนไขของแต่ละแผน",
  network: "รพ. ในเครือ",
  realBill: "ค่ารักษาจริง",
  groupPays: "ประกันกลุ่มจ่าย",
  short: "ขาดอีก",
  groupEnough: "ประกันกลุ่มจ่ายพอ",
  groupMaybe: "ประกันกลุ่มอาจไม่พอ",
  years: "ปี",
} as const;

export type PicIcon = "policy" | "calendar" | "cake" | "fireworks" | "lantern" | "water" | "jasmine" | "canna" | "gift" | "bag";

/**
 * One of the family in a row: the hero drawn largest; "gone" fades from colour to a dashed grey
 * outline as the scene plays, "dash" is a grey outline throughout (the baby still to come),
 * "sick" is drawn grey.
 */
export interface Kin { id: string; size: "hero" | "adult" | "kid" | "old"; state?: "gone" | "dash" | "sick" }

export interface KnowScene { key: KnowSceneKey; show: KnowShow; voice: string }
export interface KnowEpisode { scenes: KnowScene[]; cta: string; contactVoice: string }

export const n = (v: number) => Math.round(v).toLocaleString("en-US");
export const withBaht = (baht: number) => {
  const s = spokenBaht(baht);
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};
export const big = (text: string, tone?: NoteLine["tone"]): NoteLine => ({ text, big: true, ...(tone ? { tone } : {}) });
export const small = (text: string): NoteLine => ({ text });

/** the one who wonders: the hero's face, and their sex as it shows */
export const askerSex = (input: StoryVideoInput): "M" | "F" => faceOf(input.faces.hero)?.sex ?? "F";

/** the hero's partner in a family scene: the one picked (เรื่องครอบครัว), or of the other sex, never the narrator */
export function partnerFace(input: StoryVideoInput): string {
  return input.faces.partner ?? defaultPartner(input.faces.hero, input.faces.narrator);
}

function sumVsPremium(input: StoryVideoInput): KnowScene[] {
  const f = input.figure;
  const cover = f?.plan === "LIFEPROTECT" ? "ชีวิต" : "โรคร้ายแรง";
  const sexWord = f?.sex === "M" ? "ผู้ชาย" : "ผู้หญิง";
  return [
    { key: "knowAsk", show: { layout: "ask", title: ["ทุน กับ เบี้ย", "ต่างกันยังไง?"] }, voice: "ทุนประกัน กับ เบี้ยประกัน สองคำนี้ต่างกันยังไงคะ หลายคนยังสับสนอยู่" },
    noMonthly(input)
      // ตั้งค่าส่วนตัว: the agent hid the monthly instalment
      ? { key: "knowOne", show: { layout: "flow", title: ["เบี้ย", "= เงินที่คุณจ่าย"], dir: "out", note: [small("จ่ายให้บริษัท"), small("ตามงวดที่เลือก")] }, voice: "เบี้ยประกัน คือเงินที่เราจ่ายให้บริษัท ตามงวดที่เลือกไว้ค่ะ" }
      : { key: "knowOne", show: { layout: "flow", title: ["เบี้ย", "= เงินที่คุณจ่าย"], dir: "out", note: [small("จ่ายเป็นรายปี"), small("หรือแบ่งจ่ายรายเดือน")] }, voice: "เบี้ยประกัน คือเงินที่เราจ่ายให้บริษัท จ่ายเป็นรายปี หรือแบ่งจ่ายรายเดือนก็ได้ค่ะ" },
    { key: "knowTwo", show: { layout: "flow", title: ["ทุน", "= เงินที่บริษัทจ่ายให้"], dir: "in", note: [small("เมื่อเกิดเรื่อง"), small("ที่กรมธรรม์คุ้มครอง")] }, voice: "ส่วนทุนประกัน คือเงินที่บริษัทจ่ายให้ เมื่อเกิดเรื่องที่กรมธรรม์คุ้มครองค่ะ" },
    f
      ? {
        key: "knowThree",
        show: { layout: "note", title: ["ตัวอย่าง", ""], note: [small(`${f.sex === "M" ? "ชาย" : "หญิง"} ${f.age} ปี`), big(`เบี้ยปีละ ${n(f.annual)} บาท`), small("↓"), big(`ทุน ${n(f.sumAssured)} บาท`), small(`ตัวอย่างจาก ${planName(f.plan)} ${termShort(f)}`)] },
        voice: `เช่น ${sexWord}อายุ ${f.age} จ่ายเบี้ยปีละ ${n(f.annual)} บาท ได้ความคุ้มครอง${cover} ทุน ${withBaht(f.sumAssured)}ค่ะ`,
      }
      : { key: "knowThree", show: { layout: "note", title: ["ตัวอย่าง", ""], note: [small("เบี้ยที่จ่ายต่อปี"), big("น้อยกว่าทุน"), big("หลายเท่า")] }, voice: "โดยทั่วไป เบี้ยที่จ่ายต่อปี จะน้อยกว่าทุนประกันหลายเท่าค่ะ" },
    { key: "knowRecap", show: { layout: "recap", lines: [big("เบี้ย = เงินที่จ่าย"), big("ทุน = เงินที่ได้")] }, voice: "จำง่าย ๆ ค่ะ เบี้ยคือเงินที่จ่าย ทุนคือเงินที่ได้" },
  ];
}

const declare = (): KnowScene[] => [
  { key: "knowAsk", show: { layout: "ask", title: ["ปิดไว้นิดเดียว", "จะเป็นอะไรไหม?"] }, voice: "ตอนสมัครประกัน ถ้าปิดเรื่องสุขภาพไว้นิดเดียว จะเป็นอะไรไหมคะ" },
  { key: "knowOne", show: { layout: "list", title: ["ใบคำขอ", "ถามเรื่องสุขภาพ"], mark: "box", items: ["โรคประจำตัว", "ยาที่กินประจำ", "เคยนอนโรงพยาบาล"] }, voice: "ใบคำขอเอาประกัน จะถามเรื่องสุขภาพ เช่น โรคประจำตัว ยาที่กินประจำ หรือเคยนอนโรงพยาบาลไหมคะ" },
  // บอกล้างสัญญา, with no time limit: the limit is each policy's own (owner's default, 2026-10-15)
  { key: "knowTwo", show: { layout: "note", title: ["ถ้าปิดไว้", ""], dim: true, note: [small("บริษัทมีสิทธิ"), big("บอกล้างสัญญา", "red"), small("วันที่ต้องใช้ อาจเคลมไม่ได้")] }, voice: "ถ้าตอบไม่ตรงความจริง บริษัทมีสิทธิบอกล้างสัญญา วันที่ต้องใช้ อาจเคลมไม่ได้เลยค่ะ" },
  { key: "knowThree", show: { layout: "note", title: ["ถ้าบอกครบ", ""], note: [small("อาจขอเพิ่มเบี้ย หรือยกเว้นบางโรค"), big("แต่ที่คุ้มครองไว้", "green"), big("เคลมได้ตามสัญญา", "green")] }, voice: "ถ้าบอกครบ บางครั้งบริษัทอาจขอเพิ่มเบี้ย หรือยกเว้นบางโรค แต่สิ่งที่คุ้มครองไว้ เคลมได้ตามสัญญาค่ะ" },
  { key: "knowRecap", show: { layout: "recap", lines: [big("บอกครบวันนี้"), big("เคลมได้วันหน้า")] }, voice: "จำง่าย ๆ ค่ะ บอกครบวันนี้ เคลมได้วันหน้า" },
];

const mythClaim = (): KnowScene[] => [
  { key: "knowAsk", show: { layout: "myth", quote: ["“ประกัน", "เคลมยาก”"] }, voice: "หลายคนบอกว่า ประกันเคลมยาก จริงไหมคะ" },
  { key: "knowOne", show: { layout: "fact", crossed: "เคลมยาก", note: [small("เคลมได้"), big("ตามเงื่อนไข"), big("ในกรมธรรม์")] }, voice: "ความจริงคือ ประกันจ่ายตามเงื่อนไขที่เขียนไว้ในกรมธรรม์ค่ะ" },
  { key: "knowTwo", show: { layout: "list", title: ["ที่เคลมไม่ได้", "มักเป็นเพราะ"], mark: "cross", items: ["แถลงสุขภาพไม่ครบ", "ยังอยู่ในระยะรอคอย", "เป็นข้อยกเว้นในกรมธรรม์"] }, voice: "ที่เคลมไม่ได้ มักเป็นเพราะแถลงสุขภาพไม่ครบ ยังอยู่ในระยะรอคอย หรือเป็นข้อยกเว้นที่เขียนไว้ค่ะ" },
  { key: "knowThree", show: { layout: "list", title: ["ทางแก้", ""], mark: "check", items: ["อ่านเงื่อนไขก่อนซื้อ", "แถลงสุขภาพให้ครบ", "มีตัวแทนช่วยตอนเคลม"] }, voice: "ทางแก้คือ อ่านเงื่อนไขก่อนซื้อ แถลงสุขภาพให้ครบ และมีตัวแทนช่วยดูตอนเคลมค่ะ" },
  { key: "knowRecap", show: { layout: "recap", lines: [big("รู้เงื่อนไข"), big("= เคลมง่าย")] }, voice: "จำง่าย ๆ ค่ะ รู้เงื่อนไข เคลมก็ง่าย" },
];

function mythYoung(input: StoryVideoInput): KnowScene[] {
  const young = askerSex(input) === "M" ? "ยังหนุ่ม" : "ยังสาว";
  const l = input.ladder;
  const first = l?.rows[0];
  const last = l?.rows[l.rows.length - 1];
  const sexWord = l?.sex === "M" ? "ผู้ชาย" : "ผู้หญิง";
  return [
    { key: "knowAsk", show: { layout: "myth", quote: [`“${young}`, "ไม่ต้องมี”"] }, voice: "ยังหนุ่มยังสาว ยังไม่ต้องมีประกันหรอก จริงไหมคะ" },
    l && first && last
      ? {
        key: "knowOne",
        show: { layout: "bars", lead: ["ยิ่งเริ่มเร็ว", "เบี้ยยิ่งถูก"], rows: l.rows.map((r) => ({ label: `อายุ ${r.age}`, value: r.annual, text: n(r.annual) })), source: `บาท/ปี · ${l.sex === "M" ? "ชาย" : "หญิง"} ทุน 1 ล้าน · Life Protect จ่ายถึงอายุ 99` },
        voice: `ความจริงคือ ยิ่งเริ่มเร็ว เบี้ยยิ่งถูก ${sexWord}อายุ ${first.age} จ่ายปีละ ${n(first.annual)} บาท แต่ถ้ารอถึง ${last.age} จ่ายปีละ ${n(last.annual)} บาทค่ะ`,
      }
      : { key: "knowOne", show: { layout: "fact", crossed: "ไม่ต้องมี", note: [big("ยิ่งเริ่มเร็ว"), big("เบี้ยยิ่งถูก"), small("เพราะเบี้ยคิดตามอายุตอนสมัคร")] }, voice: "ความจริงคือ ยิ่งเริ่มเร็ว เบี้ยยิ่งถูกค่ะ เพราะเบี้ยคิดตามอายุตอนสมัคร" },
    { key: "knowTwo", show: { layout: "note", title: ["สุขภาพดีวันนี้", "สมัครง่าย"], note: [small("ยังแข็งแรง"), big("ไม่ค่อยมีเงื่อนไขเพิ่ม", "green")] }, voice: "และตอนสุขภาพยังดี สมัครง่าย ไม่ค่อยมีเงื่อนไขเพิ่มค่ะ" },
    { key: "knowThree", show: { layout: "note", title: ["เรื่องไม่คาดฝัน", "ไม่ได้รออายุ"], dim: true, note: [small("อุบัติเหตุ · โรคร้าย"), big("มาได้ทุกวัย", "red")] }, voice: "อุบัติเหตุกับโรคร้าย ไม่ได้รอให้เราแก่ก่อนค่ะ" },
    { key: "knowRecap", show: { layout: "recap", lines: [big("เริ่มเร็ว"), big("= จ่ายถูก สมัครง่าย")] }, voice: "จำง่าย ๆ ค่ะ เริ่มเร็ว จ่ายถูก สมัครง่าย" },
  ];
}

const mythJinx = (): KnowScene[] => [
  { key: "knowAsk", show: { layout: "myth", quote: ["“ซื้อประกัน", "เหมือนแช่งตัวเอง”"] }, voice: "ซื้อประกัน เหมือนแช่งตัวเองหรือเปล่าคะ" },
  { key: "knowOne", show: { layout: "fact", crossed: "แช่งตัวเอง", note: [small("คาดเข็มขัดนิรภัย"), big("ไม่ได้แปลว่า"), big("อยากให้รถชน")] }, voice: "ความจริงคือ ประกันไม่ได้ทำให้เกิดเรื่องร้ายค่ะ เหมือนคาดเข็มขัดนิรภัย ไม่ได้แปลว่าอยากให้รถชน" },
  { key: "knowTwo", show: { layout: "family", title: ["ถ้าวันหนึ่ง", "เกิดเรื่องขึ้น"], note: [small("คนที่เรารัก"), big("ไม่ต้องลำบาก", "green")] }, voice: "แต่ถ้าวันหนึ่งเกิดเรื่องขึ้น คนที่เรารักจะไม่ต้องลำบากค่ะ" },
  { key: "knowThree", show: { layout: "gift", title: ["ประกัน", "คือของขวัญ"], note: [small("ที่เราเตรียมไว้"), big("ให้คนข้างหลัง")] }, voice: "ประกันจึงเป็นเหมือนของขวัญ ที่เราเตรียมไว้ให้คนข้างหลังค่ะ" },
  { key: "knowRecap", show: { layout: "recap", lines: [big("ประกัน"), big("= ความห่วงใย"), small("ไม่ใช่คำแช่ง")] }, voice: "จำง่าย ๆ ค่ะ ประกันคือความห่วงใย ไม่ใช่คำแช่ง" },
];

/** 5 เรื่องใหญ่ (owner, 2026-11-01, mockup https://claude.ai/artifact/L1DeUXA9zRBg2L2awwuY5B): a word explained, with no premium */
const fiveRisks = (): KnowScene[] => [
  { key: "knowAsk", show: { layout: "ask", title: ["ประกันชีวิต", "คืออะไรกันแน่?"] }, voice: "ประกันชีวิตคืออะไรกันแน่คะ พูดง่าย ๆ คือเงินก้อนหนึ่ง ที่วันหนึ่งต้องมีคนได้รับแน่นอนค่ะ" },
  { key: "knowOne", show: { layout: "note", title: ["เงินก้อนนี้", "ไปถึงใคร"], note: [small("อยู่จนแก่"), big("ตัวเราได้ใช้"), small("จากไปก่อน"), big("คนที่รักได้รับ", "green")] },
    voice: "เงินก้อนนี้ไปถึงคนแค่สองคนค่ะ ถ้าเราอยู่จนผมเปลี่ยนสี ก็คือตัวเราเอง ถ้าจากไปก่อน ก็คือคนที่เรารัก คู่ชีวิต ลูก หรือพ่อแม่พี่น้อง" },
  { key: "knowTwo", show: { layout: "list", title: ["5 เรื่องใหญ่", "ที่ชีวิตต้องเตรียม"], mark: "warn", items: ["1 จากไปเร็ว ครอบครัวขาดรายได้", "2 อยู่นานเกิน เงินเกษียณไม่พอ", "3 ป่วยโรคร้ายแรง ค่ารักษาสูง"] },
    voice: "มีห้าเรื่องใหญ่ที่ชีวิตต้องเตรียมค่ะ หนึ่ง จากไปเร็ว ครอบครัวขาดรายได้ สอง อยู่นานเกินไป เงินเกษียณไม่พอใช้ สาม ป่วยเป็นโรคร้ายแรง อย่างมะเร็ง หลอดเลือดสมอง หรือหัวใจ ค่ารักษาอาจสูงถึงหลักล้าน" },
  { key: "knowThree", show: { layout: "list", title: ["อีกสองเรื่อง", "ที่ไม่มีใครอยากเจอ"], mark: "warn", items: ["4 อุบัติเหตุ", "5 ทุพพลภาพ ทำงานไม่ได้"] },
    voice: "สี่ อุบัติเหตุ และห้า ทุพพลภาพจนทำงานไม่ได้ สองเรื่องนี้ไม่มีใครอยากเจอ แต่ไม่มีใครเลือกได้ค่ะ" },
  { key: "knowRecap", show: { layout: "recap", lines: [big("ประกัน = เงินก้อน"), big("ที่ต้องมีคนได้แน่"), small("แถมลดหย่อนภาษีได้"), small("ตามเงื่อนไข")] },
    voice: "จำง่าย ๆ ค่ะ ประกันคือเงินก้อนที่ต้องมีคนได้แน่ เราเอง หรือคนที่เรารัก และเบี้ยยังลดหย่อนภาษีได้ตามเงื่อนไขด้วย" },
];

/** each episode's closing: what the card's button says, and the voice under it */
const CLOSE: Record<Exclude<StoryVideoInput["topic"], "pool48" | FamilyTopic | AfterTopic | ObjectionTopic | LifeTopic | HealthTopic>, string> = {
  sumvspremium: "อยากรู้ว่าทุนเท่าไรถึงพอ ทักมาได้เลย",
  declare: "ไม่แน่ใจว่าต้องแถลงอะไร ทักมาถามได้เลย",
  mythclaim: "อยากให้ช่วยดูเงื่อนไข ทักมาได้เลย",
  mythyoung: "อยากรู้ว่าอายุคุณจ่ายเท่าไร ทักมาได้เลย",
  mythjinx: "อยากเตรียมไว้ให้คนที่รัก ทักมาได้เลย",
  fiverisks: "อยากรู้ว่าเรื่องไหนต้องเตรียมก่อน ทักมาได้เลย",
};

/** An episode of any shelf but กองกลาง 48 คน: its scenes and its close, in the narrator's endings. */
export function knowEpisode(input: StoryVideoInput, customer?: string, narrator: "F" | "M" = "F"): KnowEpisode {
  if (input.topic === "pool48") throw new Error("กองกลาง 48 คน is a story, not an episode");
  const name = cleanCustomerName(customer);
  const family = () => familyScenes(input.topic as FamilyTopic, input, name);
  const afterSale = () => afterScenes(input.topic as AfterTopic, input, name);
  const objection = () => objectionScenes(input.topic as ObjectionTopic, input);
  const health = () => healthScenes(input.topic as HealthTopic, input, name);
  const life = () => lifeScenes(input.topic as LifeTopic, input, name);
  const scenes = {
    sumvspremium: () => sumVsPremium(input),
    declare,
    mythclaim: mythClaim,
    mythyoung: () => mythYoung(input),
    mythjinx: mythJinx,
    fiverisks: fiveRisks,
    pillar: family,
    mompillar: family,
    tuition: family,
    prebaby: family,
    eldercare: family,
    deliver: afterSale,
    claimish: afterSale,
    remind: afterSale,
    birthday: afterSale,
    festival: afterSale,
    thinkfirst: objection,
    groupins: objection,
    welfare: objection,
    bank: objection,
    pricey: objection,
    orphan: objection,
    firstjob: life,
    wedding: life,
    mortgage: life,
    selfemployed: life,
    preretire: life,
    lumpsum: health,
    roomcost: health,
    waiting: health,
    agecost: health,
  }[input.topic]();
  // story-family.ts and story-after.ts import this file's helpers, so their words are looked up here, at call time
  const after = input.topic in AFTER_CLOSE ? AFTER_CLOSE[input.topic as AfterTopic] : null;
  const close = after ? after.cta
    : input.topic in FAMILY_CLOSE ? FAMILY_CLOSE[input.topic as FamilyTopic]
      : input.topic in OBJECTION_CLOSE ? OBJECTION_CLOSE[input.topic as ObjectionTopic]
        : input.topic in LIFE_CLOSE ? LIFE_CLOSE[input.topic as LifeTopic]
          : input.topic in HEALTH_CLOSE ? HEALTH_CLOSE[input.topic as HealthTopic] : CLOSE[input.topic as keyof typeof CLOSE];
  const said = (s: string) => spokenBy(s.replace(/\s+/g, " ").trim(), narrator);
  return {
    scenes: scenes.map((s) => ({ ...s, voice: said(s.voice) })),
    cta: name ? `คุณ${name} ${close}` : close,
    contactVoice: said(after ? after.voice : `${name ? `คุณ${name} ` : ""}${close}นะคะ`),
  };
}

/** a health device (scene library): drawn with digits and "บาท", and words of its own (HEALTH_WORDS) */
export const isHealth = (show: KnowShow): boolean => (HEALTH_LAYOUTS as readonly string[]).includes(show.layout);
/** a ชีวิต ภาษี มรดก device (round 2): drawn with digits, "บาท" and "%", and words of its own (LIFE_WORDS, the tax table's rows) */
export const isLife = (show: KnowShow): boolean => (LIFE_LAYOUTS as readonly string[]).includes(show.layout);
/** any system-drawn device, either round */
export const isDevice = (show: KnowShow): boolean => isHealth(show) || isLife(show);

/** the words one show puts on screen from its own fields (a device's own words and digits are showText's) */
function showWords(show: KnowShow): string[] {
  const words: string[] = [];
  if ("title" in show) words.push(...show.title);
  if ("note" in show && show.note && typeof show.note !== "string") words.push(...show.note.map((l) => l.text));
  if (show.layout === "card") words.push(...show.lines.map((l) => l.text));
  if (show.layout === "myth") words.push(...show.quote, "ความเชื่อ");
  if (show.layout === "fact") words.push(show.crossed, "ความจริง");
  if (show.layout === "list") words.push(...show.items);
  if (show.layout === "recap") words.push(...show.lines.map((l) => l.text), "จำง่าย ๆ");
  if (show.layout === "bars") words.push(...show.lead, ...show.rows.flatMap((r) => [r.label, r.text]));
  if (show.layout === "kin" && show.tags) words.push(...show.tags.items);
  if (show.layout === "timeline") words.push(...show.rows.flatMap((r) => [r.at, r.label]));
  if (show.layout === "pic" && show.day) words.push(show.day);
  if (show.layout === "split") words.push(...show.parts, show.whole);
  if (show.layout === "cashless") words.push(show.note);
  if (show.layout === "waiting") words.push(...show.rows.flatMap((r) => [r.at, r.label]));
  if (show.layout === "limit" || show.layout === "room") words.push(show.planName);
  if (show.layout === "agecost") words.push(show.source);
  if (show.layout === "beneficiary") words.push(...show.rows.map((r) => r.name));
  if (show.layout === "cilump" && show.note) words.push(show.note);
  if (show.layout === "moneysplit") words.push(...show.parts.map((p) => p.label));
  if (show.layout === "threegen") words.push(...show.rows, ...(show.note ? [show.note] : []));
  return words;
}

/** health devices draw their numbers with digits and "บาท", and words of their own */
const HEALTH_TEXT = ["0123456789,บาท", ...Object.values(HEALTH_WORDS)];
/** round-2 devices: their own words, and the tax table's rows (taxcap) */
const LIFE_TEXT = [...Object.values(LIFE_WORDS), ...TAX_CAPS.flatMap((r) => [r.label, r.note ?? ""])];

/** every word one show puts on screen, for the handwriting face: a knowledge scene's, or a คลิปตามโจทย์ device scene's */
export function showText(show: KnowShow): string {
  return [...showWords(show), ...(isHealth(show) ? HEALTH_TEXT : []), ...(isLife(show) ? LIFE_TEXT : [])].join("");
}

/** every word an episode puts on screen, for the handwriting face */
export function knowText(e: KnowEpisode): string {
  const words: string[] = [e.cta, ...e.scenes.flatMap(({ show }) => showWords(show))];
  if (e.scenes.some(({ show }) => isHealth(show))) words.push(...HEALTH_TEXT);
  if (e.scenes.some(({ show }) => isLife(show))) words.push(...LIFE_TEXT);
  return words.join("");
}
