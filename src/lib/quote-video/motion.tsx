import type { ReactNode } from "react";
import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { CHART_WRITE, chartNotes } from "./chart-pen";
import { beatCues, penBeats } from "./pen";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { pensionBars } from "./pension";
import { bandAges, shortBaht, stairs } from "./legacy";
import { leadBig, leadPill } from "./plb";
import { gsMoney, rateLabel } from "./gsaving";
import { captionShown, wordAt } from "./caption";
import { countAt, H, LEAD, W, wordTimes } from "./timeline";
import type { Extra } from "./told";
import { preparedLine, wordsOf } from "./video-words";

/**
 * The Motion Graphic style of วิดีโอนำเสนอ (owner, 2026-10-11: "แค่โมชันกราฟิกอธิบายแบบประกัน",
 * mockup https://claude.ai/artifact/2iKEneamem9yCm5ih1vuxg): no photographs, a navy world of flat
 * shapes, and every figure walked in — a shield drawn, coins stacked, the age line drawn out, the
 * cash line racing the premiums. All drawn here, so every Thai word and every figure is the
 * engine's; nothing is generated.
 *
 * Each element enters over a window of the scene (`motionSpec`); the frames are drawn at
 * MOTION_FPS inside those windows only (timeline.ts) and held still between them. The
 * background is one tall picture that ffmpeg pans slowly (job.ts), so it drifts for free.
 */

export const MOTION_FPS = 12;
export const MOTION_BG_H = 2400;

const NAVY = C.motionNavy;
const GOLD = C.motionGold;
const SKY = C.motionSky;
const WHITE = C.paper;
const RED = C.motionRed;
const GREEN = C.motionGreen;
const SIDE = 64;

export type Kind = "up" | "pop" | "left" | "fade" | "grow" | "stroke" | "count";
export interface Anim { at: number; dur: number; kind: Kind }
const DUR: Record<Kind, number> = { up: 0.7, pop: 0.55, left: 0.6, fade: 0.6, grow: 0.9, stroke: 1.6, count: 1.4 };
export const a = (at: number, kind: Kind, dur = DUR[kind]): Anim => ({ at, dur, kind });

/**
 * When each element of a scene moves, in scene seconds. `voice`: the scene's line, which the value
 * scene's pen notes wait on (chart-pen.tsx); without it they are left off.
 */
export function motionSpec(key: SceneKey, f: QuoteVideoFacts, voiceSec: number, voice?: string): Record<string, Anim> {
  switch (key) {
    case "lead":
      return {
        name: a(0.2, "fade"), shield: a(0, "stroke"), family: a(1.1, "pop"), kicker: a(0.8, "up"),
        big: a(1.1, "pop"), count: a(1.1, "count"), note: a(1.4, "fade"), mark: a(1.8, "fade"),
      };
    case "price": {
      const s: Record<string, Anim> = {
        coin0: a(0.2, "grow"), coin1: a(0.5, "grow"), coin2: a(0.8, "grow"), coin3: a(1.1, "pop"),
        small: a(0.5, "fade"), big: a(0.8, "pop"), unit: a(1.1, "fade"),
      };
      f.prices.forEach((_, i) => { s[`card${i}`] = a(1.4 + i * 0.8, "left"); });
      const main = f.prices.findIndex((p) => p.main);
      if (main >= 0) s.count = a(1.4 + main * 0.8, "count");
      f.pills.forEach((_, i) => { s[`pill${i}`] = a(4.0 + i * 1.2, "pop"); });
      if (f.priceNotes.length) s.notes = a(4.0, "fade");
      return s;
    }
    case "cover": {
      if (f.coverStyle === "payback") {
        // Global Savings: the small paybacks run out year by year, then the maturity rises, then what is certain in a card
        const mat = Math.max(2.4, voiceSec * 0.3);
        return {
          kicker: a(0.2, "up"), sub: a(0.5, "fade"), ticks: a(0.8, "grow", 1.6), tickLabel: a(1.6, "fade"), ends: a(1.0, "fade"),
          mat: a(mat, "grow"), matLabel: a(mat + 0.6, "pop"), card: a(Math.max(3.2, voiceSec * 0.55), "up"),
          pen: a(Math.max(3.8, voiceSec * 0.72), "pop"), note: a(Math.max(4.2, voiceSec * 0.85), "fade"),
        };
      }
      if (f.coverStyle === "flat") {
        // Protection Life: the bar drawn out from the insured's age to the term's end, then the rule
        return { kicker: a(0.2, "up"), sub: a(0.5, "fade"), bar: a(0.8, "grow", 1.4), ends: a(1.6, "fade"), years: a(2.0, "pop"), rule: a(Math.max(2.6, voiceSec * 0.6), "up"), pen: a(Math.max(3.2, voiceSec * 0.8), "fade") };
      }
      if (f.coverStyle === "steps" || f.coverStyle === "bands") {
        // บำนาญ 95's steps, มรดก's bands: each grown as the voice reaches it, more or less
        const s: Record<string, Anim> = { kicker: a(0.2, "up"), axis: a(0.3, "stroke", 1.0) };
        const n = Math.max(1, f.cover.length);
        f.cover.forEach((_, i) => {
          const at = 0.6 + (i * Math.max(1, voiceSec * 0.75)) / n;
          s[`bar${i}`] = a(at, "grow");
          s[`lab${i}`] = a(at + 0.4, "fade");
        });
        s.pen = a(Math.min(voiceSec, 0.8 + voiceSec * 0.75), "fade");
        return s;
      }
      if (f.coverStyle === "bars") {
        return {
          kicker: a(0.2, "up"), axis: a(0.3, "stroke", 1.2), m0: a(0.5, "pop"), bar0: a(0.8, "grow"), l0: a(1.4, "fade"),
          m1: a(1.6, "pop"), bar1: a(2.2, "grow"), l1: a(3.0, "fade"), m2: a(3.6, "pop"), ages: a(3.6, "fade"),
        };
      }
      const s: Record<string, Anim> = { kicker: a(0.2, "up") };
      const n = f.cover.length;
      // each row slides in as the voice reaches it, more or less
      f.cover.forEach((_, i) => { s[`row${i}`] = a(0.8 + (i * Math.max(1, voiceSec * 0.7)) / Math.max(1, n), "left"); });
      if (f.coverNote) s.note = a(Math.min(voiceSec, 0.8 + voiceSec * 0.7), "fade");
      return s;
    }
    case "value": {
      if (f.pension) return pensionValueSpec(voiceSec, voice);
      const late = Math.max(3.6, Math.min(8, voiceSec * 0.55));
      const s: Record<string, Anim> = {
        kicker: a(0.2, "up"), axes: a(0.2, "fade"), paid: a(0.4, "stroke", 1.6), cash: a(1.4, "stroke", 2.2),
        dot: a(late - 1.6, "pop"), card: a(late, "pop"), legend: a(0.8, "fade"), ages: a(0.3, "fade"),
      };
      // the pen notes (owner, 2026-10-13), each as the voice reaches it; the dot and the card come with the break-even's
      for (const cue of voice ? beatCues(penBeats(f), voice, voiceSec) : []) {
        s[`pen_${cue.beat}`] = a(cue.at, "stroke", CHART_WRITE[cue.beat]);
        if (cue.beat === "breakEven") {
          s.dot = a(cue.at, "pop");
          s.card = a(cue.at + 1.0, "pop");
        }
      }
      return s;
    }
    case "critical":
      // มรดก: the illness named, the lump sum popped in and counted up, the life cover staying on
      return {
        kicker: a(0.2, "up"), icon: a(0.4, "pop"), sub: a(0.9, "up"), big: a(1.3, "pop"), count: a(1.3, "count"),
        unit: a(1.6, "fade"), note: a(Math.max(2.6, voiceSec * 0.65), "up"), pill: a(Math.max(3.2, voiceSec * 0.8), "pop"),
      };
    case "terms": {
      // Protection Life: the terms in one after another, the chosen one popped, the total and the tax under them
      const s: Record<string, Anim> = { kicker: a(0.2, "up") };
      const n = f.plb?.terms.length ?? 0;
      for (let i = 0; i < n; i++) s[`row${i}`] = a(0.6 + i * 0.35, "left");
      s.on = a(Math.max(0.6 + n * 0.35, voiceSec * 0.4), "pop");
      s.total = a(Math.max(2.4, voiceSec * 0.6), "up");
      s.pill = a(Math.max(3.0, voiceSec * 0.8), "pop");
      s.note = a(Math.max(3.2, voiceSec * 0.85), "fade");
      return s;
    }
    case "index":
      // Global Savings: the return named, what comes back at it counted up, the seven bars grown, the picked one lit
      return {
        kicker: a(0.2, "up"), sub: a(0.5, "fade"), big: a(0.9, "pop"), count: a(0.9, "count"), bars: a(1.3, "grow", 1.4),
        on: a(Math.max(2.4, voiceSec * 0.35), "pop"), pill: a(Math.max(3.2, voiceSec * 0.7), "pop"), note: a(Math.max(3.6, voiceSec * 0.8), "fade"),
      };
    case "compare": {
      const s: Record<string, Anim> = { kicker: a(0.2, "up") };
      (f.compare ?? []).forEach((_, i) => { s[`col${i}`] = a(0.8 + i * 0.5, "pop"); });
      s.ring = a(0.8 + (f.compare?.length ?? 0) * 0.5 + 0.3, "stroke", 1.0);
      s.note = a(2.4, "fade");
      return s;
    }
    case "contact":
      return { title: a(0.2, "up"), card: a(0.8, "up"), note: a(1.4, "fade") };
    // the longer clips' scenes (told.ts): each line in as the voice reaches it, more or less
    case "story":
      return { kicker: a(0.2, "up"), face: a(0.4, "pop"), ...spread("pt", 3, voiceSec, 1.0) };
    case "qa":
      return { kicker: a(0.2, "up"), q0: a(0.6, "left"), a0: a(1.2, "fade"), q1: a(Math.max(2, voiceSec * 0.5), "left"), a1: a(Math.max(2.6, voiceSec * 0.5 + 0.6), "fade") };
    case "versus":
      return { kicker: a(0.2, "up"), left: a(0.6, "left"), vs: a(Math.max(1.4, voiceSec * 0.35), "pop"), right: a(Math.max(1.8, voiceSec * 0.4), "pop"), count: a(Math.max(1.8, voiceSec * 0.4), "count"), note: a(Math.max(3, voiceSec * 0.7), "fade") };
    case "steps":
      return { kicker: a(0.2, "up"), ...spread("st", 3, voiceSec, 0.9) };
  }
}

