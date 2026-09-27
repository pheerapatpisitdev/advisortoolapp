/**
 * Studio's light and dark, as the owner picks it: อัตโนมัติ follows the device, สว่าง and มืด
 * hold whatever the device says. Kept in this browser only.
 *
 * The choice is written onto <html data-studio-theme="light|dark"> — resolved, never "auto" —
 * and theme.css reads only that. The root layout runs `studioThemeScript` before the first
 * paint, so a dark page does not flash white on its way in; ThemeSwitch keeps it current after.
 * It is set on every page and read only where .content-page is, so the sales pages never see it.
 */

export const STUDIO_THEME_KEY = "studio-theme";

export type StudioThemeChoice = "auto" | "light" | "dark";

export const STUDIO_THEME_CHOICES: readonly StudioThemeChoice[] = ["auto", "light", "dark"];

export function isThemeChoice(v: unknown): v is StudioThemeChoice {
  return typeof v === "string" && (STUDIO_THEME_CHOICES as readonly string[]).includes(v);
}

/** what a choice comes to on a device that is, or is not, set to dark */
export function resolveTheme(choice: StudioThemeChoice, deviceDark: boolean): "light" | "dark" {
  return choice === "auto" ? (deviceDark ? "dark" : "light") : choice;
}

/** the same rule as resolveTheme, inline for the root layout's <head> */
export const studioThemeScript =
  `try{var t=localStorage.getItem("${STUDIO_THEME_KEY}");` +
  `var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);` +
  `document.documentElement.dataset.studioTheme=d?"dark":"light"}catch(e){}`;
