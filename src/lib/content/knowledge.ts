import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/client";
import type { ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Length } from "./prompt";
import { PRO_HOOK_RULES, proRules } from "./pro";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * ความรู้ (owner, 2026-09-29): pieces that make a Page known and trusted and sell nothing —
 * a myth put right, a plain article, a quote. See
 * docs/superpowers/specs/2026-09-29-knowledge-and-draft-modes-design.md.
 *
 * One call per piece, no planner, as หาทีม. The writer may use general knowledge (the owner's
 * choice), so there is no brief to check figures against: every number in a knowledge piece is
 * flagged for the owner to confirm (knowledge-run.ts checks against ""). Browser-safe.
 */

export const KNOWLEDGE_HREF = "knowledge";
export const KNOWLEDGE_NAME = "ความรู้";

export type KnowledgeKind = "myth" | "article" | "quote";
export const KNOWLEDGE_KINDS: { id: KnowledgeKind; label: string }[] = [
  { id: "myth", label: "ความเข้าใจผิด" },
  { id: "article", label: "บทความความรู้" },
  { id: "quote", label: "คำคม/บทความดีๆ" },
];

export const KNOWLEDGE_SUBJECTS: Record<KnowledgeKind, { id: string; label: string }[]> = {
  myth: [
    { id: "group", label: "มีประกันกลุ่มของบริษัทแล้ว ไม่ต้องทำเพิ่ม" },
    { id: "young", label: "ยังหนุ่มสาว สุขภาพดี ยังไม่ต้องรีบทำ" },
    { id: "later", label: "รอแก่ก่อนค่อยทำ ก็ทันเหมือนกัน" },
    { id: "noclaim", label: "เคลมยาก บริษัทไม่ยอมจ่ายจริง" },
    { id: "savings", label: "มีเงินเก็บพอแล้ว ไม่ต้องมีประกัน" },
    { id: "death", label: "ประกันชีวิตมีไว้สำหรับตอนเสียชีวิตเท่านั้น" },
    { id: "lump", label: "ประกันสุขภาพแบบเหมาจ่ายคุ้มครองทุกอย่าง" },
    { id: "preexist", label: "โรคที่เป็นอยู่แล้ว ทำประกันแล้วก็เคลมได้" },
    { id: "fixed", label: "ทำประกันแล้ว เบี้ยจะไม่ขึ้นอีกเลย" },
    { id: "tax", label: "ซื้อประกันลดหย่อนภาษีได้ไม่จำกัด" },
  ],
  article: [
    { id: "lumpvsitem", label: "ประกันสุขภาพแบบเหมาจ่าย กับแบบแยกค่าใช้จ่าย ต่างกันอย่างไร" },
    { id: "waiting", label: "ระยะรอคอยคืออะไร ทำไมต้องรู้ก่อนเคลม" },
    { id: "opdipd", label: "OPD กับ IPD คืออะไร เลือกแบบไหนดี" },
    { id: "daily", label: "ค่าชดเชยรายวันคืออะไร ช่วยอะไรได้บ้าง" },
    { id: "copay", label: "Co-payment และ Deductible คืออะไร" },
    { id: "taxdeduct", label: "ลดหย่อนภาษีจากประกัน ทำได้อย่างไร" },
    { id: "ci", label: "ประกันโรคร้ายแรง จ่ายเงินตอนไหน" },
    { id: "surrender", label: "มูลค่าเวนคืนกรมธรรม์คืออะไร" },
    { id: "sumassured", label: "ทุนประกันชีวิตควรมีเท่าไหร่ คิดอย่างไร" },
    { id: "claimdocs", label: "เตรียมเอกสารเคลมอย่างไร ให้ได้เงินเร็ว" },
  ],
  quote: [
    { id: "money", label: "วางแผนการเงิน/เก็บเงิน" },
    { id: "family", label: "ครอบครัว/คนที่รัก" },
    { id: "health", label: "สุขภาพ/ใช้ชีวิต" },
    { id: "cheer", label: "กำลังใจทั่วไป" },
  ],
};

