import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Length } from "./prompt";
import { formulaRules, type Formula } from "./formula";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * คำคม (owner, 2026-10-09): a short saying, large on the poster, and a caption that draws from it
 * a gentle thought about being prepared — selling nothing. One call per piece, no planner, as
 * ขอบคุณลูกค้า.
 *
 * The saying comes one of two ways. From a topic, the writer makes a new one and claims no one
 * said it: a famous name put to words the AI wrote would be a misquote. Typed by the agent, the
 * words are theirs, laid on the poster and at the caption's head as they were typed, with the
 * name of whoever said them if one was given; the writer only writes the caption around them.
 * Every figure is flagged (mode-checks.ts `every`). Browser-safe.
 */

export const SAYING_HREF = "saying";
export const SAYING_NAME = "คำคม";
export const MAX_SAYING_TOPIC = 120;
/** the agent's own saying is the poster's headline, so it may be no longer than one */
export const MAX_SAYING_OWN = MAX_CHARS.headline;
export const MAX_SAYING_WHO = 40;
export const MAX_SAYING_PIECES = 3;

export interface SayingTopic {
  id: string;
  label: string;
  /** what the saying is about — all the writer is given */
  brief: string;
  /**
   * The topic's separate points, one to a piece when a round spreads them (owner, 2026-10-09):
   * three pieces given the one brief wrote three sayings on its first phrase, "วันธรรมดา…".
   * A topic the agent typed has none; it is looked at from LENSES instead.
   */
  points?: readonly string[];
}

export const SAYING_TOPICS: readonly SayingTopic[] = [
  { id: "life", label: "ชีวิต", brief: "ชีวิตเปลี่ยนได้เสมอ ความสุขอยู่ในวันธรรมดา การใช้ชีวิตให้คุ้มค่าและมีสติกับสิ่งที่สำคัญ",
    points: ["ชีวิตเปลี่ยนได้เสมอ ไม่มีใครรู้ว่าพรุ่งนี้จะเป็นอย่างไร", "ความสุขเล็กๆ ที่ซ่อนอยู่ในวันธรรมดา", "ใช้ชีวิตให้คุ้มค่า และมีสติกับสิ่งที่สำคัญจริงๆ"] },
  { id: "family", label: "ครอบครัว", brief: "ครอบครัวและคนที่เรารัก การดูแลกันและกัน ความรักที่แสดงออกผ่านการคิดเผื่อคนข้างหลัง",
    points: ["การดูแลกันและกันของคนในบ้าน", "ความรักที่แสดงออกผ่านการคิดเผื่อคนข้างหลัง", "เวลาที่ได้อยู่กับพ่อแม่และลูก ที่มีไม่มากอย่างที่คิด"] },
  { id: "money", label: "เงินและการออม", brief: "การใช้เงินอย่างมีสติ การออมทีละน้อย ความมั่นคงที่สร้างได้จากวินัยเล็กๆ ทุกวัน",
    points: ["ใช้เงินอย่างมีสติ แยกของจำเป็นออกจากของอยากได้", "ออมทีละน้อย แต่ทำอย่างสม่ำเสมอ", "ความมั่นคงที่ค่อยๆ สร้างจากวินัยเล็กๆ"] },
  { id: "plan", label: "การวางแผนล่วงหน้า", brief: "การคิดล่วงหน้า เตรียมพร้อมตั้งแต่วันที่ยังไม่มีปัญหา เพราะวันที่ต้องใช้มักมาโดยไม่บอกล่วงหน้า",
    points: ["เริ่มเตรียมตั้งแต่วันที่ยังไม่มีปัญหา", "วันที่ต้องใช้มักมาโดยไม่บอกล่วงหน้า", "การคิดล่วงหน้าคือการดูแลตัวเองในวันข้างหน้า"] },
  { id: "unexpected", label: "เรื่องไม่คาดฝันและสุขภาพ", brief: "สุขภาพคือต้นทุนของทุกอย่าง เรื่องไม่คาดฝันเกิดได้กับทุกคน ใจที่พร้อมรับมือช่วยให้ผ่านวันยากๆ ไปได้",
    points: ["สุขภาพคือต้นทุนของทุกอย่าง", "เรื่องไม่คาดฝันเกิดได้กับทุกคน", "ใจที่พร้อมรับมือช่วยให้ผ่านวันยากๆ ไปได้"] },
  { id: "work", label: "การทำงานและความพยายาม", brief: "ความพยายาม ความอดทน การลงมือทำทุกวัน และการไม่ยอมแพ้แม้วันที่เหนื่อย",
    points: ["ลงมือทำทุกวัน แม้ทีละก้าวเล็กๆ", "ความอดทนในวันที่เหนื่อย", "ไม่ยอมแพ้ และเริ่มใหม่ได้เสมอ"] },
];

