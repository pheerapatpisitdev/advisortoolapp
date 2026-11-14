import { describe, expect, it } from "vitest";
import { LIBRARY, libraryItem, usesFor, storyLibraryHref, promptLibraryHref, TYPE_NAME, PRODUCT_NAME } from "@/lib/scene-library/catalog";
import { DEVICES } from "@/lib/scene-library/devices";
import { PROMPT_FORMATS, PICTURE_STYLES } from "@/lib/prompt-story/types";
import { SOUNDS, MUSIC_MOODS, joinCues } from "@/lib/quote-video/fx";
import { THEME_LABELS } from "@/lib/quote-video/theme-keys";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import type { StoryLook } from "@/lib/scene-library/links";
import { INFO_SHELVES, topicOf } from "@/lib/story/topics";
import { existsSync } from "node:fs";
import { join } from "node:path";

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

  it("ties looks, themes, music and sounds to the code's own lists", () => {
    // every look the story form offers (the clip's art, less the retired อินโฟกราฟิก), and only those: a
    // look added to or dropped from either type fails to compile here
    const ARTS: Record<Exclude<NonNullable<StoryVideoInput["art"]>, "info">, true> & Record<StoryLook, true> = { paper: true, minimal: true, plot: true, line: true };
    const ART = Object.keys(ARTS);
    for (const art of ART) {
      const item = libraryItem(`look-${art}`)!;
      const href = item.uses.find((u) => u.tool === "story-clip")!.href;
      expect(ART).toContain(new URL(href, "http://x").searchParams.get("look"));
      const style = new URL(item.uses.find((u) => u.tool === "prompt-story")!.href, "http://x").searchParams.get("style");
      expect(PICTURE_STYLES.map((s) => s.id)).toContain(style);
    }
    expect(libraryItem("look-glass")?.name).toBe(THEME_LABELS.glass.name);
    expect(libraryItem("look-sticky")?.name).toBe(THEME_LABELS.sticky.name);
    for (const m of MUSIC_MOODS) expect(libraryItem(`fx-music-${m}`)?.ready).toBe(true);
    // เสียงเอฟเฟกต์ตรงจังหวะสำคัญ = the clip's own sounds: a whoosh at each join, a ding as a figure lands
    expect(libraryItem("fx-sound-beats")?.ready).toBe(true);
    expect(SOUNDS).toContain("whoosh");
    expect(SOUNDS).toContain("ding");
    expect(joinCues([{ start: 0 }, { start: 3 }]).map((c) => c.sound)).toEqual(["whoosh"]);
    for (const s of SOUNDS) expect(existsSync(join(process.cwd(), "remotion/public/fx", `${s}.mp3`)), s).toBe(true);
  });
  it("a plot story link opens on a topic plot can draw", () => {
    const plots = LIBRARY.flatMap((i) => i.uses).filter((u) => u.tool === "story-clip")
      .map((u) => new URL(u.href, "http://x").searchParams).filter((q) => q.get("look") === "plot");
    expect(plots.length).toBeGreaterThan(0);
    for (const q of plots) {
      const topic = topicOf(q.get("topic") ?? "");
      expect(topic, q.toString()).toBeDefined();
      expect(INFO_SHELVES).toContain(topic!.shelf);
    }
  });
  it("cashless says the plan's conditions apply", () => {
    expect(libraryItem("cashless")?.tells).toContain("ตามเงื่อนไขของแผน");
  });
  it("device lines are viewer-facing, not the writer prompts", () => {
    for (const d of DEVICES) expect(libraryItem(d.key)?.tells).not.toBe(d.when);
    expect(libraryItem("preexisting")).toBeUndefined();
    expect(libraryItem("device-preexisting")?.tells).toBe("โรคที่เป็นก่อนทำประกัน และข้อยกเว้นหลัก");
    expect(libraryItem("device-flip-calendar")?.product).toBe("saving");
  });
});
