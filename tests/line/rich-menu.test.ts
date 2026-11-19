import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buttonBounds, FIRST_MENU, menuAreas, menuLink, MENUS, richMenuBody, TAB_HEIGHT, TAB_ORDER,
} from "@/lib/line/rich-menu";

/**
 * The rich menu is for agents (owner, 2026-11-19, chose ค): two tabs, คำนวณเบี้ย and
 * Studio และอื่น ๆ, each six buttons that open a page of the app. What is tested is that every
 * button opens a page that exists, in the phone's own browser, that the tabs switch to each
 * other by alias, and that the areas tile the picture.
 */
const menus = Object.values(MENUS);

/** A path of this app has a page under src/app. */
function pageExists(href: string): boolean {
  return existsSync(join(process.cwd(), "src/app", href, "page.tsx"));
}

describe("the menus' buttons", () => {
  it("are the two tabs the owner chose, คำนวณเบี้ย shown first", () => {
    expect(TAB_ORDER.map((n) => MENUS[n].tab)).toEqual(["คำนวณเบี้ย", "Studio และอื่น ๆ"]);
    expect(FIRST_MENU).toBe("calc");
    expect(MENUS.calc.buttons.map((b) => b.href)).toEqual(
      ["/lifeprotect", "/ihealthy-ultra", "/ishield", "/legacy", "/pa", "/home"]);
    expect(MENUS.studio.buttons.map((b) => b.href)).toEqual(
      ["/studio/quote-video", "/studio/story-clip", "/ask", "/whats-new", "/help", "/studio/wallet"]);
  });

  it("each open a page this app has", () => {
    for (const menu of menus) for (const b of menu.buttons) expect(pageExists(b.href), b.href).toBe(true);
  });

  it("open in the phone's own browser, where Google lets a member sign in", () => {
    const url = new URL(menuLink("/lifeprotect"));
    expect(url.pathname).toBe("/lifeprotect");
    expect(url.searchParams.get("openExternalBrowser")).toBe("1");
    expect(url.protocol).toBe("https:");
  });

  it("have labels LINE accepts: a label is cut at twenty characters", () => {
    for (const menu of menus) {
      for (const b of menu.buttons) expect(Array.from(b.title).length).toBeLessThanOrEqual(20);
      expect(Array.from(menu.tab).length).toBeLessThanOrEqual(20);
      expect(Array.from(menu.chatBarText).length).toBeLessThanOrEqual(14);
    }
  });

  it("give each tab exactly one button drawn in terracotta", () => {
    for (const menu of menus) expect(menu.buttons.filter((b) => b.lead)).toHaveLength(1);
  });
});

describe("the tabs", () => {
  it("switch to the menu of that name by its alias, the same on both pictures", () => {
    for (const menu of menus) {
      const tabs = richMenuBody(menu).areas.filter((a) => a.action.type === "richmenuswitch");
      expect(tabs.map((a) => a.action)).toEqual(TAB_ORDER.map((n) => ({
        type: "richmenuswitch", label: MENUS[n].tab, richMenuAliasId: MENUS[n].alias, data: `tab=${n}`,
      })));
    }
  });
});

describe("the menus' shape", () => {
  it("are the size LINE takes for a full menu", () => {
    for (const { width, height } of menus) {
      expect(width).toBe(2500);
      expect(height).toBe(1686);
    }
  });

  it("put the buttons under the tab strip", () => {
    for (const menu of menus) for (const b of buttonBounds(menu)) expect(b.y).toBeGreaterThanOrEqual(TAB_HEIGHT);
  });

  it("tile the picture with no gap and no overlap", () => {
    for (const menu of menus) {
      const areas = menuAreas(menu);
      expect(areas).toHaveLength(TAB_ORDER.length + menu.buttons.length);
      let area = 0;
      for (const { bounds: b } of areas) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(menu.width);
        expect(b.y + b.height).toBeLessThanOrEqual(menu.height);
        area += b.width * b.height;
      }
      // every pair is disjoint, so a full sum means the picture is covered exactly once
      for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) {
        const a = areas[i].bounds, c = areas[j].bounds;
        const apart = a.x + a.width <= c.x || c.x + c.width <= a.x || a.y + a.height <= c.y || c.y + c.height <= a.y;
        expect(apart).toBe(true);
      }
      expect(area).toBe(menu.width * menu.height);
    }
  });

  it("open each button's page with a link action", () => {
    const body = richMenuBody(MENUS.studio);
    const links = body.areas.filter((a) => a.action.type === "uri").map((a) => a.action);
    expect(links).toEqual(MENUS.studio.buttons.map((b) => ({ type: "uri", label: b.title, uri: menuLink(b.href) })));
    expect(body.selected).toBe(true);
    expect(body.name).toBe("advisor-studio");
  });
});
