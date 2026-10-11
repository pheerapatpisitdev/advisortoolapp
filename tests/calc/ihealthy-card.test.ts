import { describe, expect, it } from "vitest";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { cardPath, ridersFrom, riderParams } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { iHealthyPricing } from "@/lib/ihealthy-quote";

/** Pinned, as its four siblings are: these are price assertions, and a rate table that has
 *  lapsed has no price at all — an unpinned clock turns that into six red tests on a date
 *  with no code change, pointing at the card and meaning "renew the rate table". */
const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);
/** The arrangement the page opens on, as an address. */
const OPENING = "age=35&sex=F&base=WLF99H&sa=150000&plan=GOLD&area=&cover=&mode=annual";
const query = (s: string) => new URLSearchParams(s);
const cardAt = (s: string) => iHealthyCard(query(s), WHILE_CURRENT);
const spanOf = (card: ReturnType<typeof iHealthyCard>, label: string) =>
  card.rows.find((r) => r.label === label)?.span;

describe("the riders in a card link", () => {
  it("writes each rider's fields in the order the engine takes them", () => {
    expect(riderParams([{ code: "MEB", plan: 1_000 }])).toEqual(["MEB:1000"]);
    expect(riderParams([{ code: "DCI", sumAssured: 500_000 }])).toEqual(["DCI::500000"]);
    expect(riderParams([{ code: "X", option: "แผน S" }])).toEqual(["X:::แผน S"]);
  });

  it("reads back what it wrote", () => {
    const riders = [{ code: "MEB", plan: 1_000 }, { code: "DCI", sumAssured: 500_000 }];
    expect(ridersFrom(riderParams(riders))).toEqual(riders);
  });

  it("carries PB's payer after its variant, and reads it back", () => {
    const pb = { code: "PB", option: "FIT", payer: { age: 38, sex: "M" as const } };
    expect(riderParams([pb])).toEqual(["PB:::FIT:38:M"]);
    expect(ridersFrom(["PB:::FIT:38:M"])).toEqual([pb]);
    // a variant with no payer after it is still the whole option
    expect(ridersFrom(["X:::แผน S"])).toEqual([{ code: "X", option: "แผน S" }]);
  });

  it("prices PB on the card at the payer the link names", () => {
    const card = cardAt("age=35&sex=M&base=WLF99H&sa=1000000&plan=GOLD&mode=annual&r=PB%3A%3A%3AFIT%3A33%3AF");
    const none = cardAt("age=35&sex=M&base=WLF99H&sa=1000000&plan=GOLD&mode=annual&r=");
    expect(card.premium?.amount).not.toEqual(none.premium?.amount);
  });

  it("keeps a colon inside a variant's own name", () => {
    expect(ridersFrom(["X:::a:b"])).toEqual([{ code: "X", option: "a:b" }]);
  });

  it("ignores a field that is not a whole number, and a rider with no code", () => {
    expect(ridersFrom(["MEB:many", ":1000", ""])).toEqual([{ code: "MEB" }]);
  });

  it("says nothing about riders until the fold has, and says so when it has nothing", () => {
    // silence and an empty answer are different arrangements, and the link has to tell them
    // apart or a card would put back the rider an agent had just taken off
    // as a whole key, since `cover=` ends in the same two characters
    expect(cardPath(table, IHEALTHY_OPENING)).not.toMatch(/[?&]r=/);
    expect(cardPath(table, { ...IHEALTHY_OPENING, riders: [] })).toMatch(/&r=(&|$)/);
    expect(cardPath(table, { ...IHEALTHY_OPENING, riders: [{ code: "MEB", plan: 1_000 }] }))
      .toContain("&r=MEB%3A1000");
  });
});

