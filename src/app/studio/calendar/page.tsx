import Link from "next/link";
import { after } from "next/server";
import {
  boardDay, dayStart, monthGridDays, nextDayKey, parseMonth, shiftMonth, thaiMonthYear, timeOfDay, todayKey,
  DROP_TIME, type BoardItem,
} from "@/lib/content/calendar";
import { CLAIM_HREF, CLAIM_NAME } from "@/lib/content/claim";
import { RECRUIT_HREF, RECRUIT_NAME } from "@/lib/content/recruit";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { contentProduct } from "@/lib/content/products";
import { publishView } from "@/lib/content/publish-label";
import { verifyDue } from "@/lib/content/publish-flow";
import { listPublished, listWaiting, type ContentItem } from "@/lib/content/store";
import { publishSetup } from "../publish";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { CalendarBoard, MonthList } from "./CalendarBoard";
import { gatePage, placedBy } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
/** the board's own actions (a drop posts through Facebook) run from this page, as /studio's do */
export const maxDuration = 300;

export const metadata = {
  title: "ปฏิทินโพสต์ | advisortool",
  description: "โพสต์ที่ลงเพจแล้วและที่ตั้งเวลาไว้ รายเดือน ลากชิ้นงานลงวันเพื่อตั้งเวลา",
};

/**
 * The post calendar, laid out as the owner's Maryjane project lays out its /calendar: a month
 * Monday to Sunday, a list view, a chip per Page, and a rail of pieces waiting for a day that
 * can be dragged onto one. Facebook holds every schedule, so a drop is a real schedule sent
 * through the same checks as the editor's ลงเพจ box.
 */

/** `from`–`to`: the moments the grid shows, borrowed edges included */
function toBoard(item: ContentItem, pageName: (id: string | null) => string, from: Date, to: Date): BoardItem {
  const planName = item.planHref === CLAIM_HREF ? CLAIM_NAME : item.planHref === RECRUIT_HREF ? RECRUIT_NAME : contentProduct(item.planHref)?.name ?? item.planHref;
  const view = publishView(item.publish);
  const at = item.publish?.at ? new Date(item.publish.at) : null;
  const day = boardDay(view.kind, at, from, to);
  const placed = day !== null && at;
  const status: BoardItem["status"] = view.kind === "none" ? "waiting" : view.kind;
  const blocked = (item.flags.policy ?? []).find((f) => f.severity === "block");
  return {
    id: item.id,
    pageId: item.publish?.pageId ?? null,
    pageName: pageName(item.publish?.pageId ?? null),
    planHref: item.planHref,
    planName,
    hook: item.output.hooks[0] ?? "",
    body: item.output.body,
    imageUrl: posterUrl(item.output.poster ?? defaultPoster(item.output.hooks[0] ?? "", planName)),
    status,
    day,
    time: placed ? timeOfDay(at) : DROP_TIME,
    postId: item.publish?.postId ?? null,
    unreviewed: item.status === "draft",
    blocked: blocked?.message ?? null,
  };
}

