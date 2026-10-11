import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Row } from "@/lib/chat/review";

/** a hand-built Supabase: each table answers from these, and every write is kept */
let transcripts: Row[] = [];
let lastUntil: string | null = null;
const reviews: Record<string, unknown>[] = [];
const items: Record<string, unknown>[] = [];

function query(table: string) {
  let newestFirst = false;
  let bounds: [number, number] | null = null;
  const q = {
    select: () => q, eq: () => q, gte: () => q, lt: () => q, limit: () => q,
    order: (col: string, o?: { ascending?: boolean }) => { if (col === "at") newestFirst = o?.ascending === false; return q; },
    range: (from: number, to: number) => { bounds = [from, to]; return q; },
    maybeSingle: async () => ({ data: table === "ins_chat_reviews" && lastUntil ? { until: lastUntil } : null, error: null }),
    insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
      if (table === "ins_chat_reviews") {
        reviews.push(rows as Record<string, unknown>);
        return { select: () => ({ single: async () => ({ data: { id: reviews.length }, error: null }) }) };
      }
      items.push(...(rows as Record<string, unknown>[]));
      return Promise.resolve({ error: null });
    },
    then: (resolve: (v: unknown) => void) => resolve({
      data: table === "ins_transcripts" ? readTranscripts(newestFirst, bounds) : table === "ins_faq" ? [{ question: "ลดหย่อนภาษีได้ไหม" }] : [],
      error: null,
    }),
  };
  return q;
}
/** as the database answers: in the order asked for, a thousand rows at most */
function readTranscripts(newestFirst: boolean, bounds: [number, number] | null): Row[] {
  const ordered = [...transcripts].sort((a, b) => a.at.localeCompare(b.at));
  if (newestFirst) ordered.reverse();
  const [from, to] = bounds ?? [0, 999];
  return ordered.slice(from, Math.min(to, from + 999) + 1);
}
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: query }) }));

const chat = vi.fn();
vi.mock("@/lib/ai/client", async () => ({
  ...await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client"),
  chat: (...a: unknown[]) => chat(...a),
}));

const { readItems, runChatReview, transcriptDocument } = await import("@/lib/chat/review");

const row = (user: string, role: Row["role"], text: string, at: string): Row =>
  ({ at, channel: "facebook", user_hash: user, role, text, product: "lifeprotect" });

beforeEach(() => {
  transcripts = []; lastUntil = null; reviews.length = 0; items.length = 0;
  chat.mockReset();
});

describe("transcriptDocument", () => {
  it("writes each thread together, with who said what", () => {
    const doc = transcriptDocument([
      row("a", "customer", "สวัสดี", "2026-09-25T01:00:00Z"),
      row("b", "customer", "ขอเบี้ย", "2026-09-25T01:01:00Z"),
      row("a", "bot", "สวัสดีครับ", "2026-09-25T01:02:00Z"),
      row("a", "agent", "เดี๋ยวโทรหาครับ", "2026-09-25T01:03:00Z"),
    ]);
    expect(doc.threads).toBe(2);
    expect(doc.text).toContain("ลูกค้า: สวัสดี\nบอท: สวัสดีครับ\nตัวแทน: เดี๋ยวโทรหาครับ");
  });

  it("leaves out the oldest threads whole when there is too much", () => {
    const doc = transcriptDocument([
      row("old", "customer", "old-".repeat(75), "2026-09-25T01:00:00Z"),
      row("new", "customer", "new-".repeat(75), "2026-09-25T05:00:00Z"),
    ], 400);
    expect(doc.threads).toBe(1);
    expect(doc.text).toContain("new-");
    expect(doc.text).not.toContain("old-");
  });
});

describe("readItems", () => {
  it("keeps well-formed proposals and drops the rest", () => {
    const got = readItems([
      { kind: "agent", question: "จ่ายผ่านบัตรเครดิตได้ไหม", evidence: "ตัวแทน: ได้ครับ", answer: "ได้ครับ ตัดบัตรได้ทุกเดือน" },
      { kind: "made-up", question: "ถามอะไร", answer: "ตอบอะไรสักอย่าง" },
      { question: "", answer: "ไม่มีคำถาม" },
      "not an object",
    ]);
    expect(got).toHaveLength(2);
    expect(got[0].kind).toBe("agent");
    // an unknown kind is kept as the most common one rather than thrown away
    expect(got[1].kind).toBe("unanswered");
  });

  it("is empty for anything that is not a list", () => {
    expect(readItems(undefined)).toEqual([]);
  });
});

