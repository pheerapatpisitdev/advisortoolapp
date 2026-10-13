import type { CSSProperties, ReactNode } from "react";
import { Chart, chartBlockHeight } from "@/app/api/card/chart-drawing";
import { insuredFace } from "@/app/api/card/insured-face";
import { BLUE_PEN, CARD_PALETTE as P, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { highlighterUri } from "@/lib/highlighter";
import type { CardChart } from "@/lib/quote-card";
import type { QuoteVideoFacts, SceneKey } from "./script";
import { COLS, ROW_H, TABLE } from "./table-geo";
import { noteInWindow, type TableNote } from "./table-pen";
import { PENSION_VIDEO_COLUMNS } from "./pension-table";
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
export { ROW_H, TABLE };
const SIDE = 70;

export interface Contact { name: string; phone: string; line?: string; photo?: string }
export interface DrawContext {
  facts: QuoteVideoFacts;
  /** who reads the clip: the closing card ends as the voice does */
  narrator?: "F" | "M";
  customer: string;
  contact: Contact;
  chart?: CardChart;
  /** the words of this scene's line, for the subtitle */
  words: string[];
  /** the value scene: its pen notes, each with where the table stands while it is written (table-pen.tsx) */
  notes?: (TableNote & { at: number })[];
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
      <div style={box({ flexDirection: "column", flexShrink: 1, minWidth: 0, marginRight: 20 })}>
        <div style={box({ fontSize: 40, fontWeight: 600, color: P.accent })}>{f.planLine}</div>
        <div style={box({ fontSize: f.insuredLine.length > 30 ? 30 : 36, color: P.mute })}>{f.insuredLine}</div>
      </div>
      <div style={box({ alignItems: "center", flexShrink: 0 })}>
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

function Lead({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  return (
    <>
      {c.customer && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 240, fontSize: 44, color: P.ink }}>
          จัดทำสำหรับ <span style={{ fontWeight: 600, color: P.figure, marginLeft: 12 }}>คุณ{c.customer}</span>
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 40, fontSize: 46, color: P.mute }}>{f.lead.label}</On>
      <div style={abs({ left: SIDE, top: PHOTO.y + PHOTO.h + 100, alignItems: "flex-end" })}>
        <On layer={layer} own="over" style={{ fontSize: f.lead.amount.length > 9 ? 140 : 170, fontWeight: 600, color: P.figure, lineHeight: 1 }}>{money(countAt(f.lead.baht, s.count))}</On>
        <On layer={layer} own="base" style={{ fontSize: 56, color: P.mute, marginLeft: 24, marginBottom: 14 }}>บาท</On>
      </div>
      {f.lead.note && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 300, fontSize: 40, color: P.mute }}>{f.lead.note}</On>
      )}
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 370 }}>
        <Swept p={s.sweep[0] ?? 1} size={52}>{f.leadMark}</Swept>
      </On>
    </>
  );
}

function Price({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.priceTitle}</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 340 }}>
        <Swept p={s.sweep[0] ?? 1} size={(f.priceMark ?? f.leadMark).length > 18 ? 62 : 78}>{f.priceMark ?? f.leadMark}</Swept>
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
      {f.pills.length > 0 && (
        <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 1080, flexWrap: "wrap" }}>
          {f.pills.map((pill, i) => (
            <div key={pill} style={box({ marginRight: i < f.pills.length - 1 ? 40 : 0 })}><Swept p={s.sweep[1] ?? 1} size={46}>{pill}</Swept></div>
          ))}
        </On>
      )}
      {f.penNote && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 1220, fontSize: 52, color: P.pen, transform: "rotate(-3deg)" }}>
          {f.penNote}
        </On>
      )}
      {f.priceNotes.length > 0 && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: f.pills.length ? 1330 : 1080, flexDirection: "column", fontSize: 34, color: P.mute }}>
          {f.priceNotes.map((n) => <div key={n} style={box({ marginBottom: 10 })}>{n}</div>)}
        </On>
      )}
    </>
  );
}

/** iShield's lump sums and iHealthy's cover, one row each, lit as the voice reads them */
function RowsCover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const tight = f.cover.length > 4;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.coverTitle}</On>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 360, flexDirection: "column" })}>
        {f.cover.map((r, i) => (
          <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", marginBottom: tight ? 26 : 40 })}>
            <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={tight ? 40 : 42}>{r.label}</Swept></On>
            <On layer={layer} own="base" style={{ fontSize: tight ? 44 : 52, fontWeight: 600, color: P.ink, marginLeft: 24, flexShrink: 0 }}>{/^[\d,]+$/.test(r.amount) ? `${r.amount} บาท` : r.amount}</On>
          </div>
        ))}
      </div>
      {f.coverNote && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1200, fontSize: 36, color: P.mute }}>{f.coverNote}</On>
      )}
      {f.product !== "IHEALTHY" && f.coverPen && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, justifyContent: "flex-end", top: 1060, fontSize: 52, color: P.pen, transform: "rotate(-2deg)" }}>{f.coverPen}</On>
      )}
    </>
  );
}