/** a typed topic's points: the same topic seen from three places */
const LENSES = ["มองจากตัวเราเอง", "มองจากคนที่เรารัก", "มองจากวันข้างหน้า"];

/**
 * How a round's pieces differ (owner, 2026-10-09, a button on the form). ต่างประเด็น gives each
 * piece its own point of the topic; ประเด็นเดียว หลายสำนวน keeps the whole topic for every piece.
 * Either way each piece takes its own sentence shape and is told the others', since the pieces
 * are written at once and none sees another.
 */
export const SAYING_SPREADS = [
  { id: "points", label: "ต่างประเด็น", note: "แต่ละชิ้นพูดคนละประเด็นในหัวข้อ และใช้รูปประโยคต่างกัน" },
  { id: "wording", label: "ประเด็นเดียว หลายสำนวน", note: "ทุกชิ้นพูดเรื่องเดียวกัน ต่างกันที่รูปประโยคและคำขึ้นต้น ไว้เลือกสำนวนที่ชอบ" },
] as const;
export type SayingSpread = (typeof SAYING_SPREADS)[number]["id"];
export const sayingSpread = (v: unknown): SayingSpread => (v === "wording" ? "wording" : "points");

/** The saying's sentence shapes, one to a piece. A round starts at a place of its own, so rounds differ too. */
export const SAYING_SHAPES = [
  "เปรียบเทียบกับสิ่งของหรือธรรมชาติที่เห็นได้ทุกวัน เช่น ร่ม ต้นไม้ สายฝน",
  "ประโยคสองท่อนที่ตัดกัน เช่น วันนี้… พรุ่งนี้…",
  "คำถามชวนคิด ที่คนอ่านตอบได้เองในใจ",
  "รูป “ไม่ใช่… แต่คือ…”",
  "ประโยคบอกเล่าสั้นๆ เรียบๆ จบในท่อนเดียว",
];

/**
 * What each piece of a topic round is aimed at: its point (or the whole topic), its sentence
 * shape, and what the round's other pieces took. `start` turns the lists so a new round does not
 * open where the last did. The agent's own saying is theirs as typed: nothing to aim.
 */
export interface SayingAim {
  /** the piece's own point of the topic; empty where it is given the whole topic */
  point: string;
  /** the lines the writer is given: point, shape, and the others' */
  lines: string;
}

