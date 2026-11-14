"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/viewer";
import { markRead, updatesFor } from "@/lib/updates/store";

/**
 * Everything the viewer is shown, marked read: on opening /whats-new, and the × on /home's bar (owner chose
 * 1ข, 2026-11-14). Only the rows this viewer may see are written, whatever the page sent. Never throws: a
 * read that is not kept leaves the number up, which is all that goes wrong.
 */
export async function markUpdatesRead(): Promise<{ ok: boolean }> {
  try {
    const viewer = await requireMember();
    const { unread } = await updatesFor(viewer);
    await markRead(viewer.agentId, unread.map((u) => u.id));
    // the red number is in every page's menu
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("whats-new: reads not kept:", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}
