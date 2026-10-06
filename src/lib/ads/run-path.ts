import type { ContentItem } from "@/lib/content/store";

/**
 * How an Organic Studio post would run as an ad (spec 2026-10-07). A post on the Page is boosted
 * as it stands; one not posted (a draft, or posting failed or was cancelled) becomes a new ad from
 * its words and picture; one scheduled ahead waits until it is up. Also the figures the run dialog
 * shows: how much it can spend at most, and when it ends.
 */

export const RUN_DAYS = [3, 7, 14] as const;
export type RunDays = (typeof RUN_DAYS)[number];
export const DEFAULT_RUN_DAYS: RunDays = 7;
export const DEFAULT_RUN_BAHT = 200;

export type PostPath =
  | { kind: "boost"; postId: string }
  | { kind: "new" }
  | { kind: "scheduled"; at: string }
  | { kind: "none"; reason: string };

export function postPath(p: Pick<ContentItem, "format" | "status" | "publish" | "output">, now: Date): PostPath {
  if (p.format !== "post") return { kind: "none", reason: "ยิงได้เฉพาะโพสต์" };
  if (p.status === "trashed") return { kind: "none", reason: "โพสต์นี้อยู่ในถังขยะ" };
  const pub = p.publish;
  if (pub?.postId && (pub.state === "published" || pub.state === "scheduled")) {
    const ahead = pub.state === "scheduled" && pub.at !== null && Date.parse(pub.at) > now.getTime();
    return ahead ? { kind: "scheduled", at: pub.at! } : { kind: "boost", postId: pub.postId };
  }
  if (!p.output.poster) return { kind: "none", reason: "โพสต์นี้ยังไม่มีรูป" };
  return { kind: "new" };
}

/**
 * The story a boost names, "<page>_<post>", when the saved id already is one of this Page's. A
 * picture post is saved under its photo id (most of them, 2026-10-07): that needs Meta's
 * page_story_id first, so this is null.
 */
export function storyIdOf(pageId: string, postId: string): string | null {
  const m = /^(\d+)_(\d+)$/.exec(postId);
  return m && m[1] === pageId ? postId : null;
}

/** The most a run can spend: every post at its daily budget for every day. */
export function spendCeiling(posts: number, bahtPerDay: number, days: number): number {
  return posts * bahtPerDay * days;
}

export function endAtOf(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export function isRunDays(v: unknown): v is RunDays {
  return typeof v === "number" && (RUN_DAYS as readonly number[]).includes(v);
}

/** เพิ่มงบ: half as much again; ยืดเวลา: seven days more (run-controls.ts) */
export const RAISE_FACTOR = 1.5;
export const EXTEND_DAYS = 7;

/** Half as much again, rounded up to whole baht, never over the cap. */
export function raisedBudgetMinor(currentMinor: number, capBaht: number): number {
  return Math.min(Math.ceil((currentMinor / 100) * RAISE_FACTOR), capBaht) * 100;
}

/** Seven days more, from the end, or from now once the end has passed. */
export function extendedEnd(endAt: string, now: Date): string {
  return new Date(Math.max(Date.parse(endAt), now.getTime()) + EXTEND_DAYS * 86_400_000).toISOString();
}
