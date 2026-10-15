import {
  createRichMenu, deleteRichMenu, listRichMenus, pointAliasAt, setDefaultRichMenu, uploadRichMenuImage,
} from "@/lib/line/client";
import { MENUS, richMenuBody } from "@/lib/line/rich-menu";
import { drawMenu } from "@/lib/line/rich-menu-image";

/**
 * Builds the LINE account's two menus afresh, from POST /api/line/rich-menu or the back office.
 *
 * Each menu is created, drawn on, and given its alias; the first becomes the one every customer
 * sees. The bot finds the second by its alias, so there is nothing to copy into the settings.
 * Menus this app made earlier (their names begin "advisor-") are deleted once the new ones are
 * in place, so running it twice leaves two menus, not four. A customer already shown the old
 * second menu is linked to a menu that no longer exists, and LINE falls back to the default
 * for them until the next price moves them again.
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
    await setDefaultRichMenu(made.start);
    const fresh = new Set(Object.values(made));
    const old = (await listRichMenus()).filter((m) => m.name.startsWith("advisor-") && !fresh.has(m.richMenuId));
    for (const m of old) await deleteRichMenu(m.richMenuId);
    return { menus: made, deleted: old.length };
  } catch (e) {
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { made });
  }
}
