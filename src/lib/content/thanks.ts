import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Length } from "./prompt";
import { formulaRules, type Formula } from "./formula";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * ขอบคุณลูกค้า (owner, 2026-10-06): a post or a script that thanks the Page's customers and sells
 * nothing. One call per piece, no planner, as ความรู้ and เขียนเอง.
 *
 * What sets it apart is what it may not say. The writer knows no customer: a made-up customer's
 * story, a real name, a policy, a sum insured or a claim paid would each be an invention or a
 * disclosure, so the piece thanks customers in general, in the writer's own voice. It offers no
 * gift, discount or reward either — giving one to buy a policy is not allowed. Every figure is
 * flagged (mode-checks.ts `every`). Browser-safe.
 */

export const THANKS_HREF = "thanks";
export const THANKS_NAME = "ขอบคุณลูกค้า";
export const MAX_THANKS_CUSTOM = 120;
export const MAX_THANKS_PIECES = 3;

export interface ThanksOccasion {
  id: string;
  label: string;
  /** what is true about the occasion — all the writer is given */
  brief: string;
}

export const THANKS_OCCASIONS: readonly ThanksOccasion[] = [
  { id: "trust", label: "ขอบคุณที่ไว้วางใจให้ดูแล", brief: "ลูกค้าไว้วางใจให้ตัวแทนช่วยเลือกความคุ้มครอง ขอบคุณที่เล่าเรื่องครอบครัวและความกังวลให้ฟัง และสัญญาว่าจะดูแลหลังการขายต่อไป" },
  { id: "refer", label: "ขอบคุณที่แนะนำคนรู้จักต่อ", brief: "ลูกค้าแนะนำเพื่อนหรือญาติให้มาปรึกษา ซึ่งเป็นความไว้ใจที่ยิ่งใหญ่ ขอบคุณที่เชื่อใจพอจะส่งต่อคนที่รัก" },
  { id: "loyal", label: "ขอบคุณลูกค้าที่อยู่ด้วยกันมานาน", brief: "ลูกค้าที่อยู่กับเพจและตัวแทนมานานหลายปี ขอบคุณที่ไม่ทิ้งกัน และยืนยันว่ายังอยู่ตรงนี้ถ้าชีวิตเปลี่ยนแล้วอยากทบทวนความคุ้มครอง" },
  { id: "review", label: "ขอบคุณที่ให้ความเห็นและรีวิว", brief: "ลูกค้าให้ความเห็นหรือเล่าประสบการณ์ ขอบคุณที่ช่วยให้คนอื่นตัดสินใจง่ายขึ้น และเอาคำแนะนำไปปรับปรุงการบริการ" },
  { id: "follow", label: "ขอบคุณที่ติดตามและคุยกับเพจ", brief: "คนที่กดติดตาม อ่านโพสต์ และทักแชทมาคุยกับเพจ แม้ยังไม่ได้ทำประกันก็ขอบคุณที่ให้เวลา" },
  { id: "time", label: "ขอบคุณที่ให้เวลาปรึกษา (แม้ยังไม่ตัดสินใจ)", brief: "คนที่มานั่งคุยเรื่องความคุ้มครองแต่ยังไม่ตัดสินใจ ขอบคุณที่ให้เวลา ไม่เร่ง ไม่กดดัน และพร้อมคุยต่อเมื่อพร้อม" },
  { id: "year", label: "ขอบคุณส่งท้ายปี / ต้อนรับปีใหม่", brief: "ส่งท้ายปีเก่าและต้อนรับปีใหม่ ขอบคุณลูกค้าและผู้ติดตามที่อยู่ด้วยกันตลอดปี อวยพรให้สุขภาพแข็งแรง" },
];

/** The picked occasion, or the owner's own words as one; null when there is nothing to thank for. */
export function occasionOf(id: string, custom: string): ThanksOccasion | null {
  if (id === "custom") {
    const own = custom.trim().slice(0, MAX_THANKS_CUSTOM);
    return own ? { id: "custom", label: own, brief: own } : null;
  }
  return THANKS_OCCASIONS.find((o) => o.id === id) ?? null;
}

/** How a piece sounds. Left to the AI, a round takes them in turn; picked, every piece takes it. */
export const THANKS_TONES = [
  { id: "warm", label: "อบอุ่นจริงใจ", say: "เขียนเหมือนพูดกับลูกค้าตรงๆ ด้วยน้ำเสียงอบอุ่น จริงใจ ไม่ทางการ" },
  { id: "short", label: "สั้น กระชับ", say: "สั้นและกระชับ ขอบคุณตรงๆ ไม่เกริ่นยาว เหมาะกับคนที่อ่านผ่านฟีดเร็วๆ" },
  { id: "promise", label: "ขอบคุณและสัญญา", say: "ขอบคุณ แล้วบอกว่าจะดูแลต่อยังไง เช่น ตอบแชทเร็ว ช่วยเรื่องเอกสารเคลม ทบทวนความคุ้มครองเมื่อชีวิตเปลี่ยน (สัญญาเฉพาะการบริการ ไม่สัญญาผลลัพธ์)" },
] as const;

const OPENERS = [
  "เปิดด้วยคำขอบคุณสั้นๆ ตรงๆ",
  "เปิดด้วยภาพหรือช่วงเวลาในชีวิตประจำวันที่ทำให้นึกถึงลูกค้า",
  "เปิดด้วยความรู้สึกของผู้เขียนที่ได้รับความไว้ใจ",
];

