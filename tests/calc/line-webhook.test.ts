import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Answer } from "@/lib/assistant/lifeprotect/answer";
import type { LineMessage } from "@/lib/line/client";

/**
 * The LINE official account, answered by the same brains as the Page's inbox.
 *
 * The things that are LINE's own are what is tested here: one reply carrying every bubble (a
 * reply is free and a push is not), the card after its words, the buttons on the last
 * message, and a push only when the reply token has lapsed.
 */
const replies: LineMessage[][] = [];
const pushes: LineMessage[][] = [];
let replyFails = false;
const session = {
  messages: [] as { role: "user" | "assistant"; content: string }[],
  slots: null as unknown,
  mutedUntil: null as string | null,
  handedOverAt: null as string | null,
  conversationId: null as string | null,
};
let claimed = true;
const quoted = async (): Promise<Answer> => ({
  messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
  replies: ["สนใจสมัคร", "🛡 มรดกเพื่อครอบครัว"],
  slots: { intent: "quote" },
  priced: true,
});
const answer = vi.fn(quoted);

vi.mock("@/lib/line/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/line/client")>("@/lib/line/client");
  return {
    ...actual,
    reply: async (_t: string, m: LineMessage[]) => {
      if (replyFails) throw new Error("LINE 400: Invalid reply token");
      replies.push(m);
    },
    push: async (_to: string, m: LineMessage[]) => { pushes.push(m); },
    showLoading: async () => {},
  };
});
vi.mock("@/lib/chat/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/session")>("@/lib/chat/session");
  return {
    ...actual,
    claimEvent: async () => claimed,
    loadSession: async () => session,
    saveSession: async () => {},
    saveTurn: async () => {},
  };
});
/** the transcript is the same code on both channels; the Messenger test checks what it keeps */
vi.mock("@/lib/chat/transcript", async () => ({
  ...await vi.importActual<typeof import("@/lib/chat/transcript")>("@/lib/chat/transcript"),
  keepTranscript: async () => {},
}));

vi.mock("@/lib/chat/record", () => ({
  openConversation: async () => "conv-1",
  record: async () => {},
  openLead: async () => {},
}));
vi.mock("@/lib/assistant/dispatch", () => ({ answerAny: answer }));

const { handle } = await import("@/lib/line/conversation");
const { toMessages } = await import("@/lib/line/client");
const { verifySignature } = await import("@/lib/line/verify");

const said = (text: string, extra: object = {}) => ({
  type: "message", replyToken: "rt", webhookEventId: "e1",
  source: { type: "user", userId: "U1" }, message: { type: "text", text }, ...extra,
});

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = "secret";
  replies.length = 0; pushes.length = 0; replyFails = false; claimed = true;
  session.messages = []; session.slots = null; session.handedOverAt = null;
  answer.mockReset();
  answer.mockImplementation(quoted);
});

describe("a LINE customer's message", () => {
  it("is answered in one reply: the words, then the card, with the buttons on the card", async () => {
    await handle(said("ชาย 35 ล้านนึง"));
    expect(replies).toHaveLength(1);
    const [words, card] = replies[0];
    expect(words).toMatchObject({ type: "text", text: "เบี้ยประมาณ…" });
    expect(card.type).toBe("image");
    expect((card as { originalContentUrl: string }).originalContentUrl).toMatch(/^https:\/\/.+\/api\/card\?x=1$/);
    expect(words.quickReply).toBeUndefined();
    expect(card.quickReply?.items.map((i) => i.action.text)).toEqual(["สนใจสมัคร", "🛡 มรดกเพื่อครอบครัว"]);
    expect((answer.mock.calls[0] as unknown[])[2]).toBe("line");
  });

  it("is pushed instead when the reply token has lapsed", async () => {
    replyFails = true;
    await handle(said("ชาย 35 ล้านนึง"));
    expect(pushes).toHaveLength(1);
  });

  it("is not answered twice when LINE delivers it again", async () => {
    claimed = false;
    await handle(said("ชาย 35 ล้านนึง"));
    expect(answer).not.toHaveBeenCalled();
  });

  it("is left alone in a group, and when it is a sticker", async () => {
    await handle(said("ชาย 35", { source: { type: "group", userId: "U1" } }));
    await handle({ ...said(""), message: { type: "sticker" } });
    expect(answer).not.toHaveBeenCalled();
  });

  it("gets no bot in a thread a person has taken", async () => {
    session.handedOverAt = new Date().toISOString();
    await handle(said("กรอกแล้วครับ"));
    expect(answer).not.toHaveBeenCalled();
    expect(replies).toHaveLength(0);
  });

  // the owner, 2026-09-26: the form alone no longer silences the bot
  it("keeps answering after the form has gone out", async () => {
    session.slots = { product: "lifeprotect", formSent: true };
    await handle(said("ต้องใช้เอกสารอะไรบ้าง"));
    expect(answer).toHaveBeenCalled();
    expect(replies.length).toBeGreaterThan(0);
  });

  it("is told a person is coming when no answer can be had", async () => {
    answer.mockRejectedValue(new Error("ล่ม"));
    await expect(handle(said("ขอราคาหน่อย"))).rejects.toThrow();
    expect(answer).toHaveBeenCalledTimes(2);
    expect(replies[0][0]).toMatchObject({ text: "ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบให้นะครับ 🙏" });
  });
});

describe("a reply's shape", () => {
  it("never passes LINE's five, joining words before it drops a card", () => {
    const m = toMessages([
      { text: "หนึ่ง" }, { text: "สอง" }, { text: "สาม" }, { image: "https://x/a.png" },
      { text: "สี่" }, { image: "https://x/b.png" },
    ]);
    expect(m).toHaveLength(5);
    expect(m.filter((x) => x.type === "image")).toHaveLength(2);
  });

  it("cuts a button's label at twenty characters and keeps the whole question it sends", () => {
    const long = "ผู้ชาย 35 อยากมีประกันชีวิต 1 ล้าน จ่ายปีละเท่าไหร่";
    const [m] = toMessages([{ text: "x" }], [long]);
    const { label, text } = m.quickReply!.items[0].action;
    expect(Array.from(label).length).toBeLessThanOrEqual(20);
    expect(text).toBe(long);
  });
});

describe("the webhook's signature", () => {
  it("accepts LINE's and refuses anyone else's", () => {
    const body = JSON.stringify({ events: [] });
    const good = crypto.createHmac("sha256", "secret").update(body).digest("base64");
    expect(verifySignature(body, good)).toBe(true);
    expect(verifySignature(body, "forged")).toBe(false);
    expect(verifySignature(body, null)).toBe(false);
  });
});

/** the same clock as Messenger's: the apology goes before the function's limit */
describe("an answer that runs out of time", () => {
  it("is apologised for in the reply, and not tried again", async () => {
    const { WEBHOOK_LIMIT_MS, SEND_MARGIN_MS } = await import("@/lib/chat/batch");
    answer.mockImplementation(() => new Promise<Answer>(() => {}));
    const startedAt = Date.now() - (WEBHOOK_LIMIT_MS - SEND_MARGIN_MS) + 30;
    await expect(handle(said("ชาย 35") as never, "", { startedAt })).rejects.toThrow(/longer than/);
    expect(answer).toHaveBeenCalledOnce();
    expect(JSON.stringify(replies)).toContain("ระบบขัดข้องชั่วคราว");
  });
});
