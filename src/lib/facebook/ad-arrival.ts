import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Referral } from "./events";

/**
 * An advert tapped by someone already in a thread, held for their next message.
 *
 * Meta sends that tap as a referral event of its own, with no words, and the message typed
 * after it carries no referral; the bot answers only words, so the advert was dropped — the
 * customer got the generic menu instead of the plan they tapped, and the conversation was not
 * counted against the advert (review, 2026-10-11). Kept an hour: a tap from yesterday says
 * nothing about today's message. Never throws: an advert unremembered is the old behaviour.
 */
const KEEP_MS = 60 * 60_000;

export async function rememberAdArrival(userHash: string, referral: Referral, pageId?: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ins_ad_arrivals").upsert({
      channel: "facebook", user_hash: userHash, page_id: pageId ?? null, referral, at: new Date().toISOString(),
    });
    if (error) console.error("ad arrival not kept:", error.message);
  } catch (e) {
    console.error("ad arrival not kept:", e);
  }
}

/** The advert this customer tapped in the last hour, taken so that it steers one message only. */
export async function takeAdArrival(userHash: string, now: Date = new Date()): Promise<Referral | undefined> {
  try {
    const { data, error } = await supabaseAdmin().from("ins_ad_arrivals").delete()
      .eq("channel", "facebook").eq("user_hash", userHash).select("referral, at");
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as { referral: Referral; at: string } | undefined;
    if (!row || now.getTime() - new Date(row.at).getTime() > KEEP_MS) return undefined;
    return row.referral;
  } catch (e) {
    console.error("ad arrival not read:", e);
    return undefined;
  }
}
