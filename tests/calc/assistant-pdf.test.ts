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
const { APPLICATION_FORM, FORM_RECEIVED, WANTS_IN } = await import("@/lib/assistant/common");
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";

const OFFER = "อยากได้เป็นไฟล์ PDF ไว้เก็บหรือส่งต่อให้ครอบครัวไหมครับ?";
const DECLINED = "ได้เลยครับ มีอะไรอยากถามต่อ พิมพ์มาได้เลย";
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
    expect(memoryOf(a)!.paths).toHaveLength(1);
    expect(memoryOf(a)!.paths![0]).toMatch(/page=lifeprotect&age=35&sex=M&sum=1000000/);
    expect(memoryOf(a)!.asked).toEqual(["lifeprotect"]);
    // the quote's own message keeps the path, and is never the one that delivers it
    expect(a.messages[0].pdfPath).toBe(memoryOf(a)!.paths![0]);
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
    expect(memoryOf(again)!.paths).toEqual([again.messages.find((m) => m.pdfPath)!.pdfPath]);
    expect(memoryOf(again)!.asked).toEqual(["lifeprotect"]);
  });

  it("remembers both of a couple, in the order they were named, and offers once", async () => {
    const a = await answerAny([{ role: "user", content: "ผญ 32 ผช 33 Life Protect ทุน 1 ล้าน" }], null, "facebook");
    // two quote cards and their two tables; only the quotes have a file
    expect(a.messages.filter((m) => m.card).length).toBe(4);
    expect(a.messages.filter((m) => m.pdfPath).length).toBe(2);
    expect(memoryOf(a)!.paths).toHaveLength(2);
    expect(memoryOf(a)!.paths![0]).toMatch(/age=32&sex=F/);
    expect(memoryOf(a)!.paths![1]).toMatch(/age=33&sex=M/);
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
    expect(memoryOf(a)!.paths![0]).toMatch(/page=lifetreasure/);
  });
});

describe("asked for the file", () => {
  it("sends the last quote's file when asked in words", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    chat.mockClear();
    const a = await answerAny(thread([LIFE, first])("ขอไฟล์ PDF หน่อย"), first.slots, "facebook");
    expect(a.messages).toHaveLength(1);
    expect(a.messages[0].file).toBe(memoryOf(first)!.paths![0]);
    expect(a.messages[0].text).toBe("กำลังทำไฟล์ให้ครับ");
    // the memory is kept, less the mark that the offer was the last thing said
    expect(memoryOf(a)).toEqual({ ...memoryOf(first)!, offered: undefined });
    expect(memoryOf(a)!.offered).toBeUndefined();
    // the conversation is carried through untouched
    expect(a.slots).toMatchObject({ product: "lifeprotect", age: 35, sex: "M" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("words it for the page and LINE without promising Messenger's attachment", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "line");
    for (const channel of ["line", "web"] as const) {
      const a = await answerAny(thread([LIFE, first])(PDF_YES), first.slots, channel);
      expect(a.messages[0].file).toBe(memoryOf(first)!.paths![0]);
      expect(a.messages[0].text).not.toBe("กำลังทำไฟล์ให้ครับ");
      expect(a.messages[0].text).toContain("PDF");
    }
  });

  it("reads เอาครับ after the offer as the file, not the form", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])("เอาครับ"), first.slots, "facebook");
    expect(a.messages[0].file).toBe(memoryOf(first)!.paths![0]);
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
    expect(b.messages[0].file).toBe(memoryOf(first)!.paths![0]);
    expect(spoken(b)).not.toContain(APPLICATION_FORM);
  });

  for (const yes of ["เอาเลย", "เอาแบบนี้", "เอาอันนี้ครับ"]) {
    it(`reads ${yes} after the offer as the file: the offer was the last question`, async () => {
      const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
      const a = await answerAny(thread([LIFE, first])(yes), first.slots, "facebook");
      expect(a.messages[0].file).toBe(memoryOf(first)!.paths![0]);
      expect(spoken(a)).not.toContain(APPLICATION_FORM);
    });
  }

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
    expect(memoryOf(next)!.paths![0]).toMatch(/page=lifeprotect/);
    expect(memoryOf(next)!.declined).toBe(true);
  });

  it("hears a plain ไม่ after the offer as the same no", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const no = await answerAny(thread([LIFE, first])("ไม่ครับ"), first.slots, "facebook");
    expect(spoken(no)).toBe(DECLINED);
    expect(memoryOf(no)!.declined).toBe(true);
  });

  it("reads ไม่เป็นไรครับ with no offer on screen as politeness, not a no to the file", async () => {
    // the conversation moved on past the offer: a turn that did not offer cleared its mark
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const later = await answerAny(thread([LIFE, first])("ขอดูตารางมูลค่า"), first.slots, "facebook");
    expect(memoryOf(later)!.offered).toBeUndefined();
    const history: ChatMessage[] = [
      { role: "user", content: LIFE },
      { role: "assistant", content: "ยินดีครับ มีอะไรถามเพิ่มได้เลย" },
      { role: "user", content: "ไม่เป็นไรครับ" },
    ];
    const a = await answerAny(history, later.slots, "facebook");
    expect(spoken(a)).not.toBe(DECLINED);
    expect(memoryOf(a)!.declined).toBeUndefined();
    expect(memoryOf(a)!.paths).toEqual(memoryOf(first)!.paths);
  });

  it("leaves ขอดูตารางมูลค่า alone", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])("ขอดูตารางมูลค่า"), first.slots, "facebook");
    expect(a.messages[0].card).toContain("/api/card/table?");
    expect(a.messages.some((m) => m.file)).toBe(false);
    expect(offers(a)).toBe(0);
    // the table is not a quotation: the file asked for next is still the quote's
    expect(memoryOf(a)!.paths).toEqual(memoryOf(first)!.paths);
  });

  it("leaves a PDF request with no quote yet to the usual way: which plan, then the quote", async () => {
    const a = await answerAny([{ role: "user", content: "ขอไฟล์ PDF" }], null, "facebook");
    expect(spoken(a)).toContain("สนใจแบบไหนครับ");
    expect(spoken(a)).not.toContain("ทำไฟล์ PDF ให้ได้ครับ");
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
    expect(memoryOf(second)!.paths).toBeUndefined();
    const a = await answerAny(thread([LIFE, first], [ci, second])("ขอ PDF"), second.slots, "facebook");
    expect(a.messages[0].text).toBe(NO_PDF);
  });
});

