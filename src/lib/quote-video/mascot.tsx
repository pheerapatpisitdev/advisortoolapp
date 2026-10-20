import type { ReactNode } from "react";
import { MASCOT_COLORS as M } from "@/lib/card-theme";

/**
 * น้องโล่ (owner, 2026-10-20, idea 6 on https://claude.ai/artifact/VdSxA6rXLQAJWay1mwocqz, ก "ตามที่แนะนำ"):
 * the brand's shield, the same in every clip and every look, in the bottom-left corner above the
 * subtitle. It blinks, points at the plan, is surprised as the big sum pops in on the opening, and waves
 * at the close. Drawn by Remotion over each scene (remotion/src/Clip.tsx, FhcClip.tsx).
 */

type Pose = "point" | "wow" | "wave";

/** what it does at scene time t in a scene: surprised at the opening's sum (motion.tsx's big pop at 1.1 s), waving at the close */
export function mascotPose(key: string, t: number): Pose {
  if ((key === "lead" || key === "fhcOpen") && t >= 1.1 && t < 2.4) return "wow";
  if (key === "contact" || key === "fhcContact") return "wave";
  return "point";
}

/** น้องโล่ at clip time T (blinks and bobs) and scene time t (its pose), in a w×h frame */
export function mascotFront(key: string, t: number, T: number, w: number, h: number): ReactNode {
  const portrait = h > w;
  const size = portrait ? 150 : 104;
  const pose = mascotPose(key, t);
  const blink = T % 2.6 < 0.12 ? 0.12 : 1;
  const hop = pose === "wow" ? Math.abs(Math.sin((t - 1.1) * 9)) * 10 * Math.max(0, 1 - (t - 1.1) / 0.8) : Math.sin(T * 2.4) * 3;
  const arm = pose === "wave" ? -70 + Math.sin(T * 8) * 22 : -48;
  const eye = pose === "wow" ? 1.15 : 1;
  return (
    <svg width={size} height={size * 1.25} viewBox="-100 -110 200 250" style={{ position: "absolute", left: portrait ? 26 : 14, bottom: (portrait ? 215 : 70) + hop }}>
      <g transform={`translate(60 -10) rotate(${arm})`}>
        <line x1={0} y1={0} x2={58} y2={0} stroke={M.rim} strokeWidth={10} strokeLinecap="round" />
        <circle cx={62} cy={0} r={10} fill={M.hand} />
      </g>
      <path d="M0 -80 L72 -52 L72 6 Q72 64 0 96 Q-72 64 -72 6 L-72 -52 Z" fill={M.body} stroke={M.rim} strokeWidth={7} />
      {[-24, 24].map((x) => (
        <g key={x} transform={`translate(${x} -12) scale(${eye} ${eye * blink})`}>
          <ellipse rx={15} ry={17} fill={M.eye} />
          <circle cx={pose === "wave" ? 0 : 4} cy={pose === "wave" ? 3 : -4} r={7} fill={M.pupil} />
        </g>
      ))}
      {pose === "wow"
        ? <ellipse cx={0} cy={36} rx={10} ry={13} fill={M.pupil} stroke={M.mouth} strokeWidth={3} />
        : <path d="M-18 30 Q0 50 18 30" fill="none" stroke={M.mouth} strokeWidth={5} strokeLinecap="round" />}
      <ellipse cx={-44} cy={22} rx={9} ry={5} fill={M.cheek} opacity={0.7} />
      <ellipse cx={44} cy={22} rx={9} ry={5} fill={M.cheek} opacity={0.7} />
    </svg>
  );
}
