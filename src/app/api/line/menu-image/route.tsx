import type { NextRequest } from "next/server";
import { CUSTOMER_MENU, MENUS, type MenuName } from "@/lib/line/rich-menu";
import { drawCustomerMenu, drawMenu } from "@/lib/line/rich-menu-image";

export const runtime = "nodejs";

/** A menu's picture, for looking at before it is uploaded: /api/line/menu-image?menu=customer | calc | studio */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("menu");
  if (name === CUSTOMER_MENU.name) return drawCustomerMenu(CUSTOMER_MENU);
  const menu = name && Object.hasOwn(MENUS, name) ? MENUS[name as MenuName] : undefined;
  if (!menu) return Response.json({ error: "menu=customer, menu=calc หรือ menu=studio" }, { status: 400 });
  return drawMenu(menu);
}
