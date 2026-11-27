import type { CSSProperties, JSX } from "react";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";
import type { MotionLayout, MotionSide, PromptScene } from "../types";
import { abs, alpha, box, Pic, place, PROMPT } from "./css";
import { clamp, ease, fly, r2, rise, spring } from "./ease";
import { fitGroup, fitSize } from "./fit";
import { DOT_STEP, GEO, type Rect } from "./geo";
import { MotionIconSvg, tickPath } from "./icons";

/**
 * โมชันกราฟิก's scenes (owner, 2026-11-26, mockup ข round 2, its `hook`, `card`, `number`, `compare` and `check`): each a
 * pure function of the scene's time t, in px of the real frame, laid out as Remotion's `.sat` boxes are (every box
 * a flex box). The scene's ground is its own; outside it the frame is transparent. `full` (ภาพเต็มจอ) is the picture
 * full-bleed under a headline; a `showFigure` scene shows the plan's figure card instead of its layout. A device or a
 * library part is not drawn here: the caller draws those (frames.tsx deviceBody).
 */

const C = STORY_CLIP_COLORS;

/** what a scene is drawn with: its shape and length, its painted picture if there is one yet, and the figure card's lines (frames.tsx figureLines) */
export type MotionCtx = { size: VideoSize; dur: number; picture?: string; figure: { text: string; big?: boolean }[] | null };

type Of<K extends MotionLayout["kind"]> = Extract<MotionLayout, { kind: K }>;
type Props<K extends MotionLayout["kind"]> = { m: Of<K>; ctx: MotionCtx; t: number };

/** the mockup's 0.7em rise, in the risen piece's own type */
const up = (t: number, start: number, fs: number): CSSProperties => rise(t, start, 0.7 * fs);
const shadow = (y: number, blur: number, a: number, color: string = C.mgInk) => `0 ${r2(y)}px ${r2(blur)}px ${alpha(color, a)}`;

function navyGround(size: VideoSize) {
  const { w, h } = SIZES[size];
  return <div style={abs({ left: 0, top: 0, width: w, height: h, background: `linear-gradient(165deg, ${C.mgNavy2}, ${C.mgNavy} 70%)` })} />;
}
function creamGround(size: VideoSize) {
  const { w, h } = SIZES[size];
  return <div style={abs({ left: 0, top: 0, width: w, height: h, background: `radial-gradient(${C.mgDot} 12%, ${alpha(C.mgDot, 0)} 13%) 0 0 / ${DOT_STEP}px ${DOT_STEP}px, ${C.mgCream}` })} />;
}

/** soft round lights drifting on a ground: [colour, size as a share of 1080, centre as shares of the frame] */
function blobs(size: VideoSize, t: number, list: [string, number, number, number][]) {
  const { w, h } = SIZES[size];
  return list.map(([color, f, fx, fy], i) => {
    const d = f * 1080;
    return (
      <div key={`b${i}`} style={abs({
        left: r2(fx * w - d / 2), top: r2(fy * h - d / 2), width: d, height: d, borderRadius: d / 2,
        background: `radial-gradient(circle closest-side, ${color} 92%, ${alpha(color, 0)} 100%)`,
        transform: `translate(${r2(Math.sin(t * 0.9 + i * 2) * 42)}px, ${r2(Math.cos(t * 0.7 + i) * 48)}px)`,
      })} />
    );
  });
}

/**
 * a headline's lines rising one after another from `start`, each never wrapped but shrunk with the others to fit
 * (fitGroup); the key line swept with gold from behind, its words turning ink as the gold passes half way
 */
function headline(lines: string[], key: number, sizes: number[], width: number, t: number, ink: string, start = 0.2) {
  // the gold reaches a little past the words on both sides, and a rising line starts a little large: keep clear of the edge
  const fs = fitGroup(lines, width * 0.96, sizes);
  return lines.map((text, i) => {
    const st = start + i * 0.22;
    const m = i === key ? ease((t - st - 0.3) / 0.4) : 0;
    const f = fs[i];
    return (
      <div key={`l${i}`} style={box({ fontSize: f, fontWeight: 800, lineHeight: 1.22, whiteSpace: "nowrap", color: m > 0.45 ? C.mgInk : ink, ...up(t, st, f) })}>
        {m > 0 ? <div style={abs({ left: r2(-0.12 * f), top: r2(0.18 * f), bottom: r2(0.06 * f), width: `calc(${r2(m * 100)}% + ${r2(m * 0.24 * f)}px)`, background: C.mgGold, borderRadius: r2(0.14 * f) })} /> : null}
        <div style={box({})}>{text}</div>
      </div>
    );
  });
}

