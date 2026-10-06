import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/json-reply";
import { DISCLAIMER, type ContentOutput } from "./output";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Length } from "./prompt";
import { formulaRules, type Formula } from "./formula";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";
import { MAX_DOCS, scrub, toBox, type Box } from "./claim";

/**
 * โชว์ผลงาน (owner, 2026-10-06): screenshots from the insurer's app — a premium receipt, a policy
 * issued, a ranking — read by a model, and a post written from what was read to make the Page
 * believable. The same two calls as รีวิวเคลม (claim.ts): the first reads the pictures and boxes
 * whatever names someone or shows the agent's own income, the page blacks the boxes out and the
 * owner checks every one (ClaimPaperCheck) before a picture may go to a Page; the second writes
 * from the facts alone and never sees a picture.
 *
 * What sets it apart is what it may not say. No income figure of any kind — a commission slip is
 * the likeliest thing to be dropped in here, and the owner's rule (and คปภ.'s) forbids showing
 * one: the reader boxes such figures like names, and the writer's rules plus policy.ts's
 * recruiting rules refuse them in the words. It does not ask anyone to join the team either.
 * Browser-safe: nothing here calls a model.
 */

/** the pieces' plan_href: a showcase piece belongs to no plan */
export const SHOWCASE_HREF = "showcase";
export const SHOWCASE_NAME = "โชว์ผลงาน";

export { MAX_DOCS };
/** the pictures from the app are the proof, so they cover this share of the poster's area (owner, 2026-10-07) */
export const SHOWCASE_PAPER_SHARE = 0.4;
export const MAX_SHOWCASE_PIECES = 3;
export const MAX_SHOWCASE_CUSTOM = 120;

export const SHOWCASE_KINDS = [
  { id: "receipt", label: "ใบเสร็จ/หลักฐานชำระเบี้ย" },
  { id: "policy", label: "กรมธรรม์ออกแล้ว/อนุมัติ" },
  { id: "rank", label: "อันดับ/รางวัล/ผลงานในแอป" },
  { id: "other", label: "อื่นๆ" },
] as const;
export type ShowcaseKind = (typeof SHOWCASE_KINDS)[number]["id"];

/** What the post may say. Words, as the picture shows them — never a name, never an amount of money. */
export interface ShowcaseFacts {
  kind: ShowcaseKind;
  /** what the pictures show, in everyday words: "กรมธรรม์ประกันสุขภาพของลูกค้าออกแล้ว" */
  what: string;
  /** a count or a rank as printed: "12 กรมธรรม์", "อันดับ 3 ของทีม" */
  figure: string;
  /** when, loosely: "เดือนนี้", "ไตรมาสที่ผ่านมา" — never a date */
  period: string;
  /** the kind of cover in everyday words: "ประกันสุขภาพ" — never a plan's name */
  cover: string;
  /** "ลูกค้าวัย 30+" — never a name */
  who: string;
  /** one line the owner adds */
  note: string;
}

export const FACT_LIMIT: Record<Exclude<keyof ShowcaseFacts, "kind">, number> = {
  what: 80, figure: 30, period: 40, cover: 40, who: 40, note: 200,
};

export interface ShowcaseDocRead {
  kind: ShowcaseKind;
  boxes: Box[];
}

export interface ShowcaseRead {
  facts: ShowcaseFacts;
  docs: ShowcaseDocRead[];
}

/** Facts from anywhere — the model's reply, the owner's form — made safe to write from. */
export function cleanShowcaseFacts(input: unknown): ShowcaseFacts {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const words = (k: keyof typeof FACT_LIMIT) => (typeof r[k] === "string" ? scrub(r[k] as string).slice(0, FACT_LIMIT[k]) : "");
  return {
    kind: SHOWCASE_KINDS.some((k) => k.id === r.kind) ? (r.kind as ShowcaseKind) : "other",
    what: words("what"),
    figure: words("figure"),
    period: words("period"),
    cover: words("cover"),
    who: words("who"),
    note: words("note"),
  };
}

/** The facts as the lines the writer is given — and the yardstick every number in the piece is checked against. */
export function showcaseFactsBlock(f: ShowcaseFacts): string {
  const kind = SHOWCASE_KINDS.find((k) => k.id === f.kind)?.label ?? "";
  return [
    `ประเภทผลงาน: ${kind}`,
    f.what && `สิ่งที่เห็นในรูป: ${f.what}`,
    f.figure && `ตัวเลข/อันดับที่เห็น: ${f.figure}`,
    f.period && `ช่วงเวลา: ${f.period}`,
    f.cover && `ความคุ้มครอง: ${f.cover}`,
    f.who && `ลูกค้า: ${f.who}`,
    f.note && `เจ้าของเพจเล่าเพิ่ม: ${f.note}`,
  ].filter(Boolean).join("\n");
}

