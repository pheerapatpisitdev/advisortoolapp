import type { ReactNode } from "react";
import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import type { Level } from "@/lib/fhc/health";
import type { FhcSceneKey, FhcVideoFacts } from "./fhc";
import { fhcSpec } from "./fhc-motion";
import { chartNotes, NOTES_ABOVE, NOTES_BELOW } from "./chart-pen";
import { abs, box, chartPaths, easeBack, El, look, motionSpec, stroke, type Anim } from "./motion";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { countAt, SIZES, type VideoSize } from "./timeline";

/**
 * The square (1080×1080) and landscape (1920×1080) clips (owner, 2026-10-11, mockup
 * https://claude.ai/artifact/8bhEgAdp4pCBiv581F1weq): the same scenes, figures, voice and timing
 * as the portrait Motion Graphic ones (motion.tsx, fhc-motion.tsx — their specs move every
 * element here too), laid out side by side: the picture on the left, the words on the right,
 * lists in two columns where a landscape frame has the room. Portrait clips never come here.
 */

const NAVY = C.motionNavy;
const GOLD = C.motionGold;
const SKY = C.motionSky;
const WHITE = C.paper;
const RED = C.motionRed;
const GREEN = C.motionGreen;
const LIGHT: Record<Level, string> = { green: GREEN, yellow: GOLD, red: RED, none: "rgba(255,255,255,0.28)" };
const UNIT = { sum: "บาท", room: "บาท/วัน", pension: "บาท/เดือน" } as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** a frame's room: its size, its side margin, where the body starts and ends (the subtitle sits below) */
interface Geo {
  w: number;
  h: number;
  /** landscape: two columns where portrait has one */
  wide: boolean;
  side: number;
  /** the body, under a scene's kicker */
  top: number;
  bottom: number;
  /** a size for the square frame, or for the landscape one */
  px: <T>(square: T, landscape: T) => T;
}

function geo(size: Exclude<VideoSize, "portrait">): Geo {
  const { w, h } = SIZES[size];
  const wide = size === "landscape";
  return {
    w, h, wide,
    side: wide ? 90 : 56,
    top: wide ? 200 : 180,
    bottom: wide ? 830 : 800,
    px: <T,>(square: T, landscape: T): T => (wide ? landscape : square),
  };
}

const card = (g: Geo, main = false): React.CSSProperties => ({
  background: main ? WHITE : "rgba(255,255,255,0.08)",
  border: `3px solid ${main ? WHITE : "rgba(255,255,255,0.16)"}`,
  borderRadius: g.px(24, 30),
});

function Header({ g, left, right }: { g: Geo; left: string; right: string }) {
  return (
    <div style={abs({ left: g.side, width: g.w - g.side * 2, top: 40, justifyContent: "space-between", fontSize: g.px(28, 32), color: WHITE, opacity: 0.85 })}>
      <div style={box({})}>{left}</div>
      <div style={box({})}>{right}</div>
    </div>
  );
}

function Kicker({ g, an, t, text }: { g: Geo; an?: Anim; t: number; text: string }) {
  return <El an={an} t={t} style={{ position: "absolute", left: g.side, top: g.px(96, 100), fontSize: g.px(48, 58), fontWeight: 600, color: WHITE }}>{text}</El>;
}

/** the body's box, under the kicker and above the subtitle */
function Body({ g, top, style, children }: { g: Geo; top?: number; style?: React.CSSProperties; children?: ReactNode }) {
  const t = top ?? g.top;
  return <div style={abs({ left: g.side, width: g.w - g.side * 2, top: t, height: g.bottom - t, ...style })}>{children}</div>;
}

/** items laid out in `cols` columns, filling each row in turn */
function Grid({ g, cols, gap, children }: { g: Geo; cols: number; gap: number; children: ReactNode[] }) {
  const colW = Math.floor((g.w - g.side * 2 - gap * (cols - 1)) / cols);
  return (
    <div style={box({ flexWrap: "wrap", width: g.w - g.side * 2 })}>
      {children.map((c, i) => (
        <div key={i} style={box({ width: colW, marginRight: (i + 1) % cols ? gap : 0, marginBottom: gap, flexDirection: "column" })}>{c}</div>
      ))}
    </div>
  );
}

