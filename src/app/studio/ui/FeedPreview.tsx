"use client";
import { useEffect, useRef, useState } from "react";
import { atFold, captionParts } from "@/lib/content/output";
import { XIcon } from "./icons";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The caption as the feed shows it: one run of text in the reader's weight, line breaks kept,
 * hashtags in the link colour, cut where Facebook cuts it (atFold) with ดูเพิ่มเติม to open the
 * rest in place. The card and the preview both draw it, so they fold at the same character.
 */
export function FeedCaption({ text, className = "" }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const fold = atFold(text);
  const shown = open ? text : fold.shown;
  return (
    <p className={`whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed ${className}`}>
      {captionParts(shown).map((p, i) => (p.tag ? <span key={i} className="text-[var(--ct-accent)]">{p.text}</span> : p.text))}
      {!open && fold.hidden && (
        <>… <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[var(--ct-mute)] hover:underline">ดูเพิ่มเติม</button></>
      )}
    </p>
  );
}

/**
 * The post as a reader meets it in the feed: the Page's line, the caption cut where Facebook
 * cuts it (atFold) with its ดูเพิ่มเติม, and the square poster at the width a phone shows it.
 * The editor showed the words and the poster in two boxes, the poster at 260px, so what the
 * first screen of a post says — the lines above the fold and the picture together — was left
 * to be imagined. Drawn from the draft, unsaved edits included.
 */
export function FeedPreview({ text, poster, onClose }: { text: string; poster: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  const fold = atFold(text);

  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      const root = box.current;
      if (e.key !== "Tab" || !root) return;
      const stops = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (stops.length === 0) return;
      const [first, last] = [stops[0], stops[stops.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = scroll;
      if (back?.isConnected) back.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ct-scrim)] sm:items-center" onClick={onClose}>
      <div
        ref={box} role="dialog" aria-modal="true" aria-label="ตัวอย่างในฟีด" onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-[500px] overflow-y-auto overscroll-contain rounded-t-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] sm:rounded-xl"
      >
        <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ct-solid)] text-sm font-semibold text-[var(--ct-solid-ink)]">เพจ</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold">เพจของคุณ</p>
            <p className="text-xs text-[var(--ct-mute)]">เพิ่งโพสต์ · ตัวอย่าง</p>
          </div>
          <button type="button" data-autofocus onClick={onClose} aria-label="ปิดตัวอย่าง" className="flex size-11 items-center justify-center rounded-lg hover:bg-[var(--ct-ground)]">
            <XIcon className="size-5" />
          </button>
        </div>
        <FeedCaption text={text} className="px-3 pb-3" />
        {/* eslint-disable-next-line @next/next/no-img-element -- the poster route draws it from the draft */}
        <img src={poster} alt="โปสเตอร์ของโพสต์นี้" className="block aspect-square w-full bg-[var(--ct-ground)] object-cover" />
        <p className="px-3 py-2.5 text-xs text-[var(--ct-mute)]">
          {fold.hidden
            ? `คนอ่านเห็น ${[...fold.shown].length} ตัวอักษรแรกก่อนกด “ดูเพิ่มเติม” — ประโยคเปิดควรจบในช่วงนี้`
            : "ข้อความสั้นพอ คนอ่านเห็นทั้งหมดโดยไม่ต้องกด “ดูเพิ่มเติม”"}
        </p>
      </div>
    </div>
  );
}
