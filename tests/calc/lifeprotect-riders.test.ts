import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { getPlan } from "@/calc/plans/registry";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import {
  addModes, lifeProtectModes, medicalModes, medicalPlansAt, pickedRider, riderDueByYear, riderModes, termAt,
  totalModes,
} from "@/lib/lifeprotect-quote";
import { fixedPlanRiderPremium } from "@/calc/riders/fixed-by-plan";
import type { PayMode, Sex } from "@/calc/types";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");
const table = lifeProtectTable(WHILE_CURRENT);
const plan = getPlan("LIFEPROTECT")!;

/** A small seeded generator, so a failing case can be re-run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUMS = Array.from({ length: 20 }, (_, i) => 500_000 * (i + 1));
const MODES: PayMode[] = ["annual", "semi", "monthly"];

describe("the riders the page offers", () => {
  /** พีบี came off every Life Protect quote (owner, 2026-11-02); ดับบลิวพี is the waiver left. */
  it("is ดับบลิวพี alone, named as the company names it", () => {
    expect(table.riders.map((r) => [r.code, r.name, r.ageMin, r.ageMax])).toEqual([
      ["WP", "สัญญาเพิ่มเติมดับบลิวพี (ยกเว้นเบี้ย)", 16, 70],
    ]);
    expect(table.riders.map((r) => r.options.map((o) => o.name))).toEqual([
      ["สัญญาเพิ่มเติมดับบลิวพี ฟิต", "สัญญาเพิ่มเติมดับบลิวพี บียอนด์"],
    ]);
    expect(pickedRider(table, { code: "PB", option: "FIT" })).toBeUndefined();
  });

  /**
   * The page offers a choice of one because the company sells a choice of one. Should that
   * ever change, this fails and says so rather than leaving the buttons quietly wrong.
   */
  it("is sold one or the other, which is why the page's control takes one answer", () => {
    expect(plan.rules.exclusive).toContainEqual({
      code: "PB_WP", riders: ["PB", "WP"], message: "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง",
    });
  });

  it("carries a rate at every age it says it sells at, and none outside", () => {
    for (const rider of table.riders) {
      for (const option of rider.options) {
        for (const term of table.terms) {
          for (const sex of ["M", "F"] as Sex[]) {
            const rates = option.rates[term.variant][sex];
            expect(rates, `${rider.code} ${option.code} ${term.variant} ${sex}`)
              .toHaveLength(table.ageMax - table.ageMin + 1);
            for (let age = table.ageMin; age <= table.ageMax; age++) {
              const inside = age >= rider.ageMin && age <= rider.ageMax;
              expect(typeof rates[age - table.ageMin] === "number", `${rider.code} ${option.code} ${term.variant} ${sex} ${age}`)
                .toBe(inside);
            }
          }
        }
      }
    }
  });
});

describe("riderModes", () => {
  /**
   * The browser's arithmetic is the page's only source of prices, so it has to be the
   * engine's arithmetic — rider and all. Two hundred random arrangements are priced both
   * ways and must agree to the satang, in every instalment.
   */
  it("agrees with the engine on the total in every mode across random arrangements", () => {
    const next = rng(20260922);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    let priced = 0;
    for (let i = 0; i < 200; i++) {
      const term = pick(table.terms);
      const sex = pick(["M", "F"] as const);
      const rider = pick(table.riders);
      const option = pick(rider.options);
      const age = rider.ageMin + Math.floor(next() * (rider.ageMax - rider.ageMin + 1));
      const sumAssured = pick(SUMS);
      const who = { sex, age, sumAssured };

      const base = lifeProtectModes(table, term, who)!;
      const baseAnnual = base.find((m) => m.mode === "annual")!.total;
      const picked = pickedRider(table, { code: rider.code, option: option.code })!;
      const onlyRider = riderModes(table, term, who, picked, baseAnnual)!;
      const totals = totalModes(table, base, onlyRider);
      expect(onlyRider, `${rider.code} ${option.code} ${term.variant} ${sex} ${age}`).toBeDefined();
      priced++;

      for (const mode of MODES) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: term.variant, age, sex, mode, sumAssured,
          // the page asks for no payer of its own: the insured pays their own premium
          payer: { age, sex },
          riders: [{ code: rider.code, option: option.code }],
        }, WHILE_CURRENT);
        const label = `${rider.code} ${option.code} ${term.variant} ${sex} ${age} ${sumAssured} ${mode}`;
        const row = q.items.find((it) => it.code === rider.code)!;
        expect(row.eligible, `${label} — ${row.message}`).toBe(true);
        expect(row.modal, label).toBe(onlyRider.find((m) => m.mode === mode)!.total);
        expect(q.totalModal, label).toBe(totals.find((m) => m.mode === mode)!.total);
        expect(q.warnings.some((w) => w.code === "MIN_MONTHLY"), label)
          .toBe(totals.find((m) => m.mode === mode)!.belowMinimum);
      }
    }
    expect(priced).toBe(200);
  });

  it("prices ดับบลิวพี ฟิต on ชาย 35 · 1 ล้าน · จ่าย 19 ปี as the engine does", () => {
    const who = { sex: "M" as Sex, age: 35, sumAssured: 1_000_000 };
    const term = termAt(table, "WLF19H");
    const base = lifeProtectModes(table, term, who)!;
    const picked = pickedRider(table, { code: "WP", option: "FIT" })!;
    const rider = riderModes(table, term, who, picked, base.find((m) => m.mode === "annual")!.total)!;
    const q = quote({
      planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", mode: "annual",
      sumAssured: 1_000_000, payer: { age: 35, sex: "M" }, riders: [{ code: "WP", option: "FIT" }],
    }, WHILE_CURRENT);
    expect(rider.find((m) => m.mode === "annual")!.total)
      .toBe(q.items.find((it) => it.code === "WP")!.annual);
  });

  /** With พีบี gone, a child under ดับบลิวพี's lowest age has no waiver to be quoted. */
  it("has no waiver for a child under 16", () => {
    const wp = table.riders.find((r) => r.code === "WP")!;
    expect(wp.child).toBeUndefined();
    const who = { sex: "M" as Sex, age: 14, sumAssured: 1_000_000 };
    const term = termAt(table, "WLF19H");
    const baseAnnual = lifeProtectModes(table, term, who)!.find((m) => m.mode === "annual")!.total;
    expect(riderModes(table, term, who, pickedRider(table, { code: "WP", option: "FIT" })!, baseAnnual)).toBeUndefined();
  });

  it("refuses a flavour the table does not carry", () => {
    expect(pickedRider(table, { code: "WP", option: "NOPE" })).toBeUndefined();
    expect(pickedRider(table, { code: "AP", option: "FIT" })).toBeUndefined();
    expect(pickedRider(table, undefined)).toBeUndefined();
  });
});

