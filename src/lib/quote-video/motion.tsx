import type { ReactNode } from "react";
import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { countAt, H, W } from "./timeline";

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

/** When each element of a scene moves, in scene seconds. */
export function motionSpec(key: SceneKey, f: QuoteVideoFacts, voiceSec: number): Record<string, Anim> {
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
      const late = Math.max(3.6, Math.min(8, voiceSec * 0.55));
      return {
        kicker: a(0.2, "up"), axes: a(0.2, "fade"), paid: a(0.4, "stroke", 1.6), cash: a(1.4, "stroke", 2.2),
        stop: a(1.2, "fade"), dot: a(late - 1.6, "pop"), card: a(late, "pop"), legend: a(0.8, "fade"),
      };
    }
    case "compare": {
      const s: Record<string, Anim> = { kicker: a(0.2, "up") };
      (f.compare ?? []).forEach((_, i) => { s[`col${i}`] = a(0.8 + i * 0.5, "pop"); });
      s.ring = a(0.8 + (f.compare?.length ?? 0) * 0.5 + 0.3, "stroke", 1.0);
      s.note = a(2.4, "fade");
      return s;
    }
    case "contact":
      return { title: a(0.2, "up"), card: a(0.8, "up"), note: a(1.4, "fade") };
  }
}

/** the windows a scene moves in, for the frames timeline.ts draws */
export const motionWindows = (key: SceneKey, f: QuoteVideoFacts, voiceSec: number): [number, number][] =>
  Object.values(motionSpec(key, f, voiceSec)).map((x) => [x.at, x.at + x.dur]);

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
  customer: string;
  narrator?: "F" | "M";
  contact: { name: string; phone: string; line?: string; photo?: string };
  words: string[];
  voiceSec: number;
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

