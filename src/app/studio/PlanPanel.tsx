"use client";
import { useState } from "react";
import { thaiDayLabel, todayKey } from "@/lib/content/calendar";
import { mayPlanOn, PLAN_LABEL, planState } from "@/lib/content/day-plan";
import type { ContentItem } from "@/lib/content/store";
import { markPlanDone, planPiece, unplanPiece, type PlanResult } from "./plan";

/**
 * วางแผน, in the editor of an agent who may not post (owner, 2026-09-30): the day this piece is
 * planned for, and whether it went up. The calendar's day comes first when it sent the agent here.
 */
export function PlanPanel({ item, suggestDay, onSaved }: { item: ContentItem; suggestDay?: string | null; onSaved: (item: ContentItem) => void }) {
  const today = todayKey();
  const [day, setDay] = useState(item.plan?.day ?? (suggestDay && mayPlanOn(suggestDay, today) ? suggestDay : today));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(call: () => Promise<PlanResult>) {
    setBusy(true);
    setNote(null);
    const res = await call().catch(() => null);
    setBusy(false);
    if (!res) return setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ");
    if (!res.ok) return setNote(res.error);
    onSaved(res.item);
  }

  const plan = item.plan;
  const button = "min-h-11 rounded-lg border border-[var(--ct-line)] px-3 text-sm disabled:opacity-50";
  return (
    <section aria-label="วางแผน" className="mt-4 space-y-2 rounded-xl border border-[var(--ct-line)] p-3">
      <h3 className="text-sm font-semibold">วางแผน</h3>
      {plan && (
        <p className="text-sm">
          วางไว้ <b>{thaiDayLabel(plan.day)}</b> · {PLAN_LABEL[planState(plan.day, plan.doneAt, today)]}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={day} min={today} onChange={(e) => setDay(e.target.value)} aria-label="วันที่จะโพสต์" className="min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 text-sm" />
        <button type="button" disabled={busy || !mayPlanOn(day, today) || plan?.day === day} onClick={() => run(() => planPiece({ id: item.id, day }))} className={`${button} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`}>
          {plan ? "ย้ายไปวันนี้" : "วางแผน"}
        </button>
        {plan && (
          <>
            <button type="button" disabled={busy} onClick={() => run(() => markPlanDone({ id: item.id, done: !plan.doneAt }))} className={button}>
              {plan.doneAt ? "ยกเลิกโพสต์แล้ว" : "โพสต์แล้ว"}
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => unplanPiece(item.id))} className={button}>เอาออกจากแผน</button>
          </>
        )}
      </div>
      {note && <p role="alert" className="text-sm text-[var(--ct-alert)]">{note}</p>}
    </section>
  );
}
