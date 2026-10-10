import { describe, expect, it } from "vitest";
import { budgetIn, peopleIn } from "@/lib/assistant/common";
import { personInEn } from "@/lib/assistant/ihealthy-en/route";

/** Readings the 2026-10-11 bug hunt found wrong. */
describe("a paying term and the word ช่วย are not a person", () => {
  it("keeps the man of 35, not the 19-year term", () => {
    expect(peopleIn("จ่าย 19 ปี ชาย 35 ทุน 1 ล้าน")).toEqual([{ age: 35, sex: "M" }]);
  });
  for (const t of ["จ่าย 9 ปี ช่วยคิดเบี้ยให้หน่อย", "จ่าย 9 ปีช่วยคิดให้หน่อยครับ", "ส่ง 20 ปี ชัวร์ไหม", "ชำระ 19 ปี ชำระยังไง"]) {
    it(`reads no one from "${t}"`, () => expect(peopleIn(t)).toEqual([]));
  }
  it("still reads a sex after the age", () => {
    expect(peopleIn("35 ปี ชาย")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("42 ญ")).toEqual([{ age: 42, sex: "F" }]);
  });
});

describe("a sum with a period word asking for the premium is not a budget", () => {
  for (const t of ["ทุน 1 ล้าน เดือนละเท่าไหร่", "ทุน 1 ล้าน ปีละกี่บาท", "ทุน 500,000 ต่อเดือนเท่าไหร่"]) {
    it(`reads no budget from "${t}"`, () => expect(budgetIn(t)).toBeUndefined());
  }
  it("reads the budgets people really say", () => {
    expect(budgetIn("ชาย 35 งบ 2000 ต่อเดือน")).toEqual({ baht: 2000, per: "month" });
    expect(budgetIn("ชาย 35 งบเดือนละไม่เกิน 2,000")).toEqual({ baht: 2000, per: "month" });
    expect(budgetIn("ชาย 35 เดือนละประมาณ 1500 บาท")).toEqual({ baht: 1500, per: "month" });
  });
});

describe("the English age and sex", () => {
  it("takes I'm 35 over an age named as a limit", () => {
    expect(personInEn("I'm 35, can I renew it until age 80?").age).toBe(35);
    expect(personInEn("Is the max age 70 to apply?").age).toBeUndefined();
  });
  it("does not take a wife's or husband's sex for the speaker's", () => {
    expect(personInEn("I'm 45 and my wife is asking too")).toEqual({ age: 45 });
  });
});