describe("a PDF memory that came back from a browser", () => {
  const ask = (pdf: unknown) => answerAny(
    [{ role: "user", content: PDF_YES }], { product: "undecided", pdf } as unknown as AnySlots, "web");

  it("never hands back a path this code did not write", async () => {
    for (const path of ["javascript:alert(1)", "https://evil.example/x.pdf", "/api/quote-pdf?page=fhc&age=35", "//evil.example/api/quote-pdf?page=plb"]) {
      const a = await ask({ paths: [path], asked: [] });
      expect(a.messages.some((m) => m.file), path).toBe(false);
    }
  });

  it("never echoes a card from somewhere else", async () => {
    for (const card of ["https://evil.example/card.png", "/api/card/table?plan=PLB", "javascript:alert(1)"]) {
      const a = await ask({ card, asked: [] });
      expect(a.messages.some((m) => m.card), card).toBe(false);
    }
  });

  it("survives an asked that is not a list, and a declined that is not true", async () => {
    const a = await answerAny([{ role: "user", content: LIFE }],
      { product: "undecided", pdf: { asked: 5, declined: "yes" } } as unknown as AnySlots, "facebook");
    expect(a.messages.at(-1)!.text).toBe(OFFER);
    expect(memoryOf(a)).toMatchObject({ asked: ["lifeprotect"] });
    expect(memoryOf(a)!.declined).toBeUndefined();
  });

  it("keeps the good fields when one is bad", async () => {
    const path = "/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB10&v=x";
    const a = await ask({ paths: [path, "https://evil.example/x.pdf"], card: "https://evil.example/c.png", asked: ["plb", "nope"] });
    expect(a.messages[0].file).toBe(path);
    expect(a.messages.filter((m) => m.file)).toHaveLength(1);
    expect(memoryOf(a)).toEqual({ paths: [path], asked: ["plb"] });
  });
});

/**
 * Words the PDF test hears that belonged to another path first (final review, item 1).
 *
 * "ไฟล์" and "ใบเสนอ" turn up in a company's question, a would-be agent's, an advertisement's
 * first message and the form's own conversation. Each of these got the answer it got before
 * the PDF existed, with a quote in the memory and without one.
 */
