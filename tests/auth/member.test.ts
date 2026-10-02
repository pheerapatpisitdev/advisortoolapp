import { describe, expect, it } from "vitest";
import { cleanName } from "@/lib/auth/member";

describe("cleanName", () => {
  it("trims, and takes 1 to 60 characters", () => {
    expect(cleanName("  สมชาย ใจดี  ")).toBe("สมชาย ใจดี");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("ก".repeat(61))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});