export function sayingAims(source: SayingSource, spread: SayingSpread, count: number, start = 0): SayingAim[] {
  if (source.kind !== "topic") return Array.from({ length: count }, () => ({ point: "", lines: "" }));
  const points = source.topic.points?.length ? source.topic.points : LENSES;
  const turn = <T>(list: readonly T[], i: number) => list[(start + i) % list.length];
  const pieces = Array.from({ length: count }, (_, i) => ({
    point: spread === "points" ? turn(points, i) : "",
    shape: turn(SAYING_SHAPES, i),
  }));
  return pieces.map((p, i) => {
    const others = pieces.filter((_, j) => j !== i);
    return { point: p.point, lines: [
      p.point ? `ประเด็นของชิ้นนี้: ${p.point}` : "",
      `รูปประโยคของคำคม: ${p.shape}`,
      others.length === 0 ? ""
        : spread === "points"
          ? `ชิ้นอื่นในรอบเดียวกันพูดเรื่อง: ${others.map((o) => o.point).join(" / ")} — คำคมชิ้นนี้ต้องคนละเรื่อง และห้ามขึ้นต้นด้วยคำเดียวกับชิ้นอื่น`
          : `ชิ้นอื่นในรอบเดียวกันใช้รูปประโยค: ${others.map((o) => o.shape).join(" / ")} — ชิ้นนี้ต้องขึ้นต้นด้วยคำที่ต่างออกไป`,
    ].filter(Boolean).join("\n") };
  });
}

export type SayingSource =
  | { kind: "topic"; topic: SayingTopic }
  | { kind: "own"; text: string; who: string };

export interface SayingAsk {
  /** "topic" for the writer to make one, "own" for the agent's typed words */
  source?: unknown;
  /** a topic id from SAYING_TOPICS, or "custom" with the owner's words */
  topic?: unknown;
  custom?: unknown;
  own?: unknown;
  who?: unknown;
}

const NOTHING = "เลือกหัวข้อ หรือพิมพ์คำคมก่อนนะครับ";
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Where a round's saying comes from, or why there is none. The agent's own words longer than a
 * poster holds are refused rather than cut: an ellipsis in someone's saying changes it.
 */
export function readSaying(ask: SayingAsk): { ok: true; source: SayingSource } | { ok: false; error: string } {
  if (ask.source === "own") {
    const text = str(ask.own).replace(/\s+/g, " ");
    if (!text) return { ok: false, error: NOTHING };
    if ([...text].length > MAX_SAYING_OWN) return { ok: false, error: `คำคมยาวเกิน ${MAX_SAYING_OWN} ตัวอักษร ย่อให้สั้นลงหน่อยนะครับ` };
    return { ok: true, source: { kind: "own", text, who: [...str(ask.who)].slice(0, MAX_SAYING_WHO).join("") } };
  }
  if (ask.topic === "custom") {
    const own = [...str(ask.custom)].slice(0, MAX_SAYING_TOPIC).join("");
    return own ? { ok: true, source: { kind: "topic", topic: { id: "custom", label: own, brief: own } } } : { ok: false, error: NOTHING };
  }
  const topic = SAYING_TOPICS.find((t) => t.id === ask.topic);
  return topic ? { ok: true, source: { kind: "topic", topic } } : { ok: false, error: NOTHING };
}

/** How a piece sounds. Left to the AI, a round takes them in turn; picked, every piece takes it. */
export const SAYING_TONES = [
  { id: "short", label: "สั้นกินใจ", say: "คำคมสั้น คมคาย อ่านแล้วนิ่งคิด แคปชันกระชับ ไม่อธิบายยาว" },
  { id: "warm", label: "ข้อคิดอบอุ่น", say: "น้ำเสียงอบอุ่นเหมือนเพื่อนเตือนกัน แคปชันเล่าข้อคิดจากคำคมด้วยภาพในชีวิตประจำวัน" },
  { id: "lift", label: "ปลุกพลัง", say: "ให้กำลังใจ ปลุกให้อยากลงมือทำ น้ำเสียงมีพลังแต่ไม่ตะโกน" },
] as const;

const OPENERS = [
  "แคปชันเริ่มจากความหมายของคำคมตรงๆ",
  "แคปชันเริ่มจากภาพหรือช่วงเวลาในชีวิตประจำวันที่คำคมนี้พูดถึง",
  "แคปชันเริ่มจากคำถามชวนคิดที่คำคมนี้ตอบ",
];

