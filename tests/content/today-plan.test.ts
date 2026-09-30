import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Today's plan opens its piece (final review, 2026-09-30): a client-side link to the page the
 * workbench is already on keeps its state and opened nothing, so these are plain links.
 */

vi.mock("next/link", () => ({ default: (p: { children: unknown }) => createElement("span", { "data-next-link": "" }, p.children as never) }));

const { TodayPlan } = await import("@/app/studio/TodayPlan");

describe("the banner of today's plan", () => {
  it("links each piece with a full page load, so the editor opens on it", () => {
    const out = renderToStaticMarkup(createElement(TodayPlan, { items: [{ id: "p1", title: "โพสต์วันนี้" }] }));
    expect(out).toContain('<a href="/studio/write?open=p1"');
    expect(out).toContain("1 ชิ้น");
    expect(out).not.toContain("data-next-link");
  });

  it("is not there when nothing is planned for today", () => {
    expect(renderToStaticMarkup(createElement(TodayPlan, { items: [] }))).toBe("");
  });
});