function Subtitle({ g, words, t, voiceSec }: { g: Geo; words: string[]; t: number; voiceSec: number }) {
  const total = words.reduce((x, w) => x + w.length, 0) || 1;
  const LEAD = 0.35;
  const width = Math.min(g.w - 64, 1560);
  let acc = 0;
  return (
    <div style={abs({ left: Math.round((g.w - width) / 2), width, bottom: g.px(52, 50), justifyContent: "center" })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", background: "rgba(0,0,0,0.45)", borderRadius: 26, padding: "12px 24px", fontSize: g.px(32, 38), lineHeight: 1.4 })}>
        {words.map((w, i) => {
          const from = LEAD + (acc / total) * voiceSec;
          acc += w.length;
          const to = LEAD + (acc / total) * voiceSec;
          const color = t >= to ? WHITE : t >= from ? GOLD : "rgba(255,255,255,0.55)";
          return <div key={i} style={box({ color, marginRight: i < words.length - 1 ? 10 : 0 })}>{w}</div>;
        })}
      </div>
    </div>
  );
}

function Frame({ g, words, t, voiceSec, children }: { g: Geo; words: string[]; t: number; voiceSec: number; children: ReactNode }) {
  return (
    <div style={{ display: "flex", position: "relative", width: g.w, height: g.h, background: "transparent", fontFamily: "Plex", color: WHITE }}>
      {children}
      <Subtitle g={g} words={words} t={t} voiceSec={voiceSec} />
      <div style={abs({ left: 0, width: g.w, bottom: 14, justifyContent: "center", fontSize: 22, color: WHITE, opacity: 0.6 })}>Design by www.unitclub.app</div>
    </div>
  );
}

interface Contact { name: string; phone: string; line?: string; photo?: string }

/** the agent's card, shared by both kinds of clip */
function ContactScene({ g, s, t, title, header, customer, narrator, contact, note }: {
  g: Geo; s: Record<string, Anim>; t: number; title: string; header: string; customer: string; narrator?: "F" | "M"; contact: Contact; note?: string;
}) {
  const k = contact;
  const initial = [...k.name.trim()][0] ?? "?";
  const face = g.px(150, 200);
  return (
    <>
      <Header g={g} left={customer ? `สำหรับ คุณ${customer}` : title} right={header} />
      <Body g={g} top={g.px(130, 170)} style={{ flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "center" : "flex-start" }}>
        <El an={s.title} t={t} style={{ flexDirection: "column", fontSize: g.px(64, 84), fontWeight: 700, color: WHITE, lineHeight: 1.3, ...(g.wide ? { width: 760 } : {}) }}>
          <div style={box({})}>ทักมาคุยกันได้เลย</div>
          <div style={box({ color: GOLD })}>{narrator === "M" ? "ยินดีช่วยดูแผนให้ครับ" : "ยินดีช่วยดูแผนให้ค่ะ"}</div>
        </El>
        <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.wide ? 40 : 0, marginTop: g.wide ? 0 : 40 })}>
          <El an={s.card} t={t} style={{ background: WHITE, color: NAVY, borderRadius: 40, padding: g.px(30, 40), alignItems: "center" }}>
            {k.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={k.photo} width={face} height={face} style={{ borderRadius: face / 2, objectFit: "cover" }} alt="" />
            ) : (
              <div style={box({ width: face, height: face, borderRadius: face / 2, background: C.noPhoto, alignItems: "center", justifyContent: "center", fontSize: g.px(72, 96), fontWeight: 700 })}>{initial}</div>
            )}
            <div style={box({ flexDirection: "column", marginLeft: 36, flexShrink: 1 })}>
              <div style={box({ fontSize: g.px(46, 56), fontWeight: 700 })}>{k.name}</div>
              <div style={box({ fontSize: g.px(36, 44), marginTop: 6 })}>{`โทร ${k.phone}`}</div>
              {k.line && <div style={box({ fontSize: g.px(36, 44) })}>{`LINE ${k.line}`}</div>}
            </div>
          </El>
          {note && <El an={s.note} t={t} style={{ marginTop: 22, fontSize: g.px(24, 28), color: WHITE, opacity: 0.75 }}>{note}</El>}
        </div>
      </Body>
    </>
  );
}

// ——— the quote clips ———

export interface WideQuoteContext {
  facts: QuoteVideoFacts;
  customer: string;
  narrator?: "F" | "M";
  contact: Contact;
  words: string[];
  voiceSec: number;
}

function Lead({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("lead", f, c.voiceSec);
  const shieldW = g.px(330, 500);
  const shieldH = Math.round(shieldW * 1.075);
  const n0 = countAt(f.lead.baht, look(s.count, t).p);
  const big = g.px(f.lead.amount.length > 9 ? 96 : 110, f.lead.amount.length > 9 ? 150 : 176);
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Body g={g} top={g.px(130, 150)} style={{ alignItems: "center" }}>
        <div style={box({ position: "relative", width: shieldW, height: shieldH, flexShrink: 0 })}>
          <svg width={shieldW} height={shieldH} viewBox="0 0 120 130">
            {stroke({ d: "M60 8 L108 26 V62 C108 94 86 114 60 124 C34 114 12 94 12 62 V26 Z", len: 330, p: look(s.shield, t).p, color: GOLD, width: 5 })}
          </svg>
          <El an={s.family} t={t} style={{ position: "absolute", left: 0, top: 0, width: shieldW, height: shieldH }}>
            <svg width={shieldW} height={shieldH} viewBox="0 0 120 130">
              <circle cx={45} cy={56} r={9} fill={WHITE} /><circle cx={75} cy={56} r={9} fill={WHITE} /><circle cx={60} cy={74} r={7} fill={WHITE} />
              <path d="M30 96 C32 76 58 76 60 96 Z M60 96 C62 76 88 76 90 96 Z" fill={WHITE} />
            </svg>
          </El>
        </div>
        <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.px(40, 80) })}>
          {c.customer && <El an={s.name} t={t} style={{ fontSize: g.px(32, 42), color: WHITE, marginBottom: 12 }}>จัดทำสำหรับ <span style={{ color: GOLD, fontWeight: 600, marginLeft: 10 }}>คุณ{c.customer}</span></El>}
          <El an={s.kicker} t={t} style={{ fontSize: g.px(44, 64), fontWeight: 600, color: WHITE }}>{f.lead.label}</El>
          <El an={s.big} t={t} style={{ fontSize: big, fontWeight: 700, color: GOLD, lineHeight: 1.15 }}>{n0.toLocaleString("en-US")}</El>
          <El an={s.note} t={t} style={{ fontSize: g.px(28, 40), color: WHITE, opacity: 0.85 }}>{`บาท${f.lead.note ? ` · ${f.lead.note}` : ""}`}</El>
          <El an={s.mark} t={t} style={{ marginTop: g.px(20, 30) }}>
            <div style={box({ background: GOLD, color: NAVY, borderRadius: 40, padding: "6px 30px", fontSize: g.px(34, 48), fontWeight: 600 })}>{f.leadMark}</div>
          </El>
        </div>
      </Body>
    </>
  );
}

