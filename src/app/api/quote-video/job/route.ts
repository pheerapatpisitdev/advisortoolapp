import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { finishVideo, hashToken, videoOfJob } from "@/lib/quote-video/rows";

/**
 * Cloud Run telling us a วิดีโอนำเสนอ render has ended (src/lib/quote-video/make.ts). The body is
 * { id, token, state, outputs, error }, as infra/ffmpeg-core/render.mjs posts it; the token is the
 * job's own secret, of which the row keeps only the sha256, compared in constant time. A job we
 * do not have answers 200 and nothing else; a failure to write is 500, so the run tries again.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ok = () => NextResponse.json({ ok: true });

function sameToken(given: string, expectedHash: string | undefined): boolean {
  if (typeof expectedHash !== "string") return false;
  const a = Buffer.from(hashToken(given));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  let body: { id?: unknown; token?: unknown; state?: unknown; outputs?: unknown; error?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const { id, token, state } = body ?? {};
  if (typeof id !== "string" || !id || typeof token !== "string") return NextResponse.json({ error: "bad body" }, { status: 400 });
  let row: Awaited<ReturnType<typeof videoOfJob>>;
  try {
    row = await videoOfJob(id);
  } catch (e) {
    console.error("quote video webhook: lookup failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  if (!row) return ok();
  if (!sameToken(token, row.job?.tokenHash)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (state !== "done" && state !== "failed") return NextResponse.json({ error: "bad body" }, { status: 400 });
  const outputs = body.outputs && typeof body.outputs === "object" ? (body.outputs as Record<string, { path?: unknown }>) : {};
  const path = typeof outputs.out_1?.path === "string" ? outputs.out_1.path : undefined;
  try {
    // the job's own words on a failed run, kept as the clip's reason (run-record.ts)
    await finishVideo(row, state, path, typeof body.error === "string" ? body.error.slice(0, 300) : undefined);
  } catch (e) {
    console.error(`quote video job ${id}: not finished:`, e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  return ok();
}
