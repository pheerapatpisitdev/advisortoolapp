import { supabaseAdmin } from "@/lib/supabase/admin";
import { readRemotionFor, REMOTION_PLANS, type RemotionFor, type RemotionPlan } from "./remotion";

export { readRemotionFor, REMOTION_FOR, REMOTION_FOR_LABEL, REMOTION_PLANS, REMOTION_PLAN_LABEL, type RemotionFor, type RemotionPlan } from "./remotion";

/**
 * Who gets Remotion's Motion Graphic clips (owner, 2026-10-17, mockup https://claude.ai/artifact/1ccgwYoiQsJoDtuA5irZVd:
 * a three-way switch on /admin/ai, "Remotion ทุกคน" from the day it goes live), one row a plan
 * (owner chose 2ก, mockup https://claude.ai/artifact/Bz9r68ApXPeuzosx1yC69a): reading and saving it.
 * Life Protect's row is the column it always had, `remotion_for`; the plans after it are in
 * `remotion_plans`, one value a plan (migration 20261117). Its values are in remotion.ts, which the
 * page and the Remotion bundle import, so neither reaches the database.
 */

type SettingsRow = { remotion_for?: unknown; remotion_plans?: unknown };

/** each plan as the row has it; a missing column or plan is the old engine */
function plansOf(row: SettingsRow | null | undefined): Record<RemotionPlan, RemotionFor> {
  const later = row?.remotion_plans && typeof row.remotion_plans === "object" ? row.remotion_plans as Record<string, unknown> : {};
  return Object.fromEntries(REMOTION_PLANS.map((p) => [p, readRemotionFor(p === "LIFEPROTECT" ? row?.remotion_for : later[p])])) as Record<RemotionPlan, RemotionFor>;
}

/**
 * Every plan's row as set; the old engine for all when it cannot be read (the database down). The
 * whole row is read, so a column not there yet turns off only the plans it holds.
 */
export async function remotionPlans(): Promise<Record<RemotionPlan, RemotionFor>> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("*").maybeSingle();
  if (error) {
    console.error("remotion switch unread, old engine:", error.message);
    return plansOf(null);
  }
  return plansOf(data as SettingsRow | null);
}

/** one plan's row as set; the old engine when it cannot be read */
export async function remotionFor(plan: RemotionPlan): Promise<RemotionFor> {
  return (await remotionPlans())[plan];
}

export async function saveRemotionFor(plan: RemotionPlan, v: RemotionFor): Promise<void> {
  const db = supabaseAdmin().from("ins_ai_settings");
  let patch: Record<string, unknown>;
  if (plan === "LIFEPROTECT") patch = { remotion_for: v };
  else {
    // the other plans' values are kept as they are
    const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("remotion_plans").maybeSingle();
    if (error) throw new Error(`บันทึกสวิตช์ Remotion ไม่ได้: ${error.message}`);
    const now = (data?.remotion_plans && typeof data.remotion_plans === "object" ? data.remotion_plans : {}) as Record<string, unknown>;
    patch = { remotion_plans: { ...now, [plan]: v } };
  }
  const { error } = await db.upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`บันทึกสวิตช์ Remotion ไม่ได้: ${error.message}`);
}
