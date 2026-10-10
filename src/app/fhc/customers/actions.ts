"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/auth/access";
import { agentsByCode, requireMember } from "@/lib/auth/viewer";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { deleteCustomer, cleanDetails, moveCustomer, saveCustomer } from "@/lib/fhc/customers";
import { cleanFhc, events, figures, scores, toPlanInput } from "@/lib/fhc/health";
import { FIXED_PICK, isOrder } from "@/lib/plan/order";
import { realPricer } from "@/lib/plan/pricer";
import { recommend } from "@/lib/plan/recommend";

/**
 * Saving a check into the signed-in agent's own list. The server rebuilds the result from the
 * form, as /fhc's own calls do, and keeps that: only the plan's order and the customer's
 * details come from the browser, and both are checked. A save without the customer's consent
 * is refused here, whatever the form said.
 */

const allowSave = limiter(30, 60_000);

export type SaveReply = { ok: true; id: string } | { ok: false; error: string };

export async function saveFhcCustomer(raw: unknown, order: unknown, details: unknown): Promise<SaveReply> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer) return { ok: false, error: "เข้าสู่ระบบก่อนจึงจะเก็บรายชื่อได้" };
  const d = cleanDetails(details);
  if (typeof d === "string") return { ok: false, error: d };
  const f = cleanFhc(raw);
  if (typeof f === "string") return { ok: false, error: f };
  if (!allowSave(`${viewer.agentId}|${clientIp(await headers())}`)) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  const p = toPlanInput(f);
  const plan = recommend(p, realPricer(p.age, p.sex), isOrder(order) ? { ...FIXED_PICK, order } : FIXED_PICK);
  const sc = scores(f);
  try {
    const id = await saveCustomer(viewer, d, f, { figures: figures(f), scores: sc, events: events(f, sc, plan), plan });
    revalidatePath("/fhc/customers");
    return { ok: true, id };
  } catch (e) {
    console.error("fhc customer not saved:", e);
    return { ok: false, error: "เก็บรายชื่อไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function removeFhcCustomer(id: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer) return { ok: false, error: "เข้าสู่ระบบก่อน" };
  try {
    const gone = await deleteCustomer(viewer, id, can(viewer, "owner"));
    revalidatePath("/fhc/customers");
    return gone ? { ok: true } : { ok: false, error: "ไม่พบรายชื่อนี้" };
  } catch (e) {
    console.error("fhc customer not removed:", e);
    return { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** Owner only: hands a customer to the agent holding this 6-digit code. */
export async function moveFhcCustomer(id: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer || !can(viewer, "owner")) return { ok: false, error: "เฉพาะเจ้าของระบบเท่านั้น" };
  const found = await agentsByCode(String(code).trim()).catch(() => []);
  if (found.length !== 1) return { ok: false, error: found.length ? "รหัสนี้ซ้ำกันหลายห้อง ย้ายไม่ได้" : "ไม่พบตัวแทนรหัสนี้" };
  try {
    const moved = await moveCustomer(id, found[0].id);
    revalidatePath("/fhc/customers");
    return moved ? { ok: true } : { ok: false, error: "ไม่พบรายชื่อนี้" };
  } catch (e) {
    console.error("fhc customer not moved:", e);
    return { ok: false, error: "ย้ายไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
