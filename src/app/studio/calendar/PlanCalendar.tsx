import Link from "next/link";
import { monthGridDays, parseMonth, shiftMonth, thaiMonthYear, todayKey } from "@/lib/content/calendar";
import { planTitle } from "@/lib/content/day-plan";
import { listPlanned, listUnplanned, type ContentItem } from "@/lib/content/store";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { PlanBoard, type PlanCard } from "./PlanBoard";

/**
 * The calendar of an agent with no Page (owner, 2026-09-30): the month's planned pieces and a
 * rail of the ones with no day. Nothing here reaches Facebook — the agent posts, then says so.
 */

const card = (i: ContentItem): PlanCard => ({
  id: i.id, title: planTitle(i), format: i.format, day: i.plan?.day ?? null, doneAt: i.plan?.doneAt ?? null,
});

export async function PlanCalendar({ params }: { params: { y?: string; m?: string; view?: string } }) {
  const today = todayKey();
  const [ty, tm] = today.split("-").map(Number);
  const { year, month } = parseMonth(params.y, params.m, { year: ty, month: tm });
  const listView = params.view === "list";
  const cells = monthGridDays(year, month);
  const [planned, unplanned] = await Promise.all([
    listPlanned(cells[0].day, cells[cells.length - 1].day).catch(() => []),
    listUnplanned().catch(() => []),
  ]);

  const query = (over: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams({ y: String(year), m: String(month) });
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ปฏิทินโพสต์</h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">วางแผนว่าจะโพสต์ชิ้นไหนวันไหน — ระบบไม่โพสต์เอง ถึงวันคัดลอกไปโพสต์แล้วกด “โพสต์แล้ว”</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={query({ y: String(ty), m: String(tm) })} className={navBtn}>วันนี้</Link>
          <Link href={query({ y: String(prev.year), m: String(prev.month) })} aria-label="เดือนก่อน" className={navBtn}><ChevronLeftIcon className="size-5" /></Link>
          <h2 className="min-w-36 text-center text-lg font-semibold sm:min-w-40">{thaiMonthYear(year, month)}</h2>
          <Link href={query({ y: String(next.year), m: String(next.month) })} aria-label="เดือนถัดไป" className={navBtn}><ChevronRightIcon className="size-5" /></Link>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] p-1">
          <Link href={query({ view: undefined })} aria-current={!listView ? "page" : undefined} className={toggle(!listView)}>เดือน</Link>
          <Link href={query({ view: "list" })} aria-current={listView ? "page" : undefined} className={toggle(listView)}>รายการ</Link>
        </div>
      </div>
      {/* a fresh board for each month and view: search params alone keep a client component's state */}
      <PlanBoard key={`${year}-${month}-${listView ? "list" : "month"}`} cells={cells} planned={planned.map(card)} unplanned={unplanned.map(card)} today={today} listView={listView} />
    </div>
  );
}