/** Facts with nothing to tell: nothing read and nothing from the owner is no story. */
export function showcaseTooThin(f: ShowcaseFacts): boolean {
  return !f.what && !f.figure && !f.note;
}

/* -------------------------------- reading -------------------------------- */

const READ_SYSTEM = [
  "คุณอ่านภาพหน้าจอจากแอปของบริษัทประกันชีวิต/สุขภาพของไทย ที่ตัวแทนอยากเอาไปโชว์ผลงานบนเพจ (ใบเสร็จหรือหลักฐานการชำระเบี้ย กรมธรรม์ออกแล้ว หน้าอนุมัติ อันดับ รางวัล ผลงานในแอป)",
  "งานมี 2 อย่าง:",
  "1. สรุปว่ารูปเหล่านี้แสดงอะไร (รวมจากทุกรูป) — ห้ามใส่ชื่อคน ชื่อบริษัท ชื่อแบบประกัน เลขกรมธรรม์ วันที่ และห้ามใส่จำนวนเงินทุกชนิด",
  "2. หาตำแหน่งทุกจุดในแต่ละรูปที่ต้องถมดำ: ชื่อ-นามสกุลของใครก็ตาม เลขบัตรประชาชน เบอร์โทร อีเมล ที่อยู่ เลขกรมธรรม์ เลขบัญชี QR/บาร์โค้ด ลายเซ็น รูปถ่ายบุคคล",
  "   และ “ตัวเลขรายได้ของตัวแทน” ทุกจุด: ค่าคอมมิชชัน โบนัส รายได้ ยอดรับเงิน ยอดจ่ายให้ตัวแทน (ทั้งตัวเลขและป้ายกำกับของมัน)",
  "   หาให้ครบทุกจุด ถ้าไม่แน่ใจให้ใส่กรอบไว้ก่อน กรอบใหญ่กว่าข้อความเล็กน้อย",
  "   กรอบเป็น box_2d = [ymin, xmin, ymax, xmax] สเกล 0–1000 ของความสูงและความกว้างรูป",
  "",
  "ตอบเป็น JSON อย่างเดียว ตามรูปแบบนี้:",
  '{"facts":{"kind":"receipt|policy|rank|other","what":"รูปนี้แสดงอะไร เป็นคำง่ายๆ","figure":"จำนวนหรืออันดับที่เห็น เช่น 12 กรมธรรม์","period":"ช่วงเวลาแบบกว้างๆ","cover":"ประเภทความคุ้มครองเป็นคำง่ายๆ","who":"ลูกค้าวัยประมาณไหน ไม่ใช่ชื่อ"},',
  '"docs":[{"kind":"receipt|policy|rank|other","boxes":[{"label":"ชื่อลูกค้า","box_2d":[0,0,0,0]}]}]}',
  "- docs เรียงตามลำดับรูปที่ได้รับ จำนวนเท่ากับจำนวนรูปพอดี",
  "- figure คัดลอกตามที่พิมพ์ในรูป ถ้าไม่มีให้ใส่ \"\" ห้ามใส่จำนวนเงิน",
  "- ถ้ารูปเป็นเอกสารรายได้หรือค่าคอมของตัวแทน ให้ kind เป็น other และ what ให้บอกแค่ว่าเป็นหน้าสรุปผลงาน ไม่ต้องบอกจำนวนเงินใดๆ",
  "- ถ้าไม่มีข้อมูลช่องไหนให้ใส่ \"\"",
].join("\n");

export function showcaseReadMessages(count: number): ChatMessage[] {
  return [
    { role: "system", content: READ_SYSTEM },
    { role: "user", content: `ภาพจากแอป ${count} รูป เรียงตามลำดับ` },
  ];
}

/**
 * The reply as facts and one read per picture, or null when it is not JSON at all. A picture the
 * reply left out gets no boxes — the owner sees it bare and must bar it by hand before ticking
 * it; nothing is assumed safe.
 */
export function parseShowcaseRead(reply: string, count: number): ShowcaseRead | null {
  const raw = parseJsonReply<{ facts?: unknown; docs?: unknown }>(reply);
  if (!raw) return null;
  const docs = Array.isArray(raw.docs) ? raw.docs : [];
  return {
    facts: cleanShowcaseFacts(raw.facts),
    docs: Array.from({ length: count }, (_, i): ShowcaseDocRead => {
      const d = (docs[i] && typeof docs[i] === "object" ? docs[i] : {}) as Record<string, unknown>;
      const boxes = (Array.isArray(d.boxes) ? d.boxes : []).flatMap((b) => {
        const box = toBox(b && typeof b === "object" ? (b as Record<string, unknown>).box_2d : null);
        return box ? [box] : [];
      });
      return { kind: SHOWCASE_KINDS.some((k) => k.id === d.kind) ? (d.kind as ShowcaseKind) : "other", boxes };
    }),
  };
}