describe("a message that only sounds like a request for the file", () => {
  const GROUP = "ขอใบเสนอราคาประกันกลุ่มให้พนักงานบริษัทหน่อยครับ";
  const RECRUIT = "อยากเป็นตัวแทน ขอไฟล์รายละเอียดหน่อย";
  const DOCUMENTS = "สมัครต้องส่งไฟล์อะไรบ้าง";

  it("about a company's staff is handed over as group cover", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    for (const [history, slots] of [
      [thread([LIFE, first])(GROUP), first.slots],
      [[{ role: "user" as const, content: GROUP }], null],
    ] as const) {
      const a = await answerAny([...history], slots, "facebook");
      expect(a.messages[0].text).toContain("ประกันกลุ่มสำหรับองค์กรมีครับ");
      expect(spoken(a)).toContain("/group-insurance");
      expect(a.messages.some((m) => m.file)).toBe(false);
    }
  });

  it("from someone who wants to join the team gets the recruit reply", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    for (const [history, slots] of [
      [thread([LIFE, first])(RECRUIT), first.slots],
      [[{ role: "user" as const, content: RECRUIT }], null],
    ] as const) {
      const a = await answerAny([...history], slots, "facebook");
      expect(a.recruit).toBe(true);
      expect(spoken(a)).toContain("ขอบคุณที่สนใจร่วมทีมครับ");
      expect(a.messages.some((m) => m.file)).toBe(false);
    }
  });

  it("from an iShield advertisement, first thing, is asked for a sex and an age under iShield", async () => {
    const a = await answerAny([{ role: "user", content: "ขอใบเสนอราคาครับ" }], null, "facebook", "ishield");
    expect(a.slots).toMatchObject({ product: "ishield" });
    expect(spoken(a)).toContain("ขอทราบเพศกับอายุ");
    expect(a.messages.some((m) => m.file)).toBe(false);
  });

  it("asking what the application needs gets the steps and the form", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    for (const [history, slots] of [
      [thread([LIFE, first])(DOCUMENTS), first.slots],
      [[{ role: "user" as const, content: DOCUMENTS }], null],
    ] as const) {
      const a = await answerAny([...history], slots, "facebook");
      expect(spoken(a)).toContain(APPLICATION_FORM);
      expect(a.messages.some((m) => m.file)).toBe(false);
    }
  });

  it("saying the form is filled in is thanked and counted, not sent a file", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const form = await answerAny(thread([LIFE, first])("สมัคร"), first.slots, "facebook");
    expect(spoken(form)).toContain(APPLICATION_FORM);
    const done = "กรอกแล้ว ส่งไฟล์ให้แล้วครับ";
    const a = await answerAny(thread([LIFE, first], ["สมัคร", form])(done), form.slots, "facebook");
    expect(spoken(a)).toBe(FORM_RECEIVED);
    expect(a.formDone).toBe(true);
    expect(a.messages.some((m) => m.file)).toBe(false);
  });
});

/**
 * A quote no page prints, and with no picture either, is the latest quote all the same
 * (final review, item 2): the file of the quote before it is the wrong plan's.
 */
describe("a quote with neither a PDF nor a card", () => {
  it("is not answered with the file of the quote before it", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const pension = "บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ";
    const second = await answerAny(thread([LIFE, first])(pension), first.slots, "facebook");
    expect(second.priced).toBe(true);
    expect(second.messages.some((m) => m.card || m.pdfPath)).toBe(false);
    expect(memoryOf(second)!.paths).toBeUndefined();
    expect(memoryOf(second)!.latestHasNoPdf).toBe(true);

    const a = await answerAny(thread([LIFE, first], [pension, second])("ขอไฟล์ PDF"), second.slots, "facebook");
    expect(spoken(a)).toBe(NO_PDF);
    expect(a.messages.some((m) => m.file || m.card)).toBe(false);
  });

  it("is forgotten again once a quote with a PDF follows it", async () => {
    const pension = "บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ";
    const first = await answerAny([{ role: "user", content: pension }], null, "facebook");
    expect(memoryOf(first)!.latestHasNoPdf).toBe(true);
    const second = await answerAny(thread([pension, first])(LIFE), first.slots, "facebook");
    expect(memoryOf(second)!.latestHasNoPdf).toBeUndefined();
    expect(memoryOf(second)!.paths).toHaveLength(1);
  });
});

