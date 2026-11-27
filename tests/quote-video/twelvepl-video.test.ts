import { describe, expect, it } from "vitest";
import { fallbackLines, lineProblem, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { productQas } from "@/lib/quote-video/qa";
import { pageCaption, quoteVideoFacts, quoteVideoScript, sceneMotion, type VideoInput } from "@/lib/quote-video/script";
import { extraOf, extraVoice } from "@/lib/quote-video/told";
import type { TwelvePlVideoInput } from "@/lib/quote-video/twelvepl";

/** the mockup's example (owner, 2026-11-26, ก ก ข): a woman of 35, a million, the dividend's example 2 */
const PAGE: TwelvePlVideoInput = { product: "TWELVEPL", age: 35, sex: "F", sumAssured: 1_000_000, dividend: 2 };
const RIDERS = {
  waiver: { code: "WP", option: "FIT" }, medical: 1000,
  illness: [{ code: "DCI", sumAssured: 1_000_000 }, { code: "CI123", sumAssured: 1_000_000 }, { code: "AP", sumAssured: 1_000_000 }],
};
/** the voice's words the other plans never say either */
const NEVER = /เบี้ย|เสียชีวิต|เวนคืน|ทันที/;
const LENGTHS = ["short", "full", "long", "max"] as const;

describe("12 พีแอล in วิดีโอนำเสนอ", () => {
  it("states the page's own figures", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(f.product).toBe("TWELVEPL");
    expect(f.twelvepl).toMatchObject({
      sum: 1_000_000, payYears: 12, coverToAge: 85, lastPayAge: 46, paid: 705_720, cashFirst: 2_500, cashFull: 10_000, cashFullYear: 17,
      lastCashYear: 49, cashBacks: 420_000, maturity: 1_160_000, guaranteed: 1_580_000, dividend: { example: 2, total: 355_770 }, total: 1_935_770, tax: 58_810,
    });
    expect(f.twelvepl!.cash).toHaveLength(48);
    expect(f.lead).toMatchObject({ amount: "1,580,000", baht: 1_580_000 });
    expect(f.lead.label).toContain("ถือครบถึงอายุ 85");
    expect(f.prices).toEqual([
      { label: "รายปี", amount: "58,810", main: true }, { label: "ราย 6 เดือน", amount: "30,581", main: false }, { label: "รายเดือน", amount: "5,292", main: false },
    ]);
    expect(f.perDayAmount).toBe("162");
    expect(f.coverStyle).toBe("cashback");
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "family", "total", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนออมนี้ให้ฟังสั้นๆ นะคะ คุณผู้หญิงอายุ 35 ปี ออมเพียง 12 ปี ถือครบถึงอายุ 85 รับเงินการันตีรวม 1,580,000 บาทค่ะ");
    expect(lines[1].voice).toBe("ออมแค่วันละ 162 บาท หรือปีละ 58,810 บาท เท่าเดิมทุกปี ออม 12 ปีก็ครบ แล้วยังนำไปลดหย่อนภาษีได้ด้วยค่ะ");
    expect(lines[2].voice).toBe("ตั้งแต่ปีที่ 2 มีเงินคืนทุกปี เริ่มที่ 2,500 บาท เพิ่มขึ้นจนได้ปีละ 10,000 บาท ตั้งแต่ปีที่ 17 พอครบอายุ 85 รับก้อนใหญ่อีก 1,160,000 บาท ส่วนนี้ได้แน่นอนค่ะ");
    expect(lines[3].voice).toBe("ระหว่างทางถ้าเป็นอะไรไป ครอบครัวได้ 1,000,000 บาท ออมปีสุดท้ายตอนอายุ 46 แต่คุ้มครองต่อไปถึงอายุ 85 เลยค่ะ");
    expect(lines[4].voice).toBe("สรุปแล้ว ออมรวม 705,720 บาท ถือครบถึงอายุ 85 รับการันตีรวม 1,580,000 บาท ถ้ามีปันผลตามตัวอย่างที่ 2 รวมรับประมาณ 1,935,770 บาท ส่วนปันผลไม่การันตีนะคะ");
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M")[4].voice).toContain("นะครับ");
    expect(sceneMotion(quoteVideoFacts(PAGE)!, "total")).toMatchObject({ spread: true });
  });

  it("says no dividend figure when none is picked, and never one as certain", () => {
    const none = quoteVideoFacts({ ...PAGE, dividend: 0 as const })!;
    expect(none.twelvepl!.dividend).toBeUndefined();
    for (const length of LENGTHS) for (const l of quoteVideoScript(none, "", "F", length)) expect(l.voice).not.toMatch(/ปันผล/);
    for (const dividend of [2, 3] as const) {
      const f = quoteVideoFacts({ ...PAGE, dividend })!;
      const said = quoteVideoScript(f, "").find((l) => l.key === "total")!.voice;
      expect(said).toContain("ประมาณ");
      expect(said).toContain("ไม่การันตี");
      expect(said).toContain(`ตัวอย่างที่ ${dividend}`);
    }
  });

  it("tells the riders a scene each after the plan's own story, priced by the year", () => {
    const f = quoteVideoFacts({ ...PAGE, riders: RIDERS })!;
    expect(f.prices.map((p) => p.amount)).toEqual(["70,813", "36,822", "6,373"]);
    expect(f.perDayAmount).toBe("195");
    expect(f.twelvepl!.paid).toBe(705_720);
    expect(f.riders!.scenes.map((r) => r.price)).toEqual(["59", "1,300", "3,210", "4,434", "3,000"]);
    expect(f.riders!.scenes[0]).toMatchObject({ kind: "waiver", paid: 7, left: 5 });
    expect(f.riders!.payout.find((r) => r.tone === "accident")!.amount).toBe("3,000,000");
    const lines = quoteVideoScript(f, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "family", "total", "riders", "rider1", "rider2", "rider3", "rider4", "rider5", "payout", "contact"]);
    expect(lines[1].voice).toBe("ออมแค่วันละ 195 บาท หรือปีละ 70,813 บาท รวมสัญญาหลักกับสัญญาเพิ่มเติมอีก 5 ตัวไว้แล้ว สัญญาหลักออมเพียง 12 ปีก็ครบ ลดหย่อนภาษีได้ด้วย ส่วนสัญญาเพิ่มเติมปรับตามอายุค่ะ");
    expect(lines[4].voice).toMatch(/^เฉพาะสัญญาหลัก ออมรวม 705,720 บาท/);
    expect(lines[8].voice).toContain("ปีละ 3,210 บาท");
  });

  it("keeps the tax relief to ages 20 and over", () => {
    const child = quoteVideoFacts({ ...PAGE, age: 10 })!;
    expect(child.twelvepl!.tax).toBeUndefined();
    for (const l of quoteVideoScript(child, "", "F", "max")) expect(l.voice).not.toMatch(/ภาษี/);
    expect(child.pills.join()).not.toMatch(/ภาษี/);
    expect(quoteVideoFacts({ ...PAGE, age: 20 })!.twelvepl!.tax).toBeGreaterThan(0);
  });

  it("prices every age it is sold at, in every length, without a word the voice never says", () => {
    for (const sex of ["M", "F"] as const) for (let age = 0; age <= 60; age++) {
      const f = quoteVideoFacts({ ...PAGE, sex, age });
      expect(f, `${sex}${age}`).toBeDefined();
      expect(f!.twelvepl!.guaranteed).toBeGreaterThan(f!.twelvepl!.paid);
      for (const length of LENGTHS) for (const l of quoteVideoScript(f!, "", "F", length)) expect(l.voice).not.toMatch(NEVER);
    }
    expect(quoteVideoFacts({ ...PAGE, age: 61 })).toBeUndefined();
  });

  it("tells the short clip in three scenes, and the long ones with the extra scenes", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(quoteVideoScript(f, "", "F", "short").map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "family", "total", "versus", "qa", "steps", "contact"]);
    expect(extraOf(f, {}).versus.right.amount).toBe("1,580,000");
    expect(extraVoice("versus", f, {})).toContain("ถือครบถึงอายุ 85");
    expect(pageCaption(f)).toContain("12 พีแอล");
    expect(pageCaption(f)).toContain("ถือครบถึงอายุ 85");
  });

  it("has fixed lines that pass its own checks, for every story and hook", () => {
    const f = quoteVideoFacts(PAGE)!;
    const stories = storiesFor(f);
    expect(stories.length).toBeGreaterThanOrEqual(3);
    for (const s of stories) for (const hook of WRITTEN_HOOKS) {
      const w = fallbackLines(f, { hook, story: s.key });
      expect(writtenProblems(w, f, { loop: false, story: true }), `${s.key} ${hook}`).toEqual({});
    }
    expect(lineProblem("ออมแล้วได้ปันผลแน่นอนค่ะ", f, 150)).not.toBeNull();
    expect(storiesFor(quoteVideoFacts({ ...PAGE, age: 10 })!).some((s) => /ภาษี/.test(s.name))).toBe(false);
    for (const q of productQas("TWELVEPL")) expect(q.a).not.toMatch(NEVER);
  });

  it("checks what the form sent", () => {
    expect(checked({ ...PAGE })).toMatchObject({ product: "TWELVEPL", sumAssured: 1_000_000, dividend: 2 });
    expect(checked({ ...PAGE, riders: RIDERS } as VideoInput)).toMatchObject({ riders: RIDERS });
    expect(checked({ ...PAGE, age: 61 })).toMatch(/0–60/);
    expect(checked({ ...PAGE, sumAssured: 99_999 })).toMatch(/100,000/);
    expect(checked({ ...PAGE, dividend: 1 as unknown as 2 })).toMatchObject({ dividend: 2 });
    // a waiver is not sold to a child
    expect(typeof checked({ ...PAGE, age: 10, riders: RIDERS } as VideoInput)).toBe("string");
  });

  it("works the sum out from a budget, riders and all", () => {
    const year = resolveBudget(PAGE, { baht: 60_000, per: "year" }) as TwelvePlVideoInput;
    expect(year.sumAssured).toBe(1_000_000);
    expect(resolveBudget(PAGE, { baht: 6_000, per: "year" })).toMatchObject({ sumAssured: 100_000 });
    const month = resolveBudget(PAGE, { baht: 5_500, per: "month" }) as TwelvePlVideoInput;
    expect(quoteVideoFacts({ ...month, budget: { baht: 5_500, per: "month" } })!.budget).toMatchObject({ per: "month" });
    const both = resolveBudget({ ...PAGE, riders: { medical: 1000 } }, { baht: 60_000, per: "year" }) as TwelvePlVideoInput;
    expect(both.sumAssured).toBeLessThanOrEqual(1_000_000);
    expect(typeof resolveBudget(PAGE, { baht: 1_000, per: "year" })).toBe("string");
  });

  it("opens from the page with its arrangement", () => {
    const href = videoStartHref({ product: "TWELVEPL", sex: "F", age: 35, sumAssured: 1_000_000, dividend: 3, riders: RIDERS });
    const back = videoStartFrom(Object.fromEntries(new URL(`https://x${href}`).searchParams));
    expect(back).toMatchObject({ product: "TWELVEPL", sex: "F", age: 35, sumAssured: 1_000_000, dividend: 3, riders: RIDERS });
    expect(videoStartFrom({ product: "TWELVEPL", div: "7" })!.dividend).toBeUndefined();
  });

  it("follows an agent's hidden instalments, riders still priced by the year", () => {
    const f = quoteVideoFacts({ ...PAGE, riders: RIDERS, hide: ["monthly", "semi"] })!;
    expect(f.prices.map((p) => p.label)).toEqual(["รายปี"]);
    expect(f.riders!.scenes[1].price).toBe("1,300");
  });
});
