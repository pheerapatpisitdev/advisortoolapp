import { describe, expect, it } from "vitest";
import { ageIn, peopleIn } from "@/lib/assistant/common";

/**
 * An age after จน / ครบ / ตั้งแต่ / หลัง … is about the contract, never the customer (review
 * 2026-10-11): "ผู้ชาย คุ้มครองจนอายุ 85 ใช่ไหม" was read as a man of 85 and the quote was wiped.
 */
describe("an age the contract runs to is not the customer's", () => {
  for (const t of [
    "ผู้ชาย ครบอายุ 99 ได้เงินคืนไหม",
    "ผู้หญิง อยากได้ที่คุ้มครองจนอายุ 90",
    "หญิง ตั้งแต่อายุ 55 รับบำนาญ",
    "ผู้ชาย คุ้มครองจนอายุ 85 ใช่ไหม",
    "ผู้หญิง หลังอายุ 60 ทุนเหลือเท่าไหร่",
    "ชาย ก่อนอายุ 60 ได้สองเท่าไหม",
    "ผู้ชาย ไม่เกินอายุ 70 สมัครได้ไหม",
    "ผู้หญิง คุ้มครองจนถึงอายุ 99",
  ]) {
    it(`reads no one from "${t}"`, () => expect(peopleIn(t)).toEqual([]));
  }

  it("still finds the customer's own age beside a contract age", () => {
    expect(ageIn("อายุ 35 คุ้มครองจนอายุ 85 ไหม")).toBe(35);
    expect(peopleIn("ผู้ชาย อายุ 35 คุ้มครองจนอายุ 85 ไหม")).toEqual([{ age: 35, sex: "M" }]);
  });

  it("still reads the ages people really say", () => {
    expect(peopleIn("ชาย 35")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("ญ40")).toEqual([{ age: 40, sex: "F" }]);
    expect(peopleIn("ผช35 ผญ33")).toEqual([{ age: 35, sex: "M" }, { age: 33, sex: "F" }]);
    expect(peopleIn("เพศชาย อายุ 35 ปีครับ")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("ญ ทุน 1,000,000 อายุ 40")).toEqual([{ age: 40, sex: "F" }]);
  });
});
