"use server";
import { revalidatePath } from "next/cache";
import { asWho } from "@/lib/ai/who";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { drawPiece, PIECES } from "@/lib/collage/library";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type DrawResult = { ok: true; costThb: number; model: string } | { ok: false; error: string };

/** One piece of คลังภาพคอลลาจ drawn (again); the page asks for each piece in turn, so no call draws many. */
export async function drawCollagePiece(key: string): Promise<DrawResult> {
  const viewer = await requireStaff("backoffice");
  if (!PIECES.some((p) => p.key === key)) return { ok: false, error: "ไม่พบภาพนี้ในรายการ" };
  try {
    const r = await asWho(viewer.agentId, () => drawPiece(key));
    await audit("collage-draw", key, { model: r.model, costThb: r.costThb });
    revalidatePath("/admin/collage");
    return { ok: true, ...r };
  } catch (e) {
    console.error("collage piece not drawn:", key, e instanceof Error ? e.message : e);
    return { ok: false, error: `วาด${PIECES.find((p) => p.key === key)?.name ?? "ภาพ"}ไม่สำเร็จ ลองใหม่อีกครั้ง` };
  }
}
