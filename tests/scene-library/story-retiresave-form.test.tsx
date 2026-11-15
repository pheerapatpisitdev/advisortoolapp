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

describe("คลิปเล่าเรื่อง's form: เก็บเงินไว้ใช้ตอนเกษียณ", () => {
  it("lists the topic on the money shelf", () => {
    const html = story();
    const money = html.indexOf('label="ทุนชีวิต ภาษี มรดก"');
    expect(html.slice(money, html.indexOf("</optgroup>", money))).toContain('value="retiresave"');
  });

  it("shows the pension's inputs with no switch, as ส่งมอบกรมธรรม์ shows the plan", () => {
    const html = story({ topic: "retiresave" });
    expect(html).toContain("บำนาญที่อยากได้ ต่อเดือน (บาท)");
    expect(html).toContain("เริ่มรับบำนาญอายุ");
    expect(html).not.toContain("ใส่ตัวเลขจริง</b>");
    expect(html).toContain("ตัวเลขจากเครื่องคิดหน้า /bumnan95");
  });

  it("asks for the one who wonders, not a hero or the pool of 48", () => {
    const html = story({ topic: "retiresave" });
    expect(html).toContain("คนที่สงสัย");
    expect(html).toContain("ฉากเปิด · คนที่สงสัย");
    expect(html).not.toContain("47 คน");
    expect(html).not.toContain("วงแดง");
    expect(html).not.toContain("ตัวเอกของเรื่อง");
  });

  it("keeps the switch on ใกล้เกษียณ, where the pension is optional", () => {
    const html = story({ topic: "preretire" });
    expect(html).toContain("ใส่ตัวเลขจริง</b>");
  });
});
