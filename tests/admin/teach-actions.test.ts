import { describe, expect, it, vi } from "vitest";

/**
 * ห้องสอนบอท (owner, 2026-10-11): the test chat plays the inbox's own turn and writes nothing a
 * customer's turn would; a taught answer is saved strict, and a question with a figure is refused.
 */

const inserted: Record<string, unknown>[] = [];
const noted: unknown[] = [];

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  // what noteAfterAnswer hands its write to; recorded rather than run
  after: (fn: () => unknown) => { noted.push(fn); },
}));
vi.mock("@/lib/facebook/connection", () => ({
  pageConnections: async () => [{ pageId: "105982528649026", pageName: "LuckyPlanner", scopes: [], fields: [], connectedAt: "" }],
}));
vi.mock("@/lib/chat/page-welcome-store", () => ({ loadWelcome: async () => undefined }));
vi.mock("@/lib/chat/lessons-store", () => ({
  loadLessons: async () => [{ id: "tax", question: "ลดหย่อนภาษีได้ไหม", answer: "ได้ครับ สูงสุด 100,000 บาท", phrasings: [], pageId: null }],
}));
const updated: { row: Record<string, unknown>; id: unknown }[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }) };
      },
      update: (row: Record<string, unknown>) => ({
        eq: async (_: string, id: unknown) => { updated.push({ row, id }); return { error: null }; },
      }),
      select: () => ({
        order: () => ({
          limit: async () => ({
            data: [{ id: "a", question: "ลดหย่อนภาษีได้ไหม", answer: "ได้", phrasings: null, page_id: null, strict: true, enabled: true, hits: 3, last_hit_at: null, updated_at: "2026-10-11T00:00:00Z" }],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const { listTaught, teachLesson, tryBot, updateTaught } = await import("@/app/admin/teach/actions");
const { noteAfterAnswer, rehearse } = await import("@/lib/assistant/unanswered");

describe("the test chat", () => {
  it("answers with the inbox's own turn, taught answers included", async () => {
    const res = await tryBot([{ role: "user", content: "ลดหย่อนภาษีได้ไหมคะ" }], null, "105982528649026", undefined);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tried.source).toBe("taught");
    expect(res.tried.messages[0].text).toBe("ได้ครับ สูงสุด 100,000 บาท");
  });

  it("prices from the rules, and says so", async () => {
    const res = await tryBot([{ role: "user", content: "มีงบออมเงิน 30 บาทต่อวัน" }], null, "105982528649026", undefined);
    expect(res.ok && res.tried.source).toBe("rules");
  });

  it("asks for a message before sending", async () => {
    expect((await tryBot([], null, "105982528649026", undefined)).ok).toBe(false);
  });

  it("files nothing the bot could not answer while rehearsing", async () => {
    noted.length = 0;
    await rehearse(async () => noteAfterAnswer({ question: "ทดลอง", route: "brain" }));
    expect(noted).toHaveLength(0);
    noteAfterAnswer({ question: "ลูกค้าจริง", route: "brain" });
    expect(noted).toHaveLength(1);
  });
});

describe("teaching an answer", () => {
  it("saves it strict, for the Page it was taught on", async () => {
    inserted.length = 0;
    const res = await teachLesson({ question: "สาขาอุดรมีไหม", answer: "มีตัวแทนดูแลทั่วประเทศค่ะ", phrasings: ["", "อยู่อุดร สมัครได้ไหม"], pageId: "105982528649026" });
    expect(res).toEqual({ ok: true, id: "new-id" });
    expect(inserted[0]).toMatchObject({ strict: true, enabled: true, page_id: "105982528649026", phrasings: ["อยู่อุดร สมัครได้ไหม"] });
  });

  it("refuses a question with a figure in it", async () => {
    const res = await teachLesson({ question: "ช 47", answer: "อะไรก็ได้", phrasings: [], pageId: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("ตัวเลข");
  });

  it("refuses a Page that is not connected", async () => {
    const res = await teachLesson({ question: "สาขาอุดรมีไหม", answer: "มีค่ะ", phrasings: [], pageId: "999" });
    expect(res).toEqual({ ok: false, error: "ไม่พบเพจนี้" });
  });
});

describe("the taught answers", () => {
  it("are listed with how often they answered", async () => {
    const res = await listTaught();
    expect(res.ok && res.rows[0]).toMatchObject({ id: "a", strict: true, hits: 3, phrasings: [], pageId: null });
  });

  it("can become a note for the model, figure and all", async () => {
    updated.length = 0;
    const res = await updateTaught("a", { question: "ทุน 1 ล้านเบี้ยเท่าไหร่", answer: "แล้วแต่อายุ", phrasings: [], pageId: null, strict: false });
    expect(res).toEqual({ ok: true });
    expect(updated[0]).toMatchObject({ id: "a", row: { strict: false, question: "ทุน 1 ล้านเบี้ยเท่าไหร่" } });
  });

  it("cannot become บังคับตอบ with a figure in the question", async () => {
    const res = await updateTaught("a", { question: "ทุน 1 ล้านเบี้ยเท่าไหร่", answer: "แล้วแต่อายุ", phrasings: [], pageId: null, strict: true });
    expect(res.ok).toBe(false);
  });

  it("are taught as notes for the model when asked to", async () => {
    inserted.length = 0;
    const res = await teachLesson({ question: "ทุน 1 ล้านเบี้ยเท่าไหร่", answer: "แล้วแต่อายุ", phrasings: [], pageId: null, strict: false });
    expect(res.ok).toBe(true);
    expect(inserted[0]).toMatchObject({ strict: false });
  });
});
