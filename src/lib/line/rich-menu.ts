import { CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE } from "@/lib/assistant/choose";
import { ASK_FOR_TABLE, WANTS_IN } from "@/lib/assistant/common";
import { PDF_YES } from "@/lib/assistant/pdf";

/**
 * The menu pinned under the LINE chat: a picture cut into buttons, each of which types a
 * message for the customer.
 *
 * Every button is a message action, so the webhook needs nothing new — a tap arrives as the
 * words on the button, which is exactly how the bot's own buttons already arrive. The words are
 * the bot's own constants, so a button cannot drift from what the bot reads.
 *
 * There are two menus. The first is everyone's, the way into the three plans the bot offers a
 * stranger (the health plan is left off on purpose, as it is from the bot's own first question).
 * The second replaces it once a Life Protect price has been given: the table, the file and the
 * way on. Only that brain reads "ขอตารางมูลค่า", so only that customer is moved. A menu is
 * linked to a customer through the API, which costs nothing against the month's pushes.
 */

export type MenuName = "start" | "quoted";

export interface MenuButton {
  /** the words the button types for the customer: what the bot reads */
  text: string;
  /** the label, at most twenty characters, which LINE reads out for the button */
  title: string;
  /** a line under the title, drawn on the picture only */
  sub: string;
}

export interface MenuSpec {
  name: MenuName;
  /** the name LINE keeps for this menu's current build, so the bot can find it after a rebuild */
  alias: string;
  width: 2500;
  height: 843 | 1686;
  columns: number;
  /** the bar's own words where the menu is folded, at most fourteen characters */
  chatBarText: string;
  buttons: MenuButton[];
}

export const MENUS: Record<MenuName, MenuSpec> = {
  start: {
    name: "start",
    alias: "advisor-start",
    width: 2500,
    height: 1686,
    columns: 2,
    chatBarText: "เลือกแบบประกัน",
    buttons: [
      { text: CHOOSE_LIFE, title: "Life Protect", sub: "ประกันชีวิต เบี้ยไม่ทิ้ง ขายคืนได้" },
      { text: CHOOSE_LEGACY, title: "มรดกเพื่อครอบครัว", sub: "วงเงินใหญ่ เบี้ยเบา" },
      { text: CHOOSE_ISHIELD, title: "iShield", sub: "ประกันโรคร้าย เบี้ยไม่ทิ้ง" },
      { text: WANTS_IN, title: "สนใจสมัคร", sub: "รับแบบฟอร์ม คุยกับตัวแทน" },
    ],
  },
  quoted: {
    name: "quoted",
    alias: "advisor-quoted",
    width: 2500,
    height: 843,
    columns: 3,
    chatBarText: "ตาราง · PDF",
    buttons: [
      { text: ASK_FOR_TABLE, title: "ตารางมูลค่า", sub: "เงินคืนทุกปี" },
      { text: PDF_YES, title: "ไฟล์ PDF", sub: "เก็บไว้ ส่งต่อครอบครัว" },
      { text: WANTS_IN, title: "สนใจสมัคร", sub: "รับแบบฟอร์ม" },
    ],
  },
};

export interface MenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: "message"; label: string; text: string };
}

/**
 * Where each button sits, left to right and top to bottom. The last column and the last row take
 * whatever the division left over, so the buttons cover the picture to its edge.
 */
export function menuAreas(menu: MenuSpec): MenuArea[] {
  const rows = Math.ceil(menu.buttons.length / menu.columns);
  const cellW = Math.floor(menu.width / menu.columns);
  const cellH = Math.floor(menu.height / rows);
  return menu.buttons.map((b, i) => {
    const col = i % menu.columns;
    const row = Math.floor(i / menu.columns);
    return {
      bounds: {
        x: col * cellW,
        y: row * cellH,
        width: col === menu.columns - 1 ? menu.width - col * cellW : cellW,
        height: row === rows - 1 ? menu.height - row * cellH : cellH,
      },
      action: { type: "message", label: b.title, text: b.text },
    };
  });
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

/**
 * Whether this answer moves the customer to the menu for after a price: a Life Protect
 * quotation has just been given.
 */
export function wantsQuotedMenu(answer: { priced?: boolean; product: string | null }): boolean {
  return answer.priced === true && answer.product === "lifeprotect";
}
