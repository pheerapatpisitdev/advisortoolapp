"use client";
import { useEffect, useRef, useState } from "react";
import { formatBaht } from "@/calc/money";
import { Choice, LABEL } from "@/components/plan/fields";
import { changes, type FhcInput, type Level, type Score } from "@/lib/fhc/health";
import { RETIRE_AGES, type RetireAge } from "@/lib/plan/assumptions";
import type { AreaKey } from "@/lib/plan/recommend";
import { whatIfFhc, type WhatIfReply } from "./actions";

/**
 * ลองปรับดู: three things the customer can change today — the premium budget, the spending,
 * the retirement age — priced again from the rate tables as the sliders stop, against the plan
 * above. Nothing here is logged; ใช้ค่านี้ตรวจใหม่ runs the full check with the new values.
 */

export interface WhatIfValues {
  budget: number;
  expense: number;
  retireAge: RetireAge;
}

const WAIT_MS = 300;
const BUDGET_STEP = 500;
const EXPENSE_STEP = 1_000;
const baht = (v: number) => Math.round(v).toLocaleString("en-US");

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className={LABEL}>{label}</span>
        <span className="lg-figure tabular-nums text-[var(--lg-gold)]">{baht(value)} บาท</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--lg-gold)]"
      />
    </label>
  );
}

export function WhatIf({ asked, order, planAfter, planUsed, dot, word, busy, onApply }: {
  /** the form the result on screen was built from */
  asked: FhcInput;
  order: AreaKey[];
  /** the plan above's after-scores and spend (satang a year), to compare against */
  planAfter: Score[];
  planUsed: number;
  dot: Record<Level, string>;
  word: Record<Level, string>;
  /** the full check is running */
  busy: boolean;
  onApply: (v: WhatIfValues) => void;
}) {
  const [v, setV] = useState<WhatIfValues>({ budget: asked.budget, expense: asked.expense, retireAge: asked.retireAge });
  const [reply, setReply] = useState<WhatIfReply | null>(null);
  const seq = useRef(0);
  const moved = v.budget !== asked.budget || v.expense !== asked.expense || v.retireAge !== asked.retireAge;

  useEffect(() => {
    if (!moved) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      whatIfFhc({ ...asked, ...v }, order)
        .then((r) => { if (mine === seq.current) setReply(r); })
        .catch(() => {});
    }, WAIT_MS);
    return () => clearTimeout(t);
  }, [asked, order, v, moved]);

  // the budget runs to twice what was asked (at least 20,000); spending can come down by half
  const budgetMax = Math.max(20_000, Math.ceil((asked.budget * 2) / BUDGET_STEP) * BUDGET_STEP);
  const expenseMin = asked.expense - Math.floor((asked.expense * 0.5) / EXPENSE_STEP) * EXPENSE_STEP;
  const shown = moved && reply ? reply : null;
  const diff = shown?.ok ? changes(planAfter, shown.after) : [];

  return (
    <section className="space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4 print:hidden">
      <div>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ลองปรับดู</h2>
        <p className="mt-1 text-xs text-[var(--lg-mute)]">เลื่อนแล้วดูว่าคะแนนเปลี่ยนจากแผนข้างบนอย่างไร เบี้ยคิดใหม่จากตารางเบี้ยจริง</p>
      </div>
      <Slider
        label="งบเบี้ยต่อเดือน" value={v.budget} min={0} max={budgetMax} step={BUDGET_STEP}
        onChange={(budget) => setV({ ...v, budget })}
      />
      {expenseMin < asked.expense && (
        <Slider
          label="ค่าใช้จ่ายต่อเดือน" value={v.expense} min={expenseMin} max={asked.expense} step={EXPENSE_STEP}
          onChange={(expense) => setV({ ...v, expense })}
        />
      )}
      <div>
        <span className={LABEL}>อายุเกษียณ</span>
        <Choice
          value={String(v.retireAge)} onChange={(a) => setV({ ...v, retireAge: Number(a) as RetireAge })}
          options={RETIRE_AGES.map((a): [string, string] => [String(a), `${a} ปี`])}
        />
      </div>

      {moved && (
        <div className="space-y-2.5 border-t border-[var(--lg-hair)] pt-3 text-sm" aria-live="polite">
          {!shown ? (
            <p className="text-[var(--lg-mute)]">กำลังคิด…</p>
          ) : !shown.ok ? (
            <p className="text-[var(--lg-gold)]">{shown.error}</p>
          ) : (
            <>
              <p className="text-[var(--lg-white)]">
                เบี้ยเฉลี่ยเดือนละ{" "}
                <span className="lg-figure text-[var(--lg-gold)]">{formatBaht(Math.round(shown.usedAnnual / 12))}</span> บาท
                <span className="text-xs text-[var(--lg-mute)]"> (แผนข้างบน {formatBaht(Math.round(planUsed / 12))} บาท)</span>
              </p>
              {diff.length ? (
                <ul className="space-y-2">
                  {diff.map(({ before: b, after: a }) => (
                    <li key={a.key}>
                      <p className="text-[var(--lg-white)]">{a.label}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--lg-mute)]">
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[b.level]}`} />
                          {b.shown} · {word[b.level]}
                        </span>
                        <span aria-label="เป็น">→</span>
                        <span className="flex items-center gap-1.5 text-[var(--lg-white)]">
                          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[a.level]}`} />
                          {a.shown} · {word[a.level]}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--lg-mute)]">คะแนนเท่ากับแผนข้างบน</p>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button" onClick={() => onApply(v)} disabled={busy}
              className="lg-metal-face rounded-sm border border-[var(--lg-gold)] py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {busy ? "กำลังตรวจ…" : "ใช้ค่านี้ตรวจใหม่"}
            </button>
            <button
              type="button" onClick={() => { setV({ budget: asked.budget, expense: asked.expense, retireAge: asked.retireAge }); setReply(null); }}
              className="rounded-sm border border-[var(--lg-panel-line)] py-2.5 text-sm text-[var(--lg-mute)]"
            >
              กลับค่าเดิม
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