function Price({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("price", f, c.voiceSec);
  const coinW = g.px(150, 260);
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
      <Header g={g} left={f.priceTitle} right={f.insuredWho} />
      <Body g={g} top={g.px(120, 150)} style={{ alignItems: "center" }}>
        <div style={box({ flexDirection: "column", width: g.px(450, 800), flexShrink: 0 })}>
          <div style={box({ alignItems: "flex-end" })}>
            <svg width={coinW} height={Math.round((coinW * 90) / 70)} viewBox="0 0 70 90">
              {coin(0, 80)}{coin(1, 66)}{coin(2, 52)}
              <g opacity={look(s.coin3, t).opacity}><ellipse cx={35} cy={38} rx={26} ry={7} fill={C.coinTop} /></g>
            </svg>
            <div style={box({ flexDirection: "column", marginLeft: g.px(24, 44) })}>
              <El an={s.small} t={t} style={{ fontSize: g.px(32, 50), color: WHITE }}>{daily ? "ตกวันละ" : "ปีแรก เดือนละ"}</El>
              <El an={s.big} t={t} style={{ fontSize: g.px(daily ? 120 : 84, daily ? 220 : 150), fontWeight: 700, color: GOLD, lineHeight: 1 }}>{daily ?? main?.amount ?? ""}</El>
              <El an={s.unit} t={t} style={{ fontSize: g.px(32, 50), color: WHITE }}>{daily ? "บาทเท่านั้น" : "บาท"}</El>
            </div>
          </div>
          {f.pills.length > 0 && (
            <div style={box({ flexWrap: "wrap", marginTop: g.px(30, 44) })}>
              {f.pills.map((pill, i) => (
                <El key={pill} an={s[`pill${i}`]} t={t} style={{ background: GREEN, color: WHITE, borderRadius: 40, padding: "6px 24px", fontSize: g.px(28, 36), fontWeight: 600, marginRight: 16, marginBottom: 14 }}>{`✓ ${pill}`}</El>
              ))}
            </div>
          )}
          {f.priceNotes.length > 0 && (
            <El an={s.notes} t={t} style={{ flexDirection: "column", width: g.px(450, 800), marginTop: g.px(24, 36), fontSize: g.px(24, 30), color: WHITE, opacity: 0.85 }}>
              {f.priceNotes.map((x) => <div key={x} style={box({ marginBottom: 8, width: g.px(450, 800) })}>{x}</div>)}
            </El>
          )}
        </div>
        <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.px(30, 60) })}>
          {f.prices.map((r, i) => (
            <El key={r.label} an={s[`card${i}`]} t={t} style={{
              ...card(g, r.main), justifyContent: "space-between", alignItems: "center", padding: g.px("14px 24px", "20px 36px"),
              marginBottom: g.px(16, 22), color: r.main ? NAVY : WHITE, fontSize: g.px(28, 42),
            }}>
              <div style={box({})}>{r.label}</div>
              <div style={box({ fontWeight: 700, fontSize: g.px(r.main ? 44 : 34, r.main ? 64 : 50) })}>{r.main ? countAt(num(r.amount), look(s.count, t).p).toLocaleString("en-US") : r.amount}</div>
            </El>
          ))}
        </div>
      </Body>
    </>
  );
}

