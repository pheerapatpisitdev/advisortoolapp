import type { CSSProperties } from "react";

/**
 * The classes of the doors' fields and buttons — a plain module, so a server page can use them
 * too: a constant imported from a "use client" file reaches a server component as a client
 * reference, not as the string.
 *
 * Colours are `--field-*` with the site's palette behind them. The doors in use the palette as
 * it is; บัญชีของฉัน sits inside Studio, which has a dark mode of its own, and maps the same
 * names onto Studio's `--ct-*` (STUDIO_FIELDS) so a white box does not glare out of a dark page.
 */

export const INPUT =
  "w-full rounded-lg border border-[var(--field-line,var(--bot-line-strong))] bg-[var(--field-bg,var(--bot-surface))] px-3.5 py-3 text-base text-[var(--field-ink,var(--bot-ink))] placeholder:text-[var(--field-mute,var(--bot-ink-mute))] focus:border-[var(--field-accent,var(--bot-navy))] focus:outline-none focus:ring-2 focus:ring-[var(--field-soft,var(--bot-navy-soft))]";

export const PRIMARY =
  "w-full rounded-lg bg-[var(--field-solid,var(--bot-navy))] px-4 py-3 text-sm font-medium text-[var(--field-solid-ink,var(--bot-surface))] hover:opacity-90 disabled:opacity-50";

export const SECONDARY =
  "block w-full rounded-lg border border-[var(--field-accent,var(--bot-navy))] px-4 py-3 text-center text-sm font-medium text-[var(--field-accent,var(--bot-navy))] no-underline hover:bg-[var(--field-soft,var(--bot-navy-soft))]";

export const MUTE = "text-[var(--field-mute,var(--bot-ink-mute))]";

/** Studio's palette under the field names, for a form inside Studio (see the note above). */
export const STUDIO_FIELDS = {
  "--field-bg": "var(--ct-panel)",
  "--field-line": "var(--ct-line)",
  "--field-ink": "var(--ct-ink)",
  "--field-mute": "var(--ct-mute)",
  "--field-accent": "var(--ct-accent)",
  "--field-soft": "var(--ct-soft)",
  "--field-solid": "var(--ct-solid)",
  "--field-solid-ink": "var(--ct-solid-ink)",
  "--field-alert": "var(--ct-alert)",
  "--field-alert-bg": "var(--ct-alert-bg)",
} as CSSProperties;
