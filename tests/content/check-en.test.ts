import { describe, expect, it } from "vitest";
import { personPhrases, premiumAmounts } from "@/lib/content/check";
import { otherPeople, premiumTable } from "@/lib/content/premium-table";

/**
 * The English flags of an English long ad (spec 2026-10-06), beside the Thai ones: a premium the
 * writer said in words, and a person of another sex or age than the one the headline prices.
 */

describe("English premium phrases", () => {
  it.each([
    ["Protection for only 89 THB a day", "89 THB"],
    ["That is 1,618 THB per month", "1,618 THB"],
    ["Pay THB 19,415 a year and relax", "THB 19,415"],
    ["From ฿48/day", "฿48"],
    ["Premium from THB 1,618", "THB 1,618"],
    ["just 1,618 baht monthly", "1,618 baht"],
    ["about THB 1,618/mo", "THB 1,618"],
  ])("flags %j", (text, amount) => {
    expect(premiumAmounts(text, "en")).toEqual([amount]);
  });

  it.each([
    "Medical cover up to 25,000,000 THB a year",
    "A tax deduction up to 25,000 THB a year",
    "Room & board 5,000 THB per day",
    "Daily cash of THB 1,000 per day in hospital",
    "A 10% discount after 3 years with no claims",
    "Renewable up to age 98",
  ])("does not flag %j", (text) => {
    expect(premiumAmounts(text, "en")).toEqual([]);
  });

  it("leaves the Thai check as it was", () => {
    expect(premiumAmounts("เบี้ยแค่ 1,548 บาท/เดือน")).toEqual(["1,548 บาท"]);
    expect(premiumAmounts("ห้องเดี่ยวมาตรฐาน วันละ 5,000 บาท")).toEqual([]);
  });
});

describe("English person phrases", () => {
  it.each([
    ["a 35-year-old woman", { sex: "F", age: 35 }],
    ["female, 35", { sex: "F", age: 35 }],
    ["men aged 40", { sex: "M", age: 40 }],
    ["A man, 45, living in Phuket", { sex: "M", age: 45 }],
    ["a 50 year old male", { sex: "M", age: 50 }],
  ])("reads %j as one person", (text, who) => {
    expect(personPhrases(text, "en").map(({ sex, age }) => ({ sex, age }))).toEqual([who]);
  });

  it.each([
    "men and women aged 20–65",
    "your 5-year-old son",
    "aged 30 and over",
    "women aged 30 to 50",
    "a woman with 2 kids",
    "Female = 19,415 THB/yr",
  ])("reads nobody in %j", (text) => {
    expect(personPhrases(text, "en")).toEqual([]);
  });

  it("flags only a person other than the headline's", () => {
    expect(otherPeople("Made for a 35-year-old woman like you", "F", 30, "en")).toEqual(["35-year-old woman"]);
    expect(otherPeople("female, 35", "M", 35, "en")).toEqual(["female, 35"]);
    expect(otherPeople("men aged 40", "M", 40, "en")).toEqual([]);
    expect(otherPeople("men and women aged 20–65, your 5-year-old son, aged 30 and over", "F", 40, "en")).toEqual([]);
  });

  it("leaves the Thai reading as it was", () => {
    expect(personPhrases("ผู้หญิงอายุ 35").map((p) => p.phrase)).toEqual(["ผู้หญิงอายุ 35"]);
    expect(personPhrases("a 35-year-old woman")).toEqual([]);
    // an English table's figures are the code's; its people come only from the writer's words
    expect(premiumTable("/ihealthy-ultra", 30, new Date("2026-10-06"), "en")).not.toBeNull();
  });
});
