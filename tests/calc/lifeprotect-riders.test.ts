import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { getPlan } from "@/calc/plans/registry";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import {
  addModes, lifeProtectModes, medicalModes, medicalPlansAt, pickedRider, riderModes, termAt, totalModes,
} from "@/lib/lifeprotect-quote";
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
  it("is the two that waive premiums, named as the company names them", () => {
    expect(table.riders.map((r) => [r.code, r.name, r.ageMin, r.ageMax])).toEqual([
      // an adult pays their own premium, so the payer's own window is the adult's; a child's
      // พีบี is quoted with a parent paying (riders' `child`, tested below)
      ["PB", "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)", 20, 70],
      ["WP", "สัญญาเพิ่มเติมดับบลิวพี (ยกเว้นเบี้ย)", 16, 70],
    ]);
    expect(table.riders.map((r) => r.options.map((o) => o.name))).toEqual([
      ["สัญญาเพิ่มเติมพีบี ฟิต", "สัญญาเพิ่มเติมพีบี บียอนด์"],
      ["สัญญาเพิ่มเติมดับบลิวพี ฟิต", "สัญญาเพิ่มเติมดับบลิวพี บียอนด์"],
    ]);
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

  /**
   * A child cannot pay their own premium, so พีบี on one is read off the parent's row — the
   * parent's age and sex, and a waive period cut short at the child's 25th birthday.
   */
  it("prices a child's พีบี off the parent paying, as the engine does", () => {
    const pb = table.riders.find((r) => r.code === "PB")!;
    expect(pb.child).toEqual({ ageMax: 15, payerMin: 20, payerMax: 70 });
    const next = rng(20261006);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    for (let i = 0; i < 200; i++) {
      const term = pick(table.terms);
      const sex = pick(["M", "F"] as const);
      const option = pick(pb.options);
      const age = Math.floor(next() * 16);
      const payer = { sex: pick(["M", "F"] as const), age: 20 + Math.floor(next() * 51) };
      const sumAssured = pick(SUMS);
      const who = { sex, age, sumAssured };
      const base = lifeProtectModes(table, term, who)!;
      const picked = pickedRider(table, { code: "PB", option: option.code })!;
      const own = riderModes(table, term, who, picked, base.find((m) => m.mode === "annual")!.total, payer);
      const label = `PB ${option.code} ${term.variant} ${sex} ${age} payer ${payer.sex} ${payer.age}`;
      expect(own, label).toBeDefined();
      for (const mode of MODES) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: term.variant, age, sex, mode, sumAssured, payer,
          riders: [{ code: "PB", option: option.code }],
        }, WHILE_CURRENT);
        const row = q.items.find((it) => it.code === "PB")!;
        expect(row.eligible, `${label} ${mode} — ${row.message}`).toBe(true);
        expect(row.modal, `${label} ${mode}`).toBe(own!.find((m) => m.mode === mode)!.total);
      }
    }
  });

  it("will not quote a child's พีบี without a parent in the payer's ages", () => {
    const who = { sex: "M" as Sex, age: 14, sumAssured: 1_000_000 };
    const term = termAt(table, "WLF19H");
    const baseAnnual = lifeProtectModes(table, term, who)!.find((m) => m.mode === "annual")!.total;
    const picked = pickedRider(table, { code: "PB", option: "FIT" })!;
    expect(riderModes(table, term, who, picked, baseAnnual)).toBeUndefined();
    expect(riderModes(table, term, who, picked, baseAnnual, { sex: "F", age: 19 })).toBeUndefined();
    expect(riderModes(table, term, who, picked, baseAnnual, { sex: "F", age: 71 })).toBeUndefined();
    expect(riderModes(table, term, who, picked, baseAnnual, { sex: "F", age: 40 })).toBeDefined();
  });

  it("refuses a flavour the table does not carry", () => {
    expect(pickedRider(table, { code: "PB", option: "NOPE" })).toBeUndefined();
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
