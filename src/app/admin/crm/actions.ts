"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rangeStart, summarise } from "@/lib/crm/summary";
import {
  READ_FAILED, adNames, aiSpendSince, conversationsSince, markAnswered, openQuestions,
  type OpenQuestions,
} from "@/lib/crm/load";
import { chatLink, profileFor } from "@/lib/crm/names";
import type { LeadRow, Range, Summary } from "@/lib/crm/types";
import { requireStaff } from "@/lib/auth/viewer";

/** Everything `/admin/crm` shows, read once. */

/** How many leads a list shows at once; enough to work through, few enough to fetch names for. */
const LEAD_LIMIT = 50;
const UNANSWERED_LIMIT = 50;

export interface LeadView extends LeadRow {
  /** borrowed from Meta for this render; absent when Meta would not say or the id is gone */
  name?: string;
  picture?: string;
  /** what the advertisement that brought them is called, where the ads pull knows */
  adName?: string;
  /** whether this person can still be written to at all */
  reachable: boolean;
  /** their own thread in Business Suite when it can be named, the inbox when it cannot */
  chatUrl: string;
  /**
   * The bot has stopped in this thread because the form went out.
   *
   * Read for the screen rather than stored on the lead: the silence belongs to the chat
   * session, and a lead is a report of what happened rather than the switch that did it.
   */
  botStopped: boolean;
}

/** A list the page shows a slice of, and how long the whole of it is. */
export interface Listed<T> {
  rows: T[];
  total: number;
}

/**
 * The page's figures, each of them `null` where it could not be read.
 *
 * Null, not zero. A query that failed used to come back as an empty list and draw as "ยังไม่มี
 * ข้อมูลในช่วงนี้", which told the owner nobody had written — a false thing to say about the
 * business on the one page meant to say true things about it. Now the part that failed says
 * so, and the parts that did not are still shown.
 */
export interface CrmPage {
  range: Range;
  summary: Summary | null;
  /** everyone active in the range, newest activity first */
  leads: Listed<LeadView> | null;
  /** of those, everyone who has not returned the form */
  following: Listed<LeadView> | null;
  unanswered: OpenQuestions | null;
  /** what the models cost over the same range as every other figure, in baht */
  aiCost: number | null;
  /** what could not be read, in words for the owner */
  failed: string[];
}

type Tab = "recent" | "follow" | "unanswered";

export async function loadCrm(range: Range = "7d", tab: Tab = "recent"): Promise<CrmPage> {
  await requireStaff("admin");
  const start = rangeStart(range);
  const failed: string[] = [];

  /** One part of the page, read on its own so that its failure is its own. */
  const attempt = async <T>(what: string, read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch (e) {
      console.error(`${READ_FAILED} (${what}):`, e);
      failed.push(what);
      return null;
    }
  };

  const [conversations, recent, follow, unanswered, aiCost] = await Promise.all([
    attempt("ตัวเลขบทสนทนา", () => conversationsSince(start)),
    attempt("รายชื่อลูกค้า", () => leadsSince(start, false)),
    attempt("รายชื่อที่ต้องตามต่อ", () => leadsSince(start, true)),
    attempt("คำถามที่ตอบไม่ได้", () => openQuestions(UNANSWERED_LIMIT)),
    attempt("ค่า AI", () => aiSpendSince(start)),
  ]);

  const summary = conversations ? summarise(conversations, range) : null;

  const names = await adNames([
    ...(summary?.byAd.map((a) => a.adId) ?? []),
    ...(recent?.rows.map((l) => l.ad_id) ?? []),
    ...(follow?.rows.map((l) => l.ad_id) ?? []),
  ]);
  if (summary) {
    summary.byAd = summary.byAd.map((a) => ({ ...a, ...(names.has(a.adId) ? { name: names.get(a.adId) } : {}) }));
  }

  /**
   * Names only for the list on screen. Each one is a call to Meta, and the other list's
   * header needs only its length, which the database has already counted.
   */
  const dress = async (list: Listed<RawLead> | null, shown: boolean): Promise<Listed<LeadView> | null> =>
    list && { total: list.total, rows: await present(list.rows, names, shown) };

  return {
    range,
    summary,
    leads: await dress(recent, tab === "recent"),
    following: await dress(follow, tab === "follow"),
    unanswered,
    aiCost,
    failed,
  };
}

type RawLead = Omit<LeadRow, "has_psid"> & { psid_cipher: unknown; channel: string; user_hash: string };

/**
 * The leads with any activity in the range, newest first.
 *
 * Chosen by `updated_at`, the same column they are sorted by. They were chosen by
 * `created_at`, so a customer who first asked eight days ago and came back this morning — the
 * warmest lead there is — was missing from the seven-day list altogether.
 *
 * "ต้องตามต่อ" is its own query rather than a filter over the first page: filtering fifty rows
 * found only the ones among those fifty, and the tab's count said fifty-or-fewer when the
 * truth could be more.
 */
