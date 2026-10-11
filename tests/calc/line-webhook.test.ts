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
const linked: [string, string][] = [];
let aliasId: string | null = "rm-quoted";
let menuApiFails = false;
let replyFails = false;
let pushFails = false;
let turnsSaved = 0;
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
    push: async (_to: string, m: LineMessage[]) => {
      if (pushFails) throw new Error("LINE 429: You have reached your monthly limit.");
      pushes.push(m);
    },
    showLoading: async () => {},
    richMenuIdOfAlias: async () => { if (menuApiFails) throw new Error("LINE 500"); return aliasId; },
    linkRichMenu: async (user: string, id: string) => { linked.push([user, id]); },
  };
});
vi.mock("@/lib/chat/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/session")>("@/lib/chat/session");
  return {
    ...actual,
    claimEvent: async () => claimed,
    loadSession: async () => session,
    saveSession: async () => {},
    saveTurn: async () => { turnsSaved += 1; },
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
const { forgetMenuIds } = await import("@/lib/line/menu-link");
const { siteUrl } = await import("@/lib/site-url");
const { toMessages } = await import("@/lib/line/client");
const { verifySignature } = await import("@/lib/line/verify");

const said = (text: string, extra: object = {}) => ({
  type: "message", replyToken: "rt", webhookEventId: "e1",
  source: { type: "user", userId: "U1" }, message: { type: "text", text }, ...extra,
});

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = "secret";
  replies.length = 0; pushes.length = 0; linked.length = 0; replyFails = false; pushFails = false; turnsSaved = 0; claimed = true;
  aliasId = "rm-quoted"; menuApiFails = false; forgetMenuIds();
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
    expect(replies[0][0]).toMatchObject({ text: "ขออภัย ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินกลับมาตอบให้นะ 🙏" });
  });
});

/**
 * A couple is two cards, two value tables and the PDF question: more than the five a reply
 * holds. The tables used to be cut off the end, which left a LINE customer with the cards alone
 * (owner, 2026-10-06).
 */
describe("a couple's quotations", () => {
  const couple = async (): Promise<Answer> => ({
    messages: [
      { text: "หญิง 32", card: "/api/card?age=32" },
      { text: "ชาย 33", card: "/api/card?age=33" },
      { text: "กราฟและตารางมูลค่าทุกปีของหญิง อายุ 32", card: "/api/card/table?age=32" },
      { text: "กราฟและตารางมูลค่าทุกปีของชาย อายุ 33", card: "/api/card/table?age=33" },
      { text: "อยากได้เป็นไฟล์ PDF ไหมครับ?" },
    ],
    replies: ["ขอไฟล์ PDF", "สนใจสมัคร"],
    slots: { intent: "quote" },
    priced: true,
  });

  it("gets all four pictures: five in the reply, the rest pushed, none dropped", async () => {
    answer.mockImplementation(couple);
    await handle(said("ผญ 32 ผช 33 ทุน 1 ล้าน", { source: { type: "user", userId: "Ucouple1" }, webhookEventId: "ec1" }));
    expect(replies).toHaveLength(1);
    expect(replies[0]).toHaveLength(5);
    const sent = [...replies, ...pushes].flat();
    const images = sent.filter((m) => m.type === "image") as { originalContentUrl: string }[];
    expect(images.map((m) => m.originalContentUrl.split("?")[0].replace(/^https?:\/\/[^/]+/, ""))).toEqual(
      ["/api/card", "/api/card", "/api/card/table", "/api/card/table"]);
    expect(images[2].originalContentUrl).toContain("age=32");
    expect(images[3].originalContentUrl).toContain("age=33");
  });

  it("spares the words over the tables first, and puts the buttons on the very last message", async () => {
    answer.mockImplementation(couple);
    await handle(said("ผญ 32 ผช 33 ทุน 1 ล้าน", { source: { type: "user", userId: "Ucouple2" }, webhookEventId: "ec2" }));
    const sent = [...replies, ...pushes].flat();
    expect(sent.some((m) => m.type === "text" && m.text.includes("ตารางมูลค่า"))).toBe(false);
    expect(sent.at(-1)).toMatchObject({ type: "text", text: expect.stringContaining("PDF") });
    expect(sent.at(-1)!.quickReply?.items.map((i) => i.action.text)).toEqual(["ขอไฟล์ PDF", "สนใจสมัคร"]);
    expect(sent.filter((m) => m.quickReply)).toHaveLength(1);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toHaveLength(2);
  });

  it("keeps the turn and sends no apology when the push after the reply fails (review, 2026-10-11)", async () => {
    answer.mockImplementation(couple);
    pushFails = true;
    await handle(said("ผญ 32 ผช 33 ทุน 1 ล้าน", { source: { type: "user", userId: "Ucouple4" }, webhookEventId: "ec4" }));
    expect(replies).toHaveLength(1);
    expect(replies[0]).toHaveLength(5);
    expect(turnsSaved).toBe(1);
    expect([...replies, ...pushes].flat().some((m) => m.type === "text" && m.text.includes("ขัดข้อง"))).toBe(false);
  });

  it("keeps a single customer's table words and sends no push", async () => {
    answer.mockImplementation(async () => ({
      messages: [
        { text: "เบี้ยประมาณ…", card: "/api/card?x=1" },
        { text: "กราฟและตารางมูลค่าทุกปีให้ดูครับ", card: "/api/card/table?x=1" },
        { text: "อยากได้เป็นไฟล์ PDF ไหมครับ?" },
      ],
      replies: ["ขอไฟล์ PDF"], slots: { intent: "quote" }, priced: true,
    }));
    await handle(said("ชาย 35 ล้านนึง", { source: { type: "user", userId: "Ucouple3" }, webhookEventId: "ec3" }));
    expect(pushes).toHaveLength(0);
    expect(replies[0]).toHaveLength(5);
    expect(replies[0].some((m) => m.type === "text" && m.text.includes("ตารางมูลค่า"))).toBe(true);
  });
});

