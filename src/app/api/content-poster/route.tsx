import type { NextRequest } from "next/server";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { decodePoster, isSizeId, type SizeId } from "@/lib/content/poster";
import { drawPoster } from "@/lib/content/poster-draw";
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
 */

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
      // the picture is a pure function of its URL, so it can be kept as long as anyone likes
      "cache-control": "public, max-age=86400, immutable",
      ...(q.get("download") ? { "content-disposition": `attachment; filename="poster-${sizeId}.png"` } : {}),
    },
  });
}
