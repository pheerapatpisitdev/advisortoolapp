import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Answer } from "@/lib/assistant/lifeprotect/answer";

const sent: { text: string[]; images: string[]; replies: (string[] | undefined)[] } = { text: [], images: [], replies: [] };
/** every file handed to Messenger, and whether the next send of one is refused */
const files: { bytes: Uint8Array; filename: string; replies?: string[] }[] = [];
let fileFails = false;
const session = {
  messages: [] as { role: "user" | "assistant"; content: string }[],
  slots: null as unknown,
  mutedUntil: null as string | null,
  handedOverAt: null as string | null,
};
const saved: { mutedUntil?: Date | null; handedOverAt?: Date | null }[] = [];
/** what each bot turn handed saveTurn */
const turns: unknown[] = [];
/** every user hash the handler touched, so one conversation can be shown to be one row */
const hashesSeen: string[] = [];
const quoted = async (): Promise<Answer> => ({
  messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
  slots: { intent: "quote" },
  priced: true,
});
const answer = vi.fn(quoted);
/** how many of the next picture sends Messenger will refuse */
let imageFailures = 0;

vi.mock("@/lib/facebook/client", () => ({
  sendMessage: async (_psid: string, text: string, replies?: string[]) => {
    sent.text.push(text); sent.replies.push(replies);
  },
  sendImage: async (_psid: string, url: string, replies?: string[]) => {
    sent.images.push(url); sent.replies.push(replies);
    if (imageFailures > 0) { imageFailures -= 1; throw new Error("Messenger 400: อัพโหลดไฟล์แนบไม่สำเร็จ"); }
  },
  sendFile: async (_psid: string, bytes: Uint8Array, filename: string, replies?: string[]) => {
    if (fileFails) throw new Error("Messenger 400: อัพโหลดไฟล์ไม่สำเร็จ");
    files.push({ bytes, filename, replies });
  },
  showTyping: async () => {},
}));

/** the follow-up the bot arms after a quotation, and drops the moment anyone speaks */
const followups: { armed: { user: string; pageId?: string }[]; dropped: string[] } = { armed: [], dropped: [] };
vi.mock("@/lib/chat/followup", () => ({
  armFollowup: async (_c: string, u: string, _psid: string, pageId?: string) => {
    followups.armed.push({ user: u, pageId });
  },
  dropFollowup: async (_c: string, u: string) => { followups.dropped.push(u); },
}));

vi.mock("@/lib/chat/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/session")>("@/lib/chat/session");
  return {
    ...actual,
    claimEvent: async () => true,
    loadSession: async (_c: string, u: string) => { hashesSeen.push(u); return session; },
    saveSession: async (
      _c: string, u: string, _m: unknown, _s: unknown, mutedUntil?: Date | null,
      _conversationId?: string | null, handedOverAt?: Date | null,
    ) => { hashesSeen.push(u); saved.push({ mutedUntil, handedOverAt }); },
    // a bot turn's save writes neither the mute nor the stamp (src/lib/chat/session.ts saveTurn)
    saveTurn: async (_c: string, u: string, turn: unknown) => {
      hashesSeen.push(u); saved.push({}); turns.push(turn);
    },
  };
});

vi.mock("@/lib/assistant/dispatch", () => ({ answerAny: answer }));

/** what the transcript kept, by speaker — the daily review reads these */
const kept: { role: string; text: string }[] = [];
vi.mock("@/lib/chat/transcript", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/transcript")>("@/lib/chat/transcript");
  return {
    ...actual,
    keepTranscript: async (_t: unknown, turns: ({ role: string; text: string } | undefined)[]) => {
      for (const t of turns) if (t) kept.push(t);
    },
  };
});

const { handle } = await import("@/lib/facebook/conversation");

beforeEach(() => {
  process.env.FB_APP_ID = "app-1";
  process.env.FB_APP_SECRET = "secret";
  sent.text = []; sent.images = []; sent.replies = []; saved.length = 0; kept.length = 0; turns.length = 0;
  imageFailures = 0; files.length = 0; fileFails = false;
  followups.armed.length = 0; followups.dropped.length = 0;
  session.messages = []; session.slots = null; session.mutedUntil = null; session.handedOverAt = null;
  answer.mockReset();
  answer.mockImplementation(quoted);
});

