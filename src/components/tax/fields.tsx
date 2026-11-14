"use client";
import { useId, useState, type ReactNode } from "react";
import type { BracketLine } from "@/lib/tax/brackets";
import { formatMoney, parseMoney } from "@/lib/tax/money";
import { RULES_2569 as R } from "@/lib/tax/rules/2569";

/**
 * The tax page's controls, in the skin every calculator here wears (navy on white, square
 * corners) — the stand-alone tax app's own controls redrawn, their behaviour kept.
 */

export const chip = (on: boolean) =>
  `rounded-sm border px-2 py-2 text-sm leading-tight transition-colors ${
    on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] bg-[var(--lg-raise)] text-[var(--lg-mute)]"
  }`;

/** an amount with thousands separators; decimals allowed, as the engine takes satang */
export function Money(
  { label, hint, value, onChange, children }:
    { label: string; hint?: string; value: number; onChange: (n: number) => void; children?: ReactNode },
) {
  const id = useId();
  // while typing, what was typed; otherwise the value with its commas
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? formatMoney(value) : "");
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-[var(--lg-mute)]">{label}</label>
      <div className="mt-1.5 flex items-center rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] focus-within:border-[var(--lg-gold)]">
        <input
          id={id} inputMode="decimal" autoComplete="off" placeholder="0" value={shown}
          className="w-full min-w-0 bg-transparent px-3 py-2 text-lg tabular-nums text-[var(--lg-white)] outline-none"
          onFocus={() => setDraft(value ? formatMoney(value) : "")}
          onChange={(e) => { setDraft(e.target.value); onChange(parseMoney(e.target.value)); }}
          onBlur={() => setDraft(null)}
        />
        <span className="pr-3 text-xs text-[var(--lg-mute)]">บาท</span>
      </div>
      {hint && <p className="mt-1 text-xs leading-relaxed text-[var(--lg-mute)]">{hint}</p>}
      {children}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm text-[var(--lg-white)]">{label}</span>
        {hint && <span className="block text-xs leading-relaxed text-[var(--lg-mute)]">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--bot-line)] transition peer-checked:bg-[var(--lg-gold)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--lg-gold)] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

export function Stepper({ label, hint, value, onChange, max = 10 }: { label: string; hint?: string; value: number; onChange: (n: number) => void; max?: number }) {
  const btn = "grid h-9 w-9 place-items-center rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] text-lg leading-none text-[var(--lg-white)] disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-[var(--lg-white)]">{label}</p>
        {hint && <p className="text-xs leading-relaxed text-[var(--lg-mute)]">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className={btn} aria-label={`ลด ${label}`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <span className="w-5 text-center text-lg tabular-nums text-[var(--lg-white)]" aria-live="polite">{value}</span>
        <button type="button" className={btn} aria-label={`เพิ่ม ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

/** a group of fields that folds away, its heading saying how much is in it */
export function Group({ title, filled, open = false, children }: { title: string; filled: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group border-t border-[var(--lg-panel-line)] pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[var(--lg-white)] marker:hidden">
        <span>{title} <span className="font-normal text-[var(--lg-mute)]">· {filled}</span></span>
        <span aria-hidden className="text-lg leading-none text-[var(--lg-gold)] transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-4 pb-1 pt-4">{children}</div>
    </details>
  );
}

/** "used X of Y" under a deduction field, and why when the claim was cut */
export function CapBar({ claimed, allowed, cap, note }: { claimed: number; allowed: number; cap: number | null; note?: string }) {
  if (cap === null || cap <= 0) return null;
  const cut = claimed > allowed;
  return (
    <div className="mt-1.5">
      <div className="h-1 bg-[var(--bot-line)]">
        <div className="h-full bg-[var(--lg-gold)] transition-all" style={{ width: `${Math.min(100, (allowed / cap) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-[var(--lg-mute)]">
        ใช้สิทธิ์ {formatMoney(allowed)} จากสิทธิ์สูงสุด {formatMoney(cap)} บาท
        {cut && <span className="text-[var(--bot-red-ink)]"> · นับได้แค่ {formatMoney(allowed)} บาท</span>}
      </p>
      {cut && note && <p className="text-xs text-[var(--bot-red-ink)]">{note}</p>}
    </div>
  );
}

/** each slice of the money, the rate it is taxed at and the tax on it */
export function Stairs({ lines, unit = "เงินได้สุทธิ" }: { lines: BracketLine[]; unit?: string }) {
  if (lines.length === 0) return <p className="text-sm text-[var(--lg-mute)]">ยังไม่มี{unit}ที่ต้องเสียภาษี</p>;
  const max = Math.max(...lines.map((l) => l.amount));
  const top = Math.max(...lines.map((l) => l.rate)) || 1;
  return (
    <ol className="space-y-2.5">
      {lines.map((l) => (
        <li key={l.from} className="grid grid-cols-[3.25rem_1fr] items-center gap-3">
          <span className="text-right text-sm font-medium tabular-nums text-[var(--lg-white)]">{l.rate === 0 ? "ยกเว้น" : `${Math.round(l.rate * 100)}%`}</span>
          <div className="min-w-0">
            <div
              className="h-5"
              style={{
                width: `${Math.max(4, (l.amount / max) * 100)}%`,
                background: l.rate === 0 ? "var(--bot-line)" : "var(--bot-navy)",
                opacity: l.rate === 0 ? 1 : 0.4 + 0.6 * (l.rate / top),
              }}
            />
            <p className="mt-0.5 text-xs tabular-nums text-[var(--lg-mute)]">
              {formatMoney(l.from)}–{l.to === null ? "ขึ้นไป" : formatMoney(l.to)} · ก้อนนี้ {formatMoney(l.amount)} →{" "}
              <span className="font-medium text-[var(--lg-white)]">ภาษี {formatMoney(l.tax)}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export const panel = "rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5";
export const raise = "rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5";

/** a caution, on sand: not an error */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-sm border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--bot-sand-ink)]">{children}</p>;
}

export function Disclaimer() {
  return (
    <p className="text-xs leading-[1.9] text-[var(--lg-mute)]">
      เป็นการประมาณการ ไม่ใช่คำแนะนำทางภาษี ใช้กฎภาษีปี {R.taxYear} ที่รวบรวมเมื่อ {R.updatedAt}{" "}
      บางรายการยังรอยืนยันกับประกาศกรมสรรพากร ก่อนยื่นจริงโปรดตรวจที่ rd.go.th
    </p>
  );
}

/** a table in the house style: navy heading, figures to the right */
export const th = "bg-[var(--bot-navy)] px-3 py-2 font-semibold text-white";
export const td = "border-b border-[var(--lg-hair)] px-3 py-1.5";
