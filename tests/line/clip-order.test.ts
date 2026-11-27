import { describe, expect, it } from "vitest";
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import {
  asksForClip, cardRows, draftFromChat, freshDraft, inputOf, need, productIn, question, startedReply, startsClip,
  startsOrder, stillMaking, summaryCard, withMessage, fetchAgain, type ClipDraft,
} from "@/lib/line/clip-order";
import { quoteVideoFacts } from "@/lib/quote-video/script";

const NOW = new Date("2026-11-27T09:00:00Z");
const blank = (): ClipDraft => ({ style: "motion", at: NOW.toISOString() });
const order = (text: string, d = blank()) => withMessage(d, text, need(d), NOW);

describe("what starts an order", () => {
  it("the mockup's one-line order and the owner's own words from the chat", () => {
    expect(startsOrder("คลิป LP ชาย 35 ทุน 1 ล้าน คุณสมชาย")).toBe(true);
    expect(startsOrder("ทำคลิปให้ลูกค้าหน่อย")).toBe(true);
    expect(startsOrder("สร้างเป็นวิดีโอ")).toBe(true);
    expect(startsOrder("ผมสามารถสั่งทำวิดีโอจากใน LINE ได้ไหม")).toBe(true);
  });
  it("not ขอคลิป, which fetches; not a quote with no video word; not a long message", () => {
    expect(startsOrder("ขอคลิป")).toBe(false);
    expect(asksForClip("ขอคลิป")).toBe(true);
    expect(asksForClip(" ขอ คลิป ครับ ")).toBe(true);
    expect(asksForClip("ขอคลิป LP ชาย 35")).toBe(false);
    expect(startsOrder("ชาย 35 ทุน 1 ล้าน")).toBe(false);
    expect(startsOrder("วิดีโอ")).toBe(false);
    expect(startsOrder(`${"ก".repeat(120)} ทำวิดีโอ`)).toBe(false);
  });
});

describe("reading an order", () => {
  it("all of it in one line (mockup, left screen)", () => {
    const d = order("คลิป LP ชาย 35 ทุน 1 ล้าน คุณสมชาย");
    expect(d).toMatchObject({ product: "LIFEPROTECT", sex: "M", age: 35, sum: 1_000_000, customer: "สมชาย" });
    expect(need(d)).toBeNull();
    expect(inputOf(d)).toEqual({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, style: "motion", length: "full" });
  });
  it("a piece at a time, the bot asking for what is missing (mockup, middle screen)", () => {
    let d = order("ทำคลิปให้ลูกค้าหน่อย");
    expect(need(d)).toBe("product");
    d = order("iHealthy", d);
    expect(d.product).toBe("IHEALTHY");
    expect(need(d)).toBe("person");
    d = order("หญิง 42", d);
    expect(need(d)).toBe("plan");
    d = order("แผน 3 ซิลเวอร์", d);
    expect(d.plan).toBe("SILVER");
    expect(need(d)).toBeNull();
    expect(inputOf(d)).toMatchObject({ product: "IHEALTHY", age: 42, sex: "F", plan: "SILVER", compare: [] });
  });
  it("a bare answer counts only for what was asked", () => {
    const lp = order("Life Protect ชาย 40");
    expect(need(lp)).toBe("sum");
    expect(order("800000", lp).sum).toBe(800_000);
    expect(order("800000", blank()).sum).toBeUndefined();
    const legacy = order("มรดก หญิง 50");
    expect(order("3", legacy).tier).toBe(3);
    expect(order("5 ล้าน", legacy).tier).toBe(5);
  });
  it("a paying term, and ขอบคุณ is no customer", () => {
    expect(order("คลิป ishield 15 ชาย 30 ทุน 1 ล้าน").variant).toBe("WLCI15");
    expect(order("คลิป LP จ่าย 9 ปี ชาย 30 ทุน 1 ล้าน").variant).toBe("WLF09H");
    expect(order("ขอบคุณครับ ทำคลิป LP").customer).toBeUndefined();
  });
  it("another plan named starts its figures over", () => {
    const lp = order("คลิป LP ชาย 35 ทุน 1 ล้าน");
    const ih = order("เปลี่ยนเป็น iHealthy", lp);
    expect(ih).toMatchObject({ product: "IHEALTHY", sex: "M", age: 35 });
    expect(ih.sum).toBeUndefined();
    expect(need(ih)).toBe("plan");
  });
  it("แบบอื่น is told apart from the four", () => {
    expect(productIn("แบบอื่น")).toBe("other");
    expect(productIn("คลิป 12PL")).toBeUndefined();
  });
});