describe("a customer's message", () => {
  it("is answered in words and then in a picture", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
    expect(sent.images[0]).toContain("/api/card?x=1");
  });

  it("is remembered without touching whatever mute the thread carries", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(saved).toEqual([{ mutedUntil: undefined }]);
  });

  it("is ignored when it carries no words at all", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m0" } });
    expect(answer).not.toHaveBeenCalled();
  });
});

describe("a customer whose answer would not come", () => {
  const asked = { sender: { id: "psid-lost" }, message: { mid: "m1", text: "สนใจประกันมรดก ทุน 1,000,000" } };

  it("is answered on the second attempt rather than apologised to", async () => {
    answer.mockRejectedValueOnce(new Error("ไม่มีคีย์ผู้ให้บริการ AI ที่ใช้ได้ในตอนนี้"));
    await handle(asked);
    expect(answer).toHaveBeenCalledTimes(2);
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("is handed to the agent, not told to come back later, when it truly cannot answer", async () => {
    answer.mockRejectedValue(new Error("ล่ม"));
    await expect(handle(asked)).rejects.toThrow();
    expect(sent.text).toEqual(["ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินกลับมาตอบให้นะครับ 🙏"]);
  });
});

/**
 * The function is killed at its limit, before a catch can apologise. A turn has a clock of its
 * own inside it, so a turn late in a long batch still gets the apology out (review, 2026-10-01).
 */
describe("a customer whose answer runs out of time", () => {
  it("is apologised to before the function's limit, and the answer is not tried again", async () => {
    const { WEBHOOK_LIMIT_MS, SEND_MARGIN_MS } = await import("@/lib/chat/batch");
    answer.mockImplementation(() => new Promise<Answer>(() => {}));
    // the batch began long enough ago that this turn has 30 milliseconds left
    const startedAt = Date.now() - (WEBHOOK_LIMIT_MS - SEND_MARGIN_MS) + 30;
    const began = Date.now();
    await expect(handle({ sender: { id: "psid-slow" }, message: { mid: "ms1", text: "ชาย 35" } }, undefined, { startedAt }))
      .rejects.toThrow(/longer than/);
    expect(Date.now() - began).toBeLessThan(2000);
    expect(answer).toHaveBeenCalledOnce();
    expect(sent.text).toEqual(["ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินกลับมาตอบให้นะครับ 🙏"]);
  });
});

describe("the turn the bot saves", () => {
  it("is the session it began from plus the customer's words and its reply", async () => {
    session.messages = [{ role: "user", content: "สวัสดี" }];
    await handle({ sender: { id: "psid-save" }, message: { mid: "msv", text: "ชาย 35 ล้านนึง" } });
    expect(turns).toEqual([{
      base: session,
      added: [{ role: "user", content: "ชาย 35 ล้านนึง" }, { role: "assistant", content: "เบี้ยประมาณ…" }],
      slots: { intent: "quote" },
      conversationId: null,
    }]);
  });
});

describe("an agent who answers while the bot is still typing", () => {
  it("does not stop the answer when the mark on the thread is the same one it started with", async () => {
    session.mutedUntil = new Date(Date.now() + 23 * 3600_000).toISOString();
    await handle({ sender: { id: "psid-mark" }, message: { mid: "m7", text: "ขอราคาหน่อย" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  it("is not talked over", async () => {
    // the mute lands during the model call, which is where the seconds go
    session.mutedUntil = null;
    answer.mockImplementationOnce(async (): Promise<Answer> => {
      session.mutedUntil = new Date(Date.now() + 3600_000).toISOString();
      return { messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }], slots: { intent: "quote" }, priced: true };
    });
    await handle({ sender: { id: "psid-cut" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual([]);
    expect(sent.images).toEqual([]);
  });

  it("keeps their mute: the bot's own save must not wipe it", async () => {
    session.mutedUntil = null;
    answer.mockImplementationOnce(async (): Promise<Answer> => {
      session.mutedUntil = new Date(Date.now() + 3600_000).toISOString();
      return { messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }], slots: { intent: "quote" }, priced: true };
    });
    await handle({ sender: { id: "psid-cut2" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(saved).toEqual([]);
  });
});

describe("the question the bot arms for five minutes' time", () => {
  it("is armed on a quotation, addressed to the customer it quoted", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
      slots: { intent: "quote", product: "lifeprotect" },
      priced: true,
    }));
    await handle({ sender: { id: "psid-arm" }, message: { mid: "mf1", text: "หญิง 40 ทุน 1 ล้าน" } }, "page-1");
    expect(followups.armed).toHaveLength(1);
  });

  /**
   * And addressed out of the Page it arrived on.
   *
   * Two Pages are connected, and a page-scoped id means nothing to the other one: a follow-up
   * armed without a Page was sent with whichever token came first and refused by Meta.
   */
  it("carries the Page the conversation happened on", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "เบี้ยประมาณ…" }],
      slots: { intent: "quote", product: "lifeprotect" },
      priced: true,
    }));
    await handle({ sender: { id: "psid-arm3" }, message: { mid: "mf4", text: "หญิง 40 ทุน 1 ล้าน" } }, "page-7");
    expect(followups.armed).toEqual([{ user: expect.any(String), pageId: "page-7" }]);
  });

  it("is not armed by an answer that carries no premium", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ขอเพศกับอายุด้วยครับ" }],
      slots: { intent: "quote", product: "lifeprotect" },
    }));
    await handle({ sender: { id: "psid-arm2" }, message: { mid: "mf2", text: "สนใจครับ" } });
    expect(followups.armed).toEqual([]);
  });

  it("is dropped when the agent takes the thread", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid-drop" }, message: { mid: "mf3", text: "สวัสดีครับ", is_echo: true } });
    expect(followups.dropped).toHaveLength(1);
  });

  it("is dropped when the customer writes again, before anything else happens", async () => {
    await handle({ sender: { id: "psid-drop2" }, message: { mid: "mf4", text: "สนใจครับ" } });
    expect(followups.dropped).toHaveLength(1);
  });
});

