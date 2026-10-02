"use client";
import { MUTE } from "./styles";

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

/** One error line, in the one colour kept for errors. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-[var(--field-alert-bg,var(--bot-red-soft))] px-3 py-2 text-sm text-[var(--field-alert,var(--bot-red-ink))]">
      {children}
    </p>
  );
}
