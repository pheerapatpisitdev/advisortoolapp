import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fhcFrame, fhcRoom } from "@/lib/quote-video/fhc-motion";
import { wideFhcFrame } from "@/lib/quote-video/wide";
import { motionBackground, motionBgHeight } from "@/lib/quote-video/motion";
import { themeBackground, themed } from "@/lib/quote-video/themes";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import { stickerAt, stickerOf, type Sticker } from "@/lib/collage/decor";
import type { FhcClipProps } from "@/lib/quote-video/remotion";
import type { FhcSceneKey } from "@/lib/quote-video/fhc";
import { crossing, loadFonts, SATORI_CSS } from "./Clip";
import { KeepWords } from "./KeepWords";
import { readFile } from "./shims/fs";

/**
 * An FHC summary drawn by Remotion (src/lib/quote-video/remotion.ts FhcClipProps): the app's own fhcFrame (portrait)
 * or wideFhcFrame (square, landscape) at the scene's time, repainted by themed, over the theme's ground drifting as
 * buildJob's crop does; คอลลาจ's picked pieces in a portrait clip's free room, as make.ts fhcDecor lays them.
 */

export type { FhcClipProps };

interface Loaded { ground: ReactNode; stickers: Map<FhcSceneKey, Sticker> }

function useLoaded(p: FhcClipProps, w: number, h: number): Loaded | null {
  const [handle] = useState(() => delayRender("fonts, ground and pieces"));
  const [got, setGot] = useState<Loaded | null>(null);
  useEffect(() => {
    (async () => {
      await loadFonts();
      const stickers = new Map<FhcSceneKey, Sticker>();
      await Promise.all(Object.entries(p.picks ?? {}).map(async ([key, at]) => {
        if (!at) return;
        const st = await stickerOf((await readFile(/^https?:\/\//.test(at) ? at : `public/${at}`)) as unknown as Buffer);
        // the frames draw it with a plain <img>: decoded first, so it is there in the first frame it shows
        const img = new Image();
        img.src = st.uri;
        await img.decode();
        stickers.set(key as FhcSceneKey, st);
      }));
      const ground = await themeBackground(p.theme, { w, h }, motionBgHeight({ h }));
      setGot({ ground: ground ?? motionBackground({ w, h }), stickers });
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
  const drift = motionBgHeight({ h }) - h;
  const decor = got.stickers.size
    ? (key: FhcSceneKey, t: number) => {
      const st = got.stickers.get(key);
      const room = st ? fhcRoom(key, p.facts, { customer: p.customer, contact: p.contact }) : null;
      return st && room ? stickerAt(st, room, t) : null;
    }
    : undefined;
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c = { facts: p.facts, narrator: p.narrator, customer: p.customer, contact: p.contact, words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec };
    const y = drift * (s % 2 ? 1 - t / sc.dur : t / sc.dur);
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(TRANSITIONS[sc.key] ?? "fade", t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(TRANSITIONS[next.key] ?? "fade", (T - next.start) / XFADE, w).out;
    const body = p.size === "portrait" ? fhcFrame(sc.key, { ...c, ...(decor ? { decor } : {}) }, t) : wideFhcFrame(sc.key, c, t, p.size);
    return (
      <AbsoluteFill key={sc.key} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", left: 0, top: -y, width: w, display: "flex" }}>{got.ground}</div>
        <KeepWords>{themed(body, p.theme, t)}</KeepWords>
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
