import { describe, expect, it } from "vitest";
import { priceRiders } from "@/lib/ihealthy-rider-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { categoryNumbers, iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";
import { dciDiseases, translateFacts } from "@/lib/ihealthy-translate";
import { LANGS, parseLang, type Lang } from "@/lib/ihealthy-lang";
import { WORDS } from "@/lib/ihealthy-words";
import { deathBenefitRows } from "@/lib/death-benefit";
import dci from "../../data/riders/dci-diseases.json";

const THAI = /[฀-๿]/;
const OTHERS = LANGS.filter((l): l is Exclude<Lang, "th"> => l !== "th");

/** Every string anywhere inside, with where it was found. */
function strings(value: unknown, at = ""): [string, string][] {
  if (typeof value === "string") return [[at, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, `${at}.${k}`));
  }
  return [];
}

describe("the benefit sheet in other languages", () => {
  it.each(OTHERS)("%s has a reading of every Thai line the sheet holds", (lang) => {
    // A line the company re-words has no entry any more; this is where that surfaces, rather
    // than as a Thai sentence on the English page.
    const left = strings(translateFacts(iHealthyFacts(), lang)).filter(([, s]) => THAI.test(s));
    expect(left).toEqual([]);
  });

  it.each(OTHERS)("%s names all thirty-one DCI illnesses", (lang) => {
    const list = dciDiseases(lang);
    expect(list).toHaveLength(dci.diseases.length);
    expect(list.filter((d) => THAI.test(d))).toEqual([]);
    expect(new Set(list).size).toBe(list.length);
  });

  it("leaves Thai exactly as the sheet has it", () => {
    const facts = iHealthyFacts();
    expect(translateFacts(facts, "th")).toBe(facts);
  });

  it.each(OTHERS)("%s keeps every number, code and shape", (lang) => {
    const th = iHealthyFacts();
    const other = translateFacts(th, lang);
    expect(other.plans.map((p) => [p.code, p.annualMax, p.deductible]))
      .toEqual(th.plans.map((p) => [p.code, p.annualMax, p.deductible]));
    expect(other.rows.map((r) => (isHeading(r) ? "h" : [r.no, r.endorsement, Object.keys(r.adult)])))
      .toEqual(th.rows.map((r) => (isHeading(r) ? "h" : [r.no, r.endorsement, Object.keys(r.adult)])));
    expect(other.terms.waitingDays).toBe(th.terms.waitingDays);
  });

  it.each(OTHERS)("%s headings still carry the category numbers a phone counts", (lang) => {
    expect(categoryNumbers(translateFacts(iHealthyFacts(), lang).rows))
      .toEqual(categoryNumbers(iHealthyFacts().rows));
  });

  it.each(OTHERS)("%s row titles stay distinct, since the table keys its rows by them", (lang) => {
    const rows = translateFacts(iHealthyFacts(), lang).rows;
    const titles = rows.map((r) => (isHeading(r) ? r.heading : r.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(OTHERS)("%s cells agree wherever the Thai cells agree, so merged runs merge alike", (lang) => {
    const th = iHealthyFacts().rows;
    const other = translateFacts(iHealthyFacts(), lang).rows;
    th.forEach((row, i) => {
      if (isHeading(row)) return;
      const o = other[i];
      if (isHeading(o)) throw new Error("shape");
      const codes = Object.keys(row.adult);
      for (const a of codes) for (const b of codes) {
        expect(o.adult[a] === o.adult[b]).toBe(row.adult[a] === row.adult[b]);
      }
    });
  });
});

describe("the rider engine's lines", () => {
  /** Everything the fold prints from the engine, across ages, bases and ticks. */
  function engineLines(): string[] {
    const t = iHealthyTable();
    const seen = new Set<string>();
    for (const age of [0, 5, 8, 12, 16, 30, 55, 65, 70, 74, 80]) {
      for (const b of t.bases) {
        for (const riders of [[], [{ code: "MEB", plan: 1000 }], [{ code: "MEB", plan: 5000 }],
          [{ code: "DCI", sumAssured: 100_000 }], [{ code: "DCI", sumAssured: 200_000 }], [{ code: "XYZ" }],
          // every other rider the fold offers, and the pairs the rules object to
          [{ code: "MEX", option: "1200" }], [{ code: "RRSS", option: "แผน S" }],
          [{ code: "CI123", sumAssured: 100_000 }], [{ code: "CI123", sumAssured: 500_000 }],
          [{ code: "CPR", sumAssured: 300_000 }], [{ code: "PLS", option: "PLS05", sumAssured: 300_000 }],
          [{ code: "PLS", option: "PLS15", sumAssured: 5_000_000 }],
          [{ code: "AP", sumAssured: 500_000 }], [{ code: "ECARE", sumAssured: 100_000 }],
          [{ code: "AP", sumAssured: 5_000_000 }, { code: "ECARE", sumAssured: 5_000_000 }],
          [{ code: "WP", option: "FIT" }], [{ code: "PB", option: "BEYOND" }],
          [{ code: "WP", option: "FIT" }, { code: "PB", option: "FIT" }],
          [{ code: "CPR", sumAssured: 300_000 }, { code: "DCI", sumAssured: 200_000 }],
          [{ code: "HIC", sumAssured: 1000 }]]) {
          const r = priceRiders({
            base: b.variant, age, sex: "M", sumAssured: b.fixedSum ?? 1_000_000, mode: "annual",
            plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage", riders,
          });
          for (const c of r.available) {
            for (const s of [c.name, c.ageRange, c.reason, c.exactMessage, ...(c.options ?? []).map((o) => o.name)]) {
              if (s) seen.add(s);
            }
          }
          for (const i of r.items) for (const s of [i.name, i.message]) if (s) seen.add(s);
          for (const w of r.warnings) seen.add(w);
        }
      }
    }
    return [...seen];
  }

  it.each(OTHERS)("%s reads every line the fold can print", (lang) => {
    const lines = engineLines();
    expect(lines.length).toBeGreaterThan(5);
    // the health rider's own line is replaced by its English name before it is read
    const unread = lines
      .filter((s) => s !== "ไอเฮลท์ตี้ อัลตร้า")
      .map((s) => WORDS[lang].rider(s))
      .filter((s) => THAI.test(s));
    expect(unread).toEqual([]);
  });

  it("hands Thai back untouched", () => {
    for (const s of engineLines()) expect(WORDS.th.rider(s)).toBe(s);
  });
});

describe("the page's own words", () => {
  it.each(OTHERS)("%s says nothing in Thai", (lang) => {
    const w = WORDS[lang];
    const thai = strings(w).filter(([, s]) => THAI.test(s));
    // the territory table is keyed by the rate key's Thai; only its values are read
    expect(thai.filter(([at]) => !at.startsWith(".territory"))).toEqual([]);
    const said = [
      w.intro(3e6, 1e8, 6, 98), w.onlyPlans(8, ["Smart", "Bronze"]), w.territoryOnly("Asia", "x"),
      w.notSoldAtAge(99), w.totalPremium(w.mode.annual), w.belowMinimum(500),
      w.refused([w.mode.monthly], 500), w.deductible(30000), w.copay(20), w.dailyCash(1000),
      w.dailyCashRow, w.riderCount(2), w.dciTitle("200,000"), w.fixedSum(500000),
      w.baseWithSum("x", 1), w.sumOf(1), w.years(35), w.expiredTable("2026-01-01"),
      w.waitingSummary(30, 120), w.waitingBody(30, 8, 120), w.noClaimSummary(10),
      w.outOfTerritorySummary(90), w.firstYearDisclaimer("A1"), w.moreOnDesktop(23),
      w.tableCaption(6), w.upTo("x"), w.optionOf("x"), w.planOf("x"), w.sumOfRider("x"),
      ...Object.values(w.territory), w.death.before(60), w.death.between(60, 74),
      w.death.from(60), w.death.until(74), w.death.always,
    ];
    expect(said.filter((s) => THAI.test(s))).toEqual([]);
    expect(w.translationNote).not.toBe("");
  });

  it("Thai death bands are the ones every other surface prints", () => {
    const db = { beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false,
      riderCoverEnds: { age: 75, sum: 1_000_000 } };
    expect(deathBenefitRows(db, WORDS.th.death)).toEqual(deathBenefitRows(db));
    expect(deathBenefitRows({ ...db, alreadyPastAge: true, riderCoverEnds: undefined }, WORDS.th.death))
      .toEqual(deathBenefitRows({ ...db, alreadyPastAge: true, riderCoverEnds: undefined }));
  });

  it("Chinese counts ceilings in 万 and 亿", () => {
    expect(WORDS.zh.big(3_000_000)).toEqual({ num: "300", unit: "万" });
    expect(WORDS.zh.big(25_000_000)).toEqual({ num: "2,500", unit: "万" });
    expect(WORDS.zh.big(100_000_000)).toEqual({ num: "1", unit: "亿" });
  });

  it("reads an unknown or missing cookie as Thai", () => {
    expect(parseLang(undefined)).toBe("th");
    expect(parseLang("fr")).toBe("th");
    expect(parseLang("zh")).toBe("zh");
  });
});
