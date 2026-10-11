import { describe, expect, it, vi } from "vitest";

/**
 * "มีงบออมเงิน 30 บาทต่อวัน" on LuckyPlanner, a Page that sells Life Protect alone, was quoted
 * iShield: a bare ออม named that plan and outranked the Page (2026-10-11). ออม now names iShield
 * only beside โรคร้าย (owner), so the Page's plan answers. The Life Protect brain reads with a
 * model, so it is stood in for here; only which brain is asked is under test.
 */
vi.mock("@/lib/assistant/lifeprotect/answer", async (orig) => ({
  ...(await orig<typeof import("@/lib/assistant/lifeprotect/answer")>()),
  answerQuestion: async () => ({ messages: [{ text: "LIFE PROTECT" }], slots: { intent: "quote" } }),
}));

const { answerAny } = await import("@/lib/assistant/dispatch");
const LUCKY = "105982528649026";
const welcome = { mode: "one_plan", product: "lifeprotect", text: "สวัสดีครับ", pictures: [] } as never;
const ask = (said: string, cameFor?: "ishield") =>
  answerAny([{ role: "user", content: said }], null, "facebook", cameFor, LUCKY, welcome);

describe("a savings budget on a Page that sells Life Protect alone", () => {
  it("is answered by Life Protect, not iShield", async () => {
    for (const said of ["มีงบออมเงิน 30 บาทต่อวัน", "อยากออมเดือนละ 2,000 บาท"]) {
      const a = await ask(said);
      expect(a.messages.map((m) => m.text).join("\n"), said).toContain("LIFE PROTECT");
    }
  });

  it("still goes to iShield when the customer names it, or came from its advert", async () => {
    for (const a of [await ask("ออม+ประกันโรคร้าย เดือนละ 2,000"), await ask("iShield เดือนละ 2,000"), await ask("มีงบออมเงิน 30 บาทต่อวัน", "ishield")]) {
      expect(a.messages.map((m) => m.text).join("\n")).not.toContain("LIFE PROTECT");
      expect(a.slots).toMatchObject({ product: "ishield" });
    }
  });
});
