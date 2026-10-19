"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { bucketPrefix, cancelBroadcast, createBroadcast, readBroadcastInput, sendBroadcast } from "@/lib/line/broadcasts";
import { rebuildMenus } from "@/lib/line/rebuild";
import { setLineBotEnabled } from "@/lib/line/settings";
import { sendTestAlert, setNotifyAiDown, setNotifyClipFailed, setNotifyNewMember, startLink, unlink } from "@/lib/line/owner-alert";

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

/* ── the owner's own LINE, for alerts (owner chose ก, 2026-10-15) ──────────────────────── */

export async function startLinkAction(): Promise<Result & { code?: string; until?: string }> {
  await requireStaff("backoffice");
  try {
    const { code, until } = await startLink();
    await audit("line-owner-link-start", null);
    return { ok: true, code, until };
  } catch (e) {
    console.error("[line] link code not made:", e);
    return { ok: false, error: "สร้างรหัสไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

export async function unlinkAction(): Promise<Result> {
  await requireStaff("backoffice");
  try {
    await unlink();
  } catch (e) {
    console.error("[line] owner not unlinked:", e);
    return { ok: false, error: "ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("line-owner-unlink", null);
  revalidatePath("/admin/line");
  return { ok: true };
}

export async function notifyNewMemberAction(on: boolean): Promise<Result> {
  await requireStaff("backoffice");
  try {
    await setNotifyNewMember(on === true);
  } catch (e) {
    console.error("[line] alert switch not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("line-notify-new-member", null, { on });
  revalidatePath("/admin/line");
  return { ok: true };
}

export async function notifyAiDownAction(on: boolean): Promise<Result> {
  await requireStaff("backoffice");
  try {
    await setNotifyAiDown(on === true);
  } catch (e) {
    console.error("[line] AI-down switch not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("line-notify-ai-down", null, { on });
  revalidatePath("/admin/line");
  return { ok: true };
}

export async function notifyClipFailedAction(on: boolean): Promise<Result> {
  await requireStaff("backoffice");
  try {
    await setNotifyClipFailed(on === true);
  } catch (e) {
    console.error("[line] clip-failed switch not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("line-notify-clip-failed", null, { on });
  revalidatePath("/admin/line");
  return { ok: true };
}

export async function testAlertAction(): Promise<Result> {
  await requireStaff("backoffice");
  try {
    return (await sendTestAlert()) ? { ok: true, note: "ส่งแล้ว ดูใน LINE ของคุณ" } : { ok: false, error: "ยังไม่ได้ผูก LINE" };
  } catch (e) {
    console.error("[line] test alert not sent:", e);
    return { ok: false, error: `ส่งไม่สำเร็จ: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` };
  }
}
