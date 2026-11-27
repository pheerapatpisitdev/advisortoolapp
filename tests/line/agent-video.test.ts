import { describe, expect, it } from "vitest";
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import { agentVideoReply, asksForVideo, startLines, videoFormLink, videoStartOfChat } from "@/lib/line/agent-video";
import { videoStartFrom } from "@/lib/quote-video/link";

const SETTINGS = "https://www.advisortool.app/studio/settings?openExternalBrowser=1";

describe("an agent asking for a video", () => {
  it("is read in the owner's own words from the chat (2026-11-27)", () => {
    expect(asksForVideo("สร้างเป็นวิดีโอ")).toBe(true);
    expect(asksForVideo("ผมสามารถสั่งทำวิดีโอจากใน LINE ได้ไหม")).toBe(true);
    expect(asksForVideo("ขอคลิป")).toBe(true);
    expect(asksForVideo("ทำ video ให้หน่อย")).toBe(true);
  });
  it("is not a message that only mentions one, a long one, or no video at all", () => {
    expect(asksForVideo("วิดีโอ")).toBe(false);
    expect(asksForVideo("ชาย 35 ทุน 1 ล้าน")).toBe(false);
    expect(asksForVideo(`${"ก".repeat(80)} ทำวิดีโอ`)).toBe(false);
  });
});

describe("the quote the chat holds", () => {
  const lp = {
    intent: "quote", product: "lifeprotect", age: 35, sex: "M", coverWanted: 2_000_000,
    pdf: { paths: ["/api/quote-pdf?page=lifeprotect&age=35&sex=M&sum=1000000&variant=WLF19H&v=7"], asked: [] },
  } as unknown as WithPdf<AnySlots>;

  it("Life Protect takes the sum assured off the latest PDF, not the cover the family gets", () => {
    expect(videoStartOfChat(lp)).toEqual({ product: "LIFEPROTECT", age: 35, sex: "M", sumAssured: 1_000_000, variant: "WLF19H" });
  });
  it("a PDF of another plan gives Life Protect no sum", () => {
    const other = { ...lp, pdf: { paths: ["/api/quote-pdf?page=plb&age=35&sex=M&sum=500000&variant=PLB10"], asked: [] } } as WithPdf<AnySlots>;
    expect(videoStartOfChat(other)).toEqual({ product: "LIFEPROTECT", age: 35, sex: "M" });
  });
  it("iShield, iHealthy and มรดก from their own slots", () => {
    expect(videoStartOfChat({ product: "ishield", age: 40, sex: "F", sumAssured: 500_000, variant: "WLCI10" } as AnySlots))
      .toEqual({ product: "ISHIELD", age: 40, sex: "F", sumAssured: 500_000, variant: "WLCI10" });
    expect(videoStartOfChat({ product: "ihealthy", intent: "quote", age: 42, sex: "F", plan: "GOLD" } as AnySlots))
      .toEqual({ product: "IHEALTHY", age: 42, sex: "F", plan: "GOLD" });
    expect(videoStartOfChat({ product: "legacy", age: 50, sex: "M", tier: 3 } as AnySlots))
      .toEqual({ product: "LEGACY", age: 50, sex: "M", tier: 3 });
  });
  it("no person, or another plan, is no quote", () => {
    expect(videoStartOfChat({ product: "ishield", sex: "F" } as AnySlots)).toBeNull();
    expect(videoStartOfChat({ product: "undecided", age: 30, sex: "M" } as AnySlots)).toBeNull();
    expect(videoStartOfChat(null)).toBeNull();
  });
  it("the link opens the form on that quote, in the phone's own browser", () => {
    const url = new URL(videoFormLink(videoStartOfChat(lp)));
    expect(url.pathname).toBe("/studio/quote-video");
    expect(url.searchParams.get("openExternalBrowser")).toBe("1");
    expect(videoStartFrom(Object.fromEntries(url.searchParams))).toMatchObject({ product: "LIFEPROTECT", sex: "M", age: 35, sumAssured: 1_000_000 });
  });
  it("names the quote on the card", () => {
    expect(startLines({ product: "LIFEPROTECT", sex: "M", age: 35, sumAssured: 1_000_000 })).toEqual(["Life Protect · ชาย 35 ปี", "ทุน 1,000,000 บาท"]);
    expect(startLines({ product: "LEGACY", sex: "F", age: 50, tier: 3 })).toEqual(["มรดก · หญิง 50 ปี", "ครอบครัวได้รับ 3,000,000 บาท"]);
  });
});

describe("the reply", () => {
  it("after a quote: the words, the card with its link, where the clip goes", () => {
    const start = { product: "LIFEPROTECT" as const, sex: "M" as const, age: 35, sumAssured: 1_000_000 };
    const [words, card, back] = agentVideoReply(start, true, SETTINGS);
    expect(words).toMatchObject({ type: "text", text: expect.stringContaining("กรอกข้อมูลไว้ให้แล้ว") });
    expect(card.type).toBe("flex");
    expect(JSON.stringify(card)).toContain("/studio/quote-video?product=LIFEPROTECT");
    expect(back).toMatchObject({ type: "text", text: expect.stringContaining("ส่งวิดีโอมาที่แชทนี้ให้เลย") });
  });
  it("no quote: how to order one today, in one message", () => {
    const said = agentVideoReply(null, true, SETTINGS);
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ type: "text", text: expect.stringMatching(/^ตอนนี้ยังพิมพ์สั่งในแชทไม่ได้ครับ[\s\S]*\/studio\/quote-video\?openExternalBrowser=1/) });
  });
  it("with คลิปทำเสร็จ off, says where to turn it on (ก)", () => {
    const said = agentVideoReply(null, false, SETTINGS);
    expect(said[0]).toMatchObject({ text: expect.stringContaining(`เปิด "คลิปทำเสร็จ" ในตั้งค่าส่วนตัวก่อนครับ\n${SETTINGS}`) });
  });
});
