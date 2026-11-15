import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// the actions are server code: the board is drawn here only for its first markup
vi.mock("@/app/studio/quote-video/actions", () => ({
  makeStoryVideo: vi.fn(), myCost: vi.fn(), myVideos: vi.fn(), previewStoryFigure: vi.fn(), previewStoryHealth: vi.fn(),
  previewStoryPension: vi.fn(), voiceQuota: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));

const { StoryClipBoard } = await import("@/app/studio/story-clip/StoryClipBoard");
const { storyStartFrom } = await import("@/lib/scene-library/links");

const base = { initial: [], cost: null, prices: {} as never, quota: null, pages: [], eleven: [] };
const story = (start?: Record<string, string>) => renderToStaticMarkup(createElement(StoryClipBoard, { ...base, start: start && storyStartFrom(start) }));

describe("คลิปเล่าเรื่อง's form: ผู้ป่วยใน ผู้ป่วยนอก ต่างกันยังไง", () => {
  it("lists the topic on the ประกันสุขภาพ shelf", () => {
    const html = story();
    const at = html.indexOf('value="ipdopd"');
    expect(at).toBeGreaterThan(-1);
    const shelf = html.lastIndexOf("<optgroup", at);
    expect(html.slice(shelf, html.indexOf("</optgroup>", at))).toContain('value="agecost"');
  });

  it("shows the plan picker with no switch, and the same opening and hero words the other health topics have", () => {
    const html = story({ topic: "ipdopd" });
    const sister = story({ topic: "lumpsum" });
    expect(html).toContain("แผน iHealthy ที่ใช้เป็นตัวอย่าง");
    expect(html).toContain("อายุ (");
    const words = (h: string) => ["ตัวเอกของเรื่อง", "คนที่สงสัย", "ฉากเปิด · คนที่สงสัย", "ฉากเปิด", "ฉากเปิด · ตัวเอก"].filter((w) => h.includes(w));
    expect(words(html)).toEqual(words(sister));
  });
});