/** Each piece's tone, in order: the three in turn, or the owner's one opened three ways. */
export function sayingTones(tone: string, count: number): { label: string; say: string }[] {
  const picked = SAYING_TONES.find((t) => t.id === tone);
  return Array.from({ length: count }, (_, i) => {
    if (!picked) return { ...SAYING_TONES[i % SAYING_TONES.length], say: `${SAYING_TONES[i % SAYING_TONES.length].say}\n${OPENERS[i % OPENERS.length]}` };
    return count > 1 ? { label: picked.label, say: `${picked.say}\n${OPENERS[i % OPENERS.length]}` } : picked;
  });
}

/** A saying is a post or a clip; it sells nothing, so it is never an ad. */
export const sayingFormat = (format: unknown): "post" | "script" => (format === "script" ? "script" : "post");

const SOURCE_RULE: Record<SayingSource["kind"], string> = {
  topic: "1. แต่งคำคมขึ้นใหม่เองจาก “หัวข้อ” ยาวไม่เกิน 60 ตัวอักษร อ่านจบในอึดใจเดียว ห้ามยกคำคมหรือคำพูดที่มีอยู่แล้ว และห้ามอ้างว่าเป็นคำพูดของใคร ใช้ใจความหัวข้อเป็นแนวคิดเท่านั้น ห้ามยกวลีจากใจความมาขึ้นต้นคำคม",
  own: "1. ใช้ “คำคม” ที่ให้มาตามนั้นทุกตัวอักษร ห้ามแก้ ห้ามแต่งต่อ ถ้ามีชื่อผู้พูดให้ใช้ตามที่ให้มา ห้ามเล่าประวัติหรือเรื่องของคนนั้นเพิ่ม",
};

const WRITE_RULES = [
  "2. แคปชันขยายข้อคิดของคำคม แล้วโยงเบาๆ ว่าการเตรียมพร้อมไว้ให้ตัวเองและคนที่รักเป็นเรื่องสำคัญ",
  "3. คอนเทนต์นี้ไม่ขาย: ห้ามเอ่ยชื่อแบบประกัน ชื่อบริษัทประกัน ราคา เบี้ย และห้ามชวนซื้อหรือชวนทำประกัน",
  "4. ห้ามใส่ตัวเลข สถิติ หรือผลวิจัยใดๆ",
  "5. ห้ามคำเกินจริง เช่น การันตี ดีที่สุด ไม่มีความเสี่ยง และห้ามขู่ให้กลัวหรือพูดถึงความเจ็บป่วยและความตายให้น่ากลัว",
  "6. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "7. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า ผม ฉัน หนู (ใช้ “เรา” หรือเขียนเป็นประโยคที่ไม่มีประธาน)",
  "8. ปิดท้ายด้วยการบอกว่าทักแชทมาคุยได้เสมอ โดยไม่เร่งหรือกดดัน",
];

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค เข้ากับความหมายของคำคม แสงธรรมชาติ โล่ง มีที่ว่างให้วางตัวหนังสือ ห้ามมีตัวหนังสือในภาพ",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร เช่น เตรียมไว้วันนี้ อุ่นใจวันหน้า",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

