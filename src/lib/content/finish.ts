import { parseJsonReply } from "@/lib/ai/json-reply";
import { FOLD, type ContentOutput } from "./output";
import type { Format, Length } from "./prompt";

/**
 * สูตรอ่าน-ดูจนจบ (owner, 2026-10-01): the owner's two guides on being read and watched to the
 * end — the curiosity gap, how a phone is scanned, loops opened and closed, one person in one
 * scene, a reason to pass it on — put to work as rules for the writers when the owner picks it.
 *
 * Picked instead of สูตรคอนเทนต์โปร, never with it (formula.ts): the two overlap by half and
 * disagree on the hook. The rules that cannot be broken, the regulator's and Facebook's come
 * first, as for สูตรโปร. What the code can check afterwards is finish-check.ts's.
 * See docs/superpowers/specs/2026-10-01-finish-formula-design.md.
 */

export const FINISH_NAME = "สูตรอ่าน-ดูจนจบ";

/** two seconds of Thai, read or said; the guides give no figure, and สูตรโปร's 60 left no room for a detail */
export const FINISH_HOOK_MAX = 80;
export const MAX_LOOPS = 5;
/** a quote longer than this is a paragraph, not the words that open or close a loop */
const MAX_QUOTE = 200;

export type ShareWhy = "use" | "insider" | "voice";

/** The guide's three reasons a reader passes a piece on (Berger's practical value and social currency). */
export const SHARE_WHY: Record<ShareWhy, { label: string; say: string }> = {
  use: { label: "ของใช้ได้ทันที", say: "ของใช้ได้ทันที — ตัวเลข วิธีเช็ก หรือเช็กลิสต์ที่คนอ่านเซฟไว้ใช้เองได้" },
  insider: { label: "ความรู้วงใน", say: "ความรู้วงใน — สิ่งที่คนในวงการรู้แต่ลูกค้าไม่รู้ ต้องมาจากข้อมูลผลิตภัณฑ์เท่านั้น" },
  voice: { label: "พูดแทนความรู้สึก", say: "พูดแทนความรู้สึก — สิ่งที่ลูกค้าคิดอยู่แต่ไม่กล้าพูด" },
};

export function readShareWhy(v: unknown): ShareWhy | null {
  return v === "use" || v === "insider" || v === "voice" ? v : null;
}

export interface Loop {
  open: string;
  close: string;
}

/** what the picker lists when this formula is opened */
export const FINISH_PRINCIPLES: { name: string; what: string }[] = [
  { name: "ช่องว่างขนาดกลาง", what: "เปิดจากเรื่องที่คนอ่านรู้อยู่ครึ่งหนึ่ง แล้วเปิดปมตรงนั้น" },
  { name: "บรรทัดแรกเฉพาะเจาะจง", what: "รายละเอียดจริงแทนคำคุณศัพท์ ไม่เกริ่น ไม่โอ้อวด บอกชัดว่าจะได้อะไร" },
  { name: "อ่านแบบกวาดตาได้", what: "ย่อหน้าละไอเดียเดียว ขึ้นต้นด้วยคำที่มีเนื้อหา ไม่เกิน 4 บรรทัดบนมือถือ" },
  { name: "ภาษาง่าย", what: "ศัพท์เทคนิคมีคำแปลตามทันที" },
  { name: "ปมเปิด-ปิด", what: "เปิดปมอย่างน้อย 1 จุด และเฉลยครบทุกปม" },
  { name: "เรื่องเล่า", what: "หนึ่งคน หนึ่งฉาก — เรื่องจริงที่ให้มา หรือบอกชัดว่าสมมติ" },
  { name: "เหตุผลที่คนแชร์", what: "ของใช้ได้ทันที · ความรู้วงใน · พูดแทนความรู้สึก" },
  { name: "โครงเวลาคลิป", what: "คุณค่าชิ้นแรกใน 10 วิ ดึงกลับที่วิ 15 และ 30 เปลี่ยนภาพทุก 5–7 วิ ตัวเลขขึ้นจอ" },
  { name: "เช็กลิสต์ก่อนโพสต์", what: "ระบบตรวจให้ 8–10 ข้อ ที่เหลือติ๊กเองในหน้าแก้ชิ้นงาน" },
];

