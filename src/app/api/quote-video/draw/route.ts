import { NextResponse } from "next/server";
import { drawScene } from "@/lib/quote-video/make";

/**
 * One scene of a วิดีโอนำเสนอ clip drawn (src/lib/quote-video/make.ts, owner 2026-10-12): produce
 * calls this once per scene, all at once, so each scene gets this route's whole time. The body is
 * { id, scene, token, agentName }; the token is the clip's drawing secret, of which only the
 * sha256 is kept beside the clip's files.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { id?: unknown; scene?: unknown; token?: unknown; agentName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const { id, scene, token, agentName } = body ?? {};
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id) || typeof scene !== "number" || typeof token !== "string" || typeof agentName !== "string") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  try {
    const r = await drawScene(id, scene, token, agentName);
    if (r === "refused") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`quote video ${id}: scene ${scene} not drawn:`, e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "not drawn" }, { status: 500 });
  }
}
