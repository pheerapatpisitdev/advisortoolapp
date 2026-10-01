"use client";
import Link from "next/link";
import { useState } from "react";
import { thaiDayLabel, type MonthCell } from "@/lib/content/calendar";
import { isReelPiece } from "@/lib/content/clip";
import { mayPlanOn, PLAN_LABEL, planState, type PlanState } from "@/lib/content/day-plan";
import { markPlanDone, planPiece, unplanPiece, type PlanResult } from "../plan";
import { CheckIcon, XIcon } from "../ui/icons";

/**
 * The planning board (owner, 2026-09-30). A piece gets its day from a date box beside it — on the
 * rail, or under ย้ายวัน on its card — which works by touch, by keyboard and in the list view alike;
 * a mouse may also drag a rail piece onto a day. On a phone a day is a button with its count, and
 * its cards open under the month, as the Facebook calendar's day sheet does (final review, 2026-09-30).
 */

export interface PlanCard {
  id: string;
  title: string;
  format: string;
  day: string | null;
  doneAt: string | null;
  /** the piece's poster, small (day-plan.ts planPicture); none for a script or a clip */
  imageUrl: string | null;
  /** a clip: ▶ in the poster's place, as the post calendar draws it */
  reel: boolean;
}

/** a piece goes to a day not gone, and never to the day it is already on (that would unmark it) */
export function mayMoveTo(card: PlanCard, day: string, today: string): boolean {
  return mayPlanOn(day, today) && card.day !== day;
}

const FORMAT: Record<string, string> = { post: "โพสต์", script: "สคริปต์", ad: "โฆษณา", clip: "คลิป" };
const TONE: Record<PlanState, string> = {
  planned: "border-[var(--ct-line)]",
  today: "border-[var(--ct-accent)] bg-[var(--ct-soft)]",
  overdue: "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)]",
  done: "border-[var(--ct-line)] opacity-70",
};
const WEEKDAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
/** what a dragged rail piece carries: its own type, so dragged text is not read as a piece */
const DRAG_TYPE = "application/x-plan-piece";
const control = "inline-flex min-h-11 items-center gap-1 rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50";

