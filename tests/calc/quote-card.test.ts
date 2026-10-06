import { describe, expect, it } from "vitest";
import { cardInputFrom, cardPath, cardUrl, quoteCard, valueTableCard, valueTableChart, type CardInput, type PlanCardInput, type QuoteCard } from "@/lib/quote-card";

/** The rate table behind these figures lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

const MAN35: CardInput = {
  kind: "plan",
  planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, mode: "monthly",
};

const params = (q: string) => new URLSearchParams(q);

describe("cardInputFrom", () => {
  it("reads an arrangement the registry knows", () => {
    expect(cardInputFrom(params("plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&mode=monthly")))
      .toEqual(MAN35);
  });

  it("falls back to the plan's own default term", () => {
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=M&sum=1000000")))
      .toMatchObject({ kind: "plan", variant: "WLF99H" });
  });

  /** A card is a public URL, so everything in it is checked before anything is drawn. */
  it("refuses anything the registry does not recognise", () => {
    expect(cardInputFrom(params("plan=NOPE&age=35&sex=M&sum=1000000"))).toBeUndefined();
    // a term that belongs to another plan
    expect(cardInputFrom(params("plan=LIFEPROTECT&variant=WLCI10&age=35&sex=M&sum=1000000"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=120&sex=M&sum=1000000"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=X&sum=1000000"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=M&sum=0"))).toBeUndefined();
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35.5&sex=M&sum=1000000"))).toBeUndefined();
  });

  it("ignores a payment mode it does not sell", () => {
    expect(cardInputFrom(params("plan=LIFEPROTECT&age=35&sex=M&sum=1000000&mode=weekly"))?.mode).toBeUndefined();
  });
});

describe("cardPath and cardUrl", () => {
  it("writes the arrangement into the address", () => {
    expect(cardPath(MAN35))
      .toMatch(/^\/api\/card\?plan=LIFEPROTECT&variant=WLF19H&age=35&sex=M&sum=1000000&mode=monthly&v=[0-9a-z]+-[0-9]+$/);
  });

  /**
   * Asserted as "there is one", not as its value: it is a fingerprint of the palette, so
   * pinning the literal would make every colour change a test edit — and the test would be
   * restating the hash function rather than checking anything.
   */
  it("carries the palette's fingerprint, so a re-coloured card is not served from cache", () => {
    const v = new URLSearchParams(cardPath(MAN35).split("?")[1]).get("v");
    expect(v).toMatch(/^[0-9a-z]+-[0-9]+$/);
    // the same arrangement always asks for the same address, or nothing would ever cache
    expect(cardPath(MAN35)).toBe(cardPath(MAN35));
  });

  it("survives the round trip back into an input", () => {
    const path = cardPath(MAN35);
    expect(cardInputFrom(new URLSearchParams(path.split("?")[1]))).toEqual(MAN35);
  });

  it("hangs the same path off a host, for the channels that fetch it themselves", () => {
    expect(cardUrl("https://www.advisortool.app", MAN35))
      .toBe(`https://www.advisortool.app${cardPath(MAN35)}`);
  });
});

const section = (card: QuoteCard, title: string) => card.sections.find((s) => s.title === title);

const DEATH = "ครอบครัวได้รับเมื่อเสียชีวิต";
const CASH = "มูลค่าเงินสดสะสม (หากเวนคืน)";

describe("quoteCard", () => {
  it("draws what the sales page shows for the same insured", () => {
    const card = quoteCard(MAN35, WHILE_CURRENT)!;
    expect(card.planLine).toBe("Life Protect x 2 · ชำระเบี้ย 19 ปี");
    expect(card.insuredWho).toBe("ชาย 35 ปี");
    expect(card.insuredLine).toBe("ทุน 1,000,000 บาท");
    expect(card.premium).toEqual({ amount: "2,583", per: "ต่อเดือน" });
    expect(card.perDay).toBe("ตกวันละ 79 บาท");
    // the page's box: largest first, the headline set large, the first two monthly instalments under it
    expect(card.summary).toEqual({
      title: "เบี้ยประกันที่ต้องชำระ",
      rows: [
        { label: "รายปี", amount: "28,700", main: false },
        { label: "ราย 6 เดือน", amount: "14,924", main: false },
        { label: "รายเดือน", amount: "2,583", main: true, after: "ชำระเบี้ยครั้งแรก 2 งวด 5,166 บาท" },
      ],
    });
  });

  it("bands the death benefit the way every other surface does", () => {
    expect(section(quoteCard(MAN35, WHILE_CURRENT)!, DEATH)).toEqual({
      title: DEATH,
      rows: [
        // the most the family can receive is the figure the card highlights
        { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: "2,000,000", mark: true },
        { label: "อายุ 60 ปีขึ้นไป", amount: "1,000,000" },
      ],
    });
  });

  /**
   * The Life Protect page dropped its milestone list (owner, 2026-10-06) — the chart and the
   * year-by-year table carry every one of them — and its card follows the page.
   */
  it("draws no milestone list for Life Protect, as its page shows none", () => {
    expect(quoteCard(MAN35, WHILE_CURRENT)!.sections.map((s) => s.title)).toEqual([DEATH]);
  });

  /** Easy Protect's page still lists its milestones, so its card still does. */
  const EASY35: CardInput = {
    kind: "plan", planCode: "EASYPROTECT", variant: "W99F06A", age: 35, sex: "M", sumAssured: 1_000_000,
  };

  it("quotes the surrender value at the milestones still ahead", () => {
    expect(section(quoteCard(EASY35, WHILE_CURRENT)!, CASH)!.rows).toEqual([
      { label: "อายุ 60 ปี", amount: "503,000" },
      { label: "อายุ 70 ปี", amount: "632,000" },
      { label: "อายุ 80 ปี", amount: "776,000" },
      { label: "อายุ 99 ปี", amount: "1,000,000" },
    ]);
  });

  /** The order the bands are drawn in is the order the customer reads them. */
  it("puts what the family receives above what surrender would return", () => {
    expect(quoteCard(EASY35, WHILE_CURRENT)!.sections.map((s) => s.title)).toEqual([DEATH, CASH]);
  });

  it("leaves out the milestones an older insured has already passed", () => {
    const rows = section(quoteCard({ ...EASY35, age: 65 }, WHILE_CURRENT)!, CASH)!.rows;
    expect(rows.map((r) => r.label)).toEqual(["อายุ 70 ปี", "อายุ 80 ปี", "อายุ 99 ปี"]);
  });

  /** A card is a picture of a price, and a lapsed table has no price to show. */
  it("shows no premium once the rate table has lapsed", () => {
    const card = quoteCard(MAN35, new Date("2027-04-01"))!;
    expect(card.premium).toBeNull();
    expect(card.perDay).toBeNull();
    expect(card.summary).toBeNull();
    // the benefits do not come from the rate table, so they are still true and still drawn
    expect(section(card, DEATH)!.rows[0].amount).toBe("2,000,000");
  });

  it("draws nothing for an arrangement the company will not issue", () => {
    // iShield stops at 5,000,000, so a card for ten million is a card for nothing
    expect(quoteCard(
      { kind: "plan", planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 10_000_000 },
      WHILE_CURRENT,
    )).toBeUndefined();
  });

  it("states what ไลฟ์เทรเชอร์ pays, which the engine has no field for", () => {
    const card = quoteCard(
      { kind: "plan", planCode: "LIFETREASURE", variant: "H99F18A", age: 45, sex: "M", sumAssured: 10_000_000 },
      WHILE_CURRENT,
    )!;
    expect(section(card, "ครอบครัวได้รับเมื่อเสียชีวิต")).toEqual({
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{ label: "ทุกช่วงอายุ ถึงอายุ 99", amount: "10,000,000", mark: true }],
    });
    // the surrender table was extracted for this plan, so the card carries it, and its table the chart
    expect(section(card, CASH)).toBeDefined();
    expect(valueTableChart(
      { kind: "plan", planCode: "LIFETREASURE", variant: "H99F18A", age: 45, sex: "M", sumAssured: 10_000_000 },
      888, WHILE_CURRENT,
    )).toBeDefined();
    // a four-figure day rate is grouped like every other figure on the card
    expect(card.perDay).toBe("ตกวันละ 1,014 บาท");
  });

  it("prices a plan whose labels carry no product name", () => {
    const card = quoteCard(
      { kind: "plan", planCode: "PLB", variant: "PLB10", age: 35, sex: "F", sumAssured: 500_000 },
      WHILE_CURRENT,
    )!;
    expect(card.planLine).toBe("Protection Life (PLB) · ชำระเบี้ย 10 ปี");
    // PLB has no cash-value table extracted, so the card simply has no such section
    expect(section(card, CASH)).toBeUndefined();
    // the engine finds no death benefit for a plan with no booster, so the card states it
    expect(section(card, "ครอบครัวได้รับเมื่อเสียชีวิต")).toEqual({
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{ label: "ตลอด 10 ปีที่คุ้มครอง (ถึงอายุ 45)", amount: "500,000", mark: true }],
    });
  });
});

