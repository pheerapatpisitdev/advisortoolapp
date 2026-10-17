import type { ReactNode } from "react";
import { QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import type { Level } from "@/lib/fhc/health";
import type { FhcSceneKey, FhcVideoFacts } from "./fhc";
import { a, abs, box, El, look, stroke, Subtitle, type Anim } from "./motion";
import { H, W } from "./timeline";

/**
 * วิดีโอสรุป FHC's six scenes, in the Motion Graphic world of motion.tsx (the same navy, the
 * same drifting background, subtitles and footer), laid out as the owner approved them in the
 * mockup (2026-10-12): six lights, four have/should bars, five events, the plan, the card.
 */

const NAVY = C.motionNavy;
const GOLD = C.motionGold;
const SKY = C.motionSky;
const WHITE = C.paper;
const RED = C.motionRed;
const GREEN = C.motionGreen;
const SIDE = 64;
const LIGHT: Record<Level, string> = { green: GREEN, yellow: GOLD, red: RED, none: "rgba(255,255,255,0.28)" };
const n = (v: number) => Math.round(v).toLocaleString("en-US");
const UNIT = { sum: "บาท", room: "บาท/วัน", pension: "บาท/เดือน" } as const;

/** When each element of a scene moves, in scene seconds. */
export function fhcSpec(key: FhcSceneKey, f: FhcVideoFacts): Record<string, Anim> {
  const s: Record<string, Anim> = { kicker: a(0.2, "up") };
  switch (key) {
    case "fhcOpen":
      return { kicker: a(0.2, "up"), title: a(0.5, "up"), pulse: a(0.6, "stroke", 1.6), name: a(1.3, "pop"), date: a(1.8, "fade") };
    case "fhcScores":
      f.scores.forEach((_, i) => { s[`row${i}`] = a(0.6 + i * 0.35, "left"); });
      s.legend = a(0.6 + f.scores.length * 0.35, "fade");
      return s;
    case "fhcGaps":
      f.gaps.forEach((_, i) => {
        s[`row${i}`] = a(0.6 + i * 0.6, "up");
        s[`bar${i}`] = a(0.9 + i * 0.6, "grow");
      });
      return s;
    case "fhcEvents":
      f.events.forEach((_, i) => { s[`row${i}`] = a(0.7 + i * 0.45, "left"); });
      return s;
    case "fhcPlan":
      s.card = a(0.6, "pop");
      f.plan.slice(1).forEach((_, i) => { s[`row${i}`] = a(1.4 + i * 0.4, "left"); });
      s.total = a(1.4 + Math.max(0, f.plan.length - 1) * 0.4, "fade");
      s.sweep = a(1.2, "grow", 0.8);
      return s;
    case "fhcContact":
      return { title: a(0.2, "up"), card: a(0.8, "up"), note: a(1.4, "fade") };
  }
}

export const fhcWindows = (key: FhcSceneKey, f: FhcVideoFacts): [number, number][] =>
  Object.values(fhcSpec(key, f)).map((x) => [x.at, x.at + x.dur]);

export interface FhcMotionContext {
  facts: FhcVideoFacts;
  customer: string;
  narrator?: "F" | "M";
  contact: { name: string; phone: string; line?: string; more?: string; photo?: string };
  words: string[];
  voiceSec: number;
  /** คอลลาจกระดาษ's cut-out in the room a scene leaves free (make.ts fhcParts, collage/decor.tsx) */
  decor?: (key: FhcSceneKey, t: number) => ReactNode;
}

/** the lowest a scene's picture may reach: above the subtitle's three lines */
const ROOM_FLOOR = 1500;
/** a room lower than this takes no picture: it would be too small to read */
const ROOM_MIN = 240;
const ROOM_MAX = 440;
const ROOM_W = 620;

/**
 * The room a portrait scene leaves free under what it shows, for คอลลาจ's cut-out (owner, 2026-10-17,
 * mockup https://claude.ai/artifact/RcQRD93uywHi12PhSWVGbH): measured from each scene's layout
 * below, so a customer with more rows gets a smaller picture, or none.
 */
export function fhcRoom(key: FhcSceneKey, f: FhcVideoFacts, c: { customer: string; contact: { more?: string } }): { left: number; top: number; w: number; h: number } | null {
  const below = (top: number, floor = ROOM_FLOOR) => {
    const h = Math.min(ROOM_MAX, floor - top);
    return h >= ROOM_MIN ? { left: Math.round((W - ROOM_W) / 2), top: floor - h, w: ROOM_W, h } : null;
  };
  switch (key) {
    case "fhcOpen": return below(c.customer ? 1260 : 1050);
    // rows of 146 from 320 (measured 2026-10-17); the legend stands at 1300
    case "fhcScores": return below(320 + f.scores.length * 146 + 30, 1270);
    case "fhcGaps": return below(330 + f.gaps.length * 252 + 20);
    case "fhcEvents": return below(320 + f.events.length * 200 + 30);
    // the first plan's card to ~760, then a row of 112 each and the total
    case "fhcPlan": return f.plan.length > 1 ? below(820 + (f.plan.length - 1) * 112 + 140) : below(f.plan.length ? 800 : 960);
    case "fhcContact": {
      const more = c.contact.more ? c.contact.more.split("\n").length : 0;
      return below((more ? 990 + more * 64 + 24 : 1020) + 110);
    }
  }
}

function Header({ f, title }: { f: FhcVideoFacts; title: string }) {
  return (
    <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 70, justifyContent: "space-between", fontSize: 36, color: WHITE, opacity: 0.85 })}>
      <div style={box({})}>{title}</div>
      <div style={box({})}>{`${f.sex === "F" ? "หญิง" : "ชาย"} อายุ ${f.age}`}</div>
    </div>
  );
}

