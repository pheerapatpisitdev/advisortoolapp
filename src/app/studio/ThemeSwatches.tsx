"use client";
import { POSTER_THEMES } from "@/lib/card-theme";
import { THEMES, THEME_LABEL, type Theme } from "@/lib/content/poster";

/**
 * The poster's colour themes as swatches to press rather than names to read: twenty names
 * say little, twenty little posters say it all. Each is drawn in the theme's own ground and
 * headline colour, so what is chosen here is what the poster will look like.
 */
/** the create form's extra choice: each writer picks the theme for its own piece */
export const AUTO_THEME = "auto";
export type ThemeChoice = Theme | typeof AUTO_THEME;

/** the AI tile: a wheel of a few of the themes themselves, so no colour is written here */
const AUTO_WHEEL = `conic-gradient(from 200deg, ${(["navy", "emerald", "red", "champagne", "violet", "navy"] as const).map((t) => POSTER_THEMES[t].from).join(", ")})`;

export function ThemeSwatches<V extends ThemeChoice = Theme>({ value, onChange, allowAuto = false }: {
  value: V; onChange: (t: V) => void; allowAuto?: boolean;
}) {
  const auto = value === AUTO_THEME;
  return (
    <div>
      <div role="radiogroup" aria-label="โทนสีโปสเตอร์" className="grid grid-cols-5 gap-2">
        {allowAuto && (
          <button
            type="button" role="radio" aria-checked={auto} aria-label="ให้ AI เลือก" title="ให้ AI เลือกโทนให้แต่ละชิ้น"
            onClick={() => onChange(AUTO_THEME as V)}
            className={`flex aspect-square min-h-tap flex-col items-center justify-center gap-0.5 rounded-md text-[var(--ct-on-scrim)] ${auto ? "ring-2 ring-[var(--ct-solid)] ring-offset-2" : "ring-1 ring-[var(--ct-hair)]"}`}
            style={{ background: AUTO_WHEEL }}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 drop-shadow">
              <path d="M11 4l1.7 4.3L17 10l-4.3 1.7L11 16l-1.7-4.3L5 10l4.3-1.7zM17.5 14.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
            </svg>
            <span className="text-xs font-semibold leading-none drop-shadow">AI</span>
          </button>
        )}
        {THEMES.map((t) => {
          const c = POSTER_THEMES[t];
          const on = value === t;
          return (
            <button
              key={t} type="button" role="radio" aria-checked={on} aria-label={THEME_LABEL[t]} title={THEME_LABEL[t]}
              onClick={() => onChange(t as V)}
              className={`flex aspect-square min-h-tap items-center justify-center rounded-md text-sm font-semibold ${on ? "ring-2 ring-[var(--ct-solid)] ring-offset-2" : "ring-1 ring-[var(--ct-hair)]"}`}
              style={{ background: `linear-gradient(160deg, ${c.from}, ${c.to})`, color: c.headline }}
            >
              {t === "photo" ? (
                // ภาพล้วน: a picture, not a letter on a colour
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M4.5 5.5h15v13h-15zM4.5 15.5l4-4 3.5 3.5 2.5-2.5 5 4.5M15 9.2a.01.01 0 1 0 0 .01" />
                </svg>
              ) : "ก"}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-[var(--ct-mute)]">
        เลือกอยู่: {auto ? "ให้ AI เลือกโทนให้แต่ละชิ้นตามเนื้อหา" : THEME_LABEL[value as Theme]}
      </p>
    </div>
  );
}
