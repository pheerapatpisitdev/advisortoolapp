import { describe, expect, it } from "vitest";
import { allowedNumbers, fallbackLines, numbersIn, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import { CI123_SUMS } from "@/lib/ci123-cta";
import { ci123Table } from "@/lib/ci123-table";
import type { Ci123VideoInput } from "@/lib/quote-video/ci123";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { productQas } from "@/lib/quote-video/qa";
import { sayNumbers } from "@/lib/quote-video/say-numbers";
import { pageCaption, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the mockup's example (owner, 2026-11-26, ข): a man of 35, a million of CI 123 on Life Protect x2 at 150,000 */
const PAGE: Ci123VideoInput = { product: "CI123", age: 35, sex: "M", sumAssured: 1_000_000 };
const NEVER = /เบี้ย|เสียชีวิต|เวนคืน|ทันที|ภาษี/;
const LENGTHS = ["short", "full", "long", "max"] as const;

describe("CI 123 in วิดีโอนำเสนอ", () => {
  it("states the page's own figures", () => {
    const f = quoteVideoFacts(PAGE)!;
    const g = f.ci123!;
    // the page prints whole baht (formatBaht): 6,911.50 is shown 6,911, about 19 a day
    expect(f.prices.map((p) => [p.label, p.amount, p.main])).toEqual([["รายปี", "6,911", true], ["ราย 6 เดือน", "3,593", false]]);
    expect(g).toMatchObject({ sum: 1_000_000, tier: 2, diseaseCount: 122, baseSum: 150_000, annual: "6,911", perDay: "19", juvenile: false });
    expect(g.stairs.map((r) => [r.short, r.count, r.amount])).toEqual([["ก่อนเริ่มต้น", 6, 100_000], ["เริ่มต้น–ปานกลาง", 42, 250_000], ["ระยะรุนแรง", 53, 1_000_000]]);
    expect(g.more.map((r) => [r.key, r.count, r.share, r.amount])).toEqual([["special conditions", 4, "10%", 100_000], ["critical care benefit", 2, "25%", 250_000]]);
    expect(g.deathRows).toEqual([{ label: "ก่อนอายุ 60", amount: 300_000, on: true }, { label: "ตั้งแต่อายุ 60", amount: 150_000, on: false }]);
    expect(f.planLine).toBe("CI 123");
    expect(f.lead).toMatchObject({ label: "เงินก้อนเมื่อพบโรคร้ายแรง", amount: "1,000,000", baht: 1_000_000 });
    expect(f.leadMark).toBe("122 โรค จ่ายตามระยะ");
    expect(f.leadPill).toBe("เริ่มจ่ายตั้งแต่ระยะก่อนเริ่มต้น");
    expect(f.priceBig).toEqual({ label: "ออมปีละ", amount: "6,911", unit: "บาท" });
    expect(f.pills).toEqual(["ตกวันละ 19 บาท", "รวมแบบหลัก Life Protect x2"]);
    expect(f.priceNotes.join(" ")).toMatch(/ปรับขึ้นในปีถัดไป/);
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "critical", "cover", "family", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ถ้าวันหนึ่งตรวจพบโรคร้ายแรง เงินก้อนช่วยให้รักษาได้เต็มที่ CI 123 คุ้มครองโรคร้ายแรง 122 โรค ทุน 1 ล้านบาทค่ะ");
    expect(lines[1].voice).toBe("สำหรับคุณผู้ชายอายุ 35 ปี ออมปีแรก 6,911 บาท ตกวันละ 19 บาท รวมแบบหลักไว้แล้วค่ะ");
    expect(lines[2].voice).toBe("เจอเร็วก็ได้เร็ว ระยะก่อนเริ่มต้นรับ 100,000 บาท ระยะเริ่มต้นถึงปานกลางรับ 250,000 บาท และระยะรุนแรงรับเต็มทุน 1 ล้านบาท หักส่วนที่รับไปแล้วค่ะ");
    expect(lines[3].voice).toBe("นอกจากนี้ยังมีโรคภายใต้เงื่อนไขพิเศษ รับ 100,000 บาท และภาวะวิกฤต รับ 250,000 บาทค่ะ");
    expect(lines[4].voice).toBe("และยังมีแบบหลักคุ้มครองชีวิต ถ้าจากไปก่อนอายุ 60 ครอบครัวได้ 300,000 บาทค่ะ");
    expect(lines[5].voice).toMatch(/^วางแผนไว้ก่อน ไม่ต้องห่วงค่ารักษาค่ะ สนใจ ทักมาคุยกันได้เลยนะคะ/);
    // a man's endings
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M").every((l) => !/ค่ะ|คะ/.test(l.voice))).toBe(true);
    // the plan's name is read digit by digit, not as a hundred and twenty-three
    expect(sayNumbers(lines[0].voice)).toContain("ซีไอ หนึ่งสองสาม คุ้มครองโรคร้ายแรง หนึ่งร้อยยี่สิบสอง โรค");
  });

  it("says nothing it should not, and only the quote's figures, on every sum at every age", () => {
    const t = ci123Table();
    for (const sumAssured of t.sums) for (const sex of ["M", "F"] as const) for (let age = t.ageMin; age <= t.ageMax; age++) {
      const f = quoteVideoFacts({ ...PAGE, sumAssured, sex, age });
      const at = `${sumAssured} ${sex}${age}`;
      // where the page prices nothing (a woman of 19 on 5 แสน: its table has no price there), nor does the clip
      if (!t.premiums[sex][t.sums.indexOf(sumAssured)][age - t.ageMin]) { expect(f, at).toBeUndefined(); continue; }
      expect(f, at).toBeDefined();
      const g = f!.ci123!;
      // the stairs climb to the whole sum; the first stage is 20% held at 100,000
      expect(g.stairs[2].amount).toBe(sumAssured);
      expect(g.stairs[0].amount).toBe(Math.min(sumAssured * 0.2, 100_000));
      // the children's illnesses only for an insured of 18 or under
      expect(g.more.some((r) => r.key === "juvenile ci"), at).toBe(age <= 18);
      const allowed = allowedNumbers(f!);
      for (const length of LENGTHS) for (const l of quoteVideoScript(f!, "", "F", length)) {
        expect(l.voice, `${at} ${length} ${l.key}`).not.toMatch(NEVER);
        for (const n of numbersIn(l.voice)) expect(allowed.has(n), `${at} ${length} ${l.key}: ${n}`).toBe(true);
      }
      const lines = quoteVideoScript(f!, "");
      expect(lines.map((l) => l.key)).toEqual(["lead", "price", "critical", "cover", "family", "contact"]);
      expect(lines.find((l) => l.key === "cover")!.voice.includes("สำหรับเด็ก"), at).toBe(age <= 18);
      // from 60 the base contract pays its later sum only, and never says "before 60"
      const family = lines.find((l) => l.key === "family")!.voice;
      if (age >= 60) {
        expect(g.deathRows).toEqual([{ label: "ตลอดสัญญา", amount: 150_000, on: true }]);
        expect(family).toBe("และยังมีแบบหลักคุ้มครองชีวิต ถ้าจากไป ครอบครัวได้ 150,000 บาทค่ะ");
      } else expect(family).toContain("ก่อนอายุ 60 ครอบครัวได้ 300,000 บาท");
      expect(Number(extraOf(f!, {}).versus.right.amount.replace(/,/g, ""))).toBe(sumAssured);
    }
    expect(quoteVideoFacts({ ...PAGE, age: 76 })).toBeUndefined();
    expect(quoteVideoFacts({ ...PAGE, sumAssured: 1_500_000 })).toBeUndefined();
  });

  it("names a newborn, not an age of nought, and says the larger stages in millions", () => {
    expect(quoteVideoScript(quoteVideoFacts({ ...PAGE, age: 0 })!, "")[1].voice).toMatch(/^สำหรับเด็กแรกเกิด ออมปีแรก/);
    const big = quoteVideoScript(quoteVideoFacts({ ...PAGE, sumAssured: 10_000_000, age: 5, sex: "F" })!, "");
    expect(big[2].voice).toBe("เจอเร็วก็ได้เร็ว ระยะก่อนเริ่มต้นรับ 100,000 บาท ระยะเริ่มต้นถึงปานกลางรับ 2.5 ล้านบาท และระยะรุนแรงรับเต็มทุน 10 ล้านบาท หักส่วนที่รับไปแล้วค่ะ");
    expect(big[3].voice).toBe("นอกจากนี้ยังมีโรคร้ายแรงสำหรับเด็ก รับ 2.5 ล้านบาท โรคภายใต้เงื่อนไขพิเศษ รับ 1 ล้านบาท และภาวะวิกฤต รับ 2.5 ล้านบาทค่ะ");
  });

  it("tells the other lengths", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[1].voice).toBe("ปีแรกออมแค่วันละ 19 บาท คุ้มครองโรคร้ายแรง 122 โรคค่ะ");
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "critical", "cover", "family", "versus", "qa", "steps", "contact"]);
    expect(extraVoice("versus", f, {})).toBe("ถ้าเก็บเงินเองปีละ 6,911 บาท ก็มีเงินแค่นั้น แต่แผนนี้ ถ้าตรวจพบโรคร้ายแรง รับเงินก้อนสูงสุดถึง 1,000,000 บาทค่ะ");
    expect(pageCaption(f)).toContain("CI 123");
    expect(pageCaption(f)).toContain("122 โรค");
    for (const q of productQas("CI123")) expect(q.a).not.toMatch(NEVER);
  });

  it("has fixed lines that pass its own checks", () => {
    for (const [age, sumAssured] of [[35, 1_000_000], [5, 10_000_000], [70, 500_000]] as const) {
      const f = quoteVideoFacts({ ...PAGE, age, sumAssured })!;
      expect(storiesFor(f).length).toBeGreaterThanOrEqual(2);
      for (const s of storiesFor(f)) for (const hook of WRITTEN_HOOKS) {
        expect(writtenProblems(fallbackLines(f, { hook, story: s.key }), f, { loop: false, story: true }), `${age} ${s.key} ${hook}`).toEqual({});
      }
    }
  });

  it("checks what the form sent, and works a budget out on the page's sums", () => {
    expect(CI123_SUMS).toEqual(ci123Table().sums);
    expect(checked({ ...PAGE })).toMatchObject({ product: "CI123", sumAssured: 1_000_000, age: 35 });
    expect(checked({ ...PAGE, age: 76 })).toMatch(/0–75/);
    expect(checked({ ...PAGE, sumAssured: 1_500_000 })).toMatch(/5 แสน/);
    expect(resolveBudget(PAGE, { baht: 10_000, per: "year" })).toMatchObject({ sumAssured: 1_000_000 });
    expect(resolveBudget(PAGE, { baht: 100_000, per: "year" })).toMatchObject({ sumAssured: 10_000_000 });
    expect(typeof resolveBudget(PAGE, { baht: 1_000, per: "year" })).toBe("string");
  });

  it("opens from the page with its sum, and follows hidden instalments", () => {
    const href = videoStartHref({ product: "CI123", sex: "F", age: 30, sumAssured: 2_000_000 });
    expect(href).toBe("/studio/quote-video?product=CI123&sex=F&age=30&sum=2000000");
    expect(videoStartFrom(Object.fromEntries(new URL(`https://x${href}`).searchParams))).toEqual({ product: "CI123", sex: "F", age: 30, sumAssured: 2_000_000 });
    // only the page's own sums are read from an address
    expect(videoStartFrom({ product: "CI123", sum: "1500000" })).toEqual({ product: "CI123" });
    const f = quoteVideoFacts({ ...PAGE, sumAssured: 10_000_000, hide: ["monthly"] })!;
    expect(f.prices.map((p) => p.label)).not.toContain("รายเดือน");
    expect(quoteVideoScript(f, "")[1].voice).toMatch(/^สำหรับคุณผู้ชายอายุ 35 ปี ออมปีแรก [\d,]+ บาท ตกวันละ \d+ บาท/);
  });
});
