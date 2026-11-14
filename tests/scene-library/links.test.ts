import { describe, expect, it } from "vitest";
import { promptLibraryHref, promptStartFrom, startLook, storyLibraryHref, storyStartFrom } from "@/lib/scene-library/links";
import { LIBRARY } from "@/lib/scene-library/catalog";
import { INFO_SHELVES, STORY_TOPICS } from "@/lib/story/topics";

/** an address's params, as Next hands them to a page */
const paramsOf = (href: string): Record<string, string | string[] | undefined> => {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of new URL(href, "http://x").searchParams) {
    const was = out[k];
    out[k] = was === undefined ? v : Array.isArray(was) ? [...was, v] : [was, v];
  }
  return out;
};

describe("story-clip links", () => {
  it("round-trips a topic and look", () => {
    expect(storyStartFrom(paramsOf(storyLibraryHref({ topic: "roomcost", look: "plot" })))).toEqual({ topic: "roomcost", look: "plot" });
    expect(storyStartFrom(paramsOf(storyLibraryHref({ topic: "pillar", look: "minimal" })))).toEqual({ topic: "pillar", look: "minimal" });
    expect(storyStartFrom(paramsOf(storyLibraryHref({ look: "line" })))).toEqual({ look: "line" });
  });
  it("drops unknown values", () => {
    expect(storyStartFrom({ topic: "nope" })).toEqual({});
    expect(storyStartFrom({ look: "glass" })).toEqual({});
    expect(storyStartFrom({ topic: "waiting", look: "info" })).toEqual({ topic: "waiting" });
    expect(storyStartFrom({})).toEqual({});
  });
  it("keeps the topic and drops ปากกาพล็อตเตอร์ on a shelf that cannot draw it", () => {
    expect(storyStartFrom({ topic: "pool48", look: "plot" })).toEqual({ topic: "pool48" });
    const family = STORY_TOPICS.find((t) => !INFO_SHELVES.includes(t.shelf) && t.shelf !== "story")!;
    expect(storyStartFrom({ topic: family.key, look: "plot" })).toEqual({ topic: family.key });
    // the other looks stay on any shelf
    expect(storyStartFrom({ topic: "pool48", look: "line" })).toEqual({ topic: "pool48", look: "line" });
  });
  it("keeps ไวต์บอร์ด นีออน บลูพริ้นท์ on a shelf told in points and drops them as plot elsewhere", () => {
    for (const look of ["board", "neon", "blueprint"]) {
      expect(storyStartFrom({ topic: "roomcost", look }), look).toEqual({ topic: "roomcost", look });
      expect(storyStartFrom({ topic: "fiverisks", look }), look).toEqual({ topic: "fiverisks", look });
      expect(storyStartFrom({ topic: "pool48", look }), look).toEqual({ topic: "pool48" });
      const family = STORY_TOPICS.find((t) => !INFO_SHELVES.includes(t.shelf) && t.shelf !== "story")!;
      expect(storyStartFrom({ topic: family.key, look }), look).toEqual({ topic: family.key });
      // with no topic there is nothing to check it against
      expect(storyStartFrom({ look }), look).toEqual({ look });
    }
  });
  it("reads the first of a repeated param", () => {
    expect(storyStartFrom({ topic: ["waiting", "pool48"], look: ["plot"] })).toEqual({ topic: "waiting", look: "plot" });
  });
});

describe("prompt-story links", () => {
  it("parses a format and style", () => {
    expect(promptStartFrom(paramsOf("/studio/prompt-story?format=drama3&style=line"))).toEqual({ format: "drama3", style: "line" });
    expect(promptStartFrom(paramsOf(promptLibraryHref({ format: "claimreview", style: "warm" })))).toEqual({ format: "claimreview", style: "warm" });
  });
  it("keeps ไวต์บอร์ด นีออน บลูพริ้นท์, on any format", () => {
    expect(promptStartFrom({ style: "blueprint" })).toEqual({ style: "blueprint" });
    expect(promptStartFrom({ style: "board" })).toEqual({ style: "board" });
    expect(promptStartFrom(paramsOf(promptLibraryHref({ format: "drama3", style: "neon" })))).toEqual({ format: "drama3", style: "neon" });
  });
  it("keeps the seven AI styles, on any format, and not the dropped ลายไทย", () => {
    for (const style of ["cartoon3d", "clay", "anime", "watercolor", "isometric", "collage", "pixel"]) {
      expect(promptStartFrom({ style }), style).toEqual({ style });
      expect(promptStartFrom(paramsOf(promptLibraryHref({ format: "drama3", style }))), style).toEqual({ format: "drama3", style });
    }
    expect(promptStartFrom({ style: "thai-pattern" })).toEqual({});
    expect(promptStartFrom({ style: "3d" })).toEqual({});
  });
  it("drops unknown values", () => {
    expect(promptStartFrom({ format: "x" })).toEqual({});
    expect(promptStartFrom({ format: "free", style: "real" })).toEqual({ format: "free" });
    expect(promptStartFrom({ style: "minimal" })).toEqual({});
  });
});

describe("the catalogue's links", () => {
  it("every ready href parses to a start, or has no params, a device look's own links too", () => {
    for (const item of LIBRARY) for (const u of [...item.uses, ...(item.looks ?? []).flatMap((l) => l.uses)]) {
      const params = paramsOf(u.href);
      if (Object.keys(params).length === 0) continue;
      const start = u.tool === "story-clip" ? storyStartFrom(params) : u.tool === "prompt-story" ? promptStartFrom(params) : null;
      expect(start, `${item.id} ${u.href}`).not.toBeNull();
      // nothing the link asked for is dropped
      expect(Object.keys(start!).sort(), `${item.id} ${u.href}`).toEqual(Object.keys(params).sort());
    }
  });
});

describe("startLook", () => {
  it("takes the link's look over the remembered one", () => {
    expect(startLook({ look: "plot" }, "paper")).toBe("plot");
    expect(startLook({ style: "line" }, "paper")).toBe("line");
  });
  it("keeps the remembered one when the link has none", () => {
    expect(startLook({}, "minimal")).toBe("minimal");
    expect(startLook(undefined, "line")).toBe("line");
    expect(startLook({ topic: "waiting" }, "plot")).toBe("plot");
  });
});
