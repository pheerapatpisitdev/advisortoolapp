import type { ChatMessage } from "@/lib/ai/types";
import { SHARE_WHY } from "./finish";
import { formulaRules, type Formula } from "./formula";
import type { PiecePlan } from "./plan";
import { POLICY_RULES_TH } from "./policy";
import type { Lang } from "./output";
import { THEME_MOOD, THEMES } from "./poster";
import { iHealthyFacts } from "@/lib/ihealthy-facts";

/**
 * What the content generator asks of the model.
 *
 * The rules that matter most are the ones about numbers and claims, and they are stated as
 * prohibitions the checks after it can see broken: a number not in the brief, a word on the
 * owner's list. The model is not trusted to have followed them — it is told, and then checked.
 */

export type Format = "post" | "script" | "ad";

/** what Organic Studio's writers and its claim route say to a request for an ad (Ads Studio campaigns, 2026-10-04) */
export const ADS_MOVED = "โฆษณาย้ายไปทำใน Ads Studio แล้ว";
/**
 * What a row in ins_content is: a format the writer writes, or a clip an agent filmed (owner,
 * 2026-10-02). The writer's prompts never see "clip" — nothing writes one.
 */
export type PieceFormat = Format | "clip";

export const FORMAT_LABEL: Record<PieceFormat, string> = { post: "โพสต์เฟซบุ๊ก", script: "สคริปต์วิดีโอ", ad: "โฆษณา", clip: "คลิป Reel" };
export const FORMAT_SHORT: Record<PieceFormat, string> = { post: "โพสต์", script: "สคริปต์", ad: "โฆษณา", clip: "คลิป" };
export type Length = "30" | "60" | "180";

/**
 * The angles offered on the form. `say` is what the planner and writer are told — the label is
 * a few words for a button, and an angle like "เช็กลิสต์" means little to a model on its own.
 * The last four teach before they sell: they are the ones people read to the end and pass on.
 */
