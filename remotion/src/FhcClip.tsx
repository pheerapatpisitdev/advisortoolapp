import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fhcFrame } from "@/lib/quote-video/fhc-motion";
import { wideFhcFrame } from "@/lib/quote-video/wide";
import { motionBackground, motionBgHeight } from "@/lib/quote-video/motion";
import { lookOf, mineFront, themeBackground, themed } from "@/lib/quote-video/themes";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import { festivalBack, festivalFront } from "@/lib/quote-video/festival-decor";
import { kineticFrame } from "@/lib/quote-video/kinetic";
import { mascotFront } from "@/lib/quote-video/mascot";
import type { FhcClipProps } from "@/lib/quote-video/remotion";
import { crossing, loadFonts, SATORI_CSS } from "./Clip";
import { FxSound } from "./Fx";
import { setFxBlur } from "@/lib/quote-video/motion";
import { transitionOf } from "@/lib/quote-video/fx";
import { fhcCues } from "@/lib/quote-video/fx-cues";
import { fxIcon, iconFor } from "@/lib/quote-video/fx-icons";
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
      const ground = await themeBackground(p.theme, { w, h }, motionBgHeight({ h }), lookOf(p));
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
  // ลูกเล่นคลิปใหม่ (fx.ts): set for every frame, so a summary without it draws exactly as before
  setFxBlur(Boolean(p.fx));
  if (!got) return null;
  const T = frame / fps;
  const fest = p.theme === "festival" ? p.festival : undefined;
  const now = [...p.scenes].reverse().find((sc) => sc.start <= T);
  const drift = motionBgHeight({ h }) - h;
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c = { facts: p.facts, narrator: p.narrator, customer: p.customer, contact: p.contact, words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec };
    const y = drift * (s % 2 ? 1 - t / sc.dur : t / sc.dur);
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(transitionOf(sc.key, Boolean(p.fx), TRANSITIONS), t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(transitionOf(next.key, Boolean(p.fx), TRANSITIONS), (T - next.start) / XFADE, w).out;
    const icon = p.fx && p.size === "portrait" ? iconFor("FHC", sc.key) : null;
    const frameOf = p.size === "portrait" ? fhcFrame(sc.key, c, t) : wideFhcFrame(sc.key, c, t, p.size);
    // ลูกเล่นคลิปใหม่'s icon, in the frame so the theme repaints it with the rest (fx-icons.tsx)
    const body = icon ? <div style={{ display: "flex", position: "relative", width: w, height: h }}>{frameOf}{fxIcon(icon, t)}</div> : frameOf;
    // ตัวหนังสือเด้ง (kinetic.tsx): the scene's spoken words alone, in place of its drawing
    if (p.theme === "kinetic") {
      return (
        <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
          {kineticFrame({ voice: sc.voice, voiceSec: sc.voiceSec, index: s, header: "สรุปสุขภาพการเงิน", ...(sc.key === "fhcContact" ? { contact: p.contact } : {}) }, t, w, h)}
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", left: 0, top: -y, width: w, display: "flex" }}>{got.ground}</div>
        {fest ? festivalBack(fest.key, T, w, h) : null}
        <KeepWords>{themed(body, p.theme, lookOf(p))}</KeepWords>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className="sat" style={{ background: "#000" }}>
      <style>{SATORI_CSS}</style>
      {/* ธีมเทศกาล (festival-decor.tsx): its decorations go in each scene's layer, its greeting over all */}
      {layers}
      {/* น้องโล่ (mascot.tsx) in the scene now on */}
      {p.mascot && p.theme !== "kinetic" && now ? mascotFront(now.key, T - now.start, T, w, h) : null}
      {fest ? festivalFront(fest.key, fest.greeting, w, h) : null}
      {p.theme === "mine" && p.myColor ? mineFront(p.myColor, p.contact, w, h) : null}
      <Audio src={/^https?:\/\//.test(p.audio) ? p.audio : staticFile(p.audio)} />
      {p.fx ? <FxSound music={p.fx.music} cues={fhcCues(p.scenes, p.size === "portrait" && p.theme !== "kinetic")} scenes={p.scenes} total={p.total} fps={fps} /> : null}
    </AbsoluteFill>
  );
}
