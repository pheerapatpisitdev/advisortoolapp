import {
  createRichMenu, deleteRichMenu, linkRichMenu, listRichMenus, pointAliasAt, setDefaultRichMenu, uploadRichMenuImage,
} from "@/lib/line/client";
import { linkedLineIds } from "@/lib/line/agent-line";
import { liffId, liffUrl } from "@/lib/line/liff";
import { AGENT_MENU, CUSTOMER_MENU, customerMenuBody, menuLink, MENUS, richMenuBody } from "@/lib/line/rich-menu";
import { drawCustomerMenu, drawMenu } from "@/lib/line/rich-menu-image";

/**
 * What the strip under the customers' menu opens: the page inside LINE that asks an agent for
 * their six-digit code (src/lib/line/liff.ts), or the settings page that links the old way
 * where there is no such page yet.
 */
export function agentDoor(): string {
  const id = liffId();
  return id ? liffUrl(id) : menuLink("/studio/settings");
}

/**
 * Builds the LINE account's menus afresh, from POST /api/line/rich-menu or the back office.
 *
 * Three menus (owner chose ข ก, 2026-11-24): the customers', which every friend sees, and the
 * agents' two tabs, shown to each LINE linked to an agent. Each is created, drawn on, and given
 * its alias. A tab switches to a menu by alias, which LINE does not check when the menu is made,
 * so they can be made in any order. Menus this app made earlier (their names begin "advisor-")
 * are deleted once the new ones are in place, so running it twice leaves three menus, not six.
 * Deleting a menu drops everybody linked to it back to the default, so the linked agents are
 * shown the new agents' menu last.
 *
 * On a failure the error carries what was made before it, so it can be found and deleted.
 */
export async function rebuildMenus(): Promise<{ menus: Record<string, string>; deleted: number; agents: number }> {
  const made: Record<string, string> = {};
  try {
    for (const menu of Object.values(MENUS)) {
      const png = await (await drawMenu(menu)).arrayBuffer();
      const id = await createRichMenu(richMenuBody(menu));
      await uploadRichMenuImage(id, png);
      await pointAliasAt(menu.alias, id);
      made[menu.name] = id;
    }
    const png = await (await drawCustomerMenu(CUSTOMER_MENU)).arrayBuffer();
    const customer = await createRichMenu(customerMenuBody(CUSTOMER_MENU, agentDoor()));
    await uploadRichMenuImage(customer, png);
    await pointAliasAt(CUSTOMER_MENU.alias, customer);
    made[CUSTOMER_MENU.name] = customer;

    await setDefaultRichMenu(customer);
    const fresh = new Set(Object.values(made));
    const old = (await listRichMenus()).filter((m) => m.name.startsWith("advisor-") && !fresh.has(m.richMenuId));
    for (const m of old) await deleteRichMenu(m.richMenuId);

    let agents = 0;
    for (const userId of await linkedLineIds()) {
      // one LINE that has blocked the account must not stop the rest
      await linkRichMenu(userId, made[AGENT_MENU]).then(() => { agents += 1; })
        .catch((e) => console.error("[line] agents' menu not shown after rebuild:", e));
    }
    return { menus: made, deleted: old.length, agents };
  } catch (e) {
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { made });
  }
}
