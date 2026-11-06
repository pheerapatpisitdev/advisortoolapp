import { describe, it, expect } from "vitest";
import {
  availablePensionAges, pensionTax, quotePension, PENSION_AGES,
  type PensionBasis, type PensionInput, type PensionPay,
} from "@/calc/pension/engine";
import mainOracle from "./pension/main-premiums.json";
import illustrationOracle from "./pension/illustration.json";
import advisorZoneMonthly from "./pension/advisorzone-monthly.json";
import ridersJson from "../../data/pension/riders.json";
import lifeprotectRates from "../../data/rates/lifeprotect.json";
import { premiumBasedRiderPremium } from "@/calc/riders/premium-based";
import type { PlanRates } from "@/calc/types";

/**
 * บำนาญ สมาร์ท 95 against the company workbook.
 *
 * Both oracles are the source calculator's (Advisortool/pension-smart95/test/oracle): the
 * workbook recomputed in LibreOffice for each case. Its verify script is what these replace,
 * with the same tolerances.
 */

interface OracleCase {
  case: { age: number; gender: string; annuityAge: number; payOption: string; inputType: string; amount: number; mode?: string };
  rate: number;
  SA: number;
  mainMode: number;
}

const BASIS: Record<string, PensionBasis> = {
  "จำนวนเงินเอาประกันภัย": "sumAssured",
  "เบี้ยประกันภัย": "premium",
  "เงินบำนาญรายเดือน": "monthlyPension",
};

function inputOf(c: OracleCase["case"]): PensionInput {
  return {
    age: c.age,
    sex: c.gender === "ชาย" ? "M" : "F",
    annuityAge: c.annuityAge,
    pay: (c.payOption === "ชำระเบี้ย 6 ปี" ? "6" : "untilAnnuity") as PensionPay,
    mode: c.mode === "รายเดือน" ? "monthly" : "annual",
    basis: BASIS[c.inputType],
    amount: c.amount,
  };
}

describe("บำนาญ สมาร์ท 95 main premium, case by case against the workbook", () => {
  for (const o of Object.values(mainOracle as Record<string, OracleCase>)) {
    it(JSON.stringify(o.case), () => {
      const r = quotePension(inputOf(o.case));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Math.abs(r.quote.sumAssured - o.SA)).toBeLessThanOrEqual(2);
      expect(r.quote.rate).toBeCloseTo(o.rate, 2);
      expect(Math.abs(r.quote.modePremium - o.mainMode)).toBeLessThanOrEqual(0.02);
    });
  }
});

describe("the yearly table, man of 40, pension at 70, sum assured 100,000", () => {
  const r = quotePension({ age: 40, sex: "M", annuityAge: 70, pay: "untilAnnuity", mode: "annual", basis: "sumAssured", amount: 100_000 });
  if (!r.ok) throw new Error(r.error);
  const byAge = new Map(r.quote.illustration.map((y) => [y.age, y]));

  for (const o of illustrationOracle as Record<string, number>[]) {
    it(`age ${o.age}`, () => {
      const y = byAge.get(o.age)!;
      const death = o.age < 70 ? o.death : o.deathDuring;
      const pairs: [number, number | undefined][] = [
        [y.premium, o.prem], [y.cumPremium, o.cumPrem], [y.cashValue, o.cv], [y.pension, o.pension], [y.deathBenefit, death],
      ];
      for (const [got, want] of pairs) {
        if (want != null) expect(Math.abs(got - want)).toBeLessThanOrEqual(1.5);
      }
    });
  }

  it("pays 15% of the sum a year until 75 and 30% from 86", () => {
    expect(r.quote.bands).toEqual([
      { fromAge: 70, toAge: 75, percent: 0.15, annual: 15_000 },
      { fromAge: 76, toAge: 80, percent: 0.2, annual: 20_000 },
      { fromAge: 81, toAge: 85, percent: 0.25, annual: 25_000 },
      { fromAge: 86, toAge: 95, percent: 0.3, annual: 30_000 },
    ]);
    expect(r.quote.monthlyPension).toBe(1_270);
  });
});

describe("paid by the month, against the company's AdvisorZone quotation (man of 40, pension at 55)", () => {
  const r = quotePension({ age: 40, sex: "M", annuityAge: 55, pay: "untilAnnuity", mode: "monthly", basis: "premium", amount: 2_000 });
  if (!r.ok) throw new Error(r.error);
  const q = r.quote;
  const byAge = new Map(q.illustration.map((y) => [y.age, y]));

  it("lands on the same sum and instalment", () => {
    expect(q.sumAssured).toBe(advisorZoneMonthly.sumAssured);
    expect(q.modePremium).toBe(advisorZoneMonthly.modePremium);
    expect(q.yearlyPaid).toBe(24_000.12);
    expect(q.totalYearlyPaid).toBe(24_000.12);
  });

  it("gives the sheet's IRR, the year's premiums counted at the start of the year", () => {
    expect(Number(((q.irr ?? 0) * 100).toFixed(2))).toBe(advisorZoneMonthly.irrPercent);
  });

  for (const o of advisorZoneMonthly.rows) {
    it(`age ${o.age}`, () => {
      const y = byAge.get(o.age)!;
      expect(y.policyYear).toBe(o.year);
      for (const [ours, theirs] of [
        [y.premium, o.premium], [y.cumPremium, o.cumPremium], [y.cashValue, o.cashValue],
        [y.pension, o.pension], [y.cumPension, o.cumPension], [y.deathBenefit, o.death],
      ]) expect(Math.abs(ours - theirs)).toBeLessThanOrEqual(0.011);
    });
  }
});