/** why a failed card failed — a send that never answered, or a time Facebook let pass — for the card and its sheet */
function failure(item: ContentItem): [string, string][] {
  const view = publishView(item.publish);
  return view.kind === "failed" ? [[item.id, view.error]] : [];
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; page?: string; view?: string }> }) {
  await gatePage("/studio/calendar", "publish");
  const params = await searchParams;
  const today = todayKey();
  const [ty, tm] = today.split("-").map(Number);
  const { year, month } = parseMonth(params.y, params.m, { year: ty, month: tm });
  const listView = params.view === "list";

  const cells = monthGridDays(year, month);
  // only the days the grid shows, borrowed edges included
  const from = dayStart(cells[0].day);
  const to = dayStart(nextDayKey(cells[cells.length - 1].day));

  // Held posts whose time came are asked about first, so the board says what Facebook did —
  // but the board waits for it two seconds at most. It waited eight, on every month, filter
  // and drop. A check still going is finished after the page is sent (after()), and what it
  // finds is on the next look; a Graph or database error never keeps the page from drawing.
  // The timer is cleared the moment the check ends, so a quick check costs no wait.
  const checking = verifyDue().catch((e) => console.error("calendar verify failed:", e));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const done = await Promise.race([
    checking.then(() => true),
    new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), 2_000); }),
  ]).finally(() => clearTimeout(timer));
  if (!done) after(() => checking);
  const [setup, placed, waiting] = await Promise.all([
    publishSetup(),
    listPublished(from, to).catch(() => []),
    listWaiting().catch(() => []),
  ]);
  // one Page, never all of them together and no switch between them (owner, 2026-09-28): the
  // one its card on /studio asked for, else the first
  const pageFilter = setup.pages.find((p) => p.pageId === params.page)?.pageId ?? setup.pages[0]?.pageId ?? "";
  const pageName = (id: string | null) => setup.pages.find((p) => p.pageId === id)?.pageName ?? "";

  // a send stuck past ten minutes is in both lists (the rail takes stale claims): once only
  const pieces = [...new Map([...placed, ...waiting].map((i) => [i.id, i])).values()];
  const by = await placedBy(pieces.filter((i) => i.publish?.state && i.publish.state !== "cancelled").map((i) => i.id));
  const all = pieces.map((i) => ({ ...toBoard(i, pageName, from, to), by: by[i.id] }));
  const errors: Record<string, string> = Object.fromEntries(pieces.flatMap(failure));
  // other Pages' posts stay off this one's board; the waiting rail belongs to no Page yet and
  // stays, and so does a card that names no Page (a send that failed before 2026-09-28 wrote
  // none) — hidden on every board, a send that may be up would be seen on none
  const items = pageFilter ? all.filter((i) => !i.day || !i.pageId || i.pageId === pageFilter) : all;
  // and what is dropped here goes up on this Page, not on whichever one was used last
  const pageSetup = pageFilter ? { ...setup, pages: setup.pages.filter((p) => p.pageId === pageFilter) } : setup;

  const query = (over: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams({ y: String(year), m: String(month) });
    if (pageFilter) q.set("page", pageFilter);
    if (listView) q.set("view", "list");
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return `/studio/calendar?${q.toString()}`;
  };
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const toggle = (on: boolean) => `inline-flex min-h-11 items-center rounded-full px-4 text-sm ${on ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}`;
  const navBtn = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm";

  // the menu, the palette and the tabs come from ../layout.tsx
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        ปฏิทินโพสต์{pageFilter && <span className="font-normal text-[var(--ct-mute)]"> · {pageName(pageFilter)}</span>}
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={query({ y: String(ty), m: String(tm) })} className={navBtn}>วันนี้</Link>
          <Link href={query({ y: String(prev.year), m: String(prev.month) })} aria-label="เดือนก่อน" className={navBtn}>
            <ChevronLeftIcon className="size-5" />
          </Link>
          <h2 className="min-w-36 text-center text-lg font-semibold sm:min-w-40">{thaiMonthYear(year, month)}</h2>
          <Link href={query({ y: String(next.year), m: String(next.month) })} aria-label="เดือนถัดไป" className={navBtn}>
            <ChevronRightIcon className="size-5" />
          </Link>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] p-1">
          <Link href={query({ view: undefined })} aria-current={!listView ? "page" : undefined} className={toggle(!listView)}>เดือน</Link>
          <Link href={query({ view: "list" })} aria-current={listView ? "page" : undefined} className={toggle(listView)}>รายการ</Link>
        </div>
      </div>

      {listView ? (
        <MonthList items={items.filter((i) => i.day && cells.some((c) => c.day === i.day && c.inMonth))} />
      ) : (
        <CalendarBoard cells={cells} items={items} errors={errors} today={today} setup={pageSetup} defaultPage={pageFilter} />
      )}
    </div>
  );
}
