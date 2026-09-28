/**
 * The people library split by Facebook Page (owner, 2026-09-28): each person is drawn for one
 * Page's posts — บอย and Luck for LuckyPlanner, phet for ประกัน Talk. A person with no Page, or
 * with a Page no longer connected, is every Page's.
 *
 * The workbench is opened for one Page (from its card on /studio), and its picker
 * offers only the people of that Page. Only the posting staff see Pages at all; an agent's own
 * library has none and shows as it always did.
 */

/** the key of the people who belong to no one Page */
export const ALL_PAGES = "";
export const ALL_PAGES_LABEL = "ทุกเพจ";

export interface PageRef {
  pageId: string;
  pageName: string;
}

interface Placed {
  pageId: string | null;
}

/** the Page a person is shown under: their own while it is connected, ALL_PAGES otherwise */
export function pageOf(person: Placed, pages: PageRef[]): string {
  return person.pageId && pages.some((p) => p.pageId === person.pageId) ? person.pageId : ALL_PAGES;
}

/** the Page the library opens on: the one asked for, or the first — there is no view of them all */
export function choosePage(asked: string | undefined, pages: PageRef[]): string {
  if (asked === ALL_PAGES) return ALL_PAGES;
  return pages.find((p) => p.pageId === asked)?.pageId ?? pages[0]?.pageId ?? ALL_PAGES;
}

/**
 * The picker's people while working for one Page: that Page's and every Page's — nobody drawn
 * for another Page (owner, 2026-09-28). With no Pages, everyone.
 */
export function peopleFor<T extends Placed & { id: string; name: string }>(
  people: T[], pages: PageRef[], page: string,
): { id: string; name: string }[] {
  return forPage(people, pages, page).map(({ id, name }) => ({ id, name }));
}

/** the people working for one Page sees — its own and every Page's; everyone where there are no Pages */
export function forPage<T extends Placed>(people: T[], pages: PageRef[], page: string): T[] {
  return pages.length === 0 ? people : people.filter((p) => [page, ALL_PAGES].includes(pageOf(p, pages)));
}

/**
 * The `page` field of an add or an edit. Not sent: leave the Page as it is. Empty: every
 * Page's. Anything else must be a Page connected here.
 */
export function readPageField(raw: string | null, pages: PageRef[]): { ok: true; pageId: string | null | undefined } | { ok: false } {
  if (raw === null) return { ok: true, pageId: undefined };
  if (raw === ALL_PAGES) return { ok: true, pageId: null };
  return pages.some((p) => p.pageId === raw) ? { ok: true, pageId: raw } : { ok: false };
}