describe("the other instalments, by the same arithmetic", () => {
  const at = (mode: PensionInput["mode"]) => {
    const r = quotePension({ age: 40, sex: "M", annuityAge: 55, pay: "untilAnnuity", mode, basis: "sumAssured", amount: 81_700 });
    if (!r.ok) throw new Error(r.error);
    return r.quote;
  };

  it("adds up the instalments of a year; paying yearly stays as it was", () => {
    expect(at("annual").yearlyPaid).toBe(22_222.4);
    expect(at("annual").totalPremium).toBeCloseTo(333_336, 2);
    expect(at("semi").yearlyPaid).toBe(23_111.28);
  });

  it("leaves what the rate table prices alone", () => {
    for (const mode of ["semi", "monthly"] as const) {
      expect(at(mode).annualPremium).toBe(22_222.4);
      expect(at(mode).illustration.map((y) => y.cashValue)).toEqual(at("annual").illustration.map((y) => y.cashValue));
    }
  });
});

describe("the tax sheet", () => {
  it("matches คำนวณภาษี F29 and F33", () => {
    const t = pensionTax({
      income: 100_000, retirementFunds: 10_000 + 123_123 + 456 + 123,
      lifePremiums: 50_000, annuityPremiums: 11_111, marginalRate: 0.1,
    });
    expect(t.maxPremium).toBeCloseTo(53_889, 2);
    expect(t.taxSaved).toBeCloseTo(5_388.9, 2);
  });
});

describe("what it refuses", () => {
  const base: PensionInput = { age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "sumAssured", amount: 1_000_000 };

  it("a pension age the person is already too old for", () => {
    const r = quotePension({ ...base, age: 50, annuityAge: 55 });
    expect(r.ok).toBe(false);
  });

  it("sums outside 75,000–20,000,000", () => {
    expect(quotePension({ ...base, amount: 50_000 }).ok).toBe(false);
    expect(quotePension({ ...base, amount: 25_000_000 }).ok).toBe(false);
  });

  it("prices every age each plan accepts, on both paying terms and every mode", () => {
    let priced = 0;
    for (const pay of ["6", "untilAnnuity"] as const) {
      for (let age = 20; age <= 65; age++) {
        for (const annuityAge of availablePensionAges(age, pay)) {
          for (const mode of ["annual", "monthly"] as const) {
            const r = quotePension({ ...base, age, pay, annuityAge, mode, amount: 100_000 });
            expect(r.ok, `${pay} ${age} ${annuityAge}`).toBe(true);
            if (r.ok) expect(r.quote.modePremium).toBeGreaterThan(0);
            priced++;
          }
        }
      }
    }
    expect(priced).toBeGreaterThan(300);
    expect(PENSION_AGES.every((a) => availablePensionAges(20, "6").includes(a))).toBe(true);
  });
});