export const MAX_KNOWLEDGE_CUSTOM = 120;
export const MAX_KNOWLEDGE_PIECES = 3;

export interface KnowledgeSubject {
  kind: KnowledgeKind;
  id: string;
  label: string;
}

const isKind = (v: string): v is KnowledgeKind => v === "myth" || v === "article" || v === "quote";

/** The picked subject, or the owner's own words as one; null when there is nothing to write about. */
export function subjectOf(kind: string, id: string, custom: string): KnowledgeSubject | null {
  if (!isKind(kind)) return null;
  if (id === "custom") {
    const own = custom.trim().slice(0, MAX_KNOWLEDGE_CUSTOM);
    return own ? { kind, id: "custom", label: own } : null;
  }
  const s = KNOWLEDGE_SUBJECTS[kind].find((x) => x.id === id);
  return s ? { kind, ...s } : null;
}

/** A knowledge piece sells nothing, so it is never an ad. */
export const knowledgeFormat = (format: unknown): "post" | "script" => (format === "script" ? "script" : "post");

const WRITE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. คอนเทนต์นี้ไม่ขาย: ห้ามเอ่ยชื่อแบบประกัน ชื่อบริษัทประกัน ราคาหรือเบี้ย และห้ามชวนซื้อหรือชวนทักแชทเพื่อซื้อ",
  "2. ใช้ความรู้ทั่วไปได้ แต่ห้ามอ้างว่าบริษัทหรือกรมธรรม์ไหนให้หรือไม่ให้อะไร เรื่องที่ต่างกันในแต่ละกรมธรรม์ให้บอกว่า “ขึ้นกับเงื่อนไขของกรมธรรม์” ใส่ตัวเลขเฉพาะที่เป็นความรู้สาธารณะและจำเป็น (เช่น เพดานลดหย่อนภาษี) และบอกว่าเป็นของปีไหน ห้ามแต่งตัวเลข",
  "3. ห้ามคำเกินจริง เช่น การันตี ดีที่สุด ไม่มีความเสี่ยง ได้เงินคืนแน่นอน และห้ามขายด้วยความกลัว",
  "4. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "5. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
  "6. ปิดท้ายด้วยการชวนเซฟเก็บไว้ หรือส่งต่อให้คนที่ควรรู้ ห้ามชวนคอมเมนต์คำเฉพาะ และห้ามชวนแท็กเพื่อน (Facebook ลดการมองเห็น)",
  "",
  POLICY_RULES_TH,
].join("\n");

const KIND_TASK: Record<KnowledgeKind, string> = {
  myth: "แบบ: แก้ความเข้าใจผิด — บอกความเชื่อ → ทำไมคนถึงเชื่อ → ความจริงคืออะไร → ควรทำอย่างไร เล่าเป็นมิตร ไม่ตำหนิคนอ่าน",
  article: "แบบ: บทความความรู้ — อธิบายให้คนทั่วไปเข้าใจในครั้งเดียว ใช้ตัวอย่างในชีวิตประจำวัน แบ่งเป็นข้อสั้นๆ ได้ จบด้วยสิ่งที่คนอ่านเอาไปใช้ได้",
  quote: "แบบ: คำคม/บทความดีๆ — แต่งคำคมใหม่ 1 ประโยคที่คนอยากเซฟเก็บไว้ แล้วเล่าต่อสั้นๆ ว่าทำไมถึงจริง แต่งเองเท่านั้น ห้ามอ้างว่าเป็นคำพูดของคนดังหรือบุคคลจริง ห้ามใส่ชื่อคนหลังคำคม",
};

const OPENERS = [
  "เปิดด้วยคำถามที่คนอ่านต้องหยุดคิด",
  "เปิดด้วยภาพหรือสถานการณ์ในชีวิตประจำวัน",
  "เปิดด้วยประโยคที่สวนความเชื่อหรือทำให้แปลกใจ",
];

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ อบอุ่น ห้ามมีตัวหนังสือ ห้ามภาพเงินสด",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว (คำคม: ใส่ตัวคำคมเลย ไม่เกิน 60 ตัวอักษร ถ้ายาวกว่านั้นให้ย่อ ห้ามตัดกลางประโยค)",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร ชวนเซฟ (คำคม: เว้นว่างได้)",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

