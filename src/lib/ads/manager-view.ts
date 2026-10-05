import type { AdResult } from "./results";
import { switchedOn } from "./sent-view";

/**
 * Small pure rules the desktop Ads manager reads (Ads Studio, 2026-10-05): a campaign's state
 * and budget over its sends, the totals row, the address-bar choices, and where a long ad text
 * is folded.
 */

type SendTimes = { activatedAt: string | null; pausedAt: string | null };

/** on: any send is switched on; paused: sends exist but none is on; draft: nothing sent yet. */
export function campaignState(sends: SendTimes[], drafts: number): "on" | "paused" | "draft" {
  void drafts; // a campaign with only drafts is still a draft; kept so callers can pass what they hold
  if (sends.some(switchedOn)) return "on";
  return sends.length > 0 ? "paused" : "draft";
}

/** The daily budget now running, in baht: the sum over the sends that are on; null when none is. */
export function onBudget(sends: (SendTimes & { dailyBudgetMinor: number })[]): number | null {
  const running = sends.filter(switchedOn);
  if (running.length === 0) return null;
  return running.reduce((n, s) => n + s.dailyBudgetMinor, 0) / 100;
}

export function totals(rows: AdResult[]): AdResult {
  return rows.reduce<AdResult>(
    (t, r) => ({ spend: t.spend + r.spend, impressions: t.impressions + r.impressions, clicks: t.clicks + r.clicks, messaging: t.messaging + r.messaging }),
    { spend: 0, impressions: 0, clicks: 0, messaging: 0 },
  );
}

/** ?days= : 30, or 7 for anything else. */
export function parseDays(v: unknown): 7 | 30 {
  return v === 30 || v === "30" ? 30 : 7;
}

/** ?tab= : the ads tab only makes sense with a campaign open. */
export function parseTab(v: unknown, hasCampaign: boolean): "campaigns" | "ads" | "page" {
  if (v === "page") return "page";
  if (v === "ads" && hasCampaign) return "ads";
  return "campaigns";
}

/**
 * Where an ad's text is cut for its "see more" fold, in code points: the last whitespace
 * (space or line break) at or before n, so a word is not split; n itself when there is none;
 * the whole length when the text fits.
 */
export function foldAt(text: string, n = 125): number {
  const cps = Array.from(text);
  if (cps.length <= n) return cps.length;
  for (let i = n; i > 0; i--) if (/\s/.test(cps[i])) return i;
  return n;
}
