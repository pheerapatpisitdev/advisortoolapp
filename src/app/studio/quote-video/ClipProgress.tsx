"use client";
import { useEffect, useRef, useState } from "react";
import { clipSteps, leftWords, progressView, type ClipStep, type ProgressState } from "@/lib/quote-video/progress";

/**
 * The bar on a clip being made (owner, 2026-10-13; mockup https://claude.ai/artifact/G36jyJWaHD7yj248ReEk3E §9):
 * the percentage, the step it is on, and about how long is left. The board asks after the clip
 * every five seconds (useClipWatch); between reads the bar runs on by itself, a second at a time,
 * and never goes back. Under it, the four steps: done, in hand with its count, still to come (owner chose ก,
 * 2026-11-18, mockup https://claude.ai/artifact/9myAYjr7t5gxKQYicUEcsz) — still, no moving picture.
 */
export function ClipProgress({ state }: { state: ProgressState }) {
  // when this reading arrived, noted in the same render it arrives in: the bar runs on from it
  const read = useRef({ state, at: Date.now() });
  if (read.current.state !== state) read.current = { state, at: Date.now() };
  const readAt = read.current.at;
  const [now, setNow] = useState(() => Date.now());
  const most = useRef(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const later = Math.max(0, (Math.max(now, readAt) - readAt) / 1000);
  const view = progressView(state, later);
  const steps = clipSteps(state, later);
  most.current = Math.max(most.current, view.pct);
  const pct = most.current;
  const left = leftWords(view.leftSec);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <div
          role="progressbar" aria-label="ความคืบหน้าการสร้างวิดีโอ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--ct-soft)]"
        >
          <div className="h-full rounded-full bg-[var(--ct-solid)] motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      {left && <p className="text-right text-xs text-[var(--ct-mute)]">{left}</p>}
      <ul className="divide-y divide-[var(--ct-line)] border-t border-[var(--ct-line)]">
        {steps.map((s) => <StepRow key={s.label} step={s} />)}
      </ul>
    </div>
  );
}

function StepRow({ step }: { step: ClipStep }) {
  const tone = step.state === "wait" ? "text-[var(--ct-mute)]" : step.state === "now" ? "font-semibold" : "";
  return (
    <li className={`flex items-center gap-2.5 py-2 text-sm ${tone}`}>
      {step.state === "ok" ? (
        <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-full bg-[var(--bot-ok)]">
          <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-[var(--bot-ok-soft)]" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>
        </span>
      ) : step.state === "now" ? (
        <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-[var(--ct-solid)]">
          <span className="size-1.5 rounded-full bg-[var(--ct-solid)]" />
        </span>
      ) : (
        <span aria-hidden className="size-[18px] shrink-0 rounded-full border-2 border-[var(--ct-line)]" />
      )}
      <span>{step.label}</span>
      <span className="sr-only">{step.state === "ok" ? "เสร็จแล้ว" : step.state === "now" ? "กำลังทำ" : "รอ"}</span>
      {step.count && <span className="ml-auto text-xs font-normal tabular-nums text-[var(--ct-mute)]">{step.count}</span>}
    </li>
  );
}
