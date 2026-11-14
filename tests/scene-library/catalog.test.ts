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
/** every link the catalogue draws: each piece's, and each device look's */
const allUses = (i: (typeof LIBRARY)[number]) => [...i.uses, ...(i.looks ?? []).flatMap((l) => l.uses)];
const q = (href: string) => new URL(href, "http://x").searchParams;

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
    for (const i of LIBRARY) for (const u of allUses(i)) {
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
    expect(libraryItem("room")?.looks?.map((l) => l.id)).toEqual(["paper", "minimal", "line", "plot", "board", "neon", "blueprint"]);
    expect(libraryItem("room")?.looks?.map((l) => l.name)).toEqual(["สต็อปโมชันกระดาษ", "แสงอุ่น", "การ์ตูนลายเส้น", "ปากกาพล็อตเตอร์", "ไวต์บอร์ด", "นีออน", "บลูพริ้นท์"]);
    expect(libraryItem("room")?.looks?.find((l) => l.id === "neon")?.preview).toBe("/library/room-neon.jpg");
    expect(libraryItem("room")?.preview).toBe("/library/room-paper.jpg");
  });
  it("each device look opens the forms in that look, on the device's topic", () => {
    const STYLE: Record<string, string> = { paper: "paper", minimal: "warm", line: "line", plot: "plot", board: "board", neon: "neon", blueprint: "blueprint" };
    for (const d of DEVICES) {
      const item = libraryItem(d.key)!;
      const topic = q(item.uses.find((u) => u.tool === "story-clip")!.href).get("topic");
      for (const l of item.looks!) {
        expect(l.uses.map((u) => u.tool), `${d.key} ${l.id}`).toEqual(["story-clip", "prompt-story"]);
        const story = q(l.uses[0].href);
        expect(story.get("topic"), `${d.key} ${l.id}`).toBe(topic);
        // every device topic is on a shelf told in points, so every look, ปากกาพล็อตเตอร์ too, is kept
        expect(story.get("look"), `${d.key} ${l.id}`).toBe(l.id);
        expect(q(l.uses[1].href).get("style"), `${d.key} ${l.id}`).toBe(STYLE[l.id]);
        expect(PICTURE_STYLES.map((s) => s.id)).toContain(STYLE[l.id]);
      }
    }
    // ประกันกลุ่ม's topic is on the objection shelf, which ปากกาพล็อตเตอร์ draws
    expect(libraryItem("groupgap")!.looks!.find((l) => l.id === "plot")!.uses[0].href).toBe("/studio/story-clip?topic=groupins&look=plot");
    expect(libraryItem("room")!.looks!.find((l) => l.id === "minimal")!.uses[1].href).toBe("/studio/prompt-story?style=warm");
  });
  it("usesFor takes a look's links as it takes a piece's", () => {
    const line = libraryItem("room")!.looks!.find((l) => l.id === "line")!;
    expect(usesFor(line, { "quote-video": true, "story-clip": true, "prompt-story": false }).map((u) => u.href)).toEqual(["/studio/story-clip?topic=roomcost&look=line"]);
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
    // the spec's chip words, which the board draws
    expect(PRODUCT_NAME).toEqual({ all: "ทุกสินค้า", health: "สุขภาพ", life: "ชีวิต", saving: "ออม บำนาญ มรดก" });
  });

  it("ties looks, themes, music and sounds to the code's own lists", () => {
    // every look the story form offers (the clip's art, less the retired อินโฟกราฟิก), and only those: a
    // look added to or dropped from either type fails to compile here
    const ARTS: Record<Exclude<NonNullable<StoryVideoInput["art"]>, "info">, true> & Record<StoryLook, true> = { paper: true, minimal: true, plot: true, line: true, board: true, neon: true, blueprint: true };
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
  it("ไวต์บอร์ด นีออน บลูพริ้นท์ are ready, with a still and links into both forms", () => {
    for (const [art, name] of [["board", "ไวต์บอร์ด"], ["neon", "นีออน"], ["blueprint", "บลูพริ้นท์"]]) {
      const item = libraryItem(`look-${art}`)!;
      expect(item, art).toBeDefined();
      expect(item.ready, art).toBe(true);
      expect(item.type, art).toBe("look");
      expect(item.name, art).toBe(name);
      expect(item.preview, art).toBe(`/library/look-${art}.jpg`);
      expect(item.uses.map((u) => u.tool), art).toEqual(["story-clip", "prompt-story"]);
      const story = q(item.uses[0].href);
      expect(story.get("look"), art).toBe(art);
      // like ปากกาพล็อตเตอร์ it opens on a topic told in points
      expect(story.get("topic"), art).toBe("sumvspremium");
      expect(q(item.uses[1].href).get("style"), art).toBe(art);
    }
    expect(LIBRARY.filter((i) => ["look-board", "look-neon", "look-blueprint"].includes(i.id))).toHaveLength(3);
  });
  it("the seven AI styles are ready, with the owner-seen sample as still and a link into คลิปตามโจทย์", () => {
    // spec 2026-11-14-ai-picture-styles-design; tells as the catalogue had them
    const AI = [
      ["cartoon3d", "การ์ตูน 3D", "ภาพ AI ตัวการ์ตูนสามมิติสีสด"], ["clay", "ดินเคลย์", "ภาพ AI เหมือนปั้นจากดินน้ำมัน"],
      ["anime", "อนิเมะ", "ภาพ AI สไตล์อนิเมะญี่ปุ่น"], ["watercolor", "สีน้ำ", "ภาพ AI สีน้ำนุ่มๆ"],
      ["isometric", "ไอโซเมตริก", "ภาพ AI มุมมองสามมิติแบบเมืองจำลอง"], ["collage", "ตัดแปะนิตยสาร", "ภาพ AI แบบตัดแปะจากนิตยสาร"],
      ["pixel", "พิกเซล", "ภาพ AI แบบเกมพิกเซล"],
    ] as const;
    for (const [id, name, tells] of AI) {
      const item = libraryItem(`ai-style-${id}`)!;
      expect(item, id).toBeDefined();
      expect([item.type, item.name, item.tells, item.product, item.ready], id).toEqual(["look", name, tells, "all", true]);
      expect(item.preview, id).toBe(`/library/ai-${id}.jpg`);
      expect(item.uses.map((u) => [u.tool, u.href]), id).toEqual([["prompt-story", `/studio/prompt-story?style=${id}`]]);
      expect(PICTURE_STYLES.find((s) => s.id === id)?.name, id).toBe(name);
    }
    expect(LIBRARY.filter((i) => i.id.startsWith("ai-style-")).map((i) => i.id)).toEqual(AI.map(([id]) => `ai-style-${id}`));
  });
  it("drops ลายไทยร่วมสมัย and the old ids of การ์ตูน 3D and ตัดแปะนิตยสาร", () => {
    for (const id of ["ai-style-thai-pattern", "ai-style-3d", "ai-style-magazine-collage"]) expect(libraryItem(id), id).toBeUndefined();
    expect(LIBRARY.some((i) => i.name.includes("ลายไทย"))).toBe(false);
  });
  it("every device lists the seven looks, the three new ones kept on its topic", () => {
    for (const d of DEVICES) {
      const looks = libraryItem(d.key)!.looks!;
      expect(looks, d.key).toHaveLength(7);
      for (const id of ["board", "neon", "blueprint"]) {
        const l = looks.find((x) => x.id === id)!;
        expect(l.preview, `${d.key} ${id}`).toBe(`/library/${d.key}-${id}.jpg`);
        expect(q(l.uses[0].href).get("look"), `${d.key} ${id}`).toBe(id);
      }
    }
  });
  it("an info-route story link opens on a topic the look can draw", () => {
    const plots = LIBRARY.flatMap(allUses).filter((u) => u.tool === "story-clip")
      .map((u) => new URL(u.href, "http://x").searchParams).filter((q) => ["plot", "board", "neon", "blueprint"].includes(q.get("look") ?? ""));
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