/** a column of pieces in a box, centred, or on its left edge in the wide layouts */
const column = (r: Rect, left: boolean, gap = 4.5): CSSProperties =>
  abs({ ...place(r), flexDirection: "column", alignItems: left ? "flex-start" : "center", justifyContent: "center", gap });

/** a rounded label: the mockup's .pill, its padding in its own type */
const pill = (fs: number, background: string, color: string): CSSProperties =>
  box({ fontSize: fs, fontWeight: 600, lineHeight: 1.3, borderRadius: 999, padding: `${r2(0.2 * fs)}px ${r2(0.8 * fs)}px`, background, color, whiteSpace: "nowrap" });

function Hook({ m, ctx, t }: Props<"hook">) {
  const g = GEO[ctx.size].hook;
  return (
    <>
      {navyGround(ctx.size)}
      {blobs(ctx.size, t, [[alpha(C.mgGold, 0.22), 0.45, 0.1, 0.2], [alpha(C.mgTeal, 0.3), 0.55, 0.85, 0.75], [alpha(C.mgCoral, 0.18), 0.28, 0.9, 0.12]])}
      <div style={abs({ ...place(g.icon), transform: "rotate(12deg)" })}><MotionIconSvg icon={m.icon} t={t} w={g.icon.w} h={g.icon.h} /></div>
      <div style={column(g.head, g.left)}>{headline(m.lines, m.key, g.fs, g.head.w, t, C.white)}</div>
    </>
  );
}

function Card({ m, ctx, t }: Props<"card">) {
  const g = GEO[ctx.size].card;
  const { w } = SIZES[ctx.size];
  const tagFs = fitSize(m.tag, g.tag.w - 1.6 * g.tagFs - 40, g.tagFs);
  const s = spring(t - 0.25);
  const move = g.from.dx ? `translateX(${r2((1 - s) * g.from.dx)}px)` : `translateY(${r2((1 - s) * g.from.dy)}px)`;
  const chips = ([[m.chips[0], g.c1, C.mgCoral, 1.0, g.r[0]], [m.chips[1], g.c2, C.mgNavy, 1.35, g.r[1]]] as const).map(([text, spot, background, st, rot], i) => {
    const k = spring(t - st);
    // a chip stands by its left or right edge: what is left of the frame past that edge is its widest
    const room = w - (spot.left ?? spot.right ?? 0) - 40 - 1.2 * g.cf;
    const cf = fitSize(text, room, g.cf);
    return (
      <div key={`c${i}`} style={abs({
        ...(spot.left !== undefined ? { left: spot.left } : { right: spot.right }), top: spot.top,
        fontSize: cf, fontWeight: 800, lineHeight: 1.25, whiteSpace: "nowrap", borderRadius: r2(0.5 * cf), padding: `${r2(0.22 * cf)}px ${r2(0.6 * cf)}px`,
        color: C.white, background, boxShadow: shadow(0.4 * cf, 0.9 * cf, 0.2),
        opacity: r2(clamp((t - st) / 0.12)), transform: `scale(${r2(0.4 + 0.6 * k)}) rotate(${r2(rot * k)}deg)`,
      })}>{text}</div>
    );
  });
  return (
    <>
      {creamGround(ctx.size)}
      <div style={column(g.tag, g.left)}><div style={{ ...pill(tagFs, C.mgNavy, C.white), ...up(t, 0.1, tagFs) }}>{m.tag}</div></div>
      <div style={abs({
        ...place(g.card), background: C.white, borderRadius: 36, border: `13.5px solid ${C.white}`, boxShadow: shadow(36, 72, 0.28), overflow: "hidden",
        opacity: r2(clamp((t - 0.25) / 0.15)), transform: `${move} rotate(${r2(-2 + (1 - s) * g.from.rot)}deg)`,
      })}>
        {ctx.picture ? <Pic src={ctx.picture} style={{ transform: `scale(${r2(1.05 + 0.08 * clamp(t / ctx.dur))})` }} /> : <div style={abs({ left: 0, top: 0, width: "100%", height: "100%", background: C.mgGrey })} />}
      </div>
      {chips}
    </>
  );
}

