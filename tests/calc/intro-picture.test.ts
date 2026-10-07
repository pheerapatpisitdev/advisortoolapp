import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route" ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { INTRO_PICTURE, withIntroPicture } = await import("@/lib/assistant/intro");
const { botTurn } = await import("@/lib/chat/transcript");

const said = (content: string) => [{ role: "user" as const, content }];
const lifeBefore = { product: "lifeprotect" as const, intent: "other" as const };

beforeEach(() => { routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 }; });

/**
 * A picture ahead of the first quotation, on the owner's say (2026-10-07): a family without
 * cover beside a family with it, once, on Life Protect and iShield, in the inboxes.
 */
describe("the intro picture", () => {
  it("goes ahead of a customer's first Life Protect quotation, as a picture with no words", async () => {
    const a = await answerAny(said("ชาย 35 ทุน 1 ล้าน"), lifeBefore, "facebook");
    expect(a.priced).toBe(true);
    expect(a.messages[0]).toEqual({ text: "", card: INTRO_PICTURE });
    expect(a.messages[1].card).toContain("/api/card");
    expect((a.slots as { introSeen?: boolean }).introSeen).toBe(true);
  });

  it("is not sent a second time, and the flag outlives the turn", async () => {
    const first = await answerAny(said("ชาย 35 ทุน 1 ล้าน"), lifeBefore, "facebook");
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 2_000_000 };
    const second = await answerAny(said("ทุน 2 ล้านล่ะ"), first.slots, "facebook");
    expect(second.priced).toBe(true);
    expect(second.messages.some((m) => m.card === INTRO_PICTURE)).toBe(false);
    expect((second.slots as { introSeen?: boolean }).introSeen).toBe(true);
    // and a turn that quotes nothing keeps it too
    const thanks = await answerAny(said("ขอบคุณค่ะ"), second.slots, "facebook");
    expect((thanks.slots as { introSeen?: boolean }).introSeen).toBe(true);
  });

  it("goes on LINE as well, and not on the website, which draws every card after its words", async () => {
    expect((await answerAny(said("ชาย 35 ทุน 1 ล้าน"), lifeBefore, "line")).messages[0].card).toBe(INTRO_PICTURE);
    const web = await answerAny(said("ชาย 35 ทุน 1 ล้าน"), lifeBefore, "web");
    expect(web.messages.some((m) => m.card === INTRO_PICTURE)).toBe(false);
  });

  it("waits for a quotation: a question asked back is not one", async () => {
    routed = { intent: "other" };
    const a = await answerAny(said("สนใจครับ"), lifeBefore, "facebook");
    expect(a.priced).toBeFalsy();
    expect(a.messages.some((m) => m.card === INTRO_PICTURE)).toBe(false);
    expect((a.slots as { introSeen?: boolean }).introSeen).toBeUndefined();
  });

  it("is for Life Protect and iShield only", () => {
    const quote = (extra: object) => ({ messages: [{ text: "x", card: "/api/card?x" }], priced: true, slots: { product: "x" }, ...extra }) as never;
    // the dispatcher marks what the two brains quoted, and nothing else
    expect(withIntroPicture(quote({ introFor: true }), false, "facebook").messages[0].card).toBe(INTRO_PICTURE);
    expect(withIntroPicture(quote({}), false, "facebook").messages).toHaveLength(1);
    // the mark does not leave with the answer
    expect("introFor" in withIntroPicture(quote({ introFor: true }), false, "facebook")).toBe(false);
  });

  it("is not added to a quotation of another plan asked in the middle of a Life Protect chat", async () => {
    const a = await answerAny(said("ประกันมะเร็ง ชาย 40 ทุน 1 ล้าน"), { product: "lifeprotect", intent: "other", age: 40, sex: "M" }, "facebook");
    expect(a.messages.some((m) => m.card === INTRO_PICTURE)).toBe(false);
  });

  it("goes ahead of a first iShield quotation too", async () => {
    const a = await answerAny(said("ขอเบี้ย 1 ล้านครับ"), { product: "ishield", age: 40, sex: "M", variant: "WLCI10", told: true }, "facebook");
    expect(a.priced).toBe(true);
    expect(a.messages[0]).toEqual({ text: "", card: INTRO_PICTURE });
  });

  it("is told apart from a quotation in the transcript", () => {
    const turn = botTurn([{ text: "", card: INTRO_PICTURE }, { text: "เบี้ย", card: "/api/card?x" }]);
    expect(turn?.text).toContain("[รูปประกอบ]");
    expect(turn?.text.match(/\[การ์ดใบเสนอ\]/g)).toHaveLength(1);
  });
});
