import { chat } from "@/lib/ai/client";
import { parseJsonReply } from "@/lib/ai/json-reply";
import { allowedNumbers, numbersIn } from "./brief";
import { POST_TONES, readTone, readVoice, type PostTone, type PostVoice } from "./post-tones";
import type { QuoteVideoFacts } from "./script";
import { factLines } from "./writer";

/**
 * The words that go up with a clip (owner, 2026-10-15, mockup https://claude.ai/artifact/8B39tj4VDgrd9RsdCC23RL,
 * option ก: free, three writes a clip). A small model writes a Page post from the clip's own facts;
 * a clip with a customer's name, or an FHC summary, gets a chat message to that customer instead,
 * since it never goes on a Page.
 *
 * Every figure is checked against the clip's: what fails is asked for once more with the reason,
 * what fails again is not given — the agent presses again, and the try is not counted.
 */

export const POST_TASK = "quote-video-post";
export { POST_TRIES } from "./post-tones";
const POST_MAX = 1200;
const TIMEOUT_MS = 20_000;

export interface PostText {
  text: string;
  tone: PostTone;
  voice: PostVoice;
  /** a Page post, or a chat message to the one customer */
  kind: "post" | "customer";
  /** writes used, of POST_TRIES */
  tries: number;
  writtenAt: string;
}

export function readPostText(raw: unknown): PostText | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.text !== "string" || !r.text.trim()) return null;
  return {
    text: r.text,
    tone: readTone(r.tone),
    voice: readVoice(r.voice),
    kind: r.kind === "customer" ? "customer" : "post",
    tries: Number.isInteger(r.tries) ? Math.max(0, Number(r.tries)) : 1,
    writtenAt: typeof r.writtenAt === "string" ? r.writtenAt : "",
  };
}

/** What a clip's words are written from. */
export interface PostBasis {
  kind: "post" | "customer";
  /** the clip's facts, one a line */
  facts: string[];
  /** every figure the words may say */
  allowed: Set<number>;
  /** the product's own word rules (brief.ts), for a quote clip */
  product?: QuoteVideoFacts["product"];
  /** iShield / Protection Life details the rules need */
  plbTax?: boolean;
  /** the customer the message is to, as the clip names them */
  customer?: string;
  /** another language than Thai: the clip's */
  lang?: string;
  /** what the clip is, in a few words */
  about: string;
}

/** a quote clip's: the same facts its voice was written from */
export function quoteBasis(f: QuoteVideoFacts, customer: string, lang?: string): PostBasis {
  return {
    kind: customer ? "customer" : "post",
    facts: factLines(f),
    allowed: allowedNumbers(f),
    product: f.product,
    plbTax: f.plb?.tax,
    customer: customer || undefined,
    lang,
    about: `คลิปนำเสนอแบบประกัน ${f.planLine}`,
  };
}

/** a story clip's or an FHC summary's: facts given as lines, the figures read off them */
export function linesBasis(kind: "post" | "customer", about: string, facts: string[], customer?: string, noFigures = false): PostBasis {
  const allowed = new Set<number>([1, 2, 3]);
  if (!noFigures) for (const l of facts) for (const n of numbersIn(l)) allowed.add(n);
  for (const n of [...allowed]) if (n >= 1_000_000 && n % 100_000 === 0) allowed.add(n / 1_000_000);
  return { kind, facts, allowed, customer, about };
}

const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /%|เปอร์เซ็นต์|ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล/, why: "พูดถึงผลตอบแทน" },
  { re: /การันตี|รับประกันผล|แน่นอน 100|ไม่มีความเสี่ยง/, why: "สัญญาเกินแบบประกัน" },
  { re: /[๐-๙]/, why: "ใช้เลขไทย" },
  { re: /(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ยี่สิบ)\s*(ล้าน|แสน|หมื่น|พัน|ร้อย)/, why: "เขียนตัวเลขเป็นคำ" },
  { re: /https?:|www\.|\.com\b/, why: "มีลิงก์" },
];