/** Each piece's tone, in order: the three in turn, or the owner's one opened three ways. */
export function thanksTones(tone: string, count: number): { label: string; say: string }[] {
  const picked = THANKS_TONES.find((t) => t.id === tone);
  return Array.from({ length: count }, (_, i) => {
    if (!picked) return { ...THANKS_TONES[i % THANKS_TONES.length], say: `${THANKS_TONES[i % THANKS_TONES.length].say}\n${OPENERS[i % OPENERS.length]}` };
    return count > 1 ? { label: picked.label, say: `${picked.say}\n${OPENERS[i % OPENERS.length]}` } : picked;
  });
}

/** A thank-you is a post or a clip; it sells nothing, so it is never an ad. */
export const thanksFormat = (format: unknown): "post" | "script" => (format === "script" ? "script" : "post");

const WRITE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. ขอบคุณลูกค้าโดยรวม ห้ามแต่งเรื่องของลูกค้าคนใดคนหนึ่ง ห้ามใส่ชื่อ อายุ อาชีพ หรือรายละเอียดที่ชี้ตัวลูกค้า และห้ามเล่าว่าลูกค้าเคลมได้เท่าไหร่ ทำประกันอะไร ทุนเท่าไหร่ หรือเบี้ยเท่าไหร่",
  "2. ใช้เฉพาะข้อเท็จจริงใน “ข้อมูลโอกาส” ห้ามอ้างว่ามีลูกค้าจำนวนเท่านั้นเท่านี้ ห้ามใส่ตัวเลขใดๆ ที่ไม่มีในข้อมูล",
  "3. คอนเทนต์นี้ไม่ขาย: ห้ามเอ่ยชื่อแบบประกัน ชื่อบริษัทประกัน ราคา เบี้ย และห้ามชวนซื้อหรือชวนทำประกัน",
  "4. ห้ามเสนอของแถม ส่วนลด ของรางวัล หรือสิทธิพิเศษแลกกับการทำประกันหรือการแนะนำ",
  "5. ห้ามคำเกินจริง เช่น การันตี ดีที่สุด ไม่มีความเสี่ยง และห้ามสัญญาผลลัพธ์ของกรมธรรม์ สัญญาได้เฉพาะการบริการของผู้เขียน",
  "6. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "7. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า ผม ฉัน หนู (ใช้ “เรา” หรือเขียนเป็นประโยคที่ไม่มีประธาน)",
  "8. ปิดท้ายด้วยการบอกว่าทักแชทมาคุยได้เสมอ โดยไม่เร่งหรือกดดัน",
  "",
  POLICY_RULES_TH,
].join("\n");

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ บรรยากาศอบอุ่นของครอบครัวหรือการพูดคุยกัน ห้ามมีตัวหนังสือในภาพ",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว เป็นคำขอบคุณ ห้ามมีตัวเลขที่ไม่มีในข้อมูล",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร เช่น ขอบคุณที่ไว้วางใจเสมอ",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

export function thanksSystem(format: "post" | "script", length: Length | null = null, loop = false, formula: Formula | null = null): string {
  const task = format === "post"
    ? [
        "งาน: โพสต์เฟซบุ๊กขอบคุณลูกค้า",
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
        "- hook: ประโยคเปิด 1 บรรทัด เป็นคำขอบคุณที่ทำให้คนอ่านหยุดอ่าน",
        "- body: 4–9 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
        "- closing: 1–2 บรรทัด บอกว่าทักแชทมาคุยได้เสมอ",
        "- hashtags: 3–5 แท็ก เช่น #ขอบคุณ #ประกันชีวิต",
        ...POSTER_LINES,
      ]
    : [
        `งาน: สคริปต์พูดหน้ากล้อง ขอบคุณลูกค้า ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
        "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ]",
        "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ทิศทางภาพในวงเล็บกลม",
        "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม บอกว่าทักแชทมาคุยได้เสมอ",
        "- hashtags: 3–5 แท็ก สำหรับแคปชันใต้คลิป",
      ];
  return [
    "คุณคือนักเขียนคอนเทนต์ให้เพจของตัวแทนประกันชีวิตในประเทศไทย งานคือเขียนคำขอบคุณลูกค้าที่จริงใจ ไม่ขายของ ภาษาไทยแบบที่คนทั่วไปพูดกัน",
    "",
    WRITE_RULES,
    "",
    ...task,
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...[formulaRules(formula, format, length, loop, true)].filter(Boolean),
  ].join("\n");
}

export function thanksMessages(
  occasion: ThanksOccasion, tone: { say: string }, reader: string, format: "post" | "script", length: Length | null, loop: boolean, formula: Formula | null,
): ChatMessage[] {
  return [
    { role: "system", content: thanksSystem(format, length, loop, formula) },
    {
      role: "user",
      content: [`โอกาส: ${occasion.label}`, `ข้อมูลโอกาส:\n${occasion.brief}`, `วิธีเล่าของชิ้นนี้: ${tone.say}`, steerLines({ reader: reader.trim() })]
        .filter(Boolean).join("\n\n"),
    },
  ];
}

const FOOTER = "ขอบคุณที่ไว้วางใจเสมอ";

function thanksPoster(raw: unknown, hook: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    { kind: "badge", text: "ขอบคุณ" },
    { kind: "headline", text: headline },
    { kind: "footer", text: footer || FOOTER },
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "bottom", theme, blocks })!;
}

/** One thank-you from a reply, or null when the reply has no hook or body. */
export function parseThanksPiece(reply: string, occasion: ThanksOccasion, toneLabel: string, format: "post" | "script"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  return {
    hooks: [hook],
    angle: `${THANKS_NAME} · ${occasion.label} · ${toneLabel}`,
    body,
    closing: text(raw.closing),
    hashtags: [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    // a thank-you sells nothing, so there is no buyer's warning to add
    disclaimer: "",
    ...(format === "script" ? {} : { poster: thanksPoster(raw.poster, hook) }),
    // the occasion stays with the piece: an edit is checked against it again
    fact: occasion.brief,
  };
}