/**
 * บำนาญ 95: the pension's steps up as bars — 15%, 20%, 25%, 30% of the sum — each grown as the
 * voice reaches it, its ages and yearly pension under it.
 */
function StepsCover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const bands = f.pension?.bands ?? [];
  const chartW = W - SIDE * 2;
  const gap = 28;
  const barW = Math.floor((chartW - gap * Math.max(0, bands.length - 1)) / Math.max(1, bands.length));
  const top = 520;
  const tall = 520;
  const most = Math.max(1, ...bands.map((b) => b.percent));
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.coverTitle}</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 330, fontSize: 70, fontWeight: 600, color: P.figure }}>ยิ่งอายุมาก ยิ่งได้มากขึ้น</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 0, width: chartW, height: H }}>
        {bands.map((b, i) => {
          const p = s.sweep[i] ?? 1;
          const h = Math.round((b.percent / most) * tall * p);
          const x = i * (barW + gap);
          return p > 0 ? (
            <div key={b.from} style={abs({ left: x, top: 0, width: barW, height: H })}>
              <div style={abs({ left: 0, top: top + tall - h, width: barW, height: Math.max(4, h), background: i === bands.length - 1 ? P.highlighter : P.figure, borderRadius: "14px 14px 0 0", justifyContent: "center", paddingTop: 16, fontSize: 48, fontWeight: 600, color: i === bands.length - 1 ? P.ink : C.paper })}>
                {p >= 1 ? `${b.percent}%` : ""}
              </div>
              <div style={abs({ left: 0, top: top + tall + 22, width: barW, flexDirection: "column", alignItems: "center" })}>
                <div style={box({ fontSize: 34, color: P.mute })}>{`อายุ ${b.from}–${b.to}`}</div>
                <div style={box({ fontSize: 42, fontWeight: 600, color: P.ink })}>{b.annual}</div>
                <div style={box({ fontSize: 30, color: P.mute })}>บาท/ปี</div>
              </div>
            </div>
          ) : null;
        })}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + tall, width: chartW, height: 4, background: P.rule }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, justifyContent: "flex-end", top: top + tall + 210, fontSize: 52, color: P.pen, transform: "rotate(-2deg)" }}>
        {f.coverPen}
      </On>
    </>
  );
}

function Cover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  if (c.facts.coverStyle === "rows") return <RowsCover c={c} layer={layer} s={s} />;
  if (c.facts.coverStyle === "steps") return <StepsCover c={c} layer={layer} s={s} />;
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
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.coverTitle}</On>
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
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, justifyContent: "flex-end", top: 1240, fontSize: 54, color: P.pen, transform: "rotate(-2deg)" }}>
        {f.coverPen}
      </On>
    </>
  );
}

/** the value table's ring: the red pen drawn round the break-even figure as p goes 0 → 1 */
function Ring({ p, x, y, rx = 130, ry = 44 }: { p: number; x: number; y: number; rx?: number; ry?: number }) {
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

/** บำนาญ 95: what the table is about, above it — the guarantee, and the pension it pays in all (no premiums beside it: owner, 2026-10-13) */
function PensionValueTop({ c, layer }: { c: DrawContext; layer: Layer }) {
  const p = c.facts.pension;
  if (!p) return null;
  return (
    <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 250, flexDirection: "column" }}>
      <div style={box({ fontSize: 46, fontWeight: 600, color: BLUE_PEN })}>{`รับประกันจ่าย 15 ปีแรก (อายุ ${p.start}–${p.guaranteeTo})`}</div>
      <div style={box({ fontSize: 40, color: P.mute, marginTop: 36 })}>รวมรับบำนาญถึงอายุ 95 ประมาณ</div>
      <div style={box({ alignItems: "flex-end" })}>
        <div style={box({ fontSize: 112, fontWeight: 600, color: P.figure, lineHeight: 1.15 })}>{money(p.totalPension)}</div>
        <div style={box({ fontSize: 48, color: P.mute, marginLeft: 20, marginBottom: 16 })}>บาท</div>
      </div>
    </On>
  );
}