describe("the buttons an answer offers", () => {
  it("ride on the picture, which is what lands last", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "เบี้ยประมาณ…", card: "/api/card?x=1" }],
      slots: { intent: "quote" },
      priced: true,
      replies: ["ขอตารางมูลค่า"],
    }));
    await handle({ sender: { id: "psid-btn" }, message: { mid: "mb1", text: "ชาย 35 ล้านนึง" } });
    // the words go out bare; anything sent after the buttons would take them away
    expect(sent.replies).toEqual([undefined, ["ขอตารางมูลค่า"]]);
  });

  it("ride on the words when there is no picture", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ส่งตารางให้แล้วครับ" }],
      slots: { intent: "quote" },
      priced: true,
      replies: ["สนใจสมัคร"],
    }));
    await handle({ sender: { id: "psid-btn2" }, message: { mid: "mb2", text: "ขอตาราง" } });
    expect(sent.replies).toEqual([["สนใจสมัคร"]]);
  });
});

describe("a couple priced together", () => {
  it("is sent one message and one card each, in the order they were named", async () => {
    answer.mockResolvedValueOnce({
      messages: [
        { text: "หญิง อายุ 32…", card: "/api/card?a=1" },
        { text: "ชาย อายุ 33…", card: "/api/card?a=2" },
      ],
      slots: { intent: "quote" as const },
      priced: true,
    });
    await handle({ sender: { id: "psid" }, message: { mid: "m9", text: "ผญ 32 ผช33ค่ะ" } });
    expect(sent.text).toEqual(["หญิง อายุ 32…", "ชาย อายุ 33…"]);
    expect(sent.images.map((u) => u.slice(-4))).toEqual(["?a=1", "?a=2"]);
  });
});

