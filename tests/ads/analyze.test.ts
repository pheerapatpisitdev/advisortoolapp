import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The AI's proposal of a campaign's dimensions (Ads Studio, 2026-10-04): a good reply becomes
 * clean dimensions, anything else — an unreadable reply, a missing dimension, a thrown error —
 * becomes the starting set, marked as such, and never throws.
 */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ chat: ai.chat }));

import { analyzeDimensions, dimensionMessages } from "@/lib/ads/analyze";
import { FALLBACK_DIMENSIONS, cleanDimensions } from "@/lib/ads/dimensions";

const items = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ text: `${prefix} ${i + 1}`, note: `โน้ต ${prefix} ${i + 1}` }));
const good = { hooks: items("ฮุก", 9), personas: items("คน", 4), angles: items("มุม", 3), styles: items("สไตล์", 3) };
const opts = { brief: "แบบประกัน X เบี้ยเริ่มต้น 1,200 บาท/เดือน", productName: "แบบประกัน X", focus: "เน้นครอบครัว", voice: "อบอุ่น เป็นกันเอง" };

// braces: a hook that returns a function has it run as clean-up, and a mock's reset returns the mock
beforeEach(() => { ai.chat.mockReset(); });

describe("dimensionMessages", () => {
  const text = JSON.stringify(dimensionMessages("BRIEF-TEXT", "FOCUS-TEXT", "VOICE-TEXT"));

  it("carries the brief, the focus and the voice", () => {
    expect(text).toContain("BRIEF-TEXT");
    expect(text).toContain("FOCUS-TEXT");
    expect(text).toContain("VOICE-TEXT");
  });

  it("asks for the four dimensions in the counts the studio keeps", () => {
    for (const key of ["hooks", "personas", "angles", "styles"]) expect(text).toContain(key);
    expect(text).toContain("8–12");
    expect(text).toContain("3–5");
  });

  it("forbids numbers outside the brief and lettering in picture styles", () => {
    expect(text).toContain("ตัวเลข");
    expect(text).toContain("ห้ามมีตัวหนังสือ");
    expect(text).toContain("พื้นหลังโปสเตอร์");
  });

  it("leaves focus and voice out when empty", () => {
    const m = JSON.stringify(dimensionMessages("B", "", ""));
    expect(m).not.toContain("สิ่งที่อยากเน้น");
    expect(m).not.toContain("น้ำเสียงแบรนด์");
  });
});

describe("analyzeDimensions", () => {
  it("returns the model's dimensions, cleaned, with its cost", async () => {
    ai.chat.mockResolvedValue({ text: JSON.stringify(good), model: "m", costThb: 0.4, outputTokens: 10 });
    const r = await analyzeDimensions(opts);
    expect(r.fallback).toBe(false);
    expect(r.costThb).toBe(0.4);
    expect(r.dimensions).toEqual(cleanDimensions(good));
    const call = ai.chat.mock.calls[0][0];
    expect(call).toMatchObject({ tier: "small", task: "content-plan", json: true });
    expect(JSON.stringify(call.messages)).toContain(opts.brief);
  });

  it("reads a reply wrapped in a code fence", async () => {
    ai.chat.mockResolvedValue({ text: "```json\n" + JSON.stringify(good) + "\n```", model: "m", costThb: 0.1, outputTokens: 10 });
    expect((await analyzeDimensions(opts)).fallback).toBe(false);
  });

  it("falls back, keeping the cost spent, when the reply cannot be read", async () => {
    ai.chat.mockResolvedValue({ text: "ขออภัย ตอบไม่ได้", model: "m", costThb: 0.3, outputTokens: 5 });
    const r = await analyzeDimensions(opts);
    expect(r).toEqual({ dimensions: FALLBACK_DIMENSIONS(opts.productName), costThb: 0.3, fallback: true });
  });

  it("falls back when a dimension comes back empty", async () => {
    ai.chat.mockResolvedValue({ text: JSON.stringify({ ...good, styles: [] }), model: "m", costThb: 0.2, outputTokens: 5 });
    const r = await analyzeDimensions(opts);
    expect(r.fallback).toBe(true);
    expect(r.dimensions).toEqual(FALLBACK_DIMENSIONS(opts.productName));
  });

  it("falls back at no cost when the call throws", async () => {
    ai.chat.mockRejectedValue(new Error("provider down"));
    const r = await analyzeDimensions(opts);
    expect(r).toEqual({ dimensions: FALLBACK_DIMENSIONS(opts.productName), costThb: 0, fallback: true });
  });
});
