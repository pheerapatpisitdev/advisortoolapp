import type { CSSProperties, ReactNode } from "react";
import { Chart, chartBlockHeight } from "@/app/api/card/chart-drawing";
import { insuredFace } from "@/app/api/card/insured-face";
import { CARD_PALETTE as P, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { highlighterUri } from "@/lib/highlighter";
import type { CardChart } from "@/lib/quote-card";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { countAt, H, W, type OverlayState } from "./timeline";

/**
 * The pictures of the วิดีโอนำเสนอ clip (owner, 2026-10-11), 1080×1920, in the card's palette.
 *
 * Every scene is drawn twice from one layout: a `base` (opaque, everything that stands still)
 * and any number of `over` frames (transparent, the animated items and the subtitle at one
 * moment). An item belongs to one layer and is drawn at opacity 0 in the other, so the two line
 * up to the pixel. Two things move in ffmpeg rather than here: the family photo (a slow zoom,
 * inside PHOTO) and the value table (a pan, inside TABLE) — the base leaves those boxes empty.
 */

export const PHOTO = { x: 190, y: 330, w: 700, h: 540 } as const;
/** the window the value table pans through */
export const TABLE = { x: 60, y: 820, w: 960, h: 760 } as const;
export const ROW_H = 52;
/** the value table's columns: ปีที่ อายุ เบี้ย/ปี เบี้ยสะสม เวนคืนได้ คุ้มครอง */
const COLS = [90, 100, 170, 200, 200, 200] as const;
const CASH_X = COLS[0] + COLS[1] + COLS[2] + COLS[3];
const SIDE = 70;

export interface Contact { name: string; phone: string; line?: string; photo?: string }
export interface DrawContext {
  facts: QuoteVideoFacts;
  customer: string;
  contact: Contact;
  chart?: CardChart;
  /** the words of this scene's line, for the subtitle */
  words: string[];
  /** the value scene: where the pan ends, in the table's own pixels */
  panEnd?: number;
}

type Layer = "base" | "over";
const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
const abs = (s: CSSProperties): CSSProperties => ({ display: "flex", position: "absolute", ...s });

/** what is drawn on this layer shows; the other layer keeps its place, unseen */
function On({ layer, own, style, children }: { layer: Layer; own: Layer; style?: CSSProperties; children?: ReactNode }) {
  return <div style={{ display: "flex", ...style, ...(layer === own ? {} : { opacity: 0 }) }}>{children}</div>;
}

/** the highlighter stroke behind a phrase, drawn left to right as p goes 0 → 1 */
function Swept({ p, children, size }: { p: number; children: ReactNode; size: number }) {
  return (
    <div style={box({ position: "relative", padding: "2px 18px", marginLeft: -18 })}>
      <div style={abs({ left: 0, top: 0, bottom: 0, width: `${Math.round(p * 100)}%`, overflow: "hidden" })}>
        <div style={box({ width: 2000, height: "100%", backgroundImage: highlighterUri(P.highlighter), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" })} />
      </div>
      <div style={box({ fontSize: size, color: P.ink, position: "relative" })}>{children}</div>
    </div>
  );
}

function Header({ f, layer }: { f: QuoteVideoFacts; layer: Layer }) {
  return (
    <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 80, justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={box({ flexDirection: "column" })}>
        <div style={box({ fontSize: 40, fontWeight: 600, color: P.accent })}>{f.planLine}</div>
        <div style={box({ fontSize: 36, color: P.mute })}>{f.insuredLine}</div>
      </div>
      <div style={box({ alignItems: "center" })}>
        {insuredFace(f.sex, 76)}
        <div style={box({ fontSize: 52, fontWeight: 600, color: P.figure, marginLeft: 14 })}>{f.insuredWho}</div>
      </div>
    </On>
  );
}

function Subtitle({ words, word }: { words: string[]; word: number }) {
  return (
    <div style={abs({ left: 40, right: 40, bottom: 120, justifyContent: "center" })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", background: "rgba(13,18,32,0.84)", borderRadius: 26, padding: "18px 30px", fontSize: 42, lineHeight: 1.45 })}>
        {words.map((w, i) => (
          <div key={i} style={box({ marginRight: i < words.length - 1 ? 12 : 0, color: i < word ? C.paper : i === word ? C.spoken : "rgba(255,255,255,0.55)" })}>{w}</div>
        ))}
      </div>
    </div>
  );
}

function Footer({ layer }: { layer: Layer }) {
  return (
    <On layer={layer} own="base" style={{ position: "absolute", left: 0, right: 0, bottom: 44, justifyContent: "center", fontSize: 28, color: P.mute }}>
      Design by www.unitclub.app
    </On>
  );
}

const money = (n: number) => n.toLocaleString("en-US");
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

function Legacy({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  return (
    <>
      {c.customer && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 240, fontSize: 44, color: P.ink }}>
          จัดทำสำหรับ <span style={{ fontWeight: 600, color: P.figure, marginLeft: 12 }}>คุณ{c.customer}</span>
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 40, fontSize: 46, color: P.mute }}>มรดก</On>
      <div style={abs({ left: SIDE, top: PHOTO.y + PHOTO.h + 100, alignItems: "flex-end" })}>
        <On layer={layer} own="over" style={{ fontSize: 170, fontWeight: 600, color: P.figure, lineHeight: 1 }}>{money(countAt(f.legacyBaht, s.count))}</On>
        <On layer={layer} own="base" style={{ fontSize: 56, color: P.mute, marginLeft: 24, marginBottom: 14 }}>บาท</On>
      </div>
      {f.legacyNote && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 300, fontSize: 40, color: P.mute }}>{f.legacyNote}</On>
      )}
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 370 }}>
        <Swept p={s.sweep[0] ?? 1} size={52}>{f.perDay}</Swept>
      </On>
    </>
  );
}

