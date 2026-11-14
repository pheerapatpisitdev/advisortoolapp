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
const { MONEY_INPUTS } = await import("@/lib/story/topics");
const { TAX_RATES } = await import("@/lib/scene-library/tax-th");

const base = { initial: [], cost: null, prices: {} as never, quota: null, pages: [], eleven: [] };
const story = (start?: Record<string, string>) => renderToStaticMarkup(createElement(StoryClipBoard, { ...base, start: start && storyStartFrom(start) }));

describe("คลิปเล่าเรื่อง's form: ทุนชีวิต ภาษี มรดก", () => {
  it("lists the shelf after ประกันสุขภาพ, with its three topics", () => {
    const html = story();
    const health = html.indexOf('label="ประกันสุขภาพ"'), money = html.indexOf('label="ทุนชีวิต ภาษี มรดก"');
    expect(health).toBeGreaterThan(0);
    expect(money).toBeGreaterThan(health);
    const group = html.slice(money, html.indexOf("</optgroup>", money));
    expect(group).toContain('value="lifeneed"');
    expect(group).toContain('value="ciincome"');
    expect(group).toContain('value="taxback"');
    // no longer “coming soon”
    expect(html).not.toContain("ลดหย่อนภาษีปลายปี");
  });

  for (const topic of ["lifeneed", "ciincome", "taxback"] as const) {
    it(`${topic}: shows its optional inputs, each labelled, none required`, () => {
      const html = story({ topic });
      expect(html).toMatch(new RegExp(`<option value="${topic}" selected=""`));
      expect(html).toContain(">ทุนชีวิต ภาษี มรดก<");
      for (const f of MONEY_INPUTS[topic]) {
        expect(html, f.key).toContain(f.label);
        expect(html, f.key).toContain(`id="sc-money-${f.key}"`);
      }
      expect(html).toContain("ไม่ใส่ก็ได้");
      // the clip can be made with nothing typed (Review Focus 5)
      const make = html.match(/<button[^>]*>สร้างคลิป<\/button>/)?.[0];
      expect(make).toBeDefined();
      expect(make).not.toContain('disabled=""');
      // the looks told in points are offered here
      expect(html).toContain(">ปากกาพล็อตเตอร์</button>");
    });
  }

  it("taxback: the bracket is one of the table's rates, picked by a chip, or none", () => {
    const html = story({ topic: "taxback" });
    expect(html).toContain("ฐานภาษี");
    expect(html).toContain(">ไม่ระบุ</button>");
    for (const r of TAX_RATES) expect(html, String(r)).toContain(`>${r}%</button>`);
    expect(story({ topic: "lifeneed" })).not.toContain(">20%</button>");
  });

  it("opens a money topic in a look told in points from its link", () => {
    const html = story({ topic: "ciincome", look: "neon" });
    expect(html).toMatch(/<option value="ciincome" selected=""/);
    expect(html).toMatch(/<button[^>]*class="[^"]*font-medium[^"]*"[^>]*>นีออน<\/button>/);
  });
});