/** A couple is two quotes, and two files (final review, item 5). */
describe("a couple's files", () => {
  const COUPLE = "ผญ 32 ผช 33 Life Protect ทุน 1 ล้าน";

  it("are both sent, one message each, and Messenger is told once that they are coming", async () => {
    const first = await answerAny([{ role: "user", content: COUPLE }], null, "facebook");
    const a = await answerAny(thread([COUPLE, first])(PDF_YES), first.slots, "facebook");
    expect(a.messages.map((m) => m.file)).toEqual(memoryOf(first)!.paths);
    expect(a.messages.map((m) => m.text)).toEqual(["กำลังทำไฟล์ให้ครับ", ""]);
  });

  it("are both linked on LINE and the website", async () => {
    const first = await answerAny([{ role: "user", content: COUPLE }], null, "line");
    for (const channel of ["line", "web"] as const) {
      const a = await answerAny(thread([COUPLE, first])(PDF_YES), first.slots, channel);
      expect(a.messages.map((m) => m.file)).toEqual(memoryOf(first)!.paths);
      expect(a.messages[0].text).toContain("PDF");
    }
  });
});

/** The way on stays on the screen after the file and after a no (final review, item 6). */
describe("the buttons after the PDF's own turns", () => {
  it("keep สนใจสมัคร after the file", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])(PDF_YES), first.slots, "facebook");
    expect(a.replies).toContain(WANTS_IN);
  });

  it("keep สนใจสมัคร after ไม่เป็นไร", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    const a = await answerAny(thread([LIFE, first])(PDF_NO), first.slots, "facebook");
    expect(spoken(a)).toBe(DECLINED);
    expect(a.replies).toContain(WANTS_IN);
  });

  it("keep สนใจสมัคร after the picture sent in place of a file", async () => {
    const ci = "CI123 ชาย 35 ทุน 1 ล้าน";
    const first = await answerAny([{ role: "user", content: ci }], null, "facebook");
    const a = await answerAny(thread([ci, first])("ขอ PDF"), first.slots, "facebook");
    expect(a.messages[0].text).toBe(NO_PDF);
    expect(a.replies).toContain(WANTS_IN);
  });
});

/**
 * The offer remembered as a mark, not only read off the last message (final review, item 7):
 * the website cuts a long answer at 2,000 characters, and the offer is its last line.
 */
describe("an offer the history no longer shows", () => {
  it("is still the question a yes answers", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "web");
    expect(memoryOf(first)!.offered).toBe(true);
    const cut: ChatMessage[] = [
      { role: "user", content: LIFE },
      { role: "assistant", content: spoken(first).slice(0, 40) },
      { role: "user", content: "เอาครับ" },
    ];
    const a = await answerAny(cut, first.slots, "web");
    expect(a.messages[0].file).toBe(memoryOf(first)!.paths![0]);
    expect(memoryOf(a)!.offered).toBeUndefined();
  });

  it("is a no to the file for ไม่เป็นไร too", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "web");
    const cut: ChatMessage[] = [
      { role: "user", content: LIFE },
      { role: "assistant", content: spoken(first).slice(0, 40) },
      { role: "user", content: PDF_NO },
    ];
    const a = await answerAny(cut, first.slots, "web");
    expect(spoken(a)).toBe(DECLINED);
    expect(memoryOf(a)!.declined).toBe(true);
  });

  it("lasts one turn: a quote without the offer clears it", async () => {
    const first = await answerAny([{ role: "user", content: LIFE }], null, "facebook");
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const again = await answerAny(thread([LIFE, first])("ทุน 2 ล้าน"), first.slots, "facebook");
    expect(offers(again)).toBe(0);
    expect(memoryOf(again)!.offered).toBeUndefined();
  });

  it("is only ever true when it comes back from a browser", async () => {
    const a = await answerAny([{ role: "user", content: "เอาครับ" }],
      { product: "undecided", pdf: { paths: ["/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB10&v=x"], asked: [], offered: "yes" } } as unknown as AnySlots,
      "web");
    expect(a.messages.some((m) => m.file)).toBe(false);
  });
});

describe("a PDF memory's paths from a browser", () => {
  it("keep at most four", async () => {
    const path = (age: number) => `/api/quote-pdf?page=plb&age=${age}&sex=M&sum=1000000&variant=PLB10&v=x`;
    const a = await answerAny([{ role: "user", content: PDF_YES }],
      { product: "undecided", pdf: { paths: [30, 31, 32, 33, 34, 35].map(path), asked: [] } } as unknown as AnySlots, "web");
    expect(a.messages.map((m) => m.file)).toEqual([30, 31, 32, 33].map(path));
  });

  it("are dropped when they are not a list", async () => {
    const a = await answerAny([{ role: "user", content: PDF_YES }],
      { product: "undecided", pdf: { paths: "/api/quote-pdf?page=plb", asked: [] } } as unknown as AnySlots, "web");
    expect(a.messages.some((m) => m.file)).toBe(false);
  });
});
