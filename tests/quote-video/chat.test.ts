import { describe, expect, it } from "vitest";
import { chatMessages, chatQuestion, chatRows } from "@/lib/quote-video/chat";
import { quoteVideoFacts } from "@/lib/quote-video/script";
import { quotePartsFor } from "@/lib/quote-video/make";

const lp = { product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000, style: "chat" as const };
const facts = quoteVideoFacts(lp)!;

describe("แชทถาม-ตอบ (owner, 2026-10-20)", () => {
  it("asks the same question for each part, as the insured speaks", () => {
    expect(chatQuestion("price", facts, "M")).toBe("ต้องจ่ายเท่าไหร่ครับ");
    expect(chatQuestion("price", facts, "F")).toBe("ต้องจ่ายเท่าไหร่คะ");
    expect(chatQuestion("lead", facts, "M")).toMatch(/^สวัสดีครับ สนใจ Life Protect/);
    expect(chatQuestion("contact", facts, "F")).toBe("สนใจค่ะ ขอรายละเอียดเพิ่มหน่อยค่ะ");
  });

  it("answers each question with the scene's line, and sends the price, cover, table and contact cards", () => {
    const scenes = ["lead", "price", "cover", "value", "contact"].map((key, i) => ({ key, voice: `บท ${key}`, voiceSec: 8, start: i * 10 }));
    const msgs = chatMessages({ facts, sex: "M", contact: { name: "คุณสมชาย", phone: "081", line: "@x" }, scenes }, 1);
    expect(msgs.filter((m) => m.who === "them")).toHaveLength(5);
    expect(msgs.filter((m) => m.key.startsWith("c")).map((m) => m.key)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
    // the answer after the question, the card after the answer
    const [q, a, c] = msgs.slice(0, 3);
    expect(q.at).toBeLessThan(a.at);
    expect(a.at).toBeLessThan(c.at);
  });

  it("keeps the table's first, last and break-even rows", () => {
    const rows = Array.from({ length: 40 }, (_, i) => i);
    const kept = chatRows(rows, 6, 29);
    expect(kept).toHaveLength(6);
    expect(kept).toContain(0);
    expect(kept).toContain(39);
    expect(kept).toContain(29);
  });

  it("is drawn the Motion way, with the chat for its drawing and no price jar", () => {
    const parts = quotePartsFor({ input: lp, customer_name: "" }, { name: "ก", phone: "081" }, [10, 10, 10, 10, 10]);
    expect(parts.motion$?.theme).toBe("chat");
    expect(parts.motion$?.shown.priceJar).toBeUndefined();
  });
});
