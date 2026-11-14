"use server";
import { can } from "@/lib/auth/access";
import { requireMember } from "@/lib/auth/viewer";
import { isMarkKind, NOT_IN_LIBRARY, toggleMark, type Toggled } from "@/lib/scene-library/marks";
import { decideUpload, deleteUpload, withdrawUpload, type Verdict, type Withdrawn } from "@/lib/scene-library/uploads";

/** คลังแอนิเมชัน: the signed-in viewer's ★ บันทึก or อยากได้ on one piece, turned on or off */
export async function toggleLibraryMark(item: string, kind: string): Promise<Toggled> {
  const viewer = await requireMember();
  if (typeof item !== "string" || !isMarkKind(kind)) return { ok: false, error: NOT_IN_LIBRARY };
  return toggleMark(viewer.agentId, item, kind);
}

const GONE = "ไม่พบไฟล์นี้";
const VERDICTS: readonly string[] = ["ok", "no", "queue", "closed"];
type Done = { ok: true } | { ok: false; error: string };

/** คลังแอนิเมชัน: the owner's call on a waiting upload; anyone else is told there is no such file */
export async function decideLibraryUpload(id: string, verdict: string, reason?: string): Promise<Done> {
  const viewer = await requireMember();
  if (viewer.kind === "demo" || !can(viewer, "owner")) return { ok: false, error: GONE };
  if (typeof id !== "string" || !VERDICTS.includes(verdict)) return { ok: false, error: GONE };
  return decideUpload(viewer.agentId, id, verdict as Verdict, typeof reason === "string" ? reason : undefined);
}

/** คลังแอนิเมชัน: the owner takes an approved upload back out of the library, with a reason; anyone else is told there is no such file */
export async function withdrawLibraryUpload(id: string, reason: string): Promise<Withdrawn> {
  const viewer = await requireMember();
  if (viewer.kind === "demo" || !can(viewer, "owner")) return { ok: false, error: GONE };
  if (typeof id !== "string" || typeof reason !== "string") return { ok: false, error: GONE };
  return withdrawUpload(viewer.agentId, id, reason);
}

/** คลังแอนิเมชัน: a member takes one of their own uploads away */
export async function removeLibraryUpload(id: string): Promise<Done> {
  const viewer = await requireMember();
  if (typeof id !== "string") return { ok: false, error: GONE };
  return deleteUpload(viewer.agentId, id);
}
