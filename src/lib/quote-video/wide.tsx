import type { ReactNode } from "react";
import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import type { Level } from "@/lib/fhc/health";
import type { FhcSceneKey, FhcVideoFacts } from "./fhc";
import { fhcSpec } from "./fhc-motion";
import { chartNotes, NOTES_ABOVE, NOTES_BELOW } from "./chart-pen";
import { abs, box, chartPaths, easeBack, El, heartCross, legacyStairs, look, motionSpec, pensionSteps, pensionTimeline, plbTermCards, plbTimeline, shieldFamily, stroke, type Anim } from "./motion";
import { leadBig, leadPill } from "./plb";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { countAt, SIZES, type VideoSize } from "./timeline";
import type { Extra } from "./told";
import { preparedLine, VIDEO_WORDS, wordsOf, type VideoWords } from "./video-words";

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

interface Contact { name: string; phone: string; line?: string; more?: string; photo?: string }

/** the agent's card, shared by both kinds of clip */
function ContactScene({ g, s, t, title, header, customer, narrator, contact, note, vw = VIDEO_WORDS.th }: {
  g: Geo; s: Record<string, Anim>; t: number; title: string; header: string; customer: string; narrator?: "F" | "M"; contact: Contact; note?: string;
  /** the clip's language (video-words.ts); Thai unless an iHealthy clip asked for another */
  vw?: VideoWords;
}) {
  const [said, help] = vw.contactLines(narrator ?? "F");
  const thai = vw === VIDEO_WORDS.th;
  const k = contact;
  const initial = [...k.name.trim()][0] ?? "?";
  const face = g.px(150, 200);
  return (
    <>
      <Header g={g} left={customer ? vw.contactFor(customer) : title} right={header} />
      <Body g={g} top={g.px(130, 170)} style={{ flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "center" : "flex-start" }}>
        <El an={s.title} t={t} style={{ flexDirection: "column", fontSize: g.px(thai ? 64 : 52, thai ? 84 : 68), fontWeight: 700, color: WHITE, lineHeight: vw.lineHeight, ...(g.wide ? { width: 760 } : {}) }}>
          <div style={box({})}>{said}</div>
          <div style={box({ color: GOLD })}>{help}</div>
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
              <div style={box({ fontSize: g.px(36, 44), marginTop: 6 })}>{`${vw.phone} ${k.phone}`}</div>
              {k.line && <div style={box({ fontSize: g.px(36, 44) })}>{`LINE ${k.line}`}</div>}
            </div>
          </El>
          {k.more && (
            <El an={s.card} t={t} style={{ flexDirection: "column", marginTop: 30, fontSize: g.px(36, 44), color: WHITE, lineHeight: 1.45 }}>
              {k.more.split("\n").map((m, i) => <div key={i} style={box({})}>{m}</div>)}
            </El>
          )}
          {note && <El an={s.note} t={t} style={{ marginTop: 22, fontSize: g.px(24, 28), color: WHITE, opacity: 0.75 }}>{note}</El>}
        </div>
      </Body>
    </>
  );
}

// ——— the quote clips ———

export interface WideQuoteContext {
  facts: QuoteVideoFacts;
  /** โจทย์การเล่า (told.ts) */
  headline?: string[];
  loop?: boolean;
  extra?: Extra;
  customer: string;
  narrator?: "F" | "M";
  contact: Contact;
  words: string[];
  voiceSec: number;
}

