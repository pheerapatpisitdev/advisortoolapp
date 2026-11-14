import { describe, expect, it } from "vitest";
import type { IHealthyShown } from "@/components/IHealthyCalculator";
import { iHealthyMessage, iHealthyQuoteText, type IHealthyCtaFacts } from "@/lib/ihealthy-cta";

/**
 * หญิง 35 · ไลฟ์ โพรเทค+ x 2 ทุน 150,000 · โกลด์ · ประเทศไทย, with the agent's fold emptied —
 * which is why it carries no daily cash. The page's own opening does carry one; that is the
 * fixture below.
 */
const SHOWN: IHealthyShown = {
  base: 213_000,
  rider: 4_380_000,
  total: 4_593_000,
  belowMinimum: false,
  others: [{ mode: "semi", total: 2_388_300 }, { mode: "monthly", total: 413_300 }],
  refused: [],
};

/** The same arrangement as the page actually opens on it: the agency's daily cash attached. */
const WITH_DAILY_CASH: IHealthyShown = {
  ...SHOWN,
  standard: { label: "ค่าชดเชยรายวัน 1,000 บาท", total: 130_000 },
  total: 4_723_000,
};

const GOLD = {
  planName: "Gold", annualMax: 25_000_000, territory: "ประเทศไทย",
  coverage: "Full Coverage", deductible: 50_000,
};

const facts: IHealthyCtaFacts = {
  arrangement: GOLD,
  copayPercent: 20,
  age: 35,
  sex: "F",
  baseLabel: "ไลฟ์ โพรเทค+ x 2",
  sumAssured: 150_000,
  death: { beforeAge: 60, sumBefore: 300_000, sumFrom: 150_000, alreadyPastAge: false },
  mode: "annual",
  minMonthly: 1_000,
  shown: SHOWN,
  benefits: { room: "9,000 ต่อวัน", opd: "12,000" },
};

describe("iHealthyMessage", () => {
  it("opens the chat with what is on screen", () => {
    expect(iHealthyMessage(facts)).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย หญิง 35 ปี เบี้ยรวมประมาณ 45,930 บาท/ปี",
    );
  });

  it("says which instalment the figure is", () => {
    expect(iHealthyMessage({ ...facts, mode: "monthly", shown: { ...SHOWN, total: 413_300 } }))
      .toBe("สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย หญิง 35 ปี เบี้ยรวมประมาณ 4,133 บาท/เดือน");
  });

  /** An arrangement paid for out of pocket up to a point is not the same product. */
  it("names a coverage that is not the plain one", () => {
    expect(iHealthyMessage({ ...facts, arrangement: { ...GOLD, coverage: "Co-Payment" }, sex: "M" })).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย แบบร่วมจ่าย ชาย 35 ปี เบี้ยรวมประมาณ 45,930 บาท/ปี",
    );
  });

  it("asks for a price instead when none is being shown", () => {
    expect(iHealthyMessage({ ...facts, shown: undefined })).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra Gold ประเทศไทย หญิง 35 ปี ขอราคาปัจจุบัน",
    );
  });

  /** A rate revision that withdrew every plan at an age would land here. */
  it("asks for something that fits when the age has no arrangement at all", () => {
    const none = { ...facts, arrangement: undefined, shown: undefined };
    expect(iHealthyMessage({ ...none, age: 79 })).toBe(
      "สนใจประกันสุขภาพ iHealthy Ultra หญิง 79 ปี ขอแบบที่เหมาะกับอายุนี้",
    );
    expect(iHealthyQuoteText(none)).toBeUndefined();
  });
});