describe("the agent answering by hand", () => {
  it("mutes the customer's own thread, not one named after the page", async () => {
    const seen: string[] = [];
    hashesSeen.length = 0;
    await handle({ sender: { id: "page" }, recipient: { id: "psid-9" }, message: { mid: "m8", text: "ครับ", is_echo: true } });
    seen.push(...hashesSeen);
    await handle({ sender: { id: "psid-9" }, recipient: { id: "page" }, message: { mid: "m8b", text: "ขอราคา" } });
    seen.push(...hashesSeen);
    // both events are the same conversation, so both must land on one row
    expect(new Set(seen).size).toBe(1);
  });

  it("marks the thread and costs nothing", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "m2", text: "เดี๋ยวโทรหาครับ", is_echo: true } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
    expect(saved[0].mutedUntil).toBeInstanceOf(Date);
  });

  /**
   * One reply by hand and the thread is a person's, asked for by the owner in those words.
   *
   * The mute beside it is not redundant and is not the same thing: it is what stops an answer
   * already in flight from landing on top of the agent's message a second later. The stamp is
   * what stops the bot picking the conversation back up tomorrow.
   */
  it("hands the thread over for good, not for a day", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "m2h", text: "สวัสดีครับ", is_echo: true } });
    expect(saved[0].handedOverAt).toBeInstanceOf(Date);
  });

  /**
   * A mute on its own still ends when the customer writes: it is the few seconds around a
   * model call, and nothing about it says whose thread this is.
   */
  it("lets a bare mute end when the customer writes again", async () => {
    session.mutedUntil = new Date(Date.now() + 23 * 3600_000).toISOString();
    await handle({ sender: { id: "psid-back" }, message: { mid: "m3", text: "เกิด2522 เพศญ" } });
    expect(answer).toHaveBeenCalledOnce();
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
  });

  /** but the stamp the agent's own reply leaves does not end, however long they wait */
  it("stays the agent's however long the customer takes to answer", async () => {
    session.handedOverAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await handle({ sender: { id: "psid-back" }, message: { mid: "m3b", text: "ยังสนใจอยู่ครับ" } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
  });

  it("keeps the agent's mark on the thread rather than clearing it to speak", async () => {
    session.mutedUntil = new Date(Date.now() + 23 * 3600_000).toISOString();
    await handle({ sender: { id: "psid-keep" }, message: { mid: "m5", text: "ขอราคาหน่อย" } });
    expect(saved).toEqual([{ mutedUntil: undefined }]);
  });

  it("does not silence the bot for its own echo", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "m4", text: "เบี้ย…", is_echo: true, app_id: "app-1" } });
    expect(saved).toEqual([]);
  });
});

/**
 * Messenger fetches the card off the public internet itself, and sometimes refuses it.
 *
 * The customer has been quoted in words by the time this happens, and what used to follow was
 * nothing at all — the figures they were promised a picture of never arrived and no one knew.
 */
describe("the picture of the quotation, when Messenger will not take it", () => {
  it("is offered a second time before anything else is tried", async () => {
    imageFailures = 1;
    await handle({ sender: { id: "psid-card1" }, message: { mid: "mc1", text: "หญิง 40 ทุน 1 ล้าน" } });
    expect(sent.images).toHaveLength(2);
    expect(sent.images.every((u) => u.endsWith("/api/card?x=1"))).toBe(true);
    expect(sent.text.join("\n")).not.toContain("เปิดดูได้ที่ลิงก์นี้");
  });

  it("goes as a link when both attempts are refused, rather than going nowhere", async () => {
    imageFailures = 2;
    await handle({ sender: { id: "psid-card2" }, message: { mid: "mc2", text: "หญิง 40 ทุน 1 ล้าน" } });
    expect(sent.images).toHaveLength(2);
    const last = sent.text[sent.text.length - 1];
    expect(last).toContain("เปิดดูได้ที่ลิงก์นี้");
    expect(last).toContain("/api/card?x=1");
  });
});

/**
 * The form used to silence the bot. The owner took that out on 2026-09-26: a customer who had
 * only asked which documents to bring was handed the form and then met silence. The bot now
 * answers until a person writes in the thread — the stamp an agent's reply leaves.
 */
