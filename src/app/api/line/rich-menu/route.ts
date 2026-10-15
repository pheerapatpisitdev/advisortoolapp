import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { rebuildMenus } from "@/lib/line/rebuild";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Builds the LINE account's two menus afresh: POST here with `Authorization: Bearer <CRON_SECRET>`,
 * or press สร้างเมนูใหม่ on /admin/line (src/lib/line/rebuild.ts says what it does).
 *
 * Run by hand, not by cron: a menu is changed when somebody decides it should be.
 */
export async function POST(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  try {
    return NextResponse.json({ ok: true, ...(await rebuildMenus()) });
  } catch (e) {
    console.error("rich menu build failed:", e);
    // what was made before the failure is named, so it can be found and deleted by hand
    const made = (e as { made?: Record<string, string> }).made ?? {};
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), made }, { status: 500 });
  }
}
