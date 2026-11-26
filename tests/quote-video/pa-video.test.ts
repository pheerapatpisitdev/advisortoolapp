import { describe, expect, it } from "vitest";
import { allowedNumbers, fallbackLines, lineProblem, numbersIn, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { PA_NO_BUDGET, resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import { PA_CLASSES, PA_FAMILIES, paPerDay, paPremium, paSumAfterRenewals } from "@/lib/pa-plans";
import { carryFigure } from "@/lib/quote-video/carry";
import { checkedPa, PA_NAME, type PaVideoInput } from "@/lib/quote-video/pa";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { productQas } from "@/lib/quote-video/qa";
import { sayNumbers } from "@/lib/quote-video/say-numbers";
import { pageCaption, personOf, pricedByPlan, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { stageView } from "@/lib/quote-video/stage-views";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the mockup's example (owner, 2026-11-26, "pa"): PA Platinum 02, occupation class 1 — 8,000 a year, 22 a day */
const PAGE: PaVideoInput = { product: "PA", plan: "PAP02", cls: 1 };
/** never said: the words the voice keeps out, and nothing of an age or a sex the price does not depend on */
const NEVER = /เบี้ย|เสียชีวิต|ตาย|เวนคืน|ทันที|ภาษี|ออม|ผู้ชาย|ผู้หญิง|อายุ\s*\d/;
const LENGTHS = ["short", "full", "long", "max"] as const;
const PLANS = PA_FAMILIES.flatMap((family) => family.plans.map((plan) => ({ family, plan })));

describe("PA in วิดีโอนำเสนอ", () => {
  it("states the page's own figures, and names the plan and class where the others name the insured", () => {
    const f = quoteVideoFacts(PAGE)!;
    const g = f.pa!;
    expect(f.product).toBe("PA");
    expect(f.prices).toEqual([{ label: "รายปี", amount: "8,000", main: true }]);
    expect(g).toMatchObject({ family: "platinum", plan: "Platinum 02", code: "PAP02", cls: 1, annual: 8_000, perDay: 22, death: 2_000_000, murder: 1_000_000, motorcycle: 1_000_000, medical: 120_000, weekly: 2_000, weeks: 52, stepPercent: 5, maxPercent: 25 });
    // the header: the plan on the left, the class where an age and a sex would be; no face, no age
    expect(f.planLine).toBe("PA Platinum 02");
    expect(f.insuredWho).toBe("อาชีพชั้น 1");
    expect(f.sex).toBeUndefined();
    expect(pricedByPlan(f)).toBe(true);
    expect(pricedByPlan(quoteVideoFacts({ product: "CANCER", age: 40, sex: "M", sumAssured: 500_000 })!)).toBe(false);
    expect(f.lead).toEqual({ label: "คุ้มครองอุบัติเหตุ", amount: "2,000,000", baht: 2_000_000 });
    expect(f.leadMark).toBe("สัญญาปีต่อปี ต่ออายุทุกปี");
    expect(f.leadPill).toBe("อาชีพชั้น 1");
    expect(f.priceBig).toEqual({ label: "จ่ายปีละ", amount: "8,000", unit: "บาท" });
    expect(f.priceMark).toBe("ตกวันละ 22 บาท");
    expect(f.pills).toEqual(["ตกวันละ 22 บาท", "ราคาเท่ากันทุกอายุ"]);
    expect(f.contactLine).toBe("เดินทางทุกวัน มีไว้อุ่นใจ");
    // a one-year contract covers to no age: the cover scene carries nothing, the stairs their top
    expect(carryFigure("cover", f)).toBeNull();
    expect(carryFigure("critical", f)).toBe("ปีที่ 6 2,500,000 บาท");
    expect(carryFigure("price", f)).toBe("22 บาท/วัน");
  });

  it("draws the mockup's scenes of its own", () => {
    const f = quoteVideoFacts(PAGE)!;
    const cover = stageView("cover", f)!;
    expect(cover.kicker).toBe("คุ้มครองอะไรบ้าง");
    expect(cover.rows!.map((r) => [r.label, r.sub, r.amount, Boolean(r.on)])).toEqual([
      ["จากไป สูญเสียอวัยวะ", "หรือทุพพลภาพถาวรสิ้นเชิง", 2_000_000, true],
      ["ถูกฆาตกรรม ลอบทำร้าย", undefined, 1_000_000, false],
      ["ขับขี่ โดยสารมอเตอร์ไซค์", undefined, 1_000_000, false],
    ]);
    const injury = stageView("family", f)!;
    expect(injury.kicker).toBe("บาดเจ็บ หยุดงาน ก็ช่วย");
    expect(injury.rows!.map((r) => [r.label, r.sub, r.amount, Boolean(r.on)])).toEqual([
      ["ค่ารักษาต่ออุบัติเหตุ", "รวมมอเตอร์ไซค์", 120_000, true],
      ["ชดเชยหยุดงาน ต่อสัปดาห์", "ทุพพลภาพชั่วคราว สูงสุด 52 สัปดาห์", 2_000, false],
    ]);
    const stairs = stageView("critical", f)!;
    expect(stairs.kicker).toBe("ต่ออายุ ทุนโตทุกปี");
    expect(stairs.stairs!.map((s) => [s.label, s.amount])).toEqual([
      ["ปี 1", 2_000_000], ["ปี 2", 2_100_000], ["ปี 3", 2_200_000], ["ปี 4", 2_300_000], ["ปี 5", 2_400_000], ["ปี 6", 2_500_000],
    ]);
    expect(stairs.pills).toEqual(["เพิ่มปีละ 5% ของทุนเริ่มต้น สูงสุด 25%"]);
    // Classic: the medical sum said big, no weekly row; Max: no such scene
    const classic = stageView("family", quoteVideoFacts({ product: "PA", plan: "PAC04", cls: 3 })!)!;
    expect(classic).toMatchObject({ kicker: "บาดเจ็บ ก็ช่วยค่ารักษา", big: { amount: 80_000, unit: "บาท ต่อครั้ง" }, foot: "รวมอุบัติเหตุจากมอเตอร์ไซค์" });
    expect(classic.rows).toBeUndefined();
    expect(stageView("family", quoteVideoFacts({ product: "PA", plan: "PAM10", cls: 1 })!)).toBeUndefined();
    expect(stageView("lead", f)).toBeUndefined();
    expect(stageView("price", f)).toBeUndefined();
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "family", "critical", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ อุบัติเหตุไม่เลือกวัน PA Platinum 02 คุ้มครองอุบัติเหตุ ทุน 2 ล้านบาท ต่ออายุทุกปีค่ะ");
    expect(lines[1].voice).toBe("สำหรับอาชีพชั้น 1 จ่ายปีละ 8,000 บาท ตกวันละ 22 บาท ราคาเดียวกันทุกช่วงอายุค่ะ");
    expect(lines[2].voice).toBe("ถ้าอุบัติเหตุทำให้จากไป สูญเสียอวัยวะ หรือทุพพลภาพถาวร รับ 2 ล้านบาท กรณีถูกทำร้ายร่างกาย รับ 1 ล้านบาท ขับขี่หรือโดยสารมอเตอร์ไซค์ก็คุ้มครอง 1 ล้านบาทค่ะ");
    expect(lines[3].voice).toBe("บาดเจ็บจากอุบัติเหตุ รับค่ารักษาครั้งละ 120,000 บาท ถ้าต้องหยุดงานเพราะทุพพลภาพชั่วคราว รับสัปดาห์ละ 2,000 บาท สูงสุด 52 สัปดาห์ค่ะ");
    expect(lines[4].voice).toBe("ต่ออายุต่อเนื่อง ทุนเพิ่มปีละ 5% ของทุนเริ่มต้น ปีที่ 6 ทุนเป็น 2.5 ล้านบาทค่ะ");
    expect(lines[5].voice).toMatch(/^เดินทางทุกวัน มีไว้อุ่นใจค่ะ สนใจ ทักมาคุยกันได้เลยนะคะ/);
    // a man's endings; the plan's number read as a name, not a figure
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M").every((l) => !/ค่ะ|คะ/.test(l.voice))).toBe(true);
    expect(sayNumbers(lines[0].voice)).toContain("PA Platinum ศูนย์สอง");
    expect(sayNumbers(lines[0].voice)).toContain("ทุน สองล้านบาท");
    expect(sayNumbers("PA Max 10")).toBe("PA Max สิบ");
  });

  it("states every plan's figures, at every class it takes, and says nothing it should not", () => {
    for (const { family, plan } of PLANS) for (const cls of PA_CLASSES) {
      const at = `${plan.code} ${cls}`;
      const input: PaVideoInput = { product: "PA", plan: plan.code, cls };
      const premium = paPremium(plan, cls);
      // a class the plan does not take: no clip, and the form says which it does take
      if (premium === null) {
        expect(quoteVideoFacts(input), at).toBeUndefined();
        expect(checked(input), at).toMatch(new RegExp(`^${plan.name} รับขั้นอาชีพ [\\d, ]+ · ขั้น 4 ไม่รับทุกแบบ$`));
        continue;
      }
      const f = quoteVideoFacts(input)!;
      expect(f, at).toBeDefined();
      const g = f.pa!;
      // the page's own table
      expect(f.prices, at).toEqual([{ label: "รายปี", amount: premium.toLocaleString("en-US"), main: true }]);
      expect(g.perDay, at).toBe(paPerDay(premium));
      expect([g.death, g.murder, g.motorcycle, g.medical, g.weekly], at).toEqual([plan.death, plan.murder, plan.motorcycle, plan.medical, plan.weekly]);
      expect(f.planLine).toBe(`PA ${plan.name}`);
      expect(f.insuredWho).toBe(`อาชีพชั้น ${cls}`);
      expect(f.sex).toBeUndefined();
      // the stairs: 5% of the starting sum a year, to the page's year-6 sum
      expect(g.years.map((y) => y.sum), at).toEqual([0, 1, 2, 3, 4, 5].map((i) => plan.death + (plan.death * i) / 20));
      expect(g.years[5].sum, at).toBe(paSumAfterRenewals(plan));
      expect(stageView("critical", f)!.stairs!.map((s) => s.amount)).toEqual(g.years.map((y) => y.sum));
      // the scenes each family has: Max neither medical nor weekly, so five
      const lines = quoteVideoScript(f, "");
      const keys = lines.map((l) => l.key);
      if (family.id === "max") expect(keys, at).toEqual(["lead", "price", "cover", "critical", "contact"]);
      else expect(keys, at).toEqual(["lead", "price", "cover", "family", "critical", "contact"]);
      const injury = stageView("family", f);
      if (family.id === "platinum") expect(injury?.rows?.map((r) => r.amount), at).toEqual([plan.medical, plan.weekly]);
      if (family.id === "classic") expect(injury?.big?.amount, at).toBe(plan.medical);
      if (family.id === "max") expect(injury, at).toBeUndefined();
      // the voice's figures are the screen's
      const said = (k: string) => lines.find((l) => l.key === k)!.voice;
      expect(numbersIn(said("lead"))).toContain(plan.death);
      expect(numbersIn(said("price"))).toEqual(expect.arrayContaining([cls, premium, paPerDay(premium)]));
      expect(numbersIn(said("cover"))).toEqual(expect.arrayContaining([plan.death, plan.murder, plan.motorcycle]));
      if (plan.medical) expect(numbersIn(said("family"))).toContain(plan.medical);
      if (plan.weekly) expect(numbersIn(said("family"))).toEqual(expect.arrayContaining([plan.weekly, 52]));
      expect(numbersIn(said("critical"))).toContain(paSumAfterRenewals(plan));
      // every length, a woman's and a man's: only the quote's figures, none of the words kept out
      const allowed = allowedNumbers(f);
      for (const length of LENGTHS) for (const narrator of ["F", "M"] as const) for (const l of quoteVideoScript(f, "", narrator, length)) {
        expect(l.voice, `${at} ${length} ${l.key}`).not.toMatch(NEVER);
        for (const n of numbersIn(l.voice)) expect(allowed.has(n), `${at} ${length} ${l.key}: ${n}`).toBe(true);
      }
      expect(extraOf(f, {}).versus.right.amount).toBe(plan.death.toLocaleString("en-US"));
      expect(pageCaption(f)).not.toMatch(/ชาย|หญิง|อายุ\s*\d/);
    }
  });

  it("tells the other lengths", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[0].voice).toBe("อุบัติเหตุไม่เลือกวัน คุ้มครองอุบัติเหตุ ทุน 2 ล้านบาท ต่ออายุทุกปีค่ะ");
    expect(short[1].voice).toBe("ตกวันละ 22 บาท ราคาเท่ากันทุกอายุค่ะ");
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "family", "critical", "versus", "qa", "steps", "contact"]);
    const max = quoteVideoFacts({ product: "PA", plan: "PAM10", cls: 1 })!;
    expect(quoteVideoScript(max, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "critical", "versus", "qa", "steps", "contact"]);
    expect(extraVoice("versus", f, {})).toBe("ถ้าเก็บเงินเองปีละ 8,000 บาท ก็มีเงินแค่นั้น แต่แผนนี้ ถ้าเกิดอุบัติเหตุร้ายแรง รับสูงสุดถึง 2,000,000 บาทค่ะ");
    // a named customer is greeted; still no age
    expect(quoteVideoScript(f, "สมชาย")[0].voice).toMatch(/^สวัสดีค่ะ คุณสมชาย อุบัติเหตุไม่เลือกวัน/);
    expect(pageCaption(f)).toContain("PA Platinum 02");
    expect(pageCaption(f)).toContain("อาชีพชั้น 1 จ่ายปีละ 8,000 บาท (ตกวันละ 22 บาท)");
    for (const q of productQas("PA")) expect(`${q.q} ${q.a}`).not.toMatch(/เบี้ย|เสียชีวิต|ตาย|เวนคืน|ทันที|ภาษี|%/);
  });

  it("has fixed lines that pass its own checks, in every family", () => {
    for (const code of ["PAC04", "PAP05", "PAM10", "PAM01"]) {
      const f = quoteVideoFacts({ product: "PA", plan: code, cls: 1 })!;
      expect(storiesFor(f).length, code).toBeGreaterThanOrEqual(2);
      for (const s of storiesFor(f)) for (const hook of WRITTEN_HOOKS) {
        expect(writtenProblems(fallbackLines(f, { hook, story: s.key }), f, { loop: false, story: true }), `${code} ${s.key} ${hook}`).toEqual({});
      }
      // what an agent's own line may not say of a plan priced by plan alone
      expect(lineProblem("ผู้ชายอายุ 35 จ่ายแค่นี้", f, 150)).toMatch(/เพศหรืออายุ/);
      expect(lineProblem("ออมวันละนิดเดียว", f, 150)).toMatch(/ออม/);
      expect(lineProblem("คุ้มครองถึงอายุ 64", f, 150)).toMatch(/ปีต่อปี/);
    }
    // the injury story only where the plan pays for an injury
    expect(storiesFor(quoteVideoFacts({ product: "PA", plan: "PAM10", cls: 1 })!).map((s) => s.key)).not.toContain("painjury");
  });

  it("checks what the form sent: no age, no sex, a class the plan takes, no budget", () => {
    expect(checked({ ...PAGE })).toMatchObject({ product: "PA", plan: "PAP02", cls: 1 });
    const c = checked({ ...PAGE }) as PaVideoInput;
    expect("age" in c || "sex" in c).toBe(false);
    expect(personOf(c)).toBeUndefined();
    expect(personOf({ product: "CANCER", age: 40, sex: "M", sumAssured: 500_000 })).toEqual({ age: 40, sex: "M" });
    expect(checked({ ...PAGE, cls: 3 })).toBe("Platinum 02 รับขั้นอาชีพ 1, 2 · ขั้น 4 ไม่รับทุกแบบ");
    expect(checked({ product: "PA", plan: "PAC05", cls: 3 })).toBe("Classic B รับขั้นอาชีพ 1, 2 · ขั้น 4 ไม่รับทุกแบบ");
    expect(checked({ product: "PA", plan: "PAC04", cls: 4 })).toBe("Classic A รับขั้นอาชีพ 1, 2, 3 · ขั้น 4 ไม่รับทุกแบบ");
    expect(checked({ product: "PA", plan: "PAX99", cls: 1 })).toBe("เลือกแผน PA");
    expect(checkedPa({ product: "PA", plan: "PAP02", cls: 1.5 })).toMatch(/รับขั้นอาชีพ/);
    // the form offers no budget for PA; an older tab's is refused, not worked out
    expect(checked({ ...PAGE, budget: { baht: 10_000, per: "year" } })).toBe(PA_NO_BUDGET);
    expect(resolveBudget(PAGE, { baht: 10_000, per: "year" })).toBe(PA_NO_BUDGET);
    expect(PA_NAME).toBe("PA อุบัติเหตุ");
  });

  it("opens from the page with its plan and class", () => {
    const href = videoStartHref({ product: "PA", plan: "PAP05", cls: 2 });
    expect(href).toBe("/studio/quote-video?product=PA&plan=PAP05&cls=2");
    expect(videoStartFrom(Object.fromEntries(new URL(`https://x${href}`).searchParams))).toEqual({ product: "PA", plan: "PAP05", cls: 2 });
    for (const { plan } of PLANS) {
      const back = videoStartFrom(Object.fromEntries(new URL(`https://x${videoStartHref({ product: "PA", plan: plan.code, cls: 1 })}`).searchParams));
      expect(back).toEqual({ product: "PA", plan: plan.code, cls: 1 });
    }
    // only the page's own plans and classes are read from an address
    expect(videoStartFrom({ product: "PA", plan: "PAX99", cls: "1" })).toEqual({ product: "PA", cls: 1 });
    expect(videoStartFrom({ product: "PA", plan: "PAP02", cls: "7" })).toEqual({ product: "PA", plan: "PAP02" });
    // the class is PA's only: another plan's address keeps none
    expect(videoStartFrom({ product: "CANCER", cls: "1" })).toEqual({ product: "CANCER" });
    // an agent who hid the monthly instalment changes nothing: PA is priced by the year only
    expect(quoteVideoFacts({ ...PAGE, hide: ["monthly", "semi"] })!.prices).toEqual([{ label: "รายปี", amount: "8,000", main: true }]);
  });
});