describe("once the form has been handed over", () => {
  it("keeps answering the customer until a person writes", async () => {
    session.slots = { product: "lifeprotect", formSent: true };
    await handle({ sender: { id: "psid-done" }, message: { mid: "mg1", text: "กรอกแล้วครับ" } });
    expect(answer).toHaveBeenCalled();
    expect(sent.text.length).toBeGreaterThan(0);
  });

  /**
   * A session is a day old and an application is not finished in a day. The stamp is read
   * past the staleness that empties the slots, so Thursday's message is met by the same
   * silence Tuesday's was.
   */
  it("stays quiet after the session itself has gone stale", async () => {
    session.slots = null;
    session.handedOverAt = new Date("2026-09-01T00:00:00.000Z").toISOString();
    await handle({ sender: { id: "psid-old" }, message: { mid: "mg4", text: "ขอถามอีกเรื่องครับ" } });
    expect(sent.text).toEqual([]);
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not stamp the thread when the form goes out: only a person's reply does", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ยินดีครับ 😊" }],
      slots: { intent: "quote", product: "lifeprotect", formSent: true },
    }));
    await handle({ sender: { id: "psid-stamp" }, message: { mid: "mg5", text: "สนใจสมัคร" } });
    expect(saved.at(-1)!.handedOverAt).toBeUndefined();

    // an ordinary turn leaves the column alone rather than writing null over a stamp
    saved.length = 0;
    await handle({ sender: { id: "psid-plain" }, message: { mid: "mg6", text: "ทุน 1 ล้าน" } });
    expect(saved.at(-1)!.handedOverAt).toBeUndefined();
  });

  it("still answers the turn that sends the form", async () => {
    answer.mockImplementationOnce(async (): Promise<Answer> => ({
      messages: [{ text: "ยินดีครับ 😊 รบกวนกรอกข้อมูลตามฟอร์มนี้ได้เลยครับ" }],
      slots: { intent: "quote", product: "lifeprotect", formSent: true },
    }));
    await handle({ sender: { id: "psid-form" }, message: { mid: "mg2", text: "สนใจสมัคร" } });
    expect(sent.text.join(" ")).toContain("ฟอร์ม");
  });

  /** A thread nobody has been handed anything in is untouched by this. */
  it("leaves an ordinary thread alone", async () => {
    session.slots = { product: "lifeprotect" };
    await handle({ sender: { id: "psid-live" }, message: { mid: "mg3", text: "ขอตารางมูลค่า" } });
    expect(sent.text.length).toBeGreaterThan(0);
  });
});

describe("the transcript", () => {
  it("keeps the customer's words and the bot's answer, with a marker for the card", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "t1", text: "ชาย 35 ล้านนึง" } });
    expect(kept).toEqual([
      { role: "customer", text: "ชาย 35 ล้านนึง" },
      { role: "bot", text: "เบี้ยประมาณ…\n[การ์ดใบเสนอ]" },
    ]);
  });

  it("keeps what the agent typed by hand", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "t2", text: "เดี๋ยวโทรหาครับ", is_echo: true } });
    expect(kept).toEqual([{ role: "agent", text: "เดี๋ยวโทรหาครับ" }]);
  });

  it("does not keep the bot's own echo a second time", async () => {
    await handle({ sender: { id: "page" }, recipient: { id: "psid" }, message: { mid: "t3", text: "เบี้ย…", is_echo: true, app_id: "app-1" } });
    expect(kept).toEqual([]);
  });
});

describe("a customer on an Expat Page", () => {
  const EXPAT = "112079600278201";
  const asked = { sender: { id: "psid-expat" }, message: { mid: "mx1", text: "hello" } };

  it("is answered by the dispatcher told which Page it is", async () => {
    await handle(asked, EXPAT);
    expect((answer.mock.calls[0] as unknown[])[4]).toBe(EXPAT);
  });

  it("is apologised to in English when the answer will not come", async () => {
    answer.mockRejectedValue(new Error("ล่ม"));
    await expect(handle(asked, EXPAT)).rejects.toThrow();
    expect(sent.text).toEqual(["Sorry, something went wrong on our side — I'll get back to you here shortly 🙏"]);
  });

  it("is apologised to in Thai when they wrote Thai", async () => {
    answer.mockRejectedValue(new Error("ล่ม"));
    await expect(handle({ ...asked, message: { mid: "mx2", text: "สนใจค่ะ" } }, EXPAT)).rejects.toThrow();
    expect(sent.text).toEqual(["ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินกลับมาตอบให้นะครับ 🙏"]);
  });
});

/**
 * The quote's PDF on Messenger: the words, then the file the bot fetched from its own route.
 * Whatever goes wrong with the file, the customer is handed the page to print it from.
 */
