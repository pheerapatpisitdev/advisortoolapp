import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { motionBackground, motionBgHeight, motionFrame, type MotionContext } from "@/lib/quote-video/motion";
import { collageDecor, themeBackground, themed, themeHero, type Decor, type Hero } from "@/lib/quote-video/themes";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import { SCRIPT_RANGE, type ClipProps } from "@/lib/quote-video/remotion";
import { KeepWords } from "./KeepWords";
import { readFile } from "./shims/fs";

/**
 * วิดีโอนำเสนอ's Motion Graphic clip drawn by Remotion (owner 2026-10-17; src/lib/quote-video/remotion.ts). The frames are
 * the app's own: motionFrame (motion.tsx) at the scene's time, repainted by themed (themes.tsx),
 * with the theme's hero, cut-outs and ground from the same functions. What the current engine
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

/** the fonts every Remotion clip draws in: the families, and the symbols under each (SYMBOLS) */
export async function loadFonts(): Promise<void> {
  await Promise.all(FONTS.map(async ([family, file, weight]) => {
    const f = new FontFace(family, `url(${staticFile(file)})`, { weight: String(weight) });
    document.fonts.add(await f.load());
  }));
  const families = [...new Set(FONTS.map(([family]) => family))];
  await Promise.all(families.flatMap((family) => [400, 600].map(async (weight) => {
    const f = new FontFace(family, `url(${staticFile(SYMBOLS.file)})`, { weight: String(weight), unicodeRange: SYMBOLS.range });
    document.fonts.add(await f.load());
  })));
}

interface Loaded { hero?: Hero; decor?: Decor; ground: ReactNode }

function useLoaded(p: ClipProps, w: number, h: number): Loaded | null {
  const [handle] = useState(() => delayRender("fonts and pictures"));
  const [got, setGot] = useState<Loaded | null>(null);
  useEffect(() => {
    (async () => {
      await loadFonts();
      // Chinese, Russian, Burmese: the clip's Noto face under each family's own name, for the letters
      // that family has not got, as satori falls back to it; Thai, Latin and the figures stay as they are
      const families = [...new Set(FONTS.map(([family]) => family))];
      await Promise.all((p.scriptFont ?? []).flatMap(({ url, weight }) => families.map(async (family) => {
        const f = new FontFace(family, `url(${/^https?:\/\//.test(url) ? url : staticFile(url)})`, { weight: String(weight), unicodeRange: SCRIPT_RANGE });
        document.fonts.add(await f.load());
      })));
      const bgH = motionBgHeight({ h });
      const [hero, decor, ground] = await Promise.all([
        themeHero(p.theme, p.sex),
        // the cut-outs as the app's pieceFor gave them (links), or the trial's stand-ins (files here)
        p.theme === "collage" ? collageDecor(async (piece, key) => {
          const at = p.pieces[`${key}/${piece}`];
          return at ? (await readFile(/^https?:\/\//.test(at) ? at : `public/${at}`)) as unknown as Buffer : null;
        }, p.facts.coverStyle) : undefined,
        themeBackground(p.theme, { w, h }, bgH),
      ]);
      setGot({ hero, decor, ground: ground ?? motionBackground({ w, h }) });
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
  const drift = motionBgHeight({ h }) - h;
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c: MotionContext = {
      facts: p.facts, narrator: p.narrator, customer: p.customer, contact: p.contact,
      words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec, ...p.shown,
      ...(got.hero ? { hero: got.hero } : {}), ...(got.decor ? { decor: got.decor } : {}),
    };
    // the ground drifts up the scene (down on every other one), as buildJob's crop does
    const y = drift * (s % 2 ? 1 - t / sc.dur : t / sc.dur);
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(TRANSITIONS[sc.key] ?? "fade", t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(TRANSITIONS[next.key] ?? "fade", (T - next.start) / XFADE, w).out;
    return (
      <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", left: 0, top: -y, width: w, display: "flex" }}>{got.ground}</div>
        {/* Thai lines break at spaces only, as satori breaks them (KeepWords; owner chose ก, 2026-10-19) */}
        <KeepWords>{themed(motionFrame(sc.key, c, t), p.theme, t)}</KeepWords>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className="sat" style={{ background: "#000" }}>
      <style>{SATORI_CSS}</style>
      {layers}
      <Audio src={/^https?:\/\//.test(p.audio) ? p.audio : staticFile(p.audio)} />
    </AbsoluteFill>
  );
}
