"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { readWelcomeInput } from "@/lib/assistant/page-welcome";
import { bucketPrefix, resetWelcome, saveWelcome } from "@/lib/chat/page-welcome-store";
import { pageConnections } from "@/lib/facebook/connection";
import { isExpatPage } from "@/lib/assistant/expat";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

/** Only a Page that is connected and answered by the Thai bot has a greeting to set. */
async function isOurPage(pageId: unknown): Promise<boolean> {
  if (typeof pageId !== "string" || isExpatPage(pageId)) return false;
  return (await pageConnections()).some((p) => p.pageId === pageId);
}

export async function saveWelcomeAction(pageId: string, input: unknown): Promise<Result> {
  const viewer = await requireStaff("admin");
  if (!(await isOurPage(pageId))) return { ok: false, error: "ไม่พบเพจนี้" };
  const read = readWelcomeInput(input, bucketPrefix());
  if (!read.ok) return read;
  try {
    await saveWelcome(pageId, read.value, viewer.agentId);
  } catch (e) {
    console.error("page welcome not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("page-welcome", pageId, { mode: read.value.mode, product: read.value.product ?? null, pictures: read.value.pictures.length });
  revalidatePath("/admin/welcome");
  return { ok: true };
}

export async function resetWelcomeAction(pageId: string): Promise<Result> {
  await requireStaff("admin");
  if (!(await isOurPage(pageId))) return { ok: false, error: "ไม่พบเพจนี้" };
  try {
    await resetWelcome(pageId);
  } catch (e) {
    console.error("page welcome not reset:", e);
    return { ok: false, error: "คืนค่าเดิมไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("page-welcome-reset", pageId);
  revalidatePath("/admin/welcome");
  return { ok: true };
}
