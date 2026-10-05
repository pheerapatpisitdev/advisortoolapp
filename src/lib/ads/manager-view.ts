import type { AdResult } from "./results";
import { switchedOn } from "./sent-view";

/**
 * Small pure rules the desktop Ads manager reads (Ads Studio, 2026-10-05): a campaign's state
 * and budget over its sends, the totals row, the address-bar choices, and where a long ad text
 * is folded.
 */

type SendTimes = { activatedAt: string | null; pausedAt: string | null };

/** on: any send is switched on; paused: sends exist but none is on; draft: nothing sent yet. */
export function campaignState(sends: SendTimes[]): "on" | "paused" | "draft" {
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

/** Code-point offsets at which a segment of the text starts, for one Intl.Segmenter granularity. */
function starts(text: string, granularity: "grapheme" | "word"): number[] {
  const out: number[] = [];
  let cp = 0;
  for (const seg of new Intl.Segmenter("th", { granularity }).segment(text)) {
    out.push(cp);
    cp += Array.from(seg.segment).length;
  }
  return out;
}

/**
 * Where an ad's text is cut for its "see more" fold, in code points; the whole length when it
 * fits. The cut never splits a letter (a Thai vowel or tone mark with its consonant, an emoji
 * sequence): at the last whitespace at or before n, else the last word boundary, either one not
 * earlier than 0.6 n, else the last grapheme boundary at or before n. Where Intl.Segmenter is
 * missing (older browsers) it cuts by code point: the last whitespace from 0.6 n to n, else n.
 */
export function foldAt(text: string, n = 125): number {
  if (n <= 0) return 0;
  const cps = Array.from(text);
  if (cps.length <= n) return cps.length;
  const floor = Math.ceil(0.6 * n);
  // a browser without Intl.Segmenter: the last whitespace not earlier than 0.6 n, else n code points
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    for (let i = n; i >= floor; i--) if (/\s/.test(cps[i])) return i;
    return n;
  }
  const graphemes = starts(text, "grapheme");
  const isStart = new Set(graphemes);
  for (let i = n; i >= floor; i--) if (isStart.has(i) && /\s/.test(cps[i])) return i;
  const words = starts(text, "word");
  for (let k = words.length - 1; k >= 0; k--) if (words[k] <= n && words[k] >= floor) return words[k];
  for (let k = graphemes.length - 1; k >= 0; k--) if (graphemes[k] <= n) return graphemes[k];
  return 0;
}

/**
 * An address of Ads Studio: the Page, the campaign open, the tab, the results range (7 is
 * the default and is left out) and the create drawer, when it is open. Every choice is a new
 * address, so a reload, the back button and a link all land where they were.
 */
export function studioHref(o: {
  page: string | null; campaign: string | null; tab: "campaigns" | "ads" | "page"; days: 7 | 30;
  /** the create drawer open over the view */
  create?: CreateMode | null;
}): string {
  const q = new URLSearchParams();
  if (o.page) q.set("page", o.page);
  if (o.campaign) q.set("campaign", o.campaign);
  q.set("tab", o.tab);
  if (o.days === 30) q.set("days", "30");
  if (o.create) q.set("create", o.create);
  return `/studio/ads?${q.toString()}`;
}

/** what the create drawer makes: a campaign, or ads in the campaign open */
export type CreateMode = "campaign" | "ad";

/** ?create= : the drawer's mode; ads only with a campaign open, nothing for anything else. */
export function parseCreate(v: unknown, hasCampaign: boolean): CreateMode | null {
  if (v === "campaign") return "campaign";
  if (v === "ad" && hasCampaign) return "ad";
  return null;
}

/**
 * The same address with the create drawer opened in `mode`, or shut with null: written in place
 * (history.replaceState) when the drawer opens or closes inside the page, so no read of the
 * room is made again.
 */
export function withCreate(href: string, mode: CreateMode | null): string {
  const url = new URL(href, "http://studio.invalid");
  if (mode) url.searchParams.set("create", mode);
  else url.searchParams.delete("create");
  return `${url.pathname}${url.search}${url.hash}`;
}
