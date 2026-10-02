import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
type AnyAnswer = Awaited<ReturnType<typeof answerAny>>;
const { PDF_ASKED, PDF_OFFER, PDF_YES, PDF_NO } = await import("@/lib/assistant/pdf");
const { APPLICATION_FORM } = await import("@/lib/assistant/common");
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";

const OFFER = "อยากได้เป็นไฟล์ PDF ไว้เก็บหรือส่งต่อให้ครอบครัวไหมครับ?";
const DECLINED = "ได้เลยครับ มีอะไรอยากถามต่อ พิมพ์มาได้เลย";
const NO_QUOTE = "ทำไฟล์ PDF ให้ได้ครับ ขอแบบประกัน อายุ และเพศก่อน เดี๋ยวคิดเบี้ยให้แล้วส่งไฟล์ให้เลย";
const NO_PDF = "เบี้ยนี้ยังทำเป็นไฟล์ PDF ไม่ได้ครับ ส่งรูปใบเสนอให้แทนนะครับ";

const memoryOf = (a: AnyAnswer) => (a.slots as WithPdf<AnySlots>).pdf;
const spoken = (a: AnyAnswer) => a.messages.map((m) => m.text).join("\n\n");
const offers = (a: AnyAnswer) => a.messages.filter((m) => m.text === OFFER).length;

/** A conversation so far, ending with what the customer says now. */
function thread(...turns: [string, AnyAnswer][]): (now: string) => ChatMessage[] {
  return (now) => [
    ...turns.flatMap(([asked, answer]) => [
      { role: "user" as const, content: asked },
      { role: "assistant" as const, content: spoken(answer) },
    ]),
    { role: "user" as const, content: now },
  ];
}

const LIFE = "Life Protect ชาย 35 ทุน 1 ล้าน";

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("the words that ask for a file", () => {
  it("are the constraint's own", () => {
    expect(PDF_OFFER).toBe(OFFER);
    expect(PDF_YES).toBe("ขอไฟล์ PDF");
    expect(PDF_NO).toBe("ไม่เป็นไร");
  });

  for (const text of ["ขอ PDF", "ขอไฟล์", "ขอใบเสนอ", "ส่งไฟล์ให้หน่อย", "ขอไฟล์ pdf"]) {
    it(`hears "${text}"`, () => expect(PDF_ASKED.test(text)).toBe(true));
  }
  for (const text of ["ขอตาราง", "ขอดูตารางมูลค่า"]) {
    it(`leaves "${text}" to the table`, () => expect(PDF_ASKED.test(text)).toBe(false));
  }
});

describe("a quotation the sales page can print", () => {
  it("offers the file after the first Life Protect quote", async () => {
    const a = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    expect(a.messages.at(-1)!.text).toBe(OFFER);
    expect(a.replies!.slice(0, 2)).toEqual(["ขอไฟล์ PDF", "ไม่เป็นไร"]);
    expect(memoryOf(a)!.path).toMatch(/page=lifeprotect&age=35&sex=M&sum=1000000/);
    expect(memoryOf(a)!.asked).toEqual(["lifeprotect"]);
    // the quote's own message keeps the path, and is never the one that delivers it
    expect(a.messages[0].pdfPath).toBe(memoryOf(a)!.path);
    expect(a.messages.some((m) => m.file)).toBe(false);
  });

  it("asks once per plan, then only shows the button", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const again = await answerAny(thread([LIFE, first])("ทุน 2 ล้าน"), first.slots, "facebook");
    expect(again.priced).toBe(true);
    expect(offers(again)).toBe(0);
    expect(again.replies![0]).toBe(PDF_YES);
    expect(again.replies).not.toContain(PDF_NO);
    // the newest quote is the one remembered
    expect(memoryOf(again)!.path).toBe(again.messages.find((m) => m.pdfPath)!.pdfPath);
    expect(memoryOf(again)!.asked).toEqual(["lifeprotect"]);
  });

  it("remembers the second of a couple, and offers once", async () => {
    const a = await answerAny([{ role: "user", content: "ผญ 32 ผช 33 Life Protect ทุน 1 ล้าน" }], null, "facebook");
    expect(a.messages.filter((m) => m.card).length).toBe(2);
    expect(memoryOf(a)!.path).toMatch(/age=33&sex=M/);
    expect(offers(a)).toBe(1);
    expect(a.messages.at(-1)!.text).toBe(OFFER);
  });

  it("puts the buttons first on the website's chips too", async () => {
    const a = await answerAny(
      [{ role: "user", content: "Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 12 ปี เบี้ยเท่าไหร่" }], null, "web");
    expect(a.priced).toBe(true);
    expect(a.messages.at(-1)!.text).toBe(OFFER);
    expect(a.guide!.slice(0, 2)).toEqual([{ label: PDF_YES, ask: PDF_YES }, { label: PDF_NO, ask: PDF_NO }]);
    expect(a.replies).toEqual([PDF_YES, PDF_NO]);
    expect(memoryOf(a)!.path).toMatch(/page=lifetreasure/);
  });
});