export const ANGLES = [
  { id: "family", label: "คุ้มครองครอบครัว", say: "คุ้มครองครอบครัว" },
  { id: "tax", label: "ลดหย่อนภาษี", say: "ลดหย่อนภาษี" },
  { id: "child", label: "ซื้อให้ลูก", say: "ซื้อให้ลูก" },
  { id: "retire", label: "เกษียณ", say: "เกษียณ" },
  { id: "story", label: "เล่าเป็นเรื่อง (สถานการณ์สมมติ)", say: "เล่าเป็นเรื่อง (สถานการณ์สมมติ)" },
  {
    id: "myth", label: "ความเข้าใจผิดที่เจอบ่อย",
    say: "ความเข้าใจผิดที่เจอบ่อย — หยิบความเชื่อผิดเรื่องประกันที่คนทั่วไปมีจริง เช่น มีประกันกลุ่มของบริษัทแล้วพอ แล้วอธิบายว่าจริงๆ เป็นยังไง โดยใช้ข้อมูลผลิตภัณฑ์เท่านั้น",
  },
  {
    id: "faq", label: "คำถามที่ลูกค้าถามบ่อย",
    say: "คำถามที่ลูกค้าถามบ่อย — ตอบคำถามที่คนสงสัยก่อนซื้อ เช่น ซื้อได้ถึงอายุเท่าไร จ่ายกี่ปี เคลมยังไง คำตอบต้องมาจากข้อมูลผลิตภัณฑ์ ถ้าข้อมูลไม่มีคำตอบ อย่าเลือกคำถามนั้น",
  },
  {
    id: "checklist", label: "เช็กลิสต์ก่อนซื้อ",
    say: "เช็กลิสต์ก่อนซื้อ — เรื่องที่ควรดูก่อนตัดสินใจซื้อประกันแบบนี้ เป็นข้อๆ ให้คนอ่านเก็บไว้ใช้เองได้ แล้วค่อยบอกว่าแบบนี้ตอบแต่ละข้อยังไง",
  },
  {
    id: "costs", label: "ค่ารักษาแพงขึ้นทุกปี",
    say: "ค่ารักษาแพงขึ้นทุกปี — เล่าว่าค่ารักษาเป็นภาระที่โตขึ้นเรื่อยๆ โดยไม่ยกตัวเลขค่ารักษาหรืออัตราเพิ่มที่ไม่มีในข้อมูล แล้วพาไปที่ความคุ้มครองของแบบนี้",
  },
  {
    id: "numbers", label: "ตัวเลขชัดๆ (เบี้ยต่อเดือน/ต่อวัน)",
    say: "ตัวเลขชัดๆ — ระบบวางตัวเลขจากตารางเบี้ยให้เอง",
  },
  {
    id: "nowaste", label: "เบี้ยไม่ทิ้ง",
    say: "เบี้ยไม่ทิ้ง — ข้อดีของแบบนี้คือเบี้ยที่จ่ายไม่ได้หายไปเปล่าๆ เหมือนประกันที่จ่ายทิ้ง เล่าตามที่ข้อมูลผลิตภัณฑ์บอกเท่านั้น เช่น คุ้มครองตลอดชีพจึงได้รับเงินแน่นอน มีมูลค่าเวนคืน อยู่ครบสัญญาได้เงินคืน หรือได้รับเงินบำนาญ ห้ามเรียกว่าการลงทุน ห้ามพูดถึงผลตอบแทนเป็นเปอร์เซ็นต์ ห้ามยกตัวเลขมูลค่าเวนคืนที่ไม่มีในข้อมูล และถ้าพูดถึงการเวนคืน ต้องบอกด้วยว่าเวนคืนในช่วงปีแรกๆ จะได้น้อยกว่าเบี้ยที่จ่าย",
  },
  {
    id: "newparent", label: "พ่อแม่มือใหม่ (เพิ่งมีลูก)",
    say: "พ่อแม่มือใหม่ (เพิ่งมีลูก) — พูดกับพ่อแม่ที่เพิ่งมีลูก: ตอนนี้มีคนตัวเล็กที่ต้องพึ่งเราไปอีกหลายปี ถ้าวันหนึ่งพ่อหรือแม่ไม่อยู่ ลูกยังมีเงินก้อนไว้เติบโตและเรียนต่อได้ ถ้าข้อมูลผลิตภัณฑ์บอกว่ารับตั้งแต่แรกเกิด จะเล่าเรื่องทำให้ลูกด้วยก็ได้ เขียนอบอุ่นและให้กำลังใจ ห้ามขู่ให้กลัว ใช้ตัวเลขและความคุ้มครองจากข้อมูลผลิตภัณฑ์เท่านั้น",
  },
  {
    id: "newlywed", label: "คู่แต่งงานใหม่",
    say: "คู่แต่งงานใหม่ — พูดกับคู่ที่เพิ่งแต่งงานและเริ่มสร้างครอบครัวด้วยกัน อาจกำลังผ่อนบ้านหรือรถร่วมกัน: ประกันชีวิตคือการดูแลกันและกัน ถ้าวันหนึ่งคนหนึ่งไม่อยู่ อีกคนไม่ต้องแบกภาระคนเดียว เขียนอบอุ่น หวานได้แต่ไม่เลี่ยน ห้ามขู่ให้กลัว ห้ามระบุเพศของคู่ ใช้ตัวเลขและความคุ้มครองจากข้อมูลผลิตภัณฑ์เท่านั้น",
  },
  {
    id: "singlemom", label: "แม่เลี้ยงเดี่ยว (Single Mom)",
    say: "แม่เลี้ยงเดี่ยว (Single Mom) — พูดกับแม่ที่เลี้ยงลูกคนเดียวและเป็นรายได้หลักของบ้าน: ถ้าวันหนึ่งแม่ไม่อยู่ ลูกยังมีเงินก้อนไว้เรียนและใช้ชีวิตต่อได้ เขียนด้วยความเคารพและให้กำลังใจ ห้ามเขียนแบบน่าสงสาร ห้ามตัดสิน ห้ามพูดถึงพ่อของลูกหรือการเลิกรา ใช้ตัวเลขและความคุ้มครองจากข้อมูลผลิตภัณฑ์เท่านั้น",
  },
] as const;

/**
 * The life plans, which alone take the angles about the people at home — แม่เลี้ยงเดี่ยว,
 * พ่อแม่มือใหม่, คู่แต่งงานใหม่ (owner, 2026-10-06): their whole point is the sum the family
 * is left with, which the health, critical-illness and pension plans do not pay.
 */