describe("the medical rider", () => {
  const medical = table.medical!;

  it("is MEB, sold 6 - 65 with the plans capped by age as the rules cap them", () => {
    expect([medical.code, medical.name, medical.ageMin, medical.ageMax])
      .toEqual(["MEB", "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)", 6, 65]);
    expect(medicalPlansAt(table, medical, 5)).toEqual([]);
    expect(medicalPlansAt(table, medical, 8)).toEqual([500]);
    expect(medicalPlansAt(table, medical, 14)).toEqual([500, 1000]);
    expect(medicalPlansAt(table, medical, 35)).toEqual([500, 1000, 2000, 3000, 4000, 5000]);
    expect(medicalPlansAt(table, medical, 66)).toEqual([]);
  });

  /** MEB stacks with either waiver, and the page adds the three up as the engine does. */
  it("agrees with the engine alone and beside a waiver, in every mode", () => {
    const next = rng(20261007);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    for (let i = 0; i < 200; i++) {
      const term = pick(table.terms);
      const sex = pick(["M", "F"] as const);
      const age = 20 + Math.floor(next() * 46);
      const plan = pick(medicalPlansAt(table, medical, age));
      const sumAssured = pick(SUMS);
      const who = { sex, age, sumAssured };
      const base = lifeProtectModes(table, term, who)!;
      const wp = pickedRider(table, { code: "WP", option: pick(["FIT", "BEYOND"]) })!;
      const waiver = riderModes(table, term, who, wp, base.find((m) => m.mode === "annual")!.total)!;
      const meb = medicalModes(table, medical, age, plan)!;
      const totals = totalModes(table, base, addModes(waiver, meb));
      for (const mode of MODES) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: term.variant, age, sex, mode, sumAssured,
          riders: [{ code: "WP", option: wp.option.code }, { code: "MEB", plan }],
        }, WHILE_CURRENT);
        const label = `MEB ${plan} + WP ${wp.option.code} ${term.variant} ${sex} ${age} ${sumAssured} ${mode}`;
        const row = q.items.find((it) => it.code === "MEB")!;
        expect(row.eligible, `${label} — ${row.message}`).toBe(true);
        expect(row.modal, label).toBe(meb.find((m) => m.mode === mode)!.total);
        expect(q.totalModal, label).toBe(totals.find((m) => m.mode === mode)!.total);
      }
    }
  });

  it("will not quote a plan the age may not buy", () => {
    expect(medicalModes(table, medical, 14, 2000)).toBeUndefined();
    expect(medicalModes(table, medical, 5, 500)).toBeUndefined();
    expect(medicalModes(table, medical, 14, 1000)).toBeDefined();
  });
});

describe("riderDueByYear", () => {
  const term = termAt(table, "WLF19H");
  const wp = table.riders.find((r) => r.code === "WP")!;

  /** ดับบลิวพี waives the plan's own paying years, so at 35 on จ่าย 19 ปี it runs nineteen. */
  it("runs the waiver over the paying years and the medical rider to the end of its rate table", () => {
    const due = riderDueByYear(table, term, 35, 50, { rider: wp, annual: 50_000 }, { plan: 1000 });
    const meb = (age: number) => fixedPlanRiderPremium(plan.rates, "MEB", { age, plan: 1000, mode: "annual" })!.annual;
    expect(due[0]).toBe(50_000 + meb(35));
    expect(due[18]).toBe(50_000 + meb(53));
    expect(due[19]).toBe(meb(54));
    expect(due[39]).toBe(meb(74));
    expect(due[40]).toBe(0);
  });

  it("is nothing a year without riders", () => {
    expect(riderDueByYear(table, term, 35, 64).every((d) => d === 0)).toBe(true);
  });
});
