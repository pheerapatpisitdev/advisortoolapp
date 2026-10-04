"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "../ui/icons";

/**
 * Ads Studio's three columns, drawn as Organic Studio draws its own (ContentStudio.tsx, owner
 * 2026-10-04): เครื่องมือ on the left, sticky and scrolling inside itself on a desk, folded on a
 * phone behind ตั้งค่าการสร้าง; the ads on squared paper beside them, and a rail on the right from
 * xl (under the tools below it) only when one is handed in — the campaign room has none. `tools`
 * is told whether it is folded, and keeps the button that makes something in sight either way
 * (a sticky foot of its own).
 */
export function Columns({ note, tools, desk, rail = null, startOpen = false, deskRef }: {
  /** the line under เครื่องมือ */
  note: string;
  tools: (folded: boolean) => ReactNode;
  desk: ReactNode;
  /** none: the desk takes the room a rail would have */
  rail?: ReactNode | null;
  /** a phone opens with the tools unfolded (nothing on the desk yet) */
  startOpen?: boolean;
  deskRef?: React.Ref<HTMLElement>;
}) {
  const [open, setOpen] = useState(startOpen);
  const formId = useId();

  // a desk: the tools never run past the window, wherever the page has scrolled (as Organic's)
  const aside = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = aside.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const top = Math.max(16, el.getBoundingClientRect().top);
      el.style.setProperty("--tools-room", `${Math.max(320, Math.round(window.innerHeight - top - 16))}px`);
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(fit); };
    fit();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
    };
  }, []);

  return (
    <div className={`mt-5 grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] ${rail ? "xl:grid-cols-[280px_minmax(0,1fr)_240px]" : ""}`}>
      <aside ref={aside} className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:sticky lg:top-4 lg:max-h-[var(--tools-room,calc(100dvh-2rem))] lg:overflow-y-auto">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--ct-hair)] px-4 pb-3 pt-4">
          <div>
            <h2 className="font-semibold">เครื่องมือ</h2>
            <p className="mt-0.5 text-xs text-[var(--ct-mute)]">{note}</p>
          </div>
          <button
            type="button" aria-expanded={open} aria-controls={formId} onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-[var(--ct-line)] px-3 text-sm lg:hidden"
          >
            {open ? "ซ่อนการตั้งค่า" : "ตั้งค่าการสร้าง"}
            <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div id={formId}>{tools(!open)}</div>
      </aside>

      <section ref={deskRef} className={`studio-desk @container min-w-0 scroll-mt-4 space-y-3 rounded-xl border border-[var(--ct-hair)] p-3 lg:min-h-[70dvh] lg:self-stretch ${rail ? "lg:row-span-2 xl:row-span-1" : ""}`}>
        {desk}
      </section>

      {rail && (
        <aside className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:col-start-1 lg:row-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1">
          {rail}
        </aside>
      )}
    </div>
  );
}