/* -------------------------------- writing -------------------------------- */

/**
 * The ways a result can be told. Left to the AI, a round takes the first three in turn; picked,
 * every piece takes that one and they differ by how they open (OPENERS).
 */
export const SHOWCASE_ANGLES = [
  { id: "plain", label: "เล่าตรงๆ", say: "บอกตรงๆ ว่ารูปนี้แสดงอะไร และมันหมายความว่าอย่างไรสำหรับลูกค้า ไม่โอ้อวด ไม่เปรียบเทียบกับใคร" },
  { id: "thanks", label: "ขอบคุณลูกค้า", say: "เปิดด้วยคำขอบคุณลูกค้าที่ไว้วางใจ แล้วจึงบอกว่าผลงานนี้เกิดขึ้นเพราะความไว้ใจนั้น" },
  { id: "steps", label: "ทำให้มั่นใจ", say: "เล่าสิ่งที่เห็นในรูปให้คนอ่านตรวจสอบได้เอง เช่น เห็นอะไรในแอป หมายความว่าอย่างไร พูดเฉพาะที่อยู่ในข้อมูล ห้ามบรรยายขั้นตอนอนุมัติ การตรวจสอบ หรือความรู้สึกต่อแอปที่ไม่มีในข้อมูล" },
  { id: "intent", label: "ความตั้งใจของคนทำงาน", say: "พูดถึงความตั้งใจในการดูแลลูกค้าให้ดี โดยใช้ผลงานในข้อมูลเป็นหลักฐาน ห้ามแต่งเหตุการณ์ที่ไม่มีในข้อมูล" },
] as const;
export type ShowcaseAngleId = (typeof SHOWCASE_ANGLES)[number]["id"];

const OPENERS = [
  "เปิดด้วยข้อเท็จจริงที่หนักแน่นที่สุดในข้อมูล",
  "เปิดด้วยคำถามที่คนอ่านต้องหยุดคิด",
  "เปิดด้วยความรู้สึกของคนทำงานที่ได้เห็นผลงานนี้",
];

export interface ShowcaseSteer {
  /** an angle id, "custom" for the owner's own, or "" to leave it to the AI */
  angle?: string;
  custom?: string;
  reader?: string;
}

/** Each piece's angle line, in order: the AI's turn-taking, or the owner's one angle opened three ways. */
export function showcaseAngleLines(steer: ShowcaseSteer, count: number): { label: string; say: string }[] {
  const custom = (steer.custom ?? "").trim().slice(0, MAX_SHOWCASE_CUSTOM);
  const picked = steer.angle === "custom" && custom
    ? { label: custom, say: custom }
    : SHOWCASE_ANGLES.find((a) => a.id === steer.angle);
  return Array.from({ length: count }, (_, i) => {
    if (!picked) return SHOWCASE_ANGLES[i % MAX_SHOWCASE_PIECES];
    return count > 1 ? { label: picked.label, say: `${picked.say}\n${OPENERS[i % OPENERS.length]}` } : picked;
  });
}

/** A showcase is a post or a clip; it is never an ad. */
export const showcaseFormat = (format: unknown): "post" | "script" => (format === "script" ? "script" : "post");

const WRITE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. ใช้เฉพาะข้อเท็จจริงใน “ข้อมูลผลงาน” ห้ามเติมเหตุการณ์ ความรู้สึก หรือรายละเอียดที่ไม่มีในข้อมูล และห้ามอ้างจำนวนลูกค้าหรืออันดับที่ไม่มีในข้อมูล",
  "2. ตัวเลขทุกตัวต้องคัดลอกจากข้อมูลตรงตัว ห้ามคำนวณ ห้ามปัดเศษ ห้ามใส่จำนวนเงินทุกชนิด (เบี้ย ค่าคอม รายได้ โบนัส)",
  "3. ห้ามใส่ชื่อคน ชื่อบริษัท ชื่อแบบประกัน เลขกรมธรรม์ วันที่ หรือข้อมูลใดที่ทำให้รู้ว่าลูกค้าคนไหน",
  "4. ห้ามบอกชื่อแบบประกันหรือแนะนำแบบประกันใดๆ งานนี้โชว์ผลงานเพื่อให้คนเชื่อถือ ไม่ขายแบบประกัน",
  "5. ห้ามเขียนเรื่องรายได้ของตัวแทน ห้ามชวนคนมาสมัครเป็นตัวแทนหรือร่วมทีม",
  "6. ห้ามคำโฆษณาเกินจริง เช่น การันตี ดีที่สุด อันดับหนึ่ง (ถ้าไม่มีในข้อมูล) และห้ามสัญญาว่าลูกค้าคนต่อไปจะได้ผลเหมือนกัน",
  "7. ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันหรือตัวแทนคนอื่น",
  "8. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "9. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า ผม ฉัน หนู (ใช้ “เรา” หรือเขียนเป็นประโยคที่ไม่มีประธาน)",
  "10. ปิดท้ายด้วยการบอกว่าทักแชทมาคุยหรือสอบถามได้เสมอ โดยไม่เร่งหรือกดดัน",
  "",
  POLICY_RULES_TH,
].join("\n");

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังหลังรูปหน้าจอ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ บรรยากาศอบอุ่นน่าเชื่อถือ ห้ามมีตัวหนังสือในภาพ",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว ตัวเลขต้องมาจากข้อมูล ห้ามมีจำนวนเงิน",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร เช่น ชวนทักแชท",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';
const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

