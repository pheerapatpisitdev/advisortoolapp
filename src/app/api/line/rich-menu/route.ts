import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import {
  createRichMenu, deleteRichMenu, listRichMenus, pointAliasAt, setDefaultRichMenu, uploadRichMenuImage,
} from "@/lib/line/client";
import { MENUS, richMenuBody } from "@/lib/line/rich-menu";
import { drawMenu } from "@/lib/line/rich-menu-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Builds the LINE account's two menus afresh: POST here with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Each menu is created, drawn on, and given its alias; the first becomes the one every customer
 * sees. The bot finds the second by its alias, so there is nothing to copy into the settings.
 * Menus this app made earlier (their names begin "advisor-") are deleted once the new ones are
 * in place, so running it twice leaves two menus, not four. A customer already shown the old
 * second menu is linked to a menu that no longer exists, and LINE falls back to the default
 * for them until the next price moves them again.
 *
 * Run by hand, not by cron: a menu is changed when somebody decides it should be.
 */
export async function POST(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;

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
    return NextResponse.json({ ok: true, menus: made, deleted: old.length });
  } catch (e) {
    console.error("rich menu build failed:", e);
    // what was made before the failure is named, so it can be found and deleted by hand
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), made }, { status: 500 });
  }
}
