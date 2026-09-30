import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** The planning board works by touch, by keyboard and in list view (final review, 2026-09-30). */

vi.mock("@/app/studio/plan", () => ({ planPiece: vi.fn(), unplanPiece: vi.fn(), markPlanDone: vi.fn() }));

const { PlanBoard, mayMoveTo } = await import("@/app/studio/calendar/PlanBoard");
const { monthGridDays } = await import("@/lib/content/calendar");

const TODAY = "2026-09-30";
const card = (id: string, day: string | null, doneAt: string | null = null) => ({ id, title: `หัว ${id}`, format: "post", day, doneAt, imageUrl: `/api/content-poster?s=${id}&size=square` });
const html = (listView: boolean) => renderToStaticMarkup(createElement(PlanBoard, {
  cells: monthGridDays(2026, 10), planned: [card("p1", "2026-10-02")], unplanned: [card("r1", null)], today: TODAY, listView,
}));

describe("the planning board", () => {
  it("offers a day picker for each piece on the rail, in both views", () => {
    for (const listView of [false, true]) {
      const out = html(listView);
      expect(out.match(/type="date"/g)?.length).toBe(1);
      expect(out).toContain('aria-label="วันที่จะวาง หัว r1"');
      expect(out).toContain("ย้ายวัน");
    }
  });

  it("makes each day a button that says how many pieces it holds, for a phone", () => {
    expect(html(false)).toContain('aria-label="ศุกร์ที่ 2 ต.ค. 2569 · 1 ชิ้น"');
  });
});

describe("moving a piece", () => {
  it("goes to a day not gone and not its own", () => {
    expect(mayMoveTo(card("p1", "2026-10-02"), "2026-10-03", TODAY)).toBe(true);
    expect(mayMoveTo(card("p1", "2026-10-02"), "2026-10-02", TODAY)).toBe(false);
    expect(mayMoveTo(card("p1", "2026-10-02"), "2026-09-29", TODAY)).toBe(false);
    expect(mayMoveTo(card("r1", null), TODAY, TODAY)).toBe(true);
  });
});

describe("a planned piece's poster", () => {
  it("shows on its card and on the rail, so a day can be told at a glance", () => {
    for (const listView of [false, true]) {
      const out = html(listView);
      expect(out).toContain('src="/api/content-poster?s=p1&amp;size=square"');
      expect(out).toContain('src="/api/content-poster?s=r1&amp;size=square"');
    }
  });
});
