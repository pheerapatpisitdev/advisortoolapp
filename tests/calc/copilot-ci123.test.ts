import { describe, expect, it } from "vitest";
import { asksCi123Price, ci123NamedIn, priceCi123 } from "@/lib/copilot/ci123-price";
import { answerAny } from "@/lib/assistant/dispatch";
import { getBundle } from "@/calc/bundles/registry";
import { quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";

const TODAY = new Date("2026-09-23");

/** What /ci123 charges the same person, so the chat cannot drift from the page. */
function onThePage(tier: number, age: number, sex: "M" | "F"): string {
  return formatBaht(quoteBundle(getBundle("CI123_SET")!, tier, { age, sex, mode: "annual" }, TODAY)!.totalAnnual);
}

describe("CI 123 in the chat", () => {
  it("knows the name however it is written", () => {
    for (const t of ["CI123 ชาย 35", "ci 123", "CI-123 ราคา", "ซีไอ 123 เท่าไหร่"]) expect(ci123NamedIn(t), t).toBe(true);
    expect(ci123NamedIn("DCI ทุน 1 ล้าน")).toBe(false);
  });

  it("prices the set the page sells, with the card for that sum", () => {
    const reply = priceCi123("CI123 หญิง 30 ทุน 1 ล้าน", TODAY);
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain(`**${onThePage(2, 30, "F")} บาท/ปี**`);
    expect(reply.text).toContain("หญิง อายุ 30 ปี");
    expect(reply.text).toContain("โรคร้ายแรงระยะก่อนเริ่มต้น 100,000 บาท");
    expect(reply.text).toContain("Life Protect x 2");
    expect(reply.cards?.[0]).toContain("bundle=CI123_SET");
    expect(reply.cards?.[0]).toContain("tier=2");
  });

  it("does not read the 123 in the name as an age or a sum", () => {
    const reply = priceCi123("ci 123 ชาย 45 5 แสน", TODAY);
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ชาย อายุ 45 ปี");
    expect(reply.text).toContain(`**${onThePage(1, 45, "M")} บาท/ปี**`);
  });

  it("prices a sum the page does not list, in words without a card", () => {
    const reply = priceCi123("CI123 ชาย 40 ทุน 1.5 ล้าน", TODAY);
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ทุน 1,500,000 บาท");
    expect(reply.cards).toBeUndefined();
  });

  it("asks for what is missing, and offers sums only once the person is known", () => {
    const noSum = priceCi123("CI123 ชาย 35 ราคาเท่าไหร่", TODAY);
    expect(noSum.priced).toBe(false);
    expect(noSum.text).toContain("ทุน CI 123");
    expect(noSum.guide?.map((g) => g.ask)).toContain("CI 123 ชาย 35 ทุน 1 ล้าน");

    const nobody = priceCi123("CI123 ทุน 1 ล้าน เบี้ยเท่าไหร่", TODAY);
    expect(nobody.priced).toBe(false);
    expect(nobody.text).toContain("อายุกับเพศ");
    expect(nobody.guide).toBeUndefined();
  });

  it("refuses an age the rider does not take, and says why", () => {
    const reply = priceCi123("CI123 ชาย 78 ทุน 1 ล้าน", TODAY);
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("75");
  });

  it("leaves a question about the rider's rules to the knowledge", () => {
    expect(asksCi123Price("CI123 คุ้มครองโรคอะไรบ้าง")).toBe(false);
    expect(asksCi123Price("CI123 ชาย 35 ทุน 1 ล้าน")).toBe(true);
  });

  it("is priced by the dispatcher even in the middle of a Life Protect conversation", async () => {
    const answer = await answerAny(
      [{ role: "user", content: "CI123 ชาย 35 ทุน 1 ล้าน" }],
      { intent: "quote", product: "lifeprotect", age: 35, sex: "M" },
      "facebook",
    );
    expect(answer.priced).toBe(true);
    expect(answer.messages[0].text).toContain(onThePage(2, 35, "M"));
    // Messenger shows plain text: no markdown, and the page as a whole address
    expect(answer.messages[0].text).not.toContain("**");
    // the calculator is for members only since 2026-10-20 (owner): the inbox gets no link to it
    expect(answer.messages[0].text).not.toMatch(/https?:\/\/\S+\/ci123/);
    expect(answer.messages[0].card).toContain("bundle=CI123_SET");
    // the Life Protect conversation it interrupted is carried through untouched
    expect(answer.slots).toMatchObject({ product: "lifeprotect", age: 35, sex: "M" });
  });
});
