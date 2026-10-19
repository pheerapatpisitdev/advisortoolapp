import type { ReactNode } from "react";
import { KINETIC_COLORS } from "@/lib/card-theme";
import { wordTimes } from "./timeline";

/**
 * ตัวหนังสือเด้ง (owner, 2026-10-20, idea 3 on https://claude.ai/artifact/MsvkeeeepPz4XG4TDvhN9n,
 * "ตามที่แนะนำ"): a Motion Graphic look with no pictures — the scene's own spoken words, big, each
 * popping in as the voice reaches it, a figure filling the width, the ground changing colour scene
 * by scene. It is drawn from the line alone, so every product and every summary has it; the words
 * are the subtitle. The closing scene keeps the agent's name, phone and LINE under its words.
 * Drawn by Remotion (remotion/src/Clip.tsx, FhcClip.tsx) in place of the scene's own frame.
 */

const isFigure = (w: string) => /\d/.test(w);
/** a short word after a figure that stays with it: บาท, ล้าน, ปี */
const isUnit = (w: string) => !isFigure(w) && [...w].length <= 5;
/** how many letters a group holds before the next word starts a new one */
const GROUP_LETTERS = 18;

interface Token { word: string; from: number; figure: boolean }

/** the words in the groups shown together: a figure with its unit on its own, other words a line's worth at a time */
export function kineticGroups(voice: string, voiceSec: number): Token[][] {
  const groups: Token[][] = [];
  let cur: Token[] = [];
  let letters = 0;
  const close = () => { if (cur.length) groups.push(cur); cur = []; letters = 0; };
  const times = wordTimes(voice, voiceSec);
  times.forEach(({ word, from }, i) => {
    const figure = isFigure(word);
    const afterFigure = i > 0 && isFigure(times[i - 1].word) && isUnit(word);
    if (figure) close();
    else if (!afterFigure && (letters + [...word].length > GROUP_LETTERS || cur.some((x) => x.figure))) close();
    cur.push({ word, from, figure });
    letters += [...word].length;
  });
  close();
  return groups;
}

/** what a pop looks like s seconds after the word is said: big and clear, then settled */
function pop(s: number): { opacity: number; scale: number } {
  if (s < 0) return { opacity: 0, scale: 1.6 };
  const q = Math.min(1, s / 0.28);
  const back = 1 + 2.7 * (q - 1) ** 3 + 1.7 * (q - 1) ** 2;
  return { opacity: Math.min(1, q * 1.6), scale: 1.6 - 0.6 * back };
}

export interface KineticScene {
  voice: string;
  voiceSec: number;
  /** the scene's place in the clip: the ground's colour goes by it */
  index: number;
  /** the plan's line at the top */
  header?: string;
  /** the closing scene: the agent's card under the words */
  contact?: { name: string; phone: string; line?: string };
}

/** one frame of a scene at scene time t, w×h */
export function kineticFrame(sc: KineticScene, t: number, w: number, h: number): ReactNode {
  const k = KINETIC_COLORS[sc.index % KINETIC_COLORS.length];
  const unit = Math.min(w, h) / 1080;
  const side = Math.round(64 * unit);
  const room = w - side * 2;
  const groups = kineticGroups(sc.voice, sc.voiceSec);
  let at = 0;
  groups.forEach((g, i) => { if (g[0].from <= t) at = i; });
  const shown = groups[at] ?? [];
  const size = (tok: Token) => {
    const letters = Math.max(1, [...tok.word].length);
    const cap = (tok.figure ? 340 : 130) * unit;
    return Math.round(Math.min(cap, room / (letters * 0.6)));
  };
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: k.ground, fontFamily: "Plex", color: k.ink, overflow: "hidden" }}>
      {sc.header ? <div style={{ display: "flex", position: "absolute", left: side, top: Math.round(70 * unit), width: room, fontSize: Math.round(34 * unit), color: k.soft }}>{sc.header}</div> : null}
      <div style={{ display: "flex", position: "absolute", left: side, width: room, top: 0, height: sc.contact ? h * 0.62 : h, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {shown.map((tok, i) => {
          const p = pop(t - tok.from);
          return (
            <div key={`${at}-${i}`} style={{
              display: "flex", whiteSpace: "nowrap", fontSize: size(tok), fontWeight: 700, lineHeight: 1.18,
              color: tok.figure ? k.figure : k.ink, opacity: p.opacity, transform: `scale(${p.scale.toFixed(3)})`,
            }}>{tok.word}</div>
          );
        })}
      </div>
      {sc.contact ? (
        <div style={{ display: "flex", position: "absolute", left: side, width: room, top: h * 0.62, flexDirection: "column", alignItems: "center", fontSize: Math.round(46 * unit), lineHeight: 1.4 }}>
          <div style={{ display: "flex", fontWeight: 700, color: k.figure, fontSize: Math.round(60 * unit) }}>{sc.contact.name}</div>
          <div style={{ display: "flex" }}>{`โทร ${sc.contact.phone}`}</div>
          {sc.contact.line ? <div style={{ display: "flex" }}>{`LINE ${sc.contact.line}`}</div> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", position: "absolute", left: 0, width: w, bottom: Math.round((h > w ? 34 : 14) * unit), justifyContent: "center", fontSize: Math.round(26 * unit), color: k.soft }}>Application by www.advisortool.app</div>
    </div>
  );
}
