import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { sendConversion, type Conversion } from "@/lib/meta/capi";

/**
 * The browser half of a conversion asks the server to send the same event.
 *
 * The id in the body is the one the pixel already used. Nothing asks who is calling — a
 * visitor's browser is — so only what our own pages send goes on to Meta (src/components/meta/
 * track.ts): the three events they fire, a page's name, and no email, phone or value. Anyone
 * could post a Lead with any figures before, under the pixel's server token, and teach the
 * adverts' optimiser fake customers (review, 2026-10-11).
 */

const NAMES = new Set<Conversion["eventName"]>(["ViewContent", "Contact", "Quote"]);

/** a visitor fires a handful per page; a script fires them in a loop */
const allowIp = limiter(30, 60_000);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    eventName?: string;
    eventId?: string;
    eventSourceUrl?: string;
    customData?: Record<string, unknown>;
  } | null;
  if (!body || !body.eventName || !NAMES.has(body.eventName as Conversion["eventName"]) || typeof body.eventId !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const h = await headers();
  const ip = clientIp(h);
  if (!allowIp(ip)) return NextResponse.json({ ok: false }, { status: 429 });
  const jar = await cookies();
  const page = body.customData?.content_name;
  await sendConversion({
    eventName: body.eventName as Conversion["eventName"],
    eventId: body.eventId.slice(0, 80),
    actionSource: "website",
    eventSourceUrl: typeof body.eventSourceUrl === "string" ? body.eventSourceUrl.slice(0, 500) : undefined,
    fbp: jar.get("_fbp")?.value,
    fbc: jar.get("_fbc")?.value,
    customData: typeof page === "string" ? { content_name: page.slice(0, 100) } : undefined,
    clientIp: ip === "unknown" ? undefined : ip,
    userAgent: h.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
