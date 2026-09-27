import { describe, it, expect } from "vitest";
import { overAllowance } from "@/lib/auth/quota";

describe("overAllowance", () => {
  it("lets staff through, whatever they have used", () => {
    expect(overAllowance({ limit: null, used: 999 }, false)).toBeNull();
  });

  it("lets an agent through until the allowance is used", () => {
    expect(overAllowance({ limit: 20, used: 19 }, false)).toBeNull();
    expect(overAllowance({ limit: 20, used: 20 }, false)).toMatch(/20 ครั้งต่อเดือน/);
  });

  it("says a trial room's limit in its own words", () => {
    expect(overAllowance({ limit: 5, used: 5 }, true)).toMatch(/ห้องทดลองใช้.*5 ครั้ง/);
  });

  it("treats an allowance of 0 as closed", () => {
    expect(overAllowance({ limit: 0, used: 0 }, false)).not.toBeNull();
  });
});
