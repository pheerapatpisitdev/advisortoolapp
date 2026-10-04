import { atFold } from "@/lib/content/output";
import type { LaunchStep } from "@/lib/ads/launch-store";

/**
 * What an ad card and the edit page's feed preview say about a piece (Ads Studio, 2026-10-04).
 * Pure, so the browser and the tests read a piece the same way.
 */

/** Facebook folds an ad's primary text here (AD_LIMITS.fold); the card and the preview cut at the same place */
export const AD_FOLD = 125;

/** The primary text as the feed first shows it: the first 125 code points, and whether there is more. */
export function cardText(text: string, limit = AD_FOLD): { shown: string; more: boolean } {
  const fold = atFold(text, limit);
  return { shown: fold.shown, more: fold.hidden.length > 0 };
}

/**
 * The launch a card shows, the one that decides its tab: one switched on in any account first,
 * else the newest (the room hands launches newest first).
 */
export function cardLaunch<T extends { activatedAt: string | null }>(launches: T[]): T | null {
  return launches.find((l) => l.activatedAt) ?? launches[0] ?? null;
}

/** the four things a launch makes on Meta, in order, with the words the owner reads */
export const LAUNCH_STEPS = [
  { key: "campaign", label: "แคมเปญ", short: "แคมเปญ" },
  { key: "adset", label: "ชุดโฆษณา (งบและกลุ่มเป้าหมาย)", short: "ชุดโฆษณา" },
  { key: "creative", label: "ครีเอทีฟ (รูปและข้อความ)", short: "ครีเอทีฟ" },
  { key: "ad", label: "โฆษณา", short: "โฆษณา" },
] as const;

/**
 * The step that broke, in Thai, for the red label on a card: the one after the last step made.
 * Null for a launch with no error, or one that already made every step.
 */
export function brokenStep(launch: { step: LaunchStep; error: string | null }): string | null {
  if (!launch.error) return null;
  const done = launch.step === "none" ? -1 : LAUNCH_STEPS.findIndex((s) => s.key === launch.step);
  return LAUNCH_STEPS[done + 1]?.short ?? null;
}

/** how many ads one press of "เขียนแอดเพิ่ม" writes: every angle in every tone */
export function writeCount(angles: number, tones: number): number {
  const n = (v: number) => (Number.isFinite(v) ? Math.max(1, Math.round(v)) : 1);
  return n(angles) * n(tones);
}

/** A Page's name among the owner's Pages, or its id when it is not one of them any more. */
export function pageNameOf(pageId: string, pages: { pageId: string; pageName: string }[]): string {
  return pages.find((p) => p.pageId === pageId)?.pageName ?? pageId;
}
