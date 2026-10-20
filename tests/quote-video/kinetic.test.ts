import { describe, expect, it } from "vitest";
import { kineticGroups } from "@/lib/quote-video/kinetic";

describe("ตัวหนังสือเด้ง's groups (owner, 2026-10-20)", () => {
  const words = (voice: string) => kineticGroups(voice, 10).map((g) => g.map((x) => x.word).join(" "));

  it("puts a figure and its unit on their own, and other words a line's worth at a time", () => {
    expect(words("ออมแค่วันละ 79 บาท หรือเดือนละ 2,583 บาท ออมเพียง 19 ปีก็ครบ")).toEqual([
      "ออมแค่วันละ", "79 บาท", "หรือเดือนละ", "2,583 บาท", "ออมเพียง", "19", "ปีก็ครบ",
    ]);
    expect(words("สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ")).toEqual(["สนใจ", "ทักมาคุยกันได้เลยนะคะ", "ยินดีช่วยดูแผนให้ค่ะ"]);
  });

  it("times each word as the voice reaches it", () => {
    const g = kineticGroups("หนึ่ง สอง", 2).flat();
    expect(g[0].from).toBeLessThan(g[1].from);
  });
});
