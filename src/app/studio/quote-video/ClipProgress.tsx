"use client";
import { useEffect, useRef, useState } from "react";
import { leftWords, progressView, type ProgressState } from "@/lib/quote-video/progress";

/**
 * The bar on a clip being made (owner, 2026-10-13; mockup https://claude.ai/artifact/G36jyJWaHD7yj248ReEk3E §9):
 * the percentage, the step it is on, and about how long is left. The board asks after the clip
 * every five seconds (useClipWatch); between reads the bar runs on by itself, a second at a time,
 * and never goes back.
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
  const view = progressView(state, Math.max(0, (Math.max(now, readAt) - readAt) / 1000));
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
      <p className="flex justify-between gap-2 text-xs text-[var(--ct-mute)]">
        <span>{view.text}</span>
        {left && <span className="shrink-0">{left}</span>}
      </p>
    </div>
  );
}