function NumberScene({ m, ctx, t }: Props<"number">) {
  const g = GEO[ctx.size].number;
  const { w, h } = SIZES[ctx.size];
  const value = m.value.toLocaleString("en-US");
  // sized for the whole figure, so the count does not grow as it runs
  const big = fitSize(value, g.head.w, g.big);
  const unit = fitSize(m.unit, g.head.w * 0.96, g.unit);
  const tagFs = fitSize(m.tag, g.head.w - 1.6 * g.tagFs, g.tagFs);
  const s = spring(t - 0.35);
  const rf = g.rf;
  const inner = g.rc.w - 3.2 * rf;
  const sum = `รวม ${value} ${m.unit}`;
  const card = fly(t, 0.9, g.from.dx, g.from.dy);
  return (
    <>
      <div style={abs({ left: 0, top: 0, width: w, height: h, background: `linear-gradient(170deg, ${C.mgCoral}, ${C.mgRed})` })} />
      {blobs(ctx.size, t, [[alpha(C.white, 0.12), 0.5, 0.1, 0.6], [alpha(C.mgGold, 0.25), 0.33, 0.85, 0.15]])}
      <div style={column(g.head, g.left)}>
        <div style={{ ...pill(tagFs, alpha(C.mgInk, 0.18), C.white), ...up(t, 0.1, tagFs) }}>{m.tag}</div>
        <div style={box({ fontSize: big, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", opacity: r2(clamp((t - 0.35) / 0.15)), transform: `scale(${r2(0.7 + 0.3 * s)})` })}>
          {Math.round(m.value * ease((t - 0.35) / 1.5)).toLocaleString("en-US")}
        </div>
        <div style={box({ fontSize: unit, fontWeight: 800, lineHeight: 1.22, whiteSpace: "nowrap", ...up(t, 0.6, unit) })}>{m.unit}</div>
      </div>
      <div style={abs({ ...place(g.rc), background: C.white, borderRadius: 24, boxShadow: shadow(36, 72, 0.28), opacity: card.opacity, transform: `${card.transform} rotate(${r2(-4 * spring(t - 0.9))}deg)` })}>
        <div style={abs({ left: 0, top: 0, width: "100%", height: "100%", flexDirection: "column", padding: `${r2(1.4 * rf)}px ${r2(1.6 * rf)}px`, gap: r2(0.85 * rf), color: C.mgInk })}>
          <div style={box({ fontSize: fitSize(m.bill, inner, 1.25 * rf), fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap" })}>{m.bill}</div>
          {[80, 55, 68, 40].map((pc, i) => (
            <div key={`r${i}`} style={box({ height: r2(0.7 * rf), flexShrink: 0, borderRadius: r2(0.4 * rf), background: C.mgGrey, width: `${r2(pc * ease((t - 1.2 - i * 0.18) / 0.45))}%` })} />
          ))}
          <div style={box({ fontSize: fitSize(sum, inner, 1.6 * rf), fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap", color: C.mgRed, borderTop: `${r2(0.16 * rf)}px dashed ${C.mgGrey}`, paddingTop: r2(0.64 * rf), opacity: r2(ease((t - 2.0) / 0.3)) })}>{sum}</div>
        </div>
      </div>
    </>
  );
}

/** a side's mark: a red cross for the side without a plan, a gold tick for the one with */
function Dot({ bad, d }: { bad: boolean; d: number }) {
  return (
    <div style={box({ width: d, height: d, flexShrink: 0, borderRadius: d / 2, background: bad ? C.mgRed : C.mgGold, alignItems: "center", justifyContent: "center" })}>
      <svg viewBox="0 0 24 24" width={r2(d * 0.62)} height={r2(d * 0.62)} fill="none" stroke={bad ? C.white : C.mgInk} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d={bad ? "M6 6 L18 18 M18 6 L6 18" : "M5 12.5 L10 17.5 L19 7"} />
      </svg>
    </div>
  );
}

function Compare({ m, ctx, t }: Props<"compare">) {
  const g = GEO[ctx.size].compare;
  const tf = fitSize(m.title, g.title.w * 0.96, g.tf);
  // both sides in one size, so neither looks the louder for having shorter words
  const inner = g.A.w - 78;
  const head = Math.min(...[m.bad.head, m.good.head].map((x) => fitSize(x, inner - 1.875 * g.cf - 0.75 * g.cf, 1.5 * g.cf)));
  const line = Math.min(...[...m.bad.lines, ...m.good.lines].map((x) => fitSize(x, inner, 2.3 * g.cf)));
  const dim = ease((t - 2.4) / 0.5);
  const side = (x: MotionSide, r: Rect, bad: boolean, start: number, dx: number) => {
    const f = fly(t, start, dx, 0);
    return (
      <div style={abs({
        ...place(r), borderRadius: 33, padding: "33px 39px", flexDirection: "column", justifyContent: "center",
        ...(bad
          ? { background: C.white, color: C.mgRed, boxShadow: shadow(24, 54, 0.14), filter: `saturate(${r2(1 - dim * 0.6)})`, opacity: r2(Math.min(f.opacity, 1 - dim * 0.35)) }
          : { background: C.mgNavy, color: C.white, boxShadow: shadow(24, 54, 0.3, C.mgNavy), opacity: f.opacity }),
        transform: f.transform,
      })}>
        <div style={box({ flexDirection: "column", gap: r2(0.3 * g.cf) })}>
          <div style={box({ alignItems: "center", gap: r2(0.5 * head), fontSize: head, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap" })}>
            <Dot bad={bad} d={r2(1.25 * head)} />
            <div style={box({})}>{x.head}</div>
          </div>
          <div style={box({ flexDirection: "column", fontSize: line, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" })}>
            <div style={box({})}>{x.lines[0]}</div>
            <div style={box({})}>{x.lines[1]}</div>
          </div>
        </div>
      </div>
    );
  };
  const sv = spring(t - 1.2);
  return (
    <>
      {creamGround(ctx.size)}
      <div style={column(g.title, false)}>
        <div style={box({ fontSize: tf, fontWeight: 800, lineHeight: 1.22, whiteSpace: "nowrap", color: C.mgNavy, ...up(t, 0.1, tf) })}>{m.title}</div>
      </div>
      {side(m.bad, g.A, true, 0.35, g.dx[0])}
      {side(m.good, g.B, false, 1.5, g.dx[1])}
      <div style={abs({
        left: g.vs.x - g.vs.d / 2, top: g.vs.y - g.vs.d / 2, width: g.vs.d, height: g.vs.d, borderRadius: g.vs.d / 2, alignItems: "center", justifyContent: "center",
        background: C.mgGold, color: C.mgInk, boxShadow: shadow(9, 24, 0.25), fontSize: 39, fontWeight: 800,
        opacity: r2(clamp((t - 1.2) / 0.1)), transform: `scale(${r2(sv)}) rotate(${r2((1 - sv) * 90)}deg)`,
      })}>VS</div>
    </>
  );
}

function Check({ m, ctx, t }: Props<"check">) {
  const g = GEO[ctx.size].check;
  const s = spring(t - 0.1);
  const pop = { opacity: r2(clamp((t - 0.1) / 0.12)), transform: `scale(${r2(0.5 + 0.5 * s)})` };
  // the three ticks in one size: the row less its padding, the tick and the gap after it
  const tf = Math.min(...m.ticks.map((x) => fitSize(x, g.ticks.w - 54 - 2.1 * g.tf, g.tf)));
  return (
    <>
      {navyGround(ctx.size)}
      {blobs(ctx.size, t, [[alpha(C.mgTeal, 0.28), 0.5, 0.8, 0.55], [alpha(C.mgGold, 0.18), 0.33, 0.1, 0.1]])}
      {m.photo ? (
        <div style={abs({ ...place(g.ph), borderRadius: g.ph.w / 2, overflow: "hidden", border: `10.5px solid ${C.mgGold}`, background: alpha(C.white, 0.1), ...pop })}>
          {ctx.picture ? <Pic src={ctx.picture} style={{ transformOrigin: "42% 48%", transform: "scale(1.5)" }} /> : null}
        </div>
      ) : (
        // no photo: a gold tick written in where it would stand
        <div style={abs({ ...place(g.ph), ...pop })}>
          <svg viewBox="0 0 60 60" width={g.ph.w} height={g.ph.h} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M30 4 a26 26 0 1 1 0 52 a26 26 0 1 1 0 -52 Z" pathLength={1} strokeDasharray={1} strokeDashoffset={tickPath(t, 0.2, 0.6)} stroke={C.mgGold} strokeWidth={4} />
            <path d="M18 31 L26 39 L43 21" pathLength={1} strokeDasharray={1} strokeDashoffset={tickPath(t, 0.6, 0.4)} stroke={C.mgCoral} strokeWidth={5} />
          </svg>
        </div>
      )}
      <div style={column(g.head, g.left)}>{headline(m.lines, 1, g.fs, g.head.w, t, C.white)}</div>
      {m.ticks.map((text, i) => {
        const st = 1.1 + i * 0.4;
        const f = fly(t, st, 180, 0);
        return (
          <div key={`k${i}`} style={abs({ left: g.ticks.x, width: g.ticks.w, top: g.top + i * g.gap, alignItems: "center", background: alpha(C.white, 0.1), borderRadius: 24, padding: "19.5px 27px", ...f })}>
            <div style={box({ alignItems: "center", gap: r2(0.6 * tf), fontSize: tf, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap" })}>
              <svg viewBox="0 0 24 24" width={r2(1.5 * tf)} height={r2(1.5 * tf)} style={{ flexShrink: 0 }}>
                <circle cx={12} cy={12} r={11} fill={C.mgGold} />
                <path d="M7 12.5l3.2 3.2L17 9" pathLength={1} strokeDasharray={1} strokeDashoffset={tickPath(t, st + 0.15)} fill="none" stroke={C.mgInk} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={box({})}>{text}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** ภาพเต็มจอ: the picture full-bleed, pushed in from 1.06 to 1.16 as it pans, dark at the top and foot, the headline risen over it */
function Full({ m, ctx, t }: Props<"full">) {
  const g = GEO[ctx.size].full;
  const { w, h } = SIZES[ctx.size];
  const p = clamp(t / ctx.dur);
  return (
    <>
      {ctx.picture ? (
        <div style={abs({ left: 0, top: 0, width: w, height: h, overflow: "hidden" })}>
          <Pic src={ctx.picture} style={{ transform: `translateX(${r2((0.5 - p) * 0.04 * w)}px) scale(${r2(1.06 + 0.1 * p)})` }} />
        </div>
      ) : navyGround(ctx.size)}
      <div style={abs({ left: 0, top: 0, width: w, height: Math.round(h * 0.5), background: `linear-gradient(180deg, ${C.mgScrim}, ${alpha(C.mgScrim, 0)})` })} />
      <div style={abs({ left: 0, top: Math.round(h * 0.68), width: w, height: h - Math.round(h * 0.68), background: `linear-gradient(0deg, ${C.mgScrim}, ${alpha(C.mgScrim, 0)})` })} />
      <div style={column(g.head, g.left)}>{headline(m.lines, m.key, g.fs, g.head.w, t, C.white)}</div>
    </>
  );
}

/** the plan's figure card (frames.tsx figureLines) in place of the layout: on the navy, risen in as the agent's card is */
function FigureCard({ lines, ctx, t }: { lines: { text: string; big?: boolean }[]; ctx: MotionCtx; t: number }) {
  const g = GEO[ctx.size].figure;
  const f = fly(t, 0.3, 0, 180, -3);
  const pad = 60;
  return (
    <>
      {navyGround(ctx.size)}
      {blobs(ctx.size, t, [[alpha(C.mgGold, 0.18), 0.4, 0.12, 0.15], [alpha(C.mgTeal, 0.26), 0.5, 0.88, 0.8]])}
      <div style={abs({ ...place(g.area), alignItems: "center", justifyContent: "center" })}>
        <div style={box({ width: g.w, flexDirection: "column", alignItems: "center", background: C.white, borderRadius: 36, padding: pad, boxShadow: shadow(30, 66, 0.25), ...f })}>
          {lines.map((l, i) => l.big ? (
            <div key={`f${i}`} style={box({ flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: fitSize(l.text, g.w - pad * 2, g.big), fontWeight: 800, lineHeight: 1.25, whiteSpace: "nowrap", color: C.mgNavy })}>{l.text}</div>
              <div style={box({ width: 120, height: 10, borderRadius: 5, background: C.mgGold, marginTop: 26, marginBottom: 26 })} />
            </div>
          ) : (
            <div key={`f${i}`} style={box({ fontSize: fitSize(l.text, g.w - pad * 2, g.line), fontWeight: 600, lineHeight: 1.4, whiteSpace: "nowrap", color: C.mgInk })}>{l.text}</div>
          ))}
        </div>
      </div>
    </>
  );
}

function layout(m: MotionLayout, ctx: MotionCtx, t: number) {
  switch (m.kind) {
    case "hook": return <Hook m={m} ctx={ctx} t={t} />;
    case "card": return <Card m={m} ctx={ctx} t={t} />;
    case "number": return <NumberScene m={m} ctx={ctx} t={t} />;
    case "compare": return <Compare m={m} ctx={ctx} t={t} />;
    case "check": return <Check m={m} ctx={ctx} t={t} />;
    case "full": return <Full m={m} ctx={ctx} t={t} />;
  }
}

/**
 * A scene's ground and layout at scene time t, the frame's size, in Prompt. A scene the writer gave no layout is
 * painted (types.ts paints), so it is drawn as a full screen of its screen words.
 */
export function motionBody(scene: PromptScene, ctx: MotionCtx, t: number): JSX.Element {
  const { w, h } = SIZES[ctx.size];
  const m: MotionLayout = scene.motion ?? { kind: "full", lines: [scene.screen], key: -1 };
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", fontFamily: PROMPT, color: C.white }}>
      {scene.showFigure && ctx.figure ? <FigureCard lines={ctx.figure} ctx={ctx} t={t} /> : layout(m, ctx, t)}
    </div>
  );
}
