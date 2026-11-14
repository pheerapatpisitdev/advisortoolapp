import { chat } from "@/lib/ai/client";
import { parseJsonReply } from "@/lib/ai/json-reply";
import { SHARE_PLANS, type SharePlan } from "./plans";
import { shareSample } from "./samples";
import { DRAFT_MAX, slotNames, systemNote, TEMPLATE_MAX } from "./template";

/**
 * A member's draft arranged into a template (owner, 2026-11-14, ง on mockup
 * https://claude.ai/artifact/6v1b98UZnP7jpCa6AL6opV): the AI tidies the wording, puts a named
 * slot wherever the draft states a figure the system knows, and takes out what the contract does
 * not promise (the owner chose that a member cannot put those back).
 *
 * The AI never writes a plan's figure: it only names the slot, and the page fills it per quote.
 */
export interface Arranged {
  template: string;
  /** what was taken out of the draft, and why, in Thai for the member */
  removed: { text: string; why: string }[];
  /** figures the member wrote that the system has no slot for — sent as typed, not vouched for */
  own: string[];
}

interface Reply { template?: unknown; removed?: unknown; own?: unknown }

function prompt(plan: SharePlan, draft: string, complaint?: string): string {
  const def = SHARE_PLANS[plan];
  const sample = shareSample(plan);
  const slots = def.slots.map((s) => `- {${s.name}} : ${s.what}` + (sample.slots[s.name] ? ` (ตัวอย่าง: ${sample.slots[s.name]})` : "")).join("\n");
  const blocks = def.blocks.map((b) => `- {${b.name}} : ${b.what}`).join("\n");
  return [
    `คุณช่วยตัวแทนประกันจัดข้อความที่จะส่งให้ลูกค้า สำหรับแบบประกัน "${def.name}"`,
    "ตัวแทนเขียนร่างมาตามสไตล์ของตัวเอง หน้าที่ของคุณคือแปลงร่างเป็น \"แม่แบบ\" ที่ระบบจะเติมตัวเลขจริงให้ทุกครั้งที่ส่ง",
    "",
    "ช่องตัวเลขที่ใช้ได้ (เขียนชื่อช่องในวงเล็บปีกกาตามนี้ทุกตัวอักษร):",
    slots,
    "",
    "ช่องแบบหลายบรรทัด (ต้องอยู่บรรทัดของตัวเองโดยไม่มีคำอื่น):",
    blocks,
    "",
    "ข้อความมาตรฐานของระบบสำหรับแบบนี้ (ใช้เป็นข้อเท็จจริงอ้างอิงเท่านั้น ตัวเลขในนี้เป็นของเคสตัวอย่าง):",
    "<<<",
    sample.standard,
    ">>>",
    "",
    "กติกา",
    "1. แม่แบบคือร่างของตัวแทนที่จัดให้เรียบร้อย ไม่ใช่ข้อความมาตรฐาน รักษาน้ำเสียง คำเรียกลูกค้า ลำดับเรื่อง คำทักทาย ชื่อและช่องทางติดต่อของตัวแทนไว้ทุกประโยค จัดบรรทัดให้อ่านง่าย แก้คำสะกดผิดเล็กน้อยได้ ไม่ใช้ markdown",
    "2. แม่แบบพูดเฉพาะเรื่องที่ร่างพูดถึง ห้ามเติมหัวข้อ รายการ ผลประโยชน์ เงื่อนไข หรือช่องที่ร่างไม่ได้เอ่ยถึง และห้ามคัดลอกบรรทัดจากข้อความมาตรฐานมาใส่",
    "3. ตัวเลขของแบบประกันทุกตัวที่มีช่องให้ ต้องเขียนเป็นช่อง ห้ามพิมพ์เป็นตัวเลข แม้ร่างจะพิมพ์ตัวเลขหรือคำประมาณมา เช่น \"ทุนล้านนึง\" ให้เขียน \"ทุน {ทุน} บาท\" · \"ปีละประมาณสองหมื่นแปด\" ให้เขียน \"ปีละ {เบี้ยรายปี} บาท\" · \"วันละไม่ถึงร้อย\" ให้เขียน \"วันละ {ตกวันละ} บาท\" ช่องแทนที่เฉพาะตัวเลข คำรอบข้างของร่างคงไว้ (เช่น \"มี opd ด้วย\" ยังต้องมีคำว่า OPD) การเปลี่ยนแบบนี้ไม่นับเป็นการตัด ไม่ต้องใส่ใน removed",
    "4. ช่องที่เป็นจำนวนเงินมีแต่ตัวเลข ให้เขียนคำว่า บาท ต่อท้ายเอง ช่องที่เป็นวลี (ดูตัวอย่างค่าในวงเล็บ) มีคำครบในตัวแล้ว ห้ามเขียนคำซ้ำข้างหน้า เช่น ค่าของ {ระยะจ่าย} คือ \"จ่าย 19 ปี\" จึงห้ามเขียน \"จ่าย {ระยะจ่าย}\"",
    "5. ช่องแบบหลายบรรทัดมีหัวข้อในตัวแล้ว ห้ามเขียนหัวข้อซ้ำเหนือช่อง และใช้เฉพาะเมื่อร่างขอให้แสดงรายการนั้น",
    "6. ใช้ได้เฉพาะช่องในรายการข้างบน ห้ามตั้งชื่อช่องใหม่",
    "7. ตัดเฉพาะข้อความที่กรมธรรม์ไม่ได้ให้ไว้หรือขัดกับข้อความมาตรฐาน เช่น การันตีผลตอบแทนหรือความคุ้มค่า อนุมัติแน่นอน คุ้มครองทุกโรค ไม่มีข้อยกเว้น ดีที่สุด เทียบกับบริษัทอื่น แล้วบันทึกวลีที่ตัดไว้ใน removed พร้อมเหตุผลสั้น ๆ เป็นภาษาไทย (สิ่งที่ข้อความมาตรฐานระบุว่าการันตีอยู่แล้ว พูดได้)",
    "8. ตัวเลขที่ตัวแทนพิมพ์เองและระบบไม่มีช่องให้ เช่น ส่วนลด โปรโมชัน วันที่ ต้องคงไว้ในแม่แบบตามที่พิมพ์ทุกตัวอักษร และใส่วลีนั้นใน own ด้วย (เบอร์โทร ไลน์ คงไว้ในแม่แบบ แต่ไม่ต้องใส่ใน own)",
    "9. ไม่ต้องใส่หมายเหตุท้ายข้อความ ระบบจะต่อท้ายให้เองดังนี้:",
    systemNote(sample.standard),
    "",
    "ตอบเป็น JSON เท่านั้น รูปแบบ:",
    '{"template": "ข้อความแม่แบบ ใช้ \\n ขึ้นบรรทัด", "removed": [{"text": "ข้อความที่ตัด", "why": "เหตุผล"}], "own": ["วลีที่มีตัวเลขของตัวแทนเอง"]}',
    ...(complaint ? ["", `คำตอบครั้งก่อนใช้ไม่ได้: ${complaint} แก้แล้วตอบใหม่`] : []),
    "",
    "ร่างของตัวแทน:",
    "<<<",
    draft,
    ">>>",
  ].join("\n");
}

