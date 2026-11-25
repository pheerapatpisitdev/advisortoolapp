import { describe, expect, it } from "vitest";
import { cleanPhones, dialParts, LINE_MAX, LINES_MAX, telOf } from "@/lib/hospitals/phones";

/** โรงพยาบาลในเครือ (owner chose ก ×5, 2026-11-25): the numbers as they are written, and as a phone dials them */

describe("telOf: the number a tap dials", () => {
  it.each([
    ["0 2532 4444 ต่อ 3544, 1131", "025324444"],
    ["UR Nurse 08 1828 0651", "0818280651"],
    ["0 3441 0700-6", "034410700"],
    ["0 3441 0700 - 6", "034410700"],
    ["02532 4444", "025324444"],
    ["Fax Claim 0 2561 1111 ต่อ 2232-3", "025611111"],
    ["1719", "1719"],
    ["1218 กด 2", "1218"],
    ["0 5393 4551", "053934551"],
  ])("%s dials %s", (text, tel) => expect(telOf(text)).toBe(tel));

  it.each(["นอกเวลา ต่อ 1170", "เบอร์กลาง ต่อ 1009", "", "ไม่มี", "2165"])("%s dials nothing: an extension alone is not a number", (text) => {
    expect(telOf(text)).toBeNull();
  });
});

describe("dialParts: the central number, one link each", () => {
  it("splits several numbers and dials each on its own", () => {
    expect(dialParts("1719, 0 2310 3000")).toEqual([{ text: "1719", tel: "1719" }, { text: "0 2310 3000", tel: "023103000" }]);
  });
  it("is empty when the insurer's list has no number", () => expect(dialParts("")).toEqual([]));
});

describe("cleanPhones: what the back office may save", () => {
  it("reads one number a line, trimmed, blank lines and repeats dropped", () => {
    expect(cleanPhones({ insurance: " 0 2111 1111 \n\n0 2111 1111\nUR Nurse  0 2222 2222", room: "", appointment: "1719", reception: undefined })).toEqual({
      ok: true,
      value: { insurance: ["0 2111 1111", "UR Nurse 0 2222 2222"], room: [], appointment: ["1719"], reception: [] },
    });
  });
  it("refuses a line with no digit in it, naming the department", () => {
    expect(cleanPhones({ insurance: "", room: "โทรเบอร์กลาง", appointment: "", reception: "" })).toEqual({ ok: false, error: "ค่าห้อง: \"โทรเบอร์กลาง\" ไม่มีตัวเลข" });
  });
  it("refuses a line too long, and too many lines", () => {
    expect(cleanPhones({ insurance: `0 ${"1".repeat(LINE_MAX)}` })).toMatchObject({ ok: false, error: expect.stringContaining("ประกัน") });
    expect(cleanPhones({ insurance: Array.from({ length: LINES_MAX + 1 }, (_, i) => `0 2000 000${i}`).join("\n") })).toMatchObject({ ok: false });
  });
  it("refuses a form with no number at all: คืนค่าเดิม is the button for that", () => {
    expect(cleanPhones({ insurance: " ", room: "", appointment: "", reception: "" })).toEqual({ ok: false, error: "ใส่อย่างน้อยหนึ่งเบอร์" });
  });
});
