import { describe, it, expect } from "vitest";
import { pricePension } from "@/lib/copilot/pension-price";
import { quotePension, type PensionMode } from "@/calc/pension/engine";

/** บำนาญ สมาร์ท 95 in the chat, worked from the premium a customer can afford. */
const TAIL = " รับบำนาญ 60 จ่ายจนรับบำนาญ";
const base = { age: 40, sex: "M" as const, annuityAge: 60, pay: "untilAnnuity" as const };

function sumFor(amount: number, mode: PensionMode) {
  const r = quotePension({ ...base, mode, basis: "premium", amount });
  if (!r.ok) throw new Error(r.error);
  return `ทุน ${r.quote.sumAssured.toLocaleString("en-US")} บาท`;
}

describe("บำนาญ สมาร์ท 95 in the chat, from a premium", () => {
  it.each([
    ["บำนาญ ชาย 40 จ่ายปีละ 50,000", 50_000, "annual"],
    ["บำนาญ ชาย 40 งบปีละ 50000", 50_000, "annual"],
    ["บำนาญ ชาย 40 มีงบ 50,000 ต่อปี", 50_000, "annual"],
    ["บำนาญ ชาย 40 ปีละ 5 หมื่น", 50_000, "annual"],
    ["บำนาญ ชาย 40 จ่ายได้ 3,000 ต่อเดือน", 3_000, "monthly"],
    ["บำนาญ ชาย 40 เบี้ย 3000/เดือน", 3_000, "monthly"],
    ["บำนาญ ชาย 40 งบเดือนละ 3,000", 3_000, "monthly"],
    ["บำนาญ ชาย 40 ส่งเดือนละ 3000", 3_000, "monthly"],
    ["บำนาญ ชาย 40 เก็บเงินเดือนละ 3000", 3_000, "monthly"],
    ["บำนาญ ชาย 40 จ่ายงวดละ 3000 รายเดือน", 3_000, "monthly"],
    ["บำนาญ ชาย 40 จ่าย 6 เดือนละ 25,000", 25_000, "semi"],
  ] as const)("reads “%s” as a premium", (msg, amount, mode) => {
    const reply = pricePension(msg + TAIL);
    expect(reply.priced, reply.text).toBe(true);
    expect(reply.text).toContain(sumFor(amount, mode));
  });

  it.each([
    "บำนาญ ชาย 40 จ่ายทุก 3 เดือน 10,000",
    "บำนาญ ชาย 40 จ่าย 3 เดือนละ 10,000",
    "บำนาญ ชาย 40 จ่ายรายไตรมาส 10,000",
  ])("says the plan is not sold by the quarter: “%s”", (msg) => {
    const reply = pricePension(msg + TAIL);
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("ชำระได้รายปี ราย 6 เดือน หรือรายเดือน");
  });

  it("still reads a bare เดือนละ as the pension the plan is sold on", () => {
    const reply = pricePension("บำนาญ ชาย 40 เดือนละ 10,000" + TAIL);
    expect(reply.text).toContain("เดือนละ **10,000 บาท**");
  });

  it("leads with the instalment the customer gave", () => {
    const reply = pricePension("บำนาญ ชาย 40 จ่ายเดือนละ 3,000" + TAIL);
    expect(reply.text).toContain("💰 เบี้ยรายเดือน **3,000 บาท**");
    expect(reply.text).toMatch(/ปีละ [\d,]+ บาท/);
  });

  it("asks yearly or monthly when a premium comes without one, and each button prices", () => {
    const reply = pricePension("บำนาญ ชาย 40 มีงบ 50,000" + TAIL);
    expect(reply.priced).toBe(false);
    const labels = reply.guide!.map((g) => g.label);
    expect(labels).toEqual(["จ่ายปีละ 50,000", "จ่ายเดือนละ 50,000"]);
    for (const g of reply.guide!) expect(pricePension(g.ask).priced, g.ask).toBe(true);
  });

  it("does not take the paying term for a premium", () => {
    const reply = pricePension("บำนาญ ชาย 40 จ่าย 6 ปี เดือนละ 10,000 รับบำนาญ 60");
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("เดือนละ **10,000 บาท**");
  });

  it("offers the smallest premium as a button when the one given is too small", () => {
    const reply = pricePension("บำนาญ ชาย 40 จ่ายปีละ 10,000" + TAIL);
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("เบี้ยขั้นต่ำ 12,975 บาท");
    const b = reply.guide!.find((g) => g.label.includes("12,975"))!;
    expect(pricePension(b.ask).priced, b.ask).toBe(true);
  });
});