describe("the three riders", () => {
  const at40: PensionInput = { age: 40, sex: "M", annuityAge: 70, pay: "untilAnnuity", mode: "annual", basis: "sumAssured", amount: 100_000 };

  it("DCI matches the workbook's Cal!G20 (man of 40, cover 500,000)", () => {
    const r = quotePension({ ...at40, riders: { dci: { sumAssured: 500_000 } } });
    if (!r.ok) throw new Error(r.error);
    expect(r.quote.riders[0]).toMatchObject({ code: "DCI", rate: 5.52, annual: 2_760 });
  });

  it("uses the very tables the app's other plans are verified on", () => {
    const own = ridersJson as { WP: Record<string, Record<string, number>>; PB: Record<string, Record<string, number>>; DCI: Record<string, Record<string, number>> };
    const lp = lifeprotectRates.riders as unknown as Record<string, { rates: Record<string, Record<string, Record<string, Record<string, number>> | Record<string, number>>> }>;
    let compared = 0;
    for (const code of ["WP", "PB"] as const) {
      for (const [key, cols] of Object.entries(own[code])) {
        const [, plancode, sex, age] = key.match(/^(.+?)([MF])(\d+)$/)!;
        for (const [term, rate] of Object.entries(cols)) {
          expect((lp[code].rates[plancode] as Record<string, Record<string, Record<string, number>>>)[sex][age][term], `${key} ${term}`).toBe(rate);
          compared++;
        }
      }
    }
    for (let age = 20; age <= 65; age++) {
      for (const sex of ["M", "F"]) {
        expect((lp.DCI.rates.DCI as Record<string, Record<string, number>>)[sex][String(age)]).toBe(own.DCI[String(age)][sex]);
      }
    }
    // the table is cut to what this plan can reach — spouse PB only, terms 5–50 — so this is
    // every rate it can ever read
    expect(compared).toBeGreaterThan(15_000);
  });

  it("prices WP and PB the way the other plans' own code does, for this plan's paying term", () => {
    for (const option of ["FIT", "BEYOND"] as const) {
      for (const mode of ["annual", "monthly"] as const) {
        const r = quotePension({ ...at40, mode, riders: { wp: { option } } });
        const p = quotePension({ ...at40, mode, riders: { pb: { option, payerAge: 38, payerSex: "F" } } });
        if (!r.ok || !p.ok) throw new Error("refused");
        const base = Math.round(r.quote.annualPremium * 100);
        const wp = premiumBasedRiderPremium(lifeprotectRates as unknown as PlanRates, "WP", {
          option, insuredAge: 40, insuredSex: "M", payTerm: 30, baseAnnual: base, mode,
        })!;
        const pb = premiumBasedRiderPremium(lifeprotectRates as unknown as PlanRates, "PB", {
          option, insuredAge: 40, insuredSex: "M", payer: { age: 38, sex: "F" }, payTerm: 30, baseAnnual: base, mode,
        })!;
        expect(r.quote.riders[0]).toMatchObject({ annual: wp.annual / 100, modePremium: wp.modal / 100 });
        expect(p.quote.riders[0]).toMatchObject({ annual: pb.annual / 100, modePremium: pb.modal / 100 });
        expect(r.quote.riders[0].annual).toBeGreaterThan(0);
      }
    }
  });

  it("has a WP and a PB rate for every arrangement the plan can be sold on", () => {
    for (const pay of ["6", "untilAnnuity"] as const) {
      for (let age = 20; age <= 65; age++) {
        for (const annuityAge of availablePensionAges(age, pay)) {
          const input = { ...at40, age, pay, annuityAge };
          for (const option of ["FIT", "BEYOND"] as const) {
            const wp = quotePension({ ...input, riders: { wp: { option } } });
            if (!wp.ok) throw new Error(wp.error);
            expect(wp.quote.riders[0].error, `WP ${option} ${pay} ${age}→${annuityAge}`).toBeUndefined();
            for (const payerAge of [20, 45, 70]) {
              const pb = quotePension({ ...input, riders: { pb: { option, payerAge, payerSex: "F" } } });
              if (!pb.ok) throw new Error(pb.error);
              expect(pb.quote.riders[0].error, `PB ${option} ${pay} ${age}→${annuityAge} payer ${payerAge}`).toBeUndefined();
            }
          }
        }
      }
    }
  });

  it("uses six years as the waiver's term on the six-year plan", () => {
    const six = quotePension({ ...at40, pay: "6", riders: { wp: { option: "FIT" } } });
    const all = quotePension({ ...at40, riders: { wp: { option: "FIT" } } });
    if (!six.ok || !all.ok) throw new Error("refused");
    const rate = (ridersJson as { WP: Record<string, Record<string, number>> }).WP.WPTPDM40;
    expect(six.quote.riders[0].rate).toBe(rate["6"]);
    expect(all.quote.riders[0].rate).toBe(rate["30"]);
  });

  it("adds what can be bought to the total, and refuses the rest with a reason", () => {
    const r = quotePension({
      ...at40,
      riders: { wp: { option: "FIT" }, pb: { option: "FIT", payerAge: 38, payerSex: "F" }, dci: { sumAssured: 100_000 } },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.quote.riders.map((l) => l.error)).toEqual([
      "เลือก WP หรือ PB อย่างใดอย่างหนึ่ง", "เลือก WP หรือ PB อย่างใดอย่างหนึ่ง", "ทุน DCI 200,000–10,000,000 บาท",
    ]);
    expect(r.quote.totalAnnualPremium).toBe(r.quote.annualPremium);

    const ok = quotePension({ ...at40, riders: { wp: { option: "BEYOND" }, dci: { sumAssured: 500_000 } } });
    if (!ok.ok) throw new Error(ok.error);
    const [wp, dci] = ok.quote.riders;
    expect(ok.quote.totalAnnualPremium).toBeCloseTo(ok.quote.annualPremium + wp.annual + dci.annual, 2);
  });

  it("refuses PB for a payer outside 20–70", () => {
    const r = quotePension({ ...at40, riders: { pb: { option: "FIT", payerAge: 72, payerSex: "F" } } });
    if (!r.ok) throw new Error(r.error);
    expect(r.quote.riders[0].error).toBe("ผู้ชำระเบี้ยอายุ 20–70 ปี");
  });
});
