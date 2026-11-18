import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { formatSatang } from "@/calc/money";
import { cardInputFrom, cardPath, quoteCard, valueTableCard, type PlanCardInput } from "@/lib/quote-card";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { accidentOverCap, illnessModes, illnessOf, illnessSaMax, illnessWhyNot, riderDueByYear, termAt } from "@/lib/lifeprotect-quote";
import type { PayMode, Sex } from "@/calc/types";

/**
 * DCI and CI 123 on the Life Protect page (owner, 2026-10-28, ก ก): priced in the browser from
 * the page's table, so the arithmetic must be the engine's, and carried into the card and the
 * value table the way the waiver and MEB are.
 */

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-10-28");
const table = lifeProtectTable(WHILE_CURRENT);

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

const MODES: PayMode[] = ["annual", "semi", "monthly"];

describe("the critical-illness riders the page offers", () => {
  it("is DCI and CI 123, at the company's ages and sums", () => {
    expect(table.illness.map((r) => [r.code, r.short, r.ageMin, r.ageMax, r.saMin, r.saMax, r.coverToAge])).toEqual([
      ["DCI", "DCI", 20, 65, 200_000, 10_000_000, 75],
      ["CI123", "CI 123", 0, 75, 100_000, 10_000_000, undefined],
      // the accident riders (owner, 2026-11-18): the handbook's cover to 65
      ["AP", "AP", 0, 60, 100_000, 10_000_000, 65],
      ["ECARE", "ECARE", 16, 60, 100_000, 10_000_000, 65],
    ]);
    expect(table.illness.map((r) => r.group)).toEqual(["illness", "illness", "accident", "accident"]);
  });

  /** the page offers them side by side because the company does not exclude one by the other */
  it("is not sold one or the other", () => {
    const rules = quote({
      planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000,
      riders: [{ code: "DCI", sumAssured: 1_000_000 }, { code: "CI123", sumAssured: 1_000_000 }],
    }, WHILE_CURRENT);
    expect(rules.items.filter((i) => i.code.startsWith("DCI") || i.code.startsWith("CI123")).every((i) => i.eligible)).toBe(true);
  });
});

describe("illnessModes", () => {
  it("prices like the engine, to the satang, in every instalment", () => {
    const next = rng(28);
    for (let n = 0; n < 300; n++) {
      const rider = table.illness[Math.floor(next() * table.illness.length)];
      const sex: Sex = next() < 0.5 ? "M" : "F";
      const age = table.ageMin + Math.floor(next() * (table.ageMax - table.ageMin + 1));
      const sumAssured = 50_000 * (1 + Math.floor(next() * 60));
      const mode = MODES[Math.floor(next() * 3)];
      const r = quote({
        planCode: "LIFEPROTECT", variant: "WLF19H", age, sex, mode, sumAssured: 1_000_000,
        riders: [{ code: rider.code, sumAssured }],
      }, WHILE_CURRENT);
      const items = r.items.filter((i) => i.code === rider.code || i.code.startsWith(`${rider.code}:`));
      const engine = items.length > 0 && items.every((i) => i.eligible) ? items.reduce((s, i) => s + i.modal, 0) : undefined;
      const page = illnessModes(table, rider, { sex, age, sumAssured }, 1_000_000)?.find((m) => m.mode === mode)?.total;
      expect(page, `${rider.code} ${sex} ${age} ${sumAssured} ${mode}`).toBe(engine);
    }
  });

  it("says why a rider picked at an age or sum it cannot be bought at is left out", () => {
    const dci = illnessOf(table, "DCI")!;
    const ci = illnessOf(table, "CI123")!;
    expect(illnessWhyNot(table, dci, { sex: "M", age: 10, sumAssured: 1_000_000 }))
      .toBe("DCI รับอายุ 20–65 ปี · อายุนี้จึงยังไม่ได้รวมอยู่ในราคา");
    // CI 123 is void under a thousand baht a year (composite-ci.ts)
    expect(illnessModes(table, ci, { sex: "F", age: 5, sumAssured: 100_000 })).toBeUndefined();
    expect(illnessWhyNot(table, ci, { sex: "F", age: 5, sumAssured: 100_000 }))
      .toBe("CI 123 เบี้ยต้องไม่ต่ำกว่า 1,000 บาทต่อปี · เพิ่มทุนเพื่อรวมในราคา");
    expect(illnessWhyNot(table, ci, { sex: "M", age: 35, sumAssured: 1_000_000 })).toBeUndefined();
  });
});

