import type { ReactNode } from "react";
import { STROKE_PATHS, STROKE_VIEWBOX } from "@/lib/highlighter";

/**
 * A figure with a yellow highlighter stroke behind it — the page's half of what the quote card
 * draws with `mark`. The stroke is the shared shape, filled with the palette's token so the
 * colour stays in globals.css. The ink is navy whatever the surrounding text is, since a light
 * figure on yellow is unreadable.
 *
 * Drawn as an inline SVG, not as a CSS mask over a yellow box: an iPhone saving the page as a
 * PDF dropped the mask and printed the stroke as a black block, with the navy figure lost
 * inside it. An SVG fill is ordinary ink to every print path, so it also survives a print
 * dialog with background graphics switched off.
 */
export function Highlighted({ children }: { children: ReactNode }) {
  return (
    <span className="relative isolate inline-block px-1 text-[var(--bot-navy)]">
      <svg
        aria-hidden
        viewBox={STROKE_VIEWBOX}
        preserveAspectRatio="none"
        className="absolute -inset-x-1.5 -inset-y-0.5 -z-10 h-[calc(100%+0.25rem)] w-[calc(100%+0.75rem)] fill-[var(--bot-highlighter)]"
      >
        {STROKE_PATHS.map((p) => <path key={p.d} fillOpacity={p.opacity} d={p.d} />)}
      </svg>
      {children}
    </span>
  );
}