export function sayingSystem(format: "post" | "script", kind: SayingSource["kind"], length: Length | null = null, loop = false, formula: Formula | null = null): string {
  const saying = kind === "topic" ? '"saying":"…",' : "";
  const sayingLine = kind === "topic" ? ["- saying: คำคมที่แต่ง ไม่ใส่เครื่องหมายคำพูด"] : [];
  const task = format === "post"
    ? [
        "งาน: โพสต์เฟซบุ๊กคำคม ระบบจะวางคำคมไว้บรรทัดแรกของโพสต์และบนโปสเตอร์ให้เอง",
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        `{${saying}"body":"…","closing":"…","hashtags":["#…"],"imagePrompt":"…","poster":{"theme":"navy","footer":"…"}}`,
        ...sayingLine,
        "- body: 3–7 บรรทัดสั้นๆ ต่อจากคำคม ห้ามเขียนคำคมซ้ำ ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
        "- closing: 1–2 บรรทัด บอกว่าทักแชทมาคุยได้เสมอ",
        "- hashtags: 3–5 แท็ก เช่น #คำคม #ข้อคิด",
        ...POSTER_LINES,
      ]
    : [
        `งาน: สคริปต์พูดหน้ากล้อง เปิดด้วยคำคม ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]} ระบบจะใส่คำคมเป็นประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] ให้เอง`,
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        `{${saying}"body":"…","closing":"…","hashtags":["#…"]}`,
        ...sayingLine,
        "- body: ต่อจากคำคม แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ทิศทางภาพในวงเล็บกลม",
        "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม บอกว่าทักแชทมาคุยได้เสมอ",
        "- hashtags: 3–5 แท็ก สำหรับแคปชันใต้คลิป",
      ];
  return [
    "คุณคือนักเขียนคอนเทนต์ให้เพจของตัวแทนประกันชีวิตในประเทศไทย งานคือโพสต์คำคมที่ให้ข้อคิด ไม่ขายของ ภาษาไทยแบบที่คนทั่วไปพูดกัน",
    "",
    "กฎที่ห้ามละเมิด:",
    SOURCE_RULE[kind],
    ...WRITE_RULES,
    "",
    POLICY_RULES_TH,
    "",
    ...task,
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...[formulaRules(formula, format, length, loop, true)].filter(Boolean),
  ].join("\n");
}

/** `aim`: the piece's point and shape (sayingAims); a piece with a point is given it, not the whole topic */
export function sayingMessages(
  source: SayingSource, tone: { say: string }, reader: string, format: "post" | "script", length: Length | null, loop: boolean, formula: Formula | null,
  aim: SayingAim = { point: "", lines: "" },
): ChatMessage[] {
  const what = source.kind === "topic"
    ? [`หัวข้อ: ${source.topic.label}`, aim.point ? "" : `ใจความของหัวข้อ:\n${source.topic.brief}`]
    : [`คำคม: “${source.text}”`, ...(source.who ? [`ผู้พูด: ${source.who}`] : [])];
  return [
    { role: "system", content: sayingSystem(format, source.kind, length, loop, formula) },
    { role: "user", content: [...what, aim.lines, `วิธีเล่าของชิ้นนี้: ${tone.say}`, steerLines({ reader: reader.trim() })].filter(Boolean).join("\n\n") },
  ];
}

const FOOTER = "ทักแชทคุยกันได้เสมอ";

function sayingPoster(raw: unknown, saying: string, who: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    { kind: "badge", text: SAYING_NAME },
    { kind: "headline", text: clip(saying, MAX_CHARS.headline) },
    ...(who ? [{ kind: "sub" as const, text: `— ${who}` }] : []),
    { kind: "footer", text: footer || FOOTER },
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "center", theme, blocks })!;
}

/** One saying from a reply, or null when it has no body, or no saying where the writer was to make one. */
export function parseSayingPiece(reply: string, source: SayingSource, toneLabel: string, format: "post" | "script"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  // the agent's words stand whatever the writer sent back; the writer's own, without their quotation marks
  const saying = source.kind === "own" ? source.text : text(raw.saying).replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  if (!body || !saying) return null;
  const who = source.kind === "own" ? source.who : "";
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  return {
    hooks: [`“${saying}”${who ? ` — ${who}` : ""}`],
    angle: `${SAYING_NAME} · ${source.kind === "own" ? "พิมพ์เอง" : source.topic.label} · ${toneLabel}`,
    body,
    closing: text(raw.closing),
    hashtags: [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    // a saying sells nothing, so there is no buyer's warning to add
    disclaimer: "",
    ...(format === "script" ? {} : { poster: sayingPoster(raw.poster, saying, who) }),
    // what the saying came from stays with the piece: an edit is checked against it again
    fact: source.kind === "own" ? `คำคม: “${source.text}”${who ? ` — ${who}` : ""}` : source.topic.brief,
  };
}