export function Subtitle({ words, t, voiceSec }: { words: string[]; t: number; voiceSec: number }) {
  const total = words.reduce((n, w) => n + w.length, 0) || 1;
  const LEAD = 0.35;
  let acc = 0;
  return (
    <div style={abs({ left: 36, width: W - 72, bottom: 96, justifyContent: "center" })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", background: "rgba(0,0,0,0.45)", borderRadius: 30, padding: "18px 28px", fontSize: 41, lineHeight: 1.45 })}>
        {words.map((w, i) => {
          const from = LEAD + (acc / total) * voiceSec;
          acc += w.length;
          const to = LEAD + (acc / total) * voiceSec;
          const color = t >= to ? WHITE : t >= from ? GOLD : "rgba(255,255,255,0.55)";
          return <div key={i} style={box({ color, marginRight: i < words.length - 1 ? 12 : 0 })}>{w}</div>;
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

function Lead({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("lead", f, c.voiceSec);
  const shield = look(s.shield, t).p;
  const n = countAt(f.lead.baht, look(s.count, t).p);
  return (
    <>
      <Header f={f} title={f.planLine} />
      {c.customer && <El an={s.name} t={t} style={{ position: "absolute", left: SIDE, top: 170, fontSize: 42, color: WHITE }}>จัดทำสำหรับ <span style={{ color: GOLD, fontWeight: 600, marginLeft: 12 }}>คุณ{c.customer}</span></El>}
      <div style={abs({ left: (W - 400) / 2, top: 290, width: 400, height: 430 })}>
        <svg width={400} height={430} viewBox="0 0 120 130">
          {stroke({ d: "M60 8 L108 26 V62 C108 94 86 114 60 124 C34 114 12 94 12 62 V26 Z", len: 330, p: shield, color: GOLD, width: 5 })}
        </svg>
        <El an={s.family} t={t} style={{ position: "absolute", left: 0, top: 0, width: 400, height: 430 }}>
          <svg width={400} height={430} viewBox="0 0 120 130">
            <circle cx={45} cy={56} r={9} fill={WHITE} /><circle cx={75} cy={56} r={9} fill={WHITE} /><circle cx={60} cy={74} r={7} fill={WHITE} />
            <path d="M30 96 C32 76 58 76 60 96 Z M60 96 C62 76 88 76 90 96 Z" fill={WHITE} />
          </svg>
        </El>
      </div>
      <El an={s.kicker} t={t} style={{ position: "absolute", left: 0, width: W, top: 760, justifyContent: "center", fontSize: 58, fontWeight: 600, color: WHITE }}>{f.lead.label}</El>
      <El an={s.big} t={t} style={{ position: "absolute", left: 0, width: W, top: 850, justifyContent: "center", fontSize: f.lead.amount.length > 9 ? 130 : 150, fontWeight: 700, color: GOLD }}>{n.toLocaleString("en-US")}</El>
      <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1040, justifyContent: "center", fontSize: 38, color: WHITE, opacity: 0.85 }}>{`บาท${f.lead.note ? ` · ${f.lead.note}` : ""}`}</El>
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
  return (
    <>
      <Header f={f} title={f.priceTitle} />
      <div style={abs({ left: SIDE, top: 210, alignItems: "flex-end" })}>
        <svg width={230} height={300} viewBox="0 0 70 90">
          {coin(0, 80)}{coin(1, 66)}{coin(2, 52)}
          <g opacity={look(s.coin3, t).opacity}><ellipse cx={35} cy={38} rx={26} ry={7} fill={C.coinTop} /></g>
        </svg>
        <div style={box({ flexDirection: "column", marginLeft: 40 })}>
          <El an={s.small} t={t} style={{ fontSize: 42, color: WHITE }}>{daily ? "ตกวันละ" : "ปีแรก เดือนละ"}</El>
          <El an={s.big} t={t} style={{ fontSize: 170, fontWeight: 700, color: GOLD, lineHeight: 1 }}>{daily ?? main?.amount ?? ""}</El>
          <El an={s.unit} t={t} style={{ fontSize: 42, color: WHITE }}>{daily ? "บาทเท่านั้น" : "บาท"}</El>
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
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 1100, flexWrap: "wrap" })}>
        {f.pills.map((pill, i) => (
          <El key={pill} an={s[`pill${i}`]} t={t} style={{ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 30px", fontSize: 38, fontWeight: 600, marginRight: 22, marginBottom: 16 }}>{`✓ ${pill}`}</El>
        ))}
      </div>
      {f.priceNotes.length > 0 && (
        <El an={s.notes} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1120, flexDirection: "column", fontSize: 34, color: WHITE, opacity: 0.85 }}>
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
  };
}

function Value({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("value", f, c.voiceSec);
  const g = chartPaths(f);
  const L = 90;
  const T = 360;
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
        <El an={s.legend} t={t} style={{ position: "absolute", left: 0, top: g.h + 40, fontSize: 32, color: WHITE }}>
          <div style={box({ marginRight: 40 })}>— เบี้ยที่จ่าย</div>
          <div style={box({ color: GOLD })}>— มูลค่าเงินสด</div>
        </El>
        {g.stop && !f.payToEnd && (
          <El an={s.stop} t={t} style={{ position: "absolute", left: Math.max(0, g.stop.x - 160), top: Math.max(0, g.stop.y - 80), width: 320, justifyContent: "center", fontSize: 32, color: WHITE }}>{`หยุดส่ง อายุ ${f.lastPayAge}`}</El>
        )}
      </div>
      <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1040, flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 36, padding: "26px 40px", borderLeft: `18px solid ${RED}` }}>
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
  return (
    <>
      <Header f={f} title="เลือกแผนที่ใช่" />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 58, fontWeight: 600, color: WHITE }}>เทียบแผน iHealthy Ultra</El>
      <div style={abs({ left: SIDE, top: 360, width: W - SIDE * 2 })}>
        {plans.map((p, i) => (
          <El key={p.name} an={s[`col${i}`]} t={t} style={{
            width: colW, marginRight: i < plans.length - 1 ? gap : 0, flexDirection: "column", alignItems: "center", borderRadius: 36, padding: "30px 10px",
            background: p.main ? WHITE : "rgba(255,255,255,0.1)", border: `4px solid ${p.main ? GOLD : "rgba(255,255,255,0.22)"}`, color: p.main ? NAVY : WHITE,
          }}>
            <div style={box({ fontSize: 46, fontWeight: 700 })}>{p.name}</div>
            <div style={box({ fontSize: 30, marginTop: 24, opacity: 0.8 })}>วงเงิน/ปี</div>
            <div style={box({ fontSize: 54, fontWeight: 700, color: p.main ? NAVY : GOLD })}>{p.ceiling}</div>
            <div style={box({ fontSize: 30, marginTop: 20, opacity: 0.8 })}>ค่าห้อง/วัน</div>
            <div style={box({ fontSize: 40, fontWeight: 600 })}>{p.room}</div>
            <div style={box({ fontSize: 30, marginTop: 20, opacity: 0.8 })}>ผู้ป่วยนอก/ปี</div>
            <div style={box({ fontSize: 40, fontWeight: 600 })}>{p.opd}</div>
            <div style={box({ fontSize: 30, marginTop: 20, opacity: 0.8 })}>เดือนละ</div>
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
      <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1260, fontSize: 32, color: WHITE, opacity: 0.85 }}>{`ต่ออายุได้ถึงอายุ ${f.coverToAge} · เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น`}</El>
    </>
  );
}

function Contact({ c, t }: { c: MotionContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("contact", f, c.voiceSec);
  const k = c.contact;
  const initial = [...k.name.trim()][0] ?? "?";
  return (
    <>
      <Header f={f} title={c.customer ? `สำหรับ คุณ${c.customer}` : "สนใจรายละเอียดเพิ่มเติม"} />
      <El an={s.title} t={t} style={{ position: "absolute", left: SIDE, top: 260, flexDirection: "column", fontSize: 84, fontWeight: 700, color: WHITE, lineHeight: 1.3 }}>
        <div style={box({})}>ทักมาคุยกันได้เลย</div>
        <div style={box({ color: GOLD })}>{c.narrator === "M" ? "ยินดีช่วยดูแผนให้ครับ" : "ยินดีช่วยดูแผนให้ค่ะ"}</div>
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
          <div style={box({ fontSize: 44, marginTop: 8 })}>{`โทร ${k.phone}`}</div>
          {k.line && <div style={box({ fontSize: 44 })}>{`LINE ${k.line}`}</div>}
        </div>
      </El>
      {f.footNote && <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1020, fontSize: 30, color: WHITE, opacity: 0.75 }}>{f.footNote}</El>}
    </>
  );
}

/** One frame of a Motion Graphic scene at scene time t: transparent, over the drifting background. */
export function motionFrame(key: SceneKey, c: MotionContext, t: number) {
  const body = {
    lead: <Lead c={c} t={t} />,
    price: <Price c={c} t={t} />,
    cover: c.facts.coverStyle === "bars" ? <CoverBars c={c} t={t} /> : <CoverRows c={c} t={t} />,
    value: <Value c={c} t={t} />,
    compare: <Compare c={c} t={t} />,
    contact: <Contact c={c} t={t} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "transparent", fontFamily: "Plex", color: WHITE }}>
      {body}
      <Subtitle words={c.words} t={t} voiceSec={c.voiceSec} />
      <div style={abs({ left: 0, width: W, bottom: 34, justifyContent: "center", fontSize: 26, color: WHITE, opacity: 0.6 })}>Design by www.unitclub.app</div>
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