export const LIFE_HREFS = ["/lifeprotect", "/plb", "/easyprotect", "/lifetreasure", "/legacy", "/ishield"] as const;

/**
 * The plans whose premiums come back in some form, which alone take the เบี้ยไม่ทิ้ง angle
 * (owner, 2026-10-06): whole life to 99, a surrender value, a full sum at maturity, or a
 * pension. Not PLB, whose own cautions say a term that runs out pays nothing back, and not
 * the health, critical-illness or Legacy riders, whose premiums are spent.
 */
export const NO_WASTE_HREFS = ["/lifeprotect", "/easyprotect", "/lifetreasure", "/ishield", "/bumnan95"] as const;

/** The angles only some plans may take, and those plans. */
const ANGLE_PLANS: Partial<Record<string, readonly string[]>> = {
  newparent: LIFE_HREFS, newlywed: LIFE_HREFS, singlemom: LIFE_HREFS, nowaste: NO_WASTE_HREFS,
};

/** The one page whose posts may be written in English, for expats living in Thailand. */
export const EXPAT_HREF = "/ihealthy-ultra";

/**
 * The angles for an English post to expats, offered only with the form's tick. `say` is a
 * Thai instruction like the others — the post it asks for is English (ENGLISH_RULES).
 */
// the sheet's own figures (data/riders/ihealthy-ultra.json), so the angles move with it; the
// no-claim discount's three years are only in the sheet's wording, so they stay written here
const { renewalToAge: RENEW_TO, outOfTerritoryDays: ABROAD_DAYS } = iHealthyFacts().terms;
export const EXPAT_ANGLES = [
  {
    id: "expat_hospital", label: "ค่าโรงพยาบาลเอกชนในไทย",
    say: "ค่าโรงพยาบาลเอกชนในไทย — เล่าว่าคนที่ไม่มีสิทธิรักษาของรัฐต้องจ่ายค่ารักษาโรงพยาบาลเอกชนเอง แล้วพาไปที่วงเงินเหมาจ่ายของแบบนี้ ห้ามยกตัวเลขค่ารักษาของโรงพยาบาลที่ไม่มีในข้อมูลผลิตภัณฑ์",
  },
  {
    id: "expat_visa", label: "ประกันสุขภาพกับวีซ่า",
    say: "ประกันสุขภาพกับวีซ่า — แบบนี้ใช้ประกอบการยื่นขอวีซ่าได้ พูดกว้างๆ เท่านั้น ห้ามระบุชื่อหรือประเภทวีซ่า ห้ามบอกว่าใช้ได้กับวีซ่าทุกประเภท ห้ามรับประกันว่าผ่าน ให้ชวนทักข้อความมาเช็กว่าเหมาะกับวีซ่าของเขาไหม",
  },
  {
    id: "expat_job", label: "ประกันบริษัทหมดเมื่อเปลี่ยนงานหรือเกษียณ",
    say: `ประกันบริษัทหมดเมื่อเปลี่ยนงานหรือเกษียณ — ประกันกลุ่มของนายจ้างจบเมื่องานจบ แต่ประกันที่ซื้อเองอยู่กับเราต่อ ต่ออายุได้ถึงอายุ ${RENEW_TO} ใช้ข้อมูลผลิตภัณฑ์เท่านั้น`,
  },
  {
    id: "expat_travel", label: "กลับบ้าน/เที่ยวต่างประเทศ",
    say: `กลับบ้านหรือเที่ยวต่างประเทศ — นอกประเทศไทยคุ้มครองเฉพาะการรักษาฉุกเฉินที่เกิดภายใน ${ABROAD_DAYS} วันนับจากวันเดินทาง ต้องพูดว่า “ฉุกเฉิน” และ “${ABROAD_DAYS} วัน” ให้ชัด ห้ามพูดว่าคุ้มครองทั่วโลกหรือคุ้มครองทุกที่`,
  },
  {
    id: "expat_longstay", label: "อยู่ไทยยาว / เกษียณที่ไทย",
    say: `อยู่ไทยยาวหรือเกษียณที่ไทย — ต่ออายุได้ถึงอายุ ${RENEW_TO} มีส่วนลดเมื่อไม่เคลม 3 ปี และมีวงเงินสูงต่อปี ใช้ตัวเลขจากข้อมูลผลิตภัณฑ์เท่านั้น`,
  },
  {
    id: "expat_english", label: "คุยกับตัวแทนเป็นภาษาอังกฤษได้",
    say: "คุยกับตัวแทนเป็นภาษาอังกฤษได้ — ซื้อและเคลมโดยมีตัวแทนดูแลและตอบแชทเป็นภาษาอังกฤษ ลดความกังวลเรื่องภาษา",
  },
] as const;

