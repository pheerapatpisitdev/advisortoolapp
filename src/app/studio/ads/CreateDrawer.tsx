"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

/**
 * Ads Studio's create drawer (desktop redesign, 2026-10-05): over the page from the right, about
 * 720px wide on a desk and a full-screen sheet below lg, with a dim backdrop. It makes a campaign
 * (NewCampaignForm) or ads in the campaign open (WriteForm with the figure preview); the mode is
 * in the address (?create=campaign|ad), so a reload keeps it open.
 *
 * Focus moves to its first field on open and back to what opened it on close (the + สร้าง button
 * when that is gone); Tab stays inside it, and the page under it is inert and does not scroll.
 * Esc, the backdrop and ✕ close it — except while a round or a campaign is being made (`busy`): then they
 * do nothing and the drawer says so, with the seconds counted, so nothing in progress is lost.
 * With `confirmClose` (settings typed and not saved), they ask it first and stay open on a no.
 */

// :disabled, not [disabled]: a control shut by its disabled <fieldset> is not one either
const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function CreateDrawer({ title, busy, onClose, confirmClose, children }: {
  title: string;
  /** a round or a campaign is being made: the drawer stays open until it is back */
  busy: boolean;
  onClose: () => void;
  /** asked before closing; false keeps the drawer open (unsaved work in it) */
  confirmClose?: () => Promise<boolean>;
  children: ReactNode;
}) {
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // the latest of these for the listeners set once
  const shut = useRef({ busy, onClose, confirmClose });
  useEffect(() => { shut.current = { busy, onClose, confirmClose }; }, [busy, onClose, confirmClose]);
  const close = async () => {
    if (shut.current.busy) return;
    if (shut.current.confirmClose && !(await shut.current.confirmClose())) return;
    shut.current.onClose();
  };

  // open: the page stops scrolling and goes inert (nothing behind can be focused or pressed, even
  // with focus dropped to <body> by a press that shut itself), focus goes to the first field;
  // shut: all of that is undone and focus goes back
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const stilled: HTMLElement[] = [];
    for (let el: HTMLElement | null = root.current; el && el !== document.body && el.parentElement; el = el.parentElement) {
      for (const sib of el.parentElement.children) {
        if (sib !== el && sib instanceof HTMLElement && !sib.inert) { sib.inert = true; stilled.push(sib); }
      }
    }
    const first = body.current?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")
      ?? body.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      // a question already open (ask's own <dialog>) takes its Escape for itself
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) void close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      for (const el of stilled) el.inert = false;
      const back = opener?.isConnected ? opener : document.querySelector<HTMLElement>("[data-create-opener]");
      back?.focus();
    };
    // once per opening: the listener reads the latest busy and onClose through `shut`
  }, []);

  // the seconds a round or a creation has been running; the press shuts itself as it starts, so
  // focus is kept in the drawer (on the panel) rather than left on <body>
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!busy) { setSeconds(0); return; }
    const at = document.activeElement;
    if (panel.current && (!at || !panel.current.contains(at) || (at as HTMLButtonElement).disabled)) panel.current.focus();
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [busy]);

  // Tab and Shift+Tab go round the drawer
  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const all = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (all.length === 0) return;
    const [head, tail] = [all[0], all[all.length - 1]];
    if (e.shiftKey && (document.activeElement === head || document.activeElement === panel.current)) { e.preventDefault(); tail.focus(); }
    else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
  };

  return (
    <div ref={root} className="fixed inset-0 z-40">
      <div aria-hidden="true" onClick={() => void close()} className="absolute inset-0 bg-[var(--ct-scrim)]" />
      <div
        ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1} onKeyDown={trap}
        className="absolute inset-0 flex flex-col bg-[var(--ct-panel)] shadow-2xl outline-none lg:left-auto lg:w-[720px] lg:max-w-[calc(100vw-2rem)] lg:border-l lg:border-[var(--ct-hair)]"
      >
        <header className="flex items-center gap-3 border-b border-[var(--ct-hair)] px-4 py-2">
          <h2 id={titleId} className="min-w-0 flex-1 truncate font-semibold">{title}</h2>
          <button
            type="button" onClick={() => void close()} disabled={busy} aria-label="ปิด"
            title={busy ? "ปิดได้เมื่อสร้างเสร็จ" : undefined}
            className="inline-flex size-11 items-center justify-center rounded-lg text-lg text-[var(--ct-mute)] hover:bg-[var(--ct-ground)] disabled:opacity-40"
          >
            ✕
          </button>
        </header>
        {busy && (
          <p role="status" className="flex items-center gap-2 border-b border-[var(--ct-hair)] bg-[var(--ct-soft)] px-4 py-2 text-sm font-medium text-[var(--ct-accent)]">
            <span className="size-2.5 shrink-0 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
            {`กำลังสร้าง… ${seconds} วินาที — ปิดได้เมื่อเสร็จ`}
          </p>
        )}
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
