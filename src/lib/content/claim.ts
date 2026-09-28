import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/client";
import { DISCLAIMER, type ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { AD_LIMITS } from "./ads";
import { LOOP_RULES, steerLines, type Format, type Length } from "./prompt";
import { PRO_HOOK_RULES, proRules } from "./pro";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * รีวิวเคลม (owner, 2026-09-25): the owner's claim papers read by a model, and a post and a
 * poster written from what was read. See docs/superpowers/specs/2026-09-25-claim-review-design.md.
 *
 * Two calls. The first reads up to six photographs and returns the claim's facts and, per
 * photograph, boxes around whatever names someone; the page blacks the boxes out and the owner
 * checks every one before a photograph may go on a poster. The second writes a piece from the
 * facts alone — it never sees a photograph, so it cannot copy a name off one.
 *
 * Browser-safe: the page builds its form from these types, and nothing here calls a model.
 */

/** the pieces' plan_href: a claim post belongs to no plan (owner: tell the claim, sell nothing) */
export const CLAIM_HREF = "claim-review";
export const CLAIM_NAME = "รีวิวเคลม";

export const MAX_DOCS = 6;
/** what a photograph is resized to before it is sent: enough to read a bill, small enough to post */
export const DOC_MAX_SIDE = 1600;

export const CLAIM_KINDS = [
  { id: "ipd", label: "นอนโรงพยาบาล" },
  { id: "opd", label: "ผู้ป่วยนอก (OPD)" },
  { id: "ci", label: "โรคร้ายแรง" },
  { id: "accident", label: "อุบัติเหตุ" },
  { id: "other", label: "อื่นๆ" },
] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number]["id"];

export const DOC_KINDS = [
  { id: "approval", label: "หนังสืออนุมัติ" },
  { id: "bill", label: "บิลโรงพยาบาล" },
  { id: "certificate", label: "ใบรับรองแพทย์" },
  { id: "chat", label: "แชท/สลิป" },
  { id: "other", label: "อื่นๆ" },
] as const;
export type DocKind = (typeof DOC_KINDS)[number]["id"];

/** What the post may say about the claim. Every figure is a string as the paper prints it. */
export interface ClaimFacts {
  kind: ClaimKind;
  /** the illness or injury in everyday words: "ไข้เลือดออก" */
  illness: string;
  nights: string;
  /** the hospital's whole bill */
  billTotal: string;
  /** what the insurer paid */
  paid: string;
  /** what the customer paid themselves */
  selfPaid: string;
  /** days from sending the claim to its approval */
  daysToApprove: string;
  /** "ผู้หญิง วัย 40+" — never a name */
  who: string;
  /** one line the owner adds: how the customer felt, what they said */
  note: string;
}

export const FACT_LIMIT: Record<Exclude<keyof ClaimFacts, "kind">, number> = {
  illness: 60, nights: 6, billTotal: 16, paid: 16, selfPaid: 16, daysToApprove: 6, who: 40, note: 200,
};

/** A black bar on a photograph, as fractions of its width and height from the top left. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DocRead {
  kind: DocKind;
  boxes: Box[];
}

export interface ClaimRead {
  facts: ClaimFacts;
  docs: DocRead[];
}

/* -------------------------------- privacy -------------------------------- */

/**
 * Nine or more digits in a row, spaces and dashes allowed between: an ID card, a phone, a
 * policy, an account. No figure a claim post needs is that long — a bill of ฿1,250,000.00 is
 * written with commas and stops at seven digits before them.
 */
const LONG_NUMBER = /[\d๐-๙](?:[\s-]?[\d๐-๙]){8,}/g;
/** a titled name: นาย/นาง/นางสาว/ด.ช./ด.ญ. and the word after it */
const TITLED_NAME = /(?:นางสาว|นาง|นาย|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|น\.ส\.)\s*[฀-๿]{2,}(?:\s+[฀-๿]{2,})?/g;
/**
 * คุณ and the name written onto it (คุณสมศรี มีสุข). Not the family or the doctor, who name
 * nobody, nor the words that begin with คุณ (คุณภาพ, คุณสมบัติ, คุณค่า…); a คุณ set apart by a
 * space is the pronoun, and is left.
 */