const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 200)).slice(0, max) : [];

/** The reply as an arrangement, or what is wrong with it. */
export function readArranged(plan: SharePlan, text: string): Arranged | { error: string } {
  const reply = parseJsonReply<Reply>(text);
  const template = typeof reply?.template === "string" ? reply.template.replace(/\r\n?/g, "\n").trim() : "";
  if (!template) return { error: "ไม่มี template" };
  if (template.length > TEMPLATE_MAX) return { error: `template ยาวเกิน ${TEMPLATE_MAX} ตัวอักษร` };
  const def = SHARE_PLANS[plan];
  const known = new Set([...def.slots.map((s) => s.name), ...def.blocks.map((b) => b.name)]);
  const unknown = slotNames(template).filter((n) => !known.has(n));
  if (unknown.length > 0) return { error: `ใช้ช่องที่ไม่มีในรายการ: ${unknown.map((n) => `{${n}}`).join(" ")}` };
  const removed = Array.isArray(reply?.removed)
    ? reply.removed.flatMap((r) => {
      const o = r as { text?: unknown; why?: unknown };
      return typeof o?.text === "string" && o.text.trim()
        ? [{ text: o.text.trim().slice(0, 200), why: typeof o.why === "string" ? o.why.trim().slice(0, 200) : "" }]
        : [];
    }).slice(0, 10)
    : [];
  const own = strings(reply?.own, 10);
  const squash = (t: string) => t.replace(/\s+/g, "");
  const lost = own.filter((o) => !squash(template).includes(squash(o)));
  if (lost.length > 0) return { error: `วลีใน own ต้องอยู่ใน template ด้วย แต่หายไป: ${lost.join(" / ")}` };
  return { template, removed, own };
}

/** Arranges a draft; one more try when the first reply cannot be used. Throws when neither can. */
export async function arrangeShareText(plan: SharePlan, draft: string): Promise<Arranged> {
  const text = draft.trim().slice(0, DRAFT_MAX);
  let complaint: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat({
      tier: "large", task: "share-text", json: true, maxTokens: 1800, timeoutMs: 40_000,
      messages: [{ role: "user", content: prompt(plan, text, complaint) }],
    });
    const read = readArranged(plan, r.text);
    if (!("error" in read)) return read;
    complaint = read.error;
  }
  throw new Error(`share text not arranged: ${complaint}`);
}
