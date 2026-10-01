import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/auth/next";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/admin/crm")).toBe("/admin/crm");
    expect(safeNext("/studio/calendar?day=2026-09-28")).toBe("/studio/calendar?day=2026-09-28");
  });

  it("sends anything else to Studio", () => {
    for (const raw of [undefined, null, "", "admin", "https://evil.example", "//evil.example", "/\\evil.example", "/x\nLocation: y", "/login", "/login?next=/admin"]) {
      expect(safeNext(raw)).toBe("/studio");
    }
  });

  it("refuses a control character or a backslash anywhere (review, 2026-10-01)", () => {
    for (const raw of ["/\t/evil.example", "/x\ty", "/a\u0000b", "/a\u001fb", "/a\u007fb", "/studio\\..\\x", "/x\\/evil.example", "/x\r"]) {
      expect(safeNext(raw)).toBe("/studio");
    }
    // a query or a fragment with ordinary characters still goes through
    expect(safeNext("/studio/write?hook=a%20b#top")).toBe("/studio/write?hook=a%20b#top");
  });
});
