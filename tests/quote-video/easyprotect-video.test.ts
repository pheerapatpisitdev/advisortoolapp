import { describe, expect, it } from "vitest";
import { fallbackLines, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import type { EasyProtectVideoInput } from "@/lib/quote-video/easyprotect";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { beatCues, penBeats } from "@/lib/quote-video/pen";
import { productQas } from "@/lib/quote-video/qa";
import { pageCaption, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the mockup's example (owner, 2026-11-26, ก ก): a man of 35, a million */
const PAGE: EasyProtectVideoInput = { product: "EASYPROTECT", age: 35, sex: "M", sumAssured: 1_000_000 };
const NEVER = /เบี้ย|เสียชีวิต|เวนคืน|ทันที|ภาษี/;
const LENGTHS = ["short", "full", "long", "max"] as const;
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

describe("อีซี่ โพรเทค 6 in วิดีโอนำเสนอ", () => {
  it("states the page's own figures", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(f.easyprotect).toEqual({ sum: 1_000_000, payYears: 6, lastPayAge: 40, coverToAge: 99, annual: "68,000", paid: 408_000, times: "2.5", atLeast: false, floorPercent: 101, endCash: 1_000_000 });
    expect(f.prices.map((p) => [p.label, p.amount, p.main])).toEqual([["รายปี", "68,000", false], ["ราย 6 เดือน", "35,360", false], ["รายเดือน", "6,120", true]]);
    expect(f.lead).toMatchObject({ amount: "1,000,000", baht: 1_000_000 });
    expect(f.breakEven).toMatchObject({ age: 48, cash: "408,000", index: 13 });
    expect(f.coverStyle).toBe("paidup");
    expect(f.screenNote).toBe("เวนคืนก่อนปีที่ 14 อาจได้น้อยกว่าเบี้ยที่จ่าย");
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "total", "value", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ คุณผู้ชายอายุ 35 ทำทุน 1 ล้าน ออมเพียง 6 ปี ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน 1 ล้านบาทค่ะ");
    expect(lines[1].voice).toBe("ออมแค่วันละ 187 บาท หรือเดือนละ 6,120 บาท ออมเพียง 6 ปีก็ครบ ยอดออมเท่าเดิมตลอดค่ะ");
    expect(lines[2].voice).toBe("ออมแค่ 6 ปี ตั้งแต่อายุ 35 ถึง 40 ปีที่ 7 เป็นต้นไป ไม่ต้องจ่ายอีกเลย แต่ดูแลครอบครัว 1 ล้านบาท ยาวไปถึงอายุ 99 ค่ะ");
    expect(lines[3].voice).toBe("ออมรวมทั้งหมด 408,000 บาท ครอบครัวได้ 1 ล้านบาท คิดเป็น 2.5 เท่าของที่ออมค่ะ");
    expect(lines[4].voice).toBe("ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน ออมครบตอนอายุ 40 แล้วเงินก็ยังโตทุกปี พออายุ 48 ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ 408,000 บาท ครบเท่าที่ออมไปทั้งหมดแล้วค่ะ");
  });

  it("never says more than was paid came back where it is only the same", () => {
    for (const sex of ["M", "F"] as const) for (let age = 0; age <= 80; age++) {
      const f = quoteVideoFacts({ ...PAGE, sex, age });
      expect(f, `${sex}${age}`).toBeDefined();
      for (const length of LENGTHS) for (const l of quoteVideoScript(f!, "", "F", length)) {
        expect(l.voice, `${sex}${age} ${l.key}`).not.toMatch(NEVER);
        expect(l.voice).not.toMatch(/มากกว่าที่ออม/);
      }
      if (f!.breakEven) expect(num(f!.breakEven.cash)).toBeGreaterThanOrEqual(f!.easyprotect!.paid);
      // the comparison is told only where the family receives more than was paid
      expect(quoteVideoScript(f!, "").some((l) => l.key === "total")).toBe(Boolean(f!.easyprotect!.times));
      if (f!.easyprotect!.times) expect(f!.easyprotect!.paid).toBeLessThan(f!.easyprotect!.sum);
      const x = extraOf(f!, {}).versus;
      expect(num(x.right.amount) || Infinity, `${sex}${age} versus`).toBeGreaterThan(0);
    }
    expect(quoteVideoFacts({ ...PAGE, age: 81 })).toBeUndefined();
  });

  it("says ได้อย่างน้อย where the 101% floor lifts the cover above the sum", () => {
    const old = quoteVideoFacts({ ...PAGE, age: 75, sumAssured: 500_000 })!;
    expect(old.easyprotect).toMatchObject({ atLeast: true });
    expect(old.easyprotect!.times).toBeUndefined();
    const lines = quoteVideoScript(old, "");
    expect(lines[0].voice).toContain("อย่างน้อย 500,000 บาท");
    expect(lines[2].voice).toContain("อย่างน้อย 500,000 บาท");
    expect(extraVoice("versus", old, {})).not.toMatch(/ครอบครัวได้เงินก้อน 500,000/);
  });

  it("writes the value scene's pen notes on its own words", () => {
    const f = quoteVideoFacts(PAGE)!;
    const voice = quoteVideoScript(f, "").find((l) => l.key === "value")!.voice;
    const cues = beatCues(penBeats(f), voice, 12);
    expect(cues.map((c) => c.beat)).toEqual(["steady", "stop", "growth", "breakEven", "gain"]);
    expect(cues[4].at).toBeGreaterThan(cues[3].at);
  });

  it("tells the other lengths", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(quoteVideoScript(f, "", "F", "short").map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "total", "value", "versus", "qa", "steps", "contact"]);
    expect(pageCaption(f)).toContain("อีซี่ โพรเทค 6");
    for (const q of productQas("EASYPROTECT")) expect(q.a).not.toMatch(NEVER);
  });

  it("has fixed lines that pass its own checks", () => {
    for (const age of [35, 75]) {
      const f = quoteVideoFacts({ ...PAGE, age })!;
      expect(storiesFor(f).length).toBeGreaterThanOrEqual(2);
      for (const s of storiesFor(f)) for (const hook of WRITTEN_HOOKS) {
        expect(writtenProblems(fallbackLines(f, { hook, story: s.key }), f, { loop: false, story: true }), `${age} ${s.key} ${hook}`).toEqual({});
      }
    }
  });

  it("checks what the form sent, and works a budget out on the page's sums", () => {
    expect(checked({ ...PAGE })).toMatchObject({ product: "EASYPROTECT", sumAssured: 1_000_000 });
    expect(checked({ ...PAGE, age: 81 })).toMatch(/0–80/);
    expect(checked({ ...PAGE, sumAssured: 400_000 })).toMatch(/500,000/);
    expect(checked({ ...PAGE, sumAssured: 1_050_000 })).toMatch(/500,000/);
    expect(resolveBudget(PAGE, { baht: 70_000, per: "year" })).toMatchObject({ sumAssured: 1_000_000 });
    expect(resolveBudget(PAGE, { baht: 6_120, per: "month" })).toMatchObject({ sumAssured: 1_000_000 });
    expect(typeof resolveBudget(PAGE, { baht: 10_000, per: "year" })).toBe("string");
    expect(checked({ ...PAGE, budget: { baht: 70_000, per: "year" } })).toMatchObject({ sumAssured: 1_000_000 });
  });

  it("opens from the page, and follows hidden instalments", () => {
    const back = videoStartFrom(Object.fromEntries(new URL(`https://x${videoStartHref({ product: "EASYPROTECT", sex: "M", age: 35, sumAssured: 1_000_000 })}`).searchParams));
    expect(back).toEqual({ product: "EASYPROTECT", sex: "M", age: 35, sumAssured: 1_000_000 });
    const f = quoteVideoFacts({ ...PAGE, hide: ["monthly"] })!;
    expect(f.spokenPrice).toEqual({ per: "ปีละ", amount: "68,000" });
    expect(f.prices.map((p) => p.label)).not.toContain("รายเดือน");
  });
});
