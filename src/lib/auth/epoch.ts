import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Signing out everywhere (review, 2026-10-01).
 *
 * A session cookie is good for seven days wherever it is: deleting it from this browser did
 * nothing about a copy taken from another. Signing out now also stamps the agent's row in
 * ins_session_epochs (supabase/migrations/20261001_session_epochs.sql), and every session of
 * theirs issued before the stamp is refused — the same rule as UnitOS's key_epoch for a room
 * and a member's revoked_at, for one person at a time.
 *
 * `agent_id` is a UnitOS agent's id or a member's (ins_members), so the table has no foreign key.
 */

/**
 * When the agent last signed out everywhere, ms, or null.
 *
 * Read on every request (in getViewer's one round with the agent's rows), so it never throws:
 * a read that fails is logged and treated as no stamp. Failing closed would sign every agent
 * out whenever the table hiccups, for a check whose cookie is still HMAC-valid and whose room
 * and member rows were still read; failing open only lets an already-revoked cookie through
 * while the read is down. An outage is the larger harm here.
 */
export async function sessionNotBefore(agentId: string): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin().from("ins_session_epochs")
      .select("not_before").eq("agent_id", agentId).maybeSingle();
    if (error) {
      console.error("session epoch unreadable, letting the cookie stand:", error.message);
      return null;
    }
    const at = (data as { not_before?: string } | null)?.not_before;
    return at ? Date.parse(at) : null;
  } catch (e) {
    console.error("session epoch unreadable, letting the cookie stand:", e);
    return null;
  }
}

/**
 * Every session of this agent issued before `at` ends. `at` is the app's clock, the one
 * sessions are stamped with (see setPin in ./member-store.ts for why not the database's).
 */
export async function endEverySession(agentId: string, at: Date): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_session_epochs").upsert(
    { agent_id: agentId, not_before: at.toISOString(), updated_at: at.toISOString() },
    { onConflict: "agent_id" },
  );
  if (error) throw new Error(`ออกจากระบบทุกเครื่องไม่สำเร็จ: ${error.message}`);
}
