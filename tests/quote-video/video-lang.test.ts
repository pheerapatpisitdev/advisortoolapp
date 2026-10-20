import { describe, expect, it } from "vitest";
import { quoteVideoFacts, quoteVideoScript, type VideoInput } from "@/lib/quote-video/script";
import { readVideoLang, VIDEO_LANGS, wordsOf } from "@/lib/quote-video/video-words";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";

const TODAY = new Date("2026-10-15T12:00:00+07:00");
const base = { product: "IHEALTHY" as const, age: 35, sex: "F" as const, plan: "SILVER", compare: ["GOLD"] };
const factsIn = (lang: string, more: Partial<VideoInput> = {}) => quoteVideoFacts({ ...base, lang, ...more } as VideoInput, TODAY)!;

describe("iHealthy clip in the page's five languages (owner, 2026-10-15)", () => {
  it("leaves the Thai clip exactly as it was", () => {
    const th = factsIn("th");
    const none = quoteVideoFacts(base, TODAY)!;
    expect(th).toEqual(none);
    expect(th.lang).toBeUndefined();
    expect(quoteVideoScript(th)[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนประกันสุขภาพนี้ให้ฟังสั้นๆ นะคะ คุณผู้หญิงอายุ 35 แผน Silver เหมาจ่ายค่ารักษาสูงสุดถึง 15 ล้านบาทต่อปีค่ะ");
  });

  it("shows the same figures in every language, in that language's words", () => {
    const th = factsIn("th");
    for (const lang of VIDEO_LANGS.filter((l) => l !== "th")) {
      const f = factsIn(lang);
      expect(f.lang).toBe(lang);
      expect(f.prices.map((p) => p.amount)).toEqual(th.prices.map((p) => p.amount));
      expect(f.lead.baht).toBe(th.lead.baht);
      expect(f.compare?.map((p) => p.monthly)).toEqual(th.compare?.map((p) => p.monthly));
      // nothing Thai on screen
      const shown = [f.insuredWho, f.insuredLine, f.lead.label, f.leadMark, f.priceTitle, f.coverTitle, ...f.priceNotes, ...f.prices.map((p) => p.label), ...f.cover.flatMap((r) => [r.label, r.amount])];
      expect(shown.filter((s) => /[฀-๿]/.test(s))).toEqual([]);
    }
  });

  it("speaks every line in its language, with no Thai and no colon", () => {
    for (const lang of VIDEO_LANGS.filter((l) => l !== "th")) {
      const f = factsIn(lang);
      for (const length of ["full", "short"] as const) {
        const lines = quoteVideoScript(f, "Anna", "M", length);
        expect(lines.map((l) => l.key)).toEqual(length === "short" ? ["lead", "price", "contact"] : ["lead", "price", "cover", "compare", "contact"]);
        for (const l of lines) {
          expect(l.voice).not.toMatch(/[฀-๿:：]/);
          expect(l.voice).not.toMatch(/visa|worldwide|виз|签证/i);
        }
      }
    }
  });

  it("says the figures the card states", () => {
    const en = quoteVideoScript(factsIn("en"));
    expect(en[0].voice).toBe("Hello! Here's a quick look at this health plan. For a woman aged 35, the Silver plan pays medical bills up to 15 million baht a year.");
    expect(en[1].voice).toBe("In the first year it's 3,222 baht a month, with life cover of 50,000 baht and daily hospital cash already included.");
    expect(quoteVideoScript(factsIn("zh"))[0].voice).toContain("1500万泰铢");
    expect(quoteVideoScript(factsIn("ru"))[1].voice).toContain("3222 бата в месяц");
    expect(quoteVideoScript(factsIn("my"))[1].voice).toContain("ဘတ် ၃,၂၂၂");
  });

  it("greets a named customer by name alone, not คุณ", () => {
    expect(quoteVideoScript(factsIn("en"), "Anna")[0].voice).toMatch(/^Hello, Anna!/);
    expect(wordsOf(factsIn("en")).customer("Anna")).toBe("Anna");
  });

  it("reads a budget in the language's own instalment", () => {
    const f = factsIn("en", { compare: [], budget: { baht: 3300, per: "month" } });
    expect(f.budget).toEqual({ per: "month", amount: "3,222" });
    expect(quoteVideoScript(f)[0].voice).toContain("With a budget of 3,222 baht a month,");
  });

  it("reads anything unknown as Thai, and carries the page's language into the Studio form", () => {
    expect(readVideoLang("xx")).toBe("th");
    expect(readVideoLang(undefined)).toBe("th");
    const href = videoStartHref({ product: "IHEALTHY", sex: "F", age: 35, plan: "SILVER", lang: "ru" });
    const q = Object.fromEntries(new URL(href, "https://x").searchParams);
    expect(videoStartFrom(q)?.lang).toBe("ru");
    expect(videoStartFrom({ ...q, product: "LIFEPROTECT" })?.lang).toBeUndefined();
  });
});
