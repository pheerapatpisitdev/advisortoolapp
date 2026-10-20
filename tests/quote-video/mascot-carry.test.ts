import { describe, expect, it } from "vitest";
import { mascotPose } from "@/lib/quote-video/mascot";
import { carryFigure } from "@/lib/quote-video/carry";
import { quoteVideoFacts } from "@/lib/quote-video/script";
import { quotePartsFor } from "@/lib/quote-video/make";

const lp = { product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000, style: "motion" as const };
const facts = quoteVideoFacts(lp)!;
const contact = { name: "ก", phone: "081" };

describe("น้องโล่ (owner, 2026-10-20)", () => {
  it("is surprised as the opening's sum pops in, waves at the close, points otherwise", () => {
    expect(mascotPose("lead", 0.5)).toBe("point");
    expect(mascotPose("lead", 1.5)).toBe("wow");
    expect(mascotPose("contact", 1)).toBe("wave");
    expect(mascotPose("fhcContact", 1)).toBe("wave");
    expect(mascotPose("price", 3)).toBe("point");
  });
});

describe("the figure carried over a join (owner, 2026-10-20)", () => {
  it("is the next scene's own figure, none where it has no one figure", () => {
    expect(carryFigure("price", facts)).toBe("79 บาท/วัน");
    expect(carryFigure("cover", facts)).toBe("คุ้มครองถึง 99");
    expect(carryFigure("value", facts)).toMatch(/^คืน /);
    expect(carryFigure("contact", facts)).toBeNull();
  });

  it("goes to the job only for a Motion clip that asked, never for แชทถาม-ตอบ", () => {
    const secs = [10, 10, 10, 10, 10];
    const on = quotePartsFor({ input: { ...lp, mascot: true, carry: true }, customer_name: "" }, contact, secs).motion$!;
    expect([on.mascot, on.carry]).toEqual([true, true]);
    const chat = quotePartsFor({ input: { ...lp, style: "chat", mascot: true, carry: true }, customer_name: "" }, contact, secs).motion$!;
    expect([chat.mascot, chat.carry]).toEqual([undefined, undefined]);
    const off = quotePartsFor({ input: lp, customer_name: "" }, contact, secs).motion$!;
    expect([off.mascot, off.carry]).toEqual([undefined, undefined]);
  });
});