describe("riderDueByYear with the critical-illness riders", () => {
  it("renews them at each year's age, and stops DCI at 75", () => {
    const term = termAt(table, "WLF19H");
    const dci = illnessOf(table, "DCI")!;
    const ci = illnessOf(table, "CI123")!;
    const picks = [{ code: "DCI", sumAssured: 1_000_000 }, { code: "CI123", sumAssured: 1_000_000 }];
    const due = riderDueByYear(table, term, 60, 30, undefined, undefined, { sex: "M", picks });
    const yearly = (rider: typeof dci, age: number) =>
      illnessModes(table, { ...rider, ageMax: 99 }, { sex: "M", age, sumAssured: 1_000_000 })?.find((m) => m.mode === "annual")?.total ?? 0;
    expect(due[0]).toBe(yearly(dci, 60) + yearly(ci, 60));
    expect(due[14]).toBe(yearly(dci, 74) + yearly(ci, 74));
    // from 75 only CI 123 is still paid for
    expect(due[15]).toBe(yearly(ci, 75));
    expect(yearly(dci, 75)).toBe(0);
  });
});

describe("the card and the value table", () => {
  const WITH_CI: PlanCardInput = {
    kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000,
    riders: { illness: [{ code: "DCI", sumAssured: 1_000_000 }, { code: "CI123", sumAssured: 1_000_000 }] },
  };

  it("travels in the link and back", () => {
    const path = cardPath(WITH_CI);
    expect(path).toContain("dci=1000000");
    expect(path).toContain("ci123=1000000");
    const back = cardInputFrom(new URLSearchParams(path.split("?")[1]));
    expect(back?.kind === "plan" ? back.riders : undefined).toEqual(WITH_CI.riders);
  });

  it("lists each rider in the split, with the page's figures", () => {
    const card = quoteCard(WITH_CI, WHILE_CURRENT)!;
    const own = (code: string) => illnessModes(table, illnessOf(table, code)!, { sex: "M", age: 35, sumAssured: 1_000_000 })!;
    const mode = card.summary!.split!.title.endsWith("รายเดือน") ? "monthly" : "annual";
    expect(card.summary!.split!.rows.slice(1)).toEqual([
      { label: "DCI ทุน 1,000,000", amount: `+${formatSatang(own("DCI").find((m) => m.mode === mode)!.total)}` },
      { label: "CI 123 ทุน 1,000,000", amount: `+${formatSatang(own("CI123").find((m) => m.mode === mode)!.total)}` },
    ]);
    expect(card.footNotes).toContain("+ DCI จ่ายอีก 1,000,000 บาท เมื่อเสียชีวิตหรือเป็นโรคร้ายแรง ก่อนอายุ 75");
    expect(card.footNotes!.at(-1)).toContain("เบี้ย DCI, CI 123 ปรับตามอายุทุกปีที่ต่อสัญญา");
  });

  it("gives the value table their premium in the riders' column", () => {
    const t = valueTableCard(WITH_CI, WHILE_CURRENT)!;
    expect(t.columns).toContain("สัญญาเพิ่มเติม");
  });

  it("refuses a rider at an age it is not sold at", () => {
    expect(quoteCard({ ...WITH_CI, age: 10 }, WHILE_CURRENT)).toBeUndefined();
  });
});

