"use client";
import { useState } from "react";
import type { PersonUse, ProviderSpend, SpendDetail } from "./actions";
import { PROVIDER_LABEL } from "./labels";
import { taskLabel } from "./task-labels";

/*
 * What each AI company cost and what for, and who used it: on ตั้งค่า AI until 2026-10-15,
 * when the owner chose ข and every figure of spend went to one page, การใช้งานและค่า AI.
 */

/**
 * What this provider has cost since the first of the month.
 *
 * A bar as well as a number: five figures in a column are five figures to compare by
 * reading, and the whole question here is which one is the expensive one.
 */
function Spend({ spend, top, open, onToggle }: { spend?: ProviderSpend; top: number; open: boolean; onToggle: () => void }) {
  if (!spend || spend.calls === 0) {
    return <span className="w-36 text-xs text-[var(--bot-ink-faint)]">ยังไม่มีค่าใช้จ่าย</span>;
  }
  const per = spend.baht / spend.calls;
  return (
    <span className="w-36 shrink-0" title={`${spend.calls} ครั้ง · ${spend.tasks.join(", ")}`}>
      <span className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tabular-nums">฿{spend.baht.toFixed(2)}</span>
        <span className="text-[0.65rem] text-[var(--bot-ink-faint)]">{spend.calls} ครั้ง</span>
      </span>
      <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-[var(--bot-panel)]">
        <span className="block h-full rounded-full bg-[var(--bot-navy)]" style={{ width: `${(spend.baht / top) * 100}%` }} />
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-1 text-[0.65rem] text-[var(--bot-ink-faint)]">
        <span>ครั้งละ ฿{per < 0.01 ? "<0.01" : per.toFixed(2)}</span>
        <button type="button" aria-expanded={open} onClick={onToggle} className="font-medium text-[var(--bot-navy)] hover:underline">
          {open ? "ซ่อน ▴" : "ใช้ทำอะไร ▾"}
        </button>
      </span>
    </span>
  );
}

const thb = (n: number) => (n > 0 && n < 0.01 ? "<0.01" : n.toFixed(2));

/** one job's line in a breakdown: what it was, who or what did it, and what it cost */
interface Job { task: string; calls: number; baht: number; under: string[] }

/**
 * Jobs, dearest first, each with a bar against the dearest. A list rather than a table: on a
 * phone a table's money column scrolled off to the right, and the money is the point.
 */
