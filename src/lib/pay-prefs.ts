import type { PayMode } from "@/calc/types";

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14, ข ก ก on mockup https://claude.ai/artifact/VKTji2SfSz7cCXiCQKJCf4):
 * which instalments an agent's own quotes show. Many agents' customers did not want to see a
 * monthly premium, so each agent may switch off รายเดือน and ราย 6 เดือน for everything they make
 * by hand — the calculators, the copied text, the pictures, the PDF and the วิดีโอนำเสนอ.
 * The customer bots are not covered (they answer for a Page, not for one agent).
 *
 * Yearly is always shown: it is the price every other figure is worked out from.
 *
 * Plain values only: the calculators are client components and import this file.
 */
export interface PayPrefs {
  monthly: boolean;
  semi: boolean;
}

/** Everything on, as the app was before the setting: an agent who never opens it sees no change. */
export const DEFAULT_PAY_PREFS: PayPrefs = { monthly: true, semi: true };

/** The instalments an agent has switched off, in a fixed order. */
export function hiddenModes(p: PayPrefs): PayMode[] {
  return [...(p.semi ? [] : ["semi" as const]), ...(p.monthly ? [] : ["monthly" as const])];
}

/** Whether an instalment may be shown. */
export const shows = (hide: readonly PayMode[], mode: PayMode): boolean => mode === "annual" || !hide.includes(mode);

/**
 * The instalments left to show. Undefined stays undefined (the arrangement could not be priced),
 * so every caller keeps telling "no price" apart from "no instalment".
 */
export function showModes<T extends { mode: PayMode }>(modes: T[], hide: readonly PayMode[]): T[];
export function showModes<T extends { mode: PayMode }>(modes: T[] | undefined, hide: readonly PayMode[]): T[] | undefined;
export function showModes<T extends { mode: PayMode }>(modes: T[] | undefined, hide: readonly PayMode[]): T[] | undefined {
  if (!modes || hide.length === 0) return modes;
  return modes.filter((m) => shows(hide, m.mode));
}

/**
 * The query key a link carries the setting under, so a picture, a PDF or a printed page drawn
 * with nobody signed in (a customer opening the link, the PDF printer) shows what the agent
 * chose. "hide=semi.monthly"; nothing at all when everything is shown, so existing links keep
 * their address.
 */
export const HIDE_KEY = "hide";

export function hideParam(hide: readonly PayMode[]): string | undefined {
  const parts = (["semi", "monthly"] as const).filter((m) => hide.includes(m));
  return parts.length ? parts.join(".") : undefined;
}

export function writeHide(q: URLSearchParams, hide: readonly PayMode[] | undefined): void {
  const v = hide ? hideParam(hide) : undefined;
  if (v) q.set(HIDE_KEY, v);
}

/** What a link asks to hide; anything unreadable hides nothing. */
export function readHide(raw: string | string[] | null | undefined): PayMode[] {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return [];
  const parts = v.split(".");
  if (!parts.every((p) => p === "semi" || p === "monthly")) return [];
  return (["semi", "monthly"] as const).filter((m) => parts.includes(m));
}
