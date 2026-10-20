import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { motionBackground, motionBgHeight, motionFrame, type MotionContext } from "@/lib/quote-video/motion";
import { wideQuoteFrame } from "@/lib/quote-video/wide";
import { lookFill, lookOf, mineFront, themeBackground, themed, themeHero, type Hero } from "@/lib/quote-video/themes";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import { festivalBack, festivalFront } from "@/lib/quote-video/festival-decor";
import { kineticFrame } from "@/lib/quote-video/kinetic";
import { mascotFront } from "@/lib/quote-video/mascot";
import { carryFront } from "@/lib/quote-video/carry";
import { chatFrame } from "@/lib/quote-video/chat";
import { SCRIPT_RANGE, type ClipProps } from "@/lib/quote-video/remotion";
import { KeepWords } from "./KeepWords";

/**
 * วิดีโอนำเสนอ's Motion Graphic clip drawn by Remotion (owner 2026-10-17; src/lib/quote-video/remotion.ts). The frames are
 * the app's own: motionFrame (motion.tsx) at the scene's time, repainted by themed (themes.tsx),
 * with the theme's hero and ground from the same functions. What the current engine
 * does in ffmpeg — the ground drifting under each scene, the cross-fades — is done here, at every
 * one of the 30 frames a second rather than 12.
 */

export type { ClipProps };

/** satori lays every box out as a flex box (yoga): Chrome is told the same, so the positions match */
export const SATORI_CSS = `
.sat div, .sat span { display: flex; position: relative; box-sizing: border-box; min-width: 0; min-height: 0; }
.sat { font-synthesis: none; -webkit-font-smoothing: antialiased; }
`;
export const FONTS: [string, string, number][] = [
  ["Plex", "fonts/IBMPlexSansThai-Regular.ttf", 400], ["Plex", "fonts/IBMPlexSansThai-SemiBold.ttf", 600],
  ["Mali", "fonts/Mali-400.ttf", 400], ["Mali", "fonts/Mali-600.ttf", 600], ["Sriracha", "fonts/Sriracha-400.ttf", 400],
];

/**
 * The symbols satori takes from Noto Sans Symbols 2 for letters the card's fonts lack (draw-png.ts FALLBACK) —
 * ☐ ✓ ✗ ★ and the like: the same face here, under each family's name for those letters only, at both weights,
 * so Chrome draws them as satori does rather than in whatever face the machine has.
 */
const SYMBOLS = { file: "fonts/NotoSansSymbols2-400.ttf", range: "U+2190-21FF, U+2300-23FF, U+2460-24FF, U+25A0-27BF, U+2900-297F, U+2B00-2BFF, U+1F100-1F1FF" };

/**
 * the fonts every Remotion clip draws in, in satori's order of fallback. Chrome tries a family's faces last-added
 * first and moves on when a face lacks the letter, so each family gets, added in this order: Noto Sans Symbols 2 for
 * the symbol ranges (SYMBOLS), then Plex under its name (satori's next font for a letter Mali or Sriracha lacks,
 * such as ✓), then its own faces. A letter the family has is drawn in it, ✓ in a Mali line in Plex, ☐ in Symbols 2.
 */
export async function loadFonts(): Promise<void> {
  const families = [...new Set(FONTS.map(([family]) => family))];
  const plex = FONTS.filter(([family]) => family === "Plex");
  const face = (family: string, file: string, weight: number, unicodeRange?: string) =>
    new FontFace(family, `url(${staticFile(file)})`, { weight: String(weight), ...(unicodeRange ? { unicodeRange } : {}) }).load();
  const symbols = await Promise.all(families.flatMap((family) => [400, 600].map((weight) => face(family, SYMBOLS.file, weight, SYMBOLS.range))));
  const plexUnder = await Promise.all(families.filter((family) => family !== "Plex").flatMap((family) => plex.map(([, file, weight]) => face(family, file, weight))));
  const own = await Promise.all(FONTS.map(([family, file, weight]) => face(family, file, weight)));
  for (const f of [...symbols, ...plexUnder, ...own]) document.fonts.add(f);
}

/**
 * Chinese, Russian, Burmese: the clip's Noto face under each family's own name, for the letters that family has
 * not got, as satori falls back to it; Thai, Latin and the figures stay as they are
 */
export async function loadScriptFonts(scriptFont?: { url: string; weight: number }[]): Promise<void> {
  const families = [...new Set(FONTS.map(([family]) => family))];
  await Promise.all((scriptFont ?? []).flatMap(({ url, weight }) => families.map(async (family) => {
    const f = new FontFace(family, `url(${/^https?:\/\//.test(url) ? url : staticFile(url)})`, { weight: String(weight), unicodeRange: SCRIPT_RANGE });
    document.fonts.add(await f.load());
  })));
}

interface Loaded { hero?: Hero; ground: ReactNode }

