import { describe, expect, it } from "vitest";
import { fallbackLines, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import { LIFETREASURE_VARIANTS, type LifeTreasureVideoInput } from "@/lib/quote-video/lifetreasure";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { beatCues, penBeats } from "@/lib/quote-video/pen";
import { productQas } from "@/lib/quote-video/qa";
import { pageCaption, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the mockup's example (owner, 2026-11-26, ก): a man of 45, ten million, paid in 12 years */
const PAGE: LifeTreasureVideoInput = { product: "LIFETREASURE", variant: "H99F12A", age: 45, sex: "M", sumAssured: 10_000_000 };
const NEVER = /เบี้ย|เสียชีวิต|เวนคืน|ทันที|ภาษี/;
const LENGTHS = ["short", "full", "long", "max"] as const;
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

describe("ไลฟ์เทรเชอร์ in วิดีโอนำเสนอ", () => {
  it("states the page's own figures", () => {
    const f = quoteVideoFacts(PAGE)!;
    expect(f.lifetreasure).toMatchObject({ sum: 10_000_000, variant: "H99F12A", payYears: 12, lastPayAge: 56, coverToAge: 99, annual: "475,000", paid: 5_700_000, times: "1.8", atLeast: false, floorPercent: 101, endCash: 10_000_000, at70: 6_910_000 });
    expect(f.lifetreasure!.terms.map((t) => [t.years, t.annual, t.total, t.times, t.on])).toEqual([
      [6, "960,000", "5,760,000", "1.7", false], [12, "475,000", "5,700,000", "1.8", true], [18, "370,000", "6,660,000", "1.5", false],
    ]);
    expect(f.prices.map((p) => [p.label, p.amount, p.main])).toEqual([["รายปี", "475,000", false], ["ราย 6 เดือน", "247,000", false], ["รายเดือน", "42,750", true]]);
    expect(f.planLine).toBe("Life Treasure");
    expect(f.lead).toMatchObject({ amount: "10,000,000", baht: 10_000_000 });
    expect(f.leadMark).toBe("จ่าย 12 ปี · คุ้มครองถึงอายุ 99");
    expect(f.priceBig).toEqual({ label: "ออมปีละ", amount: "475,000", unit: "บาท" });
    expect(f.breakEven).toMatchObject({ age: 62, cash: "5,800,000", index: 17 });
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "terms", "total", "value", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ถ้าอยากเตรียมเงินก้อนไว้ให้ครอบครัว แบบรู้จำนวนแน่นอนตั้งแต่วันนี้ Life Treasure ส่งต่อเงิน 10 ล้านบาท คุ้มครองถึงอายุ 99 ค่ะ");
    expect(lines[1].voice).toBe("สำหรับคุณผู้ชายอายุ 45 ปี ออมปีละ 475,000 บาท หรือเดือนละ 42,750 บาท จ่าย 12 ปีแล้วจบค่ะ");
    expect(lines[2].voice).toBe("เลือกจ่าย 6 ปี 12 ปี หรือ 18 ปีก็ได้ ให้พอดีกับรายได้ช่วงนี้ค่ะ");
    expect(lines[3].voice).toBe("ออมรวม 5,700,000 บาท แต่ส่งต่อให้ครอบครัวได้ 10 ล้านบาท คิดเป็น 1.8 เท่าของที่ออมค่ะ");
    expect(lines[4].voice).toBe("ระหว่างทาง แผนนี้ก็มีมูลค่าเงินสด ออมครบตอนอายุ 56 แล้วเงินก็ยังโตทุกปี พออายุ 62 มูลค่าเงินสด 5,800,000 บาท ครบเท่าที่ออมไปแล้ว และถึงอายุ 99 ได้ 10 ล้านบาทเต็มค่ะ");
    expect(lines[5].voice).toMatch(/^จะแบ่งให้ใครเท่าไรก็ระบุได้ค่ะ/);
    // a man's endings
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M").every((l) => !/ค่ะ|คะ/.test(l.voice))).toBe(true);
  });

  it("says nothing it should not, at every age and on every term", () => {
    for (const variant of LIFETREASURE_VARIANTS) for (const sex of ["M", "F"] as const) for (let age = 0; age <= 70; age += 1) {
      const f = quoteVideoFacts({ ...PAGE, variant, sex, age });
      expect(f, `${variant} ${sex}${age}`).toBeDefined();
      const g = f!.lifetreasure!;
      expect(g.terms.filter((t) => t.on).map((t) => t.variant)).toEqual([variant]);
      for (const length of LENGTHS) for (const l of quoteVideoScript(f!, "", "F", length)) {
        expect(l.voice, `${variant} ${sex}${age} ${length} ${l.key}`).not.toMatch(NEVER);
        expect(l.voice).not.toMatch(/มากกว่าที่ออม/);
      }
      if (f!.breakEven) expect(num(f!.breakEven.cash)).toBeGreaterThanOrEqual(g.paid);
      // the multiple is told only from 1.1 up, and only where the family receives more than was paid
      expect(quoteVideoScript(f!, "").some((l) => l.key === "total")).toBe(Boolean(g.times));
      if (g.times) { expect(Number(g.times)).toBeGreaterThanOrEqual(1.1); expect(g.paid).toBeLessThan(g.sum); }
      // the cash at the end is the table's last
      expect(g.endCash).toBe(num(f!.rows![f!.rows!.length - 1].cash ?? "0"));
      expect(num(extraOf(f!, {}).versus.right.amount) || Infinity, `${variant} ${sex}${age} versus`).toBeGreaterThan(0);
    }
    expect(quoteVideoFacts({ ...PAGE, age: 71 })).toBeUndefined();
  });

  it("says อย่างน้อย where the 101% floor lifts the cover, and drops the multiple for the oldest", () => {
    const old = quoteVideoFacts({ ...PAGE, variant: "H99F18A" as const, age: 70 })!;
    expect(old.lifetreasure).toMatchObject({ atLeast: true });
    expect(old.lifetreasure!.times).toBeUndefined();
    expect(old.breakEven).toBeUndefined();
    const lines = quoteVideoScript(old, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "terms", "value", "contact"]);
    expect(lines[0].voice).toContain("อย่างน้อย 10 ล้านบาท");
    expect(lines[3].voice).toMatch(/ถึงอายุ 99 มูลค่าเงินสด [\d,]+ บาทค่ะ$/);
    expect(extraVoice("versus", old, {})).toBe("ออมแค่ 18 ปี หลังจากนั้นไม่ต้องจ่ายอีก แต่คุ้มครองไปถึงอายุ 99 ค่ะ");
  });

  it("names a newborn, not an age of nought", () => {
    expect(quoteVideoScript(quoteVideoFacts({ ...PAGE, age: 0 })!, "")[1].voice).toMatch(/^สำหรับเด็กแรกเกิด ออมปีละ/);
  });

  it("writes the value scene's pen notes on its own words", () => {
    const f = quoteVideoFacts(PAGE)!;
    const voice = quoteVideoScript(f, "").find((l) => l.key === "value")!.voice;
    const cues = beatCues(penBeats(f), voice, 12);
    expect(cues.map((c) => c.beat)).toEqual(["steady", "stop", "growth", "breakEven", "gain"]);
    for (let i = 1; i < cues.length; i++) expect(cues[i].at).toBeGreaterThanOrEqual(cues[i - 1].at);
  });

  it("tells the other lengths", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[1].voice).toBe("ออมปีละ 475,000 บาท จ่าย 12 ปีแล้วจบ ส่งต่อให้ครอบครัว 10 ล้านบาทค่ะ");
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "terms", "total", "value", "versus", "qa", "steps", "contact"]);
    expect(pageCaption(f)).toContain("Life Treasure");
    expect(pageCaption(f)).toContain("1.8 เท่าของที่ออม");
    for (const q of productQas("LIFETREASURE")) expect(q.a).not.toMatch(NEVER);
  });

  it("has fixed lines that pass its own checks", () => {
    for (const [age, variant] of [[45, "H99F12A"], [70, "H99F18A"], [0, "H99F06A"]] as const satisfies readonly (readonly [number, LifeTreasureVideoInput["variant"]])[]) {
      const f = quoteVideoFacts({ ...PAGE, age, variant })!;
      expect(storiesFor(f).length).toBeGreaterThanOrEqual(2);
      for (const s of storiesFor(f)) for (const hook of WRITTEN_HOOKS) {
        expect(writtenProblems(fallbackLines(f, { hook, story: s.key }), f, { loop: false, story: true }), `${age} ${s.key} ${hook}`).toEqual({});
      }
    }
  });

  it("checks what the form sent, and works a budget out on the page's sums and the chosen term", () => {
    expect(checked({ ...PAGE })).toMatchObject({ product: "LIFETREASURE", variant: "H99F12A", sumAssured: 10_000_000 });
    expect(checked({ ...PAGE, age: 71 })).toMatch(/0–70/);
    expect(checked({ ...PAGE, sumAssured: 9_000_000 })).toMatch(/10,000,000/);
    expect(checked({ ...PAGE, sumAssured: 31_000_000 })).toMatch(/10,000,000/);
    expect(checked({ ...PAGE, variant: "H99F09A" as never })).toMatch(/6 12 หรือ 18/);
    expect(resolveBudget(PAGE, { baht: 500_000, per: "year" })).toMatchObject({ sumAssured: 10_000_000, variant: "H99F12A" });
    expect(resolveBudget(PAGE, { baht: 1_000_000, per: "year" })).toMatchObject({ sumAssured: 21_000_000 });
    expect(typeof resolveBudget(PAGE, { baht: 100_000, per: "year" })).toBe("string");
  });

  it("opens from the page with its term, and follows hidden instalments", () => {
    const href = videoStartHref({ product: "LIFETREASURE", sex: "M", age: 45, sumAssured: 10_000_000, variant: "H99F06A" });
    expect(href).toContain("variant=H99F06A");
    expect(videoStartFrom(Object.fromEntries(new URL(`https://x${href}`).searchParams))).toEqual({ product: "LIFETREASURE", sex: "M", age: 45, sumAssured: 10_000_000, variant: "H99F06A" });
    // only the page's own terms are read from an address
    expect(videoStartFrom({ product: "LIFETREASURE", variant: "WLF19H" })).toEqual({ product: "LIFETREASURE" });
    const f = quoteVideoFacts({ ...PAGE, hide: ["monthly"] })!;
    expect(f.spokenPrice).toEqual({ per: "ปีละ", amount: "475,000" });
    expect(f.prices.map((p) => p.label)).not.toContain("รายเดือน");
    expect(quoteVideoScript(f, "")[1].voice).toBe("สำหรับคุณผู้ชายอายุ 45 ปี ออมปีละ 475,000 บาท จ่าย 12 ปีแล้วจบค่ะ");
  });
});