/** n items brought in one after another over the first 80% of the voice, named prefix0, prefix1, … */
function spread(prefix: string, n: number, voiceSec: number, from: number): Record<string, Anim> {
  const out: Record<string, Anim> = {};
  for (let i = 0; i < n; i++) out[`${prefix}${i}`] = a(from + (i * Math.max(1, voiceSec * 0.8 - from)) / n, "left");
  return out;
}

/**
 * บำนาญ 95's value scene: the years drawn out left to right, then the fifteen guaranteed pensions
 * bracketed when the voice says "15", and the total pension counted up when it says "รวม".
 */
function pensionValueSpec(voiceSec: number, voice?: string): Record<string, Anim> {
  const words = voice ? wordTimes(voice, voiceSec) : [];
  const cue = (re: RegExp, share: number) => words.find((w) => re.test(w.word))?.from ?? LEAD + share * voiceSec;
  const fifteen = Math.max(1.4, cue(/^15$|รับประกัน/, 0.1));
  const total = Math.max(fifteen + 1.6, cue(/^รวม/, 0.7));
  return {
    kicker: a(0.2, "up"), axes: a(0.2, "fade"), ages: a(0.3, "fade"), bars: a(0.4, "stroke", 2.6), legend: a(1.0, "fade"),
    brace: a(fifteen, "stroke", 1.0), guarantee: a(fifteen + 0.4, "fade"), card: a(total, "pop"), count: a(total, "count"),
  };
}

/** the windows a scene moves in, for the frames timeline.ts draws */
export const motionWindows = (key: SceneKey, f: QuoteVideoFacts, voiceSec: number, voice?: string): [number, number][] =>
  Object.values(motionSpec(key, f, voiceSec, voice)).map((x) => [x.at, x.at + x.dur]);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

/** How an element looks at scene time t: its opacity and transform, from its kind. */
export function look(an: Anim | undefined, t: number): { opacity: number; transform?: string; p: number } {
  if (!an) return { opacity: 1, p: 1 };
  const p = clamp01((t - an.at) / an.dur);
  if (p <= 0 && an.kind !== "stroke" && an.kind !== "count") return { opacity: 0, p: 0 };
  switch (an.kind) {
    case "up": return { opacity: easeOut(p), transform: `translateY(${Math.round((1 - easeOut(p)) * 70)}px)`, p };
    case "left": return { opacity: easeOut(p), transform: `translateX(${Math.round((1 - easeOut(p)) * -90)}px)`, p };
    case "pop": { const s = 0.4 + 0.6 * easeBack(p); return { opacity: clamp01(p * 2), transform: `scale(${s.toFixed(3)})`, p }; }
    case "grow": return { opacity: p > 0 ? 1 : 0, p: easeOut(p) };
    case "fade": return { opacity: easeOut(p), p };
    case "stroke": return { opacity: 1, p: easeOut(p) };
    case "count": return { opacity: 1, p };
  }
}

export interface MotionContext {
  facts: QuoteVideoFacts;
  /** โจทย์การเล่า (told.ts): the hook's headline over the opening, whether the clip loops, the longer clips' scenes */
  headline?: string[];
  loop?: boolean;
  extra?: Extra;
  customer: string;
  narrator?: "F" | "M";
  contact: { name: string; phone: string; line?: string; more?: string; photo?: string };
  words: string[];
  voiceSec: number;
  /** the opening's picture where the clip's theme has its own (themes.tsx); the shield and the family otherwise */
  hero?: (s: Record<string, Anim>, t: number, w: number, h: number) => ReactNode;
}

export const abs = (s: React.CSSProperties): React.CSSProperties => ({ display: "flex", position: "absolute", ...s });
export const box = (s: React.CSSProperties = {}): React.CSSProperties => ({ display: "flex", ...s });
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

export function El({ an, t, style, children }: { an?: Anim; t: number; style: React.CSSProperties; children?: ReactNode }) {
  const l = look(an, t);
  return <div style={{ display: "flex", ...style, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) }}>{children}</div>;
}

function Header({ f, title }: { f: QuoteVideoFacts; title: string }) {
  return (
    <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 70, justifyContent: "space-between", fontSize: 36, color: WHITE, opacity: 0.85 })}>
      <div style={box({})}>{title}</div>
      <div style={box({})}>{f.insuredWho}</div>
    </div>
  );
}

