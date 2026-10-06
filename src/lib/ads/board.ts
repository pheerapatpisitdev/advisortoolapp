import type { PosterSpec } from "@/lib/content/poster";
import { advise, type Advice } from "./advice";
import { costPer } from "./results";
import type { AdRun } from "./run-store";

/**
 * ผลแอด's rows (spec 2026-10-07): one per ad of the Page over the range, from the nightly figures
 * (ins_ad_daily), Studio runs and ads built in Ads Manager alike. A run's ad is named after its
 * Organic post and shows even before its first figures; any other ad by its ad or campaign name.
 * Running ads come first, then the rest, each by spend. Only a running ad gets a suggestion.
 */

export interface BoardDaily {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  account_id: string;
  spend: number;
  messaging_started: number;
}

export type BoardStatus = "running" | "paused" | "review" | "rejected" | "ended" | "unknown";

export const STATUS_LABEL: Record<BoardStatus, string> = {
  running: "รัน",
  paused: "หยุด",
  review: "รอตรวจ",
  rejected: "ไม่ผ่าน",
  ended: "จบแล้ว",
  unknown: "—",
};

export interface BoardRow {
  adId: string;
  actId: string;
  title: string;
  poster: PosterSpec | null;
  contentId: string | null;
  run: AdRun | null;
  campaignName: string | null;
  spend: number;
  chats: number;
  costPerChat: number | null;
  status: BoardStatus;
  advice: Advice | null;
}

/** What Meta's effective_status means here; a run past its end has ended whatever Meta says. */
export function boardStatus(effective: string | null, run: AdRun | null, now: Date): BoardStatus {
  if (run && Date.parse(run.endAt) <= now.getTime()) return "ended";
  switch (effective) {
    case "ACTIVE": return "running";
    case "PENDING_REVIEW":
    case "IN_PROCESS": return "review";
    case "DISAPPROVED":
    case "WITH_ISSUES": return "rejected";
    case "PAUSED":
    case "ADSET_PAUSED":
    case "CAMPAIGN_PAUSED": return "paused";
    default: return "unknown";
  }
}

export function boardRows(a: {
  daily: BoardDaily[];
  runs: AdRun[];
  posts: Map<string, { title: string; poster: PosterSpec | null }>;
  statuses: Map<string, string>;
  baseline: number;
  now: Date;
}): BoardRow[] {
  const sums = new Map<string, { actId: string; adName: string | null; campaignName: string | null; spend: number; chats: number }>();
  for (const d of a.daily) {
    const s = sums.get(d.ad_id) ?? { actId: d.account_id, adName: d.ad_name, campaignName: d.campaign_name, spend: 0, chats: 0 };
    s.spend += Number(d.spend) || 0;
    s.chats += Number(d.messaging_started) || 0;
    sums.set(d.ad_id, s);
  }
  const runByAd = new Map(a.runs.flatMap((r) => (r.adId ? [[r.adId, r] as const] : [])));
  const adIds = [...new Set([...runByAd.keys(), ...sums.keys()])];

  const rows = adIds.map((adId): BoardRow => {
    const run = runByAd.get(adId) ?? null;
    const sum = sums.get(adId);
    const post = run?.contentId ? a.posts.get(run.contentId) : undefined;
    const spend = sum?.spend ?? 0;
    const chats = sum?.chats ?? 0;
    const status = boardStatus(a.statuses.get(adId) ?? null, run, a.now);
    return {
      adId,
      actId: run?.actId ?? sum!.actId,
      title: post?.title ?? sum?.adName ?? sum?.campaignName ?? adId,
      poster: post?.poster ?? null,
      contentId: run?.contentId ?? null,
      run,
      campaignName: sum?.campaignName ?? null,
      spend,
      chats,
      costPerChat: costPer(spend, chats),
      status,
      advice: advise({ spend, chats, baseline: a.baseline, running: status === "running" }),
    };
  });
  return rows.sort((x, y) => Number(y.status === "running") - Number(x.status === "running") || y.spend - x.spend);
}

export function boardTotals(rows: BoardRow[]): { spend: number; chats: number; costPerChat: number | null } {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const chats = rows.reduce((s, r) => s + r.chats, 0);
  return { spend, chats, costPerChat: costPer(spend, chats) };
}
