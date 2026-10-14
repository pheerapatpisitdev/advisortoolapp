import { describe, expect, it } from "vitest";
import { plbModes, termAt } from "@/lib/plb-quote";
import { plbTable } from "@/lib/plb-table";
import { PLB_SUMS } from "@/lib/quote-pdf/pages";
import { fallbackLines, lineProblem, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { checkedPlb, plbVideoFacts, type PlbVideoInput } from "@/lib/quote-video/plb";
import { productQas } from "@/lib/quote-video/qa";
import { pageCaption, quoteVideoFacts, quoteVideoScript, sceneMotion } from "@/lib/quote-video/script";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the /plb page's own opening: a man of 35, 1 ล้าน, 12 years */
const PAGE: PlbVideoInput = { product: "PLB", age: 35, sex: "M", variant: "PLB12", sumAssured: 1_000_000 };
/** what the voice never says for Protection Life: no saving, no premium/death words, no waiting period, no "from today" */
const NEVER = /ออม|เบี้ย|เสียชีวิต|เงินคืน|ขอคืน|รอคอย|ระยะรอ|ทันที|ตั้งแต่วันนี้|ตั้งแต่วันแรก/;
const LENGTHS = ["short", "full", "long", "max"] as const;

describe("Protection Life in วิดีโอนำเสนอ", () => {
  it("states the page's own figures for ชาย 35, 1,000,000, 12 ปี", () => {
    const f = plbVideoFacts(PAGE)!;
    expect(f.product).toBe("PLB");
    expect(f.plb).toMatchObject({ annual: "5,470", perDay: "15", semi: "2,844.40", total: "65,640", endAge: 47, years: 12, sumShort: "1 ล้าน", tax: true });
    // monthly is under the company's minimum here, so it is not offered (as on the page)
    expect(f.plb?.monthly).toBeUndefined();
    expect(f.prices.map((p) => p.label)).toEqual(["รายปี", "ราย 6 เดือน"]);
    expect(f.prices[0]).toMatchObject({ amount: "5,470", main: true });
    expect(f.lead.baht).toBe(1_000_000);
    expect(f.coverToAge).toBe(47);
    expect(f.plb?.terms.map((r) => [r.years, r.endAge, r.on])).toEqual([[5, 40, false], [10, 45, false], [12, 47, true], [15, 50, false]]);
    // each term's yearly price is the page's own
    const t = plbTable();
    for (const r of f.plb!.terms) {
      const a = plbModes(t, termAt(t, `PLB${String(r.years).padStart(2, "0")}`), { sex: "M", age: 35, sumAssured: 1_000_000 })!.find((m) => m.mode === "annual")!;
      expect(r.annual).toBe(Math.floor(a.total / 100).toLocaleString("en-US"));
    }
  });

  it("speaks the mockup's lines", () => {
    const f = quoteVideoFacts(PAGE)!;
    const lines = quoteVideoScript(f, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "terms", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ คุณผู้ชายอายุ 35 ปี ทำทุน 1 ล้าน ถ้าเป็นอะไรไปในช่วง 12 ปีนี้ ครอบครัวได้เงินก้อน 1,000,000 บาทค่ะ");
    expect(lines[1].voice).toBe("ค่าใช้จ่ายแค่วันละ 15 บาท หรือปีละ 5,470 บาท เท่าเดิมทุกปีตลอด 12 ปีค่ะ");
    expect(lines[2].voice).toBe("คุ้มครองเต็ม 1,000,000 บาททุกปี ไปจนถึงอายุ 47 จ่ายกี่ปี ก็คุ้มครองเท่านั้นปีค่ะ");
    expect(lines[3].voice).toBe("ที่ชอบที่สุดคือ เลือกระยะได้ 5, 10, 12 หรือ 15 ปี อย่างแผนนี้ 12 ปี รวมจ่ายทั้งหมด 65,640 บาท แต่ครอบครัวได้ความคุ้มครองถึง 1 ล้าน แถมลดหย่อนภาษีได้ด้วยค่ะ");
    expect(lines[4].voice).toBe("สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
    expect(quoteVideoScript(f, "", "M")[1].voice).toContain("ครับ");
    expect(sceneMotion(f, "terms")).toEqual({ sweeps: 2, spread: true });
    expect(sceneMotion(f, "cover")).toEqual({ sweeps: 2, spread: true });
    expect(pageCaption(f)).toContain("Protection Life");
    expect(pageCaption(f)).not.toMatch(NEVER);
  });

  it("says tax relief only for the 10-, 12- and 15-year terms", () => {
    for (const variant of ["PLB05", "PLB10", "PLB12", "PLB15"] as const) {
      const f = quoteVideoFacts({ ...PAGE, variant })!;
      const taxed = variant !== "PLB05";
      expect(f.plb?.tax).toBe(taxed);
      const all = LENGTHS.flatMap((length) => quoteVideoScript(f, "", "F", length, { brief: { hook: "auto", story: storiesFor(f)[0].key } }));
      expect(all.some((l) => /ภาษี/.test(l.voice))).toBe(taxed);
      expect(pageCaption(f).includes("ภาษี")).toBe(taxed);
      expect(productQas("PLB", variant).some((q) => q.key === "tax")).toBe(taxed);
      expect(storiesFor(f).some((s) => s.key === "plbtax")).toBe(taxed);
      expect(extraOf(f, {}).qas.every((q) => q.key !== "tax" || taxed)).toBe(true);
    }
    const five = quoteVideoFacts({ ...PAGE, variant: "PLB05" as const })!;
    expect(lineProblem("ลดหย่อนภาษีได้ด้วยค่ะ", five, 150)).toMatch(/ภาษี/);
    expect(lineProblem("ลดหย่อนภาษีได้ด้วยค่ะ", quoteVideoFacts(PAGE)!, 150)).toBeNull();
  });

  it("never says the forbidden words, at any length, with any hook or story", () => {
    const inputs: PlbVideoInput[] = [PAGE, { ...PAGE, variant: "PLB05", age: 55 }, { ...PAGE, sumAssured: 5_000_000, sex: "F" }, { ...PAGE, sumAssured: 300_000 }];
    for (const input of inputs) {
      const f = quoteVideoFacts(input)!;
      for (const length of LENGTHS) {
        for (const l of quoteVideoScript(f, "สมชาย", "F", length)) expect(l.voice).not.toMatch(NEVER);
        for (const s of storiesFor(f)) {
          for (const hook of WRITTEN_HOOKS) {
            for (const loop of [false, true]) {
              for (const l of quoteVideoScript(f, "", "F", length, { brief: { hook, story: s.key, ...(loop ? { loop } : {}) } })) expect(l.voice).not.toMatch(NEVER);
            }
          }
        }
      }
      for (const q of productQas("PLB", input.variant)) expect(`${q.q} ${q.a}`).not.toMatch(NEVER);
    }
  });

  it("makes a 15-second clip of three scenes", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "สมชาย", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[0].voice).toBe("ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อน 1,000,000 บาทค่ะ");
    expect(short[1].voice).toBe("ค่าใช้จ่ายแค่วันละ 15 บาท คุ้มครอง 12 ปีค่ะ");
  });

  it("says the short sums as the page does", () => {
    expect(plbVideoFacts({ ...PAGE, sumAssured: 300_000 })!.plb?.sumShort).toBe("3 แสน");
    expect(plbVideoFacts({ ...PAGE, sumAssured: 1_500_000 })!.plb?.sumShort).toBe("1.5 ล้าน");
    const big = plbVideoFacts({ ...PAGE, sumAssured: 5_000_000 })!;
    expect(big.plb?.sumShort).toBe("5 ล้าน");
    // a big sum clears the monthly minimum: the page's headline instalment is the monthly one
    expect(big.prices.find((p) => p.main)?.label).toBe("รายเดือน");
  });

  it("picks the largest of the page's sums a budget buys, monthly only above the minimum", () => {
    const t = plbTable();
    const annual = (sum: number) => plbModes(t, termAt(t, "PLB12"), { sex: "M", age: 35, sumAssured: sum })!.find((m) => m.mode === "annual")!.total / 100;
    const yearly = resolveBudget(PAGE, { baht: Math.ceil(annual(2_000_000)), per: "year" });
    expect(typeof yearly !== "string" && yearly.product === "PLB" && yearly.sumAssured).toBe(2_000_000);
    const less = resolveBudget(PAGE, { baht: Math.ceil(annual(2_000_000)) - 1, per: "year" });
    expect(typeof less !== "string" && less.product === "PLB" && less.sumAssured).toBe(1_500_000);
    expect(resolveBudget(PAGE, { baht: 1_000, per: "year" })).toMatch(/ยังไม่พอ/);
    // the term chosen is kept
    const five = resolveBudget({ ...PAGE, variant: "PLB05" as const }, { baht: 20_000, per: "year" });
    expect(typeof five !== "string" && five.product === "PLB" && five.variant).toBe("PLB05");
    // a monthly budget only buys a sum the company takes monthly
    const monthly = resolveBudget(PAGE, { baht: 2_000, per: "month" });
    if (typeof monthly === "string") throw new Error(monthly);
    const f = quoteVideoFacts(monthly)!;
    expect(PLB_SUMS).toContain(monthly.product === "PLB" ? monthly.sumAssured : 0);
    expect(f.prices.some((p) => p.label === "รายเดือน")).toBe(true);
    expect(Number(f.budget?.amount.replace(/,/g, ""))).toBeLessThanOrEqual(2_000);
    expect(Number(f.budget?.amount.replace(/,/g, ""))).toBeGreaterThanOrEqual(t.minMonthly);
    expect(quoteVideoScript(f, "")[0].voice).toContain("ด้วยค่าใช้จ่ายเดือนละ");
    expect(resolveBudget(PAGE, { baht: 900, per: "month" })).toMatch(/ยังไม่พอ/);
  });

  it("refuses a term, an age or a sum the page does not offer", () => {
    expect(checkedPlb({ ...PAGE, age: 60 })).toMatch(/20–59/);
    expect(checkedPlb({ ...PAGE, sumAssured: 1_050_000 })).toMatch(/3 แสน/);
    expect(checkedPlb({ ...PAGE, variant: "PLB20" as never })).toMatch(/ระยะ/);
    expect(checkedPlb(PAGE)).toEqual(PAGE);
  });

  it("opens the Studio form from the /plb shortcut", () => {
    const href = videoStartHref({ product: "PLB", sex: "M", age: 35, sumAssured: 1_000_000, variant: "PLB12" });
    const q = Object.fromEntries(new URL(href, "https://x").searchParams);
    expect(videoStartFrom(q)).toEqual({ product: "PLB", sex: "M", age: 35, sumAssured: 1_000_000, variant: "PLB12" });
    expect(videoStartFrom({ product: "PLB", sum: "1050000", variant: "PLB20" })).toEqual({ product: "PLB" });
  });

  it("tells the longer clips with Protection Life's facts only", () => {
    const f = quoteVideoFacts(PAGE)!;
    const max = quoteVideoScript(f, "", "F", "max");
    expect(max.map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "terms", "versus", "qa", "steps", "contact"]);
    expect(extraVoice("versus", f, {})).toBe("ถ้าเก็บเงินเอง 12 ปี ก็มีเงิน 65,640 บาท แต่แผนนี้ ถ้าเป็นอะไรไปในช่วง 12 ปีนี้ ครอบครัวได้เงินก้อนถึง 1,000,000 บาทค่ะ");
    expect(extraOf(f, {}).versus.note).toBe("ความคุ้มครองล้วน ครบสัญญาไม่มีเงินคืน");
    expect(extraOf(f, {}).steps[2]).not.toMatch(/คุ้มครอง/);
    // every fixed line for a brief passes the same checks a written one must
    for (const g of [f, quoteVideoFacts({ ...PAGE, variant: "PLB05" as const, age: 59, sex: "F" as const, sumAssured: 300_000 })!, quoteVideoFacts({ ...PAGE, sumAssured: 5_000_000 })!]) {
      for (const s of storiesFor(g)) {
        for (const hook of WRITTEN_HOOKS) {
          const w = fallbackLines(g, { hook, story: s.key });
          expect(writtenProblems(w, g, { loop: false, story: true })).toEqual({});
          expect(writtenProblems(w, g, { loop: true, story: true })).toEqual({});
        }
      }
    }
    // a written line may not say ออม, money back, a waiting period, nor a figure the quote does not
    expect(lineProblem("ออมวันละ 15 บาท", f, 150)).toMatch(/ออม/);
    expect(lineProblem("ครบสัญญาได้เงินคืน", f, 150)).toMatch(/เงินคืน/);
    expect(lineProblem("ไม่มีระยะรอคอย", f, 150)).toMatch(/รอคอย/);
    expect(lineProblem("ครอบครัวได้ถึง 2,000,000 บาท", f, 150)).toMatch(/2,000,000/);
    expect(lineProblem("ค่าใช้จ่ายวันละ 15 บาท ครอบครัวได้ 1 ล้าน", f, 150)).toBeNull();
  });
});