const Kicker = ({ an, t, text }: { an?: Anim; t: number; text: string }) => (
  <El an={an} t={t} style={{ position: "absolute", left: SIDE, top: 190, fontSize: 62, fontWeight: 600, color: WHITE }}>{text}</El>
);

function Open({ c, t }: { c: FhcMotionContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcOpen", f);
  return (
    <>
      <Header f={f} title="Financial Health Check" />
      <El an={s.kicker} t={t} style={{ position: "absolute", left: SIDE, top: 300, fontSize: 40, fontWeight: 600, color: GOLD, letterSpacing: 4 }}>FINANCIAL HEALTH CHECK</El>
      <El an={s.title} t={t} style={{ position: "absolute", left: SIDE, top: 380, flexDirection: "column", fontSize: 104, fontWeight: 700, color: WHITE, lineHeight: 1.25 }}>
        <div style={box({})}>สรุปผลตรวจ</div>
        <div style={box({})}>สุขภาพการเงิน</div>
      </El>
      <div style={abs({ left: 0, top: 690, width: W, height: 200 })}>
        <svg width={W} height={200} viewBox={`0 0 ${W} 200`}>
          {stroke({ d: "M40 100 L380 100 L440 30 L510 170 L580 60 L630 100 L1040 100", len: 1220, p: look(s.pulse, t).p, color: GOLD, width: 10 })}
        </svg>
      </div>
      {c.customer ? (
        <El an={s.name} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 940, flexDirection: "column" }}>
          <div style={box({ fontSize: 44, color: WHITE })}>จัดทำสำหรับ</div>
          <div style={box({ fontSize: 96, fontWeight: 700, color: GOLD })}>{`คุณ${c.customer}`}</div>
        </El>
      ) : null}
      <El an={s.date} t={t} style={{ position: "absolute", left: SIDE, top: c.customer ? 1170 : 960, fontSize: 40, color: WHITE, opacity: 0.8 }}>{`ตรวจเมื่อ ${f.checkedOn}`}</El>
    </>
  );
}

function Scores({ c, t }: { c: FhcMotionContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcScores", f);
  return (
    <>
      <Header f={f} title="ผลตรวจ 6 ด้าน" />
      <Kicker an={s.kicker} t={t} text="6 ด้านของคุณ" />
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 320, flexDirection: "column" })}>
        {f.scores.map((r, i) => (
          <El key={r.key} an={s[`row${i}`]} t={t} style={{ alignItems: "center", background: "rgba(255,255,255,0.08)", border: "3px solid rgba(255,255,255,0.16)", borderRadius: 30, padding: "22px 32px", marginBottom: 20 }}>
            <div style={box({ width: 56, height: 56, borderRadius: 28, background: LIGHT[r.level], flexShrink: 0 })} />
            <div style={box({ flex: 1, marginLeft: 28, fontSize: 46, color: WHITE })}>{r.label}</div>
            <div style={box({ marginLeft: 16, fontSize: 38, color: WHITE, opacity: 0.85, flexShrink: 0 })}>{r.value}</div>
          </El>
        ))}
      </div>
      <El an={s.legend} t={t} style={{ position: "absolute", left: SIDE, top: 1300, fontSize: 34, color: WHITE, alignItems: "center" }}>
        {(["green", "yellow", "red"] as const).map((lv) => (
          <div key={lv} style={box({ alignItems: "center", marginRight: 44 })}>
            <div style={box({ width: 30, height: 30, borderRadius: 15, background: LIGHT[lv], marginRight: 12 })} />
            <div style={box({})}>{lv === "green" ? "ดี" : lv === "yellow" ? "ควรปรับ" : "ต้องแก้"}</div>
          </div>
        ))}
      </El>
    </>
  );
}

