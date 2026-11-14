import { DEMO_ID } from "@/lib/auth/demo";
import type { Viewer } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Arranged } from "./arrange";
import type { SharePlan } from "./plans";

/**
 * ins_agent_share_texts and ins_agent_share_arranges (supabase/migrations/20261217_share_texts.sql).
 *
 * A row holds the latest arrangement of a member's draft for a plan, and `live_template`: the
 * arrangement the member saved, which is what their calculator pages send. Arranging again does
 * not touch the live one until they save.
 */
const texts = () => supabaseAdmin().from("ins_agent_share_texts");
const arranges = () => supabaseAdmin().from("ins_agent_share_arranges");

/** How many times a day a member may ask the AI to arrange; it is free (owner, 2026-11-14). */
export const ARRANGES_PER_DAY = 20;

export interface ShareTextRow extends Arranged {
  plan: SharePlan;
  draft: string;
  /** the template the pages use; null while the member uses the standard text */
  live: string | null;
}

/** The day in Thailand, where the members are: the allowance turns over at their midnight. */
export const thaiDay = (now = new Date()): string => new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

export async function myShareTexts(agentId: string): Promise<ShareTextRow[]> {
  const { data, error } = await texts().select("plan, draft, template, removed, own, live_template").eq("agent_id", agentId);
  if (error) throw new Error(`share texts not read: ${error.message}`);
  return (data ?? []).map((r) => ({
    plan: r.plan as SharePlan, draft: r.draft ?? "", template: r.template ?? "",
    removed: Array.isArray(r.removed) ? r.removed : [], own: Array.isArray(r.own) ? r.own : [],
    live: r.live_template ?? null,
  }));
}

/**
 * The template a calculator page sends with, for the signed-in member; none for the printer
 * (no session), the shared trial account, or when it cannot be read — the standard text is
 * always right.
 */
export async function shareTemplateOnPage(viewer: Pick<Viewer, "agentId"> | null, plan: SharePlan): Promise<string | undefined> {
  if (!viewer || viewer.agentId === DEMO_ID) return undefined;
  try {
    const { data, error } = await texts().select("live_template").eq("agent_id", viewer.agentId).eq("plan", plan).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.live_template || undefined;
  } catch (e) {
    console.error("share template not read:", e);
    return undefined;
  }
}

export async function arrangesLeft(agentId: string, now = new Date()): Promise<number> {
  const { data, error } = await arranges().select("n").eq("agent_id", agentId).eq("day", thaiDay(now)).maybeSingle();
  if (error) throw new Error(`arranges not read: ${error.message}`);
  return Math.max(0, ARRANGES_PER_DAY - (data?.n ?? 0));
}

/** Counts one arrangement against today, before the AI is called: a failed call still cost one. */
export async function countArrange(agentId: string, now = new Date()): Promise<void> {
  const day = thaiDay(now);
  const { data } = await arranges().select("n").eq("agent_id", agentId).eq("day", day).maybeSingle();
  const { error } = await arranges().upsert({ agent_id: agentId, day, n: (data?.n ?? 0) + 1 }, { onConflict: "agent_id,day" });
  if (error) throw new Error(`arrange not counted: ${error.message}`);
}

export async function keepArranged(agentId: string, plan: SharePlan, draft: string, a: Arranged): Promise<void> {
  const { error } = await texts().upsert(
    { agent_id: agentId, plan, draft, template: a.template, removed: a.removed, own: a.own, updated_at: new Date().toISOString() },
    { onConflict: "agent_id,plan" },
  );
  if (error) throw new Error(`arrangement not kept: ${error.message}`);
}

/** Puts the latest arrangement to use, or (`on` false) goes back to the standard text. */
export async function setLive(agentId: string, plan: SharePlan, on: boolean): Promise<string | null> {
  const { data, error } = await texts().select("template").eq("agent_id", agentId).eq("plan", plan).maybeSingle();
  if (error) throw new Error(`share text not read: ${error.message}`);
  if (!data) {
    if (on) throw new Error("no arrangement to use");
    return null;
  }
  const live = on ? data.template : null;
  const { error: failed } = await texts().update({ live_template: live, updated_at: new Date().toISOString() }).eq("agent_id", agentId).eq("plan", plan);
  if (failed) throw new Error(`share text not saved: ${failed.message}`);
  return live;
}