/**
 * iShield's illnesses are a property of the base contract rather than of a rider, and its
 * death benefit has no booster for the engine's deathBenefitFor to find — so before this the
 * card carried a price and a surrender schedule and said nothing about what the policy pays.
 */
describe("the value table card", () => {
  const NINE_YEARS: PlanCardInput = { ...(MAN35 as PlanCardInput), variant: "WLF09H" };

  it("heads the same columns as the table on the sales page", () => {
    expect(valueTableCard(NINE_YEARS, WHILE_CURRENT)!.columns)
      .toEqual(["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"]);
  });

  it("runs every policy year from the first to the end of the contract", () => {
    const card = valueTableCard(NINE_YEARS, WHILE_CURRENT)!;
    expect(card.rows[0]).toMatchObject({ year: 1, age: 35 });
    expect(card.rows.at(-1)!.year).toBe(card.rows.length);
  });

  it("shows the premium falling due each year, and stops when the paying does", () => {
    const rows = valueTableCard(NINE_YEARS, WHILE_CURRENT)!.rows;
    expect(rows[0].due).toBe("54,600");
    expect(rows[8].due).toBe("54,600");
    // a dash, not a nought: there is nothing to pay, the year is not worth nothing
    expect(rows[9].due).toBe("—");
    // and what has been paid stops climbing with it
    expect(rows[8].paid).toBe(rows[9].paid);
  });

  it("marks the year the policy is first worth what has gone into it", () => {
    const marked = valueTableCard(NINE_YEARS, WHILE_CURRENT)!.rows.filter((r) => r.breakEven);
    expect(marked).toHaveLength(1);
    expect(Number(marked[0].cash!.replace(/,/g, ""))).toBeGreaterThanOrEqual(Number(marked[0].paid!.replace(/,/g, "")));
  });
});

