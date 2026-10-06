import { describe, expect, it } from "vitest";
import { cardInputFrom, cardPath, quoteCard, type BundleCardInput, type QuoteCard } from "@/lib/quote-card";

const MAN40: BundleCardInput = {
  kind: "bundle", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M", mode: "annual",
};

const params = (q: string) => new URLSearchParams(q);

describe("cardInputFrom, for a bundle", () => {
  it("reads a bundle and tier the registry knows", () => {
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=annual"))).toEqual(MAN40);
  });

  /**
   * A card is a public URL. Everything in it is checked before anything is drawn, so a
   * hand-edited link either names an arrangement the agency sells or gets nothing.
   */
  it("refuses anything the registry does not recognise", () => {
    expect(cardInputFrom(params("bundle=NOPE&tier=1&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=11&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=0&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1.5&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=120&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=X"))).toBeUndefined();
  });

  it("ignores a payment mode it does not sell", () => {
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=weekly"))?.mode)
      .toBeUndefined();
  });
});

describe("cardPath, for a bundle", () => {
  it("writes the arrangement into the address", () => {
    expect(cardPath(MAN40))
      .toMatch(/^\/api\/card\?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=annual&v=[0-9a-z]+-[0-9]+$/);
  });

  it("survives the round trip back into an input", () => {
    expect(cardInputFrom(new URLSearchParams(cardPath(MAN40).split("?")[1]))).toEqual(MAN40);
  });
});

/** The rate table behind these figures lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

const section = (card: QuoteCard, title: string) => card.sections.find((s) => s.title === title);

const PARTS = "ชุดนี้ประกอบด้วย";
const DEATH = "ครอบครัวได้รับเมื่อเสียชีวิต";
const ILLNESS = "ตรวจพบโรคร้ายแรง รับเงินก้อน";
const CASH = "มูลค่าเงินสดสะสม (หากเวนคืน)";
const DISEASES = "คุ้มครองโรคร้ายแรง 31 โรค";

describe("quoteCard, for a bundle", () => {
  it("names the bundle and the tier the customer picked", () => {
    const card = quoteCard(MAN40, WHILE_CURRENT)!;
    expect(card.planLine).toBe("ชุดมรดกเพื่อครอบครัว");
    expect(card.insuredWho).toBe("ชาย 40 ปี");
    expect(card.insuredLine).toBe("มรดก 1 ล้าน");
  });

  /**
   * 7,752 a year is the figure the golden test reads off the rate tables. The monthly
   * instalment is 698, under the company's 1,000 minimum, so it is neither the headline nor
   * offered in the box.
   */
  it("headlines the yearly premium when the monthly one cannot be paid", () => {
    const card = quoteCard(MAN40, WHILE_CURRENT)!;
    expect(card.premium).toEqual({ amount: "7,752", per: "ต่อปี" });
    expect(card.perDay).toBe("ตกวันละ 22 บาท");
    expect(card.summary).toEqual({
      title: "เบี้ยประกันที่ต้องชำระ",
      rows: [
        { label: "รายปี", amount: "7,752", main: true },
        { label: "ราย 6 เดือน", amount: "4,031", main: false },
      ],
    });
  });

  it("says what the arrangement is made of", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, PARTS)).toEqual({
      title: PARTS,
      rows: [
        { label: "Life Protect x 2 — ชำระเบี้ยครบอายุ 99 ปี", amount: "150,000" },
        { label: "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)", amount: "850,000" },
      ],
    });
  });

  /**
   * Three bands, not two: the base doubles before 60, and the rider stops at 75. A card that
   * said "อายุ 60 ปีขึ้นไป — 1,000,000" would promise cover that has ended.
   */
  it("bands the death benefit around both the doubling and the rider's end", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, DEATH)).toEqual({
      title: DEATH,
      rows: [
        { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: "1,150,000", mark: true },
        { label: "อายุ 60–74 ปี", amount: "1,000,000" },
        { label: "อายุ 75 ปีขึ้นไป", amount: "150,000" },
      ],
    });
  });

  it("states the lump sum a diagnosis pays", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, ILLNESS)).toEqual({
      title: ILLNESS,
      rows: [{ label: "จ่ายครั้งเดียว", amount: "850,000" }],
    });
  });

  /**
   * Names the illnesses rather than the surrender value.
   *
   * The surrender figures belong to the 150,000 base alone, so on this card they read as a
   * small number beside a million of cover — which is the arrangement's least interesting
   * fact and, next to the death benefit, its most misreadable. This bundle is sold on what
   * the family receives and what a diagnosis pays, so the block that shares the space lists
   * the illnesses that trigger the lump sum above it. Other bundles still take the common
   * cash-value block; the exception is Legacy's alone.
   */
  it("lists the illnesses the lump sum answers to, in place of a surrender value", () => {
    const card = quoteCard(MAN40, WHILE_CURRENT)!;
    expect(section(card, CASH)).toBeUndefined();
    const listed = section(card, DISEASES)!;
    expect(listed.rows).toEqual([]);
    expect(listed.items).toHaveLength(31);
    expect(listed.items).toContain("โรคสมองเสื่อมชนิดอัลไซเมอร์");
  });

  it("reads the four blocks in the order the customer needs them", () => {
    expect(quoteCard(MAN40, WHILE_CURRENT)!.sections.map((s) => s.title))
      .toEqual([PARTS, DEATH, ILLNESS, DISEASES]);
  });

  it("draws no card for an insured the bundle cannot be issued to", () => {
    // DCI leaves the bundle a 20-65 window
    expect(quoteCard({ ...MAN40, age: 19 }, WHILE_CURRENT)).toBeUndefined();
    expect(quoteCard({ ...MAN40, age: 66 }, WHILE_CURRENT)).toBeUndefined();
  });

  it("draws no card for a tier the bundle does not sell", () => {
    expect(quoteCard({ ...MAN40, tier: 99 }, WHILE_CURRENT)).toBeUndefined();
  });

  it("draws no card for a bundle the registry does not hold", () => {
    expect(quoteCard({ ...MAN40, bundleCode: "NOPE" }, WHILE_CURRENT)).toBeUndefined();
  });

  /** A lapsed table has no price, but the cover it was priced against is still what it is. */
  it("keeps the benefits and drops the price once the rate table has lapsed", () => {
    const card = quoteCard(MAN40, new Date("2027-04-01"))!;
    expect(card.premium).toBeNull();
    expect(card.perDay).toBeNull();
    expect(card.summary).toBeNull();
    expect(section(card, DEATH)!.rows[0].amount).toBe("1,150,000");
  });

  /** Every tier is the same 150,000 base, so only the rider and the totals move. */
  it("prices the top tier off the same base", () => {
    const card = quoteCard({ ...MAN40, tier: 10 }, WHILE_CURRENT)!;
    expect(card.insuredWho).toBe("ชาย 40 ปี");
    expect(card.insuredLine).toBe("มรดก 10 ล้าน");
    expect(card.premium).toEqual({ amount: "5,168", per: "ต่อเดือน" });
    expect(section(card, ILLNESS)!.rows[0].amount).toBe("9,850,000");
  });
});
