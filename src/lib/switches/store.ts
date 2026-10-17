import { cache } from "react";
import { can, type Viewer } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanMessage, cleanSwitches, type FeatureKey, type Switches } from "./features";

/**
 * Every tool's switch (features.ts), read once a request. A read that fails is every tool on:
 * the switches are for an outage of something else, and a failing settings read should not
 * close the whole of Studio as well.
 */
export const readSwitches = cache(async (): Promise<Switches> => {
  try {
    const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("feature_switches").maybeSingle();
    if (error) throw new Error(error.message);
    return cleanSwitches(data?.feature_switches);
  } catch (e) {
    console.error("feature switches unreadable, every tool on:", e instanceof Error ? e.message : e);
    return cleanSwitches(null);
  }
});

/** the words a viewer is refused with while the tool is off; null while it is on, and for the owner and the Super Admin, who try it before it is back on */
export async function closedFor(viewer: Viewer | null, key: FeatureKey): Promise<string | null> {
  if (can(viewer, "owner")) return null;
  const s = (await readSwitches())[key];
  return s.off ? s.message : null;
}

/** closedFor, for a route or an action that has not read its viewer yet */
export async function closedNow(key: FeatureKey): Promise<string | null> {
  let viewer: Viewer | null = null;
  try {
    viewer = await getViewer();
  } catch {
    // nobody known: refused as anybody else would be while it is off
  }
  return closedFor(viewer, key);
}

/** What a tool's page says at its top while it is off: to everyone else, why; to the owner, that it is off for the others. */
export async function closedNotice(viewer: Viewer | null, key: FeatureKey): Promise<{ message: string; forOthers: boolean } | null> {
  const s = (await readSwitches())[key];
  return s.off ? { message: s.message, forOthers: can(viewer, "owner") } : null;
}

/** One tool switched, with its words; the others are left as they are. */
export async function saveSwitch(key: FeatureKey, off: boolean, message: unknown): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("ins_ai_settings").select("feature_switches").maybeSingle();
  if (error) throw new Error(`อ่านสถานะฟังก์ชันไม่ได้: ${error.message}`);
  const all = (data?.feature_switches && typeof data.feature_switches === "object" ? data.feature_switches : {}) as Record<string, unknown>;
  const was = cleanSwitches(all)[key];
  const next = { off, message: cleanMessage(message), at: was.off === off ? was.at : new Date().toISOString() };
  const { error: saved } = await db.from("ins_ai_settings").upsert(
    { id: true, feature_switches: { ...all, [key]: next }, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (saved) throw new Error(`บันทึกไม่ได้: ${saved.message}`);
}