const KHUN_NAME = /คุณ(?!แม่|พ่อ|ตา|ยาย|ปู่|ย่า|ลุง|ป้า|น้า|หมอ|พยาบาล|ลูกค้า|ภาพ|สมบัติ|ค่า|ประโยชน์|ธรรม|วุฒิ|ความดี)[฀-๿]{2,}(?:\s+[฀-๿]{2,})?/g;
/** Mr/Mrs/Ms/Miss and the capitalised words after it */
const ENGLISH_NAME = /\b(?:Mrs|Mr|Ms|Miss)\.?\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?/g;

/** A line with anything that could name a person taken out. Runs on every fact, the model's and the owner's. */
export function scrub(text: string): string {
  return text.replace(LONG_NUMBER, "").replace(TITLED_NAME, "").replace(KHUN_NAME, "").replace(ENGLISH_NAME, "")
    .replace(/\s{2,}/g, " ").trim();
}

/** A figure as a post would print it: digits and commas, a trailing .00 dropped; anything else is not a figure. */
export function cleanAmount(v: unknown, max = 16): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  const t = String(v).replace(/[^\d.,]/g, "").replace(/\.0+$/, "").replace(/^[.,]+|[.,]+$/g, "");
  return /\d/.test(t) ? t.slice(0, max) : "";
}

/** Facts from anywhere — the model's reply, the owner's form — made safe to write from. */
export function cleanFacts(input: unknown): ClaimFacts {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const words = (k: keyof typeof FACT_LIMIT) => (typeof r[k] === "string" ? scrub(r[k] as string).slice(0, FACT_LIMIT[k]) : "");
  const amount = (k: keyof typeof FACT_LIMIT) => cleanAmount(r[k], FACT_LIMIT[k]);
  return {
    kind: CLAIM_KINDS.some((k) => k.id === r.kind) ? (r.kind as ClaimKind) : "other",
    illness: words("illness"),
    nights: amount("nights"),
    billTotal: amount("billTotal"),
    paid: amount("paid"),
    selfPaid: amount("selfPaid"),
    daysToApprove: amount("daysToApprove"),
    who: words("who"),
    note: words("note"),
  };
}

/** The facts as the lines the writer is given — and the yardstick every number in the piece is checked against. */
export function factsBlock(f: ClaimFacts): string {
  const kind = CLAIM_KINDS.find((k) => k.id === f.kind)?.label ?? "";
  return [
    `ประเภทการเคลม: ${kind}`,
    f.illness && `โรค/อาการ: ${f.illness}`,
    f.nights && `นอนโรงพยาบาล: ${f.nights} คืน`,
    f.billTotal && `ค่ารักษาทั้งหมด: ${f.billTotal} บาท`,
    f.paid && `บริษัทประกันจ่าย: ${f.paid} บาท`,
    f.selfPaid && `ลูกค้าจ่ายเอง: ${f.selfPaid} บาท`,
    f.daysToApprove && `ยื่นเคลมถึงอนุมัติ: ${f.daysToApprove} วัน`,
    f.who && `ผู้เอาประกัน: ${f.who}`,
    f.note && `เจ้าของเพจเล่าเพิ่ม: ${f.note}`,
  ].filter(Boolean).join("\n");
}

/* -------------------------------- reading -------------------------------- */

