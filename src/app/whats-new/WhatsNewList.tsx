"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { byDay, dayHeading, GROUPS, kindLabel, type UpdateGroup, type UpdateKind, type UpdateRow } from "@/lib/updates/rules";
import { markUpdatesRead } from "./actions";

/** the three labels' colours, the palette's own: ใหม่ green, ปรับปรุง navy, แก้ไข sand (mockup section 3) */
export const KIND_STYLE: Record<UpdateKind, React.CSSProperties> = {
  new: { color: "var(--bot-ok)", background: "var(--bot-ok-soft)", borderColor: "var(--bot-ok-line)" },
  better: { color: "var(--bot-navy)", background: "var(--bot-navy-soft)", borderColor: "var(--bot-blue)" },
  fix: { color: "var(--bot-sand-ink)", background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)" },
};

const card = "rounded-xl border border-[var(--hm-hair)] bg-[var(--hm-panel)]";

/**
 * The list on /whats-new: a chip per group that has anything in it, a day's heading over its rows, a navy dot
 * on what was unread when the page opened. The dots are kept from that first look: the page marks everything
 * read as it opens and refreshes, and the dots would otherwise vanish before they are seen.
 */
export function WhatsNewList({ rows, unread }: { rows: UpdateRow[]; unread: string[] }) {
  const router = useRouter();
  const [fresh] = useState(() => new Set(unread));
  const [group, setGroup] = useState<UpdateGroup | null>(null);

  useEffect(() => {
    if (unread.length === 0) return;
    // the menu's number and /home's bar go once the reads are kept
    markUpdatesRead().then((r) => { if (r.ok) router.refresh(); });
    // once per visit: the refresh brings an empty unread list back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rows.length === 0) {
    return <p className={`${card} px-4 py-6 text-center text-sm text-[var(--hm-mute)]`}>ยังไม่มีอัปเดตใน 60 วันที่ผ่านมา</p>;
  }

  const groups = GROUPS.filter((g) => rows.some((r) => r.grp === g.key));
  const shown = group ? rows.filter((r) => r.grp === group) : rows;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-[13px] ${on ? "border-[var(--hm-solid)] bg-[var(--hm-solid)] text-[var(--hm-solid-ink)]" : "border-[var(--hm-line)] bg-[var(--hm-panel)] text-[var(--hm-ink)]"}`;

  return (
    <div className="flex flex-col gap-3">
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="เลือกหมวด">
          <button type="button" className={chip(group === null)} aria-pressed={group === null} onClick={() => setGroup(null)}>ทั้งหมด</button>
          {groups.map((g) => (
            <button key={g.key} type="button" className={chip(group === g.key)} aria-pressed={group === g.key} onClick={() => setGroup(g.key)}>{g.label}</button>
          ))}
        </div>
      )}

      {byDay(shown).map(({ day, rows: list }) => (
        <section key={day} className="flex flex-col gap-2.5" aria-label={dayHeading(day)}>
          <h2 className="mt-1 flex items-center gap-2.5 text-[13px] font-semibold text-[var(--hm-mute)] after:flex-1 after:border-t after:border-[var(--hm-hair)] after:content-['']">
            {dayHeading(day)}
          </h2>
          {list.map((r) => (
            <article key={r.id} className={`${card} grid grid-cols-[10px_minmax(0,1fr)] gap-x-3 px-4 py-3.5 sm:grid-cols-[10px_minmax(0,1fr)_auto]`}>
              <span className="mt-2 size-2.5 rounded-full" style={fresh.has(r.id) ? { background: "var(--hm-accent)" } : undefined}>
                {fresh.has(r.id) && <span className="sr-only">ยังไม่ได้อ่าน</span>}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--hm-mute)]">
                  <span className="rounded-full border px-2" style={KIND_STYLE[r.kind]}>{kindLabel(r.kind)}</span>
                  {r.place || GROUPS.find((g) => g.key === r.grp)?.label}
                </div>
                <h3 className="mt-1 text-base font-semibold text-balance">{r.title}</h3>
                {r.body && <p className="mt-0.5 max-w-[70ch] whitespace-pre-line text-sm text-[var(--hm-mute)]">{r.body}</p>}
              </div>
              {r.link && (
                <Link
                  href={r.link}
                  className="col-start-2 mt-2.5 w-fit self-center rounded-lg border border-[var(--hm-accent)] px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-[var(--hm-accent)] no-underline sm:col-start-3 sm:mt-0"
                >
                  ลองเลย →
                </Link>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
