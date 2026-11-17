"use client";
/**
 * The pieces /admin/ai is built from since the owner chose settings-kit's look (ข, 2026-11-18, mockup
 * https://claude.ai/artifact/J3GD1YGtWCU9WTiovgeoDP): a group of rows, a row with its control on the
 * right, a switch, a button, a card that opens over the page, and a company's mark.
 *
 * Adapted from settings-kit (OpenFilm Studio, MIT, see ./LICENSE-openfilm): its shapes and spacing, in
 * the back office's own colors (the --bot-* tokens of globals.css) instead of its dark theme.
 */
import { useEffect, useId, useRef } from "react";
import { MARKS } from "./marks";

/** a company's mark, or its first letter in a rounded square when the kit has none */
export function ProviderMark({ id, size = 18 }: { id: string; size?: number }) {
  const mark = MARKS[id];
  const maskId = `mark-${useId().replace(/:/g, "")}`;
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center text-[var(--bot-ink)]" style={{ width: size, height: size }}>
      {mark ? (
        <svg width={size} height={size} viewBox={mark.viewBox} fill="currentColor" fillRule="evenodd" className="block"><path d={mark.d} /></svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" className="block">
          <mask id={maskId}>
            <rect width="24" height="24" fill="white" />
            <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="700" fill="black" fontFamily="inherit">{(id[0] ?? "?").toUpperCase()}</text>
          </mask>
          <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" mask={`url(#${maskId})`} />
        </svg>
      )}
    </span>
  );
}

/** a section's heading and the line under it */
export function SectionHead({ title, hint, children }: { title: string; hint?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-[var(--bot-ink)]">{title}</h2>
        {hint && <p className="mt-1 max-w-[68ch] text-sm text-[var(--bot-ink-mute)]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** a small grey heading over a group */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-6 text-[13px] font-medium text-[var(--bot-ink-mute)] first:mt-0">{children}</h3>;
}

/** rows on one white sheet, a line between each */
export function Group({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`divide-y divide-[var(--bot-line)] rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] ${className}`}>{children}</div>
  );
}

/** one row: a mark, a title with a line under it, and its control on the right (wraps under on a phone) */
export function Item({ mark, title, description, control, muted, children }: {
  mark?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; control?: React.ReactNode;
  /** a row that is switched off */
  muted?: boolean;
  /** anything shown under the row, across its width */
  children?: React.ReactNode;
}) {
  return (
    <div className={`px-4 py-3 ${muted ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        {mark && <span className="flex shrink-0">{mark}</span>}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] text-[var(--bot-ink)]">{title}</div>
          {description && <div className="text-[13px] text-[var(--bot-ink-mute)]">{description}</div>}
        </div>
        {control && <div className="flex shrink-0 flex-wrap items-center gap-2">{control}</div>}
      </div>
      {children}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, id }: {
  checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; id?: string;
}) {
  return (
    <button
      type="button" role="switch" id={id} aria-checked={checked} aria-label={label} title={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bot-navy)] disabled:opacity-40 ${checked ? "bg-[var(--bot-navy)]" : "bg-[var(--bot-line)]"}`}
    >
      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-[var(--bot-surface)] shadow-sm transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

const BUTTON = {
  primary: "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-[var(--bot-surface)] hover:bg-[var(--bot-navy-lift)]",
  normal: "border-[var(--bot-line-strong)] bg-[var(--bot-surface)] text-[var(--bot-ink)] hover:bg-[var(--bot-band)]",
  quiet: "border-transparent bg-[var(--bot-band)] text-[var(--bot-ink)] hover:bg-[var(--bot-panel)]",
};

export function Button({ variant = "normal", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      type="button" {...rest}
      className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bot-navy)] disabled:opacity-40 ${BUTTON[variant]} ${className}`}
    />
  );
}

export const fieldClass = "h-9 rounded-lg border border-[var(--bot-line)] bg-[var(--bot-band)] px-3 text-sm text-[var(--bot-ink)] outline-none focus:border-[var(--bot-navy)]";

/** what the last save said, beside the button that caused it */
export function Said({ ok, text, className = "" }: { ok: boolean; text: string; className?: string }) {
  return (
    <span role="status" className={`text-xs ${ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"} ${className}`}>
      {ok ? "✓ " : ""}{text}
    </span>
  );
}

/** a card over the page; Esc, เสร็จสิ้น or a click beside it closes it */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, []);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(1,20,61,0.45)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
        className="flex max-h-[90dvh] w-full max-w-[540px] flex-col gap-4 overflow-y-auto rounded-2xl bg-[var(--bot-surface)] p-5 shadow-[0_18px_40px_rgba(2,33,98,0.18)] outline-none sm:p-6"
      >
        {children}
        <div className="flex justify-end"><Button onClick={onClose}>เสร็จสิ้น</Button></div>
      </div>
    </div>
  );
}
