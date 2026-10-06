import type { NextRequest } from "next/server";
import { MENUS, type MenuName } from "@/lib/line/rich-menu";
import { drawMenu } from "@/lib/line/rich-menu-image";

export const runtime = "nodejs";

/** A menu's picture, for looking at before it is uploaded: /api/line/menu-image?menu=start */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("menu") as MenuName | null;
  const menu = name ? MENUS[name] : undefined;
  if (!menu) return Response.json({ error: "menu=start หรือ menu=quoted" }, { status: 400 });
  return drawMenu(menu);
}
