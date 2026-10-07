import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

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
const { CHOOSE_HEALTH, CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD } = await import("@/lib/assistant/choose");

const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a customer who has not said what they came for", () => {
  it("is answered before being asked back, when the question was about the company", async () => {
    // a real first message: "ของอะไร" means which company, and got "สนใจแบบไหนครับ" back
    const answer = await answerAny(said("ของอะไร"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    // the question is still put, and the buttons still offered
    expect(answer.messages.at(-1)!.text).toContain("สนใจแบบไหน");
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD]);
    expect(chat).not.toHaveBeenCalled();
  });

  /**
   * Two real messages from the page, both answered with the menu they had already been past.
   *
   * "สนใจสมัคร" is the words the bot hands out and the title of the button under every
   * follow-up; "สนใจ" came from a customer the bot had just told to type it. Neither is a
   * question about which plan, and both are the one message the advertising is paid for.
   */
  it("sends the form to someone asking to apply, plan or no plan", async () => {
    const answer = await answerAny(said("สนใจสมัคร"), { product: "undecided" });
    expect(answer.messages.map((m) => m.text).join("\n")).toContain("ฟอร์ม");
    expect(answer.slots).toMatchObject({ product: "undecided", formSent: true });
    expect(chat).not.toHaveBeenCalled();
  });

  it("reads a bare yes as the form, but only where the form was just offered", async () => {
    const invited = [
      { role: "user" as const, content: "ตรวจสุขภาพมั้ย" },
      { role: "assistant" as const, content: 'ถ้าสนใจขั้นตอนการสมัคร พิมพ์ว่า สนใจสมัคร ได้เลยครับผม' },
      { role: "user" as const, content: "สนใจ" },
    ];
    const taken = await answerAny(invited, { product: "undecided" });
    expect(taken.messages.map((m) => m.text).join("\n")).toContain("ฟอร์ม");

    // the same word from someone who has been offered nothing is still someone to ask
    const cold = await answerAny(said("สนใจ"), null);
    expect(cold.messages.at(-1)!.text).toContain("สนใจแบบไหน");
  });

  /**
   * A man of sixty-eight, on the page this morning.
   *
   * He gave his age, was shown four arrangements, wrote "ขอดูทั้ง2แบบ" and was shown the same
   * four again — the second telling as much of a dead end as the first.
   *
   * What fixed it is not arithmetic about his age: the menu is three doors, it is the same
   * three for everybody, and what it must not do is put them up twice. A customer who did
   * not choose is not helped by the list again, so the second time he is offered a person.
   */
  it("shows the same three whatever age is on the session", async () => {
    const answer = await answerAny(said("อายุ 68 ปีครับ"), null);
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD]);
    expect(answer.messages.at(-1)!.text).toContain("สนใจแบบไหน");
  });

  it("shows all three when nothing has been said", async () => {
    const answer = await answerAny(said("สนใจครับ"), null);
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD]);
  });

  it("does not put the same menu up twice; it offers a person instead", async () => {
    const first = await answerAny(said("อายุ 68 ปีครับ"), null);
    const again = await answerAny([
      { role: "user" as const, content: "อายุ 68 ปีครับ" },
      { role: "assistant" as const, content: first.messages.at(-1)!.text },
      { role: "user" as const, content: "ขอดูทั้ง2แบบ" },
    ], first.slots);
    expect(again.messages[0].text).not.toContain("สนใจแบบไหนครับ");
    expect(again.messages[0].text).toContain("แอดมิน");
    // the buttons stay up, because some customers were only scrolling
    expect(again.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD]);
  });

  /**
   * The list is numbered, so the number has to be an answer.
   *
   * A customer on a phone types faster than they scroll to a button, and "2" was falling
   * through to the menu again — the one reply that proved they had read it treated as if they
   * had said nothing.
   */
  it("takes the number a customer types at the menu", async () => {
    const menu = await answerAny(said("สนใจครับ"), null);
    const after = await answerAny([
      { role: "user" as const, content: "สนใจครับ" },
      { role: "assistant" as const, content: menu.messages.at(-1)!.text },
      { role: "user" as const, content: "2" },
    ], menu.slots);
    expect(after.slots).toMatchObject({ product: "legacy" });
    expect(after.messages.at(-1)!.text).not.toContain("สนใจแบบไหน");
  });

  /**
   * The same two characters, with no list behind them.
   *
   * A digit is only an answer to a question that was asked, and reading one out of nowhere
   * would put a customer onto a plan they never heard named.
   */
  it("does not read a number out of a conversation that never saw the menu", async () => {
    const answer = await answerAny(said("2"), null);
    expect(answer.slots).toMatchObject({ product: "undecided" });
    expect(answer.messages.at(-1)!.text).toContain("สนใจแบบไหน");
  });

  /**
   * Every arrangement here is issued below eighty-one, and this customer is eighty-five.
   *
   * He is shown the menu all the same. The bot is not the underwriter — the plans refuse for
   * themselves once there is a plan, and an inbox a person reads is a better place to be
   * turned down than a greeting.
   */
  it("still shows the menu at an age every arrangement would refuse", async () => {
    const answer = await answerAny(said("อายุ 85 ปีครับ"), null);
    expect(answer.messages.at(-1)!.text).toContain("สนใจแบบไหน");
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD]);
  });

  /** "คุ้มครองถึงอายุ 99 ไหม" is a question about the contract, not a customer of ninety-nine. */
  it("does not read the contract's own age as the customer's", async () => {
    const answer = await answerAny(said("คุ้มครองถึงอายุ 99 ไหมครับ"), null);
    expect(answer.slots).not.toMatchObject({ age: 99 });
  });

  it("keeps everyone the message named, not just the first", async () => {
    // a family of three, the message that lost two of them yesterday
    const answer = await answerAny(said("ช 23\nญ 25\nช 53"), null);
    expect(answer.slots).toMatchObject({
      product: "undecided",
      people: [{ age: 23, sex: "M" }, { age: 25, sex: "F" }, { age: 53, sex: "M" }],
    });
  });

  it("prices all of them when the cover finally arrives, whatever the model calls the turn", async () => {
    const asked = await answerAny(said("ญ 34 / ช 33 / ช54"), null);
    // tapping the button settles the plan; the model reads it as a question about the plan
    routed = { intent: "plan_info" };
    const chose = await answerAny(said("🛡️ Life Protect x 2"), asked.slots);
    // and now the one thing that was missing, which the model reads as nothing in particular
    routed = { intent: "other" };
    const answer = await answerAny(said("ทุน1ล้าน"), chose.slots);
    expect(answer.priced).toBe(true);
    // a quote each, a table each, then the one offer of the PDF (pdf.ts)
    expect(answer.messages).toHaveLength(7);
    expect(answer.messages[6].text).toContain("ไฟล์ PDF");
    expect(answer.messages[0].card).toContain("age=34&sex=F");
    expect(answer.messages[1].card).toContain("age=33&sex=M");
    expect(answer.messages[2].card).toContain("age=54&sex=M");
    expect(answer.messages[3].card).toContain("/api/card/table?");
    expect(answer.messages[3].card).toContain("&fig=1&v=");
  });

  it("prices all of them once the plan is settled", async () => {
    const asked = await answerAny(said("ช 23\nญ 25\nช 53"), null);
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const answer = await answerAny(said("ประกันมรดก ทุน 1 ล้าน"), asked.slots);
    // a quote each, a table each, then the one offer of the PDF (pdf.ts)
    expect(answer.messages).toHaveLength(7);
    expect(answer.messages[6].text).toContain("ไฟล์ PDF");
    expect(answer.messages[0].card).toContain("age=23&sex=M");
    expect(answer.messages[2].card).toContain("age=53&sex=M");
    expect(answer.messages[5].card).toContain("age=53&sex=M");
  });

  it("is asked, with the three buttons, and no model is paid", async () => {
    const answer = await answerAny(said("สนใจค่ะ"), null);
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD]);
    expect(answer.slots).toMatchObject({ product: "undecided" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("is remembered by age and sex while it asks", async () => {
    const answer = await answerAny(said("หญิง 35"), null);
    expect(answer.slots).toMatchObject({ product: "undecided", age: 35, sex: "F" });
  });

  it("goes straight on once the button is tapped, without asking again", async () => {
    routed = { intent: "quote" };
    const answer = await answerAny(said(CHOOSE_HEALTH), { product: "undecided", age: 35, sex: "F" });
    expect(answer.slots).toMatchObject({ product: "ihealthy", age: 35, sex: "F" });
    expect(answer.messages[0].card).toContain("/api/ihealthy-card/table?");
  });
});

