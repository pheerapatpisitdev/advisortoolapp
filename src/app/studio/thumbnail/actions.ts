"use server";
import { requireMember } from "@/lib/auth/viewer";
import { listThumbnails, type Thumbnail } from "@/lib/content/thumbnail-history";

/** ดูเพิ่ม: the next page of the asker's own covers, after the oldest one shown; null when it cannot be read (owner, 2026-10-18) */
export async function moreThumbnailsAction(before: string): Promise<Thumbnail[] | null> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer || typeof before !== "string") return null;
  return listThumbnails(viewer.agentId, { before }).catch((e) => {
    console.error("thumbnail history page not read:", e);
    return null;
  });
}
