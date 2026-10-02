import { describe, expect, it } from "vitest";
import { strayNumbers } from "@/lib/content/check";
import { numbersBody, numbersPoster, numbersYardstick } from "@/lib/content/numbers";
import { NUMBERS_PLANS, numberSheets } from "@/lib/content/numbers-plans";
import { MAX_CHARS } from "@/lib/content/poster";
import { CONTENT_PRODUCTS } from "@/lib/content/products";

const today = new Date("2026-09-24T12:00:00+07:00");
const RISING = ["/legacy", "/ci123", "/cancer", "/ihealthy-ultra"];

describe("every plan's number sheets", () => {
  it("covers every content plan", () => {
    expect(Object.keys(NUMBERS_PLANS).sort()).toEqual(CONTENT_PRODUCTS.map((p) => p.href).sort());
  });

  for (const href of Object.keys(NUMBERS_PLANS)) {
    describe(href, () => {
      const plan = NUMBERS_PLANS[href];
      it("prices all three people today", () => {
        for (let i = 0; i < plan.caseCount; i++) expect(plan.price(i, plan.claims.slice(0, 2), today)).not.toBeNull();
      });
      it("writes only figures it hands the number check, within the poster's limits", () => {
        for (const s of numberSheets(href, 3, today)) {
          expect(strayNumbers(`${numbersBody(s)}\n${s.poster.big}\n${s.poster.small}`, numbersYardstick([s]))).toEqual([]);
          for (const b of numbersPoster(s).blocks) expect(b.text.length).toBeLessThanOrEqual(MAX_CHARS[b.kind]);
        }
      });
      it("leaves no placeholder unfilled", () => {
        for (const s of numberSheets(href, 3, today)) expect(numbersBody(s)).not.toMatch(/[{}]/);
      });
      it(RISING.includes(href) ? "says เบี้ยปีแรก, its premium rises with age" : "says a level premium plainly", () => {
        for (const s of numberSheets(href, 3, today)) {
          // no premium line under the monthly floor: the day figure leads alone
          if (s.premiumLine) expect(s.premiumLine.startsWith("เบี้ยปีแรก")).toBe(RISING.includes(href));
          expect(s.perDayLine.startsWith("ปีแรก")).toBe(RISING.includes(href));
        }
      });
      it("says a month's premium or a day's, never a year's, and ตลอดชีพ for cover to 99 (owner, 2026-09-25)", () => {
        for (const s of numberSheets(href, 3, today)) {
          const all = [numbersBody(s), ...numbersPoster(s).blocks.map((b) => b.text)].join("\n");
          // a premium by the year; a health plan's วงเงินปีละ is its limit, not what it costs
          expect(all).not.toMatch(/เบี้ย(?:ปีแรก)?\s*[\d,]+\s*บาท\s*(?:ต่อปี|\/ปี)|เบี้ย(?:ปีแรก)?ปีละ/);
          expect(all).not.toMatch(/(?<![\d,.])99(?![\d,])/);
        }
      });
    });
  }
});

describe("figures that match each sales page", () => {
  const first = (href: string) => numberSheets(href, 3, today);
  it("Protection Life: ชาย 35 ทุน 1 ล้าน 10 ปี = 5,130 บาท/ปี, said as 15 a day", () => {
    const [s] = first("/plb");
    expect(s.premiumLine).toBe("");
    expect(s.perDayLine).toBe("ตกวันละ 15 บาท");
    expect(s.poster.big).toBe("ตกวันละ 15 บาท");
    // the small line does not say the day figure a second time
    expect(numbersPoster(s).blocks.find((b) => b.kind === "sub")?.text).toBe("ทุน 1,000,000 บาท");
  });
  it("Easy Protect 6: ชาย 35 ทุน 5 แสน = 3,060 บาท/เดือน", () => {
    expect(first("/easyprotect")[0].premiumLine).toBe("เบี้ย 3,060 บาท ต่อเดือน");
  });
  it("Life Treasure: ชาย 45 ทุน 10 ล้าน 12 ปี = 42,750 บาท/เดือน", () => {
    expect(first("/lifetreasure")[0].premiumLine).toBe("เบี้ย 42,750 บาท ต่อเดือน");
  });
  it("Family Legacy: a critical illness pays 850,000 and a death before 60 1,150,000 on the 1-million plan", () => {
    const all = first("/legacy").flatMap((s) => s.claims).join("\n");
    expect(all).toContain("ป่วยโรคร้ายแรงรับเงินสด 850,000 บาท");
    expect(all).toContain("เสียชีวิตก่อน 60 รับ 1,150,000 บาท");
  });
  it("iShield: ชาย 35 ทุน 1 ล้าน 10 ปี = 6,028 บาท/เดือน", () => {
    expect(first("/ishield")[0].premiumLine).toBe("เบี้ย 6,028 บาท ต่อเดือน");
  });
  it("CI 123: หญิง 30 ทุน 5 แสน = เบี้ยปีแรก 3,613", () => {
    expect(first("/ci123")[0].premiumLine).toBe("");
    expect(first("/ci123")[0].perDayLine).toBe("ปีแรกตกวันละ 10 บาท");
  });
  it("Cancer: หญิง 30 ทุน 3 แสน = เบี้ยปีแรก 2,176", () => {
    expect(first("/cancer")[0].premiumLine).toBe("");
    expect(first("/cancer")[0].perDayLine).toBe("ปีแรกตกวันละ 6 บาท");
  });
  it("iHealthy: the package's yearly limit leads", () => {
    expect(first("/ihealthy-ultra")[0].sumLine).toBe("ประกันสุขภาพวงเงินค่ารักษาปีละ 3,000,000 บาท");
  });
  it("Pension: ชาย 40 เดือนละ 10,000 from 60 — 136,220.54 a year, so 374 a day", () => {
    const [s] = first("/bumnan95");
    expect(s.sumLine).toBe("บำนาญเดือนละ 10,000 บาท");
    expect(s.perDayLine).toBe("ตกวันละ 374 บาท");
  });
});

const numbersIn = (t: string) => (t.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, "")));

describe("English number sheets", () => {
  it("prices iHealthy Ultra in English with the same figures", () => {
    const th = numberSheets("/ihealthy-ultra", 3, today);
    const en = numberSheets("/ihealthy-ultra", 3, today, "en");
    expect(en).toHaveLength(th.length);
    for (const [i, s] of en.entries()) {
      expect(numbersIn(numbersBody(s))).toEqual(expect.arrayContaining(numbersIn(numbersBody(th[i])).filter((n) => n >= 100)));
      expect(`${numbersBody(s)}\n${s.poster.big}\n${s.poster.small}`).not.toMatch(/[\u0E00-\u0E7F]/);
    }
    expect(numberSheets("/lifeprotect", 1, today, "en")).toEqual([]);
  });
});