export type AngleId = (typeof ANGLES)[number]["id"] | (typeof EXPAT_ANGLES)[number]["id"] | "custom" | "";

/** The angle as the models are told it: the owner's words, the angle's full meaning, or nothing. */
export function angleText(angle: AngleId, custom: string): string {
  if (angle === "custom") return custom.trim();
  return [...EXPAT_ANGLES, ...ANGLES].find((a) => a.id === angle)?.say ?? "";
}

/**
 * The plans the ตัวเลขชัดๆ angle can price, kept here rather than read off numbers-plans.ts
 * because this file reaches the browser and the rate tables must not. A test holds the two
 * lists together.
 */
export const NUMBERS_HREFS = [
  "/lifeprotect", "/plb", "/easyprotect", "/lifetreasure", "/legacy", "/ishield", "/ci123", "/cancer", "/ihealthy-ultra", "/bumnan95",
] as const;

/**
 * The angles the form may offer: ตัวเลขชัดๆ is a post's, and only for a plan it can price;
 * แม่เลี้ยงเดี่ยว and เบี้ยไม่ทิ้ง only on the plans in ANGLE_PLANS. With
 * the expat tick the six expat angles lead, and the two that speak to Thai taxpayers and
 * parents (tax, child) go.
 */
export function anglesFor(format: Format, href: string, expat = false): ((typeof ANGLES)[number] | (typeof EXPAT_ANGLES)[number])[] {
  const base = ANGLES
    .filter((a) => a.id !== "numbers" || (format === "post" && (NUMBERS_HREFS as readonly string[]).includes(href)))
    .filter((a) => ANGLE_PLANS[a.id]?.includes(href) ?? true);
  if (!expat) return base;
  return [...EXPAT_ANGLES, ...base.filter((a) => a.id !== "tax" && a.id !== "child")];
}

/**
 * What the server and the form make of a request's expat tick: it holds only for an
 * iHealthy Ultra post, and the angle only if that menu offers it. A stale page or a forged
 * request settles to a Thai piece and "ให้ AI เลือก".
 */
export function settleExpat(i: { href: string; format: string; expat?: boolean; angle: string }): { expat: boolean; angle: AngleId } {
  const expat = i.expat === true && i.href === EXPAT_HREF && i.format === "post";
  const offered = i.format === "post" || i.format === "script" || i.format === "ad"
    ? anglesFor(i.format, i.href, expat).some((a) => a.id === i.angle)
    : false;
  return { expat, angle: i.angle === "custom" || offered ? (i.angle as AngleId) : "" };
}

/**
 * Appended to the system prompt of an English piece. It says which of the Thai rules above
 * it does not touch, so the model is not pulled two ways.
 */
export const ENGLISH_RULES = [
  "ENGLISH PIECE — this overrides the rules above about Thai particles (ครับ/ค่ะ), Thai word choices, and the “คนไทย” line for imagePrompt. Every other rule above still applies.",
  "- Every word the reader sees — hook, body, closing, poster blocks, hashtags — is natural English for expats living in Thailand. Use short sentences and plain international English; many readers are not native speakers.",
  "- The Page speaks as “we”. Money is written as “THB 1,000”, with digits taken from the brief.",
  "- imagePrompt: the people are Western (European) expats living their life in Thailand (instead of Thai people).",
  "- Visa: never name a visa type and never promise approval; invite readers to message us to check their visa.",
].join("\n");
export const LENGTHS: { id: Length; label: string }[] = [
  { id: "30", label: "30 วินาที" },
  { id: "60", label: "60 วินาที" },
  { id: "180", label: "2–3 นาที" },
];