const READ_SYSTEM = [
  "คุณอ่านเอกสารเคลมประกันชีวิต/สุขภาพของไทย (หนังสืออนุมัติจ่ายสินไหม บิลโรงพยาบาล ใบรับรองแพทย์ แคปแชท สลิปโอนเงิน)",
  "งานมี 2 อย่าง:",
  "1. สรุปข้อเท็จจริงของการเคลมนี้ (รวมจากทุกรูป) — ห้ามใส่ชื่อคน ชื่อโรงพยาบาล เลขใดๆ ที่ระบุตัวตน หรือวันที่",
  "2. หาตำแหน่งทุกจุดในแต่ละรูปที่ระบุตัวบุคคลได้ เพื่อถมดำ: ชื่อ-นามสกุล (ทุกคน รวมผู้รับผลประโยชน์และตัวแทน), เลขบัตรประชาชน, เลขกรมธรรม์, เลขที่เคลม/เลขที่สินไหม, HN, AN, ที่อยู่, เบอร์โทร, อีเมล, วันเกิด, เลขบัญชีธนาคาร, ชื่อแพทย์, ลายเซ็น, รูปหน้าคน, QR code, บาร์โค้ด, ชื่อไลน์/เฟซบุ๊กและรูปโปรไฟล์ในแชท",
  "   หาให้ครบทุกจุด ถ้าไม่แน่ใจให้ใส่กรอบไว้ก่อน กรอบใหญ่กว่าข้อความเล็กน้อยได้ ห้ามใส่กรอบทับยอดเงิน",
  "   กรอบเป็น box_2d = [ymin, xmin, ymax, xmax] สเกล 0–1000 ของความสูงและความกว้างรูป",
  "",
  "ตอบเป็น JSON อย่างเดียว ตามรูปแบบนี้:",
  '{"facts":{"kind":"ipd|opd|ci|accident|other","illness":"โรคหรืออาการเป็นคำง่ายๆ","nights":"จำนวนคืนที่นอน","billTotal":"ค่ารักษาทั้งหมด","paid":"ยอดที่บริษัทประกันจ่าย","selfPaid":"ส่วนที่ลูกค้าจ่ายเอง","daysToApprove":"จำนวนวันจากยื่นเคลมถึงอนุมัติ","who":"เพศและช่วงอายุ เช่น ผู้หญิง วัย 40+"},',
  '"docs":[{"kind":"approval|bill|certificate|chat|other","boxes":[{"label":"ชื่อผู้เอาประกัน","box_2d":[0,0,0,0]}]}]}',
  "- docs เรียงตามลำดับรูปที่ได้รับ จำนวนเท่ากับจำนวนรูปพอดี",
  "- ตัวเลขเงินคัดลอกตามที่พิมพ์ในเอกสาร ถ้าไม่มีข้อมูลช่องไหนให้ใส่ \"\"",
  "- paid คือยอดที่บริษัทจ่าย/อนุมัติ เช่น “จำนวนเงินที่บริษัทจ่าย” “ยอดอนุมัติ” “ยอดอนุมัติสินไหม” · billTotal คือค่ารักษาทั้งหมด/ยอดที่ยื่น เช่น “ค่ารักษาพยาบาลทั้งหมด” “ยอดเรียกร้อง” “ยอดเรียกร้องสินไหม” · selfPaid คือส่วนที่ลูกค้าจ่ายเอง/ส่วนเกิน",
  "- ถ้าเอกสารเป็นตารางประวัติการเรียกร้องหลายรายการ ให้เลือกรายการเดียว: รายการที่สถานะอนุมัติแล้วและยอดอนุมัติสูงสุด แล้วกรอกทุกช่องจากรายการนั้น ห้ามรวมยอดหลายรายการ",
  "- nights นับจากวันเข้ารักษาถึงวันออกจากโรงพยาบาลได้ ถ้าเอกสารระบุทั้งสองวันของรายการเดียวกัน",
  "- daysToApprove คิดได้เฉพาะเมื่อเห็นทั้งวันยื่นและวันอนุมัติ ไม่อย่างนั้นใส่ \"\"",
].join("\n");

export function readMessages(count: number): ChatMessage[] {
  return [
    { role: "system", content: READ_SYSTEM },
    { role: "user", content: `เอกสารเคลม ${count} รูป เรียงตามลำดับ` },
  ];
}

/** a bar a little larger than the model's box: a letter's tail left showing is a name read */
const PAD = 0.006;
const unit = (n: number) => Math.min(1, Math.max(0, n));