/** มรดก's opening (motion.tsx LegacyLead) side by side: the shield on the left, the legacy and the most the family receives on the right */
function LegacyLead({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const big = leadBig(f);
  const s = motionSpec("lead", f, c.voiceSec);
  const shieldW = g.px(300, 460);
  const n0 = countAt(f.lead.baht, look(s.count, t).p);
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Body g={g} top={g.px(130, 150)} style={{ alignItems: "center" }}>
        {shieldFamily(s, t, shieldW, Math.round(shieldW * 1.075))}
        <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.px(36, 80) })}>
          {c.customer && <El an={s.name} t={t} style={{ fontSize: g.px(30, 42), color: WHITE, marginBottom: 12 }}>จัดทำสำหรับ <span style={{ color: GOLD, fontWeight: 600, marginLeft: 10 }}>คุณ{c.customer}</span></El>}
          {c.headline?.length ? (
            <div style={box({ flexDirection: "column", marginBottom: g.px(12, 20) })}>
              {c.headline.map((h, i) => <div key={i} style={box({ fontSize: g.px(38, 56), fontWeight: 700, color: i === 0 ? WHITE : GOLD, lineHeight: 1.2 })}>{h}</div>)}
            </div>
          ) : null}
          <El an={s.kicker} t={t} style={{ fontSize: g.px(34, 46), fontWeight: 600, color: WHITE, opacity: 0.9 }}>{f.planLine}</El>
          <El an={s.big} t={t} style={{ fontSize: big.length > 16 ? g.px(64, 100) : g.px(84, 130), fontWeight: 700, color: GOLD, lineHeight: 1.15 }}>{big}</El>
          <El an={s.note} t={t} style={{ fontSize: g.px(30, 42), color: WHITE, marginTop: g.px(6, 12) }}>{f.lead.label}</El>
          <El an={s.mark} t={t} style={{ marginTop: g.px(10, 16) }}>
            <div style={box({ background: GOLD, color: NAVY, borderRadius: 40, padding: "4px 30px", fontSize: g.px(48, 66), fontWeight: 700 })}>{`${n0.toLocaleString("en-US")} บาท`}</div>
          </El>
          <El an={s.mark} t={t} style={{ marginTop: g.px(14, 22) }}>
            <div style={box({ border: `3px solid ${WHITE}`, color: WHITE, borderRadius: 40, padding: "2px 26px", fontSize: g.px(28, 36) })}>{leadPill(f)}</div>
          </El>
        </div>
      </Body>
    </>
  );
}

/** มรดก's staircase (motion.tsx legacyStairs) at this frame's size, the exact figures beside it on a landscape frame */
function CoverBands({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  const top = g.px(190, 200);
  const w = g.wide ? 1000 : g.w - g.side * 2;
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={f.coverTitle} />
      <div style={abs({ left: g.side, top, width: w, height: g.bottom - top })}>{legacyStairs(f, s, t, w, g.bottom - top, g.px(0.72, 0.8))}</div>
      {g.wide && (
        <div style={abs({ left: g.side + w + 60, width: g.w - g.side * 2 - w - 60, top: top + 40, flexDirection: "column" })}>
          {f.cover.map((r, i) => (
            <El key={r.label} an={s[`lab${i}`]} t={t} style={{ ...card(g), flexDirection: "column", padding: "16px 28px", marginBottom: 18, color: WHITE }}>
              <div style={box({ fontSize: 32, opacity: 0.85 })}>{r.label}</div>
              <div style={box({ fontSize: 46, fontWeight: 700, color: i === 0 ? GOLD : WHITE })}>{`${r.amount} บาท`}</div>
            </El>
          ))}
        </div>
      )}
    </>
  );
}

