"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motionBody } from "@/lib/prompt-story/motion/layouts";
import type { PromptScene } from "@/lib/prompt-story/types";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";

/**
 * A โมชันกราฟิก scene's small preview beside its words in the script editor (owner, 2026-11-26: free, no voice yet):
 * the very drawing the clip is made with (motion/layouts.tsx motionBody), at the real frame's px, scaled down to the
 * box. A clock plays the scene, holds its end, and plays it again, as the mockup's previews do; with reduced motion it
 * stands still where every word is in. No picture is painted yet, so the layout's own placeholder stands in for it; a
 * device, a library part and the premium card are drawn only when the clip is made, and are said so in words.
 *
 * Only motion/* and types.ts are drawn from: frames.tsx and story.ts would bring every plan's rate tables to the page.
 */

/** a scene's length here: there is no voice to time it by yet */
export const PREVIEW_DUR = 4;
/** played, then held at its end, then again: the mockup's `T % (dur + 1.2)`, held at `dur - 0.6` */
const LOOP = PREVIEW_DUR + 1.2;
const STILL = PREVIEW_DUR - 0.6;
/** the box's width in px per size, as the editor's column sets it; measured once on the page */
export const PREVIEW_W: Record<VideoSize, number> = { portrait: 96, square: 112, landscape: 160 };
const FONT = "https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;800&display=swap";
/** the clock redraws at most this often: a dozen scenes may be on the page */
const FRAME_MS = 1000 / 30;

/** the scene's time `sec` seconds after its preview started */
export const previewTime = (sec: number): number => Math.min(STILL, sec % LOOP);

const REDUCED = "(prefers-reduced-motion: reduce)";
function onReducedChange(then: () => void) {
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(REDUCED) : null;
  mq?.addEventListener("change", then);
  return () => mq?.removeEventListener("change", then);
}
const reducedNow = () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED).matches;

export function MotionPreview({ scene, size, still = false, label = "ภาพตัวอย่างฉาก" }: {
  scene: PromptScene;
  size: VideoSize;
  /** held at its still time, as with reduced motion */
  still?: boolean;
  label?: string;
}) {
  const { w, h } = SIZES[size];
  const reduced = useSyncExternalStore(onReducedChange, reducedNow, () => false);
  const held = still || reduced;
  const [t, setT] = useState(held ? STILL : 0);
  const [width, setWidth] = useState(PREVIEW_W[size]);
  const ref = useRef<HTMLDivElement>(null);
  const drawn = !scene.device && !scene.asset && !scene.showFigure;
  const kind = scene.motion?.kind;

  // the box's width as laid out: the drawing is scaled to it
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (el.clientWidth) setWidth(el.clientWidth);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawn]);

  // the clock: from the start again when the layout changes, and only while the box is on screen
  useEffect(() => {
    if (!drawn) return;
    if (held) {
      setT(STILL);
      return;
    }
    const el = ref.current;
    let shown = true;
    const io = el && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => { shown = entries[entries.length - 1]?.isIntersecting ?? true; })
      : null;
    if (io && el) io.observe(el);
    const start = performance.now();
    let last = -Infinity;
    let raf = requestAnimationFrame(function tick(now) {
      if (shown && now - last >= FRAME_MS) {
        last = now;
        setT(previewTime((now - start) / 1000));
      }
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [drawn, held, kind]);

  const frame = { width: "100%", aspectRatio: `${w} / ${h}` };
  if (!drawn) {
    return (
      <div ref={ref} style={frame} className="flex items-center justify-center rounded-lg border border-dashed border-[var(--ct-line)] bg-[var(--ct-ground)] p-1 text-center text-[11px] leading-tight text-[var(--ct-mute)]">
        {scene.device || scene.asset ? "ระบบวาดตอนสร้างคลิป" : "การ์ดเบี้ยจริง (ระบบวาด)"}
      </div>
    );
  }
  return (
    <>
      <link rel="stylesheet" href={FONT} precedence="default" />
      {/* a ring, not a border: the box is the frame's shape all the way to its edge */}
      <div ref={ref} role="img" aria-label={label} style={{ ...frame, position: "relative", overflow: "hidden" }} className="rounded-lg bg-[var(--ct-ground)] ring-1 ring-[var(--ct-hair)]">
        <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transform: `scale(${(width / w).toFixed(4)})`, transformOrigin: "0 0", pointerEvents: "none" }}>
          {motionBody(scene, { size, dur: PREVIEW_DUR, figure: null }, t)}
        </div>
      </div>
    </>
  );
}