function Value({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const chart = c.chart;
  // บำนาญ 95's own columns (pension-table.tsx); the other plans' value table otherwise
  const heads = c.facts.pension
    ? PENSION_VIDEO_COLUMNS.map((x, i) => ({ h: x.head, w: x.width, left: i === 0 }))
    : ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"].map((h, i) => ({ h, w: COLS[i], left: i < 2 }));
  return (
    <>
      <PensionValueTop c={c} layer={layer} />
      {chart && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE - 10, top: 190 }}>
          <Chart chart={chart} p={P} />
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y - 60, width: TABLE.w, height: 60, background: P.figure, color: C.paper, fontSize: 28, alignItems: "center" }}>
        {heads.map(({ h, w, left }) => (
          <div key={h} style={box({ width: w, justifyContent: left ? "flex-start" : "flex-end", paddingLeft: left ? 14 : 0, paddingRight: left ? 0 : 14 })}>{h}</div>
        ))}
      </On>
      {/* the window's frame, under the subtitle */}
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y + TABLE.h, width: TABLE.w, height: 3, background: P.hair }} />
      {/* the note being written: on the overlay until it is finished, then a layer of the table's own (job.ts) */}
      {layer === "over" && (c.notes ?? []).map((n, i) => {
        const p = s.pen?.[i] ?? 0;
        return p > 0 && p <= 1 ? <div key={n.beat} style={abs({ left: 0, top: 0, width: W, height: H })}>{noteInWindow(n, p)}</div> : null;
      })}
    </>
  );
}

/** iHealthy: the plans the agent picked, side by side, the main one ringed in red pen */
function Compare({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const plans = c.facts.compare ?? [];
  const labelW = 250;
  const colW = Math.floor((W - SIDE * 2 - labelW) / Math.max(1, plans.length));
  const top = 380;
  const rowH = 110;
  const rows: [string, (p: (typeof plans)[number]) => string][] = [
    ["วงเงิน/ปี", (p) => p.ceiling],
    ["ค่าห้อง/วัน", (p) => p.room],
    ["ผู้ป่วยนอก/ปี", (p) => p.opd],
    ["รายเดือน", (p) => `${p.monthly} บาท`],
  ];
  const mainAt = plans.findIndex((p) => p.main);
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>เทียบแผน iHealthy Ultra</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top, flexDirection: "column", width: W - SIDE * 2 }}>
        <div style={box({ height: rowH })}>
          <div style={box({ width: labelW })} />
          {plans.map((p) => (
            <div key={p.name} style={box({ width: colW, height: rowH - 16, alignItems: "center", justifyContent: "center", background: P.figure, color: C.paper, fontSize: 44, fontWeight: 600, borderRadius: 18, marginRight: 8 })}>{p.name}</div>
          ))}
        </div>
        {rows.map(([label, value], r) => (
          <div key={label} style={box({ height: rowH, alignItems: "center", background: r % 2 ? "transparent" : P.stripe })}>
            <div style={box({ width: labelW, fontSize: 36, color: P.mute, paddingLeft: 12 })}>{label}</div>
            {plans.map((p) => (
              <div key={p.name} style={box({ width: colW, justifyContent: "center", fontSize: p.main ? 42 : 38, fontWeight: p.main ? 600 : 400, color: p.main ? P.figure : P.ink, marginRight: 8, ...(p.main ? { background: P.tint, height: rowH } : {}), alignItems: "center" })}>{value(p)}</div>
            ))}
          </div>
        ))}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + rowH * 5 + 40, fontSize: 34, color: P.mute }}>ต่ออายุได้ถึงอายุ 98 · เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น</On>
      {mainAt >= 0 && s.ring > 0 && (
        <On layer={layer} own="over" style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
          <Ring p={s.ring} x={SIDE + labelW + mainAt * (colW + 8) + colW / 2} y={top + (rowH * 5) / 2} rx={Math.round(colW / 2) + 24} ry={Math.round((rowH * 5) / 2) + 10} />
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
        <div style={box({})}>{c.narrator === "M" ? "ยินดีช่วยดูแผนให้ครับ" : "ยินดีช่วยดูแผนให้ค่ะ"}</div>
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

const DONE: OverlayState = { word: -1, count: 1, sweep: [1, 1], bars: [1, 1], ring: 0 };

/** One layer of one scene, as a full 1080×1920 picture. */
export function sceneLayer(key: SceneKey, c: DrawContext, layer: Layer, state: OverlayState = DONE) {
  const body = {
    lead: <Lead c={c} layer={layer} s={state} />,
    compare: <Compare c={c} layer={layer} s={state} />,
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
  const all = f.rows ?? [];
  const height = Math.max(ROW_H, all.length * ROW_H);
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: TABLE.w, height, background: C.paper, fontFamily: "Plex", fontSize: 28, color: P.ink }}>
      {all.map((r, i) => {
        // a premium no longer due is left blank, as on the card: the pen writes there
        const cells = [String(r.year), String(r.age), r.due === "—" ? "" : r.due, r.paid ?? "", r.cash ?? "", r.cover];
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
