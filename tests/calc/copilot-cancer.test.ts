import { describe, expect, it, vi } from "vitest";

// the knowledge reads the agent's own notes from the database; there is none in a test
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => { throw new Error("no database in tests"); },
}));

const { asksCancerPrice, cancerNamedIn, priceCancer } = await import("@/lib/copilot/cancer-price");
const { answerAny } = await import("@/lib/assistant/dispatch");
const { assembleKnowledge } = await import("@/lib/copilot/knowledge");
const { getBundle } = await import("@/calc/bundles/registry");
const { bundleAgeRange, bundleModePremiums, quoteBundle } = await import("@/calc/bundles/quote");
const { formatBaht } = await import("@/calc/money");
const { cancerMessage } = await import("@/lib/cancer-cta");

const TODAY = new Date("2026-09-23");
const BUNDLE = getBundle("CANCER_SET")!;

/** What /cancer charges the same person, so the chat cannot drift from the page. */
function onThePage(tier: number, age: number, sex: "M" | "F"): string {
  return formatBaht(quoteBundle(BUNDLE, tier, { age, sex, mode: "annual" }, TODAY)!.totalAnnual);
}

describe("ประกันมะเร็ง in the chat", () => {
  it("reads the owner's words as the /cancer set, and nothing that merely mentions a cancer", () => {
    for (const t of ["ประกันมะเร็ง", "แพ็กเกจมะเร็ง", "แพคเกจ มะเร็ง", "แพ็คเกจโรคมะเร็ง", "ประกันโรคมะเร็ง", "ชุดมะเร็ง", "cancer"]) {
      expect(cancerNamedIn(t), t).toBe(true);
    }
    for (const t of ["มะเร็งรอคอย 120 วันไหม", "มะเร็งปากมดลูกเคลมได้ไหม", "CI123 ครอบคลุมมะเร็งไหม"]) {
      expect(cancerNamedIn(t), t).toBe(false);
    }
  });

  it("prices a package at the figure the page shows", () => {
    const reply = priceCancer("ประกันมะเร็ง หญิง 35 ทุน 1 ล้าน", TODAY);
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain(`**${onThePage(4, 35, "F")} บาท/ปี**`);
    expect(reply.text).toContain("ชดเชยวันละ 4,000");
    // the whole sum at the invasive stage, and the first stage's cap
    expect(reply.text).toContain("ขั้น 4 มะเร็งระยะลุกลาม 1,000,000 บาท");
    expect(reply.text).toContain("ขั้น 1 มะเร็งระยะไม่ลุกลามขั้นต้น 50,000 บาท");
    expect(reply.cards?.[0]).toContain("bundle=CANCER_SET");
    for (const b of reply.guide ?? []) expect(priceCancer(b.ask, TODAY).priced, b.ask).toBe(true);
  });

  it("prices the message the /cancer page sends, as the page priced it", () => {
    const range = bundleAgeRange(BUNDLE);
    const premium = bundleModePremiums(BUNDLE, 5, { age: 42, sex: "M" }, TODAY)!.find((m) => m.mode === "annual");
    const sent = cancerMessage({ cpr: 2_000_000, hic: 5_000, age: 42, sex: "M", range, premium });
    const reply = priceCancer(sent, TODAY);
    expect(reply.priced, sent).toBe(true);
    expect(reply.text).toContain(`**${onThePage(5, 42, "M")} บาท/ปี**`);
  });

  it("finds the package from the daily amount alone", () => {
    const reply = priceCancer("แพ็กเกจมะเร็ง ชาย 40 ชดเชยวันละ 8,000 เบี้ยเท่าไหร่", TODAY);
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ทุน 4,000,000 บาท");
  });

  it("offers the nearest packages for a sum that is not one of the eight", () => {
    const reply = priceCancer("ประกันมะเร็ง ชาย 35 ทุน 1.5 ล้าน", TODAY);
    expect(reply.priced).toBe(false);
    expect(reply.guide?.length).toBe(3);
    for (const b of reply.guide ?? []) {
      const next = priceCancer(b.ask, TODAY);
      expect(next.priced, b.ask).toBe(true);
      expect(next.text, b.ask).toContain("ชาย อายุ 35 ปี");
    }
  });

  it("asks for what is missing, and invents nobody to price", () => {
    const nobody = priceCancer("ประกันมะเร็ง ทุน 1 ล้าน เบี้ยเท่าไหร่", TODAY);
    expect(nobody.priced).toBe(false);
    expect(nobody.text).toContain("อายุกับเพศ");
    expect(nobody.guide).toBeUndefined();

    const noSum = priceCancer("ประกันมะเร็ง ชาย 35 ราคาเท่าไหร่", TODAY);
    expect(noSum.priced).toBe(false);
    for (const b of noSum.guide ?? []) expect(priceCancer(b.ask, TODAY).priced, b.ask).toBe(true);
  });

  it("refuses an age the set does not take", () => {
    const { max } = bundleAgeRange(BUNDLE);
    const reply = priceCancer(`ประกันมะเร็ง ชาย ${max + 5} ทุน 1 ล้าน`, TODAY);
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain(String(max));
  });

  it("leaves a question about the cover's rules to the knowledge, which holds the set", async () => {
    expect(asksCancerPrice("ประกันมะเร็งคุ้มครองอะไรบ้าง")).toBe(false);
    const k = await assembleKnowledge("แพ็กเกจมะเร็งรอคอยกี่วัน");
    expect(k).toContain("## ประกันมะเร็ง / แพ็กเกจมะเร็ง (หน้า /cancer)");
    expect(k).toContain("ขั้น 1 มะเร็งระยะไม่ลุกลามขั้นต้น 120 วัน");
    // fetched by its name, like CI 123: a question about something else does not pay for it
    expect(await assembleKnowledge("iHealthy ค่าห้องเท่าไหร่")).not.toContain("(หน้า /cancer)");
  });

  it("is priced by the dispatcher even in the middle of a Life Protect conversation", async () => {
    const answer = await answerAny(
      [{ role: "user", content: "ประกันมะเร็ง ชาย 35 ทุน 1 ล้าน" }],
      { intent: "quote", product: "lifeprotect", age: 35, sex: "M" },
      "facebook",
    );
    expect(answer.priced).toBe(true);
    // the date is the real one here, so compare against today's page rather than TODAY's
    expect(answer.messages[0].text).toContain(
      formatBaht(quoteBundle(BUNDLE, 4, { age: 35, sex: "M", mode: "annual" })!.totalAnnual),
    );
    expect(answer.messages[0].text).not.toContain("**");
    // the calculator is for members only since 2026-10-20 (owner): the inbox gets no link to it
    expect(answer.messages[0].text).not.toMatch(/https?:\/\/\S+\/cancer/);
    expect(answer.messages[0].card).toContain("bundle=CANCER_SET");
  });
});