function Price({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>เบี้ยประกันที่ต้องชำระ</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 340 }}>
        <Swept p={s.sweep[0] ?? 1} size={78}>{f.perDay}</Swept>
      </On>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 520, flexDirection: "column", background: layer === "base" ? P.box : "transparent", borderRadius: 36, padding: "40px 50px" })}>
        {f.prices.map((r) => (
          <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 10 })}>
            <On layer={layer} own="base" style={{ fontSize: r.main ? 50 : 44, fontWeight: r.main ? 600 : 400, color: r.main ? P.figure : P.ink }}>{r.label}</On>
            {r.main ? (
              <On layer={layer} own="over" style={{ fontSize: 88, fontWeight: 600, color: P.figure }}>{`${money(countAt(num(r.amount), s.count))} บาท`}</On>
            ) : (
              <On layer={layer} own="base" style={{ fontSize: 48, color: P.ink }}>{`${r.amount} บาท`}</On>
            )}
          </div>
        ))}
      </div>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 1080, flexWrap: "wrap" }}>
        <Swept p={s.sweep[1] ?? 1} size={46}>{`จ่ายเบี้ยแค่ ${f.payYears} ปี`}</Swept>
        <div style={box({ width: 40 })} />
        <Swept p={s.sweep[1] ?? 1} size={46}>เบี้ยคงที่ตลอด</Swept>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 1220, fontSize: 52, color: P.pen, transform: "rotate(-3deg)" }}>
        {`จ่ายครบอายุ ${f.lastPayAge} แล้วหยุดส่ง`}
      </On>
    </>
  );
}

