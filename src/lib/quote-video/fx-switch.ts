import { can, type Viewer } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FX_KEY, fxModeOf, type FxMode } from "./fx-mode";

export { FX_MODE_LABEL, FX_MODES, isFxMode, type FxMode } from "./fx-mode";

/**
 * Who gets ลูกเล่นคลิปใหม่ (fx.ts) on the clips they make (owner chose ก, 2026-10-20: "เปิดให้ผมคนเดียวก่อน"): the owner
 * alone until it is opened to everyone from /admin/switches, or nobody. Kept in ins_ai_settings.feature_switches
 * beside the tools' own switches, under `clipFx`, so no column is added; a read that fails is the owner alone.
 */
export async function readFxMode(): Promise<FxMode> {
  try {
    const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("feature_switches").maybeSingle();
    if (error) throw new Error(error.message);
    return fxModeOf(data?.feature_switches);
  } catch (e) {
    console.error("clip fx switch unreadable, owner only:", e instanceof Error ? e.message : e);
    return "owner";
  }
}

/** whether a clip this viewer makes now gets the new look */
export async function fxFor(viewer: Viewer): Promise<boolean> {
  const mode = await readFxMode();
  return mode === "all" || (mode === "owner" && can(viewer, "owner"));
}

/** the switch saved, the tools' switches beside it left as they are */
export async function saveFxMode(mode: FxMode): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("ins_ai_settings").select("feature_switches").maybeSingle();
  if (error) throw new Error(`อ่านสถานะฟังก์ชันไม่ได้: ${error.message}`);
  const all = (data?.feature_switches && typeof data.feature_switches === "object" ? data.feature_switches : {}) as Record<string, unknown>;
  const { error: saved } = await db.from("ins_ai_settings").upsert(
    { id: true, feature_switches: { ...all, [FX_KEY]: { for: mode, at: new Date().toISOString() } }, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (saved) throw new Error(`บันทึกไม่ได้: ${saved.message}`);
}
