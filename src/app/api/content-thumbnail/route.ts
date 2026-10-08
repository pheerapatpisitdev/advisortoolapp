import { refuseUnless } from "@/lib/auth/viewer";
import { makeThumbnail } from "@/lib/content/thumbnail-run";
import { parseSettings } from "@/lib/content/thumbnail-history";

/**
 * A video cover, drawn: a plain request rather than a server action, as the other pictures are
 * (content-draw), so the page stays usable while it draws. Owner only. Two image models at 90 s
 * each, the reading and the keeping: the 300 s the function allows.
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  const refused = await refuseUnless("owner");
  if (refused) return refused;
  const body = await req.json().catch(() => null) as { settings?: unknown; painter?: unknown } | null;
  const settings = parseSettings(body?.settings);
  if (!settings) return Response.json({ ok: false, error: "ข้อมูลภาพปกไม่ครบ (ต้องมีหัวปก ขนาด และสไตล์)" }, { status: 400 });
  return Response.json(await makeThumbnail(settings, typeof body?.painter === "string" ? body.painter : undefined));
}