/**
 * What the piece is for, which decides how it ends. Without it every piece closed on
 * "ทักแชท", whatever it was meant to do.
 *
 * The comment and share goals are worded against Facebook's engagement-bait rule: a post that
 * asks for "comment YES" or "tag a friend" is shown to fewer people, so the model is told to
 * earn the reply rather than ask for it.
 */
export const GOALS = [
  {
    id: "chat",
    label: "ให้ทักแชท",
    line: "เป้าหมาย: ให้คนอ่านทักแชทมาถาม — closing บอกให้ชัดว่าทักมาแล้วได้อะไร เช่น คำนวณเบี้ยตามอายุให้ ดูว่าแบบนี้เหมาะไหม",
  },
  {
    id: "comment",
    label: "ให้คอมเมนต์",
    line: "เป้าหมาย: ให้คนอ่านคอมเมนต์ — closing เป็นคำถามจริงที่ตอบได้ง่ายจากชีวิตตัวเอง ห้ามเขียนแบบ “คอมเมนต์ว่าใช่” “พิมพ์ 1” หรือ “แท็กเพื่อน” (Facebook ลดการมองเห็นโพสต์แบบนั้น) ไม่ต้องชวนทักแชท",
  },
  {
    id: "share",
    label: "ให้คนเห็นเยอะ",
    line: "เป้าหมาย: ให้คนเห็นเยอะและอยากเก็บไว้หรือส่งต่อ — body ให้ความรู้ที่คนอ่านเอาไปใช้ได้เองก่อน ขายน้อย พูดถึงแบบประกันแค่ช่วงท้าย ห้ามเขียน “แชร์เลย” หรือ “แท็กเพื่อน” (Facebook ลดการมองเห็น)",
  },
] as const;

export type GoalId = (typeof GOALS)[number]["id"] | "";

/**
 * Niches a life-insurance page commonly speaks to, one tap each; the owner can type any other.
 * Each is a group with its own reason to buy, which is what makes a niche worth naming.
 */
export const NICHES = [
  "พ่อแม่ลูกเล็ก",
  "คนโสดวัยทำงาน",
  "ฟรีแลนซ์/เจ้าของกิจการ",
  "มนุษย์เงินเดือนมีประกันกลุ่ม",
  "ลูกที่ดูแลพ่อแม่",
  "วัยใกล้เกษียณ",
] as const;

/**
 * The readers an expat piece speaks to (owner, 2026-10-02), shown in place of NICHES when the
 * คอนเทนต์สำหรับ Expat tick is on. Thai for the staff who pick them, with the English name the
 * writer can use; each has its own reason to want iHealthy Ultra.
 */
export const EXPAT_NICHES = [
  "วัยเกษียณที่อยู่ไทยยาว (Retirees)",
  "พนักงานบริษัทต่างชาติ (Expat employees)",
  "ครอบครัวไทย-ต่างชาติ (Thai-foreign families)",
  "เจ้าของกิจการ/ฟรีแลนซ์ (Business owners & freelancers)",
  "ครูต่างชาติ (Teachers)",
  "คนที่เดินทางบ่อย (Frequent travelers)",
] as const;

/**
 * The reader kept when the tick changes: a chip from the other list does not cross over — a
 * Thai niche on an English piece, or an expat one on a Thai piece — and becomes ทุกคน; anything
 * the owner typed stays.
 */
export function readerFor(reader: string, expat: boolean): string {
  const other: readonly string[] = expat ? NICHES : EXPAT_NICHES;
  return other.includes(reader) ? "" : reader;
}

export const MAX_READER = 120;
export const MAX_FACT = 400;

/** What the owner can tell the round beyond its angle: who reads it, what it is for, what really happened. */
export interface Steer {
  /** who the piece talks to, in the owner's words: "แม่ลูกเล็ก วัย 30" */
  reader?: string;
  goal?: GoalId;
  /** "en": the post is written in English (ENGLISH_RULES); absent or "th" leaves every prompt as it was */
  lang?: Lang;
  /**
   * Something true the owner knows first-hand — a claim paid, a question a customer asked,
   * a piece of news. The one place a piece may tell a real story; see steerLines.
   */
  fact?: string;
}

