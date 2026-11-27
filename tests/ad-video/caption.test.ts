import { describe, expect, it } from "vitest";
import { quoteVideoFacts } from "@/lib/quote-video/script";
import { adBasis, adCaption } from "@/lib/ad-video/caption";
import type { AdPlan } from "@/lib/ad-video/keys";
import { DISCLAIMER } from "@/lib/content/output";

const plan: AdPlan = {
  mode: "pick",
  hook: { kind: "question", voice: "รู้ไหมว่าวันละไม่กี่บาทก็คุ้มครองได้คะ", headline: ["รู้ไหม"] },
  body: [{ key: "price", voice: "เริ่มวันละ 30 บาทค่ะ" }, { key: "cover", voice: "คุ้มครอง 1,000,000 บาทค่ะ" }],
  cta: { key: "chat", voice: "ทักแชทขอใบเสนอได้เลยนะคะ" },
  photos: {},
  art: "mixed",
  written: true,
};

describe("adCaption (the words posted with an ad clip)", () => {
  it("is the hook, each body with a tick, the closing, a blank line and the disclaimer", () => {
    expect(adCaption(plan)).toBe([
      "รู้ไหมว่าวันละไม่กี่บาทก็คุ้มครองได้คะ",
      "✓ เริ่มวันละ 30 บาทค่ะ",
      "✓ คุ้มครอง 1,000,000 บาทค่ะ",
      "ทักแชทขอใบเสนอได้เลยนะคะ",
      "",
      DISCLAIMER,
    ].join("\n"));
  });
  it("ends with the disclaimer even with one body", () => {
    expect(adCaption({ ...plan, body: [plan.body[0]] }).endsWith(`\n\n${DISCLAIMER}`)).toBe(true);
  });
});

describe("adBasis (what the AI writes a post from)", () => {
  it("adds the clip's lines to the quote's facts and lets their figures through", () => {
    const f = quoteVideoFacts({ variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 }, new Date("2026-11-22T00:00:00+07:00"))!;
    const b = adBasis(f, plan);
    expect(b.about).toContain("คลิปโฆษณา");
    expect(b.facts).toContain("ในคลิปพูดว่า: เริ่มวันละ 30 บาทค่ะ");
    expect(b.kind).toBe("post");
    expect(b.allowed.has(1_000_000)).toBe(true);
  });
});