function Cover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const [first, second] = f.cover;
  const beforeAge = Number(first.label.match(/(\d+)/)?.[1] ?? f.coverToAge);
  const span = Math.max(1, f.coverToAge - f.age);
  const chartW = W - SIDE * 2;
  const tall = 420;
  const top = 700;
  const firstW = second ? Math.round(((beforeAge - f.age) / span) * chartW) : chartW;
  const a1 = num(first.amount);
  const a2 = second ? num(second.amount) : 0;
  const hOf = (a: number) => Math.round((a / Math.max(a1, a2)) * tall);
  const bar = (x: number, w: number, h: number, p: number, color: string, label: string) => (
    <div style={abs({ left: x, top: top + tall - Math.round(h * p), width: w, height: Math.max(4, Math.round(h * p)), background: color, borderRadius: "12px 12px 0 0", justifyContent: "center", paddingTop: 14, color: C.paper, fontSize: 40, fontWeight: 600 })}>
      {p >= 1 ? label : ""}
    </div>
  );
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>ครอบครัวได้รับเมื่อเสียชีวิต</On>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 350, justifyContent: "space-between", alignItems: "center" })}>
        <On layer={layer} own="over"><Swept p={s.sweep[0] ?? 1} size={46}>{first.label}</Swept></On>
        <On layer={layer} own="base" style={{ fontSize: 60, fontWeight: 600, color: P.ink }}>{`${first.amount} บาท`}</On>
      </div>
      {second && (
        <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 460, justifyContent: "space-between", alignItems: "center" })}>
          <On layer={layer} own="base" style={{ fontSize: 46, color: P.mute }}>{second.label}</On>
          <On layer={layer} own="base" style={{ fontSize: 60, fontWeight: 600, color: P.ink }}>{`${second.amount} บาท`}</On>
        </div>
      )}
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 0, width: chartW, height: H }}>
        {bar(0, firstW, hOf(a1), s.bars[0], P.figure, `${(a1 / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`)}
        {second ? bar(firstW, chartW - firstW, hOf(a2), s.bars[1], C.barAfter, `${(a2 / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`) : null}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + tall + 4, width: chartW, height: 4, background: P.rule }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE - 30, top: top + tall + 16, width: chartW + 60, height: 60 }}>
        <div style={abs({ left: 0, width: 60, justifyContent: "center", fontSize: 34, color: P.mute })}>{String(f.age)}</div>
        {second && <div style={abs({ left: firstW, width: 60, justifyContent: "center", fontSize: 34, color: P.mute })}>{String(beforeAge)}</div>}
        <div style={abs({ left: chartW, width: 60, justifyContent: "center", fontSize: 34, color: P.mute })}>{String(f.coverToAge)}</div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", right: SIDE, top: 1240, fontSize: 54, color: P.pen, transform: "rotate(-2deg)" }}>
        {`คุ้มครองถึงอายุ ${f.coverToAge} ปี`}
      </On>
    </>
  );
}

