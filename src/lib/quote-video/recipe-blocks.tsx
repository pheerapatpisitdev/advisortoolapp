import type { CSSProperties, ReactNode } from "react";
import type { RecipeFigures } from "./recipes";
import type { QuoteVideoFacts } from "./script";

/**
 * The shared motion and pieces of the three recipe clips (owner, 2026-11-11, mockup
 * https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88, ก ก ก). The mockup moved its pieces with CSS
 * keyframes; a Remotion frame has no animation clock, so each curve is written here as a function
 * of the seconds since the piece's cue, with the same shapes and timing as the mockup.
 */

export type Enter = "up" | "slam" | "wipe" | "left" | "right" | "pop" | "fade" | "grow";

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0…1 (the overshoot is kept) */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, u: number) => 3 * a * (1 - u) ** 2 * u + 3 * b * (1 - u) * u ** 2 + u ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

// the mockup's easings: pieces overshoot a little, the wipe eases out, the bars grow slower
const SPRING = bezier(0.2, 0.9, 0.25, 1.15);
const EASE_OUT = bezier(0, 0, 0.58, 1);
const GROW = bezier(0.2, 0.8, 0.2, 1);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const DUR = 0.55;
const GROW_DUR = 1.1;

/** the style of a piece s seconds after its cue (s < 0: not yet shown); settled at s >= 0.55 (grow: 1.1) */
export function enter(kind: Enter, s: number, unit: number): CSSProperties {
  const w = 1080 * unit;
  const done = s >= (kind === "grow" ? GROW_DUR : DUR);
  if (done) return kind === "wipe" ? { opacity: 1, transform: "none", clipPath: "inset(0px 0px 0px 0px)" } : kind === "grow" ? { transform: "none" } : { opacity: 1, transform: "none" };
  const p = SPRING(clamp01(s / DUR));
  const o = clamp01(p);
  switch (kind) {
    case "up":
      return { opacity: o, transform: `translateY(${mix(w * 0.12, 0, p).toFixed(2)}px)` };
    case "left":
      return { opacity: o, transform: `translateX(${mix(-w * 0.3, 0, p).toFixed(2)}px)` };
    case "right":
      return { opacity: o, transform: `translateX(${mix(w * 0.3, 0, p).toFixed(2)}px)` };
    case "fade":
      return { opacity: o };
    case "wipe": {
      const e = EASE_OUT(clamp01(s / DUR));
      return { opacity: 1, clipPath: `inset(0px ${((1 - e) * 100).toFixed(2)}% 0px 0px)` };
    }
    case "slam": {
      // 0% scale 2.2 / −6°, 60% scale 0.94 / 1°, 100% settled; each leg eased on its own as CSS does
      const q = clamp01(s / DUR);
      const leg = q < 0.6 ? SPRING(q / 0.6) : SPRING((q - 0.6) / 0.4);
      const scale = q < 0.6 ? mix(2.2, 0.94, leg) : mix(0.94, 1, leg);
      const turn = q < 0.6 ? mix(-6, 1, leg) : mix(1, 0, leg);
      return { opacity: q < 0.6 ? clamp01(leg) : 1, transform: `scale(${scale.toFixed(4)}) rotate(${turn.toFixed(3)}deg)` };
    }
    case "pop": {
      // 0% scale 0.3, 70% scale 1.12, 100% settled
      const q = clamp01(s / DUR);
      const leg = q < 0.7 ? SPRING(q / 0.7) : SPRING((q - 0.7) / 0.3);
      const scale = q < 0.7 ? mix(0.3, 1.12, leg) : mix(1.12, 1, leg);
      return { opacity: q < 0.7 ? clamp01(leg) : 1, transform: `scale(${scale.toFixed(4)})` };
    }
    case "grow":
      return { transform: `scaleY(${Math.max(0, GROW(clamp01(s / GROW_DUR))).toFixed(4)})`, transformOrigin: "bottom" };
  }
}

/** a figure counted up over 0.9 s from 0.2 s after its cue, eased out cubic, thousands separated */
export function counted(baht: number, s: number): string {
  const q = clamp01((s - 0.2) / 0.9);
  const n = Math.round(baht * (1 - (1 - q) ** 3));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** the largest font size, capped at `cap`, at which `text` fits `room` px on one line (0.6 em a letter, digits and Thai alike) */
export function fitSize(text: string, room: number, cap: number): number {
  const letters = Math.max(1, [...text].length);
  return Math.floor(Math.min(cap, room / (letters * 0.6)));
}

export interface RecipeClip {
  facts: QuoteVideoFacts;
  figures: RecipeFigures;
  contact: { name: string; phone: string; line?: string };
  total: number;
  scenes: { start: number; dur: number }[];
}

/** the same foot on every scene: it is an example, and the footnote the card prints stays with it */
export function footLine(c: RecipeClip, w: number, h: number, color: string): ReactNode {
  const unit = w / 1080;
  const side = Math.round(64 * unit);
  const height = Math.round(130 * unit);
  return (
    <div style={{ display: "flex", position: "absolute", left: side, top: h - height - Math.round(36 * unit), width: w - side * 2, height, flexDirection: "column", justifyContent: "flex-end", alignItems: "center", textAlign: "center", fontFamily: "Plex", fontSize: Math.round(26 * unit), lineHeight: 1.35, color }}>
      <div style={{ display: "flex" }}>ตัวอย่างประกอบ · เงื่อนไขตามกรมธรรม์</div>
      {c.facts.footNote ? <div style={{ display: "flex" }}>{c.facts.footNote}</div> : null}
    </div>
  );
}

/**
 * The closing card: a lead line, the agent's name, then phone and LINE; every line one line wide.
 * `face.enter` is how the name and the last lines arrive (default: the name slammed at 0.25 s, the
 * rest up at 0.7 s, as `ask` has it; `life` and `versus` use the mockup's up at 0.2 s / 0.5 s).
 * `face.light` is the weight of the non-bold lines (default 400; Kanit has no 400, so `ask` passes 500).
 */
export function contactBlock(
  c: RecipeClip,
  lead: string,
  s: number,
  w: number,
  unit: number,
  face: { family: string; weight: number; color: string; accent: string; light?: number; enter?: { kind: Enter; name: number; rest: number } },
): ReactNode {
  const light = face.light ?? 400;
  const arrive = face.enter ?? { kind: "slam" as Enter, name: 0.25, rest: 0.7 };
  const room = w - Math.round(64 * unit) * 2;
  const line = (text: string, cap: number, color: string, weight: number, kind: Enter, at: number, gap = 0) => (
    <div style={{ display: "flex", whiteSpace: "nowrap", justifyContent: "center", fontFamily: face.family, fontWeight: weight, color, fontSize: fitSize(text, room, Math.round(cap * unit)), lineHeight: 1.25, marginTop: Math.round(gap * unit), ...enter(kind, s - at, unit) }}>{text}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: room }}>
      {line(lead, 54, face.color, light, "up", 0)}
      {line(c.contact.name, 120, face.accent, face.weight, arrive.kind, arrive.name, 24)}
      {line(`โทร ${c.contact.phone}`, 54, face.color, light, "up", arrive.rest, 28)}
      {c.contact.line ? line(`LINE ${c.contact.line}`, 54, face.color, light, "up", arrive.rest) : null}
    </div>
  );
}
