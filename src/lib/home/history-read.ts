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
  const db = supabaseAdmin();
  const me = viewer.agentId;
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

  const piecesQ = db.from("ins_content").select("id, created_at, format, plan_href, campaign_id, hooks:output->hooks")
    .neq("status", "trashed").gte("created_at", lo).lt("created_at", hi)
    .order("created_at", { ascending: false }).limit(limit);

  const [pieces, posts, videos, customers, thumbnails, readings, sends, entries, pages] = await Promise.all([
    read("pieces", can(viewer, "owner") ? piecesQ.or(`agent_id.eq.${me},agent_id.is.null`) : piecesQ.eq("agent_id", me)),
    read("posts", db.from("ins_audit").select("id, at, action, target, detail")
      .eq("agent_id", me).in("action", POST_ACTIONS).gte("at", lo).lt("at", hi)
      .order("at", { ascending: false }).limit(limit)),
    read("clips", db.from("ins_quote_videos").select("id, created_at, input, customer_name, status")
      .eq("agent_id", me).is("deleted_at", null).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("fhc", db.from("ins_fhc_customers").select("id, created_at, name, gaps")
      .eq("agent_id", me).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("thumbnails", db.from("ins_thumbnail_history").select("id, created_at")
      .eq("agent_id", me).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("readings", db.from("ins_describe_history").select("id, created_at, summary_th")
      .eq("agent_id", me).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("ad sends", db.from("ins_ad_send").select("id, created_at, campaign_id, page_id, objective, daily_budget_minor, currency, error")
      .eq("created_by", me).eq("superseded", false).gte("created_at", lo).lt("created_at", hi)
      .order("created_at", { ascending: false }).limit(limit)),
    read("wallet", db.from("ins_wallet_entries").select("id, kind, amount_satang, round, note, created_at")
      .eq("agent_id", me).gte("created_at", lo).lt("created_at", hi)
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
      };
    }),
    customers: customers.map((r) => ({
      id: str(r.id), createdAt: str(r.created_at), name: str(r.name), gaps: isGap(r.gaps) ? r.gaps : [],
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
  return buildHistory(src);
}
