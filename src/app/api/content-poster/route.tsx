import type { NextRequest } from "next/server";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { decodePoster, isSizeId, type PosterSpec, type SizeId } from "@/lib/content/poster";
import { drawPoster } from "@/lib/content/poster-draw";
import { getContent } from "@/lib/content/store";
import { refuseUnless } from "@/lib/auth/viewer";

export const runtime = "nodejs";

/**
 * A content piece's poster, drawn — Thai set by a real font rather than by an image model.
 *
 * The owner's Maryjane project draws its posters this way (satori and resvg) because image
 * models mangle Thai: vowels float off their consonants and tone marks land on the wrong
 * letter. The faces are the quote card's IBM Plex Sans Thai; the drawing is satori 0.33 rather
 * than next/og, for the reason poster-png.ts gives.
 *
 * Everything the poster says is in the URL, so the picture costs nothing but CPU, an <img>
 * can show it, and a link can download it. The same words are checked for figures and for
 * Facebook's rules on the page before anyone downloads anything.
 *
 * What the URL cannot carry is a stored picture — an AI background, a claim's stickered papers
 * — only its path, "<piece id>/<file>". Those are drawn only for someone who may see that
 * piece (getContent asks src/lib/auth/scope.ts), and the result is the viewer's own to cache:
 * a claim paper in a shared cache is a customer's document handed to whoever asks next.
 */

/** Every stored picture the poster names belongs to a piece the caller may see. */
async function mayDraw(spec: PosterSpec): Promise<boolean> {
  const paths = [spec.background, ...(spec.documents ?? []).map((d) => d.path)].filter((p): p is string => Boolean(p));
  const pieces = [...new Set(paths.map((p) => p.split("/")[0]))];
  const seen = await Promise.all(pieces.map((id) => getContent(id).catch(() => null)));
  return seen.every(Boolean);
}

/** drawing is free but not nothing; a script asking a thousand times an hour is not a person */
const allow = limiter(400, 60 * 60_000);

export async function GET(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const who = clientIp(req.headers);
  if (!allow(`poster:${who}`)) return new Response("ขอรูปถี่เกินไป รอสักครู่นะครับ", { status: 429 });

  const q = req.nextUrl.searchParams;
  const spec = decodePoster(q.get("s") ?? "");
  if (!spec) return new Response("ข้อมูลโปสเตอร์ไม่ถูกต้อง", { status: 400 });
  const sizeId: SizeId = isSizeId(q.get("size")) ? q.get("size") as SizeId : "square";
  // the same answer as a piece that does not exist, so a path says nothing about whose it is
  if (!(await mayDraw(spec))) return new Response("ไม่พบรูปนี้", { status: 404 });

  let png: Buffer;
  try {
    png = await drawPoster(spec, sizeId);
  } catch (e) {
    console.error("poster render failed:", e);
    return new Response("วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", { status: 500 });
  }
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // the picture is a pure function of its URL, so it keeps — in the viewer's own browser only
      "cache-control": "private, max-age=86400, immutable",
      ...(q.get("download") ? { "content-disposition": `attachment; filename="poster-${sizeId}.png"` } : {}),
    },
  });
}