describe("the accident riders", () => {
  const ap = illnessOf(table, "AP")!;
  const ecare = illnessOf(table, "ECARE")!;

  it("are priced at occupation class 1, the same at every age: AP 3, ECARE 6.50 a thousand", () => {
    const at = (r: typeof ap, age: number) =>
      illnessModes(table, r, { sex: "M", age, sumAssured: 1_000_000 }, 1_000_000)?.find((m) => m.mode === "annual")?.total;
    expect(at(ap, 35)).toBe(300_000);
    expect(at(ap, 5)).toBe(300_000);
    expect(at(ecare, 35)).toBe(650_000);
    expect(at(ecare, 15)).toBeUndefined();
  });

  it("are held to 5 times the plan's sum, a child's AP to 2 times and 3 million", () => {
    expect(illnessSaMax(ap, 35, 1_000_000)).toBe(5_000_000);
    expect(illnessSaMax(ap, 35, 3_000_000)).toBe(10_000_000);
    expect(illnessSaMax(ap, 10, 1_000_000)).toBe(2_000_000);
    expect(illnessSaMax(ap, 10, 2_000_000)).toBe(3_000_000);
    expect(illnessModes(table, ap, { sex: "M", age: 35, sumAssured: 6_000_000 }, 1_000_000)).toBeUndefined();
    expect(illnessWhyNot(table, ap, { sex: "M", age: 35, sumAssured: 6_000_000 }, 1_000_000))
      .toBe("AP ทุน 100,000 – 5,000,000 บาท (ไม่เกิน 5 เท่าของทุนหลัก)");
  });

  it("together are held to 5 times the plan's sum, as the engine says", () => {
    const picks = [{ code: "AP", sumAssured: 3_000_000 }, { code: "ECARE", sumAssured: 3_000_000 }];
    expect(accidentOverCap(table, picks, 1_000_000))
      .toBe("ทุน AP + ECARE รวม 6,000,000 บาท เกินที่ซื้อได้รวมกัน 5,000,000 บาท (5 เท่าของทุนหลัก) · ลดทุนเพื่อรวมในราคา");
    expect(accidentOverCap(table, picks, 2_000_000)).toBeUndefined();
    const engine = quote({
      planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000,
      riders: [{ code: "AP", sumAssured: 3_000_000 }, { code: "ECARE", sumAssured: 3_000_000 }],
    }, WHILE_CURRENT);
    expect(engine.warnings.map((w) => w.code)).toContain("AP_ECARE");
  });

  it("renew yearly in the value table until cover stops at 65", () => {
    const term = table.terms.find((t) => t.variant === "WLF19H")!;
    const due = riderDueByYear(table, term, 60, 7, undefined, undefined, { sex: "F", picks: [{ code: "AP", sumAssured: 1_000_000 }] });
    expect(due).toEqual([300_000, 300_000, 300_000, 300_000, 300_000, 0, 0]);
  });

  it("ride the card link and the card's split, and a pair past the shared limit gets no card", () => {
    const withAccident: PlanCardInput = {
      kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, mode: "annual",
      riders: { illness: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 1_000_000 }] },
    };
    const path = cardPath(withAccident);
    expect(path).toContain("ap=1000000");
    expect(path).toContain("ecare=1000000");
    const back = cardInputFrom(new URLSearchParams(path.split("?")[1]));
    expect(back?.kind === "plan" ? back.riders : undefined).toEqual(withAccident.riders);
    const card = quoteCard(withAccident, WHILE_CURRENT)!;
    const mode = card.summary!.split!.title.endsWith("รายเดือน") ? "monthly" : "annual";
    const own = (r: typeof ap) => formatSatang(illnessModes(table, r, { sex: "M", age: 35, sumAssured: 1_000_000 }, 1_000_000)!
      .find((m) => m.mode === mode)!.total);
    expect(card.summary!.split!.rows.slice(1)).toEqual([
      { label: "AP ทุน 1,000,000", amount: `+${own(ap)}` },
      { label: "ECARE ทุน 1,000,000", amount: `+${own(ecare)}` },
    ]);
    expect(quoteCard({
      ...withAccident,
      riders: { illness: [{ code: "AP", sumAssured: 3_000_000 }, { code: "ECARE", sumAssured: 3_000_000 }] },
    }, WHILE_CURRENT)).toBeUndefined();
  });
});