/** The steer as lines for any prompt — planner, writer or ad matrix. Empty when nothing was given. */
export function steerLines(s: Steer): string {
  const reader = s.reader?.trim();
  const fact = s.fact?.trim();
  const goal = GOALS.find((g) => g.id === s.goal);
  return [
    reader ? `คนอ่านคือ: ${reader} — เลือกคำ ตัวอย่าง และปัญหาที่คนกลุ่มนี้เจอจริง (ห้ามทักคนอ่านตรงๆ ว่าเป็นคนกลุ่มนี้ ตามกฎ Facebook)` : "",
    goal ? goal.line : "",
    fact
      ? [
          "เรื่องจริงจากเจ้าของเพจ (ใช้เป็นแกนของเรื่องได้ เล่าเป็นเรื่องจริงได้ ไม่ต้องบอกว่าสมมติ):",
          `"""${fact}"""`,
          "- ใช้เฉพาะรายละเอียดที่เขียนไว้ ห้ามเติมชื่อ อายุ ตัวเลข อาการ หรือเหตุการณ์ที่ไม่มีในนี้ ตัวเลขในเรื่องนี้คัดลอกได้ตรงตัวเท่านั้น",
          "- ห้ามบอกว่าเงินหรือความคุ้มครองในเรื่องนี้มาจากแบบประกันที่กำลังเขียนถึง ถ้าเรื่องไม่ได้บอกไว้ชัด",
          "- ห้ามใส่ชื่อจริงหรือข้อมูลที่ทำให้รู้ว่าเป็นลูกค้าคนไหน",
        ].join("\n")
      : "",
  ].filter(Boolean).join("\n");
}

/**
 * คลิปวนลูป (owner, 2026-09-27): Reels and TikTok replay a clip on their own, so the ending is
 * left mid-sentence and finished by the opening line — the replay reads as one sentence and
 * the viewer stays for a second round. The invitation cannot close such a clip (a goodbye tells
 * the viewer it is over), so it moves to one short line in the middle — the owner's pick.
 * Read by every script writer: the plan's, รีวิวเคลม's and หาทีม's.
 */
export const LOOP_RULES = [
  "คลิปวนลูป (กฎนี้มาก่อนคำสั่งเรื่อง closing ด้านบน): คลิปจะเล่นวนซ้ำเอง ท้ายคลิปต้องต่อกลับไปที่ hook เนียนเป็นประโยคเดียวกัน",
  "- closing ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยมเหมือนเดิม แต่ประโยคสุดท้ายต้องพูดค้างไว้ไม่จบ แล้วอ่านต่อด้วย hook ได้พอดีทั้งความหมายและไวยากรณ์ เช่น “…และนั่นคือเหตุผลที่” แล้วต่อด้วย hook",
  "- ห้ามมีคำลาหรือคำชวนท้ายคลิป เช่น กดติดตาม ทักแชทเลย แล้วเจอกันใหม่ ขอบคุณที่ดู",
  "- ย้ายการชวน (ทักแชทหรือคอมเมนต์) ไปไว้กลางคลิป เป็นประโยคสั้นประโยคเดียวใน body ถ้ามี “เป้าหมาย” ให้ใช้กับประโยคชวนกลางคลิปนี้แทน closing",
  "- ท่าทางและข้อความขึ้นจอช่วงท้ายให้กลับไปเหมือนช่วงแรก ภาพจะได้ต่อกันตอนวน",
].join("\n");

/** what the planner is told when its hooks will close a คลิปวนลูป too */
export const LOOP_PLAN = "คลิปวนลูป: ท้ายคลิปจะพูดค้างไว้แล้ววนกลับมาที่ hook ดังนั้น hook ต้องอ่านต่อจากท้ายประโยคอื่นได้ ห้ามขึ้นต้นด้วยคำทักทายหรือคำเรียกคนดู";

export interface Ask extends Steer {
  brief: string;
  format: Format;
  angle: AngleId;
  /** the owner's own angle, used when `angle` is "custom" */
  custom: string;
  length: Length | null;
  /** a คลิปวนลูป: the closing runs back into the hook (scripts only) */
  loop?: boolean;
  /** the writing formula the owner picked (formula.ts): posts and scripts */
  formula?: Formula | null;
  /** one per piece, from the planner; the writer writes to them and does not change their hooks */
  plans: PiecePlan[];
}