describe("a customer whose message says what they came for", () => {
  it("is answered in the same turn, with no button in the way", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerAny(said("สนใจประกันมรดก ทุน 1,000,000"), null);
    expect(answer.slots).toMatchObject({ product: "lifeprotect" });
    expect(answer.priced).toBe(true);
  });

  it("is heard from the subject alone when no plan is named", async () => {
    routed = { intent: "quote", age: 35, sex: "F" };
    const answer = await answerAny(said("ค่าห้องวันละเท่าไหร่ หญิง 35"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });

  /**
   * A first line that holds everything a quotation needs is priced, whatever the model called it.
   *
   * "ทุน 1,000,000 ญ อายุ 40" as an opening line was read right — a woman of forty, a million —
   * and answered with a paragraph, because only a turn with a turn before it was checked for
   * being complete.
   */
  it("is priced on the first line when it names a sex, an age and a sum", async () => {
    routed = { intent: "other" };
    const answer = await answerAny(said("ทุน 1,000,000 ญ อายุ 40"), null);
    expect(answer.slots).toMatchObject({ product: "lifeprotect", intent: "quote", age: 40, sex: "F", coverWanted: 1_000_000 });
    expect(answer.priced).toBe(true);
  });

  it("is not priced on a first line that is missing one of the three", async () => {
    routed = { intent: "other" };
    const answer = await answerAny(said("ทุน 1,000,000 อายุ 40"), null);
    expect(answer.priced).toBeFalsy();
  });
});

describe("a sum and what it doubles to", () => {
  /**
   * A customer on a Life Protect quotation wrote "ทุน 2,500,000 เพิ่มเป็น 5,000,000 หละคะ" and
   * was sent 1,250,000 rising to 2,500,000. Whatever the model reads, the headline she gets
   * back is the one she wrote.
   */
  it("quotes the sum assured the customer named, not half of it", async () => {
    const stored = { product: "lifeprotect" as const, intent: "quote" as const, age: 40, sex: "F" as const, coverWanted: 1_000_000 };
    for (const r of [{ intent: "quote", coverWanted: 2_500_000 }, { intent: "quote" }, { intent: "quote", coverWanted: 5_000_000 }]) {
      routed = r;
      const answer = await answerAny(said("ทุน 2,500,000 เพิ่มเป็น 5,000,000 หละคะ"), stored);
      expect(answer.priced, JSON.stringify(r)).toBe(true);
      expect(answer.messages[0].text, JSON.stringify(r)).toContain("ทุน 2,500,000 บาท เพิ่มเป็น 5,000,000");
    }
  });
});

describe("a conversation already under way", () => {
  it("treats a session from before this existed as the life plan", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerAny(said("ชาย 35 ล้านนึง"), { intent: "quote" } as never);
    expect(answer.slots.product).toBe("lifeprotect");
  });

  it("switches when the other plan is named, carrying only the person", async () => {
    routed = { intent: "other" };
    const answer = await answerAny(said("แล้ว Life Protect ล่ะ"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD", territory: "เอเชีย",
    });
    expect(answer.slots).toMatchObject({ product: "lifeprotect", age: 35, sex: "F" });
    expect(JSON.stringify(answer.slots)).not.toContain("GOLD");
    expect(JSON.stringify(answer.slots)).not.toContain("เอเชีย");
  });

  it("does not switch on a health declaration asked of a life customer", async () => {
    routed = { intent: "plan_info" };
    const answer = await answerAny(said("ต้องตรวจสุขภาพไหม"), {
      product: "lifeprotect", intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000,
    });
    expect(answer.slots.product).toBe("lifeprotect");
  });

  it("does not switch on a subject when a plan is already settled", async () => {
    routed = { intent: "plan_info" };
    const answer = await answerAny(said("ทุนเท่าไหร่"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD",
    });
    expect(answer.slots.product).toBe("ihealthy");
  });
});
