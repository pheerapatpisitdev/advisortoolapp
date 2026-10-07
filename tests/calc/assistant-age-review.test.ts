import { describe, expect, it } from "vitest";
import { ageFromBirthdate, ageIn, monthsOldIn, peopleIn } from "@/lib/assistant/common";
import { budgetIn } from "@/lib/assistant/common";

/**
 * Review 2026-10-01: two ways the chat got a customer's age wrong.
 *
 * The first is the clock. The server runs on UTC, seven hours behind Bangkok, and the age was
 * counted on the server's calendar: between midnight and seven in the morning, a customer
 * whose birthday it was came out a year younger.
 *
 * The second is the unit. "ลูกชาย อายุ 8 เดือน" is a baby, and was priced as a boy of eight.
 */

describe("an age from a birthdate is counted on the Bangkok calendar", () => {
  // 03:00 on 1 October 2026 in Bangkok, still 30 September on a UTC server
  const earlyMorning = new Date("2026-09-30T20:00:00Z");

  it("has the birthday already arrived at three in the morning in Bangkok", () => {
    expect(ageFromBirthdate("เกิด 1/10/2536", earlyMorning)).toBe(33);
    expect(ageFromBirthdate("เกิด 1/10/2536", new Date("2026-10-01T05:00:00Z"))).toBe(33);
  });

  it("is still a day short the evening before, Bangkok time", () => {
    expect(ageFromBirthdate("เกิด 1/10/2536", new Date("2026-09-30T12:00:00Z"))).toBe(32);
  });

  it("turns the year over at Bangkok's midnight, for a birth year said alone", () => {
    // 02:00 on 1 January 2027 in Bangkok; 31 December 2026 in UTC
    expect(ageFromBirthdate("เกิด 2536", new Date("2026-12-31T19:00:00Z"))).toBe(34);
  });
});

describe("an age said in months", () => {
  it("is a baby of nought, not a child of that many years", () => {
    expect(peopleIn("ลูกชาย อายุ 8 เดือน ทุน 1 ล้าน")).toEqual([{ age: 0, sex: "M" }]);
    expect(peopleIn("หญิง อายุ 10 เดือน")).toEqual([{ age: 0, sex: "F" }]);
    expect(peopleIn("ช 6เดือน")).toEqual([{ age: 0, sex: "M" }]);
  });

  it("comes down to the whole years it makes once it passes twelve", () => {
    expect(peopleIn("หญิง 18 เดือน")).toEqual([{ age: 1, sex: "F" }]);
    expect(peopleIn("ชาย อายุ 30 เดือน")).toEqual([{ age: 2, sex: "M" }]);
  });

  it("is read alone too, and said to the routers as months", () => {
    expect(ageIn("อายุ 8 เดือนครับ")).toBe(0);
    expect(monthsOldIn("ลูกชาย อายุ 8 เดือน ทุน 1 ล้าน")).toBe(0);
    expect(monthsOldIn("อายุ 8 เดือนครับ")).toBe(0);
    expect(monthsOldIn("ชาย 35 ทุน 1 ล้าน")).toBeUndefined();
    expect(monthsOldIn("อายุ 35 ปี")).toBeUndefined();
  });

  it("leaves an instalment said in months alone", () => {
    // เดือนละ is how much a month, not how many months old
    expect(peopleIn("ชาย 35 เดือนละ 3,000")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("ชาย 35 ผ่อนเดือนละ 3,000")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("หญิง อายุ 40 เดือนละ 5000")).toEqual([{ age: 40, sex: "F" }]);
    expect(budgetIn("ชาย 35 ผ่อนเดือนละ 3,000")).toBeDefined();
    expect(ageIn("อายุ 40 เดือนละ 5000")).toBe(40);
    expect(monthsOldIn("ชาย 35 เดือนละ 3,000")).toBeUndefined();
    // and a half-yearly instalment is not an age at all
    expect(peopleIn("ราย 6 เดือน ชาย 35")).toEqual([{ age: 35, sex: "M" }]);
    expect(ageIn("6 เดือนเท่าไหร่")).toBeUndefined();
    expect(monthsOldIn("ขอราย 6 เดือน")).toBeUndefined();
  });

  it("leaves a month said as a date alone", () => {
    expect(peopleIn("ชาย 35 เดือนนี้สมัครได้ไหม")).toEqual([{ age: 35, sex: "M" }]);
    expect(peopleIn("หญิง 40 เดือนหน้า")).toEqual([{ age: 40, sex: "F" }]);
  });
});

describe("a date of birth sent on its own (2026-10-07)", () => {
  const today = new Date("2026-10-07T05:00:00Z");

  it("is an age wherever an age is read", () => {
    expect(ageIn("20/6/2543")).toBeGreaterThanOrEqual(26);
    expect(ageFromBirthdate("20/6/2543", today)).toBe(26);
    expect(ageFromBirthdate("20/10/2543", today)).toBe(25);
  });

  it("is not read as the age of the day beside a sex word", () => {
    expect(peopleIn("ชาย 20/6/2543")).toEqual([{ age: ageFromBirthdate("20/6/2543")!, sex: "M" }]);
    expect(peopleIn("20/6/2543 ญ")).toEqual([{ age: ageFromBirthdate("20/6/2543")!, sex: "F" }]);
  });

  it("reads a month written in words", () => {
    expect(ageFromBirthdate("เกิด 20 มิถุนายน 2543", today)).toBe(26);
    expect(ageFromBirthdate("20 มิ.ย. 2543", today)).toBe(26);
    expect(ageFromBirthdate("1 ธ.ค. พ.ศ. 2543", today)).toBe(25);
  });
});
