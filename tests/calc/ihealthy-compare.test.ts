import { describe, expect, it } from "vitest";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import {
  compareCells, comparePlans, compareText, visibleLines, type CompareLine,
} from "@/lib/ihealthy-compare";
import { compareLines, iHealthyCompareCard } from "@/lib/ihealthy-compare-card";
import { compareCardPath, comparePdfPath } from "@/lib/ihealthy-compare-link";
import { COMPARE_WORDS } from "@/lib/ihealthy-compare-words";
import { iHealthyFacts, isHeading } from "@/lib/ihealthy-facts";
import { FULL_ROW_LABEL } from "@/lib/ihealthy-full-rows";
import { LANGS } from "@/lib/ihealthy-lang";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { WORDS } from "@/lib/ihealthy-words";

/** Pinned, as the card's own tests are: a lapsed rate table has no price at all. */
const WHILE_CURRENT = new Date("2026-09-12");
const card = (age: number, sex: "M" | "F", lang?: string) => iHealthyCompareCard(
  new URLSearchParams(`age=${age}&sex=${sex}&base=WLF99HX&sa=50000&plan=GOLD&area=&cover=&mode=annual${lang ? `&l=${lang}` : ""}`),
  WHILE_CURRENT,
);
const th = FULL_ROW_LABEL.th;
const rowsOf = (lines: CompareLine[]) => lines.flatMap((l) => (l.kind === "row" ? [l] : []));
const FOUR = ["SMART", "BRONZE", "SILVER", "GOLD"];
const man35Tall = () => card(35, "M").rows.filter((r) => r.tall);

describe("the plans compared", () => {
  it("keeps the four the owner chose, and only those the age can buy", () => {
    expect(comparePlans(["SMART", "BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"])).toEqual(FOUR);
    expect(comparePlans(["SMART", "BRONZE"])).toEqual(["SMART", "BRONZE"]);
  });
});

describe("the lines of the table", () => {
  it("makes one line of a category whose sub-rows all say the same", () => {
    // the promise compareLines makes: a sub-row it leaves out says nothing the first one does not
    let first: (typeof rows)[number] | undefined;
    const rows = iHealthyFacts().rows;
    for (const entry of rows) {
      if (isHeading(entry)) { first = undefined; continue; }
      if (entry.no !== null) continue;
      if (!first) { first = entry; continue; }
      for (const age of [8, 35]) {
        expect(compareCells(entry, FOUR, age)).toEqual(compareCells(first, FOUR, age));
      }
    }
  });

  it("gives every language the same lines", () => {
    const thai = compareLines("th");
    for (const lang of LANGS) {
      const lines = compareLines(lang);
      expect(lines.map((l) => l.kind)).toEqual(thai.map((l) => l.kind));
      for (const line of lines) expect(line.label.trim()).toBeTruthy();
    }
  });

  it("draws OPD and physiotherapy as one shared limit", () => {
    const pair = rowsOf(compareLines("th")).filter((l) => l.pair);
    expect(pair).toHaveLength(1);
    expect(pair[0].pair).toEqual({ lines: [th["18"], th["19"]], note: "วงเงินรวม/ปี" });
    expect(rowsOf(compareLines("th")).map((l) => l.label)).not.toContain(th["19"]);
  });

  it("leaves out what none of the four pays, and the group that empties", () => {
    const adult = visibleLines(compareLines("th"), FOUR, 35);
    const labels = adult.map((l) => l.label);
    expect(labels).toContain(th["17"]);
    expect(labels).not.toContain(th["20"]);
    expect(labels).not.toContain(th["28"]);
    // not paying under any plan is still the company's answer, so it stays a row
    expect(labels).toContain(th["8"]);

    const child = visibleLines(compareLines("th"), ["SMART", "BRONZE"], 8);
    expect(child.map((l) => l.label)).not.toContain(th.endorsement);
    expect(child[child.length - 1].kind).toBe("row");
  });

  it("reads a child's doctor's fee from the sheet's child column", () => {
    const doctor = rowsOf(compareLines("th")).find((l) => l.label === th["3"])!;
    expect(compareCells(doctor.entry, ["SMART", "BRONZE"], 8).map((c) => c.text)).toEqual([
      "1,000 ต่อวัน*/ ตามที่จ่ายจริง", "3,000 ต่อวัน*/ ตามที่จ่ายจริง",
    ]);
    expect(compareCells(doctor.entry, ["SMART"], 11)[0].text).toBe("ตามที่จ่ายจริง");
  });
});