function Gaps({ c, t }: { c: FhcMotionContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcGaps", f);
  const trackW = W - SIDE * 2;
  return (
    <>
      <Header f={f} title="มีอยู่ เทียบ ควรมี" />
      <Kicker an={s.kicker} t={t} text="ขาดอยู่เท่าไร" />
      <div style={abs({ left: SIDE, width: trackW, top: 330, flexDirection: "column" })}>
        {f.gaps.map((g, i) => {
          const ok = g.state === "ok";
          const share = ok ? 1 : g.should > 0 ? Math.min(1, g.have / g.should) : 0;
          const grow = look(s[`bar${i}`], t).p;
          const fillW = Math.round(trackW * share * grow);
          return (
            <El key={g.key} an={s[`row${i}`]} t={t} style={{ flexDirection: "column", marginBottom: 46 }}>
              <div style={box({ justifyContent: "space-between", alignItems: "flex-end", fontSize: 48, color: WHITE })}>
                <div style={box({ fontWeight: 600 })}>{g.label}</div>
                <div style={box({ fontSize: 42, color: ok ? GREEN : g.have ? WHITE : RED, fontWeight: 600 })}>
                  {ok ? "✓ พอแล้ว" : g.have ? `${n(g.have)} ${UNIT[g.unit]}` : "ยังไม่มี"}
                </div>
              </div>
              <div style={box({ position: "relative", marginTop: 16, width: trackW, height: 40, borderRadius: 20, background: "rgba(255,255,255,0.14)" })}>
                {fillW > 0 ? <div style={abs({ left: 0, top: 0, width: Math.max(40, fillW), height: 40, borderRadius: 20, background: ok ? GREEN : SKY })} /> : null}
              </div>
              <div style={box({ marginTop: 12, fontSize: 36, color: WHITE, opacity: 0.8 })}>
                {`${g.key === "retire" ? "อยากมี" : "ควรมี"} ${n(g.should)} ${UNIT[g.unit]}`}
              </div>
            </El>
          );
        })}
      </div>
    </>
  );
}

function Events({ c, t }: { c: FhcMotionContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcEvents", f);
  return (
    <>
      <Header f={f} title="รับมือได้แค่ไหน" />
      <Kicker an={s.kicker} t={t} text="5 เรื่องที่ควบคุมไม่ได้" />
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 320, flexDirection: "column" })}>
        {f.events.map((e, i) => (
          <El key={e.key} an={s[`row${i}`]} t={t} style={{ alignItems: "center", background: "rgba(255,255,255,0.08)", border: "3px solid rgba(255,255,255,0.16)", borderRadius: 30, padding: "22px 30px", marginBottom: 20 }}>
            <div style={box({ width: 72, height: 72, borderRadius: 36, border: `4px solid ${GOLD}`, color: GOLD, fontSize: 38, fontWeight: 700, alignItems: "center", justifyContent: "center", flexShrink: 0 })}>{String(i + 1)}</div>
            <div style={box({ flex: 1, flexDirection: "column", marginLeft: 28, flexShrink: 1 })}>
              <div style={box({ fontSize: 46, fontWeight: 600, color: WHITE })}>{e.name}</div>
              {e.line ? <div style={box({ fontSize: 33, color: WHITE, opacity: 0.8 })}>{e.line}</div> : null}
            </div>
            <div style={box({ width: 50, height: 50, borderRadius: 25, background: LIGHT[e.level], marginLeft: 18, flexShrink: 0 })} />
          </El>
        ))}
      </div>
    </>
  );
}

