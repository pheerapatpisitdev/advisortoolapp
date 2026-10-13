import { beforeEach, describe, expect, it, vi } from "vitest";

const replies: (string | Error)[] = [];
const prompts: string[] = [];
vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async (o: { messages: { content: string }[] }) => {
    prompts.push(o.messages[0].content);
    const r = replies.shift();
    if (r instanceof Error || r === undefined) throw r ?? new Error("no reply");
    return { text: r, model: "fake-flash", provider: "fake", inputTokens: 1, outputTokens: 1, costThb: 0 };
  }),
}));

import { fallbackLines } from "@/lib/quote-video/brief";
import { writeLines } from "@/lib/quote-video/writer";
import { quoteVideoFacts } from "@/lib/quote-video/script";

const f = quoteVideoFacts({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 })!;
const good = {
  hook: "ถ้าวันหนึ่งคุณไม่อยู่ บ้านที่ยังผ่อนอยู่ใครจะดูแลคะ",
  headline: ["บ้านที่ยังผ่อนอยู่", "ใครจะดูแลต่อ?"],
  close: "ยินดีช่วยดูแลบ้านและคนที่คุณรักค่ะ",
  loopClose: "เพราะไม่มีใครรู้เลยว่า",
  story: "ลองนึกภาพนะคะ บ้านยังผ่อน ลูกยังเล็ก แผนนี้คือเงินก้อนที่ดูแลแทนคุณค่ะ",
  points: ["บ้านยังผ่อน", "ลูกยังเล็ก", "เงินก้อนดูแลแทน"],
};

beforeEach(() => { replies.length = 0; prompts.length = 0; });

describe("writeLines", () => {
  it("uses what the model wrote when it passes", async () => {
    replies.push(JSON.stringify(good));
    const w = await writeLines(f, { hook: "question", story: "burden" }, "long");
    expect(w.written).toBe(true);
    expect(w.lines.hook).toBe(good.hook);
    expect(w.lines.story).toBe(good.story);
    expect(prompts).toHaveLength(1);
    // the prompt carries the quote's own figures and the voice's rules
    expect(prompts[0]).toMatch(/ตกวันละ: 79 บาท/);
    expect(prompts[0]).toMatch(/ห้ามใช้คำว่า เบี้ย/);
  });

  it("asks once more with the reasons, then keeps the fixed line for what still fails", async () => {
    replies.push(JSON.stringify({ ...good, hook: "วันละ 50 บาท ได้ 3 ล้าน" }));
    replies.push(JSON.stringify({ ...good, hook: "เบี้ยถูกมากค่ะ" }));
    const w = await writeLines(f, { hook: "question", story: "burden" }, "full");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/รอบก่อนใช้ไม่ได้/);
    const fixed = fallbackLines(f, { hook: "question", story: "burden" });
    expect(w.lines.hook).toBe(fixed.hook);
    expect(w.lines.headline).toEqual(fixed.headline);
    // what passed the first time stays
    expect(w.lines.close).toBe(good.close);
    expect(w.written).toBe(true);
  });

  it("refuses a closing that asks for the chat again", async () => {
    replies.push(JSON.stringify({ ...good, close: "สนใจ ทักมาคุยกันได้เลยนะคะ" }));
    replies.push(JSON.stringify({ ...good, close: "ทักแชทมาเลยค่ะ" }));
    const w = await writeLines(f, { hook: "question" }, "full");
    expect(w.lines.close).toBe(fallbackLines(f, { hook: "question" }).close);
  });

  it("lets the agent's own note's figures through", async () => {
    replies.push(JSON.stringify({ ...good, hook: "บ้านยังผ่อนอีก 20 ปี ถ้าวันหนึ่งคุณไม่อยู่ ใครจะผ่อนต่อคะ" }));
    const w = await writeLines(f, { hook: "story", note: "ผ่อนบ้านอีก 20 ปี" }, "full");
    expect(w.lines.hook).toMatch(/20 ปี/);
  });

  it("tells the clip in the fixed lines when the model is down", async () => {
    replies.push(new Error("down"));
    const w = await writeLines(f, { hook: "shock", loop: true }, "full");
    expect(w.written).toBe(false);
    expect(w.lines).toEqual(fallbackLines(f, { hook: "shock", loop: true }));
  });
});
