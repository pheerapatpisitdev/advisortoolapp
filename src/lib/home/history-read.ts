import { can, type Viewer } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { modeName } from "@/lib/content/modes";
import { contentProduct } from "@/lib/content/products";
import { isGap } from "@/lib/fhc/gaps";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WalletEntry } from "@/lib/wallet/store";
import { buildHistory, POST_ACTIONS, type HistItem, type HistSources } from "./history";

/**
 * The viewer's own work between two moments, from every table that keeps it (history.ts names
 * each line). `limit` is per table: the /home card asks for a few, the month page for all.
 *
 * Own work only: rows whose agent_id is the viewer. The owner also gets the pieces written
 * before 2026-09-27, which carry no agent and were all theirs. A table that cannot be read is
 * left out and said in the log, so one broken read does not empty the whole history.
 */

type Row = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const firstHook = (v: unknown) => (Array.isArray(v) && typeof v[0] === "string" ? v[0] : "");

export async function readHistory(viewer: Viewer, from: Date, to: Date, limit: number): Promise<HistItem[]> {
  return (await readHistoryOf(viewer.agentId, can(viewer, "owner"), from, to, limit)).items;
}

/**
 * The same lines for anyone: one person's (`who`), or everybody's when `who` is null — the
 * Super Admin's ประวัติผู้ใช้ (owner, 2026-10-15). `unowned` adds the pieces that carry no agent
 * (written before 2026-09-27, all the owner's). `by` says whose each line is, by its key.
 */