/** The rules every writer here is held to — posts, scripts and ads alike. */
export const CORE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. ใช้เฉพาะข้อมูลในหัวข้อ “ข้อมูลผลิตภัณฑ์” ห้ามเพิ่มความคุ้มครอง เงื่อนไข หรือสิทธิประโยชน์ที่ไม่มีในนั้น",
  "2. ตัวเลขทุกตัว (เบี้ย ทุน อายุ เปอร์เซ็นต์ จำนวนโรค) ต้องคัดลอกจากข้อมูล (หรือจากเรื่องจริงที่เจ้าของเพจให้มา) ตรงตัว ห้ามคำนวณ ห้ามปัดเศษ ห้ามแปลงรายปีเป็นรายเดือน ห้ามประมาณ ถ้าไม่มีตัวเลขที่ต้องการ ให้เขียนโดยไม่ใส่ตัวเลข",
  "3. ห้ามคำโฆษณาเกินจริง เช่น การันตี รับประกันผลตอบแทน ดีที่สุด ถูกที่สุด คุ้มที่สุด อันดับ 1 ไม่มีความเสี่ยง ได้เงินคืนแน่นอน",
  "4. ห้ามเขียนขัดกับ “ข้อควรระวัง” และถ้าข้อควรระวังบอกว่าห้ามระบุเบี้ย ห้ามใส่ราคาเลย",
  "5. ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันอื่น",
  "6. ห้ามแต่งว่าเป็นเรื่องของลูกค้าจริงหรือรีวิวจริง ถ้าเล่าเป็นเรื่อง ให้เขียนชัดว่าเป็นสถานการณ์สมมติ เช่น “สมมติว่า…” ยกเว้นเรื่องจริงที่เจ้าของเพจให้มาเอง",
  "7. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "8. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
  "9. ถ้าพูดถึงตัวเลข ให้พูดแค่ทุนประกัน กับเบี้ยต่อเดือนหรือเบี้ยเฉลี่ยต่อวันเท่านั้น ห้ามพูดยอดเบี้ยรวมทั้งสัญญา เบี้ยสะสม หรือเบี้ยต่อปี และห้ามเอายอดเบี้ยรวมของระยะจ่ายต่างๆ มาเทียบกัน",
  "10. ความคุ้มครองหรือการจ่ายเบี้ยถึงอายุ 99 ให้เรียกว่า “ตลอดชีพ” ห้ามเขียน “99 ปี” หรือ “ถึงอายุ 99”",
  "",
  POLICY_RULES_TH,
].join("\n");

/** How the picture's words and the picture itself are asked for, wherever a piece has a poster. */
export const POSTER_RULES = [
  "- imagePrompt: คำบรรยายภาพประกอบเป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ ห้ามมีตัวหนังสือในภาพ",
  "- poster: ข้อความบนภาพที่คนเห็นก่อนอ่านข้อความ — สั้นกว่าข้อความมาก อ่านจบใน 2 วินาที",
  "  · headline (บังคับ) ไม่เกิน 60 ตัวอักษร คือใจความเดียวที่อยากให้จำ ไม่ต้องซ้ำประโยคเปิดคำต่อคำ",
  "  · badge (ไม่บังคับ) ป้ายเล็กไม่เกิน 20 ตัวอักษร เช่น ชื่อประเภทประกัน · sub (ไม่บังคับ) ไม่เกิน 90 ตัวอักษร · footer (ไม่บังคับ) ไม่เกิน 40 ตัวอักษร เช่น ชวนทักแชท",
  "  · ตัวเลขบนภาพต้องคัดลอกจากข้อมูลผลิตภัณฑ์ตรงตัว และกฎทุกข้อด้านบนใช้กับภาพด้วย",
  "  · layout เลือก top, center หรือ bottom ตามจังหวะของข้อความ",
  "  · theme เลือกโทนสีหนึ่งจากรายการนี้ให้เข้ากับอารมณ์ของชิ้น ห้ามกำหนดรหัสสีเอง (ถ้าเจ้าของเพจเลือกสีไว้เอง ระบบจะใช้สีนั้นแทน):",
  ...THEMES.map((t) => `    ${t} — ${THEME_MOOD[t]}`),
].join("\n");

