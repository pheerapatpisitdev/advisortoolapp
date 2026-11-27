import { describe, expect, it } from "vitest";
import { allowedNumbers, fallbackLines, numbersIn, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import { CANCER_SUMS, CANCER_TIERS } from "@/lib/cancer-cta";
import { CPR_STAGES, cancerDeathTotals, cprStagePays } from "@/lib/cancer-benefits";
import { cancerTable } from "@/lib/cancer-table";
import { carryFigure } from "@/lib/quote-video/carry";
import type { CancerVideoInput } from "@/lib/quote-video/cancer";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { productQas } from "@/lib/quote-video/qa";
import { sayNumbers } from "@/lib/quote-video/say-numbers";
import { pageCaption, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { stageView } from "@/lib/quote-video/stage-views";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the mockup's example (owner, 2026-11-26, "ca"): a man of 40 on the second package, 500,000 and 2,000 a day */
const PAGE: CancerVideoInput = { product: "CANCER", age: 40, sex: "M", sumAssured: 500_000 };
const NEVER = /เบี้ย|เสียชีวิต|ตาย|เวนคืน|ทันที|ภาษี|%|เปอร์เซ็นต์/;
const LENGTHS = ["short", "full", "long", "max"] as const;

describe("ประกันมะเร็ง in วิดีโอนำเสนอ", () => {
  it("states the page's own figures", () => {
    const f = quoteVideoFacts(PAGE)!;
    const g = f.cancer!;
    // the page prints whole baht (formatBaht): 3,520.98 is shown 3,520, about 10 a day; the monthly one is under the minimum
    expect(f.prices.map((p) => [p.label, p.amount, p.main])).toEqual([["รายปี", "3,520", true], ["ราย 6 เดือน", "1,830", false]]);
    expect(g).toMatchObject({ tier: 2, cpr: 500_000, hic: 2_000, baseSum: 150_000, annual: "3,520", perDay: "10", repeatNos: "2–3", waiting: { min: 60, max: 120 }, hicDays: 365, hicExtraDays: 180, beforeAge: 60 });
    expect(g.stages.map((s) => [s.no, s.amount, s.waitingDays])).toEqual([[1, 50_000, 120], [2, 75_000, 90], [3, 150_000, 90], [4, 500_000, 60]]);
    expect(g.totals.map((r) => [r.label, r.amount, r.on])).toEqual([["จากไปทั่วไป", 300_000, false], ["พบมะเร็งลุกลาม แล้วจากไป", 800_000, true]]);
    expect(f.planLine).toBe("ประกันมะเร็ง");
    expect(f.lead).toMatchObject({ label: "เงินก้อนเมื่อพบมะเร็ง", amount: "500,000", baht: 500_000 });
    expect(f.leadMark).toBe("ชดเชยนอน รพ. วันละ 2,000");
    expect(f.leadPill).toBe("จ่ายตั้งแต่ระยะแรก");
    expect(f.priceBig).toEqual({ label: "ออมปีละ", amount: "3,520", unit: "บาท" });
    expect(f.pills).toEqual(["ตกวันละ 10 บาท", "รวมแบบหลัก Life Protect x2"]);
    expect(f.priceNotes.join(" ")).toMatch(/ปรับขึ้นในปีถัดไป/);
    expect(f.contactLine).toBe("เตรียมไว้ก่อน ใจสบายกว่า");
    expect(carryFigure("cover", f)).toBe("วันละ 2,000 บาท");
  });

  it("draws the mockup's three scenes of its own", () => {
    const f = quoteVideoFacts(PAGE)!;
    const stairs = stageView("critical", f)!;
    expect(stairs.kicker).toBe("จ่ายตามขั้นของมะเร็ง");
    expect(stairs.stairs!.map((s) => [s.label, s.sub, s.amount])).toEqual([
      ["ขั้น 1", ["ไม่ลุกลาม", "ขั้นต้น"], 50_000], ["ขั้น 2", ["ไม่ลุกลาม"], 75_000], ["ขั้น 3", ["ผ่าตัด", "อวัยวะออก"], 150_000], ["ขั้น 4", ["ลุกลาม"], 500_000],
    ]);
    expect(stairs.pills).toEqual(["ขั้น 2–3 เคลมซ้ำได้ รวมไม่เกินทุน", "ระยะรอคอย 60–120 วัน"]);
    const daily = stageView("cover", f)!;
    expect(daily.big).toEqual({ amount: 2_000, unit: "บาท ต่อวัน" });
    expect(daily.rows!.map((r) => [r.label, r.amount, r.unit, Boolean(r.on)])).toEqual([["สูงสุด", 365, "วัน", true], ["ระยะลุกลาม เพิ่มอีก", 180, "วัน", false]]);
    const family = stageView("family", f)!;
    expect(family.kicker).toBe("รวมทุกสัญญา ก่อนอายุ 60");
    expect(family.rows!.map((r) => [r.label, r.sub, r.amount, Boolean(r.on)])).toEqual([
      ["จากไปทั่วไป", "แบบหลัก", 300_000, false], ["พบมะเร็งลุกลาม แล้วจากไป", "ทุนมะเร็ง 500,000 + แบบหลัก 300,000", 800_000, true],
    ]);
    // from 60 the title drops the age, as the page's deathTotalsTitle does
    expect(stageView("family", quoteVideoFacts({ ...PAGE, age: 60 })!)!.kicker).toBe("รวมทุกสัญญา");
    expect(stageView("lead", f)).toBeUndefined();
    expect(stageView("price", f)).toBeUndefined();
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "critical", "cover", "family", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ มะเร็งรักษานาน ค่าใช้จ่ายก็สูง ประกันโรคมะเร็งจ่ายเงินก้อนตั้งแต่ระยะแรก ทุน 500,000 บาท พร้อมค่าชดเชยนอนโรงพยาบาลวันละ 2,000 บาทค่ะ");
    expect(lines[1].voice).toBe("สำหรับคุณผู้ชายอายุ 40 ปี ออมปีแรก 3,520 บาท ตกวันละ 10 บาท รวมแบบหลักไว้แล้วค่ะ");
    expect(lines[2].voice).toBe("ขั้นแรกรับ 50,000 บาท ขั้นสองรับ 75,000 บาท ขั้นสามรับ 150,000 บาท และระยะลุกลามรับเต็มทุน 500,000 บาท หักส่วนที่รับไปแล้วค่ะ");
    expect(lines[3].voice).toBe("นอนโรงพยาบาลเพราะมะเร็ง รับวันละ 2,000 บาท สูงสุด 365 วัน ถ้าเป็นระยะลุกลามได้เพิ่มอีก 180 วันค่ะ");
    expect(lines[4].voice).toBe("ถ้าตรวจพบมะเร็งระยะลุกลาม แล้วจากไปก่อนอายุ 60 รวมทุกสัญญาครอบครัวได้ 800,000 บาทค่ะ");
    expect(lines[5].voice).toMatch(/^เตรียมไว้ก่อน ใจสบายกว่าค่ะ สนใจ ทักมาคุยกันได้เลยนะคะ/);
    // a man's endings
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M").every((l) => !/ค่ะ|คะ/.test(l.voice))).toBe(true);
    expect(sayNumbers(lines[0].voice)).toContain("ทุน ห้าแสน บาท");
  });

  it("says nothing it should not, and only the quote's figures, on every package at every age", () => {
    const t = cancerTable();
    for (const x of t.tiers) for (const sex of ["M", "F"] as const) for (let age = t.ageMin; age <= t.ageMax; age++) {
      const f = quoteVideoFacts({ ...PAGE, sumAssured: x.cpr, sex, age });
      const at = `${x.cpr} ${sex}${age}`;
      // where the page prices nothing, nor does the clip
      if (!t.premiums[sex][t.tiers.indexOf(x)][age - t.ageMin]) { expect(f, at).toBeUndefined(); continue; }
      expect(f, at).toBeDefined();
      const g = f!.cancer!;
      // the stairs are the payout sheet's, climbing to the whole sum; the daily sum is the package's
      expect(g.stages.map((s) => s.amount), at).toEqual(CPR_STAGES.map((s) => cprStagePays(s, x.cpr)));
      expect(g.stages[3].amount).toBe(x.cpr);
      expect(g.hic).toBe(x.hic);
      // the totals are the page's own helper's
      expect(g.totals.map((r) => r.amount), at).toEqual(cancerDeathTotals(x.cpr, x.death, age).rows.map((r) => r.amount));
      const allowed = allowedNumbers(f!);
      for (const length of LENGTHS) for (const l of quoteVideoScript(f!, "", "F", length)) {
        expect(l.voice, `${at} ${length} ${l.key}`).not.toMatch(NEVER);
        for (const n of numbersIn(l.voice)) expect(allowed.has(n), `${at} ${length} ${l.key}: ${n}`).toBe(true);
      }
      const lines = quoteVideoScript(f!, "");
      expect(lines.map((l) => l.key)).toEqual(["lead", "price", "critical", "cover", "family", "contact"]);
      // the voice's figures are the screen's
      const said = (k: string) => lines.find((l) => l.key === k)!.voice;
      for (const s of g.stages) expect(numbersIn(said("critical")), `${at} stage ${s.no}`).toContain(s.amount);
      expect(numbersIn(said("cover"))).toContain(x.hic);
      const after = g.totals.find((r) => r.on)!.amount;
      expect(numbersIn(said("family"))).toContain(after);
      // the title and the voice say "before 60" only for someone under it
      const family = stageView("family", f!)!;
      if (age < 60) {
        expect(family.kicker).toBe("รวมทุกสัญญา ก่อนอายุ 60");
        expect(said("family")).toContain("ก่อนอายุ 60");
        expect(after).toBe(x.cpr + x.death.sumBefore);
      } else {
        expect(family.kicker).toBe("รวมทุกสัญญา");
        expect(said("family")).not.toContain("ก่อนอายุ");
        expect(after).toBe(x.cpr + x.death.sumFrom);
      }
      expect(Number(extraOf(f!, {}).versus.right.amount.replace(/,/g, ""))).toBe(x.cpr);
      // a newborn is not "อายุ 0 ปี"
      if (age === 0) expect(said("price")).toMatch(/^สำหรับเด็กแรกเกิด ออมปีแรก/);
    }
    expect(quoteVideoFacts({ ...PAGE, age: t.ageMax + 1 })).toBeUndefined();
    expect(quoteVideoFacts({ ...PAGE, sumAssured: 600_000 })).toBeUndefined();
  });

  it("says the larger stages in millions", () => {
    const big = quoteVideoScript(quoteVideoFacts({ ...PAGE, sumAssured: 5_000_000, age: 30, sex: "F" })!, "");
    expect(big[2].voice).toBe("ขั้นแรกรับ 50,000 บาท ขั้นสองรับ 750,000 บาท ขั้นสามรับ 1.5 ล้านบาท และระยะลุกลามรับเต็มทุน 5 ล้านบาท หักส่วนที่รับไปแล้วค่ะ");
    expect(big[4].voice).toBe("ถ้าตรวจพบมะเร็งระยะลุกลาม แล้วจากไปก่อนอายุ 60 รวมทุกสัญญาครอบครัวได้ 7 ล้านบาทค่ะ");
  });

  it("tells the other lengths", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[1].voice).toBe("ปีแรกออมแค่วันละ 10 บาท รวมแบบหลักไว้แล้วค่ะ");
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "critical", "cover", "family", "versus", "qa", "steps", "contact"]);
    expect(extraVoice("versus", f, {})).toBe("ถ้าเก็บเงินเองปีละ 3,520 บาท ก็มีเงินแค่นั้น แต่แผนนี้ ถ้าตรวจพบมะเร็ง รับเงินก้อนสูงสุดถึง 500,000 บาทค่ะ");
    expect(extraVoice("steps", f, {})).toContain("มะเร็งหลังระยะรอคอย 60 ถึง 120 วัน");
    expect(pageCaption(f)).toContain("ประกันมะเร็ง");
    expect(pageCaption(f)).toContain("ขั้น 4 500,000");
    for (const q of productQas("CANCER")) expect(`${q.q} ${q.a}`).not.toMatch(NEVER);
  });

  it("has fixed lines that pass its own checks", () => {
    for (const [age, sumAssured] of [[40, 500_000], [3, 300_000], [65, 5_000_000]] as const) {
      const f = quoteVideoFacts({ ...PAGE, age, sumAssured })!;
      expect(storiesFor(f).length).toBeGreaterThanOrEqual(2);
      for (const s of storiesFor(f)) for (const hook of WRITTEN_HOOKS) {
        expect(writtenProblems(fallbackLines(f, { hook, story: s.key }), f, { loop: false, story: true }), `${age} ${s.key} ${hook}`).toEqual({});
      }
    }
  });

  it("checks what the form sent, and works a budget out on the page's packages", () => {
    expect(CANCER_TIERS).toEqual(cancerTable().tiers.map((x) => ({ cpr: x.cpr, hic: x.hic })));
    expect(CANCER_SUMS).toEqual([300_000, 500_000, 750_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000]);
    expect(checked({ ...PAGE })).toMatchObject({ product: "CANCER", sumAssured: 500_000, age: 40 });
    expect(checked({ ...PAGE, age: 66 })).toMatch(/0–65/);
    expect(checked({ ...PAGE, sumAssured: 600_000 })).toMatch(/5 แสน/);
    expect(resolveBudget(PAGE, { baht: 3_600, per: "year" })).toMatchObject({ sumAssured: 500_000 });
    expect(resolveBudget(PAGE, { baht: 1_000_000, per: "year" })).toMatchObject({ sumAssured: 5_000_000 });
    expect(typeof resolveBudget(PAGE, { baht: 500, per: "year" })).toBe("string");
    expect(typeof resolveBudget(PAGE, { baht: 300, per: "month" })).toBe("string");
  });

  it("opens from the page with its package, and follows hidden instalments", () => {
    const href = videoStartHref({ product: "CANCER", sex: "F", age: 30, sumAssured: 2_000_000 });
    expect(href).toBe("/studio/quote-video?product=CANCER&sex=F&age=30&sum=2000000");
    expect(videoStartFrom(Object.fromEntries(new URL(`https://x${href}`).searchParams))).toEqual({ product: "CANCER", sex: "F", age: 30, sumAssured: 2_000_000 });
    // only the page's own packages are read from an address
    expect(videoStartFrom({ product: "CANCER", sum: "600000" })).toEqual({ product: "CANCER" });
    const f = quoteVideoFacts({ ...PAGE, sumAssured: 5_000_000, hide: ["monthly"] })!;
    expect(f.prices.map((p) => p.label)).not.toContain("รายเดือน");
    expect(quoteVideoScript(f, "")[1].voice).toMatch(/^สำหรับคุณผู้ชายอายุ 40 ปี ออมปีแรก [\d,]+ บาท ตกวันละ \d+ บาท/);
  });
});
