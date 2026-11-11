import { NextResponse } from "next/server";
import { cloudflareEnv } from "@/lib/cloudflare/env";
import { clipFile, helpClip } from "@/lib/help/clips";
import { byteRange } from "@/lib/help/range";

/**
 * A วิธีใช้งาน clip for the player. On Cloudflare the file comes from the Worker's own assets
 * and the asked-for slice is cut here (src/lib/help/range.ts says why); anywhere else the
 * static file already answers ranges, so the player is sent straight to it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!helpClip(id)) return new NextResponse("not found", { status: 404 });
  const assets = cloudflareEnv()?.ASSETS;
  if (!assets) return NextResponse.redirect(new URL(clipFile(id), request.url), 307);

  const res = await assets.fetch(new URL(clipFile(id), "https://assets.local"));
  if (!res.ok) return new NextResponse("not found", { status: 404 });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const base = { "content-type": "video/mp4", "accept-ranges": "bytes", "cache-control": "public, max-age=86400" };
  const range = byteRange(request.headers.get("range"), bytes.length);
  if (range === "bad") return new NextResponse(null, { status: 416, headers: { ...base, "content-range": `bytes */${bytes.length}` } });
  if (!range) return new NextResponse(bytes, { status: 200, headers: { ...base, "content-length": String(bytes.length) } });
  const part = bytes.subarray(range.start, range.end + 1);
  return new NextResponse(part, {
    status: 206,
    headers: { ...base, "content-length": String(part.length), "content-range": `bytes ${range.start}-${range.end}/${bytes.length}` },
  });
}
