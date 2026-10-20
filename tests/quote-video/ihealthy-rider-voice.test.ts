import { describe, expect, it } from "vitest";
import { quoteVideoFacts, quoteVideoScript, type VideoInput } from "@/lib/quote-video/script";

const TODAY = new Date("2026-10-17T12:00:00+07:00");
const ih: VideoInput = {
  product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: [],
  setup: "base=WLF99H&sa=150000&area=&cover=&r=MEB%3A1000&r=DCI%3A%3A200000&r=AP%3A%3A500000",
};
const price = (v: VideoInput, length?: "short") =>
  quoteVideoScript(quoteVideoFacts(v, TODAY)!, undefined, "F", length).find((s) => s.key === "price")!.voice;

describe("iHealthy clip names each rider and its sum (owner, 2026-10-17, mockup XaTkLWYU8twVqtMfrYFLGN ก)", () => {
  it("says every attached rider in full on the longer clip, the daily cash once", () => {
    expect(price(ih)).toContain("รวมประกันชีวิตทุน 150,000 บาท ค่าชดเชยรายวัน โรคร้ายแรง DCI ทุน 200,000 บาท และอุบัติเหตุ AP ทุน 500,000 บาทไว้แล้วค่ะ");
  });

  it("keeps the 15-second clip's one word for them", () => {
    expect(price(ih, "short")).toContain("รวมประกันชีวิตทุน 150,000 บาท ค่าชดเชยรายวัน และสัญญาเพิ่มเติมค่ะ");
  });

  it("names them in the clip's language", () => {
    expect(price({ ...ih, lang: "en" } as VideoInput)).toContain("critical illness DCI sum 200,000 baht and accident AP sum 500,000 baht already included");
  });

  it("says nothing new where the fold attached nothing", () => {
    expect(price({ ...ih, setup: undefined } as VideoInput)).toContain("รวมประกันชีวิตทุน 50,000 บาท กับค่าชดเชยรายวันไว้แล้วค่ะ");
  });
});

describe("iHealthy cover scene shows the life sum (owner, 2026-10-20, mockup Uw3cgf8SmZrKbvYmvWML6o ก)", () => {
  const groups = (v: VideoInput) => quoteVideoFacts(v, TODAY)!.coverGroups!.map((g) => [g.title, g.rows.map((r) => `${r.label} ${r.amount}`)]);

  it("puts the base plan's sum first, then the health cover, then the daily cash and the riders", () => {
    expect(groups(ih)).toEqual([
      ["สัญญาหลัก", ["ทุนชีวิต · ไลฟ์ โพรเทค+ x 2 150,000"]],
      ["ค่ารักษา iHealthy Ultra Gold", expect.not.arrayContaining([expect.stringContaining("ค่าชดเชยรายวัน")])],
      ["สัญญาเพิ่มเติม", ["ค่าชดเชยรายวัน 1,000 ต่อวัน", "โรคร้ายแรง DCI 200,000", "อุบัติเหตุ AP 500,000"]],
    ]);
  });

  it("says the package's own sum where the clip did not come from the page", () => {
    expect(groups({ ...ih, setup: undefined } as VideoInput)[0]).toEqual(["สัญญาหลัก", ["ทุนชีวิต · Health Ultra Package 50,000"]]);
  });

  it("names the groups in the clip's language", () => {
    expect(groups({ ...ih, lang: "en" } as VideoInput).map(([t]) => t)).toEqual(["Base policy", "Medical cover · iHealthy Ultra Gold", "Riders"]);
  });
});
