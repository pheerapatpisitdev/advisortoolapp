"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/assistant/rate-limit";
import { admit } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/next";
import { endSession, startSession } from "@/lib/auth/session";
import { agentsByCode, staffRow } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

/**
 * Signing in with the agent's own 6-digit code — the same code UnitOS takes.
 *
 * A code is not a secret the way a password is: colleagues may know it. What keeps guessing
 * from working is the count below (five wrong codes from one address and it waits fifteen
 * minutes), the same counter the back office's PIN had, in the same table.
 */
export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const ip = clientIp(await headers());
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("ins_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_FAILURES) {
    return { error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
  }
  if (!/^\d{6}$/.test(code)) return { error: "กรุณากรอกรหัสตัวแทน 6 หลัก" };

  const agents = await agentsByCode(code);
  if (agents.length > 1) {
    // UnitOS keeps codes apart only within a room; if two rooms ever hold the same one, the
    // code alone cannot say who this is, and guessing would sign somebody in as a stranger
    return { error: "รหัสนี้มีในมากกว่าหนึ่งห้อง กรุณาเข้าจากเมนูใน UnitOS" };
  }
  const agent = agents[0] ?? null;
  const viewer = agent ? admit(agent, await staffRow(agent.id), Date.now()) : null;
  await supabase.from("ins_login_attempts").insert({ ip, ok: Boolean(viewer) });

  if (!viewer) {
    const left = MAX_FAILURES - (count ?? 0) - 1;
    // one answer for an unknown code and a closed room, so the page does not say which codes exist
    const why = "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้";
    return { error: left > 0 ? `${why} เหลืออีก ${left} ครั้ง` : `${why} ถูกระงับชั่วคราว` };
  }

  await startSession(viewer.agentId);
  redirect(next);
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}
