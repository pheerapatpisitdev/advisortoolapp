import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// the actions are server code: the boards are drawn here only for their first markup (before any restore)
vi.mock("@/app/studio/quote-video/actions", () => ({
  makeStoryVideo: vi.fn(), myCost: vi.fn(), myVideos: vi.fn(), previewStoryFigure: vi.fn(), previewStoryHealth: vi.fn(),
  previewStoryPension: vi.fn(), voiceQuota: vi.fn(),
}));
vi.mock("@/app/studio/prompt-story/actions", () => ({ redrawPromptPicture: vi.fn(), makePromptStory: vi.fn(), writePromptStory: vi.fn(), rewritePromptScene: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));

const { StoryClipBoard, readLook } = await import("@/app/studio/story-clip/StoryClipBoard");
const { STORY_CLIP_COLORS } = await import("@/lib/card-theme");
const { PromptStoryBoard } = await import("@/app/studio/prompt-story/PromptStoryBoard");
const { storyStartFrom, promptStartFrom } = await import("@/lib/scene-library/links");

const prices = {} as never;
const base = { initial: [], cost: null, prices, quota: null, pages: [], eleven: [] };
const story = (start?: Record<string, string>) => renderToStaticMarkup(createElement(StoryClipBoard, { ...base, start: start && storyStartFrom(start) }));
const prompt = (start?: Record<string, string>) => renderToStaticMarkup(createElement(PromptStoryBoard, { ...base, start: start && promptStartFrom(start) }));
/** the chip drawn as chosen, by its words */
const chosen = (html: string, words: string) => new RegExp(`<button[^>]*class="[^"]*font-medium[^"]*"[^>]*>${words}</button>`).test(html);

describe("คลิปเล่าเรื่อง opened from a link", () => {
  it("opens as today with no link", () => {
    const html = story();
    expect(html).toMatch(/<option value="pool48" selected=""/);
    expect(chosen(html, "สต็อปโมชันกระดาษ")).toBe(true);
  });
  it("opens on the linked topic and look", () => {
    const html = story({ topic: "roomcost", look: "plot" });
    expect(html).toMatch(/<option value="roomcost" selected=""/);
    expect(chosen(html, "ปากกาพล็อตเตอร์")).toBe(true);
    expect(chosen(html, "สต็อปโมชันกระดาษ")).toBe(false);
  });
  it("keeps the topic and its usual look when the shelf cannot draw ปากกาพล็อตเตอร์", () => {
    const html = story({ topic: "pool48", look: "plot" });
    expect(html).toMatch(/<option value="pool48" selected=""/);
    expect(html).not.toContain(">ปากกาพล็อตเตอร์</button>");
    expect(chosen(html, "สต็อปโมชันกระดาษ")).toBe(true);
  });
  it("ignores unknown values", () => {
    const html = story({ topic: "nope", look: "glass" });
    expect(html).toMatch(/<option value="pool48" selected=""/);
    expect(chosen(html, "สต็อปโมชันกระดาษ")).toBe(true);
  });
});

/** ไวต์บอร์ด นีออน บลูพริ้นท์ (spec 2026-11-14-story-looks-board-neon-blueprint): like ปากกาพล็อตเตอร์, only on the shelves told in points */
const NEW_LOOKS = [
  { art: "board", name: "ไวต์บอร์ด", ground: () => STORY_CLIP_COLORS.boardBoard },
  { art: "neon", name: "นีออน", ground: () => STORY_CLIP_COLORS.neonCentre },
  { art: "blueprint", name: "บลูพริ้นท์", ground: () => STORY_CLIP_COLORS.bpGround },
] as const;

describe("คลิปเล่าเรื่อง's three new looks", () => {
  it("shows their chips on a topic told in points, each opening chosen from its link with its own line and preview", () => {
    for (const l of NEW_LOOKS) {
      const html = story({ topic: "roomcost", look: l.art });
      for (const o of NEW_LOOKS) expect(html, `${l.art} ${o.name}`).toContain(`>${o.name}</button>`);
      expect(chosen(html, l.name), l.art).toBe(true);
      for (const o of NEW_LOOKS.filter((o) => o !== l)) expect(chosen(html, o.name), `${l.art} ${o.name}`).toBe(false);
      expect(chosen(html, "ปากกาพล็อตเตอร์"), l.art).toBe(false);
      expect(chosen(html, "สต็อปโมชันกระดาษ"), l.art).toBe(false);
      // the opening preview is drawn in the look's own ground
      expect(html, l.art).toContain(l.ground());
    }
    // the plotter's own line is not shown under the new looks
    expect(story({ topic: "roomcost", look: "neon" })).not.toContain("กระดาษสีครีม");
  });
  it("leaves them off a topic of any other shelf, and opens there in its usual look", () => {
    for (const l of NEW_LOOKS) {
      const html = story({ topic: "pool48", look: l.art });
      for (const o of NEW_LOOKS) expect(html, `${l.art} ${o.name}`).not.toContain(`>${o.name}</button>`);
      expect(chosen(html, "สต็อปโมชันกระดาษ"), l.art).toBe(true);
    }
  });
  it("remembers each look in this browser as it was left", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    try {
      for (const art of ["board", "neon", "blueprint", "plot", "line", "minimal", "paper"]) {
        store.set("story-look", JSON.stringify({ size: "square", palette: "color", narrator: "M", voice: "", gemini: "", art, ground: "warm" }));
        expect(readLook().art, art).toBe(art);
        expect(readLook().size, art).toBe("square");
      }
      // the retired อินโฟกราฟิก opens as ปากกาพล็อตเตอร์, an unknown look as the paper
      store.set("story-look", JSON.stringify({ art: "info" }));
      expect(readLook().art).toBe("plot");
      store.set("story-look", JSON.stringify({ art: "glass" }));
      expect(readLook().art).toBe("paper");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("คลิปตามโจทย์ opened from a link", () => {
  it("opens on the linked format and style", () => {
    const html = prompt({ format: "drama3", style: "line" });
    expect(html).toMatch(/aria-checked="true"[^>]*>การ์ตูนลายเส้น</);
    expect(html).toMatch(/aria-checked="false"[^>]*>สต็อปโมชันกระดาษ</);
    expect(html).toMatch(/aria-checked="true"[^>]*>ละครสั้น 3 ฉาก</);
    expect(html).toMatch(/aria-checked="false"[^>]*>ตามโจทย์</);
  });
  it("opens as today with no link or an unknown one", () => {
    for (const html of [prompt(), prompt({ format: "x", style: "real" })]) {
      expect(html).toMatch(/aria-checked="true"[^>]*>สต็อปโมชันกระดาษ</);
      expect(html).toMatch(/aria-checked="true"[^>]*>ตามโจทย์</);
    }
  });
});