describe("the quote this chat holds", () => {
  it("an order naming nothing starts from it", () => {
    const lp = {
      intent: "quote", product: "lifeprotect", age: 35, sex: "M",
      pdf: { paths: ["/api/quote-pdf?page=lifeprotect&age=35&sex=M&sum=1000000&variant=WLF19H"], asked: [] },
    } as unknown as WithPdf<AnySlots>;
    expect(draftFromChat(lp, NOW)).toMatchObject({ product: "LIFEPROTECT", sex: "M", age: 35, sum: 1_000_000, variant: "WLF19H", style: "motion" });
    expect(draftFromChat({ product: "plb", age: 35, sex: "M" } as unknown as AnySlots, NOW)).toBeNull();
  });
  it("an order is forgotten after half an hour", () => {
    expect(freshDraft({ ...blank(), product: "LEGACY" }, NOW.getTime() + 29 * 60_000)).toMatchObject({ product: "LEGACY" });
    expect(freshDraft({ ...blank(), product: "LEGACY" }, NOW.getTime() + 31 * 60_000)).toBeNull();
    expect(freshDraft(null)).toBeNull();
  });
});

describe("what the bot says", () => {
  it("asks with buttons", () => {
    const q = question("product", blank());
    expect(q).toMatchObject({ type: "text", text: "ทำคลิปแบบประกันไหนครับ" });
    expect(q.quickReply?.items.map((i) => i.action.text)).toEqual(["Life Protect", "iHealthy", "iShield", "มรดก", "แบบอื่น"]);
    const plans = question("plan", { ...blank(), product: "IHEALTHY" });
    expect(plans.quickReply?.items).toHaveLength(6);
    expect(plans.quickReply?.items[2].action.text).toBe("แผน 3 ซิลเวอร์");
    expect(plans.quickReply?.items.every((i) => Array.from(i.action.label).length <= 20)).toBe(true);
  });
  it("the card: the order, the yearly premium, the look and the price, then the three buttons", () => {
    const d = order("คลิป LP ชาย 35 ทุน 1 ล้าน คุณสมชาย");
    const facts = quoteVideoFacts(inputOf(d)!)!;
    const cost = { ok: true as const, line: "฿10 จากกระเป๋า · เหลือ ฿140", price: "฿10" };
    expect(cardRows(d, facts, cost)).toEqual([
      ["แบบประกัน", "Life Protect · จ่าย 19 ปี"],
      ["ผู้เอาประกัน", "คุณสมชาย · ชาย 35"],
      ["ทุนประกัน", "1,000,000"],
      ["เบี้ย/ปี", facts.prices.find((p) => p.label === "รายปี")!.amount],
      ["แบบคลิป", "Motion · ~60 วิ"],
      ["ราคา", "฿10 จากกระเป๋า · เหลือ ฿140"],
    ]);
    const card = JSON.stringify(summaryCard(d, facts, cost));
    expect(card).toContain("\"text\":\"สร้างคลิป ฿10\"");
    expect(card).toContain("\"text\":\"เปลี่ยนแบบคลิป\"");
    expect(card).toContain("/studio/quote-video?product=LIFEPROTECT");
    expect(card).toContain("openExternalBrowser=1");
    expect(startsClip("สร้างคลิป ฿10")).toBe(true);
    expect(startsClip("สร้างคลิป (ฟรี)")).toBe(true);
  });
  it("มรดก and iHealthy name their own figure", () => {
    const legacy = order("คลิป มรดก หญิง 50 3 ล้าน");
    const cost = { ok: true as const, line: "ใช้สิทธิ์ฟรี · เหลือ 1 ครั้ง", price: "(ฟรี)" };
    expect(cardRows(legacy, quoteVideoFacts(inputOf(legacy)!)!, cost)[2]).toEqual(["ครอบครัวได้รับ", "3,000,000"]);
    const ih = order("คลิป iHealthy หญิง 42 แผน 4");
    expect(cardRows(ih, quoteVideoFacts(inputOf(ih)!)!, cost)[2][0]).toBe("วงเงินต่อปี");
  });
  it("started: the clip comes here; near the month's limit, by ขอคลิป", () => {
    expect(startedReply(true)).toMatchObject({ text: "รับแล้ว กำลังสร้างคลิป ใช้เวลาประมาณ 3–5 นาที\nเสร็จแล้วจะส่งวิดีโอมาในแชทนี้" });
    const held = startedReply(false);
    expect(held.type === "text" && held.text).toContain("ระบบจะไม่ส่งคลิปมาเอง");
    expect(held.quickReply?.items[0].action.text).toBe("ขอคลิป");
    expect(stillMaking("อีกประมาณ 2 นาที")).toMatchObject({ text: "คลิปยังสร้างอยู่ อีกประมาณ 2 นาที\nแล้วกด \"ขอคลิป\" อีกครั้งนะครับ" });
  });
  it("more clips owed: one more message with the button, inside LINE's five", () => {
    const three = [{ type: "text" as const, text: "a" }, { type: "text" as const, text: "b" }, { type: "text" as const, text: "c" }];
    expect(fetchAgain(three, 0)).toHaveLength(3);
    const more = fetchAgain(three, 2);
    expect(more).toHaveLength(4);
    expect(more[3]).toMatchObject({ text: expect.stringContaining("ยังมีอีก 2 คลิป") });
  });
});