function Plan({ c, t }: { c: FhcMotionContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcPlan", f);
  const [first, ...rest] = f.plan;
  const total = f.plan.reduce((x, r) => x + r.monthly, 0);
  if (!first) {
    const done = f.gaps.every((g) => g.state === "ok");
    return (
      <>
        <Header f={f} title="แผนของคุณ" />
        <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 420, flexDirection: "column", alignItems: "center" }}>
          <div style={box({ width: 260, height: 260, borderRadius: 130, background: done ? GREEN : SKY, color: WHITE, fontSize: 160, fontWeight: 700, alignItems: "center", justifyContent: "center" })}>{done ? "✓" : "?"}</div>
          <div style={box({ marginTop: 50, fontSize: 80, fontWeight: 700, color: WHITE })}>{done ? "ครบทุกด้านแล้ว" : "มาคุยกันก่อน"}</div>
          <div style={box({ marginTop: 16, fontSize: 46, color: GOLD })}>{done ? "ดูแลต่อแบบนี้ได้เลย" : "ว่าจะเริ่มตรงไหน"}</div>
        </El>
      </>
    );
  }
  const sweep = look(s.sweep, t).p;
  return (
    <>
      <Header f={f} title="แผนที่แนะนำ" />
      <Kicker an={s.kicker} t={t} text="เริ่มที่ตรงนี้ก่อน" />
      <El an={s.card} t={t} style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 330, flexDirection: "column", background: WHITE, color: NAVY, borderRadius: 40, padding: "36px 44px" }}>
        <div style={box({ fontSize: 36, opacity: 0.75 })}>{`1 · ${first.label}`}</div>
        <div style={box({ fontSize: 54, fontWeight: 700, marginTop: 6 })}>{first.product}</div>
        <div style={box({ fontSize: 42, marginTop: 6 })}>{first.detail}</div>
        <div style={box({ position: "relative", marginTop: 18, alignSelf: "flex-start" })}>
          <div style={abs({ left: -8, bottom: 6, width: Math.round(720 * sweep), height: 40, background: GOLD, opacity: 0.85, borderRadius: 8 })} />
          <div style={box({ fontSize: 64, fontWeight: 700 })}>{`${first.per} ${n(first.monthly)} บาท`}</div>
        </div>
      </El>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 820, flexDirection: "column" })}>
        {rest.map((r, i) => (
          <El key={r.key} an={s[`row${i}`]} t={t} style={{ justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid rgba(255,255,255,0.18)", padding: "20px 4px", fontSize: 42, color: WHITE }}>
            <div style={box({ flexShrink: 1 })}>{`${i + 2} · ${r.label} ${r.product}`}</div>
            <div style={box({ marginLeft: 20, flexShrink: 0 })}>{`เดือนละ ${n(r.monthly)}`}</div>
          </El>
        ))}
        {rest.length > 0 ? (
          <El an={s.total} t={t} style={{ justifyContent: "space-between", alignItems: "center", padding: "22px 4px", fontSize: 48, fontWeight: 700, color: WHITE }}>
            <div style={box({})}>ทั้งแผน</div>
            <div style={box({ color: GOLD })}>{`เดือนละ ${n(total)} บาท`}</div>
          </El>
        ) : null}
      </div>
    </>
  );
}

function Contact({ c, t }: { c: FhcMotionContext; t: number }) {
  const f = c.facts;
  const s = fhcSpec("fhcContact", f);
  const k = c.contact;
  const initial = [...k.name.trim()][0] ?? "?";
  const more = k.more ? k.more.split("\n") : [];
  return (
    <>
      <Header f={f} title={c.customer ? `สำหรับ คุณ${c.customer}` : "คุยรายละเอียดได้เลย"} />
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
      {/* the foot note runs on under รายละเอียดเพิ่มเติม, however many lines it wraps to */}
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: more.length ? 990 : 1020, flexDirection: "column" })}>
        {more.length > 0 && (
          <El an={s.card} t={t} style={{ flexDirection: "column", fontSize: 44, color: WHITE, lineHeight: 1.45, marginBottom: 24 }}>
            {more.map((m, i) => <div key={i} style={box({})}>{m}</div>)}
          </El>
        )}
        <El an={s.note} t={t} style={{ fontSize: 30, color: WHITE, opacity: 0.75 }}>ตัวเลขเป็นของวันที่ตรวจ เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท</El>
      </div>
    </>
  );
}

/** One frame of an FHC scene at scene time t: transparent, over motion.tsx's drifting background. */
export function fhcFrame(key: FhcSceneKey, c: FhcMotionContext, t: number) {
  const body = {
    fhcOpen: <Open c={c} t={t} />,
    fhcScores: <Scores c={c} t={t} />,
    fhcGaps: <Gaps c={c} t={t} />,
    fhcEvents: <Events c={c} t={t} />,
    fhcPlan: <Plan c={c} t={t} />,
    fhcContact: <Contact c={c} t={t} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "transparent", fontFamily: "Plex", color: WHITE }}>
      {body}
      {c.decor?.(key, t)}
      <Subtitle words={c.words} t={t} voiceSec={c.voiceSec} />
      <div style={abs({ left: 0, width: W, bottom: 34, justifyContent: "center", fontSize: 26, color: WHITE, opacity: 0.6 })}>Application by www.advisortool.app</div>
    </div>
  );
}
