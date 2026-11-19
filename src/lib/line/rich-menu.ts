import { siteUrl } from "@/lib/site-url";

/**
 * The menu pinned under the LINE chat: a picture cut into buttons.
 *
 * The account's friends are the agents who use this app, not their customers (owner,
 * 2026-11-19), so every button opens a page of the app: the calculators an agent prices with,
 * and Studio and the rest. Owner chose ค: two tabs on one picture, คำนวณเบี้ย and
 * Studio และอื่น ๆ, each six buttons under a strip of two tabs.
 *
 * A tab is LINE's own switch between two menus found by alias: it moves the menu without
 * writing anything in the chat. LINE does send the webhook a postback for it, which the
 * conversation ignores, as it ignores everything that is not typed text.
 *
 * A page opens in the phone's own browser (`openExternalBrowser=1`), not in LINE's: Google
 * refuses to sign anybody in inside an app's browser, and a member signed in once in the phone's
 * browser stays signed in there.
 */

export type MenuName = "calc" | "studio";

export type MenuIcon =
  | "life" | "health" | "shield" | "legacy" | "pa" | "grid"
  | "video" | "story" | "spark" | "bell" | "play" | "wallet";

export interface MenuButton {
  /** the page the button opens, as a path of this app */
  href: string;
  /** the label, at most twenty characters, which LINE reads out for the button */
  title: string;
  /** a line under the title, drawn on the picture only */
  sub: string;
  icon: MenuIcon;
  /** the one button of the tab drawn in terracotta: where most agents are going */
  lead?: true;
}

export interface MenuSpec {
  name: MenuName;
  /** the name LINE keeps for this menu's current build; a tab switches to a menu by it */
  alias: string;
  /** the words on this menu's own tab, at most twenty characters (they are its tab's label) */
  tab: string;
  width: 2500;
  height: 1686;
  columns: 3;
  /** the bar's own words where the menu is folded, at most fourteen characters */
  chatBarText: string;
  buttons: MenuButton[];
}

/** The strip of tabs along the top of each picture, in the picture's own pixels. */
export const TAB_HEIGHT = 275;

export const MENUS: Record<MenuName, MenuSpec> = {
  calc: {
    name: "calc",
    alias: "advisor-calc",
    tab: "คำนวณเบี้ย",
    width: 2500,
    height: 1686,
    columns: 3,
    chatBarText: "advisortool",
    buttons: [
      { href: "/lifeprotect", title: "Life Protect", sub: "ชีวิต x 2", icon: "life" },
      { href: "/ihealthy-ultra", title: "iHealthy Ultra", sub: "สุขภาพ", icon: "health" },
      { href: "/ishield", title: "iShield", sub: "โรคร้ายแรง", icon: "shield" },
      { href: "/legacy", title: "Family Legacy", sub: "มรดก", icon: "legacy" },
      { href: "/pa", title: "PA", sub: "อุบัติเหตุ", icon: "pa" },
      { href: "/home", title: "ทุกแบบประกัน", sub: "หน้าหลัก", icon: "grid", lead: true },
    ],
  },
  studio: {
    name: "studio",
    alias: "advisor-studio",
    tab: "Studio และอื่น ๆ",
    width: 2500,
    height: 1686,
    columns: 3,
    chatBarText: "advisortool",
    buttons: [
      { href: "/studio/quote-video", title: "วิดีโอนำเสนอ", sub: "คลิปจากใบเสนอ", icon: "video" },
      { href: "/studio/story-clip", title: "คลิปเล่าเรื่อง", sub: "Studio", icon: "story" },
      { href: "/ask", title: "ถาม AI", sub: "เงื่อนไข แบบประกัน", icon: "spark" },
      { href: "/whats-new", title: "มีอะไรใหม่", sub: "อัปเดตล่าสุด", icon: "bell" },
      { href: "/help", title: "วิธีใช้งาน", sub: "คลิปสอน", icon: "play" },
      { href: "/studio/wallet", title: "เติมเงิน", sub: "กระเป๋า Studio", icon: "wallet", lead: true },
    ],
  },
};

/** The tabs in the order they sit, left to right: the same on both pictures. */
export const TAB_ORDER: MenuName[] = ["calc", "studio"];

/** The menu every friend sees until they press the other tab. */
export const FIRST_MENU: MenuName = "calc";

/** The address a button opens: absolute, and in the phone's own browser. */
export function menuLink(href: string): string {
  const url = new URL(siteUrl(href));
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

type Bounds = { x: number; y: number; width: number; height: number };

export type MenuArea =
  | { bounds: Bounds; action: { type: "richmenuswitch"; label: string; richMenuAliasId: string; data: string } }
  | { bounds: Bounds; action: { type: "uri"; label: string; uri: string } };

/** Where each tab sits along the top strip. The last takes what the division left over. */
export function tabBounds(menu: MenuSpec): Bounds[] {
  const w = Math.floor(menu.width / TAB_ORDER.length);
  return TAB_ORDER.map((_, i) => ({
    x: i * w, y: 0, width: i === TAB_ORDER.length - 1 ? menu.width - i * w : w, height: TAB_HEIGHT,
  }));
}

/**
 * Where each button sits under the tabs, left to right and top to bottom. The last column and
 * the last row take whatever the division left over, so the buttons cover the picture to its edge.
 */
export function buttonBounds(menu: MenuSpec): Bounds[] {
  const rows = Math.ceil(menu.buttons.length / menu.columns);
  const cellW = Math.floor(menu.width / menu.columns);
  const cellH = Math.floor((menu.height - TAB_HEIGHT) / rows);
  return menu.buttons.map((_, i) => {
    const col = i % menu.columns;
    const row = Math.floor(i / menu.columns);
    return {
      x: col * cellW,
      y: TAB_HEIGHT + row * cellH,
      width: col === menu.columns - 1 ? menu.width - col * cellW : cellW,
      height: row === rows - 1 ? menu.height - TAB_HEIGHT - row * cellH : cellH,
    };
  });
}

/** Every tappable area of a menu: the two tabs, then its buttons. */
export function menuAreas(menu: MenuSpec): MenuArea[] {
  const tabs: MenuArea[] = tabBounds(menu).map((bounds, i) => {
    const to = MENUS[TAB_ORDER[i]];
    return {
      bounds,
      action: { type: "richmenuswitch", label: to.tab, richMenuAliasId: to.alias, data: `tab=${to.name}` },
    };
  });
  const buttons: MenuArea[] = buttonBounds(menu).map((bounds, i) => {
    const b = menu.buttons[i];
    return { bounds, action: { type: "uri", label: b.title, uri: menuLink(b.href) } };
  });
  return [...tabs, ...buttons];
}

/** The body LINE's create-menu call takes. */
export function richMenuBody(menu: MenuSpec) {
  return {
    size: { width: menu.width, height: menu.height },
    selected: true,
    name: `advisor-${menu.name}`,
    chatBarText: menu.chatBarText,
    areas: menuAreas(menu),
  };
}