function CoverBars({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  const [first, second] = f.cover;
  const before = Number(first.label.match(/(\d+)/)?.[1] ?? f.coverToAge);
  const cw = g.w - g.side * 2;
  const ch = g.px(560, 600);
  const x0 = 40;
  const x2 = cw - 40;
  const x1 = second ? Math.round(x0 + ((before - f.age) / Math.max(1, f.coverToAge - f.age)) * (x2 - x0)) : x2;
  const base = Math.round(ch * 0.72);
  const h0 = Math.round(ch * 0.58);
  const h1 = second ? Math.round(h0 * (num(second.amount) / Math.max(1, num(first.amount)))) : 0;
  const bar = (an: Anim, x: number, w: number, h: number, color: string) => {
    const gr = look(an, t);
    return gr.opacity ? <rect x={x} y={base - Math.round(h * gr.p)} width={w} height={Math.round(h * gr.p)} rx={16} fill={color} /> : null;
  };
  const mark = (an: Anim, x: number, color: string) => {
    const l = look(an, t);
    return l.opacity ? <circle cx={x} cy={base} r={Math.round(20 * Math.max(0.3, Math.min(1.1, 0.4 + 0.6 * easeBack(l.p))))} fill={color} /> : null;
  };
  const words = (an: Anim, x: number, y: number, text: string, color: string) => (
    <El an={an} t={t} style={{ position: "absolute", left: x - 200, width: 400, top: y, justifyContent: "center", fontSize: g.px(46, 60), fontWeight: 700, color }}>{text}</El>
  );
  const million = (b: number) => `${(b / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  const age = (x: number, text: string, color: string) => <div style={abs({ left: x - 60, width: 120, justifyContent: "center", fontSize: g.px(36, 44), color })}>{text}</div>;
  return (
    <>
      <Header g={g} left={f.coverTitle} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={`คุ้มครองยาวถึงอายุ ${f.coverToAge}`} />
      <Body g={g} top={g.px(190, 200)}>
        <div style={box({ position: "relative", width: cw, height: ch })}>
          <svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`}>
            {bar(s.bar0, x0, x1 - x0, h0, GOLD)}
            {second ? bar(s.bar1, x1, x2 - x1, h1, SKY) : null}
            {stroke({ d: `M${x0} ${base} L${x2} ${base}`, len: x2 - x0, p: look(s.axis, t).p, color: WHITE, width: 10 })}
            {mark(s.m0, x0, WHITE)}{second ? mark(s.m1, x1, WHITE) : null}{mark(s.m2, x2, GOLD)}
          </svg>
          {words(s.l0, (x0 + x1) / 2, base - Math.round(h0 / 2) - 36, million(num(first.amount)), NAVY)}
          {second ? words(s.l1, (x1 + x2) / 2, base - Math.round(h1 / 2) - 36, million(num(second.amount)), WHITE) : null}
          <El an={s.ages} t={t} style={{ position: "absolute", left: 0, top: base + 30, width: cw, height: 70 }}>
            {age(x0, String(f.age), WHITE)}
            {second ? age(x1, String(before), WHITE) : null}
            {age(x2, String(f.coverToAge), GOLD)}
          </El>
        </div>
      </Body>
    </>
  );
}

function CoverRows({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  const many = f.cover.length;
  const cols = g.wide && many > 4 ? 2 : 1;
  const tight = !g.wide && many > 4;
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={f.coverTitle} />
      <Body g={g} style={{ flexDirection: "column" }}>
        <Grid g={g} cols={cols} gap={g.px(tight ? 10 : 16, cols === 1 ? 16 : 22)}>
          {f.cover.map((r, i) => (
            <El key={r.label} an={s[`row${i}`]} t={t} style={{ ...card(g), alignItems: "center", padding: tight ? "8px 20px" : g.px("12px 22px", cols === 1 ? "14px 32px" : "26px 34px") }}>
              <div style={box({ width: g.px(42, 64), height: g.px(42, 64), borderRadius: 32, background: GREEN, color: WHITE, fontSize: g.px(26, 38), fontWeight: 700, alignItems: "center", justifyContent: "center", flexShrink: 0 })}>✓</div>
              <div style={box({ flex: 1, flexShrink: 1, marginLeft: 22, fontSize: g.px(tight ? 26 : 30, 42), color: WHITE })}>{r.label}</div>
              <div style={box({ marginLeft: 16, fontSize: g.px(tight ? 30 : 34, 50), fontWeight: 700, color: GOLD, flexShrink: 0 })}>{r.amount}</div>
            </El>
          ))}
        </Grid>
        {f.coverNote && <El an={s.note} t={t} style={{ fontSize: g.px(22, 28), color: WHITE, opacity: 0.85 }}>{f.coverNote}</El>}
      </Body>
    </>
  );
}

