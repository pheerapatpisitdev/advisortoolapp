"use client";
import { useEffect, useRef, useState } from "react";

const VIDEO = "/videos/signup-demo.mp4";
const POSTER = "/videos/signup-demo.jpg";

/**
 * The two-minute how-to — levels, signing up, using it, topping up — under the sign-in card
 * (owner, 2026-10-13, option ก of three). A small bar that opens the clip over the page, so the
 * way in stays where it was; the clip is not in the page until the bar is pressed, so the
 * front page loads no faster or slower than before. A native dialog: Esc closes it and focus
 * goes back to the bar.
 */
export function SignupVideo() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-2 pr-3 text-left hover:border-[var(--bot-navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bot-navy)]"
      >
        <span className="relative h-[85px] w-12 shrink-0 overflow-hidden rounded-md bg-[var(--bot-navy)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={POSTER} alt="" width={48} height={85} className="h-full w-full object-cover" />
          {/* the clip opens on a pale screen: a shade under the play mark so it reads */}
          <span aria-hidden="true" className="absolute inset-0 bg-[rgba(2,33,98,0.45)]" />
          <span aria-hidden="true" className="absolute inset-0 m-auto h-0 w-0 translate-x-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-white drop-shadow" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--bot-navy)]">ดูวิธีสมัครและใช้งาน</span>
          <span className="block text-xs text-[var(--bot-ink-mute)]">วิดีโอ 2 นาที · มีเสียงพากย์และซับไทย</span>
        </span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-label="วิดีโอวิธีสมัครและใช้งาน"
          onClose={() => setOpen(false)}
          // a press on the dark around the clip closes it, as the ปิด button does
          onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
          className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-4 backdrop:bg-[rgba(1,10,30,0.88)]"
        >
          <div className="flex h-full flex-col items-center justify-center gap-3" onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
            <video src={VIDEO} poster={POSTER} controls autoPlay playsInline className="max-h-[85dvh] w-auto max-w-full rounded-xl bg-black" />
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full bg-white px-5 py-1.5 text-sm font-medium text-[var(--bot-ink)]">
              ปิด
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
