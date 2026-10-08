"use server";
import { requireMember } from "@/lib/auth/viewer";
import { clearReadings, deleteReading } from "@/lib/content/describe-history";

/**
 * Taking things out of one's own history. The agent is always the signed-in member's — an id
 * in the request only says which of their readings — so another member's id removes nothing;
 * an id that is not a UUID is not even sent to the store.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteReadingAction(id: string): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false };
  try {
    const viewer = await requireMember();
    await deleteReading(viewer.agentId, id);
    return { ok: true };
  } catch (e) {
    console.error("history reading not deleted:", e);
    return { ok: false };
  }
}

export async function clearReadingsAction(): Promise<{ ok: boolean }> {
  try {
    const viewer = await requireMember();
    await clearReadings(viewer.agentId);
    return { ok: true };
  } catch (e) {
    console.error("history not cleared:", e);
    return { ok: false };
  }
}
