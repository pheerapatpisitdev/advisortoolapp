import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceeded } from "@/lib/ai/client";
import { AD_LIMITS, variantAdMessages } from "@/lib/content/ads";
import type { Variant } from "@/lib/ads/dimensions";

/**
 * An ad written to one combination of the campaign's four dimensions (Ads Studio, 2026-10-04):
 * the hook it opens with, the people it talks to, the reason it gives, and the picture's style.
 */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));

const { writeAdVariants } = await import("@/lib/content/write");

const v1: Variant = { hook: "ถ้าพรุ่งนี้ไม่มีเรา", persona: "พ่อแม่มือใหม่", angle: "ครอบครัวไปต่อได้", style: "ภาพถ่ายครอบครัว", combo: "ถ้าพรุ่งนี้ไม่มีเรา|พ่อแม่มือใหม่|ครอบครัวไปต่อได้|ภาพถ่ายครอบครัว" };
const v2: Variant = { hook: "วันละไม่กี่บาท", persona: "คนทำงานอายุ 30", angle: "เริ่มต้นไม่แพง", style: "ตัวเลขเด่น", combo: "วันละไม่กี่บาท|คนทำงานอายุ 30|เริ่มต้นไม่แพง|ตัวเลขเด่น" };

const reply = (headline: string) => ({
  text: JSON.stringify({ primaryText: "ข้อความหลัก ทักแชทได้เลย", headline, description: "ทักแชทได้เลย", imagePrompt: "a Thai family, no text" }),
  model: "m", costThb: 1.5, outputTokens: 100,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("variantAdMessages", () => {
  it("has the same rules as any ad, and names the hook, the people, the angle, the style, the focus and the voice", () => {
    const [system, user] = variantAdMessages("ข้อมูลแบบประกัน", v1, { focus: "เน้นครอบครัว", voice: "อบอุ่น" });
    expect(system.content).toContain("ห้ามคำนวณ");
    expect(system.content).toContain("กฎโฆษณาของ Facebook");
    expect(system.content).toContain(`${AD_LIMITS.fold} ตัวอักษรแรก`);
    for (const s of ["ข้อมูลแบบประกัน", v1.hook, v1.persona, v1.angle, v1.style, "เน้นครอบครัว", "อบอุ่น"]) expect(user.content).toContain(s);
    expect(user.content).toContain("imagePrompt");
  });

  it("leaves out the focus and the voice when there are none", () => {
    const [, user] = variantAdMessages("brief", v1, { focus: "", voice: "" });
    expect(user.content).not.toContain("สิ่งที่อยากเน้น");
    expect(user.content).not.toContain("น้ำเสียงแบรนด์");
  });
});

describe("writeAdVariants", () => {
  it("writes each combination in its own call and marks the piece with it", async () => {
    ai.chat.mockImplementation(async ({ messages }: { messages: { content: string }[] }) =>
      reply(messages[1].content.includes(v1.hook) ? "หัวหนึ่ง" : "หัวสอง"));
    const round = await writeAdVariants({ brief: "brief", variants: [v1, v2], focus: "", voice: "" });
    expect(ai.chat).toHaveBeenCalledTimes(2);
    expect(round.budgetHit).toBe(0);
    expect(round.pieces).toHaveLength(2);
    const [a, b] = round.pieces;
    expect(a.output.hooks).toEqual(["หัวหนึ่ง"]);
    expect(a.output.angle).toBe(`${v1.angle} · ${v1.persona}`);
    expect(a.output.ad).toEqual({ angle: v1.angle, tone: v1.persona, hook: v1.hook, persona: v1.persona, style: v1.style, combo: v1.combo });
    expect(b.output.ad?.combo).toBe(v2.combo);
    expect(a.costThb).toBe(1.5);
  });

  it("keeps the ones written when the budget stops the rest, and counts the stopped", async () => {
    ai.chat.mockResolvedValueOnce(reply("หัวหนึ่ง")).mockRejectedValueOnce(new BudgetExceeded());
    const round = await writeAdVariants({ brief: "brief", variants: [v1, v2], focus: "", voice: "" });
    expect(round.pieces).toHaveLength(1);
    expect(round.budgetHit).toBe(1);
  });

  it("throws the budget refusal when nothing was written", async () => {
    ai.chat.mockRejectedValue(new BudgetExceeded());
    await expect(writeAdVariants({ brief: "brief", variants: [v1], focus: "", voice: "" })).rejects.toBeInstanceOf(BudgetExceeded);
  });
});
