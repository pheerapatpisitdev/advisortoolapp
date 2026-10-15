import { clientIp } from "@/lib/assistant/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * One sign-in, written down for the Super Admin's ประวัติผู้ใช้ (owner, 2026-10-15: "ข้อ 1
 * เริ่มเก็บประวัติเข้าระบบได้"). Nothing recorded who came in before this; it starts the day it ships.
 *
 * Never throws and never holds the sign-in up for long: a sign-in that could not be written
 * down still lets the person in, it is only missing from their history.
 */
export type LoginHow = "sso" | "code" | "google" | "super";

export async function noteLogin(agentId: string, how: LoginHow, h: { get(name: string): string | null }): Promise<void> {
  try {
    const ip = clientIp(h);
    const { error } = await supabaseAdmin().from("ins_logins").insert({
      agent_id: agentId, how,
      ip: ip === "unknown" ? null : ip,
      user_agent: (h.get("user-agent") ?? "").slice(0, 400) || null,
    });
    if (error) console.error(`login of ${agentId} not noted:`, error.message);
  } catch (e) {
    console.error(`login of ${agentId} not noted:`, e);
  }
}