describe("a PDF the customer asked for", () => {
  const PDF = "/api/quote-pdf?page=plb&age=35&v=1";
  const asked = { sender: { id: "psid-pdf" }, message: { mid: "m1", text: "ขอไฟล์ PDF" } };
  const fetched = vi.fn();

  beforeEach(() => {
    fetched.mockReset();
    vi.stubGlobal("fetch", fetched);
    answer.mockImplementation(async () => ({
      messages: [{ text: "กำลังทำไฟล์ให้ครับ", file: PDF }],
      replies: ["ขอไฟล์ PDF"],
      slots: { intent: "quote" },
    }));
  });

  it("is sent as a file, after the words, named as the route names it", async () => {
    fetched.mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70]), {
      status: 200, headers: { "content-disposition": 'inline; filename="plb-M35.pdf"' },
    }));
    await handle(asked);
    expect(sent.text).toEqual(["กำลังทำไฟล์ให้ครับ"]);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe("plb-M35.pdf");
    expect([...files[0].bytes]).toEqual([37, 80, 68, 70]);
    // the buttons ride on the file, the last thing on the screen
    expect(files[0].replies).toEqual(["ขอไฟล์ PDF"]);
    expect(fetched.mock.calls[0][0]).toContain(PDF);
  });

  it("carries the bot's own key to the route, so its fetch is not counted as a visitor's", async () => {
    process.env.CRON_SECRET = "cron-key";
    fetched.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    await handle(asked);
    expect(fetched.mock.calls[0][1].headers.authorization).toBe("Bearer cron-key");
    // no filename header: the file still goes, under a name of ours
    expect(files[0].filename).toBe("quote.pdf");
    delete process.env.CRON_SECRET;
  });

  it("sends no authorization header when there is no key to send", async () => {
    delete process.env.CRON_SECRET;
    fetched.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    await handle(asked);
    expect(fetched.mock.calls[0][1]?.headers?.authorization).toBeUndefined();
  });

  it("is handed over as the page's address when the route cannot print it", async () => {
    fetched.mockResolvedValue(new Response("down", { status: 503 }));
    await handle(asked);
    expect(files).toHaveLength(0);
    expect(sent.text[1]).toContain("ส่งไฟล์ไม่สำเร็จครับ เปิดหน้านี้แล้วกดปุ่มบันทึก PDF ได้เลยครับ");
    expect(sent.text[1]).toContain("/plb?age=35");
    expect(sent.text[1]).not.toContain("quote-pdf");
  });

  it("is handed over as the page's address when Messenger refuses the file", async () => {
    fetched.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    fileFails = true;
    await handle(asked);
    expect(sent.text[1]).toContain("/plb?age=35");
  });

  it("is handed over in English on an Expat Page when the file cannot be printed", async () => {
    fetched.mockResolvedValue(new Response("down", { status: 503 }));
    answer.mockImplementation(async () => ({
      messages: [{ text: "Preparing your file…", file: "/api/quote-pdf?page=ihealthy-ultra&age=35&sex=M&l=en&v=1" }],
      replies: ["I want to apply"],
      slots: { product: "ihealthy", intent: "quote", lang: "en" },
    }) as unknown as Answer);
    await handle({ sender: { id: "psid-pdf-en" }, message: { mid: "mpe", text: "Send me the PDF" } }, "112079600278201");
    expect(sent.text[1]).toContain("I couldn't send the file");
    expect(sent.text[1]).toContain("/ihealthy-ultra?age=35&sex=M");
  });

  it("is asked to wait when the route says too many", async () => {
    fetched.mockResolvedValue(new Response("slow down", { status: 429 }));
    await handle(asked);
    expect(files).toHaveLength(0);
    expect(sent.text[1]).toBe("รอสักครู่แล้วขอใหม่นะครับ");
  });

  it("sends a couple both files, told once that they are coming, the buttons on the last", async () => {
    const PDF2 = "/api/quote-pdf?page=plb&age=33&v=1";
    answer.mockImplementation(async () => ({
      messages: [{ text: "กำลังทำไฟล์ให้ครับ", file: PDF }, { text: "", file: PDF2 }],
      replies: ["สนใจสมัคร"],
      slots: { intent: "quote" },
    }));
    fetched.mockImplementation(async () => new Response(new Uint8Array([37]), { status: 200 }));
    await handle(asked);
    expect(sent.text).toEqual(["กำลังทำไฟล์ให้ครับ"]);
    expect(files).toHaveLength(2);
    expect(fetched.mock.calls.map((c) => c[0])).toEqual([expect.stringContaining(PDF), expect.stringContaining(PDF2)]);
    expect(files[0].replies).toBeUndefined();
    expect(files[1].replies).toEqual(["สนใจสมัคร"]);
  });
});