describe("the picture", () => {
  it("draws the four plans with the engine's premiums, no column lit", () => {
    const man = card(30, "M");
    expect(man.columns.map((c) => c.selected)).toEqual([false, false, false, false]);
    expect(man.premiumRows).toHaveLength(3);
    expect(man.premiumRows[0].cells[0].text).toBe("16,720");
    expect(card(35, "F").premiumRows[0].cells[3].text).toBe("45,810");
    for (const r of man.rows) if (r.cells.length > 0) expect(r.cells).toHaveLength(4);
  });

  it("draws only the two plans a child can have", () => {
    const child = card(8, "M");
    expect(child.columns).toHaveLength(2);
    expect(child.premiumRows[0].cells).toHaveLength(2);
    expect(child.rows.map((r) => r.span).filter(Boolean)).toHaveLength(1);
    // the limit and "as charged" in one cell take two lines, so that row is drawn taller
    expect(child.rows.filter((r) => r.tall).map((r) => r.label)).toEqual([th["3"]]);
    expect(man35Tall()).toEqual([]);
  });

  it("has no daily-cash row above the age the company writes it", () => {
    expect(card(70, "M").rows.filter((r) => r.span !== undefined)).toHaveLength(0);
  });

  it("is drawn in every language", () => {
    for (const lang of LANGS) expect(card(35, "F", lang).lang).toBe(lang);
  });
});

describe("what goes to the customer", () => {
  it("names each plan, its price in every instalment and who it is for", () => {
    const lines = visibleLines(compareLines("th"), ["SILVER"], 35);
    const text = compareText({
      age: 35, sex: "F", lifeSum: 50_000, lines, dailyCash: "ค่าชดเชยรายวัน 1,000 บาท",
      plans: [{ code: "SILVER", name: "ซิลเวอร์", ceiling: "15 ล้าน", premiums: [{ label: "รายปี", amount: "35,810" }] }],
    }, WORDS.th, COMPARE_WORDS.th);
    expect(text).toContain("หญิง 35 ปี");
    expect(text).toContain("🏆 ซิลเวอร์");
    expect(text).toContain("15 ล้าน/ปี");
    expect(text).toContain("ค่าห้องและอาหาร: 5,500 ต่อวัน");
    expect(text).toContain("OPD: 6,000 บาท/ปี (รวมกายภาพบำบัด)");
    expect(text).toContain("รายปี: 35,810 บาท");
    expect(text).toContain("ทุกแผนทุนประกันชีวิต 50,000 บาท");
  });

  it("says a plan has no OPD rather than printing a dash", () => {
    const text = compareText({
      age: 35, sex: "M", lifeSum: 50_000, lines: compareLines("th"),
      plans: [{ code: "SMART", name: "สมาร์ท", ceiling: "3 ล้าน", premiums: [] }],
    }, WORDS.th, COMPARE_WORDS.th);
    expect(text).toContain("OPD: ไม่มี");
  });
});

describe("the addresses", () => {
  const table = iHealthyTable(WHILE_CURRENT);
  it("gives the picture its own revision, so the whole table's cache is not its", () => {
    const path = compareCardPath(table, IHEALTHY_OPENING, "en");
    expect(path.startsWith("/api/ihealthy-card/compare?")).toBe(true);
    expect(path).toMatch(/&cv=[^&]*-c1/);
    expect(path).toContain("&l=en");
  });
  it("asks the PDF route for the compare page", () => {
    expect(comparePdfPath(table, IHEALTHY_OPENING)).toContain("page=ihealthy-ultra-compare&");
  });
});