async function leadsSince(since: Date, followOnly: boolean): Promise<Listed<RawLead>> {
  let q = supabaseAdmin()
    .from("ins_leads")
    // the cipher itself has no business travelling to a React tree; the page only ever asks
    // whether this person can still be written to
    .select(
      "id, conversation_id, stage, product, last_quote, ad_id, page_id, created_at, updated_at," +
      " psid_cipher, channel, user_hash",
      { count: "exact" },
    )
    .gte("updated_at", since.toISOString());
  if (followOnly) q = q.neq("stage", "form_done");
  const { data, error, count } = await q.order("updated_at", { ascending: false }).limit(LEAD_LIMIT);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RawLead[];
  return { rows, total: count ?? rows.length };
}

/** Put what the screen needs on each lead, and nothing it does not. */
async function present(raw: RawLead[], ads: Map<string, string>, withNames: boolean): Promise<LeadView[]> {
  /**
   * Which of these threads the bot has stopped in.
   *
   * One query for the whole list rather than one per row, and the hashes themselves stay on
   * this side: what the screen is told is a yes or a no.
   */
  const stopped = await stoppedThreads(raw);
  return Promise.all(raw.map(async ({ psid_cipher, channel, user_hash, ...rest }) => {
    const lead = {
      ...rest,
      has_psid: psid_cipher !== null,
      botStopped: stopped.has(`${channel}:${user_hash}`),
      ...(rest.ad_id && ads.has(rest.ad_id) ? { adName: ads.get(rest.ad_id) } : {}),
    };
    if (!lead.has_psid) return { ...lead, reachable: false, chatUrl: chatLink(channel, null, null) };
    const psid = await psidFor(lead.id);
    if (!psid) return { ...lead, reachable: false, chatUrl: chatLink(channel, null, null) };
    // asked of the service the customer wrote on: a LINE id means nothing to Facebook
    const profile = withNames ? await profileFor(channel, lead.page_id, psid) : null;
    return {
      ...lead,
      reachable: true,
      chatUrl: chatLink(channel, lead.page_id, psid),
      ...(profile?.name ? { name: profile.name } : {}),
      ...(profile?.picture ? { picture: profile.picture } : {}),
    };
  }));
}

/** The page-scoped id behind one lead, decrypted for this render only. */
async function psidFor(leadId: string): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  try {
    const { data, error } = await supabaseAdmin()
      .rpc("ins_get_lead_psid", { p_lead: leadId, p_passphrase: secret });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("อ่านรหัสลูกค้าไม่สำเร็จ:", e);
    return null;
  }
}

/**
 * The threads on this page the bot has been stopped in, as `channel:user_hash`.
 *
 * `handed_over_at` is stamped when the application form goes out and read past the session's
 * own staleness, so it is the one thing that says whether the bot is still answering — a lead
 * at stage form_sent whose column has since been cleared is a thread the bot has back.
 */
async function stoppedThreads(
  leads: { channel: string; user_hash: string }[],
): Promise<Set<string>> {
  const hashes = [...new Set(leads.map((l) => l.user_hash))];
  if (!hashes.length) return new Set();
  const { data, error } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("channel, user_hash, handed_over_at")
    .in("user_hash", hashes)
    .not("handed_over_at", "is", null);
  if (error) {
    console.error("อ่านสถานะบอทไม่สำเร็จ:", error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { channel: string; user_hash: string }[])
    .map((r) => `${r.channel}:${r.user_hash}`));
}

/**
 * Give one thread back to the bot.
 *
 * The silence after an application form does not expire on its own, on purpose: it ends when
 * somebody who knows the application is over says so. This is that button, and it is the only
 * thing that clears the stamp.
 *
 * The lead is named rather than the customer: the hash never leaves this side, and the row
 * being pointed at is one the screen was already showing.
 */
export async function letBotResume(leadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("admin");
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("ins_leads")
    .select("channel, user_hash")
    .eq("id", leadId)
    .maybeSingle();
  if (error) return { ok: false, error: `อ่านข้อมูลลูกค้าไม่สำเร็จ: ${error.message}` };
  const lead = data as { channel: string; user_hash: string } | null;
  if (!lead) return { ok: false, error: "ไม่พบลูกค้ารายนี้" };

  const cleared = await supabase
    .from("ins_chat_sessions")
    .update({ handed_over_at: null })
    .eq("channel", lead.channel)
    .eq("user_hash", lead.user_hash);
  if (cleared.error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${cleared.error.message}` };
  // the row read "บอทหยุดตอบแล้ว" beside "บอทดูแลต่อแล้ว" until the page was reloaded by hand
  revalidatePath("/admin/crm");
  return { ok: true };
}

/**
 * Take one question off the list: the owner has answered it.
 *
 * The list and the front page's "มีคำถามที่ผู้ช่วยตอบเองไม่ได้" both count only the questions
 * nobody has answered, so this is what finally lets that line go away. Before it existed the
 * line could only grow until the thirty-day sweep caught up.
 */
export async function markQuestionAnswered(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff("admin");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "ไม่พบคำถามข้อนี้" };
  try {
    await markAnswered(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  return { ok: true };
}