/** Protection Life's flat bar (motion.tsx plbTimeline) across the frame, the rule and the end age under it */
function CoverFlat({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const p = f.plb;
  const s = motionSpec("cover", f, c.voiceSec);
  if (!p) return null;
  const w = g.w - g.side * 2;
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={f.coverTitle} />
      <Body g={g} style={{ flexDirection: "column" }}>
        <El an={s.sub} t={t} style={{ fontSize: g.px(36, 44), color: WHITE, opacity: 0.9, marginBottom: g.px(30, 40) }}>{f.cover[0]?.label ?? ""}</El>
        {plbTimeline(f, s, t, w, g.px(0.8, 0.9))}
        <div style={box({ marginTop: g.px(40, 50), alignItems: "center", justifyContent: "space-between", width: w })}>
          <El an={s.rule} t={t} style={{ background: WHITE, color: NAVY, borderRadius: 32, padding: g.px("14px 28px", "18px 36px"), fontSize: g.px(38, 48), fontWeight: 700 }}>จ่ายเท่าไหร่ คุ้มครองเท่านั้นปี</El>
          {g.wide && (
            <El an={s.pen} t={t} style={{ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 30px", fontSize: 38, fontWeight: 600 }}>{`✓ คุ้มครองถึงอายุ ${p.endAge}`}</El>
          )}
        </div>
      </Body>
    </>
  );
}

/** Protection Life's terms (motion.tsx plbTermCards): the cards on the left, the total and the tax on the right of a landscape frame */
function Terms({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const p = f.plb;
  const s = motionSpec("terms", f, c.voiceSec);
  if (!p) return null;
  const listW = g.wide ? 1000 : g.w - g.side * 2;
  const big = g.px(0.78, 0.86);
  const side = (
    <div style={box({ flexDirection: "column", alignItems: "flex-start", ...(g.wide ? { marginLeft: 70, flex: 1 } : { marginTop: 4 }) })}>
      <El an={s.total} t={t} style={{ fontSize: g.px(38, 46), color: WHITE, flexDirection: g.wide ? "column" : "row", alignItems: g.wide ? "flex-start" : "center" }}>
        <div style={box({})}>{`รวมจ่าย ${p.years} ปี`}</div>
        <div style={box({ color: GOLD, fontWeight: 700, marginLeft: g.wide ? 0 : 14, fontSize: g.px(42, 64) })}>{`${p.total} บาท`}</div>
      </El>
      <div style={box({ alignItems: "center", marginTop: g.px(12, 26), flexDirection: g.wide ? "column" : "row", ...(g.wide ? { alignItems: "flex-start" } : {}) })}>
        {p.tax && (
          <El an={s.pill} t={t} style={{ background: GREEN, color: WHITE, borderRadius: 40, padding: "6px 26px", fontSize: g.px(30, 38), fontWeight: 600, marginRight: 22, marginBottom: g.wide ? 22 : 0 }}>✓ ลดหย่อนภาษีได้</El>
        )}
        <El an={s.note} t={t} style={{ fontSize: g.px(24, 28), color: WHITE, opacity: 0.75 }}>ความคุ้มครองล้วน ครบสัญญาไม่มีเงินคืน</El>
      </div>
    </div>
  );
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="เลือกระยะได้ตามภาระ" />
      <Body g={g} top={g.px(170, 200)} style={{ flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "center" : "flex-start" }}>
        {plbTermCards(f, s, t, listW, big)}
        {side}
      </Body>
    </>
  );
}

/** มรดก's critical-illness lump sum (motion.tsx Critical): the heart on the left, the sum and what stays on the right */
function Critical({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const l = f.legacy;
  const s = motionSpec("critical", f, c.voiceSec);
  if (!l) return null;
  const icon = g.px(200, 340);
  return (
    <>
      <Header g={g} left={f.planLine} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={`ตรวจพบโรคร้ายแรง 1 ใน ${l.diseaseCount} โรค`} />
      <Body g={g} style={{ alignItems: "center" }}>
        <El an={s.icon} t={t} style={{ width: icon, height: icon, flexShrink: 0 }}>{heartCross(icon)}</El>
        <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.px(36, 80) })}>
          <El an={s.sub} t={t} style={{ fontSize: g.px(40, 54), color: WHITE }}>รับเงินก้อนไว้รักษาตัวเอง</El>
          <div style={box({ alignItems: "flex-end", marginTop: g.px(8, 14) })}>
            <El an={s.big} t={t} style={{ background: GOLD, color: NAVY, borderRadius: 40, padding: "0 34px", fontSize: g.px(96, 140), fontWeight: 700, lineHeight: 1.2 }}>{countAt(l.critical, look(s.count, t).p).toLocaleString("en-US")}</El>
            <El an={s.unit} t={t} style={{ fontSize: g.px(36, 50), color: WHITE, marginLeft: 18, marginBottom: 14 }}>บาท</El>
          </div>
          <El an={s.note} t={t} style={{ flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 30, padding: g.px("14px 24px", "20px 32px"), marginTop: g.px(20, 30) }}>
            <div style={box({ fontSize: g.px(30, 40), fontWeight: 700 })}>จ่ายครั้งเดียว</div>
            <div style={box({ fontSize: g.px(28, 38) })}>ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว</div>
          </El>
          <El an={s.pill} t={t} style={{ marginTop: g.px(14, 22) }}>
            <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "6px 26px", fontSize: g.px(28, 36), fontWeight: 600 })}>{`✓ โรคร้ายแรงคุ้มครองถึงอายุ ${l.criticalToAge}`}</div>
          </El>
        </div>
      </Body>
    </>
  );
}

