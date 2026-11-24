import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_MENU, ASK_HOSPITALS, buttonBounds, CUSTOMER_MENU, customerAreas, customerMenuBody, FIRST_MENU, menuAreas,
  menuLink, MENUS, richMenuBody, STRIP_HEIGHT, TAB_HEIGHT, TAB_ORDER,
} from "@/lib/line/rich-menu";
import { CHOOSE_HEALTH, CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE, productByTopic, productNamedIn } from "@/lib/assistant/choose";
import { WANTS_IN } from "@/lib/assistant/common";
import { hospitalReply } from "@/lib/assistant/hospitals";

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

/**
 * The customers' menu (owner chose ข ก, 2026-11-24): the account serves customers too, so every
 * friend sees six buttons that write in the chat for the bot to answer, and a strip that is the
 * agents' door. A linked agent is shown the agents' first tab in its place.
 */
describe("the customers' menu", () => {
  const door = "https://liff.line.me/2011423304-L4wJIP90";
  const areas = customerAreas(CUSTOMER_MENU, door);

  it("is the six buttons the owner chose, สนใจสมัคร the one in terracotta", () => {
    expect(CUSTOMER_MENU.buttons.map((b) => b.title)).toEqual(
      ["ประกันสุขภาพ", "Life Protect", "iShield", "มรดกเพื่อครอบครัว", "โรงพยาบาลในเครือ", "สนใจสมัคร"]);
    expect(CUSTOMER_MENU.buttons.filter((b) => b.lead).map((b) => b.title)).toEqual(["สนใจสมัคร"]);
  });

  it("writes the bot's own button words in the chat", () => {
    expect(CUSTOMER_MENU.buttons.map((b) => b.say)).toEqual(
      [CHOOSE_HEALTH, CHOOSE_LIFE, CHOOSE_ISHIELD, CHOOSE_LEGACY, ASK_HOSPITALS, WANTS_IN]);
    expect(areas.slice(0, 6).map((a) => a.action)).toEqual(
      CUSTOMER_MENU.buttons.map((b) => ({ type: "message", label: b.title, text: b.say })));
    for (const say of [CHOOSE_HEALTH, CHOOSE_LIFE, CHOOSE_ISHIELD, CHOOSE_LEGACY]) expect(productNamedIn(say), say).toBeDefined();
  });

  it("has a hospital button the health brain answers by asking the province, before any plan is chosen", () => {
    expect(productByTopic(ASK_HOSPITALS)).toBe("ihealthy");
    expect(hospitalReply(ASK_HOSPITALS, "th")?.asksProvince).toBe(true);
  });

  it("ends in the agents' door, which opens the page that asks for the code", () => {
    expect(areas.at(-1)?.action).toEqual({ type: "uri", label: "สำหรับตัวแทน", uri: door });
    expect(areas.at(-1)?.bounds).toEqual({ x: 0, y: 1686 - STRIP_HEIGHT, width: 2500, height: STRIP_HEIGHT });
  });

  it("has labels LINE accepts", () => {
    for (const b of CUSTOMER_MENU.buttons) expect(Array.from(b.title).length).toBeLessThanOrEqual(20);
    expect(Array.from(CUSTOMER_MENU.strip.label).length).toBeLessThanOrEqual(20);
    expect(Array.from(CUSTOMER_MENU.chatBarText).length).toBeLessThanOrEqual(14);
  });

  it("tiles the picture with no gap and no overlap", () => {
    let area = 0;
    for (const { bounds: b } of areas) area += b.width * b.height;
    for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) {
      const a = areas[i].bounds, c = areas[j].bounds;
      expect(a.x + a.width <= c.x || c.x + c.width <= a.x || a.y + a.height <= c.y || c.y + c.height <= a.y).toBe(true);
    }
    expect(area).toBe(2500 * 1686);
  });

  it("is made under its own name, and an agent's menu is the first tab", () => {
    const body = customerMenuBody(CUSTOMER_MENU, door);
    expect(body.name).toBe("advisor-customer");
    expect(body.size).toEqual({ width: 2500, height: 1686 });
    expect(AGENT_MENU).toBe("calc");
  });
});
