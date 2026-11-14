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

const { StoryClipBoard } = await import("@/app/studio/story-clip/StoryClipBoard");
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
