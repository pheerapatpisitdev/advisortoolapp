/**
 * The ways into one Page's workbench (final review, 2026-09-30). Every link carries the Page whose
 * project it is: a link without one opens the first Page's project, and a piece written there is
 * that Page's for good — there is no moving it to another.
 */

export function workbenchHref(to: { page?: string | null; day?: string; open?: string }): string {
  const q = new URLSearchParams();
  if (to.open) q.set("open", to.open);
  if (to.day) q.set("day", to.day);
  if (to.page) q.set("page", to.page);
  const query = q.toString();
  return query ? `/studio/write?${query}` : "/studio/write";
}

export function calendarHref(page: string | null | undefined): string {
  return page ? `/studio/calendar?page=${encodeURIComponent(page)}` : "/studio/calendar";
}

/** the people library's way back: a workbench link of these shapes only, never somewhere else */
const BACK = /^\/studio\/write(\?(open=[0-9a-f-]{36}|page=[0-9A-Za-z_-]+))?$/;

export function backToWorkbench(back: string | undefined): string | null {
  return back && BACK.test(back) ? back : null;
}
