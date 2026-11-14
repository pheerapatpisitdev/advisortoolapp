import { describe, expect, it } from "vitest";
import { LIBRARY, libraryItem, usesFor, storyLibraryHref, promptLibraryHref, TYPE_NAME, PRODUCT_NAME } from "@/lib/scene-library/catalog";
import { DEVICES } from "@/lib/scene-library/devices";
import { PROMPT_FORMATS } from "@/lib/prompt-story/types";

const KNOWN = new Set(["topic", "look", "format", "style"]);

describe("catalogue", () => {
  it("has unique kebab-case ids", () => {
    const ids = LIBRARY.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("lists every device and every prompt format as ready", () => {
    for (const d of DEVICES) expect(libraryItem(d.key)?.ready).toBe(true);
    for (const f of PROMPT_FORMATS) expect(libraryItem(f.id)?.ready).toBe(true);
  });
  it("ready items have uses, unbuilt ones none", () => {
    for (const i of LIBRARY) {
      if (i.ready) expect(i.uses.length, i.id).toBeGreaterThan(0);
      else { expect(i.uses, i.id).toEqual([]); expect(i.preview, i.id).toBeUndefined(); }
    }
  });
  it("every ready href is a studio link with known params", () => {
    for (const i of LIBRARY) for (const u of i.uses) {
      expect(u.href.startsWith("/studio/"), u.href).toBe(true);
      for (const k of new URL(u.href, "http://x").searchParams.keys()) expect(KNOWN.has(k), `${i.id} ${k}`).toBe(true);
    }
  });
  it("usesFor drops closed tools", () => {
    const d = libraryItem("split")!;
    const all = usesFor(d, { "quote-video": true, "story-clip": true, "prompt-story": true });
    const some = usesFor(d, { "quote-video": true, "story-clip": true, "prompt-story": false });
    expect(all.some((u) => u.tool === "prompt-story")).toBe(true);
    expect(some.some((u) => u.tool === "prompt-story")).toBe(false);
    expect(some.length).toBe(all.length - 1);
  });
  it("device links and names", () => {
    expect(libraryItem("room")?.name).toBe("ค่าห้องต่อคืน");
    expect(libraryItem("groupgap")?.uses.find((u) => u.tool === "story-clip")?.href).toBe("/studio/story-clip?topic=groupins");
    expect(libraryItem("room")?.looks?.map((l) => l.id)).toEqual(["paper", "minimal", "line", "plot"]);
    expect(libraryItem("room")?.preview).toBe("/library/room-paper.jpg");
  });
  it("href builders omit absent params", () => {
    expect(storyLibraryHref({})).toBe("/studio/story-clip");
    expect(storyLibraryHref({ topic: "waiting", look: "plot" })).toBe("/studio/story-clip?topic=waiting&look=plot");
    expect(promptLibraryHref({ format: "drama3" })).toBe("/studio/prompt-story?format=drama3");
    expect(promptLibraryHref({ style: "warm" })).toBe("/studio/prompt-story?style=warm");
  });
  it("names the types and products", () => {
    expect(TYPE_NAME.format).toBe("รูปแบบรายการ");
    expect(Object.keys(PRODUCT_NAME).sort()).toEqual(["all", "health", "life", "saving"]);
  });
});
