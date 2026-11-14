import { describe, expect, it } from "vitest";
import type { PayMode } from "@/calc/types";
import { pageCaption, quoteVideoFacts, quoteVideoScript, type QuoteVideoFacts, type VideoInput, type VideoLength } from "@/lib/quote-video/script";
import { fallbackLines, lineProblem } from "@/lib/quote-video/brief";
import { pickQas } from "@/lib/quote-video/qa";
import { storyFigure, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { knowEpisode } from "@/lib/quote-video/story-knowledge";

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14): a clip made by an agent who hid the monthly instalment never
 * shows or says a monthly premium; an agent who hid nothing gets exactly the clip as before.
 */

const day = new Date("2026-11-14T12:00:00+07:00");
const MONTHLY: PayMode[] = ["monthly"];
const BOTH: PayMode[] = ["semi", "monthly"];
const LENGTHS: VideoLength[] = ["short", "full", "long", "max"];

const INPUTS: VideoInput[] = [
  { product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 },
  { product: "ISHIELD", variant: "WLCI10", age: 35, sex: "F", sumAssured: 1_000_000 },
  { product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: ["SILVER", "PLATINUM"] },
  { product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: ["SILVER", "PLATINUM"], lang: "en" },
  { product: "PENSION", age: 40, sex: "M", annuityAge: 60, pay: "6", sumAssured: 1_000_000 },
  { product: "LEGACY", age: 30, sex: "F", tier: 1 },
  { product: "PLB", variant: "PLB10", age: 35, sex: "M", sumAssured: 1_000_000 } as VideoInput,
];

/** every word a clip shows or says that could carry a premium */
function everything(f: QuoteVideoFacts): string {
  const scripts = LENGTHS.map((l) => quoteVideoScript(f, "สมชาย", "F", l).map((s) => s.voice).join(" ")).join(" ");
  return [
    scripts, pageCaption(f), f.leadMark, f.priceMark ?? "", f.priceBig?.label ?? "", f.spokenPrice.per,
    ...f.prices.map((p) => p.label), ...f.priceNotes,
  ].join(" ");
}

/** "เดือนละ" a premium, never บำนาญ 95's own monthly pension ("บำนาญเดือนละ", "รับเดือนละ") */
const MONTHLY_PREMIUM = /(?<!บำนาญ|รับ)เดือนละ|รายเดือน|a month|в месяц|每月/;

describe("hide = monthly", () => {
  for (const v of INPUTS) {
    const name = `${v.product ?? "LIFEPROTECT"}${"lang" in v && v.lang ? ` ${v.lang}` : ""}`;
    it(`${name}: no monthly premium shown or said, the yearly one said`, () => {
      const plain = quoteVideoFacts(v, day);
      const f = quoteVideoFacts({ ...v, hide: MONTHLY }, day);
      expect(plain).toBeDefined();
      expect(f).toBeDefined();
      if (!f) return;
      expect(everything(f)).not.toMatch(MONTHLY_PREMIUM);
      expect(f.prices.some((p) => p.main)).toBe(true);
      expect(f.prices.some((p) => p.label === "รายเดือน" || p.per === "month")).toBe(false);
      if (f.spokenPrice.per !== "ปีละ") expect(f.spokenPrice.per).not.toBe("เดือนละ");
      expect(f.spokenPrice.amount).not.toMatch(/NaN|undefined/);
      expect(f.legacy?.monthly).toBeUndefined();
      expect(f.plb?.monthly).toBeUndefined();
      for (const c of f.compare ?? []) {
        expect(c.monthly).toBe("");
        expect(c.yearly).toMatch(/\d/);
      }
    });
  }

  it("iHealthy says and shows the first year's yearly price", () => {
    const f = quoteVideoFacts({ ...INPUTS[2], hide: MONTHLY }, day)!;
    const yearly = f.prices.find((p) => p.label === "รายปี")!;
    expect(f.spokenPrice).toEqual({ per: "ปีละ", amount: yearly.amount });
    expect(yearly.main).toBe(true);
    expect(f.leadMark).toBe(`เบี้ยปีแรก ปีละ ${yearly.amount} บาท`);
    expect(f.priceBig).toEqual({ label: "ปีแรก ปีละ", amount: yearly.amount, unit: "บาท" });
    expect(f.comparePer).toBe("year");
    const price = quoteVideoScript(f, "", "F", "full").find((s) => s.key === "price")!.voice;
    expect(price).toContain(`ปีแรกค่าใช้จ่ายปีละ ${yearly.amount} บาท`);
  });

  it("บำนาญ 95 still says its monthly pension, but saves yearly", () => {
    const f = quoteVideoFacts({ ...INPUTS[4], hide: MONTHLY }, day)!;
    const short = quoteVideoScript(f, "", "F", "short");
    expect(short.find((s) => s.key === "price")!.voice).toMatch(/^ออมปีละ /);
    expect(f.priceMark).toMatch(/^ปีละ /);
  });

  it("a budget in a month is not said, and nothing breaks", () => {
    const f = quoteVideoFacts({ ...INPUTS[0], budget: { baht: 3_000, per: "month" }, hide: MONTHLY }, day)!;
    expect(f.budget).toBeUndefined();
    expect(everything(f)).not.toMatch(MONTHLY_PREMIUM);
  });

  it("the 4-plan clip asked in monthly is priced yearly", () => {
    const f = quoteVideoFacts({ product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: [], allPlans: "monthly", hide: MONTHLY }, day)!;
    expect(f.allPlans?.mode).toBe("annual");
    expect(everything(f)).not.toMatch(MONTHLY_PREMIUM);
  });

  it("the fallback brief lines and the written-line check keep monthly out", () => {
    const f = quoteVideoFacts({ ...INPUTS[2], hide: MONTHLY }, day)!;
    const w = fallbackLines(f, { hook: "shock" } as never);
    expect(Object.values(w).join(" ")).not.toMatch(MONTHLY_PREMIUM);
    expect(lineProblem("จ่ายเดือนละนิดเดียวค่ะ", f, 200)).toMatch(/รายเดือน/);
    expect(lineProblem("จ่ายเดือนละนิดเดียวค่ะ", quoteVideoFacts(INPUTS[2], day)!, 200)).toBeNull();
  });

  it("the questions never ask about paying monthly", () => {
    expect(pickQas("LIFEPROTECT", "shortpay", undefined, MONTHLY).map((q) => q.key)).not.toContain("monthly");
    expect(pickQas("LIFEPROTECT", "shortpay").map((q) => q.key)).toContain("monthly");
  });
});

