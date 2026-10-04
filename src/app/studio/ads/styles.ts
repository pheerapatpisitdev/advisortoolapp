/**
 * The class strings Ads Studio's pages share, in Studio's palette (the --ct-* variables of
 * src/app/studio/theme.css). Kept in one place so the list, the room and the editor look alike.
 */

export const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)] disabled:opacity-50";
const button = "min-h-11 rounded-lg px-4 py-2 text-sm disabled:opacity-50";
export const solid = `${button} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`;
export const plain = `${button} border border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]`;
export const card = "rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:p-5";

export const chip = (on: boolean) =>
  `min-h-11 min-w-11 rounded-full border px-3.5 py-1.5 text-sm disabled:opacity-50 ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]"}`;

/** a line that tells something: fine, worth a look, or wrong */
export const TONES = {
  ok: "border-[var(--ct-hair)] bg-[var(--ct-soft)]",
  warn: "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]",
  bad: "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]",
};