function Value({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("value", f, c.voiceSec, c.words.join(" "));
  const cw = g.px(560, 1040);
  // the landscape chart a little lower than it was, for the pen notes above and below it (owner, 2026-10-13)
  const ch = g.px(330, 400);
  const p = chartPaths(f, cw, ch);
  // the notes are laid out for the portrait chart, 900×520
  const k = Math.min(cw / 900, ch / 520);
  const be = f.breakEven;
  const last = f.rows?.[f.rows.length - 1];
  return (
    <>
      <Header g={g} left="เงินไม่หายไปไหน" right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="มูลค่าเงินสดโตทุกปี" />
      <Body g={g} style={{ alignItems: "center" }}>
        <div style={box({ position: "relative", flexDirection: "column", width: cw + 20, flexShrink: 0, paddingTop: Math.round(NOTES_ABOVE * k), paddingBottom: Math.round(NOTES_BELOW * k) })}>
          <svg width={cw + 20} height={ch + 20} viewBox={`-10 -10 ${cw + 20} ${ch + 20}`}>
            <line x1={0} y1={ch} x2={cw} y2={ch} stroke="rgba(255,255,255,0.4)" strokeWidth={4} opacity={look(s.axes, t).opacity} />
            {stroke({ d: p.paid, len: p.paidLen, p: look(s.paid, t).p, color: "rgba(255,255,255,0.8)", width: 8 })}
            {stroke({ d: p.cash, len: p.cashLen, p: look(s.cash, t).p, color: GOLD, width: 10 })}
            {p.be && look(s.dot, t).opacity > 0 && <circle cx={p.be.x} cy={p.be.y} r={Math.round(20 * (0.4 + 0.6 * easeBack(look(s.dot, t).p)))} fill={RED} />}
          </svg>
          <El an={s.legend} t={t} style={{ position: "absolute", right: 10, top: Math.round(NOTES_ABOVE * k) + 10 + ch + Math.round(100 * k), fontSize: g.px(22, 26), color: WHITE }}>
            <div style={box({ marginRight: 24 })}>— เบี้ยที่จ่าย</div>
            <div style={box({ color: GOLD })}>— มูลค่าเงินสด</div>
          </El>
          <div style={abs({ left: 10, top: Math.round(NOTES_ABOVE * k) + 10, width: cw, height: ch })}>{chartNotes(f, p, k, (name) => look(s[name], t))}</div>
        </div>
        <El an={s.card} t={t} style={{ flex: 1, marginLeft: g.px(24, 60), flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 32, padding: g.px("20px 24px", "28px 36px"), borderLeft: `${g.px(12, 16)}px solid ${RED}` }}>
          {be ? (
            <div style={box({ flexDirection: "column" })}>
              <div style={box({ fontSize: g.px(28, 38), fontWeight: 700, color: RED })}>{`จุดคุ้มทุน อายุ ${be.age}`}</div>
              <div style={box({ fontSize: g.px(36, 52), fontWeight: 700 })}>{`ขอคืนได้ ${be.cash} บาท`}</div>
              <div style={box({ fontSize: g.px(24, 32) })}>{`มากกว่าที่จ่ายไป ${f.totalPaid} บาท`}</div>
            </div>
          ) : (
            <div style={box({ fontSize: g.px(32, 44), fontWeight: 700 })}>{`อายุ ${last?.age ?? f.coverToAge} มูลค่าเงินสด ${last?.cash ?? ""} บาท`}</div>
          )}
        </El>
      </Body>
    </>
  );
}

function Compare({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("compare", f, c.voiceSec);
  const plans = f.compare ?? [];
  const gap = g.px(20, 30);
  const total = g.wide ? 1400 : g.w - g.side * 2;
  const colW = Math.floor((total - gap * (plans.length - 1)) / Math.max(1, plans.length));
  const colH = g.px(560, 620);
  const left = g.wide ? Math.round((g.w - total) / 2) : g.side;
  const mainAt = plans.findIndex((p) => p.main);
  const ringP = look(s.ring, t).p;
  const lab = g.px(22, 30);
  const val = (main: boolean, a: number, b: number): React.CSSProperties => ({ fontSize: g.px(a, b), fontWeight: 700, color: main ? NAVY : GOLD });
  return (
    <>
      <Header g={g} left="เลือกแผนที่ใช่" right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="เทียบแผน iHealthy Ultra" />
      <div style={abs({ left, top: g.px(190, 200), width: total })}>
        {plans.map((p, i) => (
          <El key={p.name} an={s[`col${i}`]} t={t} style={{
            width: colW, height: colH, marginRight: i < plans.length - 1 ? gap : 0, flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 32,
            background: p.main ? WHITE : "rgba(255,255,255,0.1)", border: `4px solid ${p.main ? GOLD : "rgba(255,255,255,0.22)"}`, color: p.main ? NAVY : WHITE,
          }}>
            <div style={box({ fontSize: g.px(36, 54), fontWeight: 700 })}>{p.name}</div>
            <div style={box({ fontSize: lab, marginTop: 16, opacity: 0.8 })}>วงเงิน/ปี</div>
            <div style={box(val(p.main, 40, 60))}>{p.ceiling}</div>
            <div style={box({ fontSize: lab, marginTop: 12, opacity: 0.8 })}>ค่าห้อง/วัน</div>
            <div style={box({ fontSize: g.px(30, 46), fontWeight: 600 })}>{p.room}</div>
            <div style={box({ fontSize: lab, marginTop: 12, opacity: 0.8 })}>ผู้ป่วยนอก/ปี</div>
            <div style={box({ fontSize: g.px(30, 46), fontWeight: 600 })}>{p.opd}</div>
            <div style={box({ fontSize: lab, marginTop: 12, opacity: 0.8 })}>เดือนละ</div>
            <div style={box({ fontSize: g.px(36, 54), fontWeight: 700 })}>{p.monthly}</div>
          </El>
        ))}
      </div>
      {mainAt >= 0 && ringP > 0 && (
        <div style={abs({ left: left + mainAt * (colW + gap) - 18, top: g.px(190, 200) - 18, width: colW + 36, height: colH + 36 })}>
          <svg width={colW + 36} height={colH + 36} viewBox={`0 0 ${colW + 36} ${colH + 36}`}>
            {stroke({ d: `M${(colW + 36) / 2} 5 C${colW + 32} 5 ${colW + 32} 5 ${colW + 32} ${(colH + 36) / 2} C${colW + 32} ${colH + 31} ${colW + 32} ${colH + 31} ${(colW + 36) / 2} ${colH + 31} C4 ${colH + 31} 4 ${colH + 31} 4 ${(colH + 36) / 2} C4 5 4 5 ${(colW + 36) / 2 - 18} 7`, len: 2 * (colW + 36) + 2 * (colH + 36), p: ringP, color: RED, width: 7 })}
          </svg>
        </div>
      )}
      <El an={s.note} t={t} style={{ position: "absolute", left: g.side, width: g.w - g.side * 2, top: g.px(190, 200) + colH + 20, justifyContent: g.wide ? "center" : "flex-start", fontSize: g.px(22, 28), color: WHITE, opacity: 0.85 }}>{`ต่ออายุได้ถึงอายุ ${f.coverToAge} · เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น`}</El>
    </>
  );
}

/** One frame of a square or landscape quote clip at scene time t. */
export function wideQuoteFrame(key: SceneKey, c: WideQuoteContext, t: number, size: Exclude<VideoSize, "portrait">) {
  const g = geo(size);
  const body = {
    lead: <Lead g={g} c={c} t={t} />,
    price: <Price g={g} c={c} t={t} />,
    cover: c.facts.coverStyle === "bars" ? <CoverBars g={g} c={c} t={t} /> : <CoverRows g={g} c={c} t={t} />,
    value: <Value g={g} c={c} t={t} />,
    compare: <Compare g={g} c={c} t={t} />,
    contact: (
      <ContactScene g={g} s={motionSpec("contact", c.facts, c.voiceSec)} t={t} title="สนใจรายละเอียดเพิ่มเติม" header={c.facts.insuredWho}
        customer={c.customer} narrator={c.narrator} contact={c.contact} note={c.facts.footNote} />
    ),
  }[key];
  return <Frame g={g} words={c.words} t={t} voiceSec={c.voiceSec}>{body}</Frame>;
}

// ——— the FHC summary ———

export interface WideFhcContext {
  facts: FhcVideoFacts;
  customer: string;
  narrator?: "F" | "M";
  contact: Contact;
  words: string[];
  voiceSec: number;
}

const who = (f: FhcVideoFacts) => `${f.sex === "F" ? "หญิง" : "ชาย"} อายุ ${f.age}`;

function Open({ g, c, t }: { g: Geo; c: WideFhcContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcOpen", f);
  const pw = g.px(g.w - g.side * 2, 860);
  return (
    <>
      <Header g={g} left="Financial Health Check" right={who(f)} />
      <Body g={g} top={g.px(110, 150)} style={{ flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "center" : "flex-start" }}>
        <div style={box({ flexDirection: "column", ...(g.wide ? { width: 900 } : {}) })}>
          <El an={s.kicker} t={t} style={{ fontSize: g.px(30, 38), fontWeight: 600, color: GOLD, letterSpacing: 4 }}>FINANCIAL HEALTH CHECK</El>
          <El an={s.title} t={t} style={{ flexDirection: "column", fontSize: g.px(76, 100), fontWeight: 700, color: WHITE, lineHeight: 1.22, marginTop: 10 }}>
            <div style={box({})}>สรุปผลตรวจ</div>
            <div style={box({})}>สุขภาพการเงิน</div>
          </El>
          <div style={box({ marginTop: g.px(10, 30) })}>
            <svg width={pw} height={g.px(110, 170)} viewBox="0 0 1000 200" preserveAspectRatio="none">
              {stroke({ d: "M0 100 L340 100 L400 30 L470 170 L540 60 L590 100 L1000 100", len: 1180, p: look(s.pulse, t).p, color: GOLD, width: 10 })}
            </svg>
          </div>
        </div>
        <div style={box({ flexDirection: "column", marginLeft: g.wide ? 60 : 0, marginTop: g.wide ? 0 : 10 })}>
          {c.customer ? (
            <El an={s.name} t={t} style={{ flexDirection: "column" }}>
              <div style={box({ fontSize: g.px(34, 44), color: WHITE })}>จัดทำสำหรับ</div>
              <div style={box({ fontSize: g.px(72, 96), fontWeight: 700, color: GOLD })}>{`คุณ${c.customer}`}</div>
            </El>
          ) : null}
          <El an={s.date} t={t} style={{ fontSize: g.px(30, 40), color: WHITE, opacity: 0.8, marginTop: 6 }}>{`ตรวจเมื่อ ${f.checkedOn}`}</El>
        </div>
      </Body>
    </>
  );
}

function Scores({ g, c, t }: { g: Geo; c: WideFhcContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcScores", f);
  const cols = g.wide ? 2 : 1;
  const dot = g.px(34, 56);
  return (
    <>
      <Header g={g} left="ผลตรวจ 6 ด้าน" right={who(f)} />
      <Kicker g={g} an={s.kicker} t={t} text="6 ด้านของคุณ" />
      <Body g={g} style={{ flexDirection: "column" }}>
        <Grid g={g} cols={cols} gap={g.px(10, 22)}>
          {f.scores.map((r, i) => (
            <El key={r.key} an={s[`row${i}`]} t={t} style={{ ...card(g), alignItems: "center", padding: g.px("10px 24px", "30px 34px") }}>
              <div style={box({ width: dot, height: dot, borderRadius: dot / 2, background: LIGHT[r.level], flexShrink: 0 })} />
              <div style={box({ flex: 1, marginLeft: 22, fontSize: g.px(32, 48), color: WHITE })}>{r.label}</div>
              <div style={box({ marginLeft: 14, fontSize: g.px(28, 38), color: WHITE, opacity: 0.85, flexShrink: 0 })}>{r.value}</div>
            </El>
          ))}
        </Grid>
        <El an={s.legend} t={t} style={{ fontSize: g.px(26, 32), color: WHITE, alignItems: "center", marginTop: g.px(2, 10) }}>
          {(["green", "yellow", "red"] as const).map((lv) => (
            <div key={lv} style={box({ alignItems: "center", marginRight: 36 })}>
              <div style={box({ width: 24, height: 24, borderRadius: 12, background: LIGHT[lv], marginRight: 10 })} />
              <div style={box({})}>{lv === "green" ? "ดี" : lv === "yellow" ? "ควรปรับ" : "ต้องแก้"}</div>
            </div>
          ))}
        </El>
      </Body>
    </>
  );
}

function Gaps({ g, c, t }: { g: Geo; c: WideFhcContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcGaps", f);
  const cols = g.wide ? 2 : 1;
  const gap = g.wide ? 70 : 0;
  const trackW = Math.floor((g.w - g.side * 2 - gap * (cols - 1)) / cols);
  const barH = g.px(26, 36);
  return (
    <>
      <Header g={g} left="มีอยู่ เทียบ ควรมี" right={who(f)} />
      <Kicker g={g} an={s.kicker} t={t} text="ขาดอยู่เท่าไร" />
      <Body g={g} style={{ flexDirection: "column" }}>
        <Grid g={g} cols={cols} gap={gap}>
          {f.gaps.map((x, i) => {
            const ok = x.state === "ok";
            const share = ok ? 1 : x.should > 0 ? Math.min(1, x.have / x.should) : 0;
            const fillW = Math.round(trackW * share * look(s[`bar${i}`], t).p);
            return (
              <El key={x.key} an={s[`row${i}`]} t={t} style={{ flexDirection: "column", marginBottom: g.px(22, 50) }}>
                <div style={box({ justifyContent: "space-between", alignItems: "flex-end", fontSize: g.px(34, 46), color: WHITE })}>
                  <div style={box({ fontWeight: 600 })}>{x.label}</div>
                  <div style={box({ fontSize: g.px(30, 40), color: ok ? GREEN : x.have ? WHITE : RED, fontWeight: 600 })}>
                    {ok ? "✓ พอแล้ว" : x.have ? `${n(x.have)} ${UNIT[x.unit]}` : "ยังไม่มี"}
                  </div>
                </div>
                <div style={box({ position: "relative", marginTop: 10, width: trackW, height: barH, borderRadius: barH / 2, background: "rgba(255,255,255,0.14)" })}>
                  {fillW > 0 ? <div style={abs({ left: 0, top: 0, width: Math.max(barH, fillW), height: barH, borderRadius: barH / 2, background: ok ? GREEN : SKY })} /> : null}
                </div>
                <div style={box({ marginTop: 8, fontSize: g.px(26, 34), color: WHITE, opacity: 0.8 })}>{`${x.key === "retire" ? "อยากมี" : "ควรมี"} ${n(x.should)} ${UNIT[x.unit]}`}</div>
              </El>
            );
          })}
        </Grid>
      </Body>
    </>
  );
}

function Events({ g, c, t }: { g: Geo; c: WideFhcContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcEvents", f);
  const cols = g.wide ? 2 : 1;
  const ring = g.px(52, 76);
  return (
    <>
      <Header g={g} left="รับมือได้แค่ไหน" right={who(f)} />
      <Kicker g={g} an={s.kicker} t={t} text="5 เรื่องที่ควบคุมไม่ได้" />
      <Body g={g} style={{ flexDirection: "column" }}>
        <Grid g={g} cols={cols} gap={g.px(10, 26)}>
          {f.events.map((e, i) => (
            <El key={e.key} an={s[`row${i}`]} t={t} style={{ ...card(g), alignItems: "center", padding: g.px("8px 20px", "24px 30px") }}>
              <div style={box({ width: ring, height: ring, borderRadius: ring / 2, border: `4px solid ${GOLD}`, color: GOLD, fontSize: g.px(28, 36), fontWeight: 700, alignItems: "center", justifyContent: "center", flexShrink: 0 })}>{String(i + 1)}</div>
              <div style={box({ flex: 1, flexDirection: "column", marginLeft: 22, flexShrink: 1 })}>
                <div style={box({ fontSize: g.px(32, 48), fontWeight: 600, color: WHITE })}>{e.name}</div>
                {e.line ? <div style={box({ fontSize: g.px(22, 32), color: WHITE, opacity: 0.8 })}>{e.line}</div> : null}
              </div>
              <div style={box({ width: g.px(36, 46), height: g.px(36, 46), borderRadius: 24, background: LIGHT[e.level], marginLeft: 14, flexShrink: 0 })} />
            </El>
          ))}
        </Grid>
      </Body>
    </>
  );
}

function Plan({ g, c, t }: { g: Geo; c: WideFhcContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcPlan", f);
  const [first, ...rest] = f.plan;
  const total = f.plan.reduce((x, r) => x + r.monthly, 0);
  if (!first) {
    const done = f.gaps.every((x) => x.state === "ok");
    const r = g.px(200, 240);
    return (
      <>
        <Header g={g} left="แผนของคุณ" right={who(f)} />
        <Body g={g} top={g.px(150, 170)} style={{ alignItems: "center", justifyContent: "center" }}>
          <El an={s.card} t={t} style={{ alignItems: "center" }}>
            <div style={box({ width: r, height: r, borderRadius: r / 2, background: done ? GREEN : SKY, color: WHITE, fontSize: Math.round(r * 0.6), fontWeight: 700, alignItems: "center", justifyContent: "center" })}>{done ? "✓" : "?"}</div>
            <div style={box({ flexDirection: "column", marginLeft: 50 })}>
              <div style={box({ fontSize: g.px(64, 80), fontWeight: 700, color: WHITE })}>{done ? "ครบทุกด้านแล้ว" : "มาคุยกันก่อน"}</div>
              <div style={box({ fontSize: g.px(38, 46), color: GOLD })}>{done ? "ดูแลต่อแบบนี้ได้เลย" : "ว่าจะเริ่มตรงไหน"}</div>
            </div>
          </El>
        </Body>
      </>
    );
  }
  const price = `${first.per} ${n(first.monthly)} บาท`;
  const priceFs = g.px(46, 60);
  return (
    <>
      <Header g={g} left="แผนที่แนะนำ" right={who(f)} />
      <Kicker g={g} an={s.kicker} t={t} text="เริ่มที่ตรงนี้ก่อน" />
      <Body g={g} style={{ flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "center" : "stretch" }}>
        <El an={s.card} t={t} style={{ flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 34, padding: g.px("22px 32px", "34px 44px"), ...(g.wide ? { width: 900 } : {}), flexShrink: 0 }}>
          <div style={box({ fontSize: g.px(26, 34), opacity: 0.75 })}>{`1 · ${first.label}`}</div>
          <div style={box({ fontSize: g.px(40, 52), fontWeight: 700, marginTop: 4 })}>{first.product}</div>
          <div style={box({ fontSize: g.px(30, 40), marginTop: 4 })}>{first.detail}</div>
          <div style={box({ position: "relative", marginTop: 12, alignSelf: "flex-start" })}>
            <div style={abs({ left: -8, bottom: 4, width: Math.round(price.length * priceFs * 0.5 * look(s.sweep, t).p), height: Math.round(priceFs * 0.6), background: GOLD, opacity: 0.85, borderRadius: 8 })} />
            <div style={box({ fontSize: priceFs, fontWeight: 700 })}>{price}</div>
          </div>
        </El>
        <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.wide ? 60 : 0, marginTop: g.wide ? 0 : 16 })}>
          {rest.map((r, i) => (
            <El key={r.key} an={s[`row${i}`]} t={t} style={{ justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid rgba(255,255,255,0.18)", padding: g.px("10px 4px", "20px 4px"), fontSize: g.px(30, 40), color: WHITE }}>
              <div style={box({ flexShrink: 1 })}>{`${i + 2} · ${r.label} ${r.product}`}</div>
              <div style={box({ marginLeft: 20, flexShrink: 0 })}>{`เดือนละ ${n(r.monthly)}`}</div>
            </El>
          ))}
          {rest.length > 0 ? (
            <El an={s.total} t={t} style={{ justifyContent: "space-between", alignItems: "center", padding: g.px("12px 4px", "22px 4px"), fontSize: g.px(34, 46), fontWeight: 700, color: WHITE }}>
              <div style={box({})}>ทั้งแผน</div>
              <div style={box({ color: GOLD })}>{`เดือนละ ${n(total)} บาท`}</div>
            </El>
          ) : null}
        </div>
      </Body>
    </>
  );
}

/** One frame of a square or landscape FHC summary at scene time t. */
export function wideFhcFrame(key: FhcSceneKey, c: WideFhcContext, t: number, size: Exclude<VideoSize, "portrait">) {
  const g = geo(size);
  const body = {
    fhcOpen: <Open g={g} c={c} t={t} />,
    fhcScores: <Scores g={g} c={c} t={t} />,
    fhcGaps: <Gaps g={g} c={c} t={t} />,
    fhcEvents: <Events g={g} c={c} t={t} />,
    fhcPlan: <Plan g={g} c={c} t={t} />,
    fhcContact: (
      <ContactScene g={g} s={fhcSpec("fhcContact", c.facts)} t={t} title="คุยรายละเอียดได้เลย" header={who(c.facts)}
        customer={c.customer} narrator={c.narrator} contact={c.contact} note="ตัวเลขเป็นของวันที่ตรวจ เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท" />
    ),
  }[key];
  return <Frame g={g} words={c.words} t={t} voiceSec={c.voiceSec}>{body}</Frame>;
}
