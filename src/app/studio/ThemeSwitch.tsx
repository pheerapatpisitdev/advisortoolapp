"use client";
import { useEffect, useState } from "react";
import { isThemeChoice, resolveTheme, STUDIO_THEME_KEY, type StudioThemeChoice } from "@/lib/content/studio-theme";
import { AutoThemeIcon, MoonIcon, SunIcon } from "./ui/icons";

const OPTIONS: { id: StudioThemeChoice; label: string; Icon: typeof SunIcon }[] = [
  { id: "auto", label: "อัตโนมัติ", Icon: AutoThemeIcon },
  { id: "light", label: "สว่าง", Icon: SunIcon },
  { id: "dark", label: "มืด", Icon: MoonIcon },
];

const DEVICE_DARK = "(prefers-color-scheme: dark)";

/**
 * Studio's light and dark, at the foot of its menu. The page is already the right colour before
 * this renders (the root layout's script); this only changes it, remembers the pick in this
 * browser, and on อัตโนมัติ follows the device when it turns dark at night.
 *
 * Folded to icons (หุบเมนู), the three stand in a column and are named by their titles.
 */
export function ThemeSwitch() {
  const [choice, setChoice] = useState<StudioThemeChoice>("auto");

  useEffect(() => {
    try {
      const kept = localStorage.getItem(STUDIO_THEME_KEY);
      if (isThemeChoice(kept)) setChoice(kept);
    } catch { /* storage unavailable: อัตโนมัติ */ }
  }, []);

  useEffect(() => {
    const device = window.matchMedia(DEVICE_DARK);
    const apply = () => { document.documentElement.dataset.studioTheme = resolveTheme(choice, device.matches); };
    apply();
    if (choice !== "auto") return;
    device.addEventListener("change", apply);
    return () => device.removeEventListener("change", apply);
  }, [choice]);

  function pick(next: StudioThemeChoice) {
    setChoice(next);
    try { localStorage.setItem(STUDIO_THEME_KEY, next); } catch { /* this visit only */ }
  }

  return (
    <div className="mt-auto border-t pt-3" style={{ borderColor: "var(--shell-line)" }}>
      <p className="mb-1.5 px-2 text-[0.7rem] font-medium uppercase tracking-wider rail:sr-only" style={{ color: "var(--shell-mute)" }}>
        การแสดงผล
      </p>
      <div role="radiogroup" aria-label="สีหน้าจอ Studio" className="flex gap-1 rail:flex-col">
        {OPTIONS.map(({ id, label, Icon }) => {
          const on = choice === id;
          return (
            <button
              key={id} type="button" role="radio" aria-checked={on} title={label} onClick={() => pick(id)}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border text-[0.7rem] rail:flex-none"
              style={{
                borderColor: on ? "var(--shell-active)" : "transparent",
                background: on ? "var(--shell-active-bg)" : "transparent",
                color: on ? "var(--shell-active)" : "var(--shell-mute)",
                fontWeight: on ? 600 : 400,
              }}
            >
              <Icon className="size-4" />
              <span className="rail:sr-only">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