export function showcaseSystem(format: "post" | "script", length: Length | null = null, loop = false, formula: Formula | null = null): string {
  const task = format === "post"
    ? [
        "งาน: โพสต์เฟซบุ๊กโชว์ผลงานจริงจากแอป ให้คนอ่านเชื่อถือ",
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
        "- hook: ประโยคเปิด 1 บรรทัด หยุดนิ้วคนเลื่อนฟีด",
        "- body: 4–9 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
        "- closing: 1–2 บรรทัด บอกว่าทักแชทมาสอบถามได้เสมอ",
        "- hashtags: 3–5 แท็ก เช่น #ผลงานจริง",
        ...POSTER_LINES,
      ]
    : [
        `งาน: สคริปต์พูดหน้ากล้อง โชว์ผลงานจริงจากแอป ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
        "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
        '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
        "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] ต้องหยุดคนดูให้ได้",
        "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ทิศทางภาพในวงเล็บกลม",
        "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม บอกว่าทักแชทมาสอบถามได้เสมอ",
        "- hashtags: 3–5 แท็ก สำหรับแคปชันใต้คลิป",
      ];
  return [
    "คุณคือนักเขียนคอนเทนต์ให้ตัวแทนประกันชีวิตในประเทศไทย งานคือเล่าผลงานจริงให้น่าเชื่อถืออย่างสุภาพ ไม่โอ้อวด ภาษาไทยแบบที่คนทั่วไปพูดกัน",
    "",
    WRITE_RULES,
    "",
    ...task,
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    ...[formulaRules(formula, format, length, loop, true)].filter(Boolean),
  ].join("\n");
}

export function showcaseMessages(
  facts: ShowcaseFacts, angle: { say: string }, reader: string, format: "post" | "script", length: Length | null, loop: boolean, formula: Formula | null,
): ChatMessage[] {
  return [
    { role: "system", content: showcaseSystem(format, length, loop, formula) },
    {
      role: "user",
      content: [
        `ข้อมูลผลงาน (เรื่องจริง ลูกค้ายินยอมให้เล่าแล้ว):\n${showcaseFactsBlock(facts)}`,
        `มุมของโพสต์นี้: ${angle.say}`,
        steerLines({ reader: reader.trim() }),
      ].filter(Boolean).join("\n\n"),
    },
  ];
}

const BADGE: Record<ShowcaseKind, string> = {
  receipt: "ลูกค้าไว้วางใจ", policy: "กรมธรรม์ออกแล้ว", rank: "ผลงานจริง", other: "ผลงานจริง",
};
const FOOTER = "ทักแชทสอบถามได้เลย";

/** The poster: a fixed badge for the kind, the writer's headline, the figure from the facts (never the writer), a footer. */
export function showcasePoster(raw: unknown, facts: ShowcaseFacts, hook: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    { kind: "badge", text: BADGE[facts.kind] },
    { kind: "headline", text: headline },
    ...(facts.figure ? [{ kind: "sub" as const, text: facts.figure }] : []),
    { kind: "footer", text: footer || FOOTER },
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "top", theme, blocks, paperShare: SHOWCASE_PAPER_SHARE })!;
}

/** One showcase piece from a reply, or null when the reply has no hook or body. */
export function parseShowcasePiece(reply: string, facts: ShowcaseFacts, angleLabel: string, format: "post" | "script"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  return {
    hooks: [hook],
    angle: `${SHOWCASE_NAME} · ${angleLabel}`,
    body,
    closing: text(raw.closing),
    hashtags: [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: DISCLAIMER,
    // a script is spoken, and has no poster; the pictures go on a post's
    ...(format === "script" ? {} : { poster: showcasePoster(raw.poster, facts, hook) }),
    // the facts stay with the piece: an edit is checked against them again
    fact: showcaseFactsBlock(facts),
  };
}
