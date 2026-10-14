"use server";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { INTRO_PICTURE, MAX_INTRO_PICTURES } from "@/lib/assistant/intro";
import { isWelcomePicture } from "@/lib/assistant/page-welcome";
import { bucketPrefix } from "@/lib/chat/page-welcome-store";
import { EVERY_PAGE, introRows, resetIntroPictures, saveIntroPictures, type IntroRow } from "@/lib/chat/intro-store";
import { pageConnections } from "@/lib/facebook/connection";
import { isExpatPage } from "@/lib/assistant/expat";

/**
 * รูปที่บอทส่ง (/admin/teach, owner 2026-10-11): the pictures ahead of a first quotation, a set
 * for every Page and LINE and a Page's own. Pictures are uploaded through the welcome page's
 * route (/api/page-welcome-picture), so the same bucket and the same check hold.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** '*' or a connected Page the Thai bot answers; the Expat Pages send no such picture. */
async function scopeOf(scope: unknown): Promise<string | undefined> {
  if (scope === EVERY_PAGE) return EVERY_PAGE;
  if (typeof scope !== "string" || !scope || isExpatPage(scope)) return undefined;
  return (await pageConnections()).some((p) => p.pageId === scope) ? scope : undefined;
}

export async function listIntro(): Promise<Result<{ rows: IntroRow[]; builtIn: string }>> {
  await requireStaff("backoffice");
  try {
    return { ok: true, rows: await introRows({ fresh: true }), builtIn: INTRO_PICTURE };
  } catch (e) {
    console.error("intro pictures unreadable:", e);
    return { ok: false, error: "อ่านรูปไม่สำเร็จ ลองรีเฟรชหน้านี้" };
  }
}

export async function saveIntro(scope: string, pictures: unknown): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  const at = await scopeOf(scope).catch(() => undefined);
  if (!at) return { ok: false, error: "ไม่พบเพจนี้" };
  const list = Array.isArray(pictures) ? pictures : [];
  if (list.length > MAX_INTRO_PICTURES) return { ok: false, error: `ใส่รูปได้ไม่เกิน ${MAX_INTRO_PICTURES} รูป` };
  const prefix = bucketPrefix();
  if (!list.every((p) => typeof p === "string" && (p === INTRO_PICTURE || isWelcomePicture(p, prefix)))) {
    return { ok: false, error: "มีรูปที่ไม่ได้อัปโหลดผ่านหน้านี้ ลบแล้วอัปโหลดใหม่" };
  }
  try {
    await saveIntroPictures(at, list as string[], viewer.agentId);
    await audit("intro-pictures", at, { pictures: list.length });
    return { ok: true };
  } catch (e) {
    console.error("intro pictures not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/** A Page back on the set for every Page; the set for every Page back on the built-in picture. */
export async function resetIntro(scope: string): Promise<Result> {
  await requireStaff("backoffice");
  const at = await scopeOf(scope).catch(() => undefined);
  if (!at) return { ok: false, error: "ไม่พบเพจนี้" };
  try {
    await resetIntroPictures(at);
    await audit("intro-pictures-reset", at);
    return { ok: true };
  } catch (e) {
    console.error("intro pictures not reset:", e);
    return { ok: false, error: "คืนค่าไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