describe("asked for the file", () => {
  it("sends the last quote's file when asked in words", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    chat.mockClear();
    const a = await answerAny(thread([LIFE, first])("ขอไฟล์ PDF หน่อย"), first.slots, "facebook");
    expect(a.messages).toHaveLength(1);
    expect(a.messages[0].file).toBe(memoryOf(first)!.path);
    expect(a.messages[0].text).toBe("กำลังทำไฟล์ให้ครับ");
    expect(memoryOf(a)).toEqual(memoryOf(first));
    // the conversation is carried through untouched
    expect(a.slots).toMatchObject({ product: "lifeprotect", age: 35, sex: "M" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("words it for the page and LINE without promising Messenger's attachment", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "line");
    for (const channel of ["line", "web"] as const) {
      const a = await answerAny(thread([LIFE, first])(PDF_YES), first.slots, channel);
      expect(a.messages[0].file).toBe(memoryOf(first)!.path);
      expect(a.messages[0].text).not.toBe("กำลังทำไฟล์ให้ครับ");
      expect(a.messages[0].text).toContain("PDF");
    }
  });

  it("reads เอาครับ after the offer as the file, not the form", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])("เอาครับ"), first.slots, "facebook");
    expect(a.messages[0].file).toBe(memoryOf(first)!.path);
    expect(spoken(a)).not.toContain(APPLICATION_FORM);

    // and where the same last message also invited the form — which on its own reads a bare
    // yes as applying (tookUpTheOffer) — the offer, asked last, still wins
    const invited: ChatMessage[] = [
      { role: "user", content: LIFE },
      { role: "assistant", content: `${spoken(first)}\n\nพิมพ์ว่า "สนใจสมัคร" ได้เลยครับ\n\n${OFFER}` },
      { role: "user", content: "เอาครับ" },
    ];
    const undecided = { product: "undecided" as const, pdf: memoryOf(first) } as AnySlots;
    const b = await answerAny(invited, undecided, "facebook");
    expect(b.messages[0].file).toBe(memoryOf(first)!.path);
    expect(spoken(b)).not.toContain(APPLICATION_FORM);
  });

  it("still sends the form for สมัคร after the offer", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])("สมัคร"), first.slots, "facebook");
    expect(spoken(a)).toContain(APPLICATION_FORM);
    expect(a.messages.some((m) => m.file)).toBe(false);
  });

  it("stops asking after ไม่เป็นไร", async () => {
    const easy = "Easy Protect ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่";
    const first = await answerAny([{ role: "user", content: easy }], null, "facebook");
    expect(first.messages.at(-1)!.text).toBe(OFFER);
    const no = await answerAny(thread([easy, first])(PDF_NO), first.slots, "facebook");
    expect(spoken(no)).toBe(DECLINED);
    expect(memoryOf(no)!.declined).toBe(true);

    // another plan, never offered: still not asked
    const next = await answerAny(thread([easy, first], [PDF_NO, no])(LIFE), no.slots, "facebook");
    expect(next.priced).toBe(true);
    expect(offers(next)).toBe(0);
    // the button stays: the customer said no to the question, not to the file
    expect(next.replies![0]).toBe(PDF_YES);
    expect(next.replies).not.toContain(PDF_NO);
    expect(memoryOf(next)!.path).toMatch(/page=lifeprotect/);
    expect(memoryOf(next)!.declined).toBe(true);
  });

  it("hears a plain ไม่ after the offer as the same no", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const no = await answerAny(thread([LIFE, first])("ไม่ครับ"), first.slots, "facebook");
    expect(spoken(no)).toBe(DECLINED);
    expect(memoryOf(no)!.declined).toBe(true);
  });

  it("leaves ขอดูตารางมูลค่า alone", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])("ขอดูตารางมูลค่า"), first.slots, "facebook");
    expect(a.messages[0].card).toContain("/api/card/table?");
    expect(a.messages.some((m) => m.file)).toBe(false);
    expect(offers(a)).toBe(0);
    // the table is not a quotation: the file asked for next is still the quote's
    expect(memoryOf(a)!.path).toBe(memoryOf(first)!.path);
  });

  it("answers a PDF request with no quote yet", async () => {
    const a = await answerAny([{ role: "user", content: "ขอไฟล์ PDF" }], null, "facebook");
    expect(spoken(a)).toBe(NO_QUOTE);
    expect(a.messages.some((m) => m.file || m.card)).toBe(false);
  });

  it("prices a request for a quotation that carries its own figures", async () => {
    // "ขอใบเสนอราคา" with the figures in it is asking for a quote, which then offers the file
    const a = await answerAny([{ role: "user", content: "ขอใบเสนอราคา Life Protect ชาย 35 ทุน 1 ล้าน" }], null, "facebook");
    expect(a.priced).toBe(true);
    expect(a.messages.at(-1)!.text).toBe(OFFER);
  });

  it("sends the card when the quote has no PDF", async () => {
    const ci = "CI123 ชาย 35 ทุน 1 ล้าน";
    const first = await answerAny([{ role: "user", content: ci }], null, "facebook");
    const card = first.messages[0].card;
    expect(card).toBeDefined();
    expect(offers(first)).toBe(0);
    expect(first.replies ?? []).not.toContain(PDF_YES);
    const a = await answerAny(thread([ci, first])("ขอ PDF"), first.slots, "facebook");
    expect(a.messages[0].text).toBe(NO_PDF);
    expect(a.messages.find((m) => m.card)?.card).toBe(card);
    expect(a.messages.some((m) => m.file)).toBe(false);
  });

  it("forgets an earlier file once a quote without one comes after it", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const ci = "CI123 ชาย 35 ทุน 1 ล้าน";
    const second = await answerAny(thread([LIFE, first])(ci), first.slots, "facebook");
    expect(memoryOf(second)!.path).toBeUndefined();
    const a = await answerAny(thread([LIFE, first], [ci, second])("ขอ PDF"), second.slots, "facebook");
    expect(a.messages[0].text).toBe(NO_PDF);
  });
});