function Lead({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  if (f.legacy || f.plb) return <LegacyLead g={g} c={c} t={t} />;
  const s = motionSpec("lead", f, c.voiceSec);
  const shieldW = g.px(330, 500);
  const shieldH = Math.round(shieldW * 1.075);
  const n0 = countAt(f.lead.baht, look(s.count, t).p);
  const big = g.px(f.lead.amount.length > 9 ? 96 : 110, f.lead.amount.length > 9 ? 150 : 176);
  const vw = wordsOf(f);
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
          {c.customer && <El an={s.name} t={t} style={{ fontSize: g.px(32, 42), color: WHITE, marginBottom: 12 }}>{preparedLine(vw, c.customer).map((p, i) => <span key={i} style={{ ...(p.name ? { color: GOLD, fontWeight: 600 } : {}), marginLeft: i ? 10 : 0 }}>{p.text}</span>)}</El>}
          {c.headline?.length ? (
            <div style={box({ flexDirection: "column", marginBottom: g.px(14, 24) })}>
              {c.headline.map((h, i) => <div key={i} style={box({ fontSize: g.px(40, 58), fontWeight: 700, color: i === 0 ? WHITE : GOLD, lineHeight: 1.2 })}>{h}</div>)}
            </div>
          ) : null}
          <El an={s.kicker} t={t} style={{ fontSize: g.px(44, 64), fontWeight: 600, color: WHITE }}>{f.lead.label}</El>
          <El an={s.big} t={t} style={{ fontSize: big, fontWeight: 700, color: GOLD, lineHeight: 1.15 }}>{n0.toLocaleString("en-US")}</El>
          <El an={s.note} t={t} style={{ fontSize: g.px(28, 40), color: WHITE, opacity: 0.85 }}>{`${vw.baht}${f.lead.note ? ` · ${f.lead.note}` : ""}`}</El>
          <El an={s.mark} t={t} style={{ marginTop: g.px(20, 30) }}>
            <div style={box({ background: GOLD, color: NAVY, borderRadius: 40, padding: "6px 30px", fontSize: g.px(34, 48), fontWeight: 600 })}>{f.leadMark}</div>
          </El>
        </div>
      </Body>
    </>
  );
}


