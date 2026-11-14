"use server";
import { requireMember } from "@/lib/auth/viewer";
import { LIBRARY_CLOSED, mayLibrary } from "@/lib/scene-library/access";
import { isMarkKind, NOT_IN_LIBRARY, toggleMark, type Toggled } from "@/lib/scene-library/marks";
import {
  decideUpload, deleteUpload, hideUpload, showUpload, withdrawUpload, type Verdict, type Withdrawn,
} from "@/lib/scene-library/uploads";

/**
 * คลังแอนิเมชัน's actions: the owner's alone (spec 2026-11-14-library-owner-only-design.md), whatever the page
 * shows; anyone else is told LIBRARY_CLOSED and nothing is read or written.
 */

const GONE = "ไม่พบไฟล์นี้";
const VERDICTS: readonly string[] = ["ok", "no", "queue", "closed"];
type Done = { ok: true } | { ok: false; error: string };
const CLOSED = { ok: false, error: LIBRARY_CLOSED } as const;

/** คลังแอนิเมชัน: the owner's ★ บันทึก on one piece, turned on or off */
export async function toggleLibraryMark(item: string, kind: string): Promise<Toggled> {
  const viewer = await requireMember();
  if (!mayLibrary(viewer)) return CLOSED;
  if (typeof item !== "string" || !isMarkKind(kind)) return { ok: false, error: NOT_IN_LIBRARY };
  return toggleMark(viewer.agentId, item, kind);
}

/** คลังแอนิเมชัน: a call on a waiting upload (the members' queue, which no page shows any more) */
export async function decideLibraryUpload(id: string, verdict: string, reason?: string): Promise<Done> {
  const viewer = await requireMember();
  if (!mayLibrary(viewer)) return CLOSED;
  if (typeof id !== "string" || !VERDICTS.includes(verdict)) return { ok: false, error: GONE };
  return decideUpload(viewer.agentId, id, verdict as Verdict, typeof reason === "string" ? reason : undefined);
}

/** คลังแอนิเมชัน: a member's approved upload taken back out with a reason (no page shows it any more) */
export async function withdrawLibraryUpload(id: string, reason: string): Promise<Withdrawn> {
  const viewer = await requireMember();
  if (!mayLibrary(viewer)) return CLOSED;
  if (typeof id !== "string" || typeof reason !== "string") return { ok: false, error: GONE };
  return withdrawUpload(viewer.agentId, id, reason);
}

/** คลังแอนิเมชัน: the owner deletes one of their own files, row and pictures */
export async function removeLibraryUpload(id: string): Promise<Done> {
  const viewer = await requireMember();
  if (!mayLibrary(viewer)) return CLOSED;
  if (typeof id !== "string") return { ok: false, error: GONE };
  return deleteUpload(viewer.agentId, id);
}

/** คลังแอนิเมชัน: ถอนออกจากคลัง, no reason asked */
export async function hideLibraryUpload(id: string): Promise<Done> {
  const viewer = await requireMember();
  if (!mayLibrary(viewer)) return CLOSED;
  if (typeof id !== "string") return { ok: false, error: GONE };
  return hideUpload(viewer.agentId, id);
}

/** คลังแอนิเมชัน: นำกลับเข้าคลัง */
export async function showLibraryUpload(id: string): Promise<Done> {
  const viewer = await requireMember();
  if (!mayLibrary(viewer)) return CLOSED;
  if (typeof id !== "string") return { ok: false, error: GONE };
  return showUpload(viewer.agentId, id);
}
