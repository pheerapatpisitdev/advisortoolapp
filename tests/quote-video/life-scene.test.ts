import { describe, expect, it } from "vitest";
import { LIFE_EVENTS, lifeAt, lifeScene } from "@/lib/quote-video/life-scene";
import { loadingKindOf, loadingScene } from "@/lib/quote-video/loading-scene";

describe("a life in ten events on a clip being made", () => {
  it("draws every moment without a missing number", () => {
    for (let p = 0; p <= 100; p += 0.5) for (const t of [0, 1.7, 9.3]) expect(lifeScene(p, t)).not.toMatch(/NaN|undefined|Infinity/);
    expect(lifeScene(Number.NaN, 1)).not.toMatch(/NaN/);
  });

  it("runs the owner's ten events in order", () => {
    expect(LIFE_EVENTS.map((e) => e.label)).toEqual(["เกิด", "เป็นเด็ก", "วัยเรียน", "ทำงาน", "แต่งงาน", "มีลูก", "เกษียณ", "ชรา", "อยู่คนเดียว", "จากไป"]);
    const seen = new Set<number>();
    for (let p = 0; p <= 98; p++) seen.add(lifeAt(p).i);
    expect([...seen]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("names the event and the age over the picture", () => {
    expect(lifeScene(3, 1)).toContain(">เกิด</text>");
    expect(lifeScene(33, 1)).toMatch(/>ทำงาน · อายุ 2\d ปี<\/text>/);
    expect(lifeScene(85, 1)).toMatch(/>อยู่คนเดียว · อายุ 8\d ปี<\/text>/);
  });

  it("stays on จากไป while the bar waits at 98% (owner)", () => {
    expect(lifeAt(98).i).toBe(9);
    expect(lifeScene(98, 1)).toContain(">จากไป</text>");
    expect(lifeScene(100, 1)).toBe(lifeScene(98, 1));
  });

  it("fades the place before under the new one as an event begins", () => {
    expect(lifeScene(28.3, 1)).toMatch(/<g opacity="0\.\d">/);
    expect(lifeScene(33, 1)).toContain('<g opacity="1">');
  });
});

describe("which picture a clip shows", () => {
  it("keeps one clip's picture and gives each about half the clips", () => {
    const id = "6dedde20-1b2c-4d5e-8f90-123456789abc";
    expect(loadingKindOf(id)).toBe(loadingKindOf(id));
    const ids = Array.from({ length: 400 }, (_, i) => `${(i * 2654435761 >>> 0).toString(16)}-clip-${i}`);
    const life = ids.filter((x) => loadingKindOf(x) === "life").length;
    expect(life).toBeGreaterThan(150);
    expect(life).toBeLessThan(250);
  });

  it("draws the picture it picked", () => {
    expect(loadingScene("life", 40, 1, "a")).toContain("แต่งงาน");
    expect(loadingScene("house", 40, 1, "a")).not.toContain("แต่งงาน");
  });
});
