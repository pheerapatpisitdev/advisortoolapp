import { refuseUnless, requireMember } from "@/lib/auth/viewer";
import { deleteThumbnail } from "@/lib/content/thumbnail-history";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** one of the owner's own covers out of the history; another's id removes nothing */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refused = await refuseUnless("owner");
  if (refused) return refused;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ ok: false, error: "ไม่พบภาพนี้" }, { status: 400 });
  try {
    const viewer = await requireMember();
    await deleteThumbnail(viewer.agentId, id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("thumbnail not deleted:", e);
    return Response.json({ ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}
