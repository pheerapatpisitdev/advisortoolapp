import { refuseUnless } from "@/lib/auth/viewer";
import { makeThumbnail } from "@/lib/content/thumbnail-run";
import { parseSettings } from "@/lib/content/thumbnail-history";
import { closedNow } from "@/lib/switches/store";

/**
 * A video cover, drawn: a plain request rather than a server action, as the other pictures are
 * (content-draw), so the page stays usable while it draws. Every member's, paid as a picture
 * (thumbnail-run.ts); the owner's free. Two image models at 90 s
 * each, the reading and the keeping: the 300 s the function allows.
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  const refused = await refuseUnless();
  if (refused) return refused;
  // switched off by the Super Admin (เปิด-ปิดฟังก์ชัน)
  const closed = await closedNow("thumbnail");
  if (closed) return Response.json({ ok: false, error: closed }, { status: 503 });
  const body = await req.json().catch(() => null) as { settings?: unknown; painter?: unknown } | null;
  const settings = parseSettings(body?.settings);
  if (!settings) return Response.json({ ok: false, error: "ข้อมูลภาพปกไม่ครบ (ต้องมีหัวปก ขนาด และสไตล์)" }, { status: 400 });
  return Response.json(await makeThumbnail(settings, typeof body?.painter === "string" ? body.painter : undefined));
}
