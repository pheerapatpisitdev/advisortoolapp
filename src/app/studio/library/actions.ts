"use server";
import { requireMember } from "@/lib/auth/viewer";
import { isMarkKind, NOT_IN_LIBRARY, toggleMark, type Toggled } from "@/lib/scene-library/marks";

/** คลังแอนิเมชัน: the signed-in viewer's ★ บันทึก or อยากได้ on one piece, turned on or off */
export async function toggleLibraryMark(item: string, kind: string): Promise<Toggled> {
  const viewer = await requireMember();
  if (typeof item !== "string" || !isMarkKind(kind)) return { ok: false, error: NOT_IN_LIBRARY };
  return toggleMark(viewer.agentId, item, kind);
}
