import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fhcFrame } from "@/lib/quote-video/fhc-motion";
import { wideFhcFrame } from "@/lib/quote-video/wide";
import { motionBackground, motionBgHeight } from "@/lib/quote-video/motion";
import { themeBackground, themed } from "@/lib/quote-video/themes";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import { festivalBack, festivalFront } from "@/lib/quote-video/festival-decor";
import type { FhcClipProps } from "@/lib/quote-video/remotion";
import { crossing, loadFonts, SATORI_CSS } from "./Clip";
import { KeepWords } from "./KeepWords";

/**
 * An FHC summary drawn by Remotion (src/lib/quote-video/remotion.ts FhcClipProps): the app's own fhcFrame (portrait)
 * or wideFhcFrame (square, landscape) at the scene's time, repainted by themed, over the theme's ground drifting as
 * buildJob's crop does.
 */

export type { FhcClipProps };

interface Loaded { ground: ReactNode }

function useLoaded(p: FhcClipProps, w: number, h: number): Loaded | null {
  const [handle] = useState(() => delayRender("fonts and ground"));
  const [got, setGot] = useState<Loaded | null>(null);
  useEffect(() => {
    (async () => {
      await loadFonts();
      const ground = await themeBackground(p.theme, { w, h }, motionBgHeight({ h }), p.festival?.key);
      setGot({ ground: ground ?? motionBackground({ w, h }) });
      continueRender(handle);
    })().catch((e) => { console.error(e); throw e; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return got;
}

export function FhcClip(p: FhcClipProps) {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const got = useLoaded(p, w, h);
  if (!got) return null;
  const T = frame / fps;
  const fest = p.theme === "festival" ? p.festival : undefined;
  const drift = motionBgHeight({ h }) - h;
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c = { facts: p.facts, narrator: p.narrator, customer: p.customer, contact: p.contact, words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec };
    const y = drift * (s % 2 ? 1 - t / sc.dur : t / sc.dur);
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(TRANSITIONS[sc.key] ?? "fade", t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(TRANSITIONS[next.key] ?? "fade", (T - next.start) / XFADE, w).out;
    const body = p.size === "portrait" ? fhcFrame(sc.key, c, t) : wideFhcFrame(sc.key, c, t, p.size);
    return (
      <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", left: 0, top: -y, width: w, display: "flex" }}>{got.ground}</div>
        {fest ? festivalBack(fest.key, T, w, h) : null}
        <KeepWords>{themed(body, p.theme, p.festival?.key)}</KeepWords>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className="sat" style={{ background: "#000" }}>
      <style>{SATORI_CSS}</style>
      {/* ธีมเทศกาล (festival-decor.tsx): its decorations go in each scene's layer, its greeting over all */}
      {layers}
      {fest ? festivalFront(fest.key, fest.greeting, w, h) : null}
      <Audio src={/^https?:\/\//.test(p.audio) ? p.audio : staticFile(p.audio)} />
    </AbsoluteFill>
  );
}
