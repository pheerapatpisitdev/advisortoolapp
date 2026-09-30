"use client";
import { useState } from "react";
import { INPUT, MUTE } from "./styles";

/**
 * The fields of the doors in and of บัญชีของฉัน (owner, 2026-10-01).
 *
 * Every field has a label above it. A placeholder alone vanished as soon as somebody typed,
 * leaving them to guess which box was which, and a screen reader had only an aria-label.
 */

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className={`mt-1 text-xs ${MUTE}`}>{hint}</p>}
    </div>
  );
}

/**
 * Six digits, with an eye to show them.
 *
 * The spacing is for the digits typed, not the placeholder: set on the whole box it pulled
 * "PIN 6 หลัก" apart letter by letter and left the Thai vowels floating. The placeholder is
 * dots now, the label says what the box is, and the digits are the same size as the phone's.
 */
export function PinInput(
  { id, name, autoComplete, autoFocus, onChange }:
  { id: string; name: string; autoComplete: string; autoFocus?: boolean; onChange?: () => void },
) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} name={name} type={shown ? "text" : "password"} inputMode="numeric" autoComplete={autoComplete}
        autoFocus={autoFocus} maxLength={6} pattern="\d{6}" placeholder="••••••" onChange={onChange}
        className={`${INPUT} pr-12 tracking-[0.3em] tabular-nums placeholder:tracking-[0.2em]`}
      />
      <button
        type="button" onClick={() => setShown((s) => !s)}
        aria-label={shown ? "ซ่อน PIN" : "แสดง PIN"} aria-pressed={shown}
        className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg ${MUTE} hover:text-[var(--field-ink,var(--bot-ink))]`}
      >
        <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

/** One error line, in the one colour kept for errors. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-[var(--field-alert-bg,var(--bot-red-soft))] px-3 py-2 text-sm text-[var(--field-alert,var(--bot-red-ink))]">
      {children}
    </p>
  );
}