/** The hook, wherever one is written: the planner's, and the one-call writers' (รีวิวเคลม, หาทีม, ความรู้, เขียนเอง). */
export const FINISH_HOOK_RULES = [
  `${FINISH_NAME} — hook (กฎนี้แทนเรื่องความยาวของ hook ด้านบน แต่กฎที่ห้ามละเมิดและกฎ Facebook มาก่อนเสมอ):`,
  "- เปิดจากเรื่องที่คนอ่านรู้อยู่แล้วครึ่งหนึ่ง เช่น เบี้ยที่จ่ายอยู่ บรรทัดหนึ่งในกรมธรรม์ หรือความเชื่อที่มีอยู่ แล้วเปิดปมตรงนั้น ห้ามเปิดแบบตำรา เช่น “X คืออะไร” “ทำความเข้าใจ X”",
  "- ใช้รายละเอียดจริงหนึ่งอย่างแทนคำคุณศัพท์ มีตัวเลขได้ไม่เกิน 1 ตัว และต้องคัดลอกจากข้อมูลตรงตัว",
  "- ห้ามคำโอ้อวดที่คนอ่านจะค้านในใจทันทีว่า “ไม่จริงหรอก”",
  "- ห้ามคำทักทายหรือประโยคนำ เช่น สวัสดี วันนี้จะมา… หลายคนถามมาว่า…",
  "- บอกให้ชัดว่าอ่านหรือดูจบแล้วจะได้อะไร และต้องทำได้จริงจากข้อมูลที่มี",
  "- พูดถึงกลุ่มคนแบบบุคคลที่สาม ห้ามทักคนอ่านว่าเป็นคนกลุ่มนั้น (กฎ Facebook) และห้ามมีคำชวน เช่น ทักแชท คอมเมนต์ กดติดตาม",
  `- ยาวไม่เกิน ${FINISH_HOOK_MAX} ตัวอักษร`,
  `- เลือกเหตุผลที่คนจะแชร์ชิ้นนี้ 1 อย่าง (shareWhy): ${(Object.keys(SHARE_WHY) as ShareWhy[]).map((k) => `${k} = ${SHARE_WHY[k].say}`).join(" · ")} — ถ้าเป้าหมายคือให้ทักแชท ก็ยังเลือก แต่เป็นเรื่องรองของชิ้น`,
].join("\n");

const HEAD = [
  `${FINISH_NAME} (เจ้าของเพจเลือกใช้ กฎที่ห้ามละเมิด กฎ คปภ. และกฎ Facebook มาก่อนเสมอ):`,
  "- ชื่อเทคนิคด้านล่าง (open loop, pattern interrupt ฯลฯ) เป็นคำสั่งให้คุณ ห้ามเขียนชื่อเทคนิคลงในชิ้นงาน",
].join("\n");

const SHARED = [
  "- ย่อหน้าหนึ่งมีไอเดียเดียว ขึ้นต้นย่อหน้า bullet และหัวข้อด้วยคำที่มีเนื้อหา (คนกวาดตาอ่านแค่สองคำแรก) ห้ามขึ้นต้นด้วย “เราขอแนะนำว่า” “ซึ่ง” “ทั้งนี้” “อย่างไรก็ตาม”",
  "- ศัพท์เทคนิคทุกคำต้องมีคำแปลตามทันที ในวงเล็บหรือประโยคถัดไป",
  "- เปิดปมค้างไว้อย่างน้อย 1 จุด เช่น “เดี๋ยวบอกว่าข้อไหนพลาดบ่อยสุด” และต้องเฉลยทุกปมก่อนจบ ประโยคท้ายย่อหน้าต้องพาไปย่อหน้าถัดไป",
  "- ถ้าเล่าเป็นเรื่อง: หนึ่งคน หนึ่งฉาก ปัญหาที่จับต้องได้ เล่าตามลำดับเวลา ใช้เรื่องจริงที่เจ้าของเพจให้มา หรือเขียนบอกชัดว่าสมมติ ห้ามตั้งชื่อหรืออายุให้ตัวละครที่ไม่มีในเรื่องจริง",
  "- ทำให้เหตุผลที่คนจะแชร์ (shareWhy) ของชิ้นนี้เกิดขึ้นจริงในเนื้อหา ถ้าเป้าหมายคือให้คนเห็นเยอะ ให้ปิดด้วยสิ่งที่คนอ่านเอาไปทำต่อเองได้โดยไม่ต้องทักมา",
  "- ห้ามใช้ความกลัวเป็นตัวขับหลัก สิ่งที่ hook สัญญาต้องได้ครบในเนื้อหา",
];

function jsonLines(oneCall: boolean): string[] {
  return [
    `- ใน JSON ของชิ้นงาน เพิ่มช่อง "loops":[{"open":"…","close":"…"}] — open คือข้อความที่เปิดปม close คือข้อความที่เฉลย คัดลอกจากชิ้นงานตรงตัวทุกตัวอักษร สั้นที่สุดที่ยังชัด ไม่เกิน ${MAX_LOOPS} ปม`,
    ...(oneCall ? ['- และเพิ่มช่อง "shareWhy" เป็น "use", "insider" หรือ "voice" ตามที่เลือก'] : []),
  ];
}

