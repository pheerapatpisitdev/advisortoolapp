import { chat, parseJsonReply } from "@/lib/ai/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Speaker } from "./transcript";

/**
 * The daily review: a model reads yesterday's chats and proposes what the bot should have known.
 *
 * The owner asked for the bot to learn from its conversations (2026-09-26). A model cannot be
 * retrained by chatting, so the learning is a loop with the owner in it: this reads the
 * transcripts, writes down the questions the bot missed, got wrong, or lost the customer on,
 * and what the agent had to answer by hand — each with a proposed answer. Nothing reaches a
 * customer until the owner presses ใช้ on /admin/knowledge, which copies it into ins_faq, the
 * notes the AI already reads. Premiums never come from here: those are the rate tables'.
 */

/** the transcripts' promised life; the reviews quote them, so they go with them */
export const KEEP_DAYS = 90;
/** a first run, or one after a long gap, reads no further back than this */
const LOOKBACK_MAX_MS = 7 * 86_400_000;
const LOOKBACK_FIRST_MS = 86_400_000;
/** what is read in one go, newest threads kept; roughly ฿1-2 of Gemini Flash at most */
const MAX_CHARS = 40_000;
const MAX_ROWS = 3000;
/** what one select returns at most, whatever is asked for */
const PAGE_ROWS = 1000;
const MAX_ITEMS = 8;

/** the cheap reader the content bake-off found best value for Thai, and two like it behind it */
const REVIEWER = "gemini-3.7-flash";
const REVIEWER_FALLBACK = ["gpt-5-mini", "glm-5.3"];

export type ItemKind = "unanswered" | "wrong" | "dropoff" | "agent";
const KINDS: ItemKind[] = ["unanswered", "wrong", "dropoff", "agent"];

export interface ReviewItem {
  kind: ItemKind;
  question: string;
  evidence: string;
  answer: string;
}

export interface Row {
  at: string;
  channel: string;
  user_hash: string;
  role: Speaker;
  text: string;
  product: string | null;
}

const WHO: Record<Speaker, string> = { customer: "ลูกค้า", bot: "บอท", agent: "ตัวแทน" };

/**
 * The transcripts as one document, a thread at a time. When they are too long the oldest
 * threads are left out whole rather than every thread cut short, since a thread without its
 * end cannot say where the customer went quiet.
 */
export function transcriptDocument(rows: Row[], maxChars = MAX_CHARS): { text: string; threads: number } {
  const threads = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.channel}:${r.user_hash}`;
    threads.set(key, [...(threads.get(key) ?? []), r]);
  }
  const blocks = [...threads.values()]
    .sort((a, b) => b[b.length - 1].at.localeCompare(a[a.length - 1].at))
    .map((turns) => {
      const product = turns.map((t) => t.product).filter(Boolean).pop() ?? "ยังไม่ระบุแบบ";
      return [
        `## แชท (${turns[0].channel === "line" ? "LINE" : "Messenger"} · ${product})`,
        ...turns.map((t) => `${WHO[t.role]}: ${t.text}`),
      ].join("\n");
    });
  const kept: string[] = [];
  let size = 0;
  for (const b of blocks) {
    if (size + b.length > maxChars && kept.length > 0) break;
    kept.push(b);
    size += b.length;
  }
  return { text: kept.reverse().join("\n\n"), threads: kept.length };
}

