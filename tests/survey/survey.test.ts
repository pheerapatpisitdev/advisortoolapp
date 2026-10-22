import { describe, expect, it } from "vitest";
import { addDays, ageOn, cleanSurvey, nextDays, thaiDay } from "@/lib/survey/answers";
import { summarize, summaryText } from "@/lib/survey/summary";
import { readCalcStart } from "@/lib/calc-start";

const TODAY = "2026-10-22"; // a Thursday

const filled = {
  companies: ["AIA"], tie: "friend", reasons: ["health", "tax"], household: "self", years: 6,
  care: "rare", help: ["summary"], planned: false, top: "education", also: ["health"],
  kids: 1, eldest: 7, budget: 3000, decider: "spouse", place: "home",
  date: "2026-10-25", time: "15:00", name: "  วิภา  ", phone: "081-234-5678", birth: "1988-03-14", sex: "F", address: "บางใหญ่",
};

describe("สำรวจความคุ้มครอง answers", () => {
  it("keeps a filled survey and trims the name", () => {
    const a = cleanSurvey(filled, TODAY);
    if (typeof a === "string") throw new Error(a);
    expect(a.name).toBe("วิภา");
    expect(a.top).toBe("education");
    expect(a.also).toEqual(["health"]);
    expect(a.kids).toBe(1);
  });

  it("drops the policy questions when the customer holds none", () => {
    const a = cleanSurvey({ ...filled, companies: [] }, TODAY);
    if (typeof a === "string") throw new Error(a);
    expect(a).toMatchObject({ tie: null, reasons: [], household: null, years: null, care: null, help: [] });
  });

  it("never lists the top worry again under ห่วงด้วย, and asks about children only for education", () => {
    const a = cleanSurvey({ ...filled, top: "health", also: ["health", "retire"] }, TODAY);
    if (typeof a === "string") throw new Error(a);
    expect(a.also).toEqual(["retire"]);
    expect(a.kids).toBeNull();
  });

  it("refuses what cannot be saved", () => {
    expect(cleanSurvey({ ...filled, name: " " }, TODAY)).toMatch(/ชื่อ/);
    expect(cleanSurvey({ ...filled, phone: "12" }, TODAY)).toMatch(/เบอร์/);
    expect(cleanSurvey({ ...filled, birth: "1988-02-30" }, TODAY)).toMatch(/วันเกิด/);
    expect(cleanSurvey({ ...filled, sex: "X" }, TODAY)).toMatch(/เพศ/);
    expect(cleanSurvey({ ...filled, date: TODAY }, TODAY)).toMatch(/วันนัด/);
    expect(cleanSurvey({ ...filled, date: addDays(TODAY, 61) }, TODAY)).toMatch(/วันนัด/);
    expect(cleanSurvey({ ...filled, time: "25:00" }, TODAY)).toMatch(/เวลา/);
  });

  it("ignores values that are not on the lists", () => {
    const a = cleanSurvey({ ...filled, companies: ["AIA", "<b>"], budget: 4000, place: "moon" }, TODAY);
    if (typeof a === "string") throw new Error(a);
    expect(a.companies).toEqual(["AIA"]);
    expect(a.budget).toBeNull();
    expect(a.place).toBeNull();
  });

  it("counts age, days and dates in Bangkok's calendar", () => {
    expect(ageOn("1988-03-14", TODAY)).toBe(38);
    expect(ageOn("1988-10-23", TODAY)).toBe(37);
    expect(ageOn("2030-01-01", TODAY)).toBeNull();
    expect(nextDays(TODAY, true)).toEqual(["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]);
    expect(nextDays(TODAY, false)).toEqual(["2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28"]);
    expect(thaiDay("2026-10-25")).toBe("อา. 25 ต.ค.");
  });
});

describe("สรุปก่อนนัด", () => {
  const a = cleanSurvey(filled, TODAY);
  if (typeof a === "string") throw new Error(a);
  const s = summarize(a, TODAY);

  it("opens the calculator the owner matched to each worry, top one first", () => {
    expect(s.calcs.map((c) => c.name)).toEqual(["Global Savings 15/8", "iHealthy Ultra"]);
    expect(s.calcs[0].href).toBe("/global-saving?age=38&sex=F&premium=36000");
    expect(s.calcs[1].href).toBe("/ihealthy-ultra?age=38&sex=F");
    expect(s.ishield).toBe("/ishield?age=38&sex=F&sum=1000000&variant=WLCI10");
  });

  it("matches retirement to บำนาญ 95 and family income to Life Protect", () => {
    const b = cleanSurvey({ ...filled, top: "retire", also: ["income"] }, TODAY);
    if (typeof b === "string") throw new Error(b);
    const t = summarize(b, TODAY);
    expect(t.calcs.map((c) => c.href)).toEqual([
      "/bumnan95?age=38&sex=F&premium=36000",
      "/lifeprotect?age=38&sex=F&sum=1000000&variant=WLF19H",
    ]);
    expect(t.ishield).toBeNull();
  });

  it("reads as the agent's notes", () => {
    const text = summaryText(a, s);
    expect(text).toContain("สรุปก่อนนัด · คุณวิภา");
    expect(text).toContain("นัด: อา. 25 ต.ค. 15:00 น. · บ้าน");
    expect(text).toContain("ร่วมฟัง: คู่สมรส ต้องอยู่ด้วย");
    expect(text).toContain("• รับปากไว้: สรุปกรมธรรม์ให้ (AIA)");
  });
});

describe("calculator start from a link", () => {
  const ages = { min: 0, max: 75 };
  const premiums = { min: 20_000, max: 20_000_000 };
  it("takes whole numbers in range and M / F", () => {
    expect(readCalcStart("?age=38&sex=F&premium=36000", ages, premiums)).toEqual({ age: 38, sex: "F", premium: 36_000 });
  });
  it("lifts a budget under the least premium to it", () => {
    expect(readCalcStart("?premium=12000", ages, premiums)).toEqual({ premium: 20_000 });
  });
  it("leaves out anything else", () => {
    expect(readCalcStart("?age=80&sex=x&premium=1e9", ages, premiums)).toEqual({});
    expect(readCalcStart("?age=30&age=40", ages, premiums)).toEqual({});
  });
});
