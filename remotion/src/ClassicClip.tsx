import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { sceneLayer, tableImage, type DrawContext, type Layer } from "@/lib/quote-video/draw";
import { wideSceneLayer } from "@/lib/quote-video/classic-wide";
import { pensionTableImage } from "@/lib/quote-video/pension-table";
import { gsTableImage } from "@/lib/quote-video/gsaving-table";
import { noteDrawing } from "@/lib/quote-video/table-pen";
import { CLASSIC_BOXES } from "@/lib/quote-video/table-geo";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE, type OverlayState, type TableMove } from "@/lib/quote-video/timeline";
import type { ClassicClipProps } from "@/lib/quote-video/remotion";
import { crossing, loadFonts, loadScriptFonts, SATORI_CSS } from "./Clip";
import { FxSound } from "./Fx";
import { transitionOf } from "@/lib/quote-video/fx";
import { classicCues } from "@/lib/quote-video/fx-cues";
import { KeepWords } from "./KeepWords";

/**
 * A แบบปกติ clip drawn by Remotion (src/lib/quote-video/remotion.ts ClassicClipProps), layer for layer as buildJob
 * lays it in ffmpeg: the scene's base; the family photo (public/card/family.jpg) cover-cut to its box and pushed in
 * 1.00 → 1.12 as the zoompan does, or the value table in its window, moved as tableY says, with each finished pen
 * note on it from when it is done; then the overlay of the moment, each frame's state held until the next.
 */

export type { ClassicClipProps };

/** the photo the lead and a looping close carry (make.ts cutClip's family) */
const FAMILY = "card/family.jpg";

/** how far down the table stands at t: as the old ffmpeg cut moved it (tableY), each move eased in and out from where the last left it */
export function tableAt(moves: TableMove[], t: number): number {
  let from = 0;
  let y = 0;
  for (const m of moves) {
    const q = Math.min(1, Math.max(0, (t - m.at) / m.dur));
    y += (m.to - from) * (3 * q * q - 2 * q * q * q);
    from = m.to;
  }
  return y;
}

/** the overlay frame shown at scene time t: the last whose time has come (concatList holds each to the next) */
function stateAt(frames: { t: number; state: OverlayState }[], t: number): OverlayState | undefined {
  let at: OverlayState | undefined;
  for (const f of frames) if (f.t <= t + 1e-6) at = f.state;
  return at ?? frames[0]?.state;
}

function useReady(p: ClassicClipProps): boolean {
  const [handle] = useState(() => delayRender("fonts and pictures"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      await loadFonts();
      await loadScriptFonts(p.scriptFont);
      // the agent's photo on the card is drawn with a plain <img>: decoded before the first frame
      if (p.contact.photo) {
        const img = new Image();
        img.src = p.contact.photo;
        await img.decode();
      }
      setReady(true);
      continueRender(handle);
    })().catch((e) => { console.error(e); throw e; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

export function ClassicClip(p: ClassicClipProps) {
  const frame = useCurrentFrame();
  const { fps, width: w } = useVideoConfig();
  const ready = useReady(p);
  const table = useMemo(() => (p.facts.pension ? pensionTableImage(p.facts) : p.facts.gsaving ? gsTableImage(p.facts) : tableImage(p.facts)), [p.facts]);
  if (!ready) return null;
  const T = frame / fps;
  const boxes = CLASSIC_BOXES[p.size];
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c: DrawContext = {
      facts: p.facts, narrator: p.narrator, customer: p.customer, contact: p.contact, ...(p.chart ? { chart: p.chart } : {}),
      words: sc.voice.split(" ").filter(Boolean), ...(p.notes && sc.layer === "table" ? { notes: p.notes } : {}), ...p.shown,
    };
    const draw = (which: Layer, state?: OverlayState) => (p.size === "portrait" ? sceneLayer(sc.key, c, which, state) : wideSceneLayer(sc.key, c, which, p.size, state));
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(transitionOf(sc.key, Boolean(p.fx), TRANSITIONS), t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(transitionOf(next.key, Boolean(p.fx), TRANSITIONS), (T - next.start) / XFADE, w).out;
    const win = boxes.table;
    const y = sc.table ? tableAt(sc.table.moves, t) : 0;
    return (
      <AbsoluteFill key={`${sc.key}-${s}`} style={{ overflow: "hidden", ...style }}>
        <KeepWords>{draw("base")}</KeepWords>
        {sc.layer === "photo" ? (
          <div style={{ position: "absolute", left: boxes.photo.x, top: boxes.photo.y, width: boxes.photo.w, height: boxes.photo.h, overflow: "hidden" }}>
            <Img src={staticFile(FAMILY)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + 0.12 * Math.min(1, t / sc.dur)})` }} />
          </div>
        ) : null}
        {sc.layer === "table" ? (
          <div style={{ position: "absolute", left: win.x, top: win.y, width: win.w, height: Math.min(win.h, table.height), overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: -y, width: table.width, height: table.height, display: "flex" }}>
              <KeepWords>{table.el}</KeepWords>
            </div>
            {(p.notes ?? []).map((n, k) => (t >= (sc.table?.shown[k] ?? 0) ? (
              <div key={k} style={{ position: "absolute", left: 0, top: -y, width: table.width, height: table.height, display: "flex" }}>{noteDrawing(n, table.height)}</div>
            ) : null))}
          </div>
        ) : null}
        <KeepWords>{draw("over", stateAt(sc.frames, t))}</KeepWords>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className="sat" style={{ background: "#000" }}>
      <style>{SATORI_CSS}</style>
      {layers}
      <Audio src={/^https?:\/\//.test(p.audio) ? p.audio : staticFile(p.audio)} />
      {p.fx ? <FxSound music={p.fx.music} cues={classicCues(p.scenes)} scenes={p.scenes} total={p.total} fps={fps} /> : null}
    </AbsoluteFill>
  );
}
