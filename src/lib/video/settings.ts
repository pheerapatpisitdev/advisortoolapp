import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EngineName } from "@/lib/content/clip";

/** Which service renders clips, and whether the others are tried when it cannot (owner, 2026-10-02). */
export interface VideoSettings { engine: EngineName; fallback: boolean; rendiMaxSeconds: number;
  /** agents may edit clips (owner switch, off by default: no render service may be live yet) */
  enabled: boolean }

const clamp = (n: number) => Math.min(600, Math.max(10, Math.round(n)));

export async function videoSettings(): Promise<VideoSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("video_engine, video_fallback, rendi_max_seconds, video_edit_enabled").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าตัดต่อไม่ได้: ${error.message}`);
  const seconds = Number(data?.rendi_max_seconds);
  return {
    engine: data?.video_engine === "lambda" || data?.video_engine === "cloudrun" ? data.video_engine : "rendi",
    fallback: data?.video_fallback !== false,
    rendiMaxSeconds: Number.isFinite(seconds) ? clamp(seconds) : 60,
    enabled: data?.video_edit_enabled === true,
  };
}

export async function saveVideoSettings(s: VideoSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, video_engine: s.engine, video_fallback: s.fallback, rendi_max_seconds: clamp(s.rendiMaxSeconds), video_edit_enabled: s.enabled === true, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าตัดต่อไม่ได้: ${error.message}`);
}