export async function readHistoryOf(
  who: string | null, unowned: boolean, from: Date, to: Date, limit: number,
): Promise<{ items: HistItem[]; by: Map<string, string | null> }> {
  const db = supabaseAdmin();
  const me = who;
  const lo = from.toISOString();
  const hi = to.toISOString();

  const read = async (what: string, q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> => {
    try {
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    } catch (e) {
      console.error(`history: ${what} not read:`, e);
      return [];
    }
  };

  /** the person's rows only, or everybody's */
  const mine = <Q,>(q: Q, column = "agent_id"): Q => (me ? (q as unknown as { eq(c: string, v: string): Q }).eq(column, me) : q);
  const piecesQ = db.from("ins_content").select("id, agent_id, created_at, format, plan_href, campaign_id, hooks:output->hooks")
    .neq("status", "trashed").gte("created_at", lo).lt("created_at", hi)
    .order("created_at", { ascending: false }).limit(limit);

  const [pieces, posts, videos, customers, thumbnails, readings, sends, entries, pages] = await Promise.all([
    read("pieces", !me ? piecesQ : unowned ? piecesQ.or(`agent_id.eq.${me},agent_id.is.null`) : piecesQ.eq("agent_id", me)),
    read("posts", mine(db.from("ins_audit").select("id, agent_id, at, action, target, detail"))
      .in("action", POST_ACTIONS).gte("at", lo).lt("at", hi)
      .order("at", { ascending: false }).limit(limit)),
    read("clips", mine(db.from("ins_quote_videos").select("id, agent_id, created_at, input, customer_name, status"))
      .is("deleted_at", null).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("fhc", mine(db.from("ins_fhc_customers").select("id, agent_id, created_at, name, gaps, kind"))
      .gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("thumbnails", mine(db.from("ins_thumbnail_history").select("id, agent_id, created_at"))
      .gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("readings", mine(db.from("ins_describe_history").select("id, agent_id, created_at, summary_th"))
      .gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("ad sends", mine(db.from("ins_ad_send").select("id, created_by, created_at, campaign_id, page_id, objective, daily_budget_minor, currency, error"), "created_by")
      .eq("superseded", false).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("wallet", mine(db.from("ins_wallet_entries").select("id, agent_id, kind, amount_satang, round, note, created_at"))
      .gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    myPages().catch(() => []),
  ]);

  const pageName = new Map(pages.map((p) => [p.pageId, p.pageName]));

  // the hooks of the pieces put on a Page, and the names of the campaigns sent: two small reads by id
  const pieceIds = [...new Set(posts.map((p) => str(p.target)).filter((id) => /^[0-9a-f-]{36}$/.test(id)))];
  const campaignIds = [...new Set(sends.map((s) => str(s.campaign_id)).filter(Boolean))];
  const [posted, campaigns] = await Promise.all([
    pieceIds.length ? read("posted pieces", db.from("ins_content").select("id, hooks:output->hooks").in("id", pieceIds)) : [],
    campaignIds.length ? read("campaigns", db.from("ins_ad_campaign").select("id, name").in("id", campaignIds)) : [],
  ]);
  const hookOf = new Map(posted.map((r) => [str(r.id), firstHook(r.hooks)]));
  const campaignName = new Map(campaigns.map((r) => [str(r.id), str(r.name)]));

  const src: HistSources = {
    pieces: pieces.map((r) => ({
      id: str(r.id), createdAt: str(r.created_at), format: str(r.format),
      planName: contentProduct(str(r.plan_href))?.name ?? modeName(str(r.plan_href)) ?? "Studio",
      hook: firstHook(r.hooks), campaignId: str(r.campaign_id) || null,
    })),
    posts: posts.map((r) => {
      const detail = (r.detail ?? {}) as Row;
      const pieceId = str(r.target) || null;
      return {
        id: String(r.id), at: str(r.at), action: str(r.action), pieceId,
        pageName: pageName.get(str(detail.pageId)) ?? null,
        hook: pieceId ? hookOf.get(pieceId) ?? "" : "",
        when: str(detail.at) || null,
      };
    }),
    videos: videos.map((r) => {
      const input = (r.input ?? {}) as Row;
      return {
        id: str(r.id), createdAt: str(r.created_at), product: str(input.product) || null,
        fhc: Boolean(input.fhc), motion: input.style === "motion", customer: str(r.customer_name), status: str(r.status),
        ...(input.product === "FREESTORY" ? { brief: str(input.brief) } : {}),
      };
    }),
    customers: customers.map((r) => ({
      id: str(r.id), createdAt: str(r.created_at), name: str(r.name), gaps: isGap(r.gaps) ? r.gaps : [], survey: r.kind === "survey",
    })),
    thumbnails: thumbnails.map((r) => ({ id: str(r.id), createdAt: str(r.created_at) })),
    readings: readings.map((r) => ({ id: str(r.id), createdAt: str(r.created_at), summary: str(r.summary_th) })),
    sends: sends.map((r) => ({
      id: str(r.id), createdAt: str(r.created_at), campaignId: str(r.campaign_id) || null,
      campaignName: campaignName.get(str(r.campaign_id)) || null, pageName: pageName.get(str(r.page_id)) ?? null,
      objective: str(r.objective), budgetMinor: Number(r.daily_budget_minor ?? 0), currency: str(r.currency) || "THB",
      error: str(r.error) || null,
    })),
    entries: entries.map((r) => ({
      id: str(r.id), kind: r.kind as WalletEntry["kind"], amountSatang: Number(r.amount_satang),
      round: str(r.round) || null, note: str(r.note) || null, createdAt: str(r.created_at),
    })),
  };
  const owner = (r: Row, column = "agent_id") => str(r[column]) || null;
  const by = new Map<string, string | null>([
    ...pieces.map((r) => [`piece-${str(r.id)}`, owner(r)] as const),
    ...posts.map((r) => [`post-${String(r.id)}`, owner(r)] as const),
    ...videos.map((r) => [`clip-${str(r.id)}`, owner(r)] as const),
    ...customers.map((r) => [`fhc-${str(r.id)}`, owner(r)] as const),
    ...thumbnails.map((r) => [`thumb-${str(r.id)}`, owner(r)] as const),
    ...readings.map((r) => [`read-${str(r.id)}`, owner(r)] as const),
    ...sends.map((r) => [`send-${str(r.id)}`, owner(r, "created_by")] as const),
    ...entries.map((r) => [`money-${str(r.id)}`, owner(r)] as const),
  ]);
  return { items: buildHistory(src), by };
}
