import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { syncIndexLevels } from "@/lib/index-levels/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel calls this every morning at 07:00 Bangkok (vercel.json) with the cron secret: Krungthai-AXA's
 * weekly report of the Citi Grandmaster RC 5 Index is read, every week in it kept, and the Global
 * Savings page drawn again with the newest level (owner chose ก, 2026-10-20).
 */
export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  const result = await syncIndexLevels();
  if (result.ok) revalidatePath("/global-saving");
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