/** the piece of the line the voice is on (caption.ts), one line of the band at most */
export function Subtitle({ words, t, voiceSec }: { words: string[]; t: number; voiceSec: number }) {
  const times = wordTimes(words.join(" "), voiceSec);
  const shown = captionShown(words, (W - 128) / 41, wordAt(words, t, voiceSec, LEAD));
  return (
    <div style={abs({ left: 36, width: W - 72, bottom: 96, justifyContent: "center" })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", background: "rgba(0,0,0,0.45)", borderRadius: 30, padding: "18px 28px", fontSize: 41, lineHeight: 1.45 })}>
        {shown.map((i, k) => {
          const color = t >= times[i].to ? WHITE : t >= times[i].from ? GOLD : "rgba(255,255,255,0.55)";
          return <div key={i} style={box({ color, marginRight: k < shown.length - 1 ? 12 : 0 })}>{words[i]}</div>;
        })}
      </div>
    </div>
  );
}

/**
 * A path drawn as p goes 0 → 1. A plain function, not a component: the drawing library drops a
 * component rendered inside an <svg> (the same reason insured-face.tsx is one).
 */
export function stroke({ d, len, p, color, width, cap = "round" }: { d: string; len: number; p: number; color: string; width: number; cap?: "round" | "butt" }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap={cap} strokeLinejoin="round" strokeDasharray={`${len} ${len}`} strokeDashoffset={Math.round(len * (1 - p))} />;
}

/** the shield drawn and the family popped into it, in a w×h box: the opening's picture */
export function shieldFamily(s: Record<string, Anim>, t: number, w: number, h: number) {
  return (
    <div style={box({ position: "relative", width: w, height: h, flexShrink: 0 })}>
      <svg width={w} height={h} viewBox="0 0 120 130">
        {stroke({ d: "M60 8 L108 26 V62 C108 94 86 114 60 124 C34 114 12 94 12 62 V26 Z", len: 330, p: look(s.shield, t).p, color: GOLD, width: 5 })}
      </svg>
      <El an={s.family} t={t} style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
        <svg width={w} height={h} viewBox="0 0 120 130">
          <circle cx={45} cy={56} r={9} fill={WHITE} /><circle cx={75} cy={56} r={9} fill={WHITE} /><circle cx={60} cy={74} r={7} fill={WHITE} />
          <path d="M30 96 C32 76 58 76 60 96 Z M60 96 C62 76 88 76 90 96 Z" fill={WHITE} />
        </svg>
      </El>
    </div>
  );
}

/**
 * มรดก's opening (owner, 2026-10-14, mockup https://claude.ai/artifact/55oEG3PjdupXzKPkTHbU75):
 * the shield and the family, the legacy in gold, the most the family receives counted up in a
 * highlighted band, who it is for.
 */
function LegacyLead({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const big = leadBig(f);
  const s = motionSpec("lead", f, c.voiceSec);
  const n = countAt(f.lead.baht, look(s.count, t).p);
  const head = c.headline?.length ?? 0;
  const y = head ? 120 : 0;
  return (
    <>
      <Header f={f} title={f.planLine} />
      {c.customer && <El an={s.name} t={t} style={{ position: "absolute", left: SIDE, top: 170, fontSize: 42, color: WHITE }}>จัดทำสำหรับ <span style={{ color: GOLD, fontWeight: 600, marginLeft: 12 }}>คุณ{c.customer}</span></El>}
      {head ? (
        <div style={abs({ left: SIDE, width: W - SIDE * 2, top: c.customer ? 250 : 190, flexDirection: "column", alignItems: "center" })}>
          {c.headline!.map((h, i) => <div key={i} style={box({ fontSize: 62, fontWeight: 700, color: i === 0 ? WHITE : GOLD, lineHeight: 1.25 })}>{h}</div>)}
        </div>
      ) : null}
      <div style={abs({ left: (W - 330) / 2, top: 280 + y, width: 330, height: 355 })}>{c.hero ? c.hero(s, t, 330, 355) : shieldFamily(s, t, 330, 355)}</div>
      <El an={s.kicker} t={t} style={{ position: "absolute", left: 0, width: W, top: 650 + y, justifyContent: "center", fontSize: 50, fontWeight: 600, color: WHITE, opacity: 0.9 }}>{f.planLine}</El>
      <El an={s.big} t={t} style={{ position: "absolute", left: 0, width: W, top: 760 + y, justifyContent: "center", fontSize: big.length > 16 ? 112 : 140, fontWeight: 700, color: GOLD, lineHeight: 1.1 }}>{big}</El>
      <El an={s.note} t={t} style={{ position: "absolute", left: 0, width: W, top: 945 + y, justifyContent: "center", fontSize: 46, color: WHITE }}>{f.lead.label}</El>
      <El an={s.mark} t={t} style={{ position: "absolute", left: 0, width: W, top: 1025 + y, justifyContent: "center" }}>
        <div style={box({ background: GOLD, color: NAVY, borderRadius: 44, padding: "6px 40px", fontSize: 72, fontWeight: 700 })}>{`${n.toLocaleString("en-US")} บาท`}</div>
      </El>
      <El an={s.mark} t={t} style={{ position: "absolute", left: 0, width: W, top: 1170 + y, justifyContent: "center" }}>
        <div style={box({ border: `3px solid ${WHITE}`, color: WHITE, borderRadius: 40, padding: "4px 30px", fontSize: 40 })}>{leadPill(f)}</div>
      </El>
    </>
  );
}

function Lead({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  if (f.legacy || f.plb || f.gsaving) return <LegacyLead c={c} t={t} />;
  const s = motionSpec("lead", f, c.voiceSec);
  const shield = look(s.shield, t).p;
  const n = countAt(f.lead.baht, look(s.count, t).p);
  const vw = wordsOf(f);
  return (
    <>
      <Header f={f} title={f.planLine} />
      {c.customer && <El an={s.name} t={t} style={{ position: "absolute", left: SIDE, top: 170, fontSize: 42, color: WHITE }}>{preparedLine(vw, c.customer).map((p, i) => <span key={i} style={{ ...(p.name ? { color: GOLD, fontWeight: 600 } : {}), marginLeft: i ? 12 : 0 }}>{p.text}</span>)}</El>}
      {c.headline?.length ? (
        // the hook's headline above the shield (owner, 2026-10-13, mockup §5): there from the first frame
        <div style={abs({ left: SIDE, width: W - SIDE * 2, top: c.customer ? 250 : 190, flexDirection: "column", alignItems: "center" })}>
          {c.headline.map((h, i) => <div key={i} style={box({ fontSize: 62, fontWeight: 700, color: i === 0 ? WHITE : GOLD, lineHeight: 1.25 })}>{h}</div>)}
        </div>
      ) : null}
      <div style={abs({ left: (W - 400) / 2, top: c.headline?.length ? 400 : 290, width: 400, height: c.headline?.length ? 340 : 430 })}>
        {c.hero ? c.hero(s, t, 400, c.headline?.length ? 340 : 430) : <>
        <svg width={400} height={c.headline?.length ? 340 : 430} viewBox="0 0 120 130">
          {stroke({ d: "M60 8 L108 26 V62 C108 94 86 114 60 124 C34 114 12 94 12 62 V26 Z", len: 330, p: shield, color: GOLD, width: 5 })}
        </svg>
        <El an={s.family} t={t} style={{ position: "absolute", left: 0, top: 0, width: 400, height: c.headline?.length ? 340 : 430 }}>
          <svg width={400} height={c.headline?.length ? 340 : 430} viewBox="0 0 120 130">
            <circle cx={45} cy={56} r={9} fill={WHITE} /><circle cx={75} cy={56} r={9} fill={WHITE} /><circle cx={60} cy={74} r={7} fill={WHITE} />
            <path d="M30 96 C32 76 58 76 60 96 Z M60 96 C62 76 88 76 90 96 Z" fill={WHITE} />
          </svg>
        </El>
        </>}
      </div>
      <El an={s.kicker} t={t} style={{ position: "absolute", left: 0, width: W, top: 760, justifyContent: "center", fontSize: 58, fontWeight: 600, color: WHITE }}>{f.lead.label}</El>
      <El an={s.big} t={t} style={{ position: "absolute", left: 0, width: W, top: 850, justifyContent: "center", fontSize: f.lead.amount.length > 9 ? 130 : 150, fontWeight: 700, color: GOLD }}>{n.toLocaleString("en-US")}</El>
      <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1040, justifyContent: "center", fontSize: 38, color: WHITE, opacity: 0.85 }}>{`${vw.baht}${f.lead.note ? ` · ${f.lead.note}` : ""}`}</El>
      <El an={s.mark} t={t} style={{ position: "absolute", left: 0, width: W, top: 1130, justifyContent: "center" }}>
        <div style={box({ background: GOLD, color: NAVY, borderRadius: 40, padding: "8px 34px", fontSize: 44, fontWeight: 600 })}>{f.leadMark}</div>
      </El>
    </>
  );
}

function Price({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("price", f, c.voiceSec);
  const coin = (k: number, y: number) => {
    const l = look(s[`coin${k}`], t);
    return (
      <g key={k} transform={`translate(0 ${Math.round((1 - l.p) * 12)})`} opacity={l.opacity}>
        <ellipse cx={35} cy={y} rx={26} ry={7} fill={GOLD} /><rect x={9} y={y - 8} width={52} height={8} fill={C.coinSide} />
      </g>
    );
  };
  const main = f.prices.find((p) => p.main);
  const daily = f.perDayAmount;
  const vw = wordsOf(f);
  // under the price cards: four of them (บำนาญ 95 lists every instalment) reach further down
  const pillsTop = Math.max(1100, 560 + f.prices.length * 150 + 10);
  return (
    <>
      <Header f={f} title={f.priceTitle} />
      <div style={abs({ left: SIDE, top: 210, alignItems: "flex-end" })}>
        <svg width={230} height={300} viewBox="0 0 70 90">
          {coin(0, 80)}{coin(1, 66)}{coin(2, 52)}
          <g opacity={look(s.coin3, t).opacity}><ellipse cx={35} cy={38} rx={26} ry={7} fill={C.coinTop} /></g>
        </svg>
        <div style={box({ flexDirection: "column", marginLeft: 40 })}>
          <El an={s.small} t={t} style={{ fontSize: 42, color: WHITE }}>{f.priceBig?.label ?? (daily ? "ตกวันละ" : vw.firstYearMonthly)}</El>
          <El an={s.big} t={t} style={{ fontSize: 170, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{f.priceBig?.amount ?? daily ?? main?.amount ?? ""}</El>
          <El an={s.unit} t={t} style={{ fontSize: 42, color: WHITE }}>{f.priceBig?.unit ?? (daily ? "บาทเท่านั้น" : vw.baht)}</El>
        </div>
      </div>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 560, flexDirection: "column" })}>
        {f.prices.map((r, i) => (
          <El key={r.label} an={s[`card${i}`]} t={t} style={{
            justifyContent: "space-between", alignItems: "center", borderRadius: 36, padding: "20px 40px", marginBottom: 22,
            background: r.main ? WHITE : "rgba(255,255,255,0.1)", border: `3px solid ${r.main ? WHITE : "rgba(255,255,255,0.22)"}`,
            color: r.main ? NAVY : WHITE, fontSize: 44,
          }}>
            <div style={box({})}>{r.label}</div>
            <div style={box({ fontWeight: 700, fontSize: r.main ? 64 : 50 })}>{r.main ? countAt(num(r.amount), look(s.count, t).p).toLocaleString("en-US") : r.amount}</div>
          </El>
        ))}
      </div>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: pillsTop, flexWrap: "wrap" })}>
        {f.pills.map((pill, i) => (
          <El key={pill} an={s[`pill${i}`]} t={t} style={{ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 30px", fontSize: 38, fontWeight: 600, marginRight: 22, marginBottom: 16 }}>{`✓ ${pill}`}</El>
        ))}
      </div>
      {f.priceNotes.length > 0 && (
        <El an={s.notes} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: f.pills.length ? pillsTop + 96 : 1120, flexDirection: "column", fontSize: 34, color: WHITE, opacity: 0.85 }}>
          {f.priceNotes.map((n) => <div key={n} style={box({ marginBottom: 10 })}>{n}</div>)}
        </El>
      )}
    </>
  );
}

