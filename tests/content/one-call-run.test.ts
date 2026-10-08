import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentOutput } from "@/lib/content/output";

/** A round of one call per piece: numbers checked against its yardstick, broken replies dropped, the budget held and released. */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
const store = vi.hoisted(() => ({
  contentCap: vi.fn(async () => 30), contentSpentThisMonth: vi.fn(async () => 0),
  holdContentBudget: vi.fn(async () => ({ ok: true, id: "h1" })), releaseContentBudget: vi.fn(async () => undefined),
  listWords: vi.fn(async () => []), saveContent: vi.fn(async (row: { output: ContentOutput; flags: unknown }) => ({ id: "c", ...row })),
}));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/logo-store", () => ({ roundLogo: vi.fn(async () => null) }));

const { oneCallRound } = await import("@/lib/content/one-call-run");

const piece = (body: string): ContentOutput => ({ hooks: ["หัว"], body, closing: "", hashtags: [], imagePrompt: "", disclaimer: "" });
const base = {
  href: "draft", format: "post" as const, length: null, count: 2, messages: () => [{ role: "user" as const, content: "x" }],
  loop: false, formula: null, label: "test", pageId: "p1",
};

beforeEach(() => {
  vi.clearAllMocks();
  ai.chat.mockImplementation(async () => ({ text: "reply", model: "m", costThb: 0.5, outputTokens: 10 }));
});

describe("a one-call round", () => {
  it("writes each piece into the round's Page", async () => {
    await oneCallRound({ ...base, count: 1, yardstick: "", parse: () => piece("ดี") });
    expect(store.saveContent.mock.calls[0][0]).toMatchObject({ pageId: "p1" });
  });

  it("flags a figure that is not in the yardstick, and not one that is", async () => {
    const r = await oneCallRound({ ...base, count: 1, yardstick: "ร่างมีเลข 500,000 บาท", parse: () => piece("ทุน 500,000 บาท เบี้ย 1,234 บาท") });
    expect(r.ok).toBe(true);
    const flags = store.saveContent.mock.calls[0][0].flags as { numbers: string[] };
    expect(flags.numbers.join(" ")).toContain("1,234");
    expect(flags.numbers.join(" ")).not.toContain("500,000");
  });

  it("flags every figure when the yardstick is empty", async () => {
    await oneCallRound({ ...base, count: 1, yardstick: "", parse: () => piece("ลดหย่อนได้ 100,000 บาท") });
    expect((store.saveContent.mock.calls[0][0].flags as { numbers: string[] }).numbers.length).toBeGreaterThan(0);
  });

  it("saves the pieces that came back and drops a broken one", async () => {
    const r = await oneCallRound({ ...base, yardstick: "", parse: (_reply, i) => (i === 0 ? piece("ดี") : null) });
    expect(r).toMatchObject({ ok: true, missing: 1 });
    expect(store.saveContent).toHaveBeenCalledTimes(1);
  });

  it("says the reply was incomplete when every piece broke, and gives the budget back", async () => {
    const r = await oneCallRound({ ...base, yardstick: "", parse: () => null });
    expect(r).toEqual({ ok: false, error: "AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่อีกครั้งนะครับ" });
    expect(store.releaseContentBudget).toHaveBeenCalledWith("h1");
  });

  it("reads a piece with หาทีม's rules when told to, so an income figure in a draft is blocked", async () => {
    await oneCallRound({ ...base, count: 1, yardstick: "รายได้ 50,000 บาทต่อเดือน", checks: { recruit: true }, parse: () => piece("มาร่วมทีม รายได้ 50,000 บาทต่อเดือน") });
    const policy = (store.saveContent.mock.calls[0][0].flags as { policy: { code: string }[] }).policy;
    expect(policy.map((f) => f.code)).toContain("income_promise");
  });

  it("flags a small count when told to flag every figure", async () => {
    await oneCallRound({ ...base, count: 1, yardstick: "", checks: { every: true }, parse: () => piece("ระยะรอคอย 30 วัน") });
    expect((store.saveContent.mock.calls[0][0].flags as { numbers: string[] }).numbers).not.toEqual([]);
  });

  it("marks คลิปวนลูป and สูตรโปร on the pieces", async () => {
    await oneCallRound({ ...base, format: "script", count: 1, loop: true, formula: "pro" as const, yardstick: "", parse: () => piece("x") });
    expect(store.saveContent.mock.calls[0][0].output).toMatchObject({ loop: true, formula: "pro" });
  });
  it("marks a สูตรอ่าน-ดูจนจบ piece with the loops and the reason its writer reported", async () => {
    ai.chat.mockImplementation(async () => ({
      text: JSON.stringify({ loops: [{ open: "หัว", close: "เฉลย" }], shareWhy: "voice" }), model: "m", costThb: 0.5, outputTokens: 10,
    }));
    await oneCallRound({ ...base, count: 1, formula: "finish", yardstick: "", parse: () => piece("ปมนี้ เฉลย") });
    expect(store.saveContent.mock.calls[0][0].output).toMatchObject({ formula: "finish", shareWhy: "voice", loops: [{ open: "หัว", close: "เฉลย" }] });
  });

  describe("with the agent's own poster words", () => {
    const withPoster = (headline: string): ContentOutput => ({
      ...piece("ดี"),
      poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: headline }, { kind: "sub", text: "รองของ AI" }] },
    });
    const flagsOf = () => store.saveContent.mock.calls[0][0].flags as { numbers: string[]; policy: { code: string }[] };

    it("saves every piece of the round with their words on its poster and the writer's colours", async () => {
      await oneCallRound({ ...base, yardstick: "", posterWords: { headline: "ทักมาเลย", footer: "LINE: abc" }, parse: () => withPoster("ของ AI") });
      for (const [row] of store.saveContent.mock.calls) {
        expect(row.output.poster).toMatchObject({ theme: "navy", blocks: [{ kind: "headline", text: "ทักมาเลย" }, { kind: "footer", text: "LINE: abc" }] });
      }
    });

    it("does not flag a figure on their poster as the AI's, but still flags one in the post", async () => {
      const out = { ...withPoster("x"), body: "เบี้ย 7,777 บาท" };
      await oneCallRound({ ...base, count: 1, yardstick: "", posterWords: { headline: "เริ่มต้น 1,234 บาท" }, parse: () => out });
      const numbers = flagsOf().numbers.join(" ");
      expect(numbers).not.toContain("1,234");
      expect(numbers).toContain("7,777");
    });

    it("still reads their words with the policy's rules", async () => {
      await oneCallRound({ ...base, count: 1, yardstick: "", posterWords: { headline: "เบี้ยถูกที่สุดในประเทศ" }, parse: () => withPoster("x") });
      expect(flagsOf().policy.length).toBeGreaterThan(0);
    });

    it("leaves the writer's poster as it was with no words", async () => {
      await oneCallRound({ ...base, count: 1, yardstick: "", posterWords: null, parse: () => withPoster("ของ AI") });
      expect(store.saveContent.mock.calls[0][0].output.poster?.blocks[0]).toEqual({ kind: "headline", text: "ของ AI" });
    });
  });
});
