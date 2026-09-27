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
});
