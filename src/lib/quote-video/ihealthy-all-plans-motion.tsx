import { IHEALTHY_PLAN_HUES, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import type { AllPlansFacts } from "./ihealthy-all-plans";
import { a, abs, box, El, look, type Anim, type MotionContext } from "./motion";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { countAt, W } from "./timeline";
import { preparedLine, wordsOf } from "./video-words";

/**
 * วิดีโอเทียบ 4 แผน's scenes (owner chose ข, 2026-11-11, mockup
 * https://claude.ai/artifact/LBAU1dE46qCwQk8weQYiJY), in the Motion Graphic world of motion.tsx:
 * the plans for whom, the price bars, the limits and the room, what every plan pays as charged,
 * what the higher plans add. The contact card is motion.tsx's own. Drawn from the facts only
 * (ihealthy-all-plans.ts works them out on the server), so the Remotion image needs nothing else.
 */

const NAVY = C.motionNavy;
const GOLD = C.motionGold;
const WHITE = C.paper;
const GREEN = C.motionGreen;
const SIDE = 64;
const INNER = W - SIDE * 2;
const FAINT = "rgba(255,255,255,0.1)";
const LINE = "rgba(255,255,255,0.22)";
const hue = (code: string) => IHEALTHY_PLAN_HUES[code as keyof typeof IHEALTHY_PLAN_HUES] ?? C.motionSky;
const comma = (n: number) => n.toLocaleString("en-US");

/** n pieces brought in one after another from `from` over most of the voice */
function spread(prefix: string, n: number, voiceSec: number, from: number, kind: "left" | "pop" | "up" = "left"): Record<string, Anim> {
  const s: Record<string, Anim> = {};
  const span = Math.max(1, voiceSec * 0.7 - from);
  for (let i = 0; i < n; i++) s[`${prefix}${i}`] = a(from + (i * span) / Math.max(1, n), kind);
  return s;
}

/** When each piece of a scene moves; undefined for the scenes motion.tsx draws as it always does. */
export function allPlansSpec(key: SceneKey, f: QuoteVideoFacts, voiceSec: number): Record<string, Anim> | undefined {
  const p = f.allPlans;
  if (!p) return undefined;
  const n = p.plans.length;
  switch (key) {
    case "lead": {
      const s: Record<string, Anim> = { name: a(0.2, "fade"), title: a(0.2, "pop"), sub: a(0.7, "up"), who: a(Math.max(2.2, 1.0 + n * 0.35 + 0.4), "pop") };
      p.plans.forEach((_, i) => { s[`card${i}`] = a(1.0 + i * 0.35, "pop"); });
      return s;
    }
    case "price": {
      // each plan's row as the voice reaches its name, more or less; its bar grows and its figure counts up with it
      const rows = spread("row", n, voiceSec, 0.6);
      const s: Record<string, Anim> = { kicker: a(0.2, "up"), ...rows, note: a(Math.max(2.4, voiceSec * 0.75), "fade") };
      for (let i = 0; i < n; i++) {
        s[`bar${i}`] = a(rows[`row${i}`].at + 0.2, "grow");
        s[`count${i}`] = a(rows[`row${i}`].at, "count", 1.0);
      }
      return s;
    }
    case "cover":
      return { kicker: a(0.2, "up"), big: a(0.5, "pop"), ...spread("row", n, voiceSec, 1.2) };
    case "value":
      return { kicker: a(0.2, "up"), big: a(0.5, "pop"), ...spread("row", p.same.length, voiceSec, 1.0), note: a(Math.max(2.6, voiceSec * 0.8), "pop") };
    case "compare": {
      const rows = p.extras.reduce((k, g) => k + g.rows.length + (g.opd ? 1 : 0), 0);
      const s: Record<string, Anim> = { kicker: a(0.2, "up"), ...spread("row", rows, voiceSec, 0.8) };
      p.extras.forEach((_, i) => { s[`head${i}`] = a(0.2 + i * 0.4, "up"); });
      return s;
    }
    default:
      return undefined;
  }
}

function Head({ f, title }: { f: QuoteVideoFacts; title: string }) {
  return (
    <div style={abs({ left: SIDE, width: INNER, top: 70, justifyContent: "space-between", fontSize: 36, color: WHITE, opacity: 0.85 })}>
      <div style={box({})}>{title}</div>
      <div style={box({})}>{f.insuredWho}</div>
    </div>
  );
}

function Kicker({ an, t, text, top = 190 }: { an?: Anim; t: number; text: string; top?: number }) {
  return <El an={an} t={t} style={{ position: "absolute", left: SIDE, width: INNER, top, fontSize: 56, fontWeight: 700, color: WHITE }}>{text}</El>;
}

function Lead({ c, t, p }: { c: MotionContext; t: number; p: AllPlansFacts }) {
  const f = c.facts;
  const s = allPlansSpec("lead", f, c.voiceSec)!;
  const vw = wordsOf(f);
  const two = p.plans.length <= 2;
  const cardW = Math.floor((INNER - 32) / 2);
  return (
    <>
      <Head f={f} title={f.planLine} />
      {c.customer && <El an={s.name} t={t} style={{ position: "absolute", left: SIDE, top: 170, fontSize: 42, color: WHITE }}>{preparedLine(vw, c.customer).map((x, i) => <span key={i} style={{ ...(x.name ? { color: GOLD, fontWeight: 600 } : {}), marginLeft: i ? 12 : 0 }}>{x.text}</span>)}</El>}
      <El an={s.title} t={t} style={{ position: "absolute", left: 0, width: W, top: 300, justifyContent: "center", fontSize: f.lang && f.lang !== "th" ? 96 : 124, fontWeight: 700, color: WHITE }}>{p.words.lead}</El>
      <El an={s.sub} t={t} style={{ position: "absolute", left: 0, width: W, top: 470, justifyContent: "center", fontSize: 60, fontWeight: 600, color: GOLD }}>{p.words.leadSub}</El>
      <div style={abs({ left: SIDE, width: INNER, top: two ? 680 : 620, flexWrap: "wrap", justifyContent: "space-between" })}>
        {p.plans.map((x, i) => (
          <El key={x.code} an={s[`card${i}`]} t={t} style={{
            width: cardW, height: 230, marginBottom: 32, borderRadius: 36, flexDirection: "column", justifyContent: "center", alignItems: "center",
            background: hue(x.code), border: `4px solid ${LINE}`, color: WHITE,
          }}>
            <div style={box({ fontSize: 64, fontWeight: 700 })}>{x.name}</div>
            <div style={box({ fontSize: 40, marginTop: 6, opacity: 0.9 })}>{x.ceiling}</div>
          </El>
        ))}
      </div>
      <El an={s.who} t={t} style={{ position: "absolute", left: 0, width: W, top: two ? 1020 : 1160, justifyContent: "center" }}>
        <div style={box({ background: GOLD, color: NAVY, borderRadius: 44, padding: "8px 44px", fontSize: 52, fontWeight: 700 })}>{p.words.who}</div>
      </El>
    </>
  );
}

function Price({ c, t, p }: { c: MotionContext; t: number; p: AllPlansFacts }) {
  const f = c.facts;
  const s = allPlansSpec("price", f, c.voiceSec)!;
  const top = Math.max(...p.plans.map((x) => x.premium));
  const step = p.plans.length <= 2 ? 230 : 210;
  return (
    <>
      <Head f={f} title={f.planLine} />
      <Kicker an={s.kicker} t={t} text={p.words.priceTitle} />
      <div style={abs({ left: SIDE, width: INNER, top: 330, flexDirection: "column" })}>
        {p.plans.map((x, i) => {
          const grow = look(s[`bar${i}`], t).p;
          return (
            <El key={x.code} an={s[`row${i}`]} t={t} style={{ flexDirection: "column", height: step }}>
              <div style={box({ justifyContent: "space-between", alignItems: "flex-end" })}>
                <div style={box({ alignItems: "center", fontSize: 48, fontWeight: 600, color: WHITE })}>
                  <div style={box({ width: 30, height: 30, borderRadius: 8, background: hue(x.code), border: `3px solid ${WHITE}`, marginRight: 20 })} />
                  {x.name}
                </div>
                <div style={box({ fontSize: 68, fontWeight: 700, color: GOLD })}>{comma(countAt(x.premium, look(s[`count${i}`], t).p))}</div>
              </div>
              <div style={box({ marginTop: 14, height: 34, width: INNER, borderRadius: 17, background: FAINT })}>
                <div style={box({ height: 34, borderRadius: 17, background: GOLD, width: Math.max(34, Math.round((INNER * x.premium * grow) / top)) })} />
              </div>
            </El>
          );
        })}
      </div>
      <El an={s.note} t={t} style={{ position: "absolute", left: SIDE, width: INNER, top: 340 + p.plans.length * step + 20, fontSize: 36, color: WHITE, opacity: 0.85, lineHeight: 1.4 }}>{f.priceNotes[0] ?? ""}</El>
    </>
  );
}

/** "3 ล้าน" … "25 ล้าน" → "3–25 ล้าน"; two different units are kept whole */
function range(first: string, last: string): string {
  const [n1, ...u1] = first.split(" ");
  const [n2, ...u2] = last.split(" ");
  return first === last ? first : u1.join(" ") === u2.join(" ") && u1.length ? `${n1}–${n2} ${u1.join(" ")}` : `${first} – ${last}`;
}

function Cover({ c, t, p }: { c: MotionContext; t: number; p: AllPlansFacts }) {
  const f = c.facts;
  const s = allPlansSpec("cover", f, c.voiceSec)!;
  const vw = wordsOf(f);
  return (
    <>
      <Head f={f} title={f.planLine} />
      <Kicker an={s.kicker} t={t} text={p.words.coverTitle} />
      <El an={s.big} t={t} style={{ position: "absolute", left: 0, width: W, top: 300, justifyContent: "center", fontSize: 130, fontWeight: 700, color: GOLD }}>{range(p.plans[0].ceiling, p.plans[p.plans.length - 1].ceiling)}</El>
      <div style={abs({ left: SIDE, width: INNER, top: 540, flexDirection: "column" })}>
        {p.plans.map((x, i) => (
          <El key={x.code} an={s[`row${i}`]} t={t} style={{ alignItems: "center", borderRadius: 34, padding: "24px 32px", marginBottom: 24, background: FAINT, border: `3px solid ${LINE}` }}>
            <div style={box({ width: 30, height: 30, borderRadius: 8, background: hue(x.code), border: `3px solid ${WHITE}`, marginRight: 22, flexShrink: 0 })} />
            <div style={box({ flex: 1, fontSize: 46, fontWeight: 600, color: WHITE })}>{x.name}</div>
            <div style={box({ flexDirection: "column", alignItems: "flex-end" })}>
              <div style={box({ fontSize: 52, fontWeight: 700, color: GOLD })}>{x.ceiling}</div>
              <div style={box({ fontSize: 32, color: WHITE, opacity: 0.85 })}>{`${p.words.roomLabel} ${x.room} ${vw.baht}`}</div>
            </div>
          </El>
        ))}
      </div>
    </>
  );
}

/** a ✓ row's pitch: set, not left to the text, so what comes under the list can be placed */
const ROW = 104;
const TIGHT_ROW = 92;

/** a ✓ row: what is paid, and how much */
function Tick({ an, t, label, amount, tight }: { an?: Anim; t: number; label: string; amount: string; tight: boolean }) {
  return (
    <El an={an} t={t} style={{ alignItems: "center", height: tight ? TIGHT_ROW - 12 : ROW - 16, borderRadius: 30, padding: "0 24px", marginBottom: tight ? 12 : 16, background: FAINT, border: `3px solid ${LINE}` }}>
      <div style={box({ width: tight ? 46 : 54, height: tight ? 46 : 54, borderRadius: 28, background: GREEN, color: WHITE, fontSize: tight ? 28 : 34, fontWeight: 700, alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 20 })}>✓</div>
      <div style={box({ flex: 1, flexShrink: 1, fontSize: tight ? 32 : 36, color: WHITE })}>{label}</div>
      {amount ? <div style={box({ marginLeft: 16, fontSize: tight ? 32 : 38, fontWeight: 700, color: GOLD, flexShrink: 0 })}>{amount}</div> : null}
    </El>
  );
}

function Same({ c, t, p }: { c: MotionContext; t: number; p: AllPlansFacts }) {
  const f = c.facts;
  const s = allPlansSpec("value", f, c.voiceSec)!;
  const tight = p.same.length > 8;
  const listTop = 430;
  const rowH = tight ? TIGHT_ROW : ROW;
  return (
    <>
      <Head f={f} title={f.planLine} />
      <Kicker an={s.kicker} t={t} text={p.words.sameTitle} />
      <El an={s.big} t={t} style={{ position: "absolute", left: SIDE, width: INNER, top: 290, fontSize: 84, fontWeight: 700, color: GOLD }}>{p.words.sameBig}</El>
      <div style={abs({ left: SIDE, width: INNER, top: listTop, flexDirection: "column" })}>
        {p.same.map((r, i) => <Tick key={r.key} an={s[`row${i}`]} t={t} label={r.label} amount="" tight={tight} />)}
      </div>
      <El an={s.note} t={t} style={{ position: "absolute", left: 0, width: W, top: listTop + p.same.length * rowH + 24, justifyContent: "center" }}>
        <div style={box({ background: GREEN, color: WHITE, borderRadius: 40, padding: "8px 34px", fontSize: 42, fontWeight: 600 })}>{`✓ ${p.words.sameNote}`}</div>
      </El>
    </>
  );
}

function Extras({ c, t, p }: { c: MotionContext; t: number; p: AllPlansFacts }) {
  const f = c.facts;
  const s = allPlansSpec("compare", f, c.voiceSec)!;
  let row = 0;
  let y = 190;
  const blocks = p.extras.map((g, gi) => {
    const top = y;
    const items = g.rows.map((r) => <Tick key={r.key} an={s[`row${row++}`]} t={t} label={r.label} amount={p.words.asCharged} tight={false} />);
    const opd = g.opd ? (
      <El key="opd" an={s[`row${row++}`]} t={t} style={{ flexDirection: "column", borderRadius: 34, padding: "22px 30px", marginTop: 8, background: WHITE, color: NAVY }}>
        <div style={box({ fontSize: 36, fontWeight: 600 })}>{p.words.opdLabel}</div>
        <div style={box({ fontSize: 28, opacity: 0.75, marginBottom: 10 })}>{g.opd.label}</div>
        <div style={box({ justifyContent: "space-around" })}>
          {g.opd.amounts.map((x) => (
            <div key={x.name} style={box({ flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: 36, fontWeight: 600 })}>{x.name}</div>
              <div style={box({ fontSize: 64, fontWeight: 700 })}>{x.amount}</div>
            </div>
          ))}
        </div>
      </El>
    ) : null;
    y += 130 + g.rows.length * ROW + (g.opd ? 300 : 0);
    return (
      <div key={g.title} style={abs({ left: SIDE, width: INNER, top, flexDirection: "column" })}>
        <El an={s[`head${gi}`]} t={t} style={{ fontSize: 56, fontWeight: 700, color: WHITE, marginBottom: 30 }}>{g.title}</El>
        {items}
        {opd}
      </div>
    );
  });
  return (
    <>
      <Head f={f} title={f.planLine} />
      {blocks}
    </>
  );
}

/** the scene's drawing, or undefined where motion.tsx draws its own (the contact card) */
export function allPlansFrame(key: SceneKey, c: MotionContext, t: number) {
  const p = c.facts.allPlans;
  if (!p) return undefined;
  switch (key) {
    case "lead": return <Lead c={c} t={t} p={p} />;
    case "price": return <Price c={c} t={t} p={p} />;
    case "cover": return <Cover c={c} t={t} p={p} />;
    case "value": return <Same c={c} t={t} p={p} />;
    case "compare": return <Extras c={c} t={t} p={p} />;
    default: return undefined;
  }
}
