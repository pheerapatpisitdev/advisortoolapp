import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { collectShotstack, hashToken, videoOfJob } from "@/lib/quote-video/rows";

/**
 * Shotstack telling us a ดีไซน์พิเศษ render has ended (src/lib/quote-video/make.ts cutWithShotstack).
 * The link carries our job's id and token (the row keeps only the token's sha256, compared in
 * constant time); Shotstack's body names its render, and nothing else in it is trusted: where the
 * render stands is asked of Shotstack (collectShotstack), which copies a finished file in. A job we
 * do not have answers 200; a failure to read or write is 500, so the call may come again.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// a ~30MB file is read from Shotstack and put in our bucket
export const maxDuration = 120;

const ok = () => NextResponse.json({ ok: true });

function sameToken(given: string, expectedHash: string | undefined): boolean {
  if (typeof expectedHash !== "string") return false;
  const a = Buffer.from(hashToken(given));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job");
  const token = url.searchParams.get("token");
  if (!job || !token) return NextResponse.json({ error: "bad link" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const render = typeof body?.id === "string" ? body.id : undefined;
  let row: Awaited<ReturnType<typeof videoOfJob>>;
  try {
    row = await videoOfJob(job);
  } catch (e) {
    console.error("shotstack webhook: lookup failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  if (!row) return ok();
  if (!sameToken(token, row.job?.tokenHash)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await collectShotstack(row, render);
  } catch (e) {
    console.error(`shotstack job ${job}: not collected:`, e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  return ok();
}
