import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  chat: vi.fn(),
}));

import { chat } from "@/lib/ai/client";
import { events, figures, scores, type FhcInput } from "@/lib/fhc/health";
import { lineText } from "@/lib/fhc/share";
import { explainHealth, fallbackSummary, parseSummary } from "@/lib/fhc/summary";
import { fixedSummary } from "@/lib/plan/order";
import type { PlanResult } from "@/lib/plan/recommend";

const F: FhcInput = {
  age: 35, sex: "M", income: 40_000, expense: 25_000, lifeCover: 0, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 0, hospital: "private", lifeWant: "cover", retireAge: 60, retireMonthly: 17_500,
  pensionHave: 0, budget: 4_000, expectancy: 85, work: "full",
  cash: 200_000, fixed: 0, otherSaving: 0, homeLoan: 0, carLoan: 0, otherDebt: 0, taxFund: 0, stocks: 0,
  people: [{ relation: "child", age: 5 }],
};
const PLAN = {
  budget: 4_000, usedAnnual: 1_200_000, taxSaved: 0, order: ["health", "life", "ci", "retire"], orderedBy: "ai", summary: "ก",
  areas: [
    { key: "health", unit: "room", have: 0, should: 1, status: "fits",
      offer: { product: "iHealthy Ultra แผนซิลเวอร์", href: "/x", sum: 1, cover: 1, annual: 1_200_000, firstYear: true } },
    { key: "life", unit: "sum", have: 0, should: 1, status: "short" },
    { key: "ci", unit: "sum", have: 0, should: 1, status: "short" },
    { key: "retire", unit: "pension", have: 0, should: 1, status: "short" },
  ],
} as PlanResult;
const FB = fallbackSummary(scores(F), "health");

describe("fallbackSummary", () => {
  it("names green scores as strengths and red ones as risks", () => {
    expect(FB.strengths).toContain("เงินสำรองฉุกเฉินอยู่ในเกณฑ์ดี"); // 8 months
    expect(FB.risks).toContain("ความคุ้มครองชีวิตยังต่ำกว่าเกณฑ์");
    expect(FB.start).toBe(fixedSummary("health"));
    expect(FB.strengths.length).toBeLessThanOrEqual(3);
  });
});

describe("parseSummary", () => {
  it("takes clean lists", () => {
    const s = parseSummary(JSON.stringify({ strengths: ["ออมเก่ง"], risks: ["ยังไม่มีประกันสุขภาพ"], start: "เริ่มที่สุขภาพ" }), FB);
    expect(s).toEqual({ strengths: ["ออมเก่ง"], risks: ["ยังไม่มีประกันสุขภาพ"], start: "เริ่มที่สุขภาพ" });
  });
  it("drops an item with a digit or too long, and keeps at most three", () => {
    const s = parseSummary(JSON.stringify({
      strengths: ["มีเงิน 8 เดือน", "ก".repeat(201), "ดี", "ดีมาก", "ดีที่สุด", "เยี่ยม"], risks: "not a list", start: "อายุ 35",
    }), FB);
    expect(s.strengths).toEqual(["ดี", "ดีมาก", "ดีที่สุด"]);
    expect(s.risks).toEqual(FB.risks);
    expect(s.start).toBe(FB.start);
  });
  it("falls back on junk", () => {
    expect(parseSummary("nope", FB)).toEqual(FB);
  });
});

describe("explainHealth", () => {
  it("asks the small model for the fhc-summary as JSON", async () => {
    vi.mocked(chat).mockResolvedValueOnce({ text: JSON.stringify({ strengths: ["ก"], risks: ["ข"], start: "ค" }) } as never);
    expect((await explainHealth(F, PLAN)).start).toBe("ค");
    expect(vi.mocked(chat).mock.calls.at(-1)![0]).toMatchObject({ tier: "small", task: "fhc-summary", json: true });
  });
  it("falls back when the model fails", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error("down"));
    expect(await explainHealth(F, PLAN)).toEqual(FB);
  });
});

describe("lineText", () => {
  it("carries every score, the events, the plan and the disclaimer", () => {
    const sc = scores(F);
    const text = lineText({ figures: figures(F), scores: sc, events: events(F, sc, PLAN), plan: PLAN, summary: FB });
    for (const s of sc) expect(text).toContain(s.label);
    expect(text).toContain("การตกงาน");
    expect(text).toContain("iHealthy Ultra แผนซิลเวอร์");
    expect(text).toContain("ไม่ใช่ข้อเสนอขาย");
  });
});