describe("iHealthyQuoteText", () => {
  it("writes the summary an agent pastes into a chat", () => {
    expect(iHealthyQuoteText(facts)).toBe([
      "🏥 iHealthy Ultra Gold",
      "วงเงินค่ารักษา 25,000,000 บาทต่อปี",
      "",
      "- ค่าห้องและอาหาร 9,000 บาทต่อวัน",
      "- ค่ารักษาพยาบาล 25,000,000 บาทต่อปี",
      "- OPD 12,000 บาทต่อปี (รวมกายภาพบำบัด)",
      "",
      "หญิง อายุ 35 ปี",
      "รายเดือน 4,133 บาท",
      "ราย 6 เดือน 23,883 บาท",
      "รายปี 45,930 บาท",
      "",
      "📌 เบี้ยปีแรก เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น",
      "เบี้ยของอาชีพชั้น 1 · ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์",
    ].join("\n"));
  });

  /**
   * The sentence that has to outlive the page. A quote in a chat has nothing around it to
   * say that the rider is priced on attained age, and a customer who reads 45,930 as the
   * price of the plan will meet three times that at seventy.
   */
  it("always says the premium is a first-year one, of an occupation class", () => {
    for (const mode of ["annual", "semi", "monthly"] as const) {
      const text = iHealthyQuoteText({ ...facts, mode })!;
      expect(text).toContain("เบี้ยปีแรก เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น");
      expect(text).toContain("อาชีพชั้น 1");
      // the sentence every sibling page carries: a pasted quote travels further than the
      // page it came from, and on this product underwriting most often moves the premium
      expect(text).toContain("ไม่ใช่ใบเสนอราคา");
    }
  });

  /** A per-day figure would read as a price that holds, on the one plan whose price does not. */
  it("offers no per-day figure to soften it", () => {
    expect(iHealthyQuoteText(facts)).not.toContain("วันละ");
  });

  it("prints what the customer carries themselves under each arrangement", () => {
    expect(iHealthyQuoteText({ ...facts, arrangement: { ...GOLD, coverage: "Deductible" } }))
      .toContain("วงเงินค่ารักษา 25,000,000 บาทต่อปี · รับผิดส่วนแรก 50,000 บาทต่อปี\n");
    expect(iHealthyQuoteText({ ...facts, arrangement: { ...GOLD, coverage: "Co-Payment" } }))
      .toContain("· ร่วมจ่าย 20 เปอร์เซ็นต์ของค่าใช้จ่ายที่คุ้มครอง\n");
  });

  /** The cheapest arrangement the pickers reach is under the company's monthly floor. */
  it("names an instalment the company will not take, with the reason", () => {
    const text = iHealthyQuoteText({
      ...facts, mode: "monthly",
      shown: { ...SHOWN, total: 94_500, belowMinimum: true, others: [{ mode: "annual", total: 1_050_000 }, { mode: "semi", total: 546_000 }] },
    })!;
    expect(text).toContain("รายเดือน 945 บาท (ต่ำกว่าขั้นต่ำ 1,000 บาท บริษัทไม่รับชำระรายเดือน)");
    // and the two instalments the company does take are said plainly
    expect(text).toContain("ราย 6 เดือน 5,460 บาท\nรายปี 10,500 บาท");
  });

  /** Thailand is the territory unless another is named (owner, 2026-11-14). */
  it("names a territory only when it is not Thailand", () => {
    expect(iHealthyQuoteText(facts)).not.toContain("อาณาเขต");
    expect(iHealthyQuoteText({ ...facts, arrangement: { ...GOLD, territory: "เอเชีย" } }))
      .toContain("วงเงินค่ารักษา 25,000,000 บาทต่อปี · อาณาเขตเอเชีย\n");
  });

  /** สมาร์ท and บรอนซ์ pay no OPD: no line, rather than a line of nothing (owner, ก). */
  it("has no OPD line on a plan that pays none", () => {
    const text = iHealthyQuoteText({ ...facts, benefits: { room: "1,500 ต่อวัน" } })!;
    expect(text).toContain("- ค่าห้องและอาหาร 1,500 บาทต่อวัน\n- ค่ารักษาพยาบาล 25,000,000 บาทต่อปี\n\nหญิง");
    expect(text).not.toContain("OPD");
  });

  /** แพลทินัม pays OPD as charged, which is not a yearly figure. */
  it("puts no unit on an OPD that is not a figure", () => {
    expect(iHealthyQuoteText({ ...facts, benefits: { room: "21,000 ต่อวัน", opd: "ตามที่จ่ายจริง" } }))
      .toContain("- OPD ตามที่จ่ายจริง (รวมกายภาพบำบัด)");
  });

  it("has nothing to copy when no price may be shown", () => {
    expect(iHealthyQuoteText({ ...facts, shown: undefined })).toBeUndefined();
  });

  /**
   * The life half is not in the text at all (owner, 2026-11-14, ก): no split, no life sum, no
   * death benefit, and the yearly instalment is the one total.
   */
  it("carries the instalments and nothing of the life half", () => {
    const text = iHealthyQuoteText(facts)!;
    expect(text).not.toContain("เบี้ยรวมประมาณ");
    expect(text).not.toContain("ทุน 150,000");
    expect(text).not.toContain("เสียชีวิต");
    expect(text).not.toContain("2,130");
    expect(text).not.toContain("43,800");
  });
});

describe("the fold's own line in the copied quote", () => {
  it("names the rider, and the 1,000 บาท in its name is the benefit, not a premium", () => {
    const text = iHealthyQuoteText({ ...facts, shown: WITH_DAILY_CASH })!;
    expect(text).toContain("- ค่าชดเชยรายวัน 1,000 บาท");
    expect(text).not.toContain("1,300");
    expect(text).toContain("รายปี 47,230 บาท");
  });

  /**
   * An emptied fold still carries a subtotal, of nothing. Both cards hide that line on this
   * test; the copied text did not, and pasted "สัญญาเพิ่มเติม 0 รายการ · 0 บาท" into a
   * customer's chat.
   */
  it("is not printed when it costs nothing", () => {
    const text = iHealthyQuoteText({
      ...facts,
      shown: { ...SHOWN, standard: { label: "สัญญาเพิ่มเติม 0 รายการ", total: 0 } },
    })!;
    expect(text).not.toContain("0 รายการ");
    expect(text).not.toContain("· 0 บาท");
  });
});
