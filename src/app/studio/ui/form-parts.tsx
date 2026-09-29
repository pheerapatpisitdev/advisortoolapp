"use client";
import { useEffect, useId, useState } from "react";
import { FORMAT_SHORT, type Format } from "@/lib/content/prompt";
import { PRO_NAME, PRO_PRINCIPLES } from "@/lib/content/pro";
import { ChevronDownIcon } from "./icons";

/**
 * The parts all three create forms (จากแบบประกัน, รีวิวเคลม, หาทีม) share, so they read in one
 * order (owner, 2026-09-26): what the round is from → what to make → เรื่องที่เล่า (open) →
 * ภาพและโมเดล (folded, it is set once and remembered) → the count beside the สร้าง press.
 */

const FORMATS: Format[] = ["post", "script", "ad"];

/** ทำอะไร as one tap each — it reshapes the whole form, so every choice is in sight */
export function FormatPicker({ value, onChange, formats = FORMATS }: { value: Format; onChange: (f: Format) => void; formats?: Format[] }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="mb-1 block text-sm font-medium">ทำอะไร</span>
      <div className="flex gap-1 rounded-lg bg-[var(--ct-soft)] p-1">
        {formats.map((f) => (
          <button
            key={f} type="button" aria-pressed={value === f} onClick={() => onChange(f)}
            className={`min-h-10 flex-1 rounded-md px-1.5 text-sm ${value === f ? "bg-[var(--ct-panel)] font-medium shadow-sm" : "text-[var(--ct-mute)]"}`}
          >
            {FORMAT_SHORT[f]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** a quiet rule and a name over a run of fields */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-[var(--ct-hair)] pt-4">
      <h3 className="text-xs font-medium text-[var(--ct-mute)]">{title}</h3>
      {children}
    </div>
  );
}

/** the fold's open or shut, kept in this browser like the picks inside it */
const FOLD_KEY = "content-fold-picture";

/** ภาพและโมเดล: shut by default, with one line saying what is picked inside */
export function PictureFold({ summary, children }: { summary: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    try { setOpenState(localStorage.getItem(FOLD_KEY) === "open"); } catch { /* storage unavailable */ }
  }, []);
  const toggle = () => {
    setOpenState((was) => {
      try { localStorage.setItem(FOLD_KEY, was ? "shut" : "open"); } catch { /* not kept */ }
      return !was;
    });
  };
  return (
    <div className="rounded-lg border border-[var(--ct-hair)]">
      <button
        type="button" aria-expanded={open} aria-controls={id} onClick={toggle}
        className="flex min-h-11 w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">ภาพและโมเดล <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
          <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">{summary}</span>
        </span>
        <ChevronDownIcon className={`mt-0.5 size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} hidden={!open} className="space-y-4 border-t border-[var(--ct-hair)] p-3">
        {children}
      </div>
    </div>
  );
}

/**
 * The สร้าง press with the round's count beside it: the number the button says is the one set
 * right next to it. A round whose size is set elsewhere (ads: มุมขาย × น้ำเสียง) has no stepper.
 */
/**
 * `warning`: said above the note when the round is likely to cost more than the month has left.
 * The writing is held against the budget on the server and refused there; the pictures after it
 * were not, and failed one by one after the words were paid for.
 */
export function overBudget(estimate: number, left: number): string | null {
  return estimate > left
    ? `ราว ฿${estimate.toFixed(2)} เกินงบที่เหลือ ฿${left.toFixed(2)} — ภาพบางชิ้นอาจวาดไม่ได้ ลดจำนวนชิ้น เลือกไม่วาดภาพ หรือเพิ่มงบที่หน้า /admin/ai`
    : null;
}

export function PressBar({ count, max, onCount, unit, label, onPress, disabled, note, warning }: {
  count: number;
  max: number;
  onCount?: (n: number) => void;
  unit: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  note: string;
  warning?: string | null;
}) {
  const step = "inline-flex size-11 items-center justify-center text-lg text-[var(--ct-ink)] disabled:opacity-30";
  return (
    <div className="sticky bottom-0 z-10 rounded-b-xl border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="flex gap-2">
        {onCount && (
          <div role="group" aria-label={`จำนวน${unit}`} className="flex shrink-0 items-center rounded-lg border border-[var(--ct-line)]">
            <button type="button" aria-label={`ลด 1 ${unit}`} disabled={count <= 1} onClick={() => onCount(count - 1)} className={step}>−</button>
            <span aria-live="polite" className="min-w-6 text-center text-sm font-medium tabular-nums">{count}</span>
            <button type="button" aria-label={`เพิ่ม 1 ${unit}`} disabled={count >= max} onClick={() => onCount(count + 1)} className={step}>+</button>
          </div>
        )}
        <button type="button" onClick={onPress} disabled={disabled} className="min-h-11 flex-1 rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50">
          {label}
        </button>
      </div>
      {warning && <p className="mt-2 text-xs font-medium text-[var(--ct-warn-ink)]">{warning}</p>}
      <p className="mt-2 text-xs text-[var(--ct-mute)]">{note}</p>
    </div>
  );
}

/** the folded ภาพและโมเดล in one line: the writer, then — posters only — the picture, its tone and who is in it */
export function pictureSummary({ format, writer, painter, theme, person, brief }: {
  format: Format;
  /** the writing model's short name */
  writer: string;
  /** the drawing model's short name, or null for no picture */
  painter: string | null;
  /** the poster tone's name, where the form offers one */
  theme?: string;
  /** the person in the picture, by name */
  person?: string;
  /** the picture brief kept from before: it shapes every round, so it is not left folded out of sight */
  brief?: string;
}): string {
  const picture = format === "script" ? [] : [
    painter ? `วาดด้วย ${painter}` : "ไม่วาดภาพ",
    ...(theme ? [theme] : []),
    ...(painter && person ? [person] : []),
    ...(painter && brief ? [`บรีฟ: ${[...brief].length > 28 ? `${[...brief].slice(0, 27).join("")}…` : brief}`] : []),
  ];
  return [`เขียนด้วย ${writer}`, ...picture].join(" · ");
}

/** คลิปวนลูป on or off, kept in this browser and shared by the three forms */
const LOOP_KEY = "content-script-loop";

export function useLoop(): [boolean, (on: boolean) => void] {
  const [loop, setLoopState] = useState(false);
  useEffect(() => {
    try { setLoopState(localStorage.getItem(LOOP_KEY) === "on"); } catch { /* storage unavailable */ }
  }, []);
  const setLoop = (on: boolean) => {
    setLoopState(on);
    try { localStorage.setItem(LOOP_KEY, on ? "on" : "off"); } catch { /* not kept */ }
  };
  return [loop, setLoop];
}

/** คลิปวนลูป (owner, 2026-09-27): the ending runs back into the opening line — see prompt.ts LOOP_RULES */
export function LoopToggle({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm ${value ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)]"}`}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
      <span>
        <span className="font-medium">คลิปวนลูป ↻</span> <span className="text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span>
        <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">ประโยคปิดพูดค้างไว้ แล้ววนกลับไปต่อที่ประโยคเปิด คนดูจะดูซ้ำโดยไม่รู้ตัว · การชวนทักแชทย้ายไปไว้กลางคลิป</span>
      </span>
    </label>
  );
}

const PRO_KEY = "content-pro";

/** สูตรคอนเทนต์โปร, remembered per browser like คลิปวนลูป; off until the owner ticks it */
export function usePro(): [boolean, (on: boolean) => void] {
  const [pro, setProState] = useState(false);
  useEffect(() => {
    try { setProState(localStorage.getItem(PRO_KEY) === "on"); } catch { /* storage unavailable */ }
  }, []);
  const setPro = (on: boolean) => {
    setProState(on);
    try { localStorage.setItem(PRO_KEY, on ? "on" : "off"); } catch { /* not kept */ }
  };
  return [pro, setPro];
}

/** สูตรคอนเทนต์โปร (owner, 2026-09-29): the thirteen as writing rules — see src/lib/content/pro.ts */
export function ProToggle({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const list = useId();
  return (
    <div className={`rounded-lg border p-3 text-sm ${value ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)]"}`}>
      <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
        <span>
          <span className="font-medium">{PRO_NAME} (13 ข้อ)</span> <span className="text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span>
          <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">ประโยคเปิดซ้อน 3 ชั้น · ดึงคนกลับกลางเรื่อง · ชวนเซฟ · สคริปต์มี B-roll</span>
        </span>
      </label>
      <button
        type="button" aria-expanded={open} aria-controls={list} onClick={() => setOpen((o) => !o)}
        className="ml-7 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[var(--ct-accent)]"
      >
        <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /> ดู 13 ข้อ
      </button>
      {open && (
        <ol id={list} className="ml-7 mt-1 list-decimal space-y-1.5 pl-4 text-xs">
          {PRO_PRINCIPLES.map((p) => (
            <li key={p.name}>
              <span className="font-medium">{p.name}</span>{" "}
              <span className="text-[var(--ct-mute)]">— {p.what}{p.ai ? "" : " (ทำเองหลังโพสต์ AI ทำแทนไม่ได้)"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
