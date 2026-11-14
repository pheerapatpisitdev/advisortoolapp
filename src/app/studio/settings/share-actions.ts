"use server";
import { asWho } from "@/lib/ai/who";
import { isDemo } from "@/lib/auth/demo";
import { requireMember } from "@/lib/auth/viewer";
import { arrangeShareText, type Arranged } from "@/lib/share-text/arrange";
import { isSharePlan } from "@/lib/share-text/plans";
import { samplePreview } from "@/lib/share-text/samples";
import { arrangesLeft, countArrange, keepArranged, setLive } from "@/lib/share-text/store";
import { DRAFT_MAX } from "@/lib/share-text/template";

/**
 * ข้อความส่งให้ลูกค้า (owner, 2026-11-14, ง on mockup https://claude.ai/artifact/6v1b98UZnP7jpCa6AL6opV).
 * The template a page sends is only ever one the AI arranged here: the browser sends a draft and
 * a yes or no, never a template, so what the AI took out cannot be typed back in.
 */
export type ArrangeResult =
  | { ok: true; arranged: Arranged; preview: string; left: number }
  | { ok: false; error: string; left?: number };

const DEMO = "บัญชีทดลองตั้งค่านี้ไม่ได้";

export async function arrangeMyShareText(plan: string, draft: string): Promise<ArrangeResult> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: DEMO };
  const text = typeof draft === "string" ? draft.trim() : "";
  if (!isSharePlan(plan)) return { ok: false, error: "ไม่พบแบบประกันนี้" };
  if (text.length < 20) return { ok: false, error: "ร่างสั้นเกินไป พิมพ์ข้อความที่อยากส่งให้ลูกค้าอีกหน่อยครับ" };
  if (text.length > DRAFT_MAX) return { ok: false, error: `ร่างยาวเกิน ${DRAFT_MAX.toLocaleString("en-US")} ตัวอักษร` };
  let left: number;
  try {
    left = await arrangesLeft(viewer.agentId);
    if (left <= 0) return { ok: false, error: "วันนี้ใช้ AI จัดเรียงครบจำนวนแล้ว พรุ่งนี้ใช้ได้อีกครับ", left: 0 };
    await countArrange(viewer.agentId);
    left -= 1;
  } catch (e) {
    console.error("share text allowance:", e);
    return { ok: false, error: "ตอนนี้ใช้งานไม่ได้ ลองใหม่อีกครั้ง" };
  }
  try {
    const arranged = await asWho(viewer.agentId, () => arrangeShareText(plan, text));
    await keepArranged(viewer.agentId, plan, text, arranged);
    return { ok: true, arranged, preview: samplePreview(plan, arranged.template), left };
  } catch (e) {
    console.error("share text not arranged:", e);
    return { ok: false, error: "AI จัดเรียงไม่สำเร็จ ลองกดอีกครั้ง หรือปรับร่างให้ชัดขึ้นครับ", left };
  }
}

export type UseResult = { ok: true; live: string | null } | { ok: false; error: string };

/** Puts the latest arrangement to use on this member's pages, or goes back to the standard text. */
export async function putMyShareTextToUse(plan: string, on: boolean): Promise<UseResult> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: DEMO };
  if (!isSharePlan(plan)) return { ok: false, error: "ไม่พบแบบประกันนี้" };
  try {
    return { ok: true, live: await setLive(viewer.agentId, plan, on === true) };
  } catch (e) {
    console.error("share text not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
