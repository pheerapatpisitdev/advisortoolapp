import { forPage } from "./people-pages";

/**
 * What Studio's front page shows (/studio): a card for each Facebook Page connected here, the
 * Studio tools laid out under it, and a word or two in each tile saying what is in it — the
 * owner's layout, taken from a screenshot of another product (2026-09-28).
 *
 * The calendar, the people library, the Page's connection and its drafts (its project,
 * 2026-09-30) belong to one Page. The opening lines are the room's, so only that tile says the
 * same on every card.
 *
 * The page is the admins' and the posting staff's (owner, 2026-09-28, 2026-09-29): each sees the
 * cards of the Pages they look after (src/lib/auth/pages.ts). An admin who may not post sees no
 * Pages, so they get one card of their own room with the tools they can open; posting staff
 * with no Page yet get that card too, saying the owner ties Pages to them.
 */

export type HomeTileKey = "write" | "calendar" | "hooks" | "people" | "settings";

export interface HomeTile {
  key: HomeTileKey;
  href: string;
  label: string;
  status: string;
}

export interface HomeCard {
  /** the Page's id, or "room" for the card of the agent's own room */
  id: string;
  title: string;
  subtitle: string;
  initials: string;
  /** the Page's profile picture; the initials show when it is null or fails to load */
  picture: string | null;
  tiles: HomeTile[];
}

export interface HomePage {
  pageId: string;
  pageName: string;
  canPost: boolean;
}

export interface HomeInput {
  room: string;
  name: string;
  /** may post to the Pages, and so may open the calendar (and, an admin, /admin/posting) */
  publish: boolean;
  /** sees every Page (owner or admin); posting staff see only their own (src/lib/auth/pages.ts) */
  admin: boolean;
  /** null: not read — the viewer may not post, or the list failed */
  pages: HomePage[] | null;
  /** posts Facebook is holding, per Page */
  scheduled: Map<string, number>;
  /** null wherever a count could not be read: the tile says เปิดดู, not a false zero */
  drafts: number | null;
  /** each Page's own drafts (its project, owner 2026-09-30); null when not read */
  draftsByPage: Map<string, number> | null;
  hooks: number | null;
  /** the people library, each with their Page (src/lib/content/people-pages.ts) */
  people: { pageId: string | null }[] | null;
}

const count = (n: number | null, some: (n: number) => string, none: string) =>
  n === null ? "เปิดดู" : n > 0 ? some(n) : none;

/**
 * Two letters for a card with no picture. Grapheme by grapheme, so a Thai vowel or tone mark
 * stays on its letter instead of standing alone.
 */
export function initials(name: string): string {
  const letters = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(name.replace(/\s+/g, ""))];
  const two = letters.slice(0, 2).map((s) => s.segment).join("");
  return two ? two.toUpperCase() : "?";
}

/** A Page's picture, which Facebook serves to anyone without a token. */
const pagePicture = (pageId: string) =>
  `https://graph.facebook.com/${encodeURIComponent(pageId)}/picture?type=square&width=128&height=128`;

/** How many posts each Page has held for later, from the calendar's list of placed pieces. */
export function scheduledByPage(items: { publish: { state?: string | null; pageId?: string | null } | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const i of items) {
    const pageId = i.publish?.pageId;
    if (i.publish?.state !== "scheduled" || !pageId) continue;
    out.set(pageId, (out.get(pageId) ?? 0) + 1);
  }
  return out;
}

export function homeCards(input: HomeInput): HomeCard[] {
  const write = (pageId?: string): HomeTile => ({
    key: "write", href: pageId ? `/studio/write?page=${encodeURIComponent(pageId)}` : "/studio/write", label: "Organic Studio",
    status: count(pageId ? input.draftsByPage && (input.draftsByPage.get(pageId) ?? 0) : input.drafts, (n) => `ร่าง ${n} ชิ้น`, "ยังไม่มีร่าง"),
  });
  const hooks: HomeTile = {
    key: "hooks", href: "/studio/hooks", label: "คลังสูตรประโยคเปิด",
    status: count(input.hooks, (n) => `${n} สูตร`, "ยังไม่มีสูตร"),
  };
  const people = (pageId?: string): HomeTile => ({
    key: "people", href: pageId ? `/studio/people?page=${encodeURIComponent(pageId)}` : "/studio/people", label: "คลังบุคคล",
    status: count(
      input.people && (pageId ? forPage(input.people, input.pages ?? [], pageId).length : input.people.length),
      (n) => `${n} คน`, "ยังไม่มีคน",
    ),
  });
  const settings = (status: string): HomeTile => ({ key: "settings", href: "/admin/posting", label: "การตั้งค่า", status });

  if (input.publish && input.pages && input.pages.length > 0) {
    return input.pages.map((p) => ({
      id: p.pageId,
      title: p.pageName,
      subtitle: "เพจเฟซบุ๊ก",
      initials: initials(p.pageName),
      picture: pagePicture(p.pageId),
      tiles: [
        write(p.pageId),
        {
          key: "calendar", href: `/studio/calendar?page=${encodeURIComponent(p.pageId)}`, label: "ปฏิทินโพสต์",
          status: count(input.scheduled.get(p.pageId) ?? 0, (n) => `ตั้งเวลาไว้ ${n} โพสต์`, "ยังไม่มีรายการตั้งเวลา"),
        },
        hooks,
        people(p.pageId),
        // /admin/posting is the admins' since 2026-10-02: an assistant's card has no door they cannot open
        ...(input.admin ? [settings(p.canPost ? "เชื่อมต่อ Facebook แล้ว" : "ยังไม่ให้สิทธิ์โพสต์")] : []),
      ],
    }));
  }

  const room: HomeCard = {
    id: "room",
    title: input.room,
    subtitle: `Studio ของ ${input.name}`,
    initials: initials(input.room),
    picture: null,
    tiles: [write(), hooks, people()],
  };
  // posting staff with nothing to show: the way to connect a Page, or word that the list failed
  // posting staff with no Page of their own: the owner ties Pages to them on /admin/team
  if (input.publish && !input.admin && input.pages) return [{ ...room, subtitle: "ยังไม่มีเพจที่ดูแล — ให้เจ้าของเพิ่มที่หน้าทีมงาน" }];
  if (input.publish) room.tiles.push(settings(input.pages ? "ยังไม่ได้เชื่อมต่อ" : "อ่านรายชื่อเพจไม่ได้"));
  return [room];
}