describe("runChatReview", () => {
  it("writes a quiet day down without asking a model", async () => {
    const r = await runChatReview(new Date("2026-09-26T01:00:00Z"));
    expect(r).toMatchObject({ ok: true, conversations: 0, items: 0 });
    expect(chat).not.toHaveBeenCalled();
    expect(reviews[0].summary).toContain("ไม่มีแชทใหม่");
  });

  it("reads the day, tells the model what it already knows, and keeps its proposals", async () => {
    transcripts = [
      row("a", "customer", "จ่ายผ่านบัตรเครดิตได้ไหม", "2026-09-25T03:00:00Z"),
      row("a", "bot", "ขออายุ เพศ ทุนครับ", "2026-09-25T03:00:05Z"),
      row("a", "agent", "ได้ครับ ตัดบัตรได้", "2026-09-25T03:10:00Z"),
    ];
    chat.mockResolvedValue({
      text: JSON.stringify({ summary: "ลูกค้าถามเรื่องบัตรเครดิต", items: [{ kind: "agent", question: "จ่ายผ่านบัตรเครดิตได้ไหม", evidence: "ตัวแทนตอบเอง", answer: "ได้ครับ ตัดบัตรเครดิตได้" }] }),
      model: "gemini-3.7-flash", provider: "google", inputTokens: 1000, outputTokens: 200, costThb: 0.12,
    });
    const r = await runChatReview(new Date("2026-09-26T01:00:00Z"));
    expect(r).toMatchObject({ ok: true, conversations: 1, items: 1 });
    const prompt = chat.mock.calls[0][0].messages[1].content as string;
    expect(prompt).toContain("- ลดหย่อนภาษีได้ไหม");
    expect(prompt).toContain("ตัวแทน: ได้ครับ ตัดบัตรได้");
    expect(chat.mock.calls[0][0]).toMatchObject({ task: "chat-review", prefer: "gemini-3.7-flash", json: true });
    expect(reviews[0]).toMatchObject({ summary: "ลูกค้าถามเรื่องบัตรเครดิต", conversations: 1, cost_thb: 0.12 });
    expect(items[0]).toMatchObject({ review_id: 1, kind: "agent", answer: "ได้ครับ ตัดบัตรเครดิตได้" });
  });

  it("keeps a busy day's newest lines past a thousand, in the order they were said (review, 2026-10-11)", async () => {
    transcripts = Array.from({ length: 3_200 }, (_, i) =>
      row(`u${Math.floor(i / 2)}`, i % 2 ? "bot" : "customer", `ข้อความ ${i}`, new Date(Date.parse("2026-09-25T00:00:00Z") + i * 1000).toISOString()));
    chat.mockResolvedValue({ text: JSON.stringify({ summary: "วันยุ่ง", items: [] }), model: "m", provider: "google", inputTokens: 1, outputTokens: 1, costThb: 0 });
    await runChatReview(new Date("2026-09-26T01:00:00Z"));
    const prompt = chat.mock.calls.at(-1)![0].messages[1].content as string;
    expect(prompt).toContain("ข้อความ 3199");
    expect(prompt).not.toContain("ข้อความ 100\n");
  });

  it("starts where the last review stopped", async () => {
    lastUntil = "2026-09-25T01:00:00Z";
    const r = await runChatReview(new Date("2026-09-26T01:00:00Z"));
    expect(r.ok).toBe(true);
    expect(reviews[0].since).toBe("2026-09-25T01:00:00.000Z");
  });

  it("reads no further back than a week after a long gap", async () => {
    lastUntil = "2026-08-01T00:00:00Z";
    await runChatReview(new Date("2026-09-26T01:00:00Z"));
    expect(reviews[0].since).toBe("2026-09-19T01:00:00.000Z");
  });
});