function knowledgeSystem(kind: KnowledgeKind, format: "post" | "script", length: Length | null, loop: boolean, pro: boolean): string {
  const task = format === "post"
    ? [
        "งาน: โพสต์เฟซบุ๊ก",
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
        "- hook: ประโยคเปิด 1 บรรทัด หยุดนิ้วคนเลื่อนฟีด",
        kind === "quote" ? "- body: 2–5 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่" : "- body: 6–14 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
        "- closing: 1 บรรทัด ชวนเซฟหรือส่งต่อ",
        "- hashtags: 3–6 แท็ก",
        ...POSTER_LINES,
      ]
    : [
        `งาน: สคริปต์พูดหน้ากล้อง ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
        "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] ต้องหยุดคนดูให้ได้",
        "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ท่าทางในวงเล็บ และข้อความขึ้นจอเป็น {จอ: …} เฉพาะจุดสำคัญ ใช้ \\n ขึ้นบรรทัดใหม่",
        "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม ชวนเซฟหรือส่งต่อ",
        "- hashtags: 3–6 แท็ก สำหรับแคปชันใต้คลิป",
      ];
  return [
    "คุณคือนักเขียนคอนเทนต์ความรู้เรื่องประกันและการใช้ชีวิต ให้เพจของตัวแทนประกันชีวิตในประเทศไทย ภาษาไทยแบบที่คนทั่วไปพูดกัน อ่านง่ายบนมือถือ อบอุ่น จริงใจ",
    "",
    WRITE_RULES,
    "",
    KIND_TASK[kind],
    ...task,
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...(pro ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
  ].join("\n");
}

export function knowledgeMessages(
  subject: KnowledgeSubject, piece: number, reader: string, format: "post" | "script", length: Length | null, loop: boolean, pro: boolean,
): ChatMessage[] {
  const about = subject.kind === "quote" ? `แนวคำคม: ${subject.label}` : `หัวข้อ: ${subject.label}`;
  return [
    { role: "system", content: knowledgeSystem(subject.kind, format, length, loop, pro) },
    { role: "user", content: [about, OPENERS[piece % OPENERS.length], steerLines({ reader: reader.trim() })].filter(Boolean).join("\n\n") },
  ];
}

export const KNOWLEDGE_DISCLAIMER = "ข้อมูลนี้เพื่อความรู้ทั่วไป เงื่อนไขจริงขึ้นอยู่กับแต่ละกรมธรรม์";
const BADGE: Record<KnowledgeKind, string> = { myth: "ความเข้าใจผิด", article: "รู้ไว้ใช่ว่า", quote: "" };
const FOOTER = "เซฟเก็บไว้ได้เลย";

function knowledgePoster(raw: unknown, hook: string, kind: KnowledgeKind): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    ...(BADGE[kind] ? [{ kind: "badge" as const, text: BADGE[kind] }] : []),
    { kind: "headline", text: headline },
    ...(kind === "quote" ? (footer ? [{ kind: "footer" as const, text: footer }] : []) : [{ kind: "footer" as const, text: footer || FOOTER }]),
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: kind === "quote" ? "center" : "bottom", theme, blocks })!;
}

/** One knowledge piece from a reply, or null when the reply has no hook or body. */
export function parseKnowledgePiece(reply: string, subject: KnowledgeSubject, format: "post" | "script"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  const kindLabel = KNOWLEDGE_KINDS.find((k) => k.id === subject.kind)!.label;
  return {
    hooks: [hook],
    angle: `${KNOWLEDGE_NAME} · ${kindLabel} · ${subject.label}`,
    body,
    closing: text(raw.closing),
    hashtags: [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: subject.kind === "quote" ? "" : KNOWLEDGE_DISCLAIMER,
    ...(format === "script" ? {} : { poster: knowledgePoster(raw.poster, hook, subject.kind) }),
  };
}
