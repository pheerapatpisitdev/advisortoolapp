import { describe, expect, it } from "vitest";
import { deathBenefitRows } from "@/lib/death-benefit";
import { legacyTable } from "@/lib/legacy-table";
import { fallbackLines, lineProblem, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checkedLegacy, legacyBands, legacyVideoFacts, type LegacyVideoInput } from "@/lib/quote-video/legacy";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { pageCaption, quoteVideoFacts, quoteVideoScript, sceneMotion } from "@/lib/quote-video/script";
import { extraVoice } from "@/lib/quote-video/told";
import { productQas } from "@/lib/quote-video/qa";

/** the /legacy page's own opening: a woman of 30 on the smallest legacy */
const PAGE: LegacyVideoInput = { product: "LEGACY", age: 30, sex: "F", tier: 1 };
const NEVER = /ออม|เบี้ย|เสียชีวิต/;

describe("มรดกเพื่อครอบครัว in วิดีโอนำเสนอ", () => {
  it("states the page's own figures for หญิง 30, มรดก 1 ล้าน", () => {
    const f = legacyVideoFacts(PAGE)!;
    expect(f.product).toBe("LEGACY");
    expect(f.legacy?.annual).toBe("4,123");
    expect(f.legacy?.perDay).toBe("12");
    expect(f.legacy?.bands.map((b) => b.amount)).toEqual([1_150_000, 1_000_000, 150_000]);
    expect(f.legacy?.bands.map((b) => [b.from, b.to])).toEqual([[30, 59], [60, 74], [75, 99]]);
    expect(f.legacy?.critical).toBe(850_000);
    expect(f.legacy?.diseaseCount).toBe(31);
    expect(f.lead.baht).toBe(1_150_000);
    // the same amounts the page lists under "ครอบครัวได้รับเมื่อเสียชีวิต"
    const t = legacyTable();
    expect(f.legacy?.bands.map((b) => b.amount)).toEqual(deathBenefitRows(t.death[0].under).map((r) => r.amount));
    // the monthly instalment is under the company's minimum here, so it is not offered (as on the page)
    expect(f.prices.map((p) => p.label)).toEqual(["รายปี", "ราย 6 เดือน"]);
    expect(f.prices[0]).toMatchObject({ amount: "4,123", main: true });
  });

  it("speaks the mockup's lines, never ออม, เบี้ย or เสียชีวิต", () => {
    const f = quoteVideoFacts(PAGE)!;
    const lines = quoteVideoScript(f, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "critical", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ คุณผู้หญิงอายุ 30 ปี ทำมรดก 1 ล้าน ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้เงินก้อนถึง 1,150,000 บาทค่ะ");
    expect(lines[1].voice).toBe("ค่าใช้จ่ายปีแรกแค่วันละ 12 บาท หรือปีละ 4,123 บาทค่ะ ส่วนคุ้มครองโรคร้ายแรงจะปรับตามอายุในปีถัดไปนะคะ");
    expect(lines[2].voice).toBe("ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้ 1,150,000 บาท อายุ 60 ถึง 74 ได้ 1,000,000 บาท และยังดูแลต่อไปถึงอายุ 99 ค่ะ");
    expect(lines[3].voice).toBe("ที่ชอบที่สุดคือ ถ้าตรวจพบโรคร้ายแรง 1 ใน 31 โรค รับเงินก้อนไว้รักษาตัวเอง 850,000 บาท แล้วประกันชีวิตหลักยังอยู่ต่อให้ครอบครัวค่ะ");
    for (const length of ["short", "full", "long", "max"] as const) {
      for (const l of quoteVideoScript(f, "", "F", length)) expect(l.voice).not.toMatch(NEVER);
    }
    expect(quoteVideoScript(f, "", "M")[1].voice).toContain("ครับ");
    expect(sceneMotion(f, "critical")).toEqual({ count: true, sweeps: 1 });
    expect(pageCaption(f)).toContain("มรดก 1 ล้าน");
    expect(pageCaption(f)).not.toMatch(NEVER);
  });

  it("makes a 15-second clip of three scenes", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "สมชาย", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[0].voice).toBe("ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 1,150,000 บาทค่ะ");
    expect(short[1].voice).toBe("ค่าใช้จ่ายปีแรกแค่วันละ 12 บาท คุ้มครองถึงอายุ 99 ค่ะ");
  });

  it("drops the bands an older insured has passed", () => {
    const f = legacyVideoFacts({ ...PAGE, age: 62 })!;
    expect(f.legacy?.bands.map((b) => [b.from, b.to])).toEqual([[62, 74], [75, 99]]);
    const cover = quoteVideoScript(f, "").find((l) => l.key === "cover")!;
    expect(cover.voice).toMatch(/^ถ้าเป็นอะไรไปก่อนอายุ 75 ครอบครัวได้ 1,000,000 บาท และยังดูแลต่อไปถึงอายุ 99/);
    expect(legacyBands({ beforeAge: 60, sumBefore: 2, sumFrom: 1, alreadyPastAge: false }, 30, 99)).toEqual([
      { from: 30, to: 59, amount: 2 }, { from: 60, to: 99, amount: 1 },
    ]);
  });

  it("picks the largest legacy a budget buys, monthly only above the minimum", () => {
    const t = legacyTable();
    const annual = (tier: number) => Math.floor(t.premiums.F[tier - 1][30 - t.ageMin]![0] / 100);
    const yearly = resolveBudget(PAGE, { baht: annual(3), per: "year" });
    expect(typeof yearly !== "string" && yearly.product === "LEGACY" && yearly.tier).toBe(3);
    const less = resolveBudget(PAGE, { baht: annual(3) - 1, per: "year" });
    expect(typeof less !== "string" && less.product === "LEGACY" && less.tier).toBe(2);
    expect(resolveBudget(PAGE, { baht: 1_000, per: "year" })).toMatch(/ยังไม่พอ/);
    // a monthly budget only buys a tier the company takes monthly
    const monthly = resolveBudget(PAGE, { baht: 5_000, per: "month" });
    if (typeof monthly === "string") throw new Error(monthly);
    const f = quoteVideoFacts(monthly)!;
    expect(f.prices.some((p) => p.label === "รายเดือน")).toBe(true);
    expect(Number(f.budget?.amount.replace(/,/g, ""))).toBeLessThanOrEqual(5_000);
    expect(Number(f.budget?.amount.replace(/,/g, ""))).toBeGreaterThanOrEqual(t.minMonthlyTotal);
    expect(quoteVideoScript(f, "")[0].voice).toContain("ด้วยค่าใช้จ่ายเดือนละ");
    expect(resolveBudget(PAGE, { baht: 900, per: "month" })).toMatch(/ยังไม่พอ/);
  });

  it("refuses an age or a tier the bundle does not take", () => {
    expect(checkedLegacy({ ...PAGE, age: 66 })).toMatch(/20–65/);
    expect(checkedLegacy({ ...PAGE, tier: 11 })).toMatch(/1–10/);
    expect(checkedLegacy(PAGE)).toEqual(PAGE);
  });

  it("opens the Studio form from the /legacy shortcut", () => {
    const href = videoStartHref({ product: "LEGACY", sex: "F", age: 30, tier: 4 });
    const q = Object.fromEntries(new URL(href, "https://x").searchParams);
    expect(videoStartFrom(q)).toEqual({ product: "LEGACY", sex: "F", age: 30, tier: 4 });
    expect(videoStartFrom({ product: "LEGACY", tier: "11" })).toEqual({ product: "LEGACY" });
  });

  it("tells the longer clips with มรดก's facts only", () => {
    const f = quoteVideoFacts(PAGE)!;
    const max = quoteVideoScript(f, "", "F", "max");
    expect(max.map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "critical", "versus", "qa", "steps", "contact"]);
    expect(extraVoice("versus", f, {})).toContain("1,150,000 บาทค่ะ");
    for (const q of productQas("LEGACY")) expect(`${q.q} ${q.a}`).not.toMatch(NEVER);
    // every fixed line for a brief passes the same checks a written one must
    for (const g of [f, quoteVideoFacts({ ...PAGE, tier: 10, age: 65, sex: "M" })!]) {
      for (const hook of WRITTEN_HOOKS) {
        const w = fallbackLines(g, { hook, story: "family" });
        expect(writtenProblems(w, g, { loop: false, story: true })).toEqual({});
        expect(writtenProblems(w, g, { loop: true, story: true })).toEqual({});
      }
    }
    // a written line may not say ออม, nor a figure the quote does not
    expect(lineProblem("ออมวันละ 12 บาท", f, 150)).toMatch(/ออม/);
    expect(lineProblem("ครอบครัวได้ถึง 2,000,000 บาท", f, 150)).toMatch(/2,000,000/);
    expect(lineProblem("ตรวจพบโรคร้ายแรง รับเงินก้อน 850,000 บาท", f, 150)).toBeNull();
  });
});