/**
 * The menu under the chat changes once a Life Protect price has been given (owner, 2026-10-06):
 * the plans have been chosen, so the table, the file and the way on take their place.
 */
describe("the rich menu after a price", () => {
  const priced = (product: string, isPriced = true) => async (): Promise<Answer> => ({
    messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
    slots: { intent: "quote", product } as never,
    priced: isPriced,
  });
  const as = (n: number) => ({ source: { type: "user", userId: `Umenu${n}` }, webhookEventId: `em${n}` });

  it("is the one for after a price, for a customer just quoted Life Protect", async () => {
    answer.mockImplementation(priced("lifeprotect"));
    await handle(said("ชาย 35 ล้านนึง", as(1)));
    expect(linked).toEqual([["Umenu1", "rm-quoted"]]);
  });

  it("is left alone for a plan whose brain does not read the table button, or an answer with no price", async () => {
    answer.mockImplementation(priced("legacy"));
    await handle(said("ชาย 35 ล้านนึง", as(2)));
    answer.mockImplementation(priced("lifeprotect", false));
    await handle(said("ชาย 35 ล้านนึง", as(3)));
    expect(linked).toEqual([]);
  });

  it("is left alone, quietly, when no such menu has been built", async () => {
    aliasId = null;
    answer.mockImplementation(priced("lifeprotect"));
    await handle(said("ชาย 35 ล้านนึง", as(4)));
    expect(linked).toEqual([]);
    expect(replies).toHaveLength(1);
  });

  it("never costs the customer their answer when LINE's menu call fails", async () => {
    menuApiFails = true;
    answer.mockImplementation(priced("lifeprotect"));
    await expect(handle(said("ชาย 35 ล้านนึง", as(5)))).resolves.toBeUndefined();
    expect(replies).toHaveLength(1);
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

describe("a PDF the customer asked for", () => {
  it("is a link in a bubble of its own, after the words", async () => {
    const pdf = "/api/quote-pdf?page=plb&age=35&v=1";
    answer.mockImplementation(async () => ({
      messages: [{ text: "ไฟล์ PDF ของเบี้ยล่าสุดครับ", file: pdf }],
      slots: { intent: "quote" },
    }));
    await handle(said("ขอไฟล์ PDF") as never);
    const texts = (replies[0] ?? pushes[0]).map((m) => (m.type === "text" ? m.text : ""));
    expect(texts[0]).toBe("ไฟล์ PDF ของเบี้ยล่าสุด");
    // LINE's own browser on Android does not open a PDF: the flag sends it to the phone's
    expect(texts).toContain(`${siteUrl(pdf)}&openExternalBrowser=1`);
  });

  it("is a link each for a couple", async () => {
    const pdf = "/api/quote-pdf?page=plb&age=35&v=1";
    const pdf2 = "/api/quote-pdf?page=plb&age=33&v=1";
    answer.mockImplementation(async () => ({
      messages: [{ text: "ไฟล์ PDF ของเบี้ยล่าสุดครับ", file: pdf }, { text: "", file: pdf2 }],
      slots: { intent: "quote" },
    }));
    await handle(said("ขอไฟล์ PDF") as never);
    const texts = (replies[0] ?? pushes[0]).map((m) => (m.type === "text" ? m.text : ""));
    expect(texts).toEqual([
      "ไฟล์ PDF ของเบี้ยล่าสุด",
      `${siteUrl(pdf)}&openExternalBrowser=1`,
      `${siteUrl(pdf2)}&openExternalBrowser=1`,
    ]);
  });
});
