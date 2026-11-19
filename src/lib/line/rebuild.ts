import {
  createRichMenu, deleteRichMenu, listRichMenus, pointAliasAt, setDefaultRichMenu, uploadRichMenuImage,
} from "@/lib/line/client";
import { FIRST_MENU, MENUS, richMenuBody } from "@/lib/line/rich-menu";
import { drawMenu } from "@/lib/line/rich-menu-image";

/**
 * Builds the LINE account's two menus afresh, from POST /api/line/rich-menu or the back office.
 *
 * Each menu is created, drawn on, and given its alias; คำนวณเบี้ย becomes the one every friend
 * sees. Each picture's tabs switch to a menu by alias, which LINE does not check when the menu
 * is made, so the two can be made in either order. Menus this app made earlier (their names
 * begin "advisor-") are deleted once the new ones are in place, so running it twice leaves two
 * menus, not four. Anybody still linked to an old menu falls back to the default with it.
 *
 * On a failure the error carries what was made before it, so it can be found and deleted.
 */
export async function rebuildMenus(): Promise<{ menus: Record<string, string>; deleted: number }> {
  const made: Record<string, string> = {};
  try {
    for (const menu of Object.values(MENUS)) {
      const png = await (await drawMenu(menu)).arrayBuffer();
      const id = await createRichMenu(richMenuBody(menu));
      await uploadRichMenuImage(id, png);
      await pointAliasAt(menu.alias, id);
      made[menu.name] = id;
    }
    await setDefaultRichMenu(made[FIRST_MENU]);
    const fresh = new Set(Object.values(made));
    const old = (await listRichMenus()).filter((m) => m.name.startsWith("advisor-") && !fresh.has(m.richMenuId));
    for (const m of old) await deleteRichMenu(m.richMenuId);
    return { menus: made, deleted: old.length };
  } catch (e) {
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { made });
  }
}
