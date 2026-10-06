import { linkRichMenu, richMenuIdOfAlias } from "@/lib/line/client";
import { MENUS } from "@/lib/line/rich-menu";

/**
 * Moves a customer to the menu for after a price.
 *
 * The menu is found by its alias and the answer is kept for a while, so a customer asking
 * three questions is one lookup, not three. A missing alias is kept too, for less time: an
 * account whose menus were never built should not have a call made for every quotation, and
 * should notice within minutes of building them.
 *
 * It never throws. The customer has been answered by now; a menu that did not change is a
 * smaller loss than a failed turn.
 */
const FOUND_MS = 10 * 60_000;
const MISSING_MS = 2 * 60_000;
let known: { id: string | null; until: number } | undefined;

/** forgets what was looked up; for tests, which would otherwise see the last one's answer */
export function forgetMenuIds(): void {
  known = undefined;
}

async function quotedMenuId(): Promise<string | null> {
  if (known && known.until > Date.now()) return known.id;
  const id = await richMenuIdOfAlias(MENUS.quoted.alias);
  known = { id, until: Date.now() + (id ? FOUND_MS : MISSING_MS) };
  return id;
}

export async function showQuotedMenu(userId: string): Promise<void> {
  try {
    const id = await quotedMenuId();
    if (id) await linkRichMenu(userId, id);
  } catch (e) {
    console.error("rich menu not changed:", e);
  }
}
