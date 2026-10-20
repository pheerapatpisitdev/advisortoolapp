import type { ReactNode } from "react";
import type { QuoteVideoFacts } from "./script";
import { XFADE } from "./timeline";

/**
 * ฉากต่อกัน (owner, 2026-10-20, idea 5 on https://claude.ai/artifact/VdSxA6rXLQAJWay1mwocqz, ก "ตามที่แนะนำ"):
 * at each join the next scene's own figure swells in the middle over the join, then flies up and fades
 * as the scene's pieces come in, so the eye is carried from one part of the quote to the next. The
 * scenes themselves are as they were; a scene with no single figure keeps its plain join. Drawn by
 * Remotion over the clip (remotion/src/Clip.tsx), in the look's own fill.
 */

/** the figure a scene is about, said short; none where it has no one figure */
export function carryFigure(key: string, f: QuoteVideoFacts): string | null {
  switch (key) {
    case "price": {
      if (f.perDayAmount) return `${f.perDayAmount} บาท/วัน`;
      const main = f.prices.find((p) => p.main);
      return main ? `${main.amount} บาท` : null;
    }
    case "cover": return `คุ้มครองถึง ${f.coverToAge}`;
    case "value": return f.breakEven ? `คืน ${f.breakEven.cash}` : null;
    case "critical": return `${f.lead.amount} บาท`;
    default: return null;
  }
}

/** how long after the scene starts the figure is gone */
const AFTER = 0.8;

/** the figure carried at clip time T, if a join is on: big in the middle, then up and away */
export function carryFront(scenes: { key: string; start: number }[], f: QuoteVideoFacts, T: number, w: number, h: number, colors: { fill: string; onFill: string }): ReactNode {
  const sc = scenes.find((s, i) => i > 0 && T >= s.start - XFADE && T < s.start + AFTER);
  const words = sc ? carryFigure(sc.key, f) : null;
  if (!sc || !words) return null;
  const u = Math.min(w, h) / 1080;
  // in: 0 → 1 over the join; out: 0 → 1 over the scene's first moments
  const inQ = Math.min(1, (T - (sc.start - XFADE)) / XFADE);
  const outQ = Math.max(0, Math.min(1, (T - sc.start - 0.1) / (AFTER - 0.1)));
  const ease = (q: number) => q * q * (3 - 2 * q);
  const scale = (0.6 + 0.4 * ease(inQ)) * (1 - 0.55 * ease(outQ));
  const y = h * (0.45 - 0.33 * ease(outQ));
  return (
    <div style={{ position: "absolute", display: "flex", left: 0, width: w, top: y, justifyContent: "center", opacity: Math.min(1, inQ * 2) * (1 - ease(outQ)) }}>
      <div style={{
        display: "flex", background: colors.fill, color: colors.onFill, borderRadius: Math.round(80 * u), padding: `${Math.round(10 * u)}px ${Math.round(56 * u)}px`,
        fontFamily: "Plex", fontSize: Math.round(110 * u), fontWeight: 700, whiteSpace: "nowrap", transform: `translateY(-50%) scale(${scale.toFixed(3)})`,
        boxShadow: `0 ${Math.round(18 * u)}px ${Math.round(50 * u)}px rgba(0,0,0,0.35)`,
      }}>{words}</div>
    </div>
  );
}