/** One box_2d as a Box, or null when it is not four numbers that make a box. */
export function toBox(b: unknown): Box | null {
  if (!Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [y0, x0, y1, x1] = (b as number[]).map((n) => n / 1000);
  const x = unit(Math.min(x0, x1) - PAD);
  const y = unit(Math.min(y0, y1) - PAD);
  const w = unit(Math.max(x0, x1) + PAD) - x;
  const h = unit(Math.max(y0, y1) + PAD) - y;
  return w > 0.002 && h > 0.002 ? { x, y, w, h } : null;
}

/**
 * The reply as facts and one DocRead per photograph, or null when it is not JSON at all.
 * A photograph the reply left out gets no boxes — the owner sees it bare and must bar it
 * by hand before ticking it; nothing is assumed safe.
 */
export function parseRead(reply: string, count: number): ClaimRead | null {
  const raw = parseJsonReply<{ facts?: unknown; docs?: unknown }>(reply);
  if (!raw) return null;
  const docs = Array.isArray(raw.docs) ? raw.docs : [];
  return {
    facts: cleanFacts(raw.facts),
    docs: Array.from({ length: count }, (_, i): DocRead => {
      const d = (docs[i] && typeof docs[i] === "object" ? docs[i] : {}) as Record<string, unknown>;
      const boxes = (Array.isArray(d.boxes) ? d.boxes : []).flatMap((b) => {
        const box = toBox(b && typeof b === "object" ? (b as Record<string, unknown>).box_2d : null);
        return box ? [box] : [];
      });
      return { kind: DOC_KINDS.some((k) => k.id === d.kind) ? (d.kind as DocKind) : "other", boxes };
    }),
  };
}

/* -------------------------------- writing -------------------------------- */

/**
 * The ways a claim can be told. Left to the AI, a round takes the first three in turn, so a
 * round of three tells the claim three ways without a planner; picked by the owner, every
 * piece takes that one and they differ by how they open (OPENERS).
 */
export const CLAIM_ANGLES = [
  { id: "amount", label: "ยอดเงินชัดๆ", say: "เปิดด้วยตัวเลข: ค่ารักษาเท่าไร ประกันจ่ายเท่าไร ลูกค้าจ่ายเองเท่าไร แล้วค่อยเล่าว่าเกิดอะไรขึ้น" },
  { id: "story", label: "เล่าเหตุการณ์", say: "เล่าเป็นเรื่องตามลำดับเวลา ตั้งแต่เริ่มป่วยจนได้รับเงิน ให้เห็นความรู้สึกของลูกค้าและครอบครัว" },
  { id: "lesson", label: "ข้อคิด", say: "เล่าเคสนี้สั้นๆ แล้วสรุปข้อคิดที่คนอ่านเอาไปใช้ได้ เช่น ทำไมควรมีประกันสุขภาพก่อนป่วย เตรียมเอกสารเคลมอย่างไร" },
  { id: "without", label: "ถ้าไม่มีประกัน", say: "ชวนคนอ่านนึกภาพว่าถ้าไม่มีประกัน ค่ารักษาทั้งก้อนต้องจ่ายเอง เทียบกับที่ลูกค้าจ่ายจริง ใช้เฉพาะตัวเลขในข้อมูล ห้ามคำนวณเพิ่ม" },
  { id: "speed", label: "เคลมง่าย ได้เงินไว", say: "เน้นขั้นตอนการเคลมที่ง่ายและระยะเวลาที่ได้รับอนุมัติ (ถ้าข้อมูลมีจำนวนวัน) และตัวแทนช่วยดูแลเอกสารให้" },
] as const;
export type ClaimAngleId = (typeof CLAIM_ANGLES)[number]["id"];
/** a round's pieces at most; with ให้ AI เลือก they take the first this many angles in turn */
export const MAX_CLAIM_PIECES = 3;
export const MAX_CLAIM_CUSTOM = 120;

/** how pieces told from one picked angle open, so a round of three is not three of the same post */
const OPENERS = [
  "เปิดด้วยตัวเลขหรือข้อเท็จจริงที่หนักแน่นที่สุด",
  "เปิดด้วยคำถามที่คนอ่านต้องหยุดคิด",
  "เปิดด้วยความรู้สึกหรือเหตุการณ์ในวันที่ลูกค้าป่วย",
];

/** What the owner told the round: the angle (or their own words for one) and who reads it. */
export interface ClaimSteer {
  /** an angle id, "custom" for the owner's own, or "" to leave it to the AI */
  angle?: string;
  custom?: string;
  reader?: string;
}

/** Each piece's angle line, in order: the AI's turn-taking, or the owner's one angle opened three ways. */
export function claimAngleLines(steer: ClaimSteer, count: number): { label: string; say: string }[] {
  const custom = (steer.custom ?? "").trim().slice(0, MAX_CLAIM_CUSTOM);
  const picked = steer.angle === "custom" && custom
    ? { label: custom, say: custom }
    : CLAIM_ANGLES.find((a) => a.id === steer.angle);
  return Array.from({ length: count }, (_, i) => {
    if (!picked) return CLAIM_ANGLES[i % MAX_CLAIM_PIECES];
    return count > 1 ? { label: picked.label, say: `${picked.say}\n${OPENERS[i % OPENERS.length]}` } : picked;
  });
}

const WRITE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. ใช้เฉพาะข้อเท็จจริงใน “ข้อมูลการเคลม” ห้ามเติมอาการ เหตุการณ์ ความรู้สึก หรือรายละเอียดที่ไม่มีในนั้น",
  "2. ตัวเลขทุกตัวต้องคัดลอกจากข้อมูลการเคลมตรงตัว ห้ามคำนวณ ห้ามปัดเศษ ห้ามบวกลบ ถ้าไม่มีตัวเลขที่ต้องการให้เขียนโดยไม่ใส่ตัวเลข",
  "3. ห้ามใส่ชื่อคน ชื่อโรงพยาบาล ชื่อแพทย์ วันที่ หรือข้อมูลใดที่ทำให้รู้ว่าเป็นลูกค้าคนไหน เรียกว่า “ลูกค้าของเรา” ได้",
  "4. ห้ามบอกชื่อแบบประกันหรือแนะนำแบบประกันใดๆ งานนี้เล่าการเคลมอย่างเดียว",
  "5. ห้ามคำโฆษณาเกินจริง เช่น การันตี เคลมได้ทุกกรณี จ่ายเต็มแน่นอน ดีที่สุด เร็วที่สุด อันดับ 1",
  "6. ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันอื่น",
  "7. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "8. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
  "",
  POLICY_RULES_TH,
].join("\n");

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังหลังรูปเอกสาร เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ บรรยากาศโล่งใจ อบอุ่น เช่น ครอบครัวยิ้มอยู่ด้วยกันที่บ้าน หรือห้องพักฟื้นที่สว่างสงบ ห้ามมีตัวหนังสือ ห้ามมีเอกสาร ห้ามภาพคนป่วยหนักหรือเลือด",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว เช่น “นอนโรงพยาบาล 3 คืน ไม่ต้องสำรองจ่าย” ตัวเลขต้องมาจากข้อมูลตรงตัว ไม่ต้องใส่ยอดที่ประกันจ่าย เพราะระบบวางยอดนี้ไว้ในแถบเหลืองใต้พาดหัวให้แล้ว",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร เช่น ชวนทักแชท",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';