function Jobs({ jobs }: { jobs: Job[] }) {
  const sorted = [...jobs].sort((a, b) => b.baht - a.baht || b.calls - a.calls);
  const top = Math.max(sorted[0]?.baht ?? 0, 0.0001);
  return (
    <ul className="divide-y divide-[var(--bot-line)] text-xs">
      {sorted.map((j) => (
        <li key={j.task} className="flex items-start justify-between gap-3 py-1.5">
          <span className="min-w-0">
            <span className="block text-[var(--bot-ink)]">{taskLabel(j.task)}</span>
            <span className="block text-[0.6rem] text-[var(--bot-ink-faint)]">{j.task}</span>
            {j.under.map((u) => <span key={u} className="block break-words text-[0.65rem] text-[var(--bot-ink-mute)]">{u}</span>)}
          </span>
          <span className="w-24 shrink-0 text-right">
            <span className="block font-semibold tabular-nums">฿{thb(j.baht)}</span>
            <span className="block text-[0.65rem] tabular-nums text-[var(--bot-ink-faint)]">{j.calls.toLocaleString("th-TH")} ครั้ง</span>
            <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-[var(--bot-panel)]">
              <span className="block h-full rounded-full bg-[var(--bot-navy)]" style={{ width: `${(j.baht / top) * 100}%` }} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What one provider's money went on: a line per job, with the models that did it.
 *
 * The total says which company is expensive; this says why. A job that ran on two models
 * (a fallback, or a model changed mid-month) shows both with their own share, so a dear
 * model doing cheap work stands out.
 */
function Detail({ lines }: { lines: SpendDetail[] }) {
  const by = new Map<string, SpendDetail[]>();
  for (const l of lines) by.set(l.task, [...(by.get(l.task) ?? []), l]);
  const jobs: Job[] = [...by.entries()].map(([task, ms]) => ({
    task,
    calls: ms.reduce((n, m) => n + m.calls, 0),
    baht: ms.reduce((n, m) => n + m.baht, 0),
    under: ms.map((m) => (ms.length > 1 ? `${m.model} · ${m.calls} ครั้ง ฿${thb(m.baht)}` : m.model)),
  }));
  return (
    <div className="basis-full rounded bg-[var(--bot-band)] px-2 py-1">
      <Jobs jobs={jobs} />
    </div>
  );
}

/**
 * Every company's spend, one line per job: "the bot cost this much, Studio's pictures that
 * much" — the question asked across the keys rather than down one of them.
 */
function ByJob({ spend }: { spend: ProviderSpend[] }) {
  const by = new Map<string, { calls: number; baht: number; who: Set<string> }>();
  for (const p of spend) {
    for (const l of p.lines) {
      const j = by.get(l.task) ?? { calls: 0, baht: 0, who: new Set<string>() };
      j.calls += l.calls;
      j.baht += l.baht;
      j.who.add(PROVIDER_LABEL[p.provider] ?? p.provider);
      by.set(l.task, j);
    }
  }
  if (by.size === 0) return null;
  const jobs: Job[] = [...by.entries()].map(([task, j]) => ({ task, calls: j.calls, baht: j.baht, under: [[...j.who].join(", ")] }));
  return (
    <details className="mt-3 rounded-md border border-[var(--bot-line)] p-2">
      <summary className="cursor-pointer text-sm font-medium">ดูรวมทุกค่าย — ใช้ไปกับงานอะไรบ้าง ({jobs.length} งาน)</summary>
      <div className="mt-2"><Jobs jobs={jobs} /></div>
    </details>
  );
}

/**
 * Who used AI this month: chat questions and Studio work, per person (owner, 2026-10-10).
 * Asking is free for now; this is the count the owner wants before choosing a price.
 */
function ByPerson({ people }: { people: PersonUse[] | null }) {
  if (people === null) {
    return <p className="mt-3 text-xs text-[var(--bot-red-ink)]">อ่านยอดใช้ AI รายคนไม่สำเร็จ</p>;
  }
  const named = people.filter((p) => p.agentId !== null).length;
  return (
    <details className="mt-3 rounded-md border border-[var(--bot-line)] p-2">
      <summary className="cursor-pointer text-sm font-medium">ใครใช้ AI เดือนนี้ ({named} คน)</summary>
      {people.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">ยังไม่มีข้อมูล — เริ่มบันทึกชื่อคนใช้ตั้งแต่วันที่อัปเดตนี้</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-[var(--bot-ink-mute)]">
              <tr>
                <th className="py-1 text-left font-normal">คน</th>
                <th className="py-1 text-right font-normal">ถามแชท (ครั้ง)</th>
                <th className="py-1 text-right font-normal">แชท ฿</th>
                <th className="py-1 text-right font-normal">Studio ฿</th>
                <th className="py-1 text-right font-normal">รวม ฿</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.agentId ?? "-"} className={`border-t border-[var(--bot-line)] ${p.agentId === null ? "text-[var(--bot-ink-mute)]" : ""}`}>
                  <td className="py-1 pr-2">{p.name}</td>
                  <td className="py-1 text-right">{p.agentId === null ? "—" : p.asks.toLocaleString("th-TH")}</td>
                  <td className="py-1 text-right">{thb(p.chatBaht)}</td>
                  <td className="py-1 text-right">{thb(p.studioBaht)}</td>
                  <td className="py-1 text-right font-medium">{thb(p.baht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}


/**
 * Every company's spend this month, a line each with its bar, and the jobs under it a click
 * away; then all the jobs across the companies, and who asked.
 */
export function SpendView({ spend, people }: { spend: ProviderSpend[]; people: PersonUse[] | null }) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (p: string) => setOpened((o) => {
    const n = new Set(o);
    if (n.has(p)) n.delete(p); else n.add(p);
    return n;
  });
  const top = Math.max(...spend.map((s) => s.baht), 0.0001);
  return (
    <>
      {spend.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--bot-ink-mute)]">ยังไม่มีค่าใช้จ่ายในรอบนี้</p>
      ) : (
        <div className="space-y-2">
          {spend.map((s) => (
            <div key={s.provider} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--bot-line)] p-2">
              <span className="w-56 text-sm">{PROVIDER_LABEL[s.provider] ?? s.provider}</span>
              <Spend spend={s} top={top} open={opened.has(s.provider)} onToggle={() => toggle(s.provider)} />
              {opened.has(s.provider) && <Detail lines={s.lines} />}
            </div>
          ))}
        </div>
      )}
      <ByJob spend={spend} />
      <ByPerson people={people} />
    </>
  );
}
