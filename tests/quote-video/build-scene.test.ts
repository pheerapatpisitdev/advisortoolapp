import { describe, expect, it } from "vitest";
import { buildScene } from "@/lib/quote-video/build-scene";

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const bricks = (s: string) => count(s, /width="18.5" height="11.5"/g);

describe("the builders' house on a clip being made", () => {
  it("draws every stage without a missing number", () => {
    for (let p = 0; p <= 100; p += 2.5) for (const t of [0, 1.7, 9.3]) expect(buildScene(p, t)).not.toMatch(/NaN|undefined|Infinity/);
    expect(buildScene(Number.NaN, 1)).not.toMatch(/NaN/);
  });

  it("lays the wall's 28 bricks by 60%, then the roof, then the door and windows", () => {
    expect(bricks(buildScene(0, 1))).toBe(0);
    expect(bricks(buildScene(30, 1))).toBe(14);
    expect(bricks(buildScene(60, 1))).toBe(28);
    expect(buildScene(59, 1)).not.toContain("clipPath");
    expect(buildScene(70, 1)).toContain("clipPath");
    expect(buildScene(80, 1)).not.toContain('fill="#7a4a24"/>');
    expect(count(buildScene(98, 1), /stroke="#fff" stroke-width="2"/g)).toBe(2);
  });

  it("grows the tree as the bar fills", () => {
    const crown = (s: string) => Number(s.match(/fill="#4f9d4a"\/>/) && s.match(/r="([\d.]+)" fill="#4f9d4a"/)![1]);
    expect(crown(buildScene(0, 1))).toBeLessThan(crown(buildScene(50, 1)));
    expect(crown(buildScene(50, 1))).toBeLessThan(crown(buildScene(98, 1)));
  });

  it("keeps each card's roof clip its own", () => {
    expect(buildScene(80, 1, "r1")).toContain('id="roof-r1"');
    expect(buildScene(80, 1, "r1")).toContain("url(#roof-r1)");
  });
});
