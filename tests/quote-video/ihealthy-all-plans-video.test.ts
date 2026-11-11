import { describe, expect, it } from "vitest";
import { comparePremium } from "@/lib/ihealthy-compare-premiums";
import { allPlansFacts } from "@/lib/quote-video/ihealthy-all-plans";
import { motionSpec } from "@/lib/quote-video/motion";
import { carryFigure } from "@/lib/quote-video/carry";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { pageCaption, quoteVideoFacts, quoteVideoScript, type VideoInput } from "@/lib/quote-video/script";
import { VIDEO_LANGS } from "@/lib/quote-video/video-words";

/** วิดีโอเทียบ 4 แผน (owner chose ข, 2026-11-11): the iHealthy Ultra Package page as one clip */
const PAGE: VideoInput = { product: "IHEALTHY", sex: "F", age: 35, plan: "GOLD", compare: [], allPlans: "annual" };
/** iHealthy's voice: ค่าใช้จ่าย, never เบี้ย; a first year's price, never a day's */
const NEVER = /เบี้ย|เสียชีวิต|วันละ\s*\d+\s*บาทเท่านั้น|ตกวันละ/;

describe("วิดีโอเทียบ 4 แผน", () => {
  it("shows the compare page's own premiums, not the rate tables'", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(f.allPlans?.plans.map((p) => [p.name, p.premium, p.ceiling, p.room])).toEqual([
      ["Smart", 20_550, "3 ล้าน", "1,500"], ["Bronze", 23_950, "10 ล้าน", "3,000"],
      ["Silver", 35_850, "15 ล้าน", "5,500"], ["Gold", 45_850, "25 ล้าน", "9,000"],
    ]);
    for (const mode of ["annual", "semi", "monthly"] as const) {
      const a = quoteVideoFacts({ ...PAGE, allPlans: mode })!.allPlans!;
      expect(a.plans.map((p) => p.premium)).toEqual(a.plans.map((p) => comparePremium(p.code, "F", 35, mode)));
    }
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "value", "compare", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ วันนี้ขอเทียบแผนประกันสุขภาพ iHealthy Ultra ทั้ง 4 แผนให้ดูในคลิปเดียวนะคะ สำหรับคุณผู้หญิงอายุ 35 ปีค่ะ");
    expect(lines[1].voice).toBe("ปีแรก ค่าใช้จ่ายรายปี Smart 20,550 บาท Bronze 23,950 บาท Silver 35,850 บาท และ Gold 45,850 บาท รวมประกันชีวิตทุน 50,000 บาท กับค่าชดเชยรายวันไว้แล้วค่ะ");
    expect(lines[2].voice).toBe("วงเงินค่ารักษาต่อปี ตั้งแต่ 3 ล้าน ไปจนถึง 25 ล้านบาท ค่าห้องวันละ 1,500 ไปจนถึง 9,000 บาทค่ะ");
    expect(lines[3].voice).toBe("ที่เหมือนกันทุกแผน คือค่ารักษาในโรงพยาบาล ผ่าตัด ล้างไต มะเร็ง และรถพยาบาล จ่ายตามจริงทั้งหมด ไม่มีค่าใช้จ่ายส่วนแรกค่ะ");
    expect(lines[4].voice).toBe("ถ้าเลือก Silver หรือ Gold จะได้เพิ่ม พยาบาลพิเศษ ทันตกรรมจากอุบัติเหตุ ศัลยกรรมในช่องปาก ภาวะแทรกซ้อนจากการคลอด และค่าหมอค่ายา OPD Silver ปีละ 6,000 บาท Gold ปีละ 12,000 บาทค่ะ");
    expect(lines[5].voice).toBe("สนใจแผนไหน ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
    for (const l of lines) expect(l.voice).not.toMatch(NEVER);
    // a man's voice, a named customer, any length asked: the same six scenes
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M").at(-1)!.voice).toContain("ครับ");
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "สมใจ", "F", "short")[0].voice).toContain("คุณสมใจ");
  });

  it("leaves out what an age does not have", () => {
    // a child of 10: two plans, no extras scene, no daily cash in the price
    const kid = quoteVideoScript(quoteVideoFacts({ ...PAGE, age: 10 })!, "");
    expect(kid.map((l) => l.key)).toEqual(["lead", "price", "cover", "value", "contact"]);
    expect(kid[0].voice).toContain("ทั้ง 2 แผน");
    expect(kid[1].voice).not.toContain("ค่าชดเชยรายวัน");
    // past the age the page's premiums pay daily cash for, the voice does not name it
    const old = allPlansFacts("M", 75, "annual", "th")!;
    expect(old.dailyCash).toBeNull();
    expect(quoteVideoScript(quoteVideoFacts({ ...PAGE, sex: "M", age: 75 })!, "")[1].voice).not.toContain("ค่าชดเชยรายวัน");
    // childbirth is said to a woman only
    expect(quoteVideoScript(quoteVideoFacts({ ...PAGE, sex: "M", age: 40 })!, "")[4].voice).not.toContain("คลอด");
    // an age the page does not sell
    expect(quoteVideoFacts({ ...PAGE, age: 3 })).toBeUndefined();
  });

  it("tells every language in fixed lines with the page's figures", () => {
    for (const lang of VIDEO_LANGS.filter((l) => l !== "th")) {
      const f = quoteVideoFacts({ ...PAGE, lang })!;
      const lines = quoteVideoScript(f, "");
      expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "value", "compare", "contact"]);
      for (const l of lines) expect(l.voice).not.toMatch(/[฀-๿]/);
      expect(f.allPlans!.same.length).toBe(11);
    }
    expect(quoteVideoScript(quoteVideoFacts({ ...PAGE, lang: "en" as const })!, "")[1].voice)
      .toBe("In the first year, paying yearly, Smart 20,550 baht, Bronze 23,950 baht, Silver 35,850 baht and Gold 45,850 baht, with life cover of 50,000 baht and daily hospital cash already included.");
  });

  it("draws its own scenes and carries no single figure over the joins", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(Object.keys(motionSpec("price", f, 9))).toEqual(expect.arrayContaining(["row0", "bar3", "count3", "note"]));
    expect(Object.keys(motionSpec("value", f, 9))).toContain("row10");
    for (const key of ["price", "cover", "value"]) expect(carryFigure(key, f)).toBeNull();
    expect(pageCaption(f)).toContain("Smart 20,550 บาท");
    expect(pageCaption(f)).not.toMatch(NEVER);
  });

  it("is opened from the page's button with its instalment and language", () => {
    const href = videoStartHref({ product: "IHEALTHY", sex: "F", age: 35, plan: "GOLD", allPlans: "monthly", lang: "en" });
    expect(href).toContain("all=monthly");
    const back = videoStartFrom(Object.fromEntries(new URL(href, "https://x").searchParams));
    expect(back).toMatchObject({ product: "IHEALTHY", sex: "F", age: 35, allPlans: "monthly", lang: "en" });
    expect(videoStartFrom({ product: "IHEALTHY", all: "weekly" })?.allPlans).toBeUndefined();
  });
});
