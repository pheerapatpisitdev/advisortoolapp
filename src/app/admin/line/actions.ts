"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { bucketPrefix, cancelBroadcast, createBroadcast, readBroadcastInput, sendBroadcast } from "@/lib/line/broadcasts";
import { rebuildMenus } from "@/lib/line/rebuild";
import { setLineBotEnabled } from "@/lib/line/settings";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true; note?: string } | { ok: false; error: string };

export async function setBotAction(on: boolean): Promise<Result> {
  await requireStaff("backoffice");
  try {
    await setLineBotEnabled(on === true);
  } catch (e) {
    console.error("[line] bot switch not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("line-bot", null, { on });
  revalidatePath("/admin/line");
  return { ok: true };
}

/** Sends now, or keeps it for the five-minute sweep when a time is given. */
export async function broadcastAction(input: unknown): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  const read = readBroadcastInput(input, bucketPrefix());
  if (!read.ok) return read;
  let id: string;
  try {
    id = await createBroadcast(read.value, viewer.agentId);
  } catch (e) {
    console.error("[line] broadcast not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("line-broadcast", id, { parts: read.value.parts.length, at: read.value.sendAt?.toISOString() ?? "now" });
  revalidatePath("/admin/line");
  if (read.value.sendAt) return { ok: true, note: "ตั้งเวลาแล้ว" };

  const sent = await sendBroadcast(id).catch((e) => {
    console.error("[line] broadcast send failed:", e);
    return null;
  });
  revalidatePath("/admin/line");
  if (sent?.status === "sent") return { ok: true, note: sent.recipients != null ? `ส่งแล้ว ถึงเพื่อน ${sent.recipients} คน` : "ส่งแล้ว" };
  return { ok: false, error: sent?.error ? `ส่งไม่สำเร็จ: ${sent.error}` : "ส่งไม่สำเร็จ ดูในประวัติการส่ง" };
}

export async function cancelBroadcastAction(id: string): Promise<Result> {
  await requireStaff("backoffice");
  if (typeof id !== "string") return { ok: false, error: "ไม่พบรายการนี้" };
  const done = await cancelBroadcast(id).catch(() => false);
  if (!done) return { ok: false, error: "ยกเลิกไม่ได้ อาจส่งไปแล้ว" };
  await audit("line-broadcast-cancel", id);
  revalidatePath("/admin/line");
  return { ok: true };
}

export async function rebuildMenusAction(): Promise<Result> {
  await requireStaff("backoffice");
  try {
    const r = await rebuildMenus();
    await audit("line-menus", null, { deleted: r.deleted });
    revalidatePath("/admin/line");
    return { ok: true, note: "สร้างเมนูใหม่แล้ว" };
  } catch (e) {
    console.error("[line] menus not rebuilt:", e);
    return { ok: false, error: `สร้างเมนูไม่สำเร็จ: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` };
  }
}
