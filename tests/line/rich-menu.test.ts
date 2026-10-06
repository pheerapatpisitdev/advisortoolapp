import { describe, expect, it } from "vitest";
import { MENUS, menuAreas, richMenuBody, wantsQuotedMenu } from "@/lib/line/rich-menu";
import { CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE } from "@/lib/assistant/choose";
import { ASK_FOR_TABLE, WANTS_IN } from "@/lib/assistant/common";
import { PDF_YES } from "@/lib/assistant/pdf";

/**
 * The rich menu is a row of buttons that each type a message for the customer, so what is
 * tested is that every message is one the bot reads, and that the buttons tile the picture.
 */
describe("the menus' buttons", () => {
  it("send exactly the words the bot's own buttons send", () => {
    expect(MENUS.start.buttons.map((b) => b.text)).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD, WANTS_IN]);
    expect(MENUS.quoted.buttons.map((b) => b.text)).toEqual([ASK_FOR_TABLE, PDF_YES, WANTS_IN]);
  });

  it("have titles LINE accepts: a label is cut at twenty characters", () => {
    for (const menu of Object.values(MENUS)) {
      for (const b of menu.buttons) expect(Array.from(b.title).length).toBeLessThanOrEqual(20);
      expect(Array.from(menu.chatBarText).length).toBeLessThanOrEqual(14);
    }
  });
});

describe("the menus' shape", () => {
  it("are one of the sizes LINE takes", () => {
    for (const { width, height } of Object.values(MENUS)) {
      expect(width).toBe(2500);
      expect([843, 1686]).toContain(height);
    }
  });

  it("tile the picture with no gap and no overlap", () => {
    for (const menu of Object.values(MENUS)) {
      const areas = menuAreas(menu);
      expect(areas).toHaveLength(menu.buttons.length);
      const covered = new Set<string>();
      for (const { bounds: b } of areas) {
        expect(b.x + b.width).toBeLessThanOrEqual(menu.width);
        expect(b.y + b.height).toBeLessThanOrEqual(menu.height);
        for (const x of [b.x, b.x + b.width - 1]) for (const y of [b.y, b.y + b.height - 1]) {
          const key = `${x},${y}`;
          expect(covered.has(key)).toBe(false);
          covered.add(key);
        }
      }
      // the whole width is used: the last column takes what the division left over
      expect(Math.max(...areas.map((a) => a.bounds.x + a.bounds.width))).toBe(menu.width);
      expect(Math.max(...areas.map((a) => a.bounds.y + a.bounds.height))).toBe(menu.height);
    }
  });

  it("send each button's words as a message, which the webhook reads like typing", () => {
    const body = richMenuBody(MENUS.quoted);
    expect(body.areas.map((a) => a.action)).toEqual(MENUS.quoted.buttons.map((b) => (
      { type: "message", label: b.title, text: b.text })));
    expect(body.selected).toBe(true);
    expect(body.size).toEqual({ width: 2500, height: 843 });
  });
});

describe("who is moved to the menu for after a price", () => {
  it("is a Life Protect customer who was just quoted, since only that brain reads the table button", () => {
    expect(wantsQuotedMenu({ priced: true, product: "lifeprotect" })).toBe(true);
    expect(wantsQuotedMenu({ priced: false, product: "lifeprotect" })).toBe(false);
    expect(wantsQuotedMenu({ priced: true, product: "legacy" })).toBe(false);
    expect(wantsQuotedMenu({ priced: true, product: null })).toBe(false);
  });
});
