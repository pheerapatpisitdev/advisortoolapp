import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Whether agents may edit clips (owner switch, off by default). The render service is our Cloud
 * Run job alone since 2026-11-11 (owner removed Rendi and AWS Lambda), so the old columns
 * video_engine, video_fallback and rendi_max_seconds are no longer read or written.
 */
export interface VideoSettings { enabled: boolean }

export async function videoSettings(): Promise<VideoSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("video_edit_enabled").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าตัดต่อไม่ได้: ${error.message}`);
  return { enabled: data?.video_edit_enabled === true };
}

export async function saveVideoSettings(s: VideoSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, video_edit_enabled: s.enabled === true, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าตัดต่อไม่ได้: ${error.message}`);
}