describe("iHealthyCard", () => {
  it("names the arrangement it is drawing", () => {
    const card = cardAt(OPENING);
    expect(card.planLine).toBe("iHealthy Ultra Gold");
    expect(card.insuredWho).toBe("หญิง 35 ปี");
    expect(card.insuredLine).toContain("150,000");
    expect(card.insuredLine).toContain("ประเทศไทย");
  });

  it("carries every plan as a column, with the one being priced marked", () => {
    const card = cardAt(OPENING);
    expect(card.columns.map((c) => c.name)).toEqual(
      ["Smart", "Bronze", "Silver", "Gold", "Diamond", "Platinum"],
    );
    expect(card.columns.filter((c) => c.selected).map((c) => c.name)).toEqual(["Gold"]);
    expect(card.columns.every((c) => c.sold)).toBe(true);
  });

  it("condenses the sheet to the rows the phone shows, and prices all three instalments", () => {
    const card = cardAt(OPENING);
    expect(card.rows.map((r) => r.label)).toEqual([
      "วงเงินค่ารักษาต่อปี",
      "ค่าห้องและค่าอาหาร",
      "Day Surgery",
      "อุบัติเหตุ OPD 24 ชม",
      "มะเร็ง รังสีรักษา",
      "ผู้ป่วยนอก OPD",
      "ค่าชดเชยรายวัน",
    ]);
    expect(card.premiumRows.map((r) => r.label)).toEqual(["รายปี", "ราย 6 เดือน", "รายเดือน"]);
    // every priced row answers for all six plans
    for (const row of card.premiumRows) expect(row.cells).toHaveLength(6);
  });

  it("prices exactly what the page's own card prices", () => {
    const card = cardAt(OPENING);
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000,
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    const annual = priced.total.find((m) => m.mode === "annual")!.total;
    expect(card.premium?.amount).toBe(Math.floor(annual / 100).toLocaleString("en-US"));
    // and the table under it says the same figure in the column the card is pricing
    expect(card.premiumRows[0].cells[3].text).toBe(card.premium?.amount);
  });

  /**
   * The picture headlines one premium. Under it the lines name the halves it is made of, and
   * naming is all they do: beside 43,800 for the health cover, the life half's 710 read as
   * the part of the arrangement worth arguing about.
   */
  it("names what the premium is made of without pricing each half", () => {
    const card = cardAt(OPENING);
    expect(card.lines.length).toBeGreaterThan(0);
    for (const line of card.lines) {
      expect(Object.keys(line)).toEqual(["label"]);
    }
    expect(card.premium?.amount).toBeDefined();
  });

  it("quotes the agency's standard daily cash where the fold has not spoken", () => {
    const card = cardAt(OPENING);
    expect(spanOf(card, "ค่าชดเชยรายวัน")).toContain("1,000 ต่อวัน");
    expect(card.lines.some((l) => l.label.includes("ค่าชดเชยรายวัน"))).toBe(true);
  });

  it("takes it off when the fold says it is off, and charges less", () => {
    const on = cardAt(OPENING);
    const off = cardAt(`${OPENING}&r=`);
    expect(spanOf(off, "ค่าชดเชยรายวัน")).toBe("-");
    expect(off.lines.some((l) => l.label.includes("ค่าชดเชยรายวัน"))).toBe(false);
    // an emptied fold subtotals to nothing, and no line is printed for nothing
    expect(off.lines).toHaveLength(2);
    expect(Number(off.premium!.amount.replace(/,/g, ""))).toBeLessThan(
      Number(on.premium!.amount.replace(/,/g, "")),
    );
  });

  it("counts the riders rather than listing them, once there is more than one", () => {
    const card = cardAt(`${OPENING}&r=MEB%3A1000&r=DCI%3A%3A500000`);
    expect(card.lines.some((l) => l.label === "สัญญาเพิ่มเติม 2 รายการ")).toBe(true);
    const bare = cardAt(`${OPENING}&r=MEB%3A1000`);
    expect(Number(card.premium!.amount.replace(/,/g, ""))).toBeGreaterThan(
      Number(bare.premium!.amount.replace(/,/g, "")),
    );
  });

  it("refuses a rider the age cannot buy rather than pricing it", () => {
    // DCI is written from 20; the link may ask for it at 8 and the engine still will not
    const card = cardAt("age=8&sex=M&base=WLF99H&sa=150000&plan=BRONZE&r=DCI%3A%3A500000");
    expect(card.lines.some((l) => l.label.includes("สัญญาเพิ่มเติม"))).toBe(false);
    expect(spanOf(card, "ค่าชดเชยรายวัน")).toBe("-");
  });

  it("withholds the figures in a column the company will not sell at this age", () => {
    const card = cardAt("age=8&sex=M&base=WLF99H&sa=150000&plan=BRONZE");
    const dim = card.columns.filter((c) => !c.sold).map((c) => c.name);
    expect(dim).toContain("Gold");
    const room = card.rows.find((r) => r.label === "ค่าห้องและค่าอาหาร")!;
    expect(room.cells[3]).toEqual({ text: "-", dim: true });
    expect(room.cells[1].dim).toBe(false);
  });

  it("still describes the cover once the rate table has lapsed, and quotes no price", () => {
    const card = iHealthyCard(query(OPENING), new Date("2099-01-01"));
    expect(card.premium).toBeUndefined();
    expect(card.lines).toEqual([]);
    expect(card.premiumRows).toEqual([]);
    expect(card.rows.find((r) => r.label === "ค่าห้องและค่าอาหาร")!.cells[3].text).toBe("9,000 ต่อวัน");
  });

  it("answers a query that asks for nothing at all", () => {
    const card = cardAt("");
    expect(card.planLine).toBe("iHealthy Ultra Gold");
    expect(card.premium).toBeDefined();
  });

  it("names the daily cash by the plan attached, not by the agency's own", () => {
    // The fold offers 500 to 5,000 at this age. Reading the name off the agency's standard
    // put "1,000 บาท" over a 5,000-a-day premium, two rows above its own table saying 5,000.
    const big = cardAt(`${OPENING}&r=MEB%3A5000`);
    expect(big.lines.map((l) => l.label)).toContain("ค่าชดเชยรายวัน 5,000 บาท");
    expect(spanOf(big, "ค่าชดเชยรายวัน")).toContain("5,000 ต่อวัน");
    const small = cardAt(`${OPENING}&r=MEB%3A500`);
    expect(small.lines.map((l) => l.label)).toContain("ค่าชดเชยรายวัน 500 บาท");
    expect(spanOf(small, "ค่าชดเชยรายวัน")).toContain("500 ต่อวัน");
    // and the three prices differ, which is what makes naming them apart matter
    const amounts = [small, cardAt(`${OPENING}&r=MEB%3A1000`), big]
      .map((c) => Number(c.premium!.amount.replace(/,/g, "")));
    expect(amounts[0]).toBeLessThan(amounts[1]);
    expect(amounts[1]).toBeLessThan(amounts[2]);
  });

  it("adds what a rider pays on death to what the family receives", () => {
    const bare = cardAt(`${OPENING}&sa=1000000&r=MEB%3A1000`);
    const withDci = cardAt(`${OPENING}&sa=1000000&r=MEB%3A1000&r=DCI%3A%3A1000000`);
    // the base pays double before 60; DCI's own million rides on top of that
    expect(bare.death[0].amount).toBe(2_000_000);
    expect(withDci.death[0].amount).toBe(3_000_000);
  });

  /**
   * A rider that pays on death can stop paying before the base does. The hand-written line
   * said "ตั้งแต่อายุ 60 คุ้มครองเท่าทุน" over a figure half again the sum assured and never
   * mentioned the age it falls back at.
   */
  it("says when the extra cover ends, not just what it is worth", () => {
    const card = cardAt("age=62&sex=M&base=WLF99H&sa=1000000&plan=GOLD&r=DCI%3A%3A500000");
    expect(card.death.map((r) => r.amount)).toEqual([1_500_000, 1_000_000]);
    expect(card.death[0].label).toContain("74");
    expect(card.death[1].label).toContain("75");
    // and nothing on the picture claims the larger figure is the sum assured
    expect(card.death.some((r) => r.label.includes("เท่าทุน"))).toBe(false);
  });

  it("survives a link stuffed with riders", () => {
    // The engine rejects a whole request carrying more riders than the plan sells, so a link
    // like this used to answer with nothing on offer and a total of zero.
    const stuffed = Array.from({ length: 400 }, (_, i) => `r=JUNK${i}`).join("&");
    const card = cardAt(`${OPENING}&r=MEB%3A1000&${stuffed}`);
    expect(card.lines.some((l) => l.label.includes("ค่าชดเชยรายวัน 1,000"))).toBe(true);
    expect(card.premium).toBeDefined();
  });

  it("takes a rider named twice at the value the fold would hold", () => {
    const twice = cardAt(`${OPENING}&r=MEB%3A1000&r=MEB%3A5000`);
    expect(twice.lines.map((l) => l.label)).toContain("ค่าชดเชยรายวัน 1,000 บาท");
    expect(spanOf(twice, "ค่าชดเชยรายวัน")).toContain("1,000 ต่อวัน");
  });

  it("reads a link whose riders one bad entry would once have voided", () => {
    // a chat client that truncated the link, or a figure past the engine's ceiling
    const card = cardAt(`${OPENING}&r=MEB%3A1000&r=DCI%3A%3A999999999999`);
    expect(card.lines.some((l) => l.label.includes("ค่าชดเชยรายวัน 1,000"))).toBe(true);
    expect(card.premium).toBeDefined();
  });

  it("dashes an instalment the company will not accept", () => {
    // male 18 on the package, สมาร์ท with a deductible and an emptied fold: the monthly
    // instalment falls under the company's floor, and a figure in that column would be an
    // offer to be paid a way that cannot be bought
    const card = cardAt("age=18&sex=M&base=WLF99HX&plan=SMART&cover=D&r=");
    const monthly = card.premiumRows.find((r) => r.label === "รายเดือน")!;
    expect(monthly.cells[0].text).toBe("-");
    // the yearly instalment for the same plan is still a real figure
    expect(card.premiumRows.find((r) => r.label === "รายปี")!.cells[0].text).not.toBe("-");
  });
});