export const POSTER_JSON = '"imagePrompt":"…","poster":{"layout":"bottom","theme":"navy","blocks":[{"kind":"badge","text":"…"},{"kind":"headline","text":"…"},{"kind":"sub","text":"…"},{"kind":"footer","text":"…"}]}';

const SYSTEM = [
  "คุณคือนักเขียนคอนเทนต์ให้ตัวแทนประกันชีวิตในประเทศไทย เขียนภาษาไทยแบบที่คนทั่วไปพูดกัน อ่านง่ายบนมือถือ อบอุ่น จริงใจ ไม่ขายแรง",
  "",
  CORE_RULES,
  "",
  "คุณจะได้รับแผนของแต่ละชิ้น (มุม + hook) มาแล้ว ให้เขียนเนื้อหาของทุกชิ้นตามแผน เรียงตามลำดับ",
  "ห้ามเปลี่ยน hook และห้ามพิมพ์ hook ซ้ำในเนื้อหา — hook จะถูกวางไว้หน้าเนื้อหาอยู่แล้ว",
  "ถ้า hook สัญญาว่าจะเล่า N ข้อ เนื้อหาต้องมีครบ N ข้อพอดี เรียงเลข 1, 2, 3…",
  "",
  "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้ (จำนวนชิ้นเท่ากับแผน):",
  `{"pieces":[{"body":"…","closing":"…","hashtags":["#…"],${POSTER_JSON}}]}`,
  "- body: เนื้อหาหลัก ต่อจาก hook ไม่รวมประโยคปิด ใช้ \\n ขึ้นบรรทัดใหม่",
  "- closing: ประโยคปิด 1–2 บรรทัด ตาม “เป้าหมาย” ถ้าบอกไว้ ถ้าไม่บอกให้ชวนทักแชทหรือคอมเมนต์",
  "- hashtags: 3–6 แท็กภาษาไทยหรืออังกฤษ",
  POSTER_RULES,
].join("\n");

function formatBrief(a: Ask): string {
  if (a.format === "post") {
    return [
      "งาน: โพสต์เฟซบุ๊ก",
      "- body 5–10 บรรทัดสั้นๆ เว้นบรรทัดให้อ่านง่าย ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
      "- เล่าปัญหาของคนอ่านก่อน แล้วค่อยพาไปที่แบบประกัน",
    ].join("\n");
  }
  const secs = a.length ?? "60";
  const label = secs === "180" ? "2–3 นาที" : `${secs} วินาที`;
  return [
    `งาน: สคริปต์พูดหน้ากล้อง ความยาวรวมประมาณ ${label}`,
    "- hook คือประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] body จึงเริ่มหลังจากนั้น",
    "- body แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด",
    "- ใส่ท่าทางในวงเล็บ เช่น (ชี้ไปที่กล้อง) และข้อความขึ้นจอเป็น {จอ: …} เฉพาะจุดสำคัญ",
    "- closing คือช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยมเช่นกัน",
    "- hashtags ใช้สำหรับแคปชันใต้คลิป",
    ...(a.loop ? [LOOP_RULES] : []),
  ].join("\n");
}

function angleLine(a: Ask): string {
  const text = angleText(a.angle, a.custom);
  return text ? `มุมที่อยากเล่า: ${text}` : "";
}

export function planLines(plans: PiecePlan[]): string {
  return [
    "แผนของแต่ละชิ้น:",
    ...plans.map((p, i) => [
      `ชิ้นที่ ${i + 1}\n  มุม: ${p.angle}\n  hook: ${p.hook}`,
      p.shareWhy ? `\n  เหตุผลที่คนจะแชร์: ${SHARE_WHY[p.shareWhy].say}` : "",
    ].join("")),
  ].join("\n");
}

export function buildMessages(a: Ask): ChatMessage[] {
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${a.brief}`,
    [formatBrief(a), formulaRules(a.formula ?? null, a.format, a.length, Boolean(a.loop)), angleLine(a), steerLines(a)].filter(Boolean).join("\n"),
    planLines(a.plans),
  ].join("\n\n");
  return [
    { role: "system", content: a.lang === "en" ? `${SYSTEM}\n\n${ENGLISH_RULES}` : SYSTEM },
    { role: "user", content: user },
  ];
}
