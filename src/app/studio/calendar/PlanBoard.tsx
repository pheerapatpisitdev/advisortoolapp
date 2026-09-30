"use client";
import Link from "next/link";
import { useState } from "react";
import { thaiDayLabel, type MonthCell } from "@/lib/content/calendar";
import { mayPlanOn, PLAN_LABEL, planState, type PlanState } from "@/lib/content/day-plan";
import { markPlanDone, planPiece, unplanPiece, type PlanResult } from "../plan";
import { CheckIcon, XIcon } from "../ui/icons";

/**
 * The planning board (owner, 2026-09-30): pick a piece on the rail, then a day; or drag it there.
 * A day gone takes nothing. Each card opens its piece, moves, comes off the plan, or is marked posted.
 */

export interface PlanCard {
  id: string;
  title: string;
  format: string;
  day: string | null;
  doneAt: string | null;
}

const FORMAT: Record<string, string> = { post: "โพสต์", script: "สคริปต์", ad: "โฆษณา" };
const TONE: Record<PlanState, string> = {
  planned: "border-[var(--ct-line)]",
  today: "border-[var(--ct-accent)] bg-[var(--ct-soft)]",
  overdue: "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)]",
  done: "border-[var(--ct-line)] opacity-70",
};
const WEEKDAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export function PlanBoard({ cells, planned: initialPlanned, unplanned: initialUnplanned, today, listView }: {
  cells: MonthCell[]; planned: PlanCard[]; unplanned: PlanCard[]; today: string; listView: boolean;
}) {
  const [planned, setPlanned] = useState(initialPlanned);
  const [rail, setRail] = useState(initialUnplanned);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const byDay = new Map<string, PlanCard[]>();
  for (const c of planned) if (c.day) byDay.set(c.day, [...(byDay.get(c.day) ?? []), c]);

  async function run(call: () => Promise<PlanResult>, apply: (item: PlanCard) => void) {
    setBusy(true);
    setNote(null);
    const res = await call().catch(() => null);
    setBusy(false);
    if (!res) return setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ");
    if (!res.ok) return setNote(res.error);
    const i = res.item;
    apply({ id: i.id, title: [...planned, ...rail].find((c) => c.id === i.id)?.title ?? "ชิ้นงาน", format: i.format, day: i.plan?.day ?? null, doneAt: i.plan?.doneAt ?? null });
  }

  const place = (id: string, day: string) => {
    if (!mayPlanOn(day, today)) return setNote("วันที่ผ่านมาแล้ววางแผนไม่ได้");
    void run(() => planPiece({ id, day }), (c) => {
      setRail((r) => r.filter((x) => x.id !== c.id));
      setPlanned((p) => [...p.filter((x) => x.id !== c.id), c]);
      setPicked(null);
    });
  };
  const takeOff = (id: string) => run(() => unplanPiece(id), (c) => {
    setPlanned((p) => p.filter((x) => x.id !== c.id));
    setRail((r) => [c, ...r]);
  });
  const toggleDone = (c: PlanCard) => run(() => markPlanDone({ id: c.id, done: !c.doneAt }), (n) => setPlanned((p) => p.map((x) => (x.id === n.id ? n : x))));

  const Card = ({ c }: { c: PlanCard }) => {
    const state = planState(c.day!, c.doneAt, today);
    return (
      <div className={`space-y-1 rounded-lg border p-2 text-xs ${TONE[state]}`}>
        <Link href={`/studio/write?open=${c.id}`} className="line-clamp-2 font-medium underline-offset-2 hover:underline">{c.title}</Link>
        <div className="flex flex-wrap items-center gap-1 text-[var(--ct-mute)]">
          <span>{FORMAT[c.format] ?? c.format} · {PLAN_LABEL[state]}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={() => toggleDone(c)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50">
            <CheckIcon className="size-3.5" />{c.doneAt ? "ยกเลิกโพสต์แล้ว" : "โพสต์แล้ว"}
          </button>
          <button type="button" disabled={busy} onClick={() => setPicked(c.id)} className="min-h-9 rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50">ย้ายวัน</button>
          <button type="button" disabled={busy} aria-label="เอาออกจากแผน" onClick={() => takeOff(c.id)} className="inline-flex min-h-9 items-center rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50">
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-2">
        {note && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{note}</p>}
        {picked && <p role="status" className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]">เลือกวันที่จะวางชิ้นนี้ — <button type="button" onClick={() => setPicked(null)} className="underline">ยกเลิก</button></p>}
        {listView ? (
          <ul className="space-y-3">
            {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => (
              <li key={day} className="space-y-2">
                <h3 className="text-sm font-semibold">{thaiDayLabel(day)}</h3>
                {list.map((c) => <Card key={c.id} c={c} />)}
              </li>
            ))}
            {byDay.size === 0 && <p className="text-sm text-[var(--ct-mute)]">เดือนนี้ยังไม่ได้วางแผน</p>}
          </ul>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => <div key={w} className="py-1 text-center text-xs text-[var(--ct-mute)]">{w}</div>)}
            {cells.map((cell) => {
              const open = mayPlanOn(cell.day, today);
              return (
                <div
                  key={cell.day}
                  onDragOver={(e) => { if (open) e.preventDefault(); }}
                  onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) place(id, cell.day); }}
                  onClick={() => { if (picked && open) place(picked, cell.day); }}
                  className={`min-h-24 space-y-1 rounded-lg border p-1 ${cell.inMonth ? "border-[var(--ct-line)]" : "border-transparent opacity-60"} ${cell.day === today ? "ring-1 ring-[var(--ct-accent)]" : ""} ${picked && open ? "cursor-pointer hover:bg-[var(--ct-soft)]" : ""}`}
                >
                  <div className="text-right text-xs text-[var(--ct-mute)]">{Number(cell.day.slice(8))}</div>
                  {(byDay.get(cell.day) ?? []).map((c) => <Card key={c.id} c={c} />)}
                  {open && (
                    <Link href={`/studio/write?day=${cell.day}`} onClick={(e) => e.stopPropagation()} className="block text-center text-[10px] text-[var(--ct-mute)] underline-offset-2 hover:underline">+ เขียน</Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <aside className="space-y-2 rounded-xl border border-[var(--ct-hair)] p-3">
        <h2 className="text-sm font-semibold">ยังไม่ได้วางวัน ({rail.length})</h2>
        <p className="text-xs text-[var(--ct-mute)]">กดชิ้นแล้วกดวัน หรือลากไปวางบนวัน</p>
        {rail.length === 0 && <p className="text-xs text-[var(--ct-mute)]">ไม่มีชิ้นที่รอวาง — เขียนเพิ่มใน <Link href="/studio/write" className="underline">Organic Studio</Link></p>}
        {rail.map((c) => (
          <button
            key={c.id} type="button" draggable disabled={busy}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
            onClick={() => setPicked(picked === c.id ? null : c.id)}
            aria-pressed={picked === c.id}
            className={`block w-full rounded-lg border p-2 text-left text-xs ${picked === c.id ? "border-[var(--ct-accent)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)]"}`}
          >
            <span className="line-clamp-2 font-medium">{c.title}</span>
            <span className="text-[var(--ct-mute)]">{FORMAT[c.format] ?? c.format}</span>
          </button>
        ))}
      </aside>
    </div>
  );
}
