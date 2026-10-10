import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/** What the stubbed model returns: strict JSON to the router, prose to everything else. */
let routed: Record<string, unknown> = { intent: "other" };

const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route" ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerQuestion } = await import("@/lib/assistant/lifeprotect/answer");
type Routed = import("@/lib/assistant/lifeprotect/route").Routed;

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => {
  chat.mockClear();
  routed = { intent: "other" };
});

/**
 * Owner, 2026-10-10, Messenger only: after "มรดกเก็บออม 30 บาทต่อวัน" and "ญ 41" the bot asks
 * what the insurance is for, any answer goes on to the same quote, and the quote closes on the
 * table picture — no words over the picture, no comparison of the other terms.
 */
describe("the goal question on Messenger", () => {
  const budget = { baht: 10_950, per: "year" as const, perDay: 30 };

  async function toQuestion(channel: "facebook" | "line" | "web" = "facebook") {
    routed = { intent: "quote", age: 41, sex: "F" };
    return answerQuestion(said("ญ 41"), { intent: "other", budget }, channel);
  }

  it("asks what the insurance is for, with the four goals as buttons, before any price", async () => {
    const asked = await toQuestion();
    expect(asked.messages).toHaveLength(1);
    expect(asked.messages[0].text.split("\n")[0]).toBe("อยากทำประกันเพื่ออะไรเป็นหลัก");
    expect(asked.messages[0].text).toContain("4. อยากให้รายได้ของครอบครัวไม่ขาด ถ้าวันหนึ่งเราไม่อยู่");
    expect(asked.replies).toEqual(["มรดกให้คนข้างหลัง", "เงินใช้ตอนเกษียณ", "เก็บเงินให้ลูก/คนรัก", "รายได้ครอบครัวไม่ขาด"]);
    // Messenger cuts a button title at twenty characters
    for (const r of asked.replies!) expect([...r].length, r).toBeLessThanOrEqual(20);
    expect(asked.priced).toBeFalsy();
    expect(asked.messages.some((m) => m.card)).toBe(false);
  });

  it.each(["มรดกให้คนข้างหลัง", "เงินใช้ตอนเกษียณ", "เก็บเงินให้ลูก/คนรัก", "รายได้ครอบครัวไม่ขาด", "ไม่แน่ใจค่ะ"])(
    "goes on to the quote from the budget when the customer answers %s",
    async (reply) => {
      const asked = await toQuestion();
      routed = { intent: "other" };
      const quoted = await answerQuestion(said(reply), asked.slots as Routed, "facebook");
      const texts = quoted.messages.map((m) => m.text);
      expect(texts[0]).toBe("งบวันละ 30 บาท (ปีละ 10,950 บาท) หญิงอายุ 41 ปี ทำทุนได้สูงสุด 350,000 บาท แบบจ่าย 19 ปี ครับ 💰");
      expect(quoted.messages[1].card).toMatch(/^\/api\/card\?/);
      expect(quoted.messages[1].pdfPath).toBeDefined();
      // the table picture is the last word, on its own
      expect(quoted.messages).toHaveLength(3);
      expect(quoted.messages[2]).toEqual({ text: "", card: expect.stringMatching(/^\/api\/card\/table\?/) });
      expect(texts.join("\n")).not.toContain("งบเท่ากัน");
      expect(quoted.replies).toEqual(["จ่าย 9 ปี", "จ่ายถึงอายุ 99", "สนใจสมัคร"]);
      expect(quoted.slots.goalPending).toBeUndefined();

      // asked once: a tap on another term is priced straight away
      routed = { intent: "quote", variant: "WLF09H" };
      const again = await answerQuestion(said("จ่าย 9 ปี"), quoted.slots, "facebook");
      expect(again.messages[0].text).toContain("แบบจ่าย 9 ปี");
      expect(again.messages.some((m) => m.text.includes("เพื่ออะไร"))).toBe(false);
    },
  );

  it("prices a new budget said in place of a goal from the new money", async () => {
    const asked = await toQuestion();
    routed = { intent: "other" };
    const quoted = await answerQuestion(said("วันละ 50 บาท"), asked.slots as Routed, "facebook");
    expect(quoted.messages[0].text).toContain("งบวันละ 50 บาท");
  });

  it.each(["line", "web"] as const)("leaves %s as it was: no question, and the words over the table", async (channel) => {
    const quoted = await toQuestion(channel);
    const texts = quoted.messages.map((m) => m.text);
    expect(texts[0]).toContain("ทำทุนได้สูงสุด 350,000 บาท");
    expect(texts.some((t) => t.includes("เพื่ออะไร"))).toBe(false);
    expect(texts[2]).toBe("กราฟและตารางมูลค่าทุกปี\nเบี้ยต่อปี | เวนคืน | ความคุ้มครอง");
  });

  it("sends a sum quote's table without words on Messenger, and a couple's with whose it is", async () => {
    routed = { intent: "quote", age: 41, sex: "F", coverWanted: 1_000_000 };
    const single = await answerQuestion(said("ญ 41 ทุน 1 ล้าน"), null, "facebook");
    const table = single.messages.find((m) => m.card?.startsWith("/api/card/table"));
    expect(table?.text).toBe("");
    expect(single.messages.some((m) => m.text.includes("เพื่ออะไร"))).toBe(false);

    routed = { intent: "quote", age: 56, sex: "M", people: [{ age: 56, sex: "M" }, { age: 47, sex: "F" }], coverWanted: 1_000_000 };
    const couple = await answerQuestion(said("ชาย 56 หญิง 47 ทุน 1 ล้าน"), null, "facebook");
    const tables = couple.messages.filter((m) => m.card?.startsWith("/api/card/table")).map((m) => m.text);
    expect(tables).toEqual(["ตารางของชาย อายุ 56", "ตารางของหญิง อายุ 47"]);
  });
});
