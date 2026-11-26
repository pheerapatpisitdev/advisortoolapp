/** the script editor's boxes and chips (ScriptEditor, MotionFields): the studio's tokens, one place */

export const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm disabled:opacity-60";
export const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
/** the words of a scene's picture, in characters (checkedPromptStory) */
export const PICTURE_MAX = 300;
