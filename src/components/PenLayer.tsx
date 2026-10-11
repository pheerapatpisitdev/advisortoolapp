"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Sriracha } from "next/font/google";
import { BLUE_PEN, figureWidth, penSvgUri, type PenGeometry, type PenNotes } from "@/app/api/card/table/pen-notes";
import { Highlighted } from "@/components/Highlighted";
import { CARD_PALETTE } from "@/lib/card-theme";

/** the red pen's handwriting, as on the value-table picture (src/app/api/card/table) */
const pen = Sriracha({ weight: "400", subsets: ["thai"], display: "swap" });

export interface PenLayerProps {
  table: RefObject<HTMLTableElement | null>;
  /** every figure the notes may aim at, measured in the table's own font */
  figures: string[];
  /** the notes, worked out in the picture's units from the table as measured */
  notes: (g: PenGeometry) => PenNotes;
  /** page pixels per picture unit: the page's figure size over the picture's 22px */
  scale: number;
  /** the room above the table a note may write into, in page pixels */
  caption: number;
  /** a cell's side padding, in page pixels */
  cellPad: number;
}

/**
 * The pen notes drawn over a table, aimed by measuring it: the column widths off the heading,
 * the heading's height, and the rows' (one height, as the picture's are). The notes are aimed
 * in the picture's pixels, so the page's measures are scaled up into the picture's units, the
 * notes are worked out there, and the drawing is scaled back down. Nothing is drawn until the
 * table has been measured, and it is measured again whenever it changes size.
 *
 * Mount it after the <table>, so the table is there to be measured when the layer first draws.
 */
export function PenLayer({ table, figures, notes, scale, caption, cellPad }: PenLayerProps) {
  const [box, setBox] = useState<{
    widths: number[]; head: number; row: number; width: number; height: number;
    /** each figure's real width on this device, in px: a phone's digits are wider than the estimate */
    figures: Map<string, number>;
  } | null>(null);
  // re-measured when the figures change (a new sum or age), not on every render
  const figuresRef = useRef(figures);
  figuresRef.current = figures;
  const figuresKey = figures.join("|");
  useLayoutEffect(() => {
    const el = table.current;
    if (!el) return;
    const measure = () => {
      const heads = [...(el.tHead?.rows[0]?.cells ?? [])];
      const body = el.tBodies[0];
      if (!heads.length || !body || !body.rows.length) return;
      const head = el.tHead!.getBoundingClientRect().height;
      const row = body.getBoundingClientRect().height / body.rows.length;
      // set in a body cell's own font, numerals and all, and read back
      const probe = document.createElement("span");
      const cell = getComputedStyle(body.rows[0].cells[body.rows[0].cells.length - 1]);
      Object.assign(probe.style, {
        position: "absolute", visibility: "hidden", whiteSpace: "nowrap",
        font: cell.font, fontVariantNumeric: cell.fontVariantNumeric, letterSpacing: cell.letterSpacing,
      });
      document.body.appendChild(probe);
      const widths = new Map<string, number>();
      for (const f of figuresRef.current) {
        if (widths.has(f)) continue;
        probe.textContent = f;
        widths.set(f, probe.getBoundingClientRect().width);
      }
      probe.remove();
      setBox({
        widths: heads.map((h) => h.getBoundingClientRect().width), head, row,
        width: el.offsetWidth, height: head + body.getBoundingClientRect().height, figures: widths,
      });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [table, figuresKey]);
  if (!box) return null;

  const up = (px: number) => px / scale;
  const geo: PenGeometry = {
    widths: box.widths.map(up), caption: up(caption), head: up(box.head), row: up(box.row), cellPad: up(cellPad),
    measure: (f) => (box.figures.has(f) ? up(box.figures.get(f)!) : figureWidth(f)),
  };
  const drawn = notes(geo);
  const width = box.width;
  const height = caption + box.height;
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-[1]" style={{ width, height }}>
      {([[drawn.strokes, CARD_PALETTE.pen], [drawn.blueStrokes, BLUE_PEN]] as const).map(([strokes, ink]) => strokes.length > 0 && (
        <div
          key={ink}
          className="absolute inset-0"
          style={{
            backgroundImage: penSvgUri(strokes, up(width), up(height), ink),
            backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          }}
        />
      ))}
      {drawn.labels.map((l, i) => (
        <span
          key={`${i}:${l.text}`}
          className={`${pen.className} absolute whitespace-nowrap ${l.ink === "blue" ? "" : "text-[var(--lg-pen)]"}`}
          style={{
            ...(l.ink === "blue" ? { color: BLUE_PEN } : {}),
            top: l.top * scale,
            ...(l.left !== undefined ? { left: l.left * scale } : { right: (l.right ?? 0) * scale }),
            fontSize: l.size * scale, lineHeight: 1.5, transform: `rotate(${l.tilt}deg)`,
          }}
        >
          {l.mark ? <Highlighted>{l.text}</Highlighted> : l.text}
        </span>
      ))}
    </div>
  );
}