function CoverBars({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  const [first, second] = f.cover;
  const before = Number(first.label.match(/(\d+)/)?.[1] ?? f.coverToAge);
  const x0 = 60;
  const x2 = 1000;
  const x1 = second ? Math.round(x0 + ((before - f.age) / Math.max(1, f.coverToAge - f.age)) * (x2 - x0)) : x2;
  const base = 560;
  const h0 = 300;
  const h1 = second ? Math.round(h0 * (num(second.amount) / Math.max(1, num(first.amount)))) : 0;
  const bar = (an: Anim, x: number, w: number, h: number, color: string) => {
    const g = look(an, t);
    return g.opacity ? <rect x={x} y={base - Math.round(h * g.p)} width={w} height={Math.round(h * g.p)} rx={18} fill={color} /> : null;
  };
  const mark = (an: Anim, x: number, color: string) => {
    const l = look(an, t);
    return l.opacity ? <circle cx={x} cy={base} r={Math.round(22 * Math.max(0.3, Math.min(1.1, 0.4 + 0.6 * easeBack(l.p))))} fill={color} /> : null;
  };
  const words = (an: Anim, x: number, y: number, text: string, color: string) => (
    <El an={an} t={t} style={{ position: "absolute", left: x - 200, width: 400, top: y, justifyContent: "center", fontSize: 56, fontWeight: 700, color }}>{text}</El>
  );
  const million = (b: number) => `${(b / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  return (
    <>
      <Header f={f} title={f.coverTitle} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 60, fontWeight: 600, color: WHITE }}>{`คุ้มครองยาวถึงอายุ ${f.coverToAge}`}</El>
      <div style={abs({ left: 40, top: 360, width: 1040, height: 760 })}>
        <svg width={1040} height={760} viewBox="0 0 1040 760">
          {bar(s.bar0, x0, x1 - x0, h0, GOLD)}
          {second ? bar(s.bar1, x1, x2 - x1, h1, SKY) : null}
          {stroke({ d: `M${x0} ${base} L${x2} ${base}`, len: x2 - x0, p: look(s.axis, t).p, color: WHITE, width: 12 })}
          {mark(s.m0, x0, WHITE)}{second ? mark(s.m1, x1, WHITE) : null}{mark(s.m2, x2, GOLD)}
        </svg>
        {words(s.l0, (x0 + x1) / 2, base - Math.round(h0 / 2) - 40, million(num(first.amount)), NAVY)}
        {second ? words(s.l1, (x1 + x2) / 2, base - Math.round(h1 / 2) - 40, million(num(second.amount)), WHITE) : null}
        <El an={s.ages} t={t} style={{ position: "absolute", left: 0, top: base + 40, width: 1040, height: 80 }}>
          <div style={abs({ left: x0 - 60, width: 120, justifyContent: "center", fontSize: 44, color: WHITE })}>{String(f.age)}</div>
          {second ? <div style={abs({ left: x1 - 60, width: 120, justifyContent: "center", fontSize: 44, color: WHITE })}>{String(before)}</div> : null}
          <div style={abs({ left: x2 - 60, width: 120, justifyContent: "center", fontSize: 44, color: GOLD })}>{String(f.coverToAge)}</div>
        </El>
      </div>
    </>
  );
}

/**
 * มรดก: what the family receives by age, as a staircase (legacy.ts stairs) — each bar as wide as
 * its years and as tall as its sum, grown in turn, its sum over it and its ages under it.
 * Shared by the portrait and the wide clips (`w`×`h`: the drawing's room).
 */
export function legacyStairs(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, h: number, big = 1) {
  const bands = f.legacy?.bands ?? [];
  const labels = Math.round(80 * big);
  const above = Math.round(80 * big);
  const base = h - labels;
  const tall = base - above;
  const bars = stairs(bands, w, tall, Math.round(150 * big), Math.round(60 * big));
  const gap = Math.round(6 * big);
  const color = (i: number) => (i === 0 ? GOLD : i === 1 ? SKY : "rgba(255,255,255,0.45)");
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {bars.map((b, i) => {
          const g = look(s[`bar${i}`], t);
          const bh = Math.round(b.h * g.p);
          return g.opacity ? <rect key={b.band.from} x={b.x + gap} y={base - bh} width={b.w - gap * 2} height={bh} rx={Math.round(14 * big)} fill={color(i)} /> : null;
        })}
        {stroke({ d: `M0 ${base} L${w} ${base}`, len: w, p: look(s.axis, t).p, color: WHITE, width: Math.round(8 * big) })}
      </svg>
      {bars.map((b, i) => (
        <El key={b.band.from} an={s[`lab${i}`]} t={t} style={{ position: "absolute", left: b.x, top: 0, width: b.w, height: h }}>
          <div style={abs({ left: 0, width: b.w, top: base - b.h - Math.round(66 * big), justifyContent: "center", fontSize: Math.round(46 * big), fontWeight: 700, color: i === 0 ? GOLD : WHITE })}>{shortBaht(b.band.amount)}</div>
          <div style={abs({ left: 0, width: b.w, top: base + Math.round(14 * big), justifyContent: "center", fontSize: Math.round(36 * big), color: WHITE, opacity: 0.85 })}>{bandAges(b.band, i, bands)}</div>
        </El>
      ))}
    </div>
  );
}

function CoverBands({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 700, color: WHITE }}>{f.coverTitle}</El>
      <div style={abs({ left: SIDE, top: 330, width: W - SIDE * 2, height: 620 })}>{legacyStairs(f, s, t, W - SIDE * 2, 620)}</div>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 990, flexDirection: "column" })}>
        {f.cover.map((r, i) => (
          <El key={r.label} an={s[`lab${i}`]} t={t} style={{ justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.1)", borderRadius: 28, padding: "12px 30px", marginBottom: 14, fontSize: 40, color: WHITE }}>
            <div style={box({})}>{r.label}</div>
            <div style={box({ fontWeight: 700, color: i === 0 ? GOLD : WHITE })}>{`${r.amount} บาท`}</div>
          </El>
        ))}
      </div>
    </>
  );
}

/**
 * มรดก's fourth scene (owner, 2026-10-14): the illness named, a heart with a cross, the lump sum
 * the insured receives counted up, and the life cover that stays on for the family.
 */
function Critical({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const l = f.legacy;
  const s = motionSpec("critical", f, c.voiceSec);
  if (!l) return null;
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 190, justifyContent: "center", fontSize: 54, fontWeight: 700, color: WHITE }}>{`ตรวจพบโรคร้ายแรง 1 ใน ${l.diseaseCount} โรค`}</El>
      <El an={s.icon} t={t} style={{ position: "absolute", left: (W - 240) / 2, top: 300, width: 240, height: 240 }}>{heartCross(240)}</El>
      <El an={s.sub} t={t} style={{ position: "absolute", left: 0, width: W, top: 580, justifyContent: "center", fontSize: 54, color: WHITE }}>รับเงินก้อนไว้รักษาตัวเอง</El>
      <El an={s.big} t={t} style={{ position: "absolute", left: 0, width: W, top: 670, justifyContent: "center" }}>
        <div style={box({ background: GOLD, color: NAVY, borderRadius: 50, padding: "0 50px", fontSize: 150, fontWeight: 700, lineHeight: 1.2 })}>{countAt(l.critical, look(s.count, t).p).toLocaleString("en-US")}</div>
      </El>
      <El an={s.unit} t={t} style={{ position: "absolute", left: 0, width: W, top: 880, justifyContent: "center", fontSize: 50, color: WHITE }}>บาท</El>
      <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 990, flexDirection: "column", alignItems: "center", background: WHITE, color: NAVY, borderRadius: 36, padding: "26px 36px" }}>
        <div style={box({ fontSize: 44, fontWeight: 700 })}>จ่ายครั้งเดียว</div>
        <div style={box({ fontSize: 42 })}>ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว</div>
      </El>
      <El an={s.pill} t={t} style={{ position: "absolute", left: 0, width: W, top: 1220, justifyContent: "center" }}>
        <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 32px", fontSize: 40, fontWeight: 600 })}>{`✓ โรคร้ายแรงคุ้มครองถึงอายุ ${l.criticalToAge}`}</div>
      </El>
    </>
  );
}

/**
 * Protection Life's cover (owner, 2026-10-14): one flat bar drawn out from the insured's age to the
 * term's end, the whole sum on it every year, the years under it. Shared by the portrait and the
 * wide clips (`w`: the bar's width; `big`: the type's scale).
 */
export function plbTimeline(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, big = 1) {
  const p = f.plb;
  if (!p) return null;
  const g = look(s.bar, t);
  const barH = Math.round(170 * big);
  const bw = Math.max(Math.round(20 * big), Math.round(w * g.p));
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ position: "relative", width: w, height: barH })}>
        {g.opacity ? (
          <div style={abs({ left: 0, top: 0, width: bw, height: barH, background: GOLD, borderRadius: Math.round(26 * big), alignItems: "center", justifyContent: "center", overflow: "hidden" })}>
            {g.p >= 0.98 ? <div style={box({ fontSize: Math.round(62 * big), fontWeight: 700, color: NAVY })}>{`${f.lead.amount} บาท ทุกปี`}</div> : null}
          </div>
        ) : null}
      </div>
      <El an={s.ends} t={t} style={{ width: w, marginTop: Math.round(18 * big), justifyContent: "space-between", alignItems: "center", fontSize: Math.round(42 * big), color: WHITE }}>
        <div style={box({})}>{`อายุ ${f.age}`}</div>
        <El an={s.years} t={t} style={{ background: WHITE, color: NAVY, borderRadius: 40, padding: `${Math.round(4 * big)}px ${Math.round(30 * big)}px`, fontSize: Math.round(46 * big), fontWeight: 700 }}>{`${p.years} ปี`}</El>
        <div style={box({})}>{`อายุ ${p.endAge}`}</div>
      </El>
    </div>
  );
}

function CoverFlat({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const p = f.plb;
  const s = motionSpec("cover", f, c.voiceSec);
  if (!p) return null;
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 700, color: WHITE }}>{f.coverTitle}</El>
      <El an={s.sub} t={t} style={{ position: "absolute", left: SIDE, top: 300, fontSize: 46, color: WHITE, opacity: 0.9 }}>{f.cover[0]?.label ?? ""}</El>
      <El an={s.kicker} t={t} style={{ position: "absolute", left: (W - 260) / 2, top: 400, width: 260, height: 280 }}>{shieldFamily({ shield: a(0, "stroke"), family: a(0.6, "pop") }, t, 260, 280)}</El>
      <div style={abs({ left: SIDE, top: 760, width: W - SIDE * 2 })}>{plbTimeline(f, s, t, W - SIDE * 2)}</div>
      <El an={s.rule} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1090, justifyContent: "center" }}>
        <div style={box({ background: WHITE, color: NAVY, borderRadius: 36, padding: "22px 40px", fontSize: 50, fontWeight: 700 })}>จ่ายเท่าไหร่ คุ้มครองเท่านั้นปี</div>
      </El>
      <El an={s.pen} t={t} style={{ position: "absolute", left: 0, width: W, top: 1250, justifyContent: "center" }}>
        <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 32px", fontSize: 40, fontWeight: 600 })}>{`✓ คุ้มครองถึงอายุ ${p.endAge}`}</div>
      </El>
    </>
  );
}

/**
 * Protection Life's terms (owner, 2026-10-14) as cards in a column, the chosen one gold, the whole
 * term's total under them, the tax pill only for 10–15 years and the plain fact in small type.
 * Shared by the portrait and the wide clips (`w`: the column's width).
 */
export function plbTermCards(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, big = 1) {
  const p = f.plb;
  if (!p) return null;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {p.terms.map((r, i) => (
        <El key={r.years} an={r.on ? s.on : s[`row${i}`]} t={t} style={{
          justifyContent: "space-between", alignItems: "center", width: w, borderRadius: Math.round(32 * big),
          padding: `${Math.round((r.on ? 24 : 18) * big)}px ${Math.round(36 * big)}px`, marginBottom: Math.round(18 * big),
          background: r.on ? GOLD : "rgba(255,255,255,0.1)", border: `3px solid ${r.on ? GOLD : "rgba(255,255,255,0.22)"}`,
          color: r.on ? NAVY : WHITE, fontSize: Math.round((r.on ? 48 : 42) * big), fontWeight: r.on ? 700 : 400,
        }}>
          <div style={box({})}>{`${r.years} ปี · ถึง ${r.endAge}`}</div>
          <div style={box({})}>{`${r.annual}/ปี`}</div>
        </El>
      ))}
    </div>
  );
}

function Terms({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const p = f.plb;
  const s = motionSpec("terms", f, c.voiceSec);
  if (!p) return null;
  const after = 330 + p.terms.length * 140 + 30;
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 700, color: WHITE }}>เลือกระยะได้ตามภาระ</El>
      <div style={abs({ left: SIDE, top: 330, width: W - SIDE * 2 })}>{plbTermCards(f, s, t, W - SIDE * 2)}</div>
      <El an={s.total} t={t} style={{ position: "absolute", left: 0, width: W, top: after, justifyContent: "center", fontSize: 52, color: WHITE }}>
        รวมจ่าย {p.years} ปี <span style={{ color: GOLD, fontWeight: 700, marginLeft: 14 }}>{`${p.total} บาท`}</span>
      </El>
      {p.tax && (
        <El an={s.pill} t={t} style={{ position: "absolute", left: 0, width: W, top: after + 110, justifyContent: "center" }}>
          <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 32px", fontSize: 42, fontWeight: 600 })}>✓ ลดหย่อนภาษีได้</div>
        </El>
      )}
      <El an={s.note} t={t} style={{ position: "absolute", left: 0, width: W, top: after + (p.tax ? 220 : 110), justifyContent: "center", fontSize: 32, color: WHITE, opacity: 0.75 }}>ความคุ้มครองล้วน ครบสัญญาไม่มีเงินคืน</El>
    </>
  );
}

/**
 * Global Savings' guaranteed money (owner, 2026-10-20): the small yearly paybacks as a row of short
 * bars, then the maturity rising far above them in gold. Shared by the portrait and the wide clips
 * (`w`: the drawing's width; `big`: the type's scale).
 */
export function gsPayback(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, big = 1) {
  const g = f.gsaving;
  if (!g) return null;
  const h = Math.round(360 * big);
  const matW = Math.round(w * 0.17);
  const n = g.term - 1;
  const step = (w - matW - Math.round(28 * big)) / n;
  const tickW = Math.max(6, Math.round(step * 0.55));
  const tickH = Math.round(h * 0.1);
  const shown = Math.round(n * look(s.ticks, t).p);
  const m = look(s.mat, t);
  const matH = Math.round(h * 0.78);
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ position: "relative", width: w, height: h })}>
        {Array.from({ length: shown }, (_, i) => (
          <div key={i} style={abs({ left: Math.round(i * step), top: h - tickH, width: tickW, height: tickH, background: SKY, borderRadius: "6px 6px 0 0" })} />
        ))}
        <El an={s.tickLabel} t={t} style={{ position: "absolute", left: 0, top: h - tickH - Math.round(66 * big), fontSize: Math.round(40 * big), color: WHITE }}>{`ปีละ ${gsMoney(g.payback)}`}</El>
        {m.opacity ? (
          <div style={abs({ left: w - matW, top: h - Math.max(4, Math.round(matH * m.p)), width: matW, height: Math.max(4, Math.round(matH * m.p)), background: GOLD, borderRadius: "12px 12px 0 0" })} />
        ) : null}
        <El an={s.matLabel} t={t} style={{ position: "absolute", right: 0, top: h - matH - Math.round(74 * big), fontSize: Math.round(54 * big), fontWeight: 700, color: GOLD }}>{gsMoney(g.maturity)}</El>
        <div style={abs({ left: 0, top: h, width: w, height: 4, background: "rgba(255,255,255,0.55)" })} />
      </div>
      <El an={s.ends} t={t} style={{ width: w, marginTop: Math.round(18 * big), justifyContent: "space-between", fontSize: Math.round(38 * big), color: WHITE }}>
        <div style={box({})}>ปีที่ 1</div>
        <div style={box({})}>{`ปีที่ ${g.term - 1}`}</div>
        <div style={box({ color: GOLD, fontWeight: 700 })}>{`ปีที่ ${g.term}`}</div>
      </El>
    </div>
  );
}

/** the guaranteed money as a white card: the paybacks, the maturity, the two together */
export function gsSureCard(f: QuoteVideoFacts, w: number, big = 1) {
  return (
    <div style={box({ flexDirection: "column", width: w, background: WHITE, color: NAVY, borderRadius: Math.round(30 * big), padding: `${Math.round(22 * big)}px ${Math.round(34 * big)}px` })}>
      {f.cover.map((r, i) => (
        <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: i ? Math.round(10 * big) : 0, fontSize: Math.round((r.mark || i === f.cover.length - 1 ? 40 : 36) * big), fontWeight: i === f.cover.length - 1 ? 700 : 400 })}>
          <div style={box({ flexShrink: 1, marginRight: 20 })}>{r.label}</div>
          <div style={box({ fontWeight: 700 })}>{r.amount}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Global Savings' fourth scene (owner, 2026-10-20): the seven index returns, −1% to +5%, as bars —
 * the same guaranteed base under every one, the bonus on top, the return the agent picked in gold.
 * Shared by the portrait and the wide clips.
 */
export function gsIndexBars(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, h: number, big = 1) {
  const g = f.gsaving;
  if (!g) return null;
  const grow = look(s.bars, t).p;
  const on = look(s.on, t).p;
  const top = Math.max(...g.bars.map((b) => b.total)) * 1.05;
  const gap = Math.round(12 * big);
  const bw = (w - gap * (g.bars.length - 1)) / g.bars.length;
  const labelH = Math.round(58 * big);
  const chartH = h - labelH;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ position: "relative", width: w, height: chartH })}>
        {g.bars.map((b, i) => {
          const baseH = Math.round((g.guaranteed / top) * chartH * grow);
          const bonusH = Math.round(((b.total - g.guaranteed) / top) * chartH * grow);
          const lit = b.on && on > 0;
          return (
            <div key={b.rate} style={abs({ left: Math.round(i * (bw + gap)), top: 0, width: Math.round(bw), height: chartH, flexDirection: "column", justifyContent: "flex-end" })}>
              {bonusH > 1 ? <div style={box({ width: "100%", height: bonusH, background: lit ? GOLD : SKY, borderRadius: "10px 10px 0 0" })} /> : null}
              <div style={box({ width: "100%", height: Math.max(2, baseH), background: "rgba(255,255,255,0.88)", ...(lit ? { boxShadow: `inset 0 0 0 ${Math.round(5 * big)}px ${GOLD}` } : {}), ...(bonusH > 1 ? {} : { borderRadius: "10px 10px 0 0" }) })} />
            </div>
          );
        })}
      </div>
      <div style={box({ width: w, height: labelH, marginTop: Math.round(8 * big) })}>
        {g.bars.map((b, i) => (
          <div key={b.rate} style={box({ width: Math.round(bw), marginLeft: i ? gap : 0, justifyContent: "center", fontSize: Math.round((b.on ? 38 : 32) * big), fontWeight: b.on ? 700 : 400, color: b.on && on > 0 ? GOLD : WHITE, opacity: b.on ? 1 : 0.8 })}>{rateLabel(b.rate)}</div>
        ))}
      </div>
    </div>
  );
}

/** the fourth scene's words over the bars: the return, and what comes back at it */
export function gsIndexHead(f: QuoteVideoFacts) {
  const g = f.gsaving!;
  const up = g.rate > 0;
  return {
    sub: `${up ? "ถ้าดัชนีโตเฉลี่ยปีละ" : "ถ้าดัชนีเฉลี่ยปีละ"} ${rateLabel(g.rate)}`,
    label: up ? "รวมรับประมาณ" : "รวมรับ (การันตี)",
    pill: up ? `โบนัส ${gsMoney(g.bonus10 + g.bonus15)} บาท ไม่การันตี` : `✓ ยังได้การันตี ${gsMoney(g.guaranteed)} เต็ม`,
    up,
  };
}

function CoverPayback({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  if (!f.gsaving) return null;
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 700, color: WHITE }}>{f.coverTitle}</El>
      <El an={s.sub} t={t} style={{ position: "absolute", left: SIDE, top: 300, fontSize: 44, color: WHITE, opacity: 0.9 }}>ส่วนการันตี ได้แน่นอน</El>
      <div style={abs({ left: SIDE, top: 430, width: W - SIDE * 2 })}>{gsPayback(f, s, t, W - SIDE * 2)}</div>
      <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, top: 930, width: W - SIDE * 2 }}>{gsSureCard(f, W - SIDE * 2)}</El>
      <El an={s.pen} t={t} style={{ position: "absolute", left: 0, width: W, top: 1200, justifyContent: "center" }}>
        <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 32px", fontSize: 42, fontWeight: 600 })}>✓ การันตี ได้แน่นอน</div>
      </El>
      {f.coverNote && <El an={s.note} t={t} style={{ position: "absolute", left: 0, width: W, top: 1300, justifyContent: "center", fontSize: 38, color: WHITE, opacity: 0.85 }}>{f.coverNote}</El>}
    </>
  );
}

function IndexScene({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const g = f.gsaving;
  const s = motionSpec("index", f, c.voiceSec);
  if (!g) return null;
  const head = gsIndexHead(f);
  const n = countAt(Math.round(g.total), look(s.count, t).p);
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 52, fontWeight: 700, color: WHITE }}>โบนัสตามดัชนีโลก</El>
      <El an={s.sub} t={t} style={{ position: "absolute", left: SIDE, top: 285, fontSize: 48, color: WHITE }}>{head.sub}</El>
      <El an={s.big} t={t} style={{ position: "absolute", left: SIDE, top: 380, alignItems: "baseline" }}>
        <div style={box({ fontSize: 40, color: WHITE, opacity: 0.85, marginRight: 22 })}>{head.label}</div>
        <div style={box({ fontSize: 104, fontWeight: 700, color: GOLD })}>{n.toLocaleString("en-US")}</div>
        <div style={box({ fontSize: 44, color: WHITE, marginLeft: 16 })}>บาท</div>
      </El>
      <div style={abs({ left: SIDE, top: 560, width: W - SIDE * 2 })}>{gsIndexBars(f, s, t, W - SIDE * 2, 600)}</div>
      <El an={s.pill} t={t} style={{ position: "absolute", left: 0, width: W, top: 1210, justifyContent: "center" }}>
        <div style={box({ background: head.up ? RED : GREEN, color: WHITE, borderRadius: 40, padding: "8px 32px", fontSize: 42, fontWeight: 600 })}>{head.pill}</div>
      </El>
      <El an={s.note} t={t} style={{ position: "absolute", left: 0, width: W, top: 1310, justifyContent: "center", fontSize: 32, color: WHITE, opacity: 0.75 }}>ตัวอย่างเท่านั้น · ผลในอดีตไม่ยืนยันอนาคต</El>
    </>
  );
}

/** a heart with a cross on it, in a box of `size` (a plain function: see `stroke`) */
export function heartCross(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M60 104 C28 82 10 64 10 42 C10 24 24 12 40 12 C50 12 56 18 60 24 C64 18 70 12 80 12 C96 12 110 24 110 42 C110 64 92 82 60 104 Z" fill={RED} />
      <rect x={52} y={34} width={16} height={44} rx={3} fill={WHITE} />
      <rect x={38} y={48} width={44} height={16} rx={3} fill={WHITE} />
    </svg>
  );
}

/** บำนาญ 95: the pension's four steps up, as bars that grow in turn (`w`×`h`: the drawing's room) */
export function pensionSteps(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, h: number, big = 1) {
  const bands = f.pension?.bands ?? [];
  const gap = Math.round(28 * big);
  const barW = Math.floor((w - gap * Math.max(0, bands.length - 1)) / Math.max(1, bands.length));
  const labels = Math.round(170 * big);
  const base = h - labels;
  const tall = base - Math.round(20 * big);
  const most = Math.max(1, ...bands.map((b) => b.percent));
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {bands.map((b, i) => {
          const g = look(s[`bar${i}`], t);
          const bh = Math.round((b.percent / most) * tall * g.p);
          return g.opacity ? <rect key={b.from} x={i * (barW + gap)} y={base - bh} width={barW} height={bh} rx={Math.round(16 * big)} fill={i === bands.length - 1 ? GOLD : SKY} /> : null;
        })}
        {stroke({ d: `M0 ${base} L${w} ${base}`, len: w, p: look(s.axis, t).p, color: WHITE, width: Math.round(8 * big) })}
      </svg>
      {bands.map((b, i) => {
        const bh = Math.round((b.percent / most) * tall);
        const last = i === bands.length - 1;
        return (
          <El key={b.from} an={s[`lab${i}`]} t={t} style={{ position: "absolute", left: i * (barW + gap), top: 0, width: barW, height: h }}>
            <div style={abs({ left: 0, width: barW, top: base - bh + Math.round(14 * big), justifyContent: "center", fontSize: Math.round(50 * big), fontWeight: 700, color: last ? NAVY : WHITE })}>{`${b.percent}%`}</div>
            <div style={abs({ left: 0, width: barW, top: base + Math.round(16 * big), flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: Math.round(34 * big), color: WHITE, opacity: 0.85 })}>{`อายุ ${b.from}–${b.to}`}</div>
              <div style={box({ fontSize: Math.round(40 * big), fontWeight: 700, color: last ? GOLD : WHITE })}>{b.annual}</div>
              <div style={box({ fontSize: Math.round(28 * big), color: WHITE, opacity: 0.75 })}>บาท/ปี</div>
            </div>
          </El>
        );
      })}
    </div>
  );
}

function CoverSteps({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  return (
    <>
      <Header f={f} title={f.coverTitle} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 64, fontWeight: 700, color: WHITE }}>ยิ่งอายุมาก ยิ่งได้มากขึ้น</El>
      {f.pension && <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 290, fontSize: 40, color: GOLD }}>{`เริ่มเดือนละ ${f.pension.monthly} บาท ตั้งแต่อายุ ${f.pension.start}`}</El>}
      <div style={abs({ left: SIDE, top: 420, width: W - SIDE * 2, height: 760 })}>{pensionSteps(f, s, t, W - SIDE * 2, 760)}</div>
      <El an={s.pen} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1230, justifyContent: "flex-end", fontSize: 40, color: WHITE, opacity: 0.85 }}>{f.coverPen ?? ""}</El>
    </>
  );
}

/**
 * บำนาญ 95's years as bars (`w`×`h`): each premium while it is paid, then each pension, the
 * fifteen guaranteed ones in sky blue and bracketed. Shared by the portrait and the wide clips.
 */
export function pensionTimeline(f: QuoteVideoFacts, s: Record<string, Anim>, t: number, w: number, h: number, big = 1) {
  const p = f.pension;
  if (!p) return null;
  // the guarantee's words and bracket go above the tallest bar, clear of the later, larger pensions
  const roomTop = Math.round(150 * big);
  const roomBottom = Math.round(70 * big);
  const chartH = h - roomTop - roomBottom;
  const g = pensionBars(p, w, chartH);
  const drawn = look(s.bars, t).p * g.bars.length;
  const color = { premium: "rgba(255,255,255,0.55)", guaranteed: SKY, pension: GOLD } as const;
  const br = look(s.brace, t);
  const gBars = g.guarantee ? Math.min(...g.bars.filter((b) => b.kind === "guaranteed").map((b) => b.y)) + roomTop - Math.round(14 * big) : 0;
  const gTop = Math.round(70 * big);
  const age = (x: number, text: string, c: string) => (
    <div key={text + x} style={abs({ left: x - Math.round(60 * big), width: Math.round(120 * big), top: roomTop + chartH + Math.round(12 * big), justifyContent: "center", fontSize: Math.round(36 * big), color: c })}>{text}</div>
  );
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <line x1={0} y1={roomTop + chartH} x2={w} y2={roomTop + chartH} stroke="rgba(255,255,255,0.4)" strokeWidth={4} opacity={look(s.axes, t).opacity} />
        {g.bars.map((b, i) => {
          const grown = Math.max(0, Math.min(1, drawn - i));
          const bh = Math.round(b.h * grown);
          return grown > 0 ? <rect key={b.age} x={b.x} y={roomTop + chartH - bh} width={b.w} height={bh} fill={color[b.kind]} /> : null;
        })}
        {g.guarantee && br.p > 0 && stroke({
          d: `M${g.guarantee.x0} ${gBars} L${g.guarantee.x0} ${gTop} L${g.guarantee.x1} ${gTop} L${g.guarantee.x1} ${gBars}`,
          len: g.guarantee.x1 - g.guarantee.x0 + 2 * (gBars - gTop) + 4, p: br.p, color: SKY, width: Math.round(5 * big),
        })}
      </svg>
      {g.guarantee && (
        <El an={s.guarantee} t={t} style={{ position: "absolute", left: Math.max(0, g.guarantee.x0 - Math.round(40 * big)), top: gTop - Math.round(62 * big), fontSize: Math.round(38 * big), fontWeight: 700, color: SKY, whiteSpace: "nowrap" }}>
          {`รับประกันจ่าย 15 ปีแรก`}
        </El>
      )}
      <El an={s.ages} t={t} style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
        {age(Math.round(g.xOf(f.age)), String(f.age), WHITE)}
        {age(g.xOf(p.start), String(p.start), GOLD)}
        {age(Math.min(w - Math.round(30 * big), g.xOf(95)), "95", GOLD)}
      </El>
    </div>
  );
}

function PensionValue({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const p = f.pension;
  const s = motionSpec("value", f, c.voiceSec, c.words.join(" "));
  if (!p) return null;
  return (
    <>
      <Header f={f} title="รับบำนาญทุกปี" />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 600, color: WHITE }}>{`เงินใช้ทุกปี ถึงอายุ 95`}</El>
      <div style={abs({ left: SIDE, top: 330, width: W - SIDE * 2, height: 660 })}>{pensionTimeline(f, s, t, W - SIDE * 2, 660)}</div>
      <El an={s.legend} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1010, justifyContent: "center", fontSize: 32, color: WHITE }}>
        <div style={box({ marginRight: 36, color: "rgba(255,255,255,0.75)" })}>■ เบี้ยที่ออม</div>
        <div style={box({ marginRight: 36, color: SKY })}>■ 15 ปีแรก</div>
        <div style={box({ color: GOLD })}>■ บำนาญ</div>
      </El>
      <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1110, flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 36, padding: "26px 40px", borderLeft: `18px solid ${SKY}` }}>
        <div style={box({ fontSize: 38, fontWeight: 700, color: NAVY })}>รวมรับบำนาญถึงอายุ 95 ประมาณ</div>
        <div style={box({ fontSize: 76, fontWeight: 700 })}>{`${countAt(p.totalPension, look(s.count, t).p).toLocaleString("en-US")} บาท`}</div>
      </El>
    </>
  );
}

function CoverRows({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  const tight = f.cover.length > 4;
  return (
    <>
      <Header f={f} title={f.planLine} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 600, color: WHITE }}>{f.coverTitle}</El>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 320, flexDirection: "column" })}>
        {f.cover.map((r, i) => (
          <El key={r.label} an={s[`row${i}`]} t={t} style={{ alignItems: "center", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.22)", borderRadius: 34, padding: tight ? "14px 28px" : "20px 30px", marginBottom: tight ? 16 : 24 }}>
            <div style={box({ width: 64, height: 64, borderRadius: 32, background: GREEN, color: WHITE, fontSize: 40, fontWeight: 700, alignItems: "center", justifyContent: "center", flexShrink: 0 })}>✓</div>
            <div style={box({ flex: 1, flexShrink: 1, marginLeft: 24, fontSize: tight ? 36 : 40, color: WHITE })}>{r.label}</div>
            <div style={box({ marginLeft: 20, fontSize: tight ? 40 : 46, fontWeight: 700, color: GOLD, flexShrink: 0 })}>{/^[\d,]+$/.test(r.amount) ? `${r.amount}` : r.amount}</div>
          </El>
        ))}
      </div>
      {f.coverNote && <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1240, fontSize: 32, color: WHITE, opacity: 0.85 }}>{f.coverNote}</El>}
    </>
  );
}

/** the premiums paid and the surrender value, year by year, as two lines in a w×h box (900×520 on a portrait clip) */
export function chartPaths(f: QuoteVideoFacts, w = 900, h = 520) {
  const rows = f.rows ?? [];
  let paid = 0;
  const paidAt = rows.map((r) => (r.paid ? (paid = num(r.paid)) : paid));
  const cash = rows.map((r) => num(r.cash ?? "0"));
  const top = Math.max(1, ...paidAt, ...cash);
  const x = (i: number) => Math.round((i / Math.max(1, rows.length - 1)) * w);
  const y = (v: number) => Math.round(h - (v / top) * h);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const len = (vals: number[]) => vals.reduce((n, v, i) => (i ? n + Math.hypot(x(i) - x(i - 1), y(v) - y(vals[i - 1])) : 0), 0);
  const stop = rows.findIndex((r, i) => r.due === "—" && i > 0);
  return {
    paid: line(paidAt), paidLen: Math.ceil(len(paidAt)) + 4, cash: line(cash), cashLen: Math.ceil(len(cash)) + 4,
    be: f.breakEven ? { x: x(f.breakEven.index), y: y(cash[f.breakEven.index]) } : undefined,
    stop: stop > 0 ? { x: x(stop - 1), y: y(paidAt[stop - 1]) } : undefined, w, h,
    // for the pen notes (chart-pen.tsx): where a year and a figure fall
    x, y, paidAt, cashAt: cash,
  };
}

function Value({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("value", f, c.voiceSec, c.words.join(" "));
  const g = chartPaths(f);
  const L = 90;
  // lower than it was, for the pen notes' words above the chart (owner, 2026-10-13)
  const T = 420;
  const be = f.breakEven;
  const last = f.rows?.[f.rows.length - 1];
  return (
    <>
      <Header f={f} title="เงินไม่หายไปไหน" />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 600, color: WHITE }}>มูลค่าเงินสดโตทุกปี</El>
      <div style={abs({ left: L, top: T, width: g.w + 20, height: g.h + 90 })}>
        <svg width={g.w + 20} height={g.h + 20} viewBox={`-10 -10 ${g.w + 20} ${g.h + 20}`}>
          <line x1={0} y1={g.h} x2={g.w} y2={g.h} stroke="rgba(255,255,255,0.4)" strokeWidth={4} opacity={look(s.axes, t).opacity} />
          {stroke({ d: g.paid, len: g.paidLen, p: look(s.paid, t).p, color: "rgba(255,255,255,0.8)", width: 9 })}
          {stroke({ d: g.cash, len: g.cashLen, p: look(s.cash, t).p, color: GOLD, width: 11 })}
          {g.be && look(s.dot, t).opacity > 0 && <circle cx={g.be.x} cy={g.be.y} r={Math.round(24 * (0.4 + 0.6 * easeBack(look(s.dot, t).p)))} fill={RED} />}
        </svg>
        {/* the legend at the right, under the axis: the brace's word takes the left */}
        <El an={s.legend} t={t} style={{ position: "absolute", right: 10, top: g.h + 100, fontSize: 32, color: WHITE }}>
          <div style={box({ marginRight: 40 })}>— เบี้ยที่จ่าย</div>
          <div style={box({ color: GOLD })}>— มูลค่าเงินสด</div>
        </El>
        <div style={abs({ left: 10, top: 10, width: g.w, height: g.h })}>{chartNotes(f, g, 1, (name) => look(s[name], t))}</div>
      </div>
      <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1130, flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 36, padding: "26px 40px", borderLeft: `18px solid ${RED}` }}>
        {be ? (
          <div style={box({ flexDirection: "column" })}>
            <div style={box({ fontSize: 38, fontWeight: 700, color: RED })}>{`จุดคุ้มทุน อายุ ${be.age}`}</div>
            <div style={box({ fontSize: 52, fontWeight: 700 })}>{`ขอคืนได้ ${be.cash} บาท`}</div>
            <div style={box({ fontSize: 34 })}>{`มากกว่าที่จ่ายไป ${f.totalPaid} บาท`}</div>
          </div>
        ) : (
          <div style={box({ fontSize: 46, fontWeight: 700 })}>{`อายุ ${last?.age ?? f.coverToAge} มูลค่าเงินสด ${last?.cash ?? ""} บาท`}</div>
        )}
      </El>
    </>
  );
}

function Compare({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("compare", f, c.voiceSec);
  const plans = f.compare ?? [];
  const gap = 24;
  const colW = Math.floor((W - SIDE * 2 - gap * (plans.length - 1)) / Math.max(1, plans.length));
  const mainAt = plans.findIndex((p) => p.main);
  const ringP = look(s.ring, t).p;
  const vw = wordsOf(f);
  return (
    <>
      <Header f={f} title={vw.compareHeader} />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: f.lang && f.lang !== "th" ? 48 : 58, fontWeight: 600, color: WHITE }}>{vw.compareTitle}</El>
      <div style={abs({ left: SIDE, top: 360, width: W - SIDE * 2 })}>
        {plans.map((p, i) => (
          <El key={p.name} an={s[`col${i}`]} t={t} style={{
            width: colW, marginRight: i < plans.length - 1 ? gap : 0, flexDirection: "column", alignItems: "center", borderRadius: 36, padding: "30px 10px",
            background: p.main ? WHITE : "rgba(255,255,255,0.1)", border: `4px solid ${p.main ? GOLD : "rgba(255,255,255,0.22)"}`, color: p.main ? NAVY : WHITE,
          }}>
            <div style={box({ fontSize: 46, fontWeight: 700 })}>{p.name}</div>
            <div style={box({ fontSize: 30, marginTop: 24, opacity: 0.8 })}>{vw.compareRows[0]}</div>
            <div style={box({ fontSize: 54, fontWeight: 700, color: p.main ? NAVY : GOLD })}>{p.ceiling}</div>
            <div style={box({ fontSize: 30, marginTop: 20, opacity: 0.8 })}>{vw.compareRows[1]}</div>
            <div style={box({ fontSize: 40, fontWeight: 600 })}>{p.room}</div>
            <div style={box({ fontSize: 30, marginTop: 20, opacity: 0.8 })}>{vw.compareRows[2]}</div>
            <div style={box({ fontSize: 40, fontWeight: 600 })}>{p.opd}</div>
            <div style={box({ fontSize: 30, marginTop: 20, opacity: 0.8 })}>{vw.perMonth}</div>
            <div style={box({ fontSize: 48, fontWeight: 700 })}>{p.monthly}</div>
          </El>
        ))}
      </div>
      {mainAt >= 0 && ringP > 0 && (
        <div style={abs({ left: SIDE + mainAt * (colW + gap) - 22, top: 338, width: colW + 44, height: 860 })}>
          <svg width={colW + 44} height={860} viewBox={`0 0 ${colW + 44} 860`}>
            {stroke({ d: `M${(colW + 44) / 2} 6 C${colW + 40} 6 ${colW + 40} 6 ${colW + 40} 430 C${colW + 40} 854 ${colW + 40} 854 ${(colW + 44) / 2} 854 C4 854 4 854 4 430 C4 6 4 6 ${(colW + 44) / 2 - 20} 8`, len: 2 * (colW + 44) + 1720, p: ringP, color: RED, width: 8 })}
          </svg>
        </div>
      )}
      <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1260, fontSize: 32, color: WHITE, opacity: 0.85 }}>{vw.renewNote(f.coverToAge)}</El>
    </>
  );
}

function Contact({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("contact", f, c.voiceSec);
  const k = c.contact;
  const initial = [...k.name.trim()][0] ?? "?";
  const more = k.more ? k.more.split("\n") : [];
  const vw = wordsOf(f);
  const [said, help] = vw.contactLines(c.narrator ?? "F");
  return (
    <>
      <Header f={f} title={c.customer ? vw.contactFor(c.customer) : vw.contactMore} />
      <El an={s.title} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 260, flexDirection: "column", fontSize: f.lang && f.lang !== "th" ? 68 : 84, fontWeight: 700, color: WHITE, lineHeight: vw.lineHeight }}>
        <div style={box({})}>{said}</div>
        <div style={box({ color: GOLD })}>{help}</div>
      </El>
      <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 620, background: WHITE, color: NAVY, borderRadius: 48, padding: 44, alignItems: "center" }}>
        {k.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={k.photo} width={200} height={200} style={{ borderRadius: 100, objectFit: "cover" }} alt="" />
        ) : (
          <div style={box({ width: 200, height: 200, borderRadius: 100, background: C.noPhoto, alignItems: "center", justifyContent: "center", fontSize: 96, fontWeight: 700 })}>{initial}</div>
        )}
        <div style={box({ flexDirection: "column", marginLeft: 40, flexShrink: 1 })}>
          <div style={box({ fontSize: 56, fontWeight: 700 })}>{k.name}</div>
          <div style={box({ fontSize: 44, marginTop: 8 })}>{`${vw.phone} ${k.phone}`}</div>
          {k.line && <div style={box({ fontSize: 44 })}>{`LINE ${k.line}`}</div>}
        </div>
      </El>
      {/* the foot note runs on under รายละเอียดเพิ่มเติม, however many lines it wraps to */}
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: more.length ? 990 : 1020, flexDirection: "column" })}>
        {more.length > 0 && (
          <El an={s.card} t={t} style={{ flexDirection: "column", fontSize: 44, color: WHITE, lineHeight: 1.45, marginBottom: 24 }}>
            {more.map((m, i) => <div key={i} style={box({})}>{m}</div>)}
          </El>
        )}
        {f.footNote && <El an={s.note} t={t} style={{ fontSize: 30, color: WHITE, opacity: 0.75 }}>{f.footNote}</El>}
      </div>
    </>
  );
}


/** A looping clip's last scene (owner, 2026-10-13, choices ก and ข): the opening's picture, held, and nothing else. */
function LoopEnd({ c, t }: { c: MotionContext; t: number }) {
  // the opening as it stands once everything has come in, so the replay starts where this ends
  return <Lead c={c} t={Math.max(t, 4)} />;
}

function Kicker({ an, t, text }: { an?: Anim; t: number; text: string }) {
  return <El an={an} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 60, fontWeight: 600, color: WHITE }}>{text}</El>;
}

function StoryScene({ c, t }: { c: MotionContext; t: number }) {
  const s = motionSpec("story", c.facts, c.voiceSec);
  const pts = c.extra?.story.points ?? [];
  return (
    <>
      <Header f={c.facts} title="ลองนึกภาพ" />
      <Kicker an={s.kicker} t={t} text="ลองนึกภาพ" />
      <El an={s.face} t={t} style={{ position: "absolute", left: (W - 260) / 2, top: 320, width: 260, height: 260, borderRadius: 130, background: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
        <svg width={180} height={180} viewBox="0 0 120 130">
          <circle cx={45} cy={56} r={9} fill={WHITE} /><circle cx={75} cy={56} r={9} fill={WHITE} /><circle cx={60} cy={74} r={7} fill={WHITE} />
          <path d="M30 96 C32 76 58 76 60 96 Z M60 96 C62 76 88 76 90 96 Z" fill={WHITE} />
        </svg>
      </El>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 660, flexDirection: "column" })}>
        {pts.map((pt, i) => (
          <El key={i} an={s[`pt${i}`]} t={t} style={{ alignItems: "center", background: i === pts.length - 1 ? GOLD : "rgba(255,255,255,0.1)", color: i === pts.length - 1 ? NAVY : WHITE, borderRadius: 36, padding: "26px 36px", marginBottom: 28, fontSize: 54, fontWeight: 600 }}>{pt}</El>
        ))}
      </div>
    </>
  );
}

function QaScene({ c, t }: { c: MotionContext; t: number }) {
  const s = motionSpec("qa", c.facts, c.voiceSec);
  const qas = c.extra?.qas ?? [];
  return (
    <>
      <Header f={c.facts} title={c.facts.planLine} />
      <Kicker an={s.kicker} t={t} text="คำถามที่เจอบ่อย" />
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 330, flexDirection: "column" })}>
        {qas.map((q, i) => (
          <div key={q.key} style={box({ flexDirection: "column", marginBottom: 50 })}>
            <El an={s[`q${i}`]} t={t} style={{ alignItems: "flex-start", background: WHITE, color: NAVY, borderRadius: 32, padding: "22px 30px", fontSize: 48, fontWeight: 700 }}>
              <div style={box({ background: GOLD, borderRadius: 20, padding: "2px 18px", fontSize: 36, marginRight: 22, flexShrink: 0 })}>ถาม</div>
              <div style={box({ flexShrink: 1 })}>{q.q}</div>
            </El>
            <El an={s[`a${i}`]} t={t} style={{ fontSize: 42, color: WHITE, marginTop: 22, lineHeight: 1.45, paddingLeft: 10 }}>{q.a}</El>
          </div>
        ))}
      </div>
    </>
  );
}

function VersusScene({ c, t }: { c: MotionContext; t: number }) {
  const s = motionSpec("versus", c.facts, c.voiceSec);
  const v = c.extra?.versus;
  if (!v) return null;
  const right = /^[\d,]+$/.test(v.right.amount) ? countAt(num(v.right.amount), look(s.count, t).p).toLocaleString("en-US") : v.right.amount;
  return (
    <>
      <Header f={c.facts} title={c.facts.planLine} />
      <Kicker an={s.kicker} t={t} text={c.facts.product === "PENSION" ? "ลดหย่อนภาษีระหว่างทำงาน" : "เก็บเงินเอง กับ แผนนี้"} />
      <El an={s.left} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 330, flexDirection: "column", background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.22)", borderRadius: 40, padding: "36px 44px" }}>
        <div style={box({ fontSize: 44, opacity: 0.85 })}>{v.left.label}</div>
        <div style={box({ alignItems: "flex-end" })}>
          <div style={box({ fontSize: 110, fontWeight: 700 })}>{v.left.amount}</div>
          <div style={box({ fontSize: 42, marginLeft: 16, marginBottom: 18 })}>{v.left.unit}</div>
        </div>
      </El>
      <El an={s.vs} t={t} style={{ position: "absolute", left: (W - 130) / 2, top: 660, width: 130, height: 130, borderRadius: 65, background: GOLD, color: NAVY, fontSize: 48, fontWeight: 700, alignItems: "center", justifyContent: "center" }}>{c.facts.product === "PENSION" ? "→" : "vs"}</El>
      <El an={s.right} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 830, flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 40, padding: "36px 44px" }}>
        <div style={box({ fontSize: 44, fontWeight: 600 })}>{v.right.label}</div>
        <div style={box({ alignItems: "flex-end" })}>
          <div style={box({ fontSize: 130, fontWeight: 700 })}>{right}</div>
          <div style={box({ fontSize: 42, marginLeft: 16, marginBottom: 22 })}>{v.right.unit}</div>
        </div>
      </El>
      <El an={s.note} t={t} style={{ position: "absolute", left: 0, width: W, top: 1220, justifyContent: "center" }}>
        <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "10px 34px", fontSize: 44, fontWeight: 600 })}>{v.note}</div>
      </El>
    </>
  );
}

function StepsScene({ c, t }: { c: MotionContext; t: number }) {
  const s = motionSpec("steps", c.facts, c.voiceSec);
  const steps = c.extra?.steps ?? [];
  return (
    <>
      <Header f={c.facts} title={c.facts.planLine} />
      <Kicker an={s.kicker} t={t} text="เริ่มง่ายๆ 3 ขั้น" />
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 360, flexDirection: "column" })}>
        {steps.map((st, i) => (
          <El key={i} an={s[`st${i}`]} t={t} style={{ alignItems: "center", marginBottom: 60 }}>
            <div style={box({ width: 140, height: 140, borderRadius: 70, background: i === steps.length - 1 ? GOLD : WHITE, color: NAVY, fontSize: 70, fontWeight: 700, alignItems: "center", justifyContent: "center", marginRight: 40, flexShrink: 0 })}>{String(i + 1)}</div>
            <div style={box({ fontSize: 54, fontWeight: 600, color: WHITE, flexShrink: 1 })}>{st}</div>
          </El>
        ))}
      </div>
    </>
  );
}

/** One frame of a Motion Graphic scene at scene time t: transparent, over the drifting background. */
export function motionFrame(key: SceneKey, c: MotionContext, t: number) {
  const body = {
    lead: <Lead c={c} t={t} />,
    price: <Price c={c} t={t} />,
    cover: c.facts.coverStyle === "bars" ? <CoverBars c={c} t={t} /> : c.facts.coverStyle === "steps" ? <CoverSteps c={c} t={t} />
      : c.facts.coverStyle === "bands" ? <CoverBands c={c} t={t} /> : c.facts.coverStyle === "flat" ? <CoverFlat c={c} t={t} />
      : c.facts.coverStyle === "payback" ? <CoverPayback c={c} t={t} /> : <CoverRows c={c} t={t} />,
    value: c.facts.pension ? <PensionValue c={c} t={t} /> : <Value c={c} t={t} />,
    compare: <Compare c={c} t={t} />,
    critical: <Critical c={c} t={t} />,
    terms: <Terms c={c} t={t} />,
    index: <IndexScene c={c} t={t} />,
    contact: c.loop ? <LoopEnd c={c} t={t} /> : <Contact c={c} t={t} />,
    story: <StoryScene c={c} t={t} />,
    qa: <QaScene c={c} t={t} />,
    versus: <VersusScene c={c} t={t} />,
    steps: <StepsScene c={c} t={t} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "transparent", fontFamily: "Plex", color: WHITE }}>
      {body}
      <Subtitle words={c.words} t={t} voiceSec={c.voiceSec} />
      <div style={abs({ left: 0, width: W, bottom: 34, justifyContent: "center", fontSize: 26, color: WHITE, opacity: 0.6 })}>Application by www.advisortool.app</div>
    </div>
  );
}

/** how much taller than the clip its background is: the drift ffmpeg pans over */
const DRIFT = MOTION_BG_H - H;
/** the background's height for a clip of this frame (MOTION_BG_H for a portrait one) */
export const motionBgHeight = (size: { h: number } = { h: H }) => size.h + DRIFT;

/**
 * The tall navy background with soft circles, panned slowly by ffmpeg under every scene. A square
 * or landscape clip's is as wide as its frame, the circles spread across it in the same places.
 */
export function motionBackground(size: { w: number; h: number } = { w: W, h: H }) {
  const bgH = motionBgHeight(size);
  const x = (v: number) => Math.round((v / W) * size.w);
  const y = (v: number) => Math.round((v / MOTION_BG_H) * bgH);
  return (
    <div style={{ display: "flex", position: "relative", width: size.w, height: bgH, background: NAVY, overflow: "hidden" }}>
      <div style={abs({ left: x(-200), top: y(-120), width: 720, height: 720, borderRadius: 360, background: SKY, opacity: 0.18 })} />
      <div style={abs({ left: x(820), top: y(900), width: 520, height: 520, borderRadius: 260, background: GOLD, opacity: 0.1 })} />
      <div style={abs({ left: x(300), top: y(1700), width: 860, height: 860, borderRadius: 430, background: SKY, opacity: 0.16 })} />
      <div style={abs({ left: x(-160), top: y(1250), width: 380, height: 380, borderRadius: 190, background: GOLD, opacity: 0.08 })} />
    </div>
  );
}
