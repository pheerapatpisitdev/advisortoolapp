import { describe, expect, it } from "vitest";
import { clipMaking } from "@/lib/home/clip-making";

describe("home's clips being made", () => {
  it("names an ad clip วิดีโอโฆษณา and links the ad page", () => {
    expect(clipMaking({ product: "ISHIELD", ad: { mode: "ai" } }, null)).toEqual({ label: "วิดีโอโฆษณา", href: "/studio/ad-video" });
  });
  it("keeps the other boards", () => {
    expect(clipMaking({ product: "LIFEPROTECT" }, "สมชาย")).toEqual({ label: "วิดีโอนำเสนอ · สมชาย", href: "/studio/quote-video" });
    expect(clipMaking({ product: "STORY" }, null)).toEqual({ label: "คลิปเล่าเรื่อง", href: "/studio/story-clip" });
    expect(clipMaking({ product: "FREESTORY", brief: "เงินก้อน\nสอง" }, null)).toEqual({ label: "คลิปตามโจทย์ · เงินก้อน", href: "/studio/prompt-story" });
  });
});
