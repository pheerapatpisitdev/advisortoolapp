"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { cleanPhones } from "@/lib/hospitals/phones";
import { nameOnList } from "@/lib/hospitals/places";
import { clearOwnerPhones, saveOwnerPhones } from "@/lib/hospitals/store";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type HospitalResult = { ok: true } | { ok: false; error: string };

const UNKNOWN: HospitalResult = { ok: false, error: "ไม่พบโรงพยาบาลนี้ในรายชื่อ" };

async function write(id: string, work: () => Promise<void>): Promise<HospitalResult> {
  try {
    await work();
  } catch (e) {
    console.error("hospital phones not saved:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidatePath("/admin/hospitals");
  revalidatePath("/hospitals");
  return { ok: true };
}

/** One hospital's department numbers, typed by the Super Admin (owner chose 5ก, 2026-11-25). */
export async function saveHospitalPhones(id: string, raw: Record<string, unknown>): Promise<HospitalResult> {
  await requireStaff("backoffice");
  const name = nameOnList(id);
  if (!name) return UNKNOWN;
  const phones = cleanPhones(raw);
  if (!phones.ok) return phones;
  return write(id, async () => {
    await saveOwnerPhones(id, phones.value);
    await audit("hospital-phones-save", id, { name, ...phones.value });
  });
}

/** คืนค่าเดิม: the numbers read off the hospital's website, or none, in place of what was typed. */
export async function resetHospitalPhones(id: string): Promise<HospitalResult> {
  await requireStaff("backoffice");
  const name = nameOnList(id);
  if (!name) return UNKNOWN;
  return write(id, async () => {
    await clearOwnerPhones(id);
    await audit("hospital-phones-reset", id, { name });
  });
}
