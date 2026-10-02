import { refuseUnless } from "@/lib/auth/viewer";
import { clipReadUrl } from "@/lib/content/clip-store";
import { getContent } from "@/lib/content/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A piece's clip, for the editor's player (owner, 2026-10-02): a redirect to a link signed for
 * an hour. A plain GET rather than a server action read in an effect — the editor opening
 * refreshes the route, and an action's answer in flight across that was lost, so the player
 * never got its source. Only for someone who may see the piece (getContent asks
 * src/lib/auth/scope.ts), and never cached anywhere shared: the link opens the file.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const { id } = await params;
  if (!UUID.test(id)) return new Response("ข้อมูลไม่ถูกต้อง", { status: 400, headers: NO_STORE });
  // a piece that does not exist and one the caller may not see answer alike
  const item = await getContent(id).catch(() => null);
  const v = item?.output.video;
  if (!v || v.expired) return new Response("ไม่พบคลิปนี้", { status: 404, headers: NO_STORE });
  let url: string;
  try {
    url = await clipReadUrl(v.path, 60 * 60);
  } catch (e) {
    console.error("clip link not signed:", e);
    return new Response("เปิดคลิปไม่ได้ ลองใหม่อีกครั้งนะครับ", { status: 502, headers: NO_STORE });
  }
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: url } });
}
