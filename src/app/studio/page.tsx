import { redirect } from "next/navigation";
import { gatePage, whoOf } from "@/lib/auth/viewer";
import { listPeople } from "@/lib/content/people-store";
import { visibleTo } from "@/lib/content/people-pages";
import { myPages } from "@/lib/auth/pages";
import { pageConnections } from "@/lib/facebook/connection";
import { homeCards, scheduledByPage } from "@/lib/content/studio-home";
import { countByStatus, countDraftsByPage, listHookTemplates, listPublished } from "@/lib/content/store";
import { publishSetup } from "./publish";
import { StudioHome } from "./StudioHome";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Studio | advisortool",
  description: "เครื่องมือทำโพสต์ของแต่ละเพจเฟซบุ๊ก",
};

/** far enough ahead to take in every post Facebook will hold (it holds up to 75 days) */
const AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

// the menu, the palette and the tabs come from layout.tsx
export default async function StudioFrontPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // the workbench lived here until 2026-09-28: its links (?open= from a bookmark, ?hook=, ?day=) go on to it
  const params = await searchParams;
  const kept = new URLSearchParams();
  for (const key of ["open", "hook", "day"]) {
    const v = params[key];
    if (typeof v === "string") kept.set(key, v);
  }
  if (kept.size > 0) redirect(`/studio/write?${kept}`);

  const who = whoOf(await gatePage("/studio"))!;
  // the front page is for admins and the posting staff, who see their own Pages on it
  // (owner, 2026-09-28 and 2026-09-29); every other agent's Studio is the workbench
  if (!who.admin && !who.publish) redirect("/studio/write");
  const now = new Date();
  const [counts, hooks, everyone, setup, placed, mine, connected, draftsByPage] = await Promise.all([
    countByStatus().catch(() => null),
    listHookTemplates().catch(() => null),
    listPeople().catch(() => null),
    who.publish ? publishSetup() : null,
    who.publish ? listPublished(now, new Date(now.getTime() + AHEAD_MS)).catch(() => []) : [],
    myPages().catch(() => []),
    pageConnections().catch(() => []),
    // each Page's own drafts, for its card (its project, 2026-09-30)
    who.publish ? countDraftsByPage().catch(() => null) : null,
  ]);
  // nobody of a Page the caller does not look after: a card counts the people its Page sees, and
  // the helper reads someone of a Page outside the caller's own list as every Page's
  const people = everyone && visibleTo(everyone, new Set(connected.map((p) => p.pageId)), new Set(mine.map((p) => p.pageId)));
  const cards = homeCards({
    room: who.room,
    name: who.name,
    publish: who.publish,
    admin: who.admin,
    pages: setup && !setup.failed ? setup.pages : null,
    scheduled: scheduledByPage(placed),
    drafts: counts?.draft ?? null,
    draftsByPage,
    hooks: hooks?.length ?? null,
    people,
  });
  return <StudioHome cards={cards} />;
}
