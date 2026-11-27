import { siteUrl } from "@/lib/site-url";
import { CHOOSE_HEALTH, CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE } from "@/lib/assistant/choose";
import { WANTS_IN } from "@/lib/assistant/common";

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
  | "video" | "story" | "spark" | "bell" | "play" | "wallet"
  | "hospital" | "apply";

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
  | { bounds: Bounds; action: { type: "message"; label: string; text: string } }
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

/* ── the customers' menu ──────────────────────────────────────────────────────────────────
 * The account serves customers as well as agents (owner, 2026-11-24; mockup
 * https://claude.ai/artifact/XPd7v5yLHLLwXAmokxCePE, chose ข ก). Every friend sees this menu;
 * an agent who has proved their six-digit code is shown the agents' two tabs in its place
 * (src/lib/line/agent-line.ts) and falls back to this one when they unlink.
 *
 * A button here writes in the chat, as the customer would have, and the bot answers: each
 * says exactly what a button of the bot's own says, so it is read the same way. The strip
 * under them is the agents' door: it opens the page that asks for the code. */

export interface CustomerButton {
  /** what the tap writes in the chat: words the bot already reads */
  say: string;
  /** the label, at most twenty characters */
  title: string;
  /** the title as the picture writes it, where it is too long for one line of a button */
  lines?: [string, string];
  sub: string;
  icon: MenuIcon;
  lead?: true;
}

export interface CustomerMenuSpec {
  name: "customer";
  alias: string;
  width: 2500;
  height: 1686;
  columns: 3;
  chatBarText: string;
  buttons: CustomerButton[];
  /** the agents' door: its words on the picture, and its label (at most twenty characters) */
  strip: { words: string; label: string };
}

/** The agents' door along the bottom of the customers' picture, in the picture's own pixels. */
export const STRIP_HEIGHT = 190;

/** What the hospital button writes: a health subject (assistant/choose.ts) the health brain answers by asking the province. */
export const ASK_HOSPITALS = "โรงพยาบาลในเครือ";

export const CUSTOMER_MENU: CustomerMenuSpec = {
  name: "customer",
  alias: "advisor-customer",
  width: 2500,
  height: 1686,
  columns: 3,
  chatBarText: "เมนู",
  buttons: [
    { say: CHOOSE_HEALTH, title: "ประกันสุขภาพ", sub: "iHealthy Ultra", icon: "health" },
    { say: CHOOSE_LIFE, title: "Life Protect", sub: "ชีวิต x 2", icon: "life" },
    { say: CHOOSE_ISHIELD, title: "iShield", sub: "โรคร้ายแรง", icon: "shield" },
    { say: CHOOSE_LEGACY, title: "มรดกเพื่อครอบครัว", lines: ["มรดก", "เพื่อครอบครัว"], sub: "Family Legacy", icon: "legacy" },
    { say: ASK_HOSPITALS, title: "โรงพยาบาลในเครือ", lines: ["โรงพยาบาล", "ในเครือ"], sub: "เช็กตามจังหวัด", icon: "hospital" },
    { say: WANTS_IN, title: "สนใจสมัคร", sub: "ให้แอดมินติดต่อ", icon: "apply", lead: true },
  ],
  strip: { words: "สำหรับตัวแทน · ยืนยันรหัส 6 หลัก", label: "สำหรับตัวแทน" },
};

/** The menu an agent is shown once linked: the first of the two tabs. */
export const AGENT_MENU: MenuName = FIRST_MENU;

/** Where the customers' buttons sit: the whole picture above the strip, cut as the agents' are. */
export function customerButtonBounds(menu: CustomerMenuSpec): Bounds[] {
  const rows = Math.ceil(menu.buttons.length / menu.columns);
  const cellW = Math.floor(menu.width / menu.columns);
  const cellH = Math.floor((menu.height - STRIP_HEIGHT) / rows);
  return menu.buttons.map((_, i) => {
    const col = i % menu.columns;
    const row = Math.floor(i / menu.columns);
    return {
      x: col * cellW,
      y: row * cellH,
      width: col === menu.columns - 1 ? menu.width - col * cellW : cellW,
      height: row === rows - 1 ? menu.height - STRIP_HEIGHT - row * cellH : cellH,
    };
  });
}

export function stripBounds(menu: CustomerMenuSpec): Bounds {
  return { x: 0, y: menu.height - STRIP_HEIGHT, width: menu.width, height: STRIP_HEIGHT };
}

/** Every tappable area: the six buttons, then the agents' door, which opens `door`. */
export function customerAreas(menu: CustomerMenuSpec, door: string): MenuArea[] {
  const buttons: MenuArea[] = customerButtonBounds(menu).map((bounds, i) => {
    const b = menu.buttons[i];
    return { bounds, action: { type: "message", label: b.title, text: b.say } };
  });
  return [...buttons, { bounds: stripBounds(menu), action: { type: "uri", label: menu.strip.label, uri: door } }];
}

/** The body LINE's create-menu call takes for the customers' menu. */
export function customerMenuBody(menu: CustomerMenuSpec, door: string) {
  return {
    size: { width: menu.width, height: menu.height },
    selected: true,
    name: `advisor-${menu.name}`,
    chatBarText: menu.chatBarText,
    areas: customerAreas(menu, door),
  };
}