const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

/** The writer's brief for one kind of work — the rules are the same for all three. */
export function claimSystem(format: Format, length: Length | null = null, loop = false, pro = false): string {
  const task: Record<Format, string[]> = {
    post: [
      "งาน: โพสต์เฟซบุ๊กรีวิวการเคลมจริงของลูกค้า",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
      "- hook: ประโยคเปิด 1 บรรทัด หยุดนิ้วคนเลื่อนฟีด",
      "- body: 5–10 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
      "- closing: 1–2 บรรทัด ชวนทักแชทถามเรื่องการเคลมหรือการเตรียมตัว",
      "- hashtags: 3–6 แท็ก เช่น #รีวิวเคลม",
      ...POSTER_LINES,
    ],
    script: [
      `งาน: สคริปต์พูดหน้ากล้อง เล่ารีวิวการเคลมจริงของลูกค้า ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
      "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] ต้องหยุดคนดูให้ได้",
      "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ท่าทางในวงเล็บ เช่น (ชูเอกสารให้กล้องเห็น) และข้อความขึ้นจอเป็น {จอ: …} เฉพาะจุดสำคัญ ใช้ \\n ขึ้นบรรทัดใหม่",
      "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม ชวนทักแชทถามเรื่องการเคลม",
      "- hashtags: 3–6 แท็ก สำหรับแคปชันใต้คลิป",
    ],
    ad: [
      "งาน: โฆษณา Facebook จากรีวิวการเคลมจริง หยุดสายตาในบรรทัดแรก แล้วชวนให้ทักแชท ไม่ขายด้วยความกลัว",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…",${POSTER_SHAPE}}`,
      `- hook คือ headline: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.headline} ตัวอักษร (แสดงใต้ภาพ ข้างปุ่ม) ต้องจบในตัว`,
      `- body คือ primary text: ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว ทั้งหมดไม่เกิน 400 ตัวอักษร ปิดท้ายด้วยการชวนทักแชท`,
      `- closing คือ description: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.description} ตัวอักษร ถ้ามีตัวเลขต้องมีหน่วยครบ`,
      ...POSTER_LINES,
    ],
  };
  return [
    "คุณคือนักเขียนคอนเทนต์ให้ตัวแทนประกันชีวิตในประเทศไทย ภาษาไทยแบบที่คนทั่วไปพูดกัน อ่านง่ายบนมือถือ อบอุ่น จริงใจ ไม่ขายแรง",
    "",
    WRITE_RULES,
    "",
    ...task[format],
    // a คลิปวนลูป's ending runs back into its hook (prompt.ts)
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    // สูตรคอนเทนต์โปร: this call writes the hook too, so it takes the hook's rules as well (pro.ts)
    ...(pro && format !== "ad" ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
  ].join("\n");
}

export function claimMessages(
  facts: ClaimFacts, angle: { say: string }, reader = "", format: Format = "post", length: Length | null = null, loop = false, pro = false,
): ChatMessage[] {
  const steer = steerLines({ reader: reader.trim() });
  return [
    { role: "system", content: claimSystem(format, length, loop, pro) },
    {
      role: "user",
      content: [
        `ข้อมูลการเคลม (เรื่องจริง ลูกค้ายินยอมให้เล่าแล้ว):\n${factsBlock(facts)}`,
        `มุมของโพสต์นี้: ${angle.say}`,
        steer,
      ].filter(Boolean).join("\n\n"),
    },
  ];
}

/** the line under the headline, on the highlighter: the amount the insurer paid */
export function amountLine(f: ClaimFacts): string {
  return f.paid ? `ประกันจ่ายให้ ${f.paid} บาท` : "";
}

/**
 * The claim poster: a fixed badge, the writer's headline, the paid amount (from the facts,
 * never the writer), a footer. The document photograph is put on it once the piece is saved.
 */
export function claimPoster(raw: unknown, facts: ClaimFacts, hook: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    { kind: "badge", text: "รีวิวเคลมจริง" },
    { kind: "headline", text: headline },
    ...(amountLine(facts) ? [{ kind: "sub" as const, text: amountLine(facts) }] : []),
    { kind: "footer", text: footer || "ทักแชทถามเรื่องเคลมได้เลย" },
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "top", theme, blocks })!;
}

/** One claim piece from a reply, or null when the reply has no hook or body. */
export function parseClaimPiece(reply: string, facts: ClaimFacts, angleLabel: string, format: Format = "post"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  const angle = `${CLAIM_NAME} · ${angleLabel}`;
  return {
    hooks: [format === "ad" ? hook.slice(0, 120) : hook],
    angle,
    body: format === "ad" ? body.slice(0, 1200) : body,
    closing: format === "ad" ? text(raw.closing).slice(0, 120) : text(raw.closing),
    // an ad's fields are Ads Manager's; tags are a post's and a clip's
    hashtags: format === "ad" ? [] : [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: DISCLAIMER,
    // a script is spoken, and has no poster; the paper goes on a post's or an ad's
    ...(format === "script" ? {} : { poster: claimPoster(raw.poster, facts, hook) }),
    ...(format === "ad" ? { ad: { angle: angleLabel, tone: CLAIM_NAME } } : {}),
    // the facts stay with the piece: an edit is checked against them again, as a story's are
    fact: factsBlock(facts),
  };
}
