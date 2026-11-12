import type { ReactNode } from "react";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { grey, lookFromId, type Drawn, type Pose } from "./figure";

/**
 * สต็อปโมชันกระดาษ's people (owner chose ค, 2026-11-12): a doll cut from bright paper, a big round head on a
 * small body, every piece edged in white as a cut piece is. It reads at the size of a face in the crowd of 48,
 * where มินิมอล's slim figure does not. It takes the same look and pose as that figure (figure.tsx), and shows
 * of a pose what a doll can: the arms' swing, the body's lean, the head's nod, a smile or a frown.
 */

const C = STORY_CLIP_COLORS;
const INK = C.dollInk;
const BLUSH = C.dollBlush;
const SHOE = C.dollShoe;
const COIN = C.dollCoin;
const GONE = C.dollGone;
const D = Math.PI / 180;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** someone as a paper doll: who they are from their id (figure.tsx), cut from bright paper, the same in every scene */
export function dollLook(id: string): Drawn {
  let k = 0;
  for (const ch of id) k = (k * 31 + ch.charCodeAt(0)) % 997;
  return { ...lookFromId(id), shirt: C.paperShirts[k % C.paperShirts.length], pants: C.paperPants[(k >> 2) % C.paperPants.length] };
}

/** the doll's box: 100 wide, 130 tall, the feet on the bottom edge */
export const DOLL = { w: 100, h: 130 };

/** `ink` (การ์ตูนลายเส้น): the same doll drawn with a pen, a thick black line round every part and a white face, standing on a smudge */
export function PaperDoll({ look, pose, w, h, gray, dash, dir = 1, ink }: { look: Drawn; pose: Pose; w: number; h: number; gray?: boolean; dash?: boolean; dir?: 1 | -1; ink?: boolean }) {
  const col = (c: string) => (gray ? grey(c) : c);
  const EDGE = ink ? INK : C.cutEdge;
  const SKIN = ink ? C.white : C.dollSkin;
  const cut = ink
    ? { stroke: INK, strokeWidth: 3.2, strokeLinejoin: "round" as const }
    : { stroke: EDGE, strokeWidth: 4.5, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  const kid = look.age === "kid";
  const lean = Math.max(-16, Math.min(16, pose.t * 0.45));
  const nod = Math.max(-14, Math.min(14, pose.h * 0.5));
  const low = pose.seat ? 6 : 0;
  // an arm from its shoulder: 0 hangs down, 180 points straight up, swinging out to its own side
  const arm = (side: -1 | 1, deg: number): [number, number, number, number] => {
    const sx = 50 + side * 21, sy = 70, len = 27;
    const a = Math.max(8, Math.abs(deg)) * D;
    return [sx, sy, r1(sx + side * len * Math.sin(a)), r1(sy + len * Math.cos(a))];
  };
  const arms = [arm(-1, pose.ua[0]), arm(1, pose.ua[1])];
  const sad = !pose.smile && (pose.h > 15 || pose.t < -20);
  const hem = look.bottom === "skirt" ? 30 : 25;
  const body = `M33 64 Q50 58 67 64 L${50 + hem} 102 Q50 106 ${50 - hem} 102 Z`;
  if (dash) {
    // someone gone: only where they stood, in grey dashes
    return (
      <svg width={w} height={h} viewBox={`0 0 ${DOLL.w} ${DOLL.h}`} preserveAspectRatio="xMidYMax meet">
        <g fill="none" stroke={GONE} strokeWidth={2.6} strokeDasharray="7 6" opacity={0.7}>
          <circle cx={50} cy={36} r={27} />
          <path d={body} />
          <path d="M41 104 V124 M59 104 V124" />
        </g>
      </svg>
    );
  }
  const parts: ReactNode[] = [];
  const hair = col(look.hairColor);
  // the hair behind the head
  if (look.hair === "long") parts.push(<path key="back" d="M21 34 Q20 4 50 5 Q80 4 79 34 L81 66 Q66 72 50 70 Q34 72 19 66 Z" fill={hair} {...cut} />);
  if (look.hair === "bun") parts.push(<circle key="bun" cx={50} cy={6} r={10} fill={hair} {...cut} />);
  const head = (
    <g key="head" transform={`rotate(${r1(nod)} 50 62)`}>
      {parts}
      <circle cx={50} cy={36} r={27} fill={col(SKIN)} {...cut} />
      <path d={look.sex === "M" ? "M24 30 Q26 8 50 8 Q74 8 76 30 Q62 18 50 20 Q36 18 24 30 Z" : "M23 34 Q22 8 50 8 Q78 8 77 34 Q70 20 52 18 Q34 20 23 34 Z"} fill={hair} />
      <circle cx={40} cy={39} r={2.9} fill={INK} />
      <circle cx={60} cy={39} r={2.9} fill={INK} />
      {look.glasses ? <path d="M32 39 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M52 39 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M48 39 h4" fill="none" stroke={INK} strokeWidth={1.8} /> : null}
      {gray ? null : <><ellipse cx={32} cy={47} rx={4.6} ry={2.8} fill={BLUSH} opacity={0.8} /><ellipse cx={68} cy={47} rx={4.6} ry={2.8} fill={BLUSH} opacity={0.8} /></>}
      <path d={sad ? "M43 52 q7 -6 14 0" : pose.smile ? "M41 48 q9 10 18 0" : "M43 49 q7 5 14 0"} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
  const shirt = col(look.shirt);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${DOLL.w} ${DOLL.h}`} preserveAspectRatio="xMidYMax meet">
      <g transform={`${dir === -1 ? `translate(${DOLL.w} 0) scale(-1 1) ` : ""}translate(0 ${low}) rotate(${r1(lean)} 50 124)${kid ? " translate(50 124) scale(0.8) translate(-50 -124)" : ""}`}>
        {ink ? <ellipse cx={50} cy={125} rx={34} ry={4.5} fill={C.lineSmudge} /> : null}
        <path d="M41 100 V119 M59 100 V119" stroke={EDGE} strokeWidth={15} strokeLinecap="round" fill="none" />
        <path d="M41 100 V119 M59 100 V119" stroke={col(look.bottom === "skirt" ? SKIN : look.pants)} strokeWidth={10.5} strokeLinecap="round" fill="none" />
        <ellipse cx={39} cy={123} rx={8.5} ry={4.6} fill={col(SHOE)} {...cut} />
        <ellipse cx={61} cy={123} rx={8.5} ry={4.6} fill={col(SHOE)} {...cut} />
        <path d={body} fill={shirt} {...cut} />
        {arms.map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={EDGE} strokeWidth={15} strokeLinecap="round" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={shirt} strokeWidth={10.5} strokeLinecap="round" />
            <circle cx={x2} cy={y2} r={5.6} fill={col(SKIN)} stroke={EDGE} strokeWidth={2.4} />
          </g>
        ))}
        {pose.hold === "coin" ? <circle cx={arms[1][2] + 3} cy={arms[1][3] + 6} r={7} fill={col(COIN)} {...cut} /> : null}
        {head}
      </g>
    </svg>
  );
}
