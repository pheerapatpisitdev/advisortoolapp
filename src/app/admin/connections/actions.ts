"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { runSigninCheck } from "@/lib/signin-health/run";

export type CheckResult = { ok: true; down: number } | { ok: false; error: string };

/** "ตรวจตอนนี้": the same round the scheduler runs, so a fix shows at once and its return reaches LINE. */
export async function checkNowAction(): Promise<CheckResult> {
  await requireStaff("backoffice");
  try {
    const r = await runSigninCheck();
    await audit("signin-check", null, { down: r.standing.filter((s) => !s.ok).map((s) => s.route) });
    revalidatePath("/admin/connections");
    return { ok: true, down: r.standing.filter((s) => !s.ok).length };
  } catch (e) {
    console.error("[signin-health] check from the page failed:", e);
    return { ok: false, error: "ตรวจไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
