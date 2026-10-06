"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { clearPendingAdsManage, readPendingAdsManage, saveAdManageAccount } from "@/lib/facebook/ads-manage-connection";
import { listAdAccounts } from "@/lib/facebook/oauth";

const SOMETHING_BROKE = "ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ";

/**
 * Keeps the ad accounts picked from a finished Facebook login, any number at once (owner,
 * 2026-10-04), each with the login's token. The waiting login is cleared only when every pick
 * was kept: an account that could not be saved is named and can be picked again from the same
 * list, without another Facebook login.
 */
export async function chooseAdManageAccounts(actIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("owner");
  const ids = [...new Set(actIds)];
  if (ids.length === 0) return { ok: false, error: "ยังไม่ได้เลือกบัญชีโฆษณา" };
  try {
    const pending = await readPendingAdsManage();
    if (!pending) return { ok: false, error: "การเชื่อมต่อหมดอายุแล้ว กดเชื่อมบัญชีโฆษณาใหม่อีกครั้ง" };
    const available = await listAdAccounts(pending.token);
    const failed: string[] = [];
    for (const id of ids) {
      const a = available.find((x) => x.id === id);
      if (!a) { failed.push(`${id} (ไม่พบในบัญชีที่เพิ่งเข้าสู่ระบบ)`); continue; }
      try {
        await saveAdManageAccount({ id: a.id, name: a.name, currency: a.currency, token: pending.token, scopes: pending.scopes });
        await audit("connect-ads-manage", a.id, { name: a.name });
      } catch (e) {
        console.error("chooseAdManageAccounts: saving", a.id, "failed:", e);
        failed.push(a.name);
      }
    }
    revalidatePath("/studio/ads", "layout");
    if (failed.length > 0) return { ok: false, error: `เชื่อมไม่สำเร็จ: ${failed.join(", ")} — ลองเลือกใหม่อีกครั้ง` };
    await clearPendingAdsManage();
    return { ok: true };
  } catch (e) {
    console.error("chooseAdManageAccounts failed:", e);
    return { ok: false, error: SOMETHING_BROKE };
  }
}
