import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { sweepStuckVideos } from "@/lib/quote-video/make";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel calls this once a day (vercel.json) with the cron secret: every clip stuck past its time
 * is failed and its hold given back, behind the sweep any board load runs (owner chose 2ก, 2026-10-18).
 */
export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  try {
    return NextResponse.json({ failed: await sweepStuckVideos(Date.now(), true) });
  } catch (e) {
    console.error("stuck clip sweep failed:", e);
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }
}
