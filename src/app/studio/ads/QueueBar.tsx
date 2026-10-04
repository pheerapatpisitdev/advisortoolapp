"use client";
import type { Room } from "./AdEditor";

/**
 * The strip over a campaign's ads: what the queue writes next (hook × people × angle × style),
 * how many of all the designs are made, and — while a round is out — how long it has taken.
 * A campaign without dimensions, or one whose every design is made, says so here too.
 */
export function QueueBar({ queue, making, seconds }: {
  queue: Room["queue"];
  /** how many ads the round now being written asked for; 0 when none is */
  making: number;
  seconds: number;
}) {
  if (!queue) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--ct-line)] px-4 py-3 text-sm text-[var(--ct-mute)]">
        แคมเปญนี้ยังไม่มีมิติ — กด “ให้ AI วิเคราะห์มิติ” ที่แผงเครื่องมือก่อน แล้วจึงสร้างแอดจากคิวได้
      </p>
    );
  }
  const next = queue.next[0];
  const pct = queue.total ? Math.round((queue.made / queue.total) * 100) : 0;
  return (
    <section aria-label="คิวสร้างแอด" className="space-y-2 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm">
          {making > 0 ? (
            <span role="status" className="inline-flex flex-wrap items-center gap-x-2 font-medium text-[var(--ct-accent)]">
              <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
              กำลังสร้างแอด {making} ชิ้น…
              <span className="font-normal tabular-nums text-[var(--ct-mute)]">
                {seconds} วินาที{seconds > 60 ? " — นานกว่าปกติ แต่ยังทำงานอยู่" : " (ปกติ 20–40 วินาที)"}
              </span>
            </span>
          ) : next ? (
            <>
              <span className="font-medium">พร้อมสร้าง</span>
              <span className="text-[var(--ct-mute)]"> · คิวถัดไป: </span>
              <span className="break-words">{next.hook} × {next.persona} × {next.angle} × {next.style}</span>
            </>
          ) : (
            <span className="font-medium">สร้างครบทุกแบบแล้ว</span>
          )}
        </p>
        <p className="shrink-0 text-xs text-[var(--ct-mute)]">
          สร้างแล้ว <b className="tabular-nums text-[var(--ct-ink)]">{queue.made.toLocaleString("en-US")}</b> / {queue.total.toLocaleString("en-US")} แบบ
        </p>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[var(--ct-hair)]">
        {making > 0
          // time, not a stage: a bar that fills to 40 seconds and waits near the end
          ? <div className="h-full rounded-full bg-[var(--ct-accent)] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(92, (seconds / 40) * 100)}%` }} />
          : <div className="h-full rounded-full bg-[var(--ct-solid)]" style={{ width: `${pct}%` }} />}
      </div>
    </section>
  );
}