describe("a card sized for a chat", () => {
  const at = (params: Record<string, string>) =>
    iHealthyCard(new URLSearchParams({ age: "35", sex: "F", plan: "GOLD", ...params }));

  it("carries six plans when nothing asks for fewer", () => {
    expect(at({}).columns).toHaveLength(6);
  });

  it("carries the three a phone shows when it does", () => {
    const card = at({ fit: "phone" });
    expect(card.columns.map((c) => c.name)).toEqual(["Bronze", "Silver", "Gold"]);
    expect(card.columns.filter((c) => c.selected)).toHaveLength(1);
  });

  it("keeps the plan it is pricing, even outside the three", () => {
    const card = at({ plan: "PLATINUM", fit: "phone" });
    expect(card.columns.map((c) => c.name)).toEqual(["Bronze", "Silver", "Gold", "Platinum"]);
    expect(card.columns.find((c) => c.selected)!.name).toBe("Platinum");
  });

  it("carries only what a child may buy", () => {
    const card = iHealthyCard(new URLSearchParams({ age: "8", sex: "M", plan: "SMART", fit: "phone" }));
    expect(card.columns.map((c) => c.name)).toEqual(["Smart", "Bronze"]);
    expect(card.columns.every((c) => c.sold)).toBe(true);
  });

  it("prices every column it carries", () => {
    const card = at({ fit: "phone" });
    for (const row of card.premiumRows) expect(row.cells).toHaveLength(card.columns.length);
    for (const row of card.rows) {
      if (row.span === undefined) expect(row.cells).toHaveLength(card.columns.length);
    }
  });
});