const SYSTEM = `คุณคือผู้ช่วยตรวจงานแชทบอทของตัวแทนประกันชีวิต (กรุงไทย-แอกซ่า ประกันชีวิต) ที่ตอบลูกค้าใน Messenger และ LINE
อ่านบทสนทนาที่ให้มา แล้วหาจุดที่บอทควรทำได้ดีกว่านี้ 4 แบบ:
- unanswered: ลูกค้าถามแล้วบอทตอบไม่ได้ ตอบไม่ตรงคำถาม หรือเลี่ยง
- wrong: บอทตอบผิด ขัดกันเอง หรือพูดเกินจริง
- dropoff: ลูกค้าเงียบหายไปหลังข้อความของบอท และพอเห็นเหตุผลได้จากบทสนทนา
- agent: ตัวแทนต้องพิมพ์ตอบเองแทนบอท (นี่คือคำตอบที่ดีที่สุดให้บอทเรียนรู้)

สำหรับแต่ละจุด ให้เสนอ "บันทึกความรู้" หนึ่งข้อ:
- question: คำถามแบบที่ลูกค้าพิมพ์จริง ไม่เกิน 150 ตัวอักษร
- evidence: ข้อความสั้นๆ จากแชทที่แสดงปัญหา ไม่เกิน 200 ตัวอักษร ห้ามมีชื่อ เบอร์โทร หรือข้อมูลส่วนตัว
- answer: คำตอบที่บอทควรใช้ ภาษาสุภาพเป็นกันเองแบบตัวแทน ไม่เกิน 600 ตัวอักษร

กฎของคำตอบ:
- ห้ามแต่งตัวเลขเบี้ย ทุน มูลค่าเวนคืน หรือผลประโยชน์ที่ไม่ได้อยู่ในแชท ถ้าต้องใช้ตัวเลข ให้บอกให้ลูกค้าแจ้งอายุ เพศ ทุน เพื่อให้ระบบคิดให้
- ห้ามรับปากว่าจะรับประกันหรือจะจ่ายเคลม ห้ามเปรียบเทียบให้บริษัทอื่นเสียหาย
- ถ้าคำตอบที่ตัวแทนพิมพ์เองดีอยู่แล้ว ให้ใช้ตามนั้นโดยตัดข้อมูลส่วนตัวออก
- ถ้าต้องใช้ข้อเท็จจริงที่ไม่แน่ใจ ให้ใส่ [ตรวจ: ...] ไว้ในคำตอบ ให้ตัวแทนเติมเอง

ไม่ต้องเสนอเรื่องที่มีอยู่แล้วในรายการ "ความรู้ที่มีแล้ว" และไม่ต้องเสนอซ้ำกันเอง
เลือกเฉพาะที่สำคัญที่สุด ไม่เกิน ${MAX_ITEMS} ข้อ ถ้าไม่มีอะไรควรแก้ ให้ items เป็นรายการว่าง

ตอบเป็น JSON อย่างเดียว:
{"summary": "สรุป 2-4 บรรทัดว่าวันนี้แชทเป็นอย่างไร ลูกค้าสนใจอะไร หลุดตรงไหน", "items": [{"kind": "unanswered", "question": "...", "evidence": "...", "answer": "..."}]}`;

/** Whatever the model sent, cut down to what the table will take; anything malformed is dropped. */
export function readItems(raw: unknown): ReviewItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const kind = KINDS.includes(r.kind as ItemKind) ? (r.kind as ItemKind) : "unanswered";
    const question = typeof r.question === "string" ? r.question.trim().slice(0, 200) : "";
    const answer = typeof r.answer === "string" ? r.answer.trim().slice(0, 2000) : "";
    const evidence = typeof r.evidence === "string" ? r.evidence.trim().slice(0, 400) : "";
    if (question.length < 4 || answer.length < 4) continue;
    out.push({ kind, question, evidence, answer });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export interface ReviewResult {
  ok: boolean;
  id?: number;
  conversations: number;
  items: number;
  costThb: number;
  error?: string;
}

/** Deletes transcripts and reviews past their ninety days; the privacy page promises it. */
export async function pruneTranscripts(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  const db = supabaseAdmin();
  const [a, b] = await Promise.all([
    db.from("ins_transcripts").delete().lt("at", cutoff),
    db.from("ins_chat_reviews").delete().lt("created_at", cutoff),
  ]);
  if (a.error) console.error("old transcripts not deleted:", a.error.message);
  if (b.error) console.error("old reviews not deleted:", b.error.message);
}