function useLoaded(p: ClipProps, w: number, h: number): Loaded | null {
  const [handle] = useState(() => delayRender("fonts and pictures"));
  const [got, setGot] = useState<Loaded | null>(null);
  useEffect(() => {
    (async () => {
      await loadFonts();
      await loadScriptFonts(p.scriptFont);
      const bgH = motionBgHeight({ h });
      const [hero, ground] = await Promise.all([themeHero(p.theme, p.sex), themeBackground(p.theme, { w, h }, bgH, lookOf(p))]);
      setGot({ hero, ground: ground ?? motionBackground({ w, h }) });
      continueRender(handle);
    })().catch((e) => { console.error(e); throw e; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return got;
}

/** ffmpeg's xfade, as job.ts names it per scene: how the outgoing and incoming scenes look at q (0 → 1) */
export function crossing(kind: string, q: number, w: number): { out: CSSProperties; in: CSSProperties } {
  switch (kind) {
    case "slideleft": return { out: { transform: `translateX(${-q * w}px)` }, in: { transform: `translateX(${(1 - q) * w}px)` } };
    case "zoomin": {
      // ffmpeg: the first zooms to 2× over the first half, then the second fades in over it
      const zoom = 1 / Math.max(1 - q, 0.5);
      const x = Math.min(1, Math.max(0, (q - 0.5) / 0.5));
      return { out: { transform: `scale(${zoom})` }, in: { opacity: x * x * (3 - 2 * x) } };
    }
    default: return { out: {}, in: { opacity: q } };
  }
}

export function Clip(p: ClipProps) {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const got = useLoaded(p, w, h);
  if (!got) return null;
  const T = frame / fps;
  const fest = p.theme === "festival" ? p.festival : undefined;
  const now = [...p.scenes].reverse().find((sc) => sc.start <= T);
  // แชทถาม-ตอบ (chat.tsx): one conversation over the whole clip, a ติ๊ง as each question comes in
  if (p.theme === "chat") {
    return (
      <AbsoluteFill className="sat" style={{ background: "#000" }}>
        <style>{SATORI_CSS}</style>
        {chatFrame({ facts: p.facts, sex: p.sex, contact: p.contact, scenes: p.scenes }, T, w, h)}
        <Audio src={/^https?:\/\//.test(p.audio) ? p.audio : staticFile(p.audio)} />
        {p.scenes.map((sc) => (
          <Sequence key={sc.key + sc.start} from={Math.round(sc.start * fps)} durationInFrames={Math.round(0.6 * fps)}>
            <Audio src={staticFile("video/ding.wav")} volume={0.5} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  }
  const drift = motionBgHeight({ h }) - h;
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c: MotionContext = {
      facts: p.facts, narrator: p.narrator, customer: p.customer, contact: p.contact,
      words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec, ...p.shown,
      ...(got.hero ? { hero: got.hero } : {}),
    };
    // the ground drifts up the scene (down on every other one), as buildJob's crop does
    const y = drift * (s % 2 ? 1 - t / sc.dur : t / sc.dur);
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(TRANSITIONS[sc.key] ?? "fade", t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(TRANSITIONS[next.key] ?? "fade", (T - next.start) / XFADE, w).out;
    // ตัวหนังสือเด้ง (kinetic.tsx): the scene's spoken words alone, in place of its drawing
    if (p.theme === "kinetic") {
      return (
        <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
          {kineticFrame({ voice: sc.voice, voiceSec: sc.voiceSec, index: s, header: p.facts.planLine, ...(sc.key === "contact" ? { contact: p.contact } : {}) }, t, w, h)}
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", left: 0, top: -y, width: w, display: "flex" }}>{got.ground}</div>
        {fest ? festivalBack(fest.key, T, w, h) : null}
        {/* Thai lines break at spaces only, as satori breaks them (KeepWords; owner chose ก, 2026-10-19) */}
        <KeepWords>{themed(p.size && p.size !== "portrait" ? wideQuoteFrame(sc.key, c, t, p.size) : motionFrame(sc.key, c, t), p.theme, lookOf(p))}</KeepWords>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className="sat" style={{ background: "#000" }}>
      <style>{SATORI_CSS}</style>
      {/* ธีมเทศกาล (festival-decor.tsx): its decorations go in each scene's layer, its greeting over all */}
      {layers}
      {/* the next scene's figure carried over each join (carry.tsx), and น้องโล่ (mascot.tsx) in the scene now on */}
      {p.carry && p.theme !== "kinetic" ? carryFront(p.scenes, p.facts, T, w, h, lookFill(p.theme, lookOf(p))) : null}
      {p.mascot && p.theme !== "kinetic" && now ? mascotFront(now.key, T - now.start, T, w, h) : null}
      {fest ? festivalFront(fest.key, fest.greeting, w, h) : null}
      {p.theme === "mine" && p.myColor ? mineFront(p.myColor, p.contact, w, h) : null}
      <Audio src={/^https?:\/\//.test(p.audio) ? p.audio : staticFile(p.audio)} />
    </AbsoluteFill>
  );
}