function timing(length: Length, loop: boolean): string {
  const end = loop ? "เหตุผลที่ควรเซฟหรือแชร์ไปอยู่กลางคลิป" : "ปิดด้วยเหตุผลที่ควรเซฟหรือแชร์";
  if (length === "30") {
    return `- โครงเวลา: [0–2 วิ] hook → ภายใน 8 วิ ให้คำตอบทันที ไม่ยืด → ขยายด้วยตัวอย่าง 1 เรื่อง → สรุปเป็นประโยคเดียวที่จำง่าย → ${end}`;
  }
  const middle = length === "180" ? "มีประโยคดึงความสนใจกลับทุกราว 30 วินาที" : "มีประโยคดึงความสนใจกลับที่ราววินาที 15 และ 30";
  return `- โครงเวลา: [0–3 วิ] hook → ขยายความและเปิดปม → ส่งคุณค่าชิ้นแรกภายใน 10 วิ → เคสตามกฎเรื่องเล่า → ${middle} → เฉลยปม → ${end}`;
}

/**
 * The rest of the guides, for the one writing the body. `oneCall`: the call writes its own
 * hook and has no planner, so it also names the reason to share.
 */
export function finishRules(format: Format, length: Length | null = null, loop = false, oneCall = false): string {
  if (format === "ad") return "";
  if (format === "post") {
    return [
      HEAD,
      ...SHARED,
      `- พีระมิดหัวกลับ: ข้อสรุปต้องอยู่ใน hook กับต้น body ก่อน “ดูเพิ่มเติม” (ราว ${FOLD} ตัวอักษรแรก)`,
      "- ย่อหน้ายาวไม่เกิน 4 บรรทัดบนมือถือ ช่วงข้อความระหว่างช่องว่างไม่เกิน 2 บรรทัด ใช้ bullet แทนย่อหน้ายาว",
      ...jsonLines(oneCall),
    ].join("\n");
  }
  return [
    HEAD,
    ...SHARED,
    timing(length ?? "60", loop),
    "- เปลี่ยนภาพทุก 5–7 วินาที (ขนาดภาพ มุมกล้อง ภาพแทรก ข้อความขึ้นจอ) เขียนในวงเล็บ เช่น (ตัดเป็นภาพใกล้)",
    "- ตัวเลขทุกตัวที่พูดต้องขึ้นจอด้วยเป็น {จอ: …} ในช่วงเวลาเดียวกัน เพราะคนดูจำนวนมากปิดเสียง",
    "- หนึ่งคลิป หนึ่งประเด็น ไม่มีช่วงเงียบ ไม่มีคำเกริ่น",
    ...(loop ? ["- คลิปวนลูป: กฎการปิดท้ายของคลิปวนลูปมาก่อน ย้ายเหตุผลที่ควรเซฟหรือแชร์ไปไว้กลางคลิป เป็นประโยคสั้นประโยคเดียว"] : []),
    ...jsonLines(oneCall),
  ].join("\n");
}

/** the words a loop is looked for in: the hook, the body and the closing, in that order */
export function loopText(out: Pick<ContentOutput, "hooks" | "body" | "closing">): string {
  return [out.hooks[0] ?? "", out.body, out.closing].join("\n");
}

/**
 * The loops a writer reported, each kept only if both quotes are in `text` and it closes after
 * it opens — the rule parseProof keeps: a quote that is not there cannot be checked later.
 */
export function parseLoops(raw: unknown, text: string): Loop[] {
  if (!Array.isArray(raw)) return [];
  const out: Loop[] = [];
  for (const l of raw) {
    const r = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    const open = typeof r.open === "string" ? r.open.trim() : "";
    const close = typeof r.close === "string" ? r.close.trim() : "";
    if (!open || !close || open.length > MAX_QUOTE || close.length > MAX_QUOTE) continue;
    const at = text.indexOf(open);
    if (at < 0 || text.indexOf(close, at + open.length) < 0) continue;
    out.push({ open, close });
  }
  return out.slice(0, MAX_LOOPS);
}

/**
 * A written piece marked as สูตรอ่าน-ดูจนจบ's, with what its writer reported. A planned writer
 * answers {pieces:[…]} and the planner chose the reason, which wins; a one-call writer answers
 * the piece itself. What cannot be read is left off — the card then asks the agent to look.
 */
export function withFinish(output: ContentOutput, reply: string, planned: ShareWhy | null = null): ContentOutput {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  const first = raw && Array.isArray(raw.pieces) ? raw.pieces[0] : raw;
  const src = (first && typeof first === "object" ? first : {}) as Record<string, unknown>;
  const loops = parseLoops(src.loops, loopText(output));
  const shareWhy = planned ?? readShareWhy(src.shareWhy);
  return { ...output, formula: "finish", ...(shareWhy ? { shareWhy } : {}), ...(loops.length ? { loops } : {}) };
}