export function PlanBoard({ cells, planned: initialPlanned, unplanned: initialUnplanned, today, listView }: {
  cells: MonthCell[]; planned: PlanCard[]; unplanned: PlanCard[]; today: string; listView: boolean;
}) {
  const [planned, setPlanned] = useState(initialPlanned);
  const [rail, setRail] = useState(initialUnplanned);
  /** the date box of each piece, rail or card, by its id */
  const [dates, setDates] = useState<Record<string, string>>({});
  /** the card whose ย้ายวัน box is open */
  const [moving, setMoving] = useState<string | null>(null);
  /** the day whose cards are open under the month (a phone's way in) */
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const byDay = new Map<string, PlanCard[]>();
  for (const c of planned) if (c.day) byDay.set(c.day, [...(byDay.get(c.day) ?? []), c]);
  const dateOf = (c: PlanCard) => dates[c.id] ?? (c.day && c.day >= today ? c.day : today);

  async function run(call: () => Promise<PlanResult>, apply: (item: PlanCard) => void) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const res = await call().catch(() => null);
    setBusy(false);
    if (!res) return setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ");
    if (!res.ok) return setNote(res.error);
    const i = res.item;
    const was = [...planned, ...rail].find((c) => c.id === i.id);
    apply({ id: i.id, title: was?.title ?? "ชิ้นงาน", format: i.format, day: i.plan?.day ?? null, doneAt: i.plan?.doneAt ?? null, imageUrl: was?.imageUrl ?? null, reel: was?.reel ?? isReelPiece(i) });
  }

  const place = (c: PlanCard, day: string) => {
    if (!mayMoveTo(c, day, today)) return setNote(c.day === day ? "ชิ้นนี้อยู่วันนั้นอยู่แล้ว" : "วันที่ผ่านมาแล้ววางแผนไม่ได้");
    void run(() => planPiece({ id: c.id, day }), (n) => {
      setRail((r) => r.filter((x) => x.id !== n.id));
      setPlanned((p) => [...p.filter((x) => x.id !== n.id), n]);
      setMoving(null);
    });
  };
  const takeOff = (c: PlanCard) => run(() => unplanPiece(c.id), (n) => {
    setPlanned((p) => p.filter((x) => x.id !== n.id));
    setRail((r) => [n, ...r]);
  });
  const toggleDone = (c: PlanCard) => run(() => markPlanDone({ id: c.id, done: !c.doneAt }), (n) => setPlanned((p) => p.map((x) => (x.id === n.id ? n : x))));

  const dayBox = (c: PlanCard, label: string, action: string) => (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="date" min={today} value={dateOf(c)} aria-label={`${label} ${c.title}`}
        onChange={(e) => setDates((d) => ({ ...d, [c.id]: e.target.value }))}
        className="min-h-11 rounded-md border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 text-xs"
      />
      <button type="button" disabled={busy} onClick={() => place(c, dateOf(c))} className={control}>{action}</button>
    </div>
  );

  /** the poster, small, and the title — both open the piece in the editor */
  const heading = (c: PlanCard) => (
    <Link href={`/studio/write?open=${c.id}`} className="flex items-start gap-2 font-medium underline-offset-2 hover:underline">
      {c.reel ? (
        <span role="img" aria-label="คลิป Reel" className="flex size-10 shrink-0 items-center justify-center rounded bg-[var(--ct-soft)] text-lg text-[var(--ct-accent)]">▶</span>
      ) : c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route, not an asset to optimise
        <img src={c.imageUrl} alt="" loading="lazy" draggable={false} className="size-10 shrink-0 rounded object-cover" />
      ) : null}
      <span className="line-clamp-2 min-w-0">{c.title}</span>
    </Link>
  );

  // called, not rendered as a component: a component made in render remounts every time, and a
  // keyboard lost its place after each press (final review, 2026-09-30)
  const renderCard = (c: PlanCard) => {
    const state = planState(c.day!, c.doneAt, today);
    return (
      <div key={c.id} className={`space-y-1 rounded-lg border p-2 text-xs ${TONE[state]}`}>
        {heading(c)}
        <p className="text-[var(--ct-mute)]">{FORMAT[c.format] ?? c.format} · {PLAN_LABEL[state]}</p>
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={() => toggleDone(c)} className={control}>
            <CheckIcon className="size-3.5" />{c.doneAt ? "ยกเลิกโพสต์แล้ว" : "โพสต์แล้ว"}
          </button>
          <button type="button" disabled={busy} aria-expanded={moving === c.id} onClick={() => setMoving(moving === c.id ? null : c.id)} className={control}>ย้ายวัน</button>
          <button type="button" disabled={busy} aria-label={`เอาออกจากแผน ${c.title}`} onClick={() => takeOff(c)} className={control}>
            <XIcon className="size-3.5" />
          </button>
        </div>
        {moving === c.id && dayBox(c, "วันใหม่ของ", "ย้าย")}
      </div>
    );
  };

  const daySheet = openDay && (
    <section aria-label={thaiDayLabel(openDay)} className="space-y-2 rounded-xl border border-[var(--ct-line)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{thaiDayLabel(openDay)}</h3>
        <button type="button" aria-label="ปิด" onClick={() => setOpenDay(null)} className={control}><XIcon className="size-3.5" /></button>
      </div>
      {(byDay.get(openDay) ?? []).map(renderCard)}
      {(byDay.get(openDay) ?? []).length === 0 && <p className="text-xs text-[var(--ct-mute)]">วันนี้ยังไม่ได้วางแผน</p>}
      {mayPlanOn(openDay, today) && (
        <Link href={`/studio/write?day=${openDay}`} className="inline-flex min-h-11 items-center text-sm text-[var(--ct-accent)] underline underline-offset-2">เขียนโพสต์ใหม่สำหรับวันนี้</Link>
      )}
    </section>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-2">
        {note && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{note}</p>}
        {listView ? (
          <ul className="space-y-3">
            {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => (
              <li key={day} className="space-y-2">
                <h3 className="text-sm font-semibold">{thaiDayLabel(day)}</h3>
                {list.map(renderCard)}
              </li>
            ))}
            {byDay.size === 0 && <p className="text-sm text-[var(--ct-mute)]">เดือนนี้ยังไม่ได้วางแผน</p>}
          </ul>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => <div key={w} className="py-1 text-center text-xs text-[var(--ct-mute)]">{w}</div>)}
              {cells.map((cell) => {
                const list = byDay.get(cell.day) ?? [];
                const open = mayPlanOn(cell.day, today);
                return (
                  <div
                    key={cell.day}
                    onDragOver={(e) => { if (open && e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); }}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData(DRAG_TYPE);
                      const c = rail.find((x) => x.id === id);
                      if (c) place(c, cell.day);
                    }}
                    className={`min-h-16 space-y-1 rounded-lg border p-1 sm:min-h-24 ${cell.inMonth ? "border-[var(--ct-line)]" : "border-transparent opacity-60"} ${cell.day === today ? "ring-1 ring-[var(--ct-accent)]" : ""}`}
                  >
                    <button
                      type="button" aria-pressed={openDay === cell.day}
                      aria-label={`${thaiDayLabel(cell.day)} · ${list.length ? `${list.length} ชิ้น` : "ว่าง"}`}
                      onClick={() => setOpenDay(openDay === cell.day ? null : cell.day)}
                      className="flex min-h-11 w-full items-start justify-between rounded-md px-1 text-xs text-[var(--ct-mute)] hover:bg-[var(--ct-soft)]"
                    >
                      <span>{Number(cell.day.slice(8))}</span>
                      {list.length > 0 && <span className="rounded-full bg-[var(--ct-soft)] px-1.5 font-medium text-[var(--ct-accent)] sm:hidden">{list.length}</span>}
                    </button>
                    <div className="hidden space-y-1 sm:block">{list.map(renderCard)}</div>
                  </div>
                );
              })}
            </div>
            {daySheet}
          </>
        )}
      </div>
      <aside className="space-y-2 rounded-xl border border-[var(--ct-hair)] p-3">
        <h2 className="text-sm font-semibold">ยังไม่ได้วางวัน ({rail.length})</h2>
        <p className="text-xs text-[var(--ct-mute)]">เลือกวันแล้วกด “วาง” — หรือลากไปวางบนวันในปฏิทิน</p>
        {rail.length === 0 && <p className="text-xs text-[var(--ct-mute)]">ไม่มีชิ้นที่รอวาง — เขียนเพิ่มใน <Link href="/studio/write" className="underline">Organic Studio</Link></p>}
        {rail.map((c) => (
          <div
            key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, c.id)}
            className="space-y-1 rounded-lg border border-[var(--ct-line)] p-2 text-xs"
          >
            {heading(c)}
            <p className="text-[var(--ct-mute)]">{FORMAT[c.format] ?? c.format}</p>
            {dayBox(c, "วันที่จะวาง", "วาง")}
          </div>
        ))}
      </aside>
    </div>
  );
}
