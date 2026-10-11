import { describe, expect, it } from "vitest";
import { introFor } from "@/lib/chat/intro-store";
import { INTRO_PICTURE } from "@/lib/assistant/intro";

/** Which pictures a Page sends ahead of a first quotation (owner, 2026-10-11). */
describe("the intro pictures a Page sends", () => {
  const rows = [
    { scope: "*", pictures: ["every.jpg"], updatedAt: "" },
    { scope: "lucky", pictures: ["own.jpg", "own2.jpg"], updatedAt: "" },
    { scope: "quiet", pictures: [], updatedAt: "" },
  ];
  it("is the Page's own set where it has one", () => {
    expect(introFor(rows, "lucky")).toEqual(["own.jpg", "own2.jpg"]);
  });
  it("is the set for every Page otherwise, and on LINE", () => {
    expect(introFor(rows, "other")).toEqual(["every.jpg"]);
    expect(introFor(rows)).toEqual(["every.jpg"]);
  });
  it("is nothing for a Page that emptied its own", () => {
    expect(introFor(rows, "quiet")).toEqual([]);
  });
  it("is the built-in picture when nothing is set", () => {
    expect(introFor([], "lucky")).toEqual([INTRO_PICTURE]);
  });
});