/** the value table's ring: the red pen drawn round the break-even figure as p goes 0 → 1 */
function Ring({ p, x, y }: { p: number; x: number; y: number }) {
  const rx = 130;
  const ry = 44;
  const len = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) + 40;
  return (
    <svg width={rx * 2 + 30} height={ry * 2 + 30} viewBox={`0 0 ${rx * 2 + 30} ${ry * 2 + 30}`} style={{ position: "absolute", left: x - rx - 15, top: y - ry - 15 }}>
      <path
        d={`M ${15 + rx * 2} ${15 + ry} A ${rx} ${ry} 0 1 1 ${15 + rx * 2 - 1} ${15 + ry - 12}`}
        fill="none" stroke={P.pen} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${len} ${len}`} strokeDashoffset={Math.round(len * (1 - p))}
      />
    </svg>
  );
}

function Value({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const chart = c.chart;
  const be = f.breakEven;
  const ringY = be && c.panEnd !== undefined ? TABLE.y + be.index * ROW_H - c.panEnd + ROW_H / 2 : undefined;
  const ringX = TABLE.x + CASH_X + COLS[4] / 2;
  return (
    <>
      {chart && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE - 10, top: 190 }}>
          <Chart chart={chart} p={P} />
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y - 60, width: TABLE.w, height: 60, background: P.figure, color: C.paper, fontSize: 28, alignItems: "center" }}>
        {["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"].map((h, i) => (
          <div key={h} style={box({ width: COLS[i], justifyContent: i < 2 ? "flex-start" : "flex-end", paddingLeft: i < 2 ? 14 : 0, paddingRight: i < 2 ? 0 : 14 })}>{h}</div>
        ))}
      </On>
      {/* the window's frame, under the subtitle */}
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y + TABLE.h, width: TABLE.w, height: 3, background: P.hair }} />
      {be && ringY !== undefined && (
        <On layer={layer} own="over" style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
          {s.callout && (
            <div style={abs({ left: TABLE.x + 20, top: Math.max(TABLE.y + 10, ringY - 150), background: C.paper, border: `4px solid ${P.pen}`, borderRadius: 24, padding: "10px 22px", flexDirection: "column", color: P.pen, fontWeight: 600, fontSize: 34 })}>
              <div style={box({})}>{`จุดคุ้มทุน อายุ ${be.age}`}</div>
              <div style={box({ fontSize: 30 })}>{`เวนคืน ${be.cash} > จ่ายไป ${f.totalPaid}`}</div>
            </div>
          )}
          {s.ring > 0 && <Ring p={s.ring} x={ringX} y={ringY} />}
        </On>
      )}
    </>
  );
}

function ContactScene({ c, layer }: { c: DrawContext; layer: Layer }) {
  const k = c.contact;
  const initial = [...k.name.trim()][0] ?? "?";
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 220, fontSize: 44, fontWeight: 600, color: P.accent }}>
        {c.customer ? `สำหรับ คุณ${c.customer}` : "สนใจรายละเอียดเพิ่มเติม"}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 320, flexDirection: "column", fontSize: 88, fontWeight: 600, color: P.figure, lineHeight: 1.3 }}>
        <div style={box({})}>ทักมาคุยกันได้เลย</div>
        <div style={box({})}>ยินดีช่วยดูแผนให้ค่ะ</div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 660, border: `3px solid ${P.hair}`, borderRadius: 44, padding: 44, alignItems: "center" }}>
        {k.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={k.photo} width={220} height={220} style={{ borderRadius: 110, objectFit: "cover" }} alt="" />
        ) : (
          <div style={box({ width: 220, height: 220, borderRadius: 110, background: C.noPhoto, alignItems: "center", justifyContent: "center", fontSize: 110, fontWeight: 600, color: P.figure })}>{initial}</div>
        )}
        <div style={box({ flexDirection: "column", marginLeft: 44, flexShrink: 1 })}>
          <div style={box({ fontSize: 58, fontWeight: 600, color: P.ink })}>{k.name}</div>
          <div style={box({ fontSize: 46, color: P.mute, marginTop: 10 })}>{`โทร ${k.phone}`}</div>
          {k.line && <div style={box({ fontSize: 46, color: P.mute })}>{`LINE ${k.line}`}</div>}
        </div>
      </On>
      {c.facts.footNote && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1080, fontSize: 32, color: P.mute }}>{c.facts.footNote}</On>
      )}
    </>
  );
}

const DONE: OverlayState = { word: -1, count: 1, sweep: [1, 1], bars: [1, 1], ring: 0, callout: false };

/** One layer of one scene, as a full 1080×1920 picture. */
export function sceneLayer(key: SceneKey, c: DrawContext, layer: Layer, state: OverlayState = DONE) {
  const body = {
    legacy: <Legacy c={c} layer={layer} s={state} />,
    price: <Price c={c} layer={layer} s={state} />,
    cover: <Cover c={c} layer={layer} s={state} />,
    value: <Value c={c} layer={layer} s={state} />,
    contact: <ContactScene c={c} layer={layer} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: layer === "base" ? C.paper : "transparent", fontFamily: "Plex", color: P.ink }}>
      {key !== "contact" && <Header f={c.facts} layer={layer} />}
      {body}
      {layer === "over" && <Subtitle words={c.words} word={state.word} />}
      <Footer layer={layer} />
    </div>
  );
}

/** the chart over the value table, as wide as the scene allows */
export const CHART_W = W - (SIDE - 10) * 2;
export { chartBlockHeight };

/** The whole value table as one tall picture, without its header (drawn on the base). */
export function tableImage(f: QuoteVideoFacts) {
  const height = f.rows.length * ROW_H;
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: TABLE.w, height, background: C.paper, fontFamily: "Plex", fontSize: 28, color: P.ink }}>
      {f.rows.map((r, i) => {
        const cells = [String(r.year), String(r.age), r.due, r.paid ?? "", r.cash ?? "", r.cover];
        return (
          <div key={r.year} style={box({ height: ROW_H, alignItems: "center", background: i % 2 ? "rgba(2,33,98,0.045)" : C.paper })}>
            {cells.map((v, k) => (
              <div
                key={k}
                style={box({
                  width: COLS[k], height: ROW_H, alignItems: "center",
                  justifyContent: k < 2 ? "flex-start" : "flex-end", paddingLeft: k < 2 ? 14 : 0, paddingRight: k < 2 ? 0 : 14,
                  ...(k === 1 && r.breakEven ? { background: P.highlighter, fontWeight: 600 } : {}),
                  ...(k === 4 && (r.pastBreakEven || r.breakEven) ? { color: P.gain, fontWeight: r.breakEven ? 600 : 400 } : {}),
                  ...(k === 4 && r.empty ? { color: P.mute } : {}),
                })}
              >
                {v}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
  return { el, width: TABLE.w, height };
}

/** where the pan stops: the break-even row a little above the window's middle, or the table's end */
export function panEndFor(f: QuoteVideoFacts): number {
  const tableH = f.rows.length * ROW_H;
  const max = Math.max(0, tableH - TABLE.h);
  if (!f.breakEven) return max;
  return Math.min(max, Math.max(0, f.breakEven.index * ROW_H - Math.round(TABLE.h * 0.55)));
}
