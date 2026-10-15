import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Whether the bot answers the LINE chat (owner, 2026-10-15). Off while a person answers in
 * LINE OA Manager: LINE never tells the webhook what a person types there, so a bot left on
 * would answer over them.
 *
 * Fails open: a switch that cannot be read is a customer answered, as before the switch.
 */
export async function lineBotEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("line_bot_enabled").maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { line_bot_enabled?: boolean } | null)?.line_bot_enabled !== false;
  } catch (e) {
    console.error("[line] bot switch not read, answering:", e);
    return true;
  }
}

export async function setLineBotEnabled(on: boolean): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, line_bot_enabled: on, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}
