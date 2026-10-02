import { NextResponse } from "next/server";
import { sweepClips } from "@/lib/content/clip-sweep";
import { refuseUnlessCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel calls this once a day (vercel.json) with the cron secret; see clip-sweep.ts. */
export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  try {
    return NextResponse.json(await sweepClips());
  } catch (e) {
    console.error("clip sweep failed:", e);
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }
}
