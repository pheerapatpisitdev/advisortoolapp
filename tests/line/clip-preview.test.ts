import { describe, expect, it } from "vitest";
import { coverLines } from "@/lib/line/clip-preview";

describe("the LINE clip cover's words", () => {
  it("puts the tool on top, the plan under it, and names the customer with คุณ once", () => {
    expect(coverLines("วิดีโอนำเสนอ · Life Protect (Motion)", "สมชาย")).toEqual({ tool: "วิดีโอนำเสนอ", plan: "Life Protect (Motion)", who: "คุณสมชาย" });
    expect(coverLines("คลิปตามโจทย์ · ออมก่อนเกษียณ", "คุณวิภา")).toEqual({ tool: "คลิปตามโจทย์", plan: "ออมก่อนเกษียณ", who: "คุณวิภา" });
  });
  it("leaves out what the clip does not have", () => {
    expect(coverLines("วิดีโอนำเสนอ", "  ")).toEqual({ tool: "วิดีโอนำเสนอ", plan: "", who: "" });
  });
});
