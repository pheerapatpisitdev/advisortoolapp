import { supabaseAdmin } from "@/lib/supabase/admin";
import { readRemotionFor, type RemotionFor } from "./remotion";

export { readRemotionFor, REMOTION_FOR, REMOTION_FOR_LABEL, type RemotionFor } from "./remotion";

/**
 * Who gets Remotion's Motion Graphic clips (owner, 2026-10-17, mockup https://claude.ai/artifact/1ccgwYoiQsJoDtuA5irZVd:
 * a three-way switch on /admin/ai, "Remotion ทุกคน" from the day it goes live): reading and saving
 * it. Its values are in remotion.ts, which the page and the Remotion bundle import, so neither reaches the database.
 */

/** the switch as set; the old engine when it cannot be read (a missing column, the database down) */
export async function remotionFor(): Promise<RemotionFor> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("remotion_for").maybeSingle();
  if (error) {
    console.error("remotion switch unread, old engine:", error.message);
    return "off";
  }
  return readRemotionFor(data?.remotion_for);
}

export async function saveRemotionFor(v: RemotionFor): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert({ id: true, remotion_for: v, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`บันทึกสวิตช์ Remotion ไม่ได้: ${error.message}`);
}