/** Reads everything said since the last review (a day, the first time) and writes a new one. */
export async function runChatReview(now = new Date()): Promise<ReviewResult> {
  const db = supabaseAdmin();
  const last = await db.from("ins_chat_reviews").select("until").order("until", { ascending: false }).limit(1).maybeSingle();
  if (last.error) return { ok: false, conversations: 0, items: 0, costThb: 0, error: last.error.message };
  const floor = now.getTime() - LOOKBACK_MAX_MS;
  const from = last.data?.until ? Math.max(new Date(String(last.data.until)).getTime(), floor) : now.getTime() - LOOKBACK_FIRST_MS;
  const since = new Date(from).toISOString();
  const until = now.toISOString();

  /**
   * Newest first, a page at a time up to the cap: a busy day past it loses its oldest lines,
   * not today's — the review never comes back for either, since `until` moves on. One select
   * stops at a thousand rows whatever `limit` says, so the 3,000 was always 1,000, and the
   * oldest of them (review, 2026-10-11). Read back in the order they were said.
   */
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_ROWS) {
    const { data, error } = await db.from("ins_transcripts")
      .select("at, channel, user_hash, role, text, product")
      .gte("at", since).lt("at", until)
      .order("at", { ascending: false }).order("id", { ascending: false })
      .range(from, Math.min(from + PAGE_ROWS, MAX_ROWS) - 1);
    if (error) return { ok: false, conversations: 0, items: 0, costThb: 0, error: error.message };
    const got = (data ?? []) as Row[];
    rows.push(...got);
    if (got.length < PAGE_ROWS) break;
  }
  rows.reverse();

  const save = async (review: { conversations: number; summary: string; model: string | null; costThb: number }, items: ReviewItem[]) => {
    const ins = await db.from("ins_chat_reviews").insert({
      since, until, conversations: review.conversations, summary: review.summary, model: review.model, cost_thb: review.costThb,
    }).select("id").single();
    if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "no review row");
    const id = Number((ins.data as { id: number }).id);
    if (items.length) {
      const put = await db.from("ins_chat_review_items").insert(items.map((i) => ({ review_id: id, ...i })));
      if (put.error) throw new Error(put.error.message);
    }
    return id;
  };

  // a quiet day is written down too, so the page can say the review ran and found nothing
  if (!rows.some((r) => r.role === "customer")) {
    const id = await save({ conversations: 0, summary: "ไม่มีแชทใหม่จากลูกค้าในช่วงนี้", model: null, costThb: 0 }, []);
    return { ok: true, id, conversations: 0, items: 0, costThb: 0 };
  }

  const doc = transcriptDocument(rows);
  const notes = await db.from("ins_faq").select("question").eq("enabled", true).limit(300);
  const known = ((notes.data ?? []) as { question: string }[]).map((n) => `- ${n.question}`).join("\n") || "(ยังไม่มี)";

  const r = await chat({
    tier: "large", task: "chat-review", json: true, maxTokens: 4000, timeoutMs: 90_000,
    prefer: REVIEWER, within: REVIEWER_FALLBACK,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `ความรู้ที่มีแล้ว:\n${known}\n\nบทสนทนา ${doc.threads} แชท:\n\n${doc.text}` },
    ],
  });
  const parsed = parseJsonReply<{ summary?: unknown; items?: unknown }>(r.text);
  const summary = typeof parsed?.summary === "string" && parsed.summary.trim()
    ? parsed.summary.trim().slice(0, 1000)
    : "อ่านแชทแล้ว แต่สรุปไม่สำเร็จ ลองกดสรุปใหม่อีกครั้ง";
  const items = readItems(parsed?.items);
  const id = await save({ conversations: doc.threads, summary, model: r.model, costThb: r.costThb }, items);
  return { ok: true, id, conversations: doc.threads, items: items.length, costThb: r.costThb };
}