/** why the words cannot be given, or null when they can */
export function postProblem(text: string, b: PostBasis): string | null {
  const t = text.trim();
  if (t.length < 20) return "สั้นเกินไป";
  if (t.length > POST_MAX) return `ยาวเกิน ${POST_MAX} ตัวอักษร`;
  for (const x of FORBIDDEN) if (x.re.test(t)) return x.why;
  if (b.product === "ISHIELD" && /รับเลย|ได้เลยตั้งแต่วันแรก/.test(t)) return "สัญญาว่ารับได้ตั้งแต่วันแรก";
  if (b.product === "LEGACY" && /ออม|เงินคืน|ขอคืน/.test(t)) return "ใช้คำว่า ออม หรือเงินคืน (แบบนี้ใช้คำว่า ค่าใช้จ่าย)";
  if (b.product === "PLB") {
    if (/ออม|เงินคืน|ขอคืน|ได้คืน/.test(t)) return "ใช้คำว่า ออม หรือเงินคืน (แบบนี้ใช้คำว่า ค่าใช้จ่าย)";
    if (/รอคอย|ระยะรอ|ตั้งแต่วันนี้|ตั้งแต่วันแรก|คุ้มครองเลย/.test(t)) return "พูดถึงระยะรอคอย หรือสัญญาว่าคุ้มครองตั้งแต่วันแรก";
    if (!b.plbTax && /ภาษี/.test(t)) return "ระยะ 5 ปี ไม่พูดเรื่องลดหย่อนภาษี";
  }
  // a hashtag's digits are a tag, not a figure
  const said = numbersIn(t.replace(/#\S+/g, ""));
  const stray = said.find((n, i, all) => !b.allowed.has(n) && !(i > 0 && all[i - 1] === n * 1_000_000));
  if (stray !== undefined) return `มีตัวเลข ${stray.toLocaleString("en-US")} ที่ไม่อยู่ในคลิป`;
  return null;
}

function prompt(b: PostBasis, tone: PostTone, voice: PostVoice, fix?: string): string {
  const t = POST_TONES.find((x) => x.tone === tone)!;
  const thai = !b.lang;
  const end = voice === "F" ? "ค่ะ หรือ คะ (คำถาม)" : "ครับ";
  const words = b.product === "LEGACY" || b.product === "PLB"
    ? "- แบบนี้ไม่มีเงินคืน ห้ามใช้คำว่า ออม เงินคืน ใช้ \"ค่าใช้จ่าย\" แทน"
    : "";
  const what = b.kind === "post"
    ? [
      `เขียนข้อความโพสต์ Facebook ที่ตัวแทนประกันจะโพสต์คู่กับคลิปนี้ ${thai ? "เป็นภาษาไทย" : `เป็นภาษา ${b.lang} ทั้งหมด`}`,
      `โทน: ${t.hint}`,
      "รูปแบบ: เปิดด้วยประโยคดึงความสนใจ 1 บรรทัด ตามด้วยจุดเด่น 2–4 ข้อ (ขึ้นบรรทัดใหม่ทีละข้อ ใช้อีโมจิได้ไม่เกิน 4 ตัวทั้งโพสต์) ปิดด้วยชวนให้ดูคลิปและทักแชท แล้วแฮชแท็ก 2–4 อัน",
      tone === "short" ? "ยาวไม่เกิน 3 บรรทัด ไม่รวมแฮชแท็ก" : "ยาวไม่เกิน 10 บรรทัด",
    ]
    : [
      `เขียนข้อความแชทที่ตัวแทนประกันจะส่งให้ลูกค้า${b.customer ? ` (คุณ${b.customer})` : ""} พร้อมคลิปนี้ ${thai ? "เป็นภาษาไทย" : `เป็นภาษา ${b.lang} ทั้งหมด`}`,
      `โทน: ${t.hint}`,
      `รูปแบบ: ${b.customer ? `ทักชื่อ "คุณ${b.customer}"` : "ทักลูกค้าสั้นๆ"} บอกว่าส่งคลิปนี้มาให้ดู สรุปสิ่งสำคัญ 1–3 ประโยค แล้วชวนถามถ้ามีข้อสงสัย ไม่มีแฮชแท็ก อีโมจิได้ไม่เกิน 2 ตัว`,
      tone === "short" ? "ยาวไม่เกิน 3 บรรทัด" : "ยาวไม่เกิน 6 บรรทัด",
    ];
  return [
    ...what,
    ...(thai ? [`ตัวแทนเป็น${voice === "F" ? "ผู้หญิง" : "ผู้ชาย"} ลงท้าย ${end}`] : []),
    "",
    `คลิปนี้: ${b.about}`,
    "ข้อมูลในคลิป (ใช้ได้เฉพาะตัวเลขในนี้ เขียนเป็นตัวเลขอารบิก เช่น 79 หรือ 2 ล้าน):",
    ...b.facts.map((l) => `- ${l}`),
    "",
    "กฎ:",
    "- ห้ามใส่ตัวเลขที่ไม่อยู่ในข้อมูล ห้ามเขียนตัวเลขเป็นคำ ห้ามเลขไทย",
    "- ห้ามพูดถึงผลตอบแทน ดอกเบี้ย เปอร์เซ็นต์ กำไร ห้ามใช้คำว่า การันตี",
    "- ห้ามสัญญาเกินแบบประกัน ห้ามใส่ลิงก์ ห้ามใส่เบอร์โทร",
    ...(words ? [words] : []),
    ...(fix ? ["", `รอบก่อนใช้ไม่ได้ เพราะ${fix} แก้ให้ถูก`] : []),
    "",
    'ตอบเป็น JSON object เดียว: {"text": "ข้อความทั้งหมด ขึ้นบรรทัดใหม่ด้วย \\n"}',
  ].join("\n");
}

const tidy = (v: unknown): string => (typeof v === "string"
  ? v.replace(/\r/g, "").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  : "");

/** The words for a clip, or null when the model could not write words that pass. */
export async function writePost(b: PostBasis, tone: PostTone, voice: PostVoice): Promise<string | null> {
  let fix: string | undefined;
  for (let round = 0; round < 2; round++) {
    try {
      const r = await chat({
        tier: "small", task: POST_TASK, json: true, maxTokens: 900, timeoutMs: TIMEOUT_MS,
        messages: [{ role: "user", content: prompt(b, tone, voice, fix) }],
      });
      const text = tidy(parseJsonReply<{ text?: unknown }>(r.text)?.text);
      const bad = postProblem(text, b);
      if (!bad) return text;
      fix = bad;
    } catch (e) {
      console.error("clip post not written:", e instanceof Error ? e.message : "unknown error");
      return null;
    }
  }
  return null;
}
