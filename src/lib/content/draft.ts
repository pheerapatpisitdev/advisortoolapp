import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/client";
import { AD_LIMITS } from "./ads";
import { DISCLAIMER, type ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Format, type Length } from "./prompt";
import { PRO_HOOK_RULES, proRules } from "./pro";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * เขียนเอง (owner, 2026-09-29): the agent's own draft, polished by the AI into up to three
 * versions — closest to the draft, punchier, told as a story. The draft's meaning and facts
 * stay; nothing is added. The draft is kept as the piece's `fact`, the field whose figures are
 * allowed when a piece is checked and edited, so the agent's own numbers are never flagged and
 * a number the AI brought in is. Browser-safe.
 */

export const DRAFT_HREF = "draft";
export const DRAFT_NAME = "เขียนเอง";
export const MAX_DRAFT = 2000;
export const MAX_DRAFT_PIECES = 3;

export const DRAFT_STYLES = [
  { id: "close", label: "ใกล้ร่างที่สุด", say: "คงคำและลำดับของเจ้าของไว้มากที่สุด แก้คำผิด จัดย่อหน้าให้อ่านง่ายบนมือถือ เขียนประโยคเปิดใหม่ให้หยุดคนเลื่อน" },
  { id: "punchy", label: "กระชับ หยุดคนเลื่อน", say: "ย่อให้สั้นลงราวครึ่งหนึ่ง ตัดคำเกริ่นและคำซ้ำ ประโยคเปิดแรงขึ้น เหลือแต่ใจความ" },
  { id: "story", label: "เล่าเป็นเรื่อง", say: "เรียงเนื้อหาของร่างเป็นเรื่องเล่าที่อ่านลื่น มีต้น กลาง จบ โดยใช้เฉพาะเรื่องที่ร่างมี" },
] as const;

/** The draft as sent: trimmed, and cut at MAX_DRAFT characters rather than refused. */
export function cleanDraft(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return [...raw.trim()].slice(0, MAX_DRAFT).join("").trim();
}

const RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. คงใจความและข้อเท็จจริงของร่างไว้ครบ ห้ามเพิ่มข้อเท็จจริง ตัวเลข หรือคำสัญญาที่ร่างไม่มี ตัวเลขในร่างคัดลอกได้ตรงตัวเท่านั้น ห้ามคำนวณหรือปัดเศษ",
  "2. ถ้าร่างมีคำที่ผิดกฎโฆษณาของ Facebook หรือคำเกินจริง (การันตี ดีที่สุด ได้เงินคืนแน่นอน ฯลฯ) ให้เปลี่ยนเป็นคำที่ถูกต้อง",
  "3. ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันอื่น และห้ามใส่ชื่อจริงหรือข้อมูลที่ทำให้รู้ว่าเป็นลูกค้าคนไหน",
  "4. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "5. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
  "6. ร่างจะขายหรือไม่ขายก็ได้ ให้ปิดท้ายตามที่ร่างตั้งใจ ถ้าร่างไม่บอก ให้ชวนทักแชทหรือเซฟเก็บไว้ ห้ามชวนคอมเมนต์คำเฉพาะหรือแท็กเพื่อน",
  "7. ถ้าร่างชวนคนมาร่วมทีมหรือสมัครเป็นตัวแทน: ห้ามใส่ตัวเลขรายได้ทุกรูปแบบ แม้ร่างจะเขียนมา ให้บอกแค่ว่ารายได้ขึ้นกับผลงาน และห้ามกำหนดอายุ เพศ หรือสถานภาพของผู้สมัคร",
  "",
  POLICY_RULES_TH,
].join("\n");

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ ตรงกับเรื่องในร่าง ห้ามมีตัวหนังสือ",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว ตัวเลขต้องมาจากร่างเท่านั้น",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

function draftSystem(format: Format, length: Length | null, loop: boolean, pro: boolean): string {
  const task: Record<Format, string[]> = {
    post: [
      "งาน: เกลาร่างของเจ้าของเพจเป็นโพสต์เฟซบุ๊ก",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
      "- hook: ประโยคเปิด 1 บรรทัด · body: ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ · closing: 1–2 บรรทัด · hashtags: 3–6 แท็ก",
      ...POSTER_LINES,
    ],
    script: [
      `งาน: เกลาร่างของเจ้าของเพจเป็นสคริปต์พูดหน้ากล้อง ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
      "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ]",
      "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] ใส่ท่าทางในวงเล็บ และข้อความขึ้นจอเป็น {จอ: …} ใช้ \\n ขึ้นบรรทัดใหม่",
      "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม · hashtags: 3–6 แท็ก",
    ],
    ad: [
      "งาน: เกลาร่างของเจ้าของเพจเป็นโฆษณา Facebook",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…",${POSTER_SHAPE}}`,
      `- hook คือ headline: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.headline} ตัวอักษร`,
      `- body คือ primary text: ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว ทั้งหมดไม่เกิน 400 ตัวอักษร`,
      `- closing คือ description: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.description} ตัวอักษร`,
      ...POSTER_LINES,
    ],
  };
  return [
    "คุณคือบรรณาธิการคอนเทนต์ให้ตัวแทนประกันชีวิตในประเทศไทย งานคือเกลาร่างของเจ้าของเพจให้ดีขึ้นโดยยังเป็นเรื่องของเขา",
    "",
    RULES,
    "",
    ...task[format],
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...(pro && format !== "ad" ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
  ].join("\n");
}

export function draftMessages(draft: string, piece: number, reader: string, format: Format, length: Length | null, loop: boolean, pro: boolean): ChatMessage[] {
  const style = DRAFT_STYLES[piece % DRAFT_STYLES.length];
  return [
    { role: "system", content: draftSystem(format, length, loop, pro) },
    {
      role: "user",
      content: [`ร่างของเจ้าของเพจ:\n"""${draft}"""`, `วิธีเกลาเวอร์ชันนี้: ${style.say}`, steerLines({ reader: reader.trim() })].filter(Boolean).join("\n\n"),
    },
  ];
}

function draftPoster(raw: unknown, hook: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [{ kind: "headline", text: headline }, ...(footer ? [{ kind: "footer" as const, text: footer }] : [])];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "bottom", theme, blocks })!;
}

/** One polished version from a reply, or null when the reply has no hook or body. */
export function parseDraftPiece(reply: string, draft: string, piece: number, format: Format): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  const style = DRAFT_STYLES[piece % DRAFT_STYLES.length];
  return {
    hooks: [format === "ad" ? hook.slice(0, 120) : hook],
    angle: `${DRAFT_NAME} · ${style.label}`,
    body: format === "ad" ? body.slice(0, 1200) : body,
    closing: format === "ad" ? text(raw.closing).slice(0, 120) : text(raw.closing),
    hashtags: format === "ad" ? [] : [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: DISCLAIMER,
    ...(format === "script" ? {} : { poster: draftPoster(raw.poster, hook) }),
    ...(format === "ad" ? { ad: { angle: style.label, tone: DRAFT_NAME } } : {}),
    // the draft is the piece's story: its figures are allowed now and after every edit
    fact: draft,
  };
}
