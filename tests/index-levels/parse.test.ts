import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { findReportUrl, parseWeeklyReport } from "@/lib/index-levels/parse";
import { pdfText } from "@/lib/index-levels/read";
import { feedBackText, feedBrokenText } from "@/lib/index-levels/store";

describe("Krungthai-AXA's weekly index report", () => {
  it("reads all 14 Mondays from the real PDF of 2026-10-20, though the report numbers two rows 3", async () => {
    const text = await pdfText(new Uint8Array(readFileSync("tests/fixtures/gs-weekly-report.pdf")));
    const weeks = parseWeeklyReport(text);
    expect(weeks).toHaveLength(14);
    expect(weeks[0]).toEqual({ date: "2026-07-06", level: 282.15, fx: 33.0869 });
    expect(weeks[2]).toEqual({ date: "2026-07-20", level: 281.53, fx: 33.4811 });
    expect(weeks[3]).toEqual({ date: "2026-07-27", level: 281.58, fx: 33.3966 });
    expect(weeks[13]).toEqual({ date: "2026-10-05", level: 282.81, fx: 33.4241 });
  });

  it("sorts oldest first, keeps one row per date and skips a date that does not exist", () => {
    const text = [
      "2 Citi Grandmaster RC 5 Index 12 October 2026 283.10 33.5000",
      "1 Citi Grandmaster RC 5 Index 05 October 2026 282.81 33.4241",
      "1 Citi Grandmaster RC 5 Index 05 October 2026 282.81 33.4241",
      "3 Citi Grandmaster RC 5 Index 31 September 2026 280.00 33.0000",
    ].join("\n");
    expect(parseWeeklyReport(text).map((w) => w.date)).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("finds nothing in a page of other words", () => {
    expect(parseWeeklyReport("ราคาดัชนีย้อนหลัง No Index Name Price Date")).toEqual([]);
  });

  it("finds the report's address on the product page", () => {
    const html = `<a href="https://thailandgi-ktaxa.cdn.prismic.io/thailandgi-ktaxa/AbC123_GlobalSaving_15_8_WeeklyReport.pdf" target="_blank">`
      + `<a href="https://thailandgi-ktaxa.cdn.prismic.io/thailandgi-ktaxa/x_CitiGrandmasterRC5Indexmonthlyupdate.pdf">`;
    expect(findReportUrl(html)).toBe("https://thailandgi-ktaxa.cdn.prismic.io/thailandgi-ktaxa/AbC123_GlobalSaving_15_8_WeeklyReport.pdf");
    expect(findReportUrl("<p>no report</p>")).toBeNull();
  });
});

describe("the owner's alerts for the daily read", () => {
  it("says what broke, since when, and that the page still shows the last level", () => {
    const text = feedBrokenText("อ่าน PDF ได้แต่ไม่พบแถวราคาดัชนี", "2026-10-21T00:00:00Z");
    expect(text).toContain("⚠️ อ่านราคาดัชนี Global Savings ไม่ได้");
    expect(text).toContain("21 ต.ค.");
    expect(text).toContain("เหตุ: อ่าน PDF ได้แต่ไม่พบแถวราคาดัชนี");
    expect(text).toMatch(/\/global-saving$/);
  });

  it("gives the newest level when it works again", () => {
    expect(feedBackText({ date: "2026-10-12", level: 283.1, fx: 33.5 })).toBe("✅ อ่านราคาดัชนี Global Savings ได้แล้ว\nล่าสุด 283.10 จุด (2026-10-12)");
  });
});