describe("the iShield card", () => {
  const card = quoteCard(
    { kind: "plan", planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 1_000_000 },
    new Date("2026-09-05"),
  )!;

  it("leads with what the contract pays, before what it is worth on surrender", () => {
    expect(card.sections.map((s) => s.title)).toEqual(["รับเงินก้อนเมื่อ", "มูลค่าเงินสดสะสม (หากเวนคืน)"]);
    expect(card.sections[0].rows).toEqual([
      { label: "ตรวจพบโรคร้ายแรงระยะรุนแรง (50 โรค)", amount: "1,000,000", mark: true },
      { label: "ตรวจพบระยะเริ่มต้น (20 โรค) ต่อโรค", amount: "250,000" },
      { label: "เสียชีวิต", amount: "1,000,000" },
      { label: "อยู่ครบสัญญาอายุ 85 ปี", amount: "1,000,000" },
    ]);
  });

  it("does not promise a maturity to someone who is already past it", () => {
    const old = quoteCard(
      { kind: "plan", planCode: "ISHIELD", variant: "WLCI15", age: 56, sex: "M", sumAssured: 1_000_000 },
      new Date("2026-09-05"),
    )!;
    expect(old.sections[0].rows.map((r) => r.label)).toContain("อยู่ครบสัญญาอายุ 85 ปี");
  });
});

/** On the value table's picture since 2026-10-06, drawn as wide as the table. */
describe("the chart on a value table", () => {
  const LIFE_PROTECT: PlanCardInput = {
    kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000,
  };

  it("draws three lines over the whole contract, and rules the sum assured", () => {
    const c = valueTableChart(LIFE_PROTECT, 888, WHILE_CURRENT)!;
    expect(c.topLabel).toBe("2 ล้าน");
    expect(c.grid?.label).toBe("1 ล้าน");
    expect(c.ticks.map((t) => t.label)).toEqual(["35", "40", "50", "60", "70", "80", "90", "99"]);
    // one point per policy year on the two sloping lines, two per year on the cover's steps
    expect(c.cash.split(" ")).toHaveLength(64);
    expect(c.premium!.split(" ")).toHaveLength(64);
    expect(c.cover.split(" ")).toHaveLength(128);
    expect(c.breakEven?.label).toBe("เท่าทุนอายุ 98");
  });

  it("spans the width it is given, ages and all", () => {
    const wide = valueTableChart(LIFE_PROTECT, 1796, WHILE_CURRENT)!;
    expect(wide.width).toBe(1796);
    expect(wide.ticks.at(-1)!.x).toBe(1796 - 14);
  });

  it("names the year iShield's surrender value overtakes its premiums", () => {
    const chart = valueTableChart(
      { kind: "plan", planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 1_000_000 },
      888, WHILE_CURRENT,
    );
    expect(chart?.breakEven?.label).toBe("เท่าทุนอายุ 60");
    expect(chart?.topLabel).toBe("1 ล้าน");
  });

  it("is left off a plan whose benefit sheet has not been read", () => {
    expect(valueTableChart(
      { kind: "plan", planCode: "PLB", variant: "PLB10", age: 35, sex: "M", sumAssured: 1_000_000 },
      888, WHILE_CURRENT,
    )).toBeUndefined();
  });

  /** The quote card no longer carries one: the owner moved it to the table. */
  it("is not on the quote card", () => {
    expect("chart" in quoteCard(LIFE_PROTECT, WHILE_CURRENT)!).toBe(false);
  });
});
