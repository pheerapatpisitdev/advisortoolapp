"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { cleanInput, type UpdateStatus } from "@/lib/updates/rules";
import { createUpdate, saveUpdate } from "@/lib/updates/store";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type UpdateResult = { ok: true; id: string } | { ok: false; error: string };

const STATUSES: UpdateStatus[] = ["draft", "live", "skip"];

/**
 * One row of มีอะไรใหม่ written and set: เผยแพร่ (live), เก็บเป็นร่าง (draft) or ไม่ต้องแจ้ง (skip). A new row when
 * id is null. The Super Admin's alone (owner chose 2ก, 2026-11-14).
 */
export async function saveUpdateRow(id: string | null, raw: Record<string, unknown>, status: string): Promise<UpdateResult> {
  await requireStaff("backoffice");
  if (!STATUSES.includes(status as UpdateStatus)) return { ok: false, error: "ไม่รู้จักสถานะนี้" };
  const input = cleanInput(raw);
  if (!input.ok) return input;
  try {
    const saved = id ? (await saveUpdate(id, input.value, status as UpdateStatus), id) : await createUpdate(input.value, status as UpdateStatus);
    await audit(`update-${status}`, saved, { title: input.value.title });
    // the menu's number on every page, /home's bar and /whats-new read it again
    revalidatePath("/", "layout");
    return { ok: true, id: saved };
  } catch (e) {
    console.error("whats-new row not saved:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
