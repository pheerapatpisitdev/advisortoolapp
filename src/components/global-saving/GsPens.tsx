"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { Sriracha } from "next/font/google";
import { BLUE_PEN } from "@/lib/card-theme";
import type { Box, PenDrawing } from "@/lib/global-saving-pens";

/** the pen's handwriting, the same face the other plans' tables are annotated in */
const pen = Sriracha({ weight: "400", subsets: ["thai"], display: "swap" });

const INK = { red: "var(--lg-pen)", blue: BLUE_PEN } as const;

/** a box relative to the layer's own corner */
export function boxIn(el: Element, origin: Element): Box {
  const a = el.getBoundingClientRect(), o = origin.getBoundingClientRect();
  return { x: a.left - o.left, y: a.top - o.top, w: a.width, h: a.height };
}

/** the box of the figure a cell shows, not of the cell — null when the cell is empty or a dash */
export function textIn(cell: Element, origin: Element): Box | null {
  // a dash is "no bonus this time", not a figure to mark
  const t = cell.textContent?.trim();
  if (!t || t === "—") return null;
  const r = document.createRange();
  r.selectNodeContents(cell);
  const a = r.getBoundingClientRect(), o = origin.getBoundingClientRect();
  return { x: a.left - o.left, y: a.top - o.top, w: a.width, h: a.height };
}

/**
 * Draws a PenDrawing over `over`, worked out by `draw` from the boxes it measures there. Drawn
 * after the first measure and again whenever the element changes size or its fonts arrive, so
 * a new premium, a narrower screen or the handwriting loading late all land the marks right.
 *
 * Mount it inside a `relative` box that also holds `over`.
 */
export function GsPens({ over, draw, deps }: { over: RefObject<HTMLElement | null>; draw: (el: HTMLElement) => PenDrawing | null; deps: string }) {
  const [drawn, setDrawn] = useState<{ pens: PenDrawing; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = over.current;
    if (!el) return;
    const run = () => {
      const pens = draw(el);
      setDrawn(pens ? { pens, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    run();
    const watch = new ResizeObserver(run);
    watch.observe(el);
    let live = true;
    document.fonts?.ready.then(() => { if (live) run(); });
    return () => { live = false; watch.disconnect(); };
    // `draw` is rebuilt every render; what it draws changes only with `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, deps]);
  if (!drawn) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-[1] print:[print-color-adjust:exact]" style={{ width: drawn.w, height: drawn.h }}>
      <svg width={drawn.w} height={drawn.h} className="absolute inset-0 overflow-visible">
        {drawn.pens.strokes.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={INK[s.ink]} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {drawn.pens.labels.map((l, i) => (
        <div
          key={`${i}:${l.lines[0]}`}
          className={`${pen.className} absolute whitespace-nowrap text-sm leading-tight`}
          style={{
            color: INK[l.ink], left: l.x, top: l.y,
            transform: `rotate(${l.tilt}deg)${l.alignRight ? " translateX(-100%)" : ""}`,
            transformOrigin: "0 0", textAlign: l.alignRight ? "right" : "left",
          }}
        >
          {l.lines.map((line) => <div key={line}>{line}</div>)}
        </div>
      ))}
    </div>
  );
}
