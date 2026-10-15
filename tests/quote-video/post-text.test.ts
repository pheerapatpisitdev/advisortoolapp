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

import { linesBasis, postProblem, quoteBasis, readPostText, writePost } from "@/lib/quote-video/post-text";
import { quoteVideoFacts } from "@/lib/quote-video/script";

const f = quoteVideoFacts({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 })!;
const post = quoteBasis(f, "");
const good = "อายุ 35 วันนี้ เตรียมมรดกให้คนที่รัก 1 ล้าน 💙\n\n✅ ตกวันละ 79 บาท\n✅ คุ้มครองถึงอายุ 99\n\nดูคลิปแล้วทักมาคุยกันได้เลยครับ\n\n#LifeProtect #มรดก2569";

beforeEach(() => { replies.length = 0; prompts.length = 0; });

describe("postProblem", () => {
  it("passes words that say only the clip's figures, emoji and hashtags included", () => {
    expect(postProblem(good, post)).toBeNull();
  });
  it("refuses a figure the clip does not say", () => {
    expect(postProblem("ตกวันละ 50 บาท ได้คุ้มครองถึงอายุ 99 ครับ ทักมาเลย", post)).toMatch(/50/);
  });
  it("refuses returns, links and figures said in words", () => {
    expect(postProblem("ผลตอบแทนดีมาก คุ้มครองถึงอายุ 99 ครับ ทักมาเลย", post)).toMatch(/ผลตอบแทน/);
    expect(postProblem("ดูรายละเอียดที่ https://example.com คุ้มครองถึงอายุ 99", post)).toMatch(/ลิงก์/);
    expect(postProblem("มรดกให้ครอบครัวหนึ่งล้านบาท คุ้มครองถึงอายุ 99 ครับ", post)).toMatch(/คำ/);
  });
  it("keeps มรดก's words: no ออม", () => {
    const legacy = quoteVideoFacts({ product: "LEGACY", age: 35, sex: "F", tier: 1 } as never);
    if (!legacy) return;
    expect(postProblem("ออมไว้ให้ครอบครัว มรดก 1 ล้าน ทักมาคุยกันได้เลยค่ะ", quoteBasis(legacy, ""))).toMatch(/ออม/);
  });
  it("an FHC message may say no figure at all", () => {
    const fhc = linesBasis("customer", "คลิปสรุปผลตรวจ", ["ผลตรวจ 6 ด้าน"], "สมชาย", true);
    expect(postProblem("คุณสมชายครับ ส่งคลิปสรุปผลตรวจ 6 ด้านมาให้ดูครับ", fhc)).toMatch(/6/);
    expect(postProblem("คุณสมชายครับ ส่งคลิปสรุปผลตรวจสุขภาพการเงินมาให้ดูนะครับ มีอะไรสงสัยถามได้เลย", fhc)).toBeNull();
  });
});

describe("writePost", () => {
  it("uses what the model wrote when it passes", async () => {
    replies.push(JSON.stringify({ text: good }));
    expect(await writePost(post, "friendly", "M")).toBe(good);
    expect(prompts[0]).toMatch(/ตกวันละ: 79 บาท/);
    expect(prompts[0]).toMatch(/ลงท้าย ครับ/);
  });
  it("asks once more with the reason, then gives nothing", async () => {
    replies.push(JSON.stringify({ text: "ตกวันละ 50 บาทเท่านั้น คุ้มครองถึงอายุ 99 ครับ" }));
    replies.push(JSON.stringify({ text: "ตกวันละ 4,321 บาทเท่านั้น คุ้มครองถึงอายุ 99 ครับ" }));
    expect(await writePost(post, "short", "F")).toBeNull();
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/รอบก่อนใช้ไม่ได้/);
    expect(prompts[0]).toMatch(/ลงท้าย ค่ะ/);
  });
  it("writes a chat message to a named clip's customer", async () => {
    replies.push(JSON.stringify({ text: "คุณมานีคะ ส่งคลิปแผนมรดก 1 ล้านมาให้ดูค่ะ ตกวันละ 79 บาท มีอะไรสงสัยถามได้เลยนะคะ" }));
    const named = quoteBasis(f, "มานี");
    expect(named.kind).toBe("customer");
    expect(await writePost(named, "friendly", "F")).toMatch(/คุณมานี/);
    expect(prompts[0]).toMatch(/ข้อความแชท/);
  });
  it("a model that is down gives nothing", async () => {
    replies.push(new Error("down"));
    expect(await writePost(post, "friendly", "M")).toBeNull();
  });
});

describe("readPostText", () => {
  it("reads a kept post, and nothing from an empty one", () => {
    expect(readPostText({ text: "สวัสดี", tone: "formal", voice: "F", kind: "customer", tries: 2, writtenAt: "x" })).toMatchObject({ tone: "formal", voice: "F", kind: "customer", tries: 2 });
    expect(readPostText({ text: "  " })).toBeNull();
    expect(readPostText(null)).toBeNull();
  });
});
