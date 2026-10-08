import { describePicture } from "@/lib/content/describe-run";
import { ACCEPTED_TYPES, MAX_IMAGE_BASE64 } from "@/lib/content/describe";
import { parseSwatches } from "@/lib/content/palette";
import { refuseUnless } from "@/lib/auth/viewer";

/**
 * A picture read into a prompt, as a plain request rather than a server action, as the picture
 * orders are (content-draw): a page's server actions run one after another, and an action's
 * body is limited to 1 MB. The limits and the budget are describePicture's own.
 */

export const maxDuration = 60;

const bad = (error: string) => Response.json({ ok: false, error }, { status: 400 });

export async function POST(req: Request) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const body = await req.json().catch(() => null) as { image?: { base64?: unknown; mimeType?: unknown; palette?: unknown } } | null;
  const image = body?.image;
  if (!image || typeof image.base64 !== "string" || typeof image.mimeType !== "string") return bad("ไม่พบรูปที่จะอ่าน");
  if (!(ACCEPTED_TYPES as readonly string[]).includes(image.mimeType) || !image.base64 || image.base64.length > MAX_IMAGE_BASE64) {
    return bad("ใช้ได้เฉพาะรูป jpg, png หรือ webp ที่ไม่ใหญ่เกินไป");
  }
  return Response.json(await describePicture({ base64: image.base64, mimeType: image.mimeType, palette: parseSwatches(image.palette) }));
}
