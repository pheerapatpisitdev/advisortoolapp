import { describe, expect, it } from "vitest";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { FULL_ROW_KEYS, FULL_ROW_LABEL, fullRowKey } from "@/lib/ihealthy-full-rows";
import { fullCardPath } from "@/lib/ihealthy-full-link";
import { iHealthyFullCard } from "@/lib/ihealthy-full-card";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";

/** Pinned, as the card's own tests are: a lapsed rate table has no price at all. */
const WHILE_CURRENT = new Date("2026-09-12");
const OPENING = "age=35&sex=M&base=WLF99HX&sa=50000&plan=GOLD&area=&cover=&mode=annual";
const full = (s: string) => iHealthyFullCard(new URLSearchParams(s), WHILE_CURRENT);

describe("the short names of the whole table", () => {
  it("names every line of the company's sheet, each once", () => {
    const keys = iHealthyFacts().rows.map(fullRowKey);
    expect(keys).not.toContain(undefined);
    expect(new Set(keys).size).toBe(keys.length);
    // every name but the endorsement's heading, which the sheet marks on its rows instead
    expect([...keys, "endorsement"].sort()).toEqual([...FULL_ROW_KEYS].sort());
  });

  it("has every name in every language", () => {
    for (const names of Object.values(FULL_ROW_LABEL)) {
      for (const key of FULL_ROW_KEYS) expect(names[key]?.trim()).toBeTruthy();
    }
  });
});

describe("the whole table as a picture", () => {
  const card = full(OPENING);
  const row = (label: string) => card.rows.find((r) => r.label === label)!;
  const th = FULL_ROW_LABEL.th;

  it("draws every category under the plan's ceiling, all six plans", () => {
    expect(card.columns).toHaveLength(6);
    expect(card.rows[1]).toMatchObject({ label: th.inpatient, kind: "group" });
    // 19 is drawn inside 18's row (the pair), every other name has a row of its own
    const named = card.rows.flatMap((r) => r.pair?.lines ?? [r.label]);
    for (const key of FULL_ROW_KEYS) expect(named).toContain(th[key]);
    for (const r of card.rows) if ((r.kind === undefined || r.kind === "sub") && r.span === undefined) expect(r.cells).toHaveLength(6);
  });

  it("sets the sub-rows under their category and the endorsement apart", () => {
    expect(row(th["2"])).toMatchObject({ kind: "heading", cells: [] });
    expect(row(th["2.1"]).kind).toBe("sub");
    const labels = card.rows.map((r) => r.label);
    expect(labels.indexOf(th.endorsement)).toBe(labels.indexOf(th["14"]) - 1);
  });

  it("prints the sheet's own figures", () => {
    const gold = card.columns.findIndex((c) => c.name === "Gold");
    expect(card.columns[gold].selected).toBe(true);
    expect(row(th["1"]).cells[gold].text).toBe("9,000 ต่อวัน");
    expect(row(th["18"]).cells[gold].text).toBe("12,000");
    expect(row(th["28"]).cells.at(-1)!.text).toBe("1,000,000");
    expect(card.premiumRows).toHaveLength(3);
  });

  it("draws OPD 18 and 19 as one row with one shared limit", () => {
    const gold = card.columns.findIndex((c) => c.name === "Gold");
    const opd = row(th["18"]);
    expect(opd.pair).toEqual({ lines: [th["18"], th["19"]], note: "วงเงินรวม/ปี" });
    expect(opd.cells[gold].text).toBe("12,000");
    expect(card.rows.find((r) => r.label === th["19"])).toBeUndefined();
    expect(full(`${OPENING}&l=zh`).rows.find((r) => r.pair)?.pair?.lines[1]).toBe(FULL_ROW_LABEL.zh["19"]);
  });

  it("is named in the page's language", () => {
    const en = full(`${OPENING}&l=en`);
    expect(en.rows.map((r) => r.label)).toContain(FULL_ROW_LABEL.en["18"]);
    expect(en.rows.find((r) => r.label === FULL_ROW_LABEL.en["1"])!.cells[3].text).toMatch(/9,000/);
  });

  it("keeps the quote card's own short table", () => {
    const short = iHealthyCard(new URLSearchParams(OPENING), WHILE_CURRENT);
    expect(short.rows.length).toBeLessThan(10);
    expect(full(`${OPENING}&fit=phone`).columns).toHaveLength(6);
  });

  it("is linked beside the card, with the same arrangement", () => {
    const path = fullCardPath(iHealthyTable(WHILE_CURRENT), IHEALTHY_OPENING, "zh");
    expect(path).toMatch(/^\/api\/ihealthy-card\/full\?age=/);
    expect(path).toMatch(/&l=zh$/);
    // its own revision on the card's, so the old whole table is not served from a cache
    expect(path).toMatch(/&cv=\d+-f2&/);
  });
});