function StoryScene({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const s = motionSpec("story", c.facts, c.voiceSec);
  const pts = c.extra?.story.points ?? [];
  return (
    <>
      <Header g={g} left={c.facts.planLine} right={c.facts.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="ลองนึกภาพ" />
      <Body g={g} style={{ flexDirection: "column", justifyContent: "center" }}>
        {pts.map((pt, i) => (
          <El key={i} an={s[`pt${i}`]} t={t} style={{ alignItems: "center", background: i === pts.length - 1 ? GOLD : "rgba(255,255,255,0.1)", color: i === pts.length - 1 ? NAVY : WHITE, borderRadius: 30, padding: g.px("16px 26px", "20px 34px"), marginBottom: g.px(16, 22), fontSize: g.px(42, 56), fontWeight: 600 }}>{pt}</El>
        ))}
      </Body>
    </>
  );
}

function QaScene({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const s = motionSpec("qa", c.facts, c.voiceSec);
  const qas = c.extra?.qas ?? [];
  return (
    <>
      <Header g={g} left={c.facts.planLine} right={c.facts.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="คำถามที่เจอบ่อย" />
      <Body g={g}>
        <Grid g={g} cols={g.wide ? 2 : 1} gap={g.px(20, 40)}>
          {qas.map((q, i) => (
            <div key={q.key} style={box({ flexDirection: "column" })}>
              <El an={s[`q${i}`]} t={t} style={{ alignItems: "flex-start", background: WHITE, color: NAVY, borderRadius: 26, padding: g.px("14px 22px", "20px 28px"), fontSize: g.px(34, 44), fontWeight: 700 }}>
                <div style={box({ background: GOLD, borderRadius: 16, padding: "2px 14px", fontSize: g.px(26, 32), marginRight: 16, flexShrink: 0 })}>ถาม</div>
                <div style={box({ flexShrink: 1 })}>{q.q}</div>
              </El>
              <El an={s[`a${i}`]} t={t} style={{ fontSize: g.px(30, 38), color: WHITE, marginTop: 14, lineHeight: 1.4 }}>{q.a}</El>
            </div>
          ))}
        </Grid>
      </Body>
    </>
  );
}

function VersusScene({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const s = motionSpec("versus", c.facts, c.voiceSec);
  const v = c.extra?.versus;
  if (!v) return null;
  const right = /^[\d,]+$/.test(v.right.amount) ? countAt(num(v.right.amount), look(s.count, t).p).toLocaleString("en-US") : v.right.amount;
  const cardW = Math.floor((g.w - g.side * 2 - g.px(110, 160)) / 2);
  const side = (an: Anim | undefined, label: string, amount: string, unit: string, main: boolean) => (
    <El an={an} t={t} style={{ width: cardW, flexDirection: "column", ...card(g, main), color: main ? NAVY : WHITE, padding: g.px("24px 26px", "34px 40px") }}>
      <div style={box({ fontSize: g.px(30, 42), fontWeight: main ? 600 : 400 })}>{label}</div>
      <div style={box({ alignItems: "flex-end", flexWrap: "wrap" })}>
        <div style={box({ fontSize: g.px(64, 104), fontWeight: 700, lineHeight: 1.15 })}>{amount}</div>
        <div style={box({ fontSize: g.px(28, 38), marginLeft: 12, marginBottom: g.px(10, 16) })}>{unit}</div>
      </div>
    </El>
  );
  return (
    <>
      <Header g={g} left={c.facts.planLine} right={c.facts.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={c.facts.product === "PENSION" ? "ลดหย่อนภาษีระหว่างทำงาน" : "เก็บเงินเอง กับ แผนนี้"} />
      <Body g={g} style={{ flexDirection: "column", justifyContent: "center" }}>
        <div style={box({ alignItems: "center" })}>
          {side(s.left, v.left.label, v.left.amount, v.left.unit, false)}
          <El an={s.vs} t={t} style={{ width: g.px(110, 160), justifyContent: "center" }}>
            <div style={box({ width: g.px(80, 110), height: g.px(80, 110), borderRadius: 60, background: GOLD, color: NAVY, fontSize: g.px(32, 42), fontWeight: 700, alignItems: "center", justifyContent: "center" })}>{c.facts.product === "PENSION" ? "→" : "vs"}</div>
          </El>
          {side(s.right, v.right.label, right, v.right.unit, true)}
        </div>
        <El an={s.note} t={t} style={{ marginTop: g.px(26, 40), justifyContent: "center" }}>
          <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 30px", fontSize: g.px(32, 42), fontWeight: 600 })}>{v.note}</div>
        </El>
      </Body>
    </>
  );
}

function StepsScene({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const s = motionSpec("steps", c.facts, c.voiceSec);
  const steps = c.extra?.steps ?? [];
  const dot = g.px(90, 130);
  return (
    <>
      <Header g={g} left={c.facts.planLine} right={c.facts.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="เริ่มง่ายๆ 3 ขั้น" />
      <Body g={g} style={{ flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "flex-start" : "stretch", justifyContent: "center" }}>
        {steps.map((st, i) => (
          <El key={i} an={s[`st${i}`]} t={t} style={{ flexDirection: g.wide ? "column" : "row", alignItems: "center", ...(g.wide ? { flex: 1 } : {}), marginBottom: g.wide ? 0 : 30, marginRight: g.wide && i < steps.length - 1 ? 40 : 0 }}>
            <div style={box({ width: dot, height: dot, borderRadius: dot / 2, background: i === steps.length - 1 ? GOLD : WHITE, color: NAVY, fontSize: g.px(46, 64), fontWeight: 700, alignItems: "center", justifyContent: "center", flexShrink: 0, ...(g.wide ? { marginBottom: 26 } : { marginRight: 30 }) })}>{String(i + 1)}</div>
            <div style={box({ fontSize: g.px(42, 48), fontWeight: 600, color: WHITE, ...(g.wide ? { textAlign: "center", justifyContent: "center" } : {}) })}>{st}</div>
          </El>
        ))}
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
  const vw = wordsOf(f);
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
              <El an={s.small} t={t} style={{ fontSize: g.px(32, 50), color: WHITE }}>{f.priceBig?.label ?? (daily ? "ตกวันละ" : vw.firstYearMonthly)}</El>
              <El an={s.big} t={t} style={{ fontSize: f.priceBig ? g.px(62, 116) : g.px(daily ? 120 : 84, daily ? 220 : 150), fontWeight: 700, color: GOLD, lineHeight: 1 }}>{f.priceBig?.amount ?? daily ?? main?.amount ?? ""}</El>
              <El an={s.unit} t={t} style={{ fontSize: g.px(32, 50), color: WHITE }}>{f.priceBig?.unit ?? (daily ? "บาทเท่านั้น" : vw.baht)}</El>
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

/** บำนาญ 95's steps up, the portrait scene's drawing (motion.tsx pensionSteps) at this frame's size */
function CoverSteps({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const s = motionSpec("cover", f, c.voiceSec);
  const top = g.px(190, 200);
  const w = g.wide ? 1300 : g.w - g.side * 2;
  return (
    <>
      <Header g={g} left={f.coverTitle} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="ยิ่งอายุมาก ยิ่งได้มากขึ้น" />
      <div style={abs({ left: g.wide ? Math.round((g.w - w) / 2) : g.side, top, width: w, height: g.bottom - top })}>
        {pensionSteps(f, s, t, w, g.bottom - top, g.px(0.72, 0.8))}
      </div>
    </>
  );
}

/** บำนาญ 95's years, the portrait scene's drawing (motion.tsx pensionTimeline), with the total beside it */
function PensionValue({ g, c, t }: { g: Geo; c: WideQuoteContext; t: number }) {
  const f = c.facts;
  const p = f.pension;
  const s = motionSpec("value", f, c.voiceSec, c.words.join(" "));
  if (!p) return null;
  const cw = g.px(560, 1060);
  return (
    <>
      <Header g={g} left="รับบำนาญทุกปี" right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text="เงินใช้ทุกปี ถึงอายุ 95" />
      <Body g={g} style={{ alignItems: "center" }}>
        <div style={box({ width: cw, height: g.bottom - g.top, flexShrink: 0 })}>{pensionTimeline(f, s, t, cw, g.bottom - g.top, g.px(0.7, 0.8))}</div>
        <El an={s.card} t={t} style={{ flex: 1, marginLeft: g.px(24, 60), flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 32, padding: g.px("20px 24px", "28px 36px"), borderLeft: `${g.px(12, 16)}px solid ${SKY}` }}>
          <div style={box({ fontSize: g.px(26, 36), fontWeight: 700 })}>รวมรับบำนาญถึงอายุ 95 ประมาณ</div>
          <div style={box({ fontSize: g.px(40, 60), fontWeight: 700 })}>{`${countAt(p.totalPension, look(s.count, t).p).toLocaleString("en-US")} บาท`}</div>
          <div style={box({ fontSize: g.px(22, 28), marginTop: 10, color: NAVY, opacity: 0.8 })}>{`รับประกันจ่าย 15 ปีแรก (อายุ ${p.start}–${p.guaranteeTo})`}</div>
        </El>
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
  const vw = wordsOf(f);
  return (
    <>
      <Header g={g} left={vw.compareHeader} right={f.insuredWho} />
      <Kicker g={g} an={s.kicker} t={t} text={vw.compareTitle} />
      <div style={abs({ left, top: g.px(190, 200), width: total })}>
        {plans.map((p, i) => (
          <El key={p.name} an={s[`col${i}`]} t={t} style={{
            width: colW, height: colH, marginRight: i < plans.length - 1 ? gap : 0, flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 32,
            background: p.main ? WHITE : "rgba(255,255,255,0.1)", border: `4px solid ${p.main ? GOLD : "rgba(255,255,255,0.22)"}`, color: p.main ? NAVY : WHITE,
          }}>
            <div style={box({ fontSize: g.px(36, 54), fontWeight: 700 })}>{p.name}</div>
            <div style={box({ fontSize: lab, marginTop: 16, opacity: 0.8 })}>{vw.compareRows[0]}</div>
            <div style={box(val(p.main, 40, 60))}>{p.ceiling}</div>
            <div style={box({ fontSize: lab, marginTop: 12, opacity: 0.8 })}>{vw.compareRows[1]}</div>
            <div style={box({ fontSize: g.px(30, 46), fontWeight: 600 })}>{p.room}</div>
            <div style={box({ fontSize: lab, marginTop: 12, opacity: 0.8 })}>{vw.compareRows[2]}</div>
            <div style={box({ fontSize: g.px(30, 46), fontWeight: 600 })}>{p.opd}</div>
            <div style={box({ fontSize: lab, marginTop: 12, opacity: 0.8 })}>{vw.perMonth}</div>
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
      <El an={s.note} t={t} style={{ position: "absolute", left: g.side, width: g.w - g.side * 2, top: g.px(190, 200) + colH + 20, justifyContent: g.wide ? "center" : "flex-start", fontSize: g.px(22, 28), color: WHITE, opacity: 0.85 }}>{vw.renewNote(f.coverToAge)}</El>
    </>
  );
}

/** One frame of a square or landscape quote clip at scene time t. */
export function wideQuoteFrame(key: SceneKey, c: WideQuoteContext, t: number, size: Exclude<VideoSize, "portrait">) {
  const g = geo(size);
  const body = {
    lead: <Lead g={g} c={c} t={t} />,
    price: <Price g={g} c={c} t={t} />,
    cover: c.facts.coverStyle === "bars" ? <CoverBars g={g} c={c} t={t} /> : c.facts.coverStyle === "steps" ? <CoverSteps g={g} c={c} t={t} />
      : c.facts.coverStyle === "bands" ? <CoverBands g={g} c={c} t={t} /> : c.facts.coverStyle === "flat" ? <CoverFlat g={g} c={c} t={t} /> : <CoverRows g={g} c={c} t={t} />,
    value: c.facts.pension ? <PensionValue g={g} c={c} t={t} /> : <Value g={g} c={c} t={t} />,
    compare: <Compare g={g} c={c} t={t} />,
    critical: <Critical g={g} c={c} t={t} />,
    terms: <Terms g={g} c={c} t={t} />,
    // a looping clip ends on its opening, held, and nothing else (owner, 2026-10-13, choices ก and ข)
    contact: c.loop ? <Lead g={g} c={c} t={Math.max(t, 4)} /> : (
      <ContactScene g={g} s={motionSpec("contact", c.facts, c.voiceSec)} t={t} title={wordsOf(c.facts).contactMore} header={c.facts.insuredWho}
        customer={c.customer} narrator={c.narrator} contact={c.contact} note={c.facts.footNote} vw={wordsOf(c.facts)} />
    ),
    story: <StoryScene g={g} c={c} t={t} />,
    qa: <QaScene g={g} c={c} t={t} />,
    versus: <VersusScene g={g} c={c} t={t} />,
    steps: <StepsScene g={g} c={c} t={t} />,
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