describe("hide = semi + monthly", () => {
  it("leaves the yearly row alone", () => {
    for (const v of [INPUTS[0], INPUTS[4], INPUTS[6]]) {
      const f = quoteVideoFacts({ ...v, hide: BOTH }, day)!;
      expect(f.prices.map((p) => p.label)).toEqual(["รายปี"]);
      expect(f.prices[0].main).toBe(true);
      expect(f.plb?.semi).toBeUndefined();
    }
  });
});

describe("nothing hidden", () => {
  it("is the clip as it was: an empty hide, or none, gives the same facts and lines", () => {
    for (const v of INPUTS) {
      const before = quoteVideoFacts(v, day)!;
      const after = quoteVideoFacts({ ...v, hide: [] }, day)!;
      expect(after).toEqual(before);
      expect(before.hide).toBeUndefined();
      for (const l of LENGTHS) expect(quoteVideoScript(after, "", "F", l)).toEqual(quoteVideoScript(before, "", "F", l));
    }
  });

  it("an unreadable hide hides nothing", () => {
    const v = INPUTS[2];
    expect(quoteVideoFacts({ ...v, hide: ["weekly"] as never }, day)).toEqual(quoteVideoFacts(v, day));
  });
});

describe("story clips", () => {
  const figure = storyFigure({ plan: "LIFEPROTECT", variant: "WLF19H", sex: "M", age: 35, sumAssured: 1_000_000 });
  const story = (topic: StoryVideoInput["topic"], hide?: PayMode[]) => ({
    product: "STORY", topic, style: "story", length: "full", palette: "reveal", narrator: "F",
    faces: { hero: "w15", narrator: "m03" }, ...(typeof figure === "object" ? { figure } : {}), ...(hide ? { hide } : {}),
  }) as StoryVideoInput;
  const said = (i: StoryVideoInput) => [
    ...storyScript(i).map((s) => s.voice),
    ...knowEpisode(i).scenes.map((s) => JSON.stringify(s.show)),
  ].join(" ");

  it("เบี้ยแพง and ทุน กับ เบี้ย say no monthly premium when it is hidden", () => {
    expect(typeof figure).toBe("object");
    for (const topic of ["pricey", "sumvspremium"] as const) {
      expect(said(story(topic))).toMatch(/รายเดือน|เดือนละ/);
      expect(said(story(topic, MONTHLY))).not.toMatch(/รายเดือน|เดือนละ/);
    }
  });
});
