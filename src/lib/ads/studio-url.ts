/**
 * The address of /studio/ads (spec 2026-10-07): the Page, the tab (ยิงแอด or ผลแอด), the
 * results range and whether the settings are open, so a reload, the back button and a link all
 * land where they were.
 */

export type StudioTab = "post" | "results";

export function studioUrl(o: { page: string | null; tab: StudioTab; days: 7 | 30; settings?: boolean }): string {
  const q = new URLSearchParams();
  if (o.page) q.set("page", o.page);
  q.set("tab", o.tab);
  q.set("days", String(o.days));
  if (o.settings) q.set("settings", "1");
  return `/studio/ads?${q}`;
}

export function parseStudioTab(v: unknown): StudioTab {
  return v === "results" ? "results" : "post";
}
