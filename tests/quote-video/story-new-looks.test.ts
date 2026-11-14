import { describe, expect, it } from "vitest";
import { checkedStory } from "@/lib/quote-video/story";
import { INFO_ARTS, INFO_SHELVES, infoArt, STORY_TOPICS } from "@/lib/story/topics";

/**
 * ไวต์บอร์ด นีออน บลูพริ้นท์ (owner, 2026-11-14, spec 2026-11-14-story-looks-board-neon-blueprint): three looks
 * drawn through the อินโฟกราฟิก / ปากกาพล็อตเตอร์ route, so like plot they are kept only on the shelves told in points.
 */
const NEW = ["board", "neon", "blueprint"] as const;
const HEALTH = { plan: "SILVER", sex: "M", age: 35 };
const sent = (topic: string, art: string) =>
  checkedStory({ topic, faces: { narrator: "w26", hero: "m09" }, art, health: HEALTH, festival: "newyear", due: { date: "2026-12-01" } } as never, "F");

describe("the info-route looks (topics.ts infoArt)", () => {
  it("are plot and the three new looks, and no other", () => {
    expect(INFO_ARTS).toEqual(["plot", "board", "neon", "blueprint"]);
    for (const a of ["plot", ...NEW]) expect(infoArt(a), a).toBe(true);
    // อินโฟกราฟิก, retired, keeps its own rule; the people looks are not on the route
    for (const a of ["info", "paper", "minimal", "line", "glass", "", undefined]) expect(infoArt(a), String(a)).toBe(false);
  });
});

describe("checkedStory with ไวต์บอร์ด นีออน บลูพริ้นท์", () => {
  it("keeps each on ความรู้ประกัน, ตอบข้อโต้แย้ง and ประกันสุขภาพ, and drops it as plot is dropped on any other shelf", () => {
    for (const art of NEW) for (const t of STORY_TOPICS) {
      const s = sent(t.key, art);
      const p = sent(t.key, "plot");
      if (typeof s === "string") { expect(p, `${art} ${t.key}`).toBe(s); continue; }
      if (typeof p === "string") throw new Error(p);
      expect(s.art, `${art} ${t.key}`).toBe(INFO_SHELVES.includes(t.shelf) ? art : undefined);
      // off the info shelves the clip is what plot's would have been
      if (!INFO_SHELVES.includes(t.shelf)) expect(s, `${art} ${t.key}`).toEqual(p);
    }
  });

  it("keeps นีออน on a health topic and drops it on a story topic", () => {
    const health = sent("roomcost", "neon");
    const story = sent("pool48", "neon");
    if (typeof health === "string" || typeof story === "string") throw new Error("not checked");
    expect(health.art).toBe("neon");
    expect(story.art).toBeUndefined();
  });

  it("still keeps the retired อินโฟกราฟิก as it did", () => {
    const s = sent("fiverisks", "info");
    if (typeof s === "string") throw new Error(s);
    expect(s.art).toBe("info");
  });
});
