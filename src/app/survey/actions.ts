"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/viewer";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { saveSurveyCustomer } from "@/lib/fhc/customers";
import { ageOn, bangkokToday, cleanSurvey } from "@/lib/survey/answers";

/**
 * Saving a สำรวจความคุ้มครอง customer into the signed-in agent's list, the one FHC customers are
 * in (owner, 2026-10-22). Every answer is checked again here; a save without the customer's
 * consent is refused whatever the form said.
 */

const allowSave = limiter(30, 60_000);

export type SurveyReply = { ok: true; id: string } | { ok: false; error: string };

export async function saveSurvey(raw: unknown, consent: unknown): Promise<SurveyReply> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer) return { ok: false, error: "เข้าสู่ระบบก่อนจึงจะเก็บรายชื่อได้" };
  if (consent !== true) return { ok: false, error: "ต้องได้รับความยินยอมจากลูกค้าก่อนเก็บชื่อ" };
  const today = bangkokToday();
  const a = cleanSurvey(raw, today);
  if (typeof a === "string") return { ok: false, error: a };
  if (!allowSave(`${viewer.agentId}|${clientIp(await headers())}`)) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  try {
    const id = await saveSurveyCustomer(viewer, a, ageOn(a.birth, today) ?? 0);
    revalidatePath("/fhc/customers");
    return { ok: true, id };
  } catch (e) {
    console.error("survey customer not saved:", e);
    return { ok: false, error: "เก็บรายชื่อไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
