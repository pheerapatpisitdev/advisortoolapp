import { describePicture } from "@/lib/content/describe-run";
import { ACCEPTED_TYPES, MAX_IMAGE_BASE64 } from "@/lib/content/describe";
import { parseSwatches } from "@/lib/content/palette";
import { isThumbBase64, saveReading } from "@/lib/content/describe-history";
import { refuseUnless, requireMember } from "@/lib/auth/viewer";

/**
 * A picture read into a prompt, as a plain request rather than a server action, as the picture
 * orders are (content-draw): a page's server actions run one after another, and an action's
 * body is limited to 1 MB. The limits and the budget are describePicture's own.
 *
 * A good read is also kept in the signed-in member's history (describe-history.ts) when it came
 * with a thumbnail. Keeping it never changes the read: if it cannot be kept the answer is the same,
 * with `saved: false`.
 */

export const maxDuration = 60;

const bad = (error: string) => Response.json({ ok: false, error }, { status: 400 });

export async function POST(req: Request) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const body = await req.json().catch(() => null) as { image?: { base64?: unknown; mimeType?: unknown; palette?: unknown; thumb?: unknown } } | null;
  const image = body?.image;
  if (!image || typeof image.base64 !== "string" || typeof image.mimeType !== "string") return bad("ไม่พบรูปที่จะอ่าน");
  if (!(ACCEPTED_TYPES as readonly string[]).includes(image.mimeType) || !image.base64 || image.base64.length > MAX_IMAGE_BASE64) {
    return bad("ใช้ได้เฉพาะรูป jpg, png หรือ webp ที่ไม่ใหญ่เกินไป");
  }
  const read = await describePicture({ base64: image.base64, mimeType: image.mimeType, palette: parseSwatches(image.palette) });
  if (!read.ok) return Response.json(read);
  const thumb = image.thumb;
  if (!isThumbBase64(thumb)) return Response.json({ ...read, saved: false });
  try {
    const viewer = await requireMember();
    const id = await saveReading(viewer.agentId, { prompt: read.prompt, summaryTh: read.summaryTh, palette: parseSwatches(image.palette), thumbBase64: thumb });
    return Response.json({ ...read, saved: true, id });
  } catch (e) {
    console.error("describe history not kept:", e);
    return Response.json({ ...read, saved: false });
  }
}
