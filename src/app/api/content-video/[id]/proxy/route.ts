import { refuseUnless } from "@/lib/auth/viewer";
import { clipReadUrl } from "@/lib/content/clip-store";
import { getContent } from "@/lib/content/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A clip's preview (720p, made when the clip editor opened), for the editor's live player
 * (owner, 2026-10-02): a redirect to a link signed for an hour, guarded as the clip itself is
 * (../route.ts) — only for someone who may see the piece, never cached anywhere shared, and
 * nothing for a clip whose file the sweep let go.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const { id } = await params;
  if (!UUID.test(id)) return new Response("ข้อมูลไม่ถูกต้อง", { status: 400, headers: NO_STORE });
  // a piece that does not exist, one the caller may not see and one not prepared yet answer alike
  const item = await getContent(id).catch(() => null);
  const v = item?.output.video;
  const path = v?.edit?.proxyPath;
  if (!v || v.expired || !path) return new Response("ไม่พบคลิปนี้", { status: 404, headers: NO_STORE });
  let url: string;
  try {
    url = await clipReadUrl(path, 60 * 60);
  } catch (e) {
    console.error("clip preview link not signed:", e);
    return new Response("เปิดคลิปไม่ได้ ลองใหม่อีกครั้งนะครับ", { status: 502, headers: NO_STORE });
  }
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: url } });
}
