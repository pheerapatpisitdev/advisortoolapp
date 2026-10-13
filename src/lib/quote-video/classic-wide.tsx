import type { CSSProperties, ReactNode } from "react";
import { Chart } from "@/app/api/card/chart-drawing";
import { insuredFace } from "@/app/api/card/insured-face";
import { BLUE_PEN, CARD_PALETTE as P, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { abs, box, contactLine, On, Swept, type DrawContext, type Layer } from "./draw";
import { PENSION_VIDEO_COLUMNS } from "./pension-table";
import type { SceneKey } from "./script";
import { CLASSIC_BOXES, COLS, type Rect } from "./table-geo";
import { noteInWindow } from "./table-pen";
import { countAt, SIZES, type OverlayState, type VideoSize } from "./timeline";

/**
 * The classic style in a square (1080×1080) or landscape (1920×1080) frame (owner, 2026-10-13:
 * "ทุกวิดีโอ สามารถเลือกขนาดได้", mockup https://claude.ai/artifact/G36jyJWaHD7yj248ReEk3E §8). The
 * same scenes, figures, voice and timing as draw.tsx, and the same two layers — a `base` of what
 * stands still and `over` frames of what moves — laid out side by side: the photo or the chart on
 * the left, the words and the table on the right. The photo box and the table window are
 * table-geo.ts CLASSIC_BOXES, which ffmpeg moves the photo and the table inside (job.ts).
 */

type Wide = Exclude<VideoSize, "portrait">;

interface Geo {
  size: Wide;
  w: number;
  h: number;
  wide: boolean;
  side: number;
  top: number;
  bottom: number;
  photo: Rect;
  table: Rect;
  px: <T>(square: T, landscape: T) => T;
}

function geo(size: Wide): Geo {
  const { w, h } = SIZES[size];
  const wide = size === "landscape";
  return {
    size, w, h, wide,
    side: wide ? 90 : 56,
    top: wide ? 170 : 140,
    bottom: wide ? 850 : 860,
    ...CLASSIC_BOXES[size],
    px: <T,>(square: T, landscape: T): T => (wide ? landscape : square),
  };
}

const money = (n: number) => n.toLocaleString("en-US");
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));
const plainNumber = (s: string) => /^[\d,]+$/.test(s);

function Header({ g, c, layer }: { g: Geo; c: DrawContext; layer: Layer }) {
  const f = c.facts;
  return (
    <On layer={layer} own="base" style={{ position: "absolute", left: g.side, width: g.w - g.side * 2, top: 36, justifyContent: "space-between", alignItems: "center" }}>
      <div style={box({ flexDirection: "column", flexShrink: 1, minWidth: 0, marginRight: 20 })}>
        <div style={box({ fontSize: g.px(30, 36), fontWeight: 600, color: P.accent })}>{f.planLine}</div>
        <div style={box({ fontSize: g.px(24, 28), color: P.mute })}>{f.insuredLine}</div>
      </div>
      <div style={box({ alignItems: "center", flexShrink: 0 })}>
        {insuredFace(f.sex, g.px(54, 64))}
        <div style={box({ fontSize: g.px(36, 44), fontWeight: 600, color: P.figure, marginLeft: 12 })}>{f.insuredWho}</div>
      </div>
    </On>
  );
}

function Subtitle({ g, words, word }: { g: Geo; words: string[]; word: number }) {
  const width = Math.min(g.w - 64, 1560);
  return (
    <div style={abs({ left: Math.round((g.w - width) / 2), width, bottom: g.px(56, 54), justifyContent: "center" })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", background: "rgba(13,18,32,0.84)", borderRadius: 22, padding: "12px 24px", fontSize: g.px(32, 38), lineHeight: 1.4 })}>
        {words.map((w, i) => (
          <div key={i} style={box({ marginRight: i < words.length - 1 ? 10 : 0, color: i < word ? C.paper : i === word ? C.spoken : "rgba(255,255,255,0.55)" })}>{w}</div>
        ))}
      </div>
    </div>
  );
}

function Footer({ g, c, layer }: { g: Geo; c: DrawContext; layer: Layer }) {
  return (
    <On layer={layer} own="base" style={{ position: "absolute", left: 0, width: g.w, bottom: 16, justifyContent: "center", fontSize: c.loop ? 24 : 20, color: c.loop ? P.accent : P.mute, fontWeight: c.loop ? 600 : 400 }}>
      {c.loop ? contactLine(c.contact) : "Design by www.unitclub.app"}
    </On>
  );
}

const kickerStyle = (g: Geo): CSSProperties => ({ fontSize: g.px(34, 42), fontWeight: 600, color: P.accent });

/** the right of the photo, or of the chart: a column from the body's top */
function Right({ g, from, children, style }: { g: Geo; from: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={abs({ left: from, width: g.w - from - g.side, top: g.top, height: g.bottom - g.top, flexDirection: "column", ...style })}>{children}</div>;
}

// ——— the scenes ———

function Lead({ g, c, layer, s, strip }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState; strip?: boolean }) {
  const f = c.facts;
  const from = g.photo.x + g.photo.w + g.px(36, 60);
  return (
    // the loop's last scene adds the agent's card: it takes the body's whole height, without the name line and the note
    <Right g={g} from={from} style={strip ? { justifyContent: "center" } : { top: g.photo.y, justifyContent: "center", height: g.photo.h }}>
      {c.customer && !strip && (
        <On layer={layer} own="base" style={{ fontSize: g.px(28, 36), color: P.ink, marginBottom: 10 }}>
          จัดทำสำหรับ <span style={{ fontWeight: 600, color: P.figure, marginLeft: 10 }}>คุณ{c.customer}</span>
        </On>
      )}
      {c.headline?.length ? (
        <On layer={layer} own="base" style={{ flexDirection: "column", background: P.figure, borderRadius: 22, padding: g.px("12px 20px", "16px 26px"), marginBottom: g.px(16, 26) }}>
          {c.headline.map((h, i) => <div key={i} style={box({ fontSize: g.px(34, 48), fontWeight: 600, color: i === 0 ? C.paper : P.highlighter, lineHeight: 1.25 })}>{h}</div>)}
        </On>
      ) : null}
      <On layer={layer} own="base" style={{ fontSize: g.px(f.lead.label.length > 20 ? 26 : 32, f.lead.label.length > 20 ? 34 : 42), color: P.mute }}>{f.lead.label}</On>
      {/* the square's column is ~460 wide: a seven-figure sum and its บาท must fit */}
      <div style={box({ alignItems: "flex-end" })}>
        <On layer={layer} own="over" style={{ fontSize: g.px(f.lead.amount.length > 9 ? 60 : f.lead.amount.length > 7 ? 70 : 92, f.lead.amount.length > 9 ? 120 : 140), fontWeight: 600, color: P.figure, lineHeight: 1.1 }}>{money(countAt(f.lead.baht, s.count))}</On>
        <On layer={layer} own="base" style={{ fontSize: g.px(30, 44), color: P.mute, marginLeft: 12, marginBottom: 8 }}>บาท</On>
      </div>
      {f.lead.note && !strip && <On layer={layer} own="base" style={{ fontSize: g.px(24, 32), color: P.mute, marginTop: 6 }}>{f.lead.note}</On>}
      <On layer={layer} own="over" style={{ marginTop: g.px(14, 22) }}><Swept p={s.sweep[0] ?? 1} size={g.px(36, 46)}>{f.leadMark}</Swept></On>
      {strip && <AgentStrip g={g} c={c} layer={layer} />}
    </Right>
  );
}

function AgentStrip({ g, c, layer }: { g: Geo; c: DrawContext; layer: Layer }) {
  const k = c.contact;
  const initial = [...k.name.trim()][0] ?? "?";
  const face = g.px(76, 100);
  return (
    <On layer={layer} own="base" style={{ marginTop: g.px(18, 28), border: `3px solid ${P.hair}`, borderRadius: 24, padding: g.px("12px 18px", "16px 24px"), alignItems: "center" }}>
      {k.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={k.photo} width={face} height={face} style={{ borderRadius: face / 2, objectFit: "cover" }} alt="" />
      ) : (
        <div style={box({ width: face, height: face, borderRadius: face / 2, background: C.noPhoto, alignItems: "center", justifyContent: "center", fontSize: g.px(38, 50), fontWeight: 600, color: P.figure })}>{initial}</div>
      )}
      <div style={box({ flexDirection: "column", marginLeft: 20, flexShrink: 1 })}>
        <div style={box({ fontSize: g.px(28, 38), fontWeight: 600, color: P.ink })}>{`ทักแชท ${k.name}`}</div>
        <div style={box({ fontSize: g.px(22, 30), color: P.mute })}>{[`โทร ${k.phone}`, k.line ? `LINE ${k.line}` : ""].filter(Boolean).join(" · ")}</div>
      </div>
    </On>
  );
}

function Price({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const mark = f.priceMark ?? f.leadMark;
  // a column of its own: the drawing library lays a fragment out as a row
  const words = (
    <div style={box({ flexDirection: "column", alignItems: "flex-start" })}>
      <On layer={layer} own="base" style={kickerStyle(g)}>{f.priceTitle}</On>
      <On layer={layer} own="over" style={{ marginTop: g.px(10, 20) }}><Swept p={s.sweep[0] ?? 1} size={g.px(mark.length > 18 ? 40 : 52, mark.length > 18 ? 52 : 68)}>{mark}</Swept></On>
      {f.pills.length > 0 && (
        <On layer={layer} own="over" style={{ flexWrap: "wrap", marginTop: g.px(12, 26) }}>
          {f.pills.map((pill) => <div key={pill} style={box({ marginRight: 30, marginBottom: 8 })}><Swept p={s.sweep[1] ?? 1} size={g.px(30, 40)}>{pill}</Swept></div>)}
        </On>
      )}
      {f.penNote && <On layer={layer} own="base" style={{ fontSize: g.px(34, 46), color: P.pen, transform: "rotate(-3deg)", marginTop: g.px(8, 20) }}>{f.penNote}</On>}
      {f.priceNotes.length > 0 && (
        <On layer={layer} own="base" style={{ flexDirection: "column", fontSize: g.px(20, 26), color: P.mute, marginTop: 12 }}>
          {f.priceNotes.map((n) => <div key={n} style={box({ marginBottom: 6 })}>{n}</div>)}
        </On>
      )}
    </div>
  );
  const rows = (
    <div style={box({ flexDirection: "column", background: layer === "base" ? P.box : "transparent", borderRadius: 30, padding: g.px("18px 30px", "30px 40px") })}>
      {f.prices.map((r) => (
        <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", marginTop: g.px(4, 8), marginBottom: g.px(4, 8) })}>
          <On layer={layer} own="base" style={{ fontSize: g.px(r.main ? 34 : 30, r.main ? 42 : 36), fontWeight: r.main ? 600 : 400, color: r.main ? P.figure : P.ink }}>{r.label}</On>
          {r.main
            ? <On layer={layer} own="over" style={{ fontSize: g.px(54, 72), fontWeight: 600, color: P.figure }}>{`${money(countAt(num(r.amount), s.count))} บาท`}</On>
            : <On layer={layer} own="base" style={{ fontSize: g.px(32, 40), color: P.ink }}>{`${r.amount} บาท`}</On>}
        </div>
      ))}
    </div>
  );
  return g.wide ? (
    <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.top, height: g.bottom - g.top, alignItems: "center" })}>
      <div style={box({ flexDirection: "column", width: 820, marginRight: 60 })}>{words}</div>
      <div style={box({ flexDirection: "column", flex: 1 })}>{rows}</div>
    </div>
  ) : (
    <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.top, flexDirection: "column" })}>
      {words}
      <div style={box({ flexDirection: "column", marginTop: 18 })}>{rows}</div>
    </div>
  );
}

function RowsCover({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const n = f.cover.length;
  const two = g.wide && n > 3;
  const half = two ? Math.ceil(n / 2) : n;
  const colW = two ? Math.floor((g.w - g.side * 2 - 60) / 2) : g.w - g.side * 2;
  const row = (r: (typeof f.cover)[number], i: number) => (
    <div key={r.label} style={box({ width: colW, justifyContent: "space-between", alignItems: "center", marginBottom: g.px(n > 4 ? 14 : 24, 30) })}>
      <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={g.px(n > 4 ? 30 : 34, 38)}>{r.label}</Swept></On>
      <On layer={layer} own="base" style={{ fontSize: g.px(n > 4 ? 32 : 38, 44), fontWeight: 600, color: P.ink, marginLeft: 20, flexShrink: 0 }}>{/^[\d,]+$/.test(r.amount) ? `${r.amount} บาท` : r.amount}</On>
    </div>
  );
  return (
    <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.top, flexDirection: "column" })}>
      <On layer={layer} own="base" style={{ ...kickerStyle(g), marginBottom: g.px(18, 30) }}>{f.coverTitle}</On>
      <div style={box({ justifyContent: "space-between" })}>
        <div style={box({ flexDirection: "column" })}>{f.cover.slice(0, half).map(row)}</div>
        {two && <div style={box({ flexDirection: "column" })}>{f.cover.slice(half).map((r, i) => row(r, i + half))}</div>}
      </div>
      {f.coverNote && <On layer={layer} own="base" style={{ fontSize: g.px(22, 28), color: P.mute, marginTop: 10 }}>{f.coverNote}</On>}
      {f.product !== "IHEALTHY" && f.coverPen && (
        <On layer={layer} own="base" style={{ justifyContent: "flex-end", fontSize: g.px(36, 46), color: P.pen, transform: "rotate(-2deg)", marginTop: 10 }}>{f.coverPen}</On>
      )}
    </div>
  );
}

/** a bar chart in a box, each bar grown as p goes 0 → 1; its labels under it */
function Bars({ g, layer, x, y, w, tall, bars }: {
  g: Geo; layer: Layer; x: number; y: number; w: number; tall: number;
  bars: { x: number; w: number; h: number; p: number; color: string; ink: string; label: string; under?: ReactNode }[];
}) {
  return (
    <>
      <On layer={layer} own="over" style={{ position: "absolute", left: x, top: y, width: w, height: tall }}>
        {bars.map((b, i) => (b.p > 0 ? (
          <div key={i} style={abs({ left: b.x, top: tall - Math.round(b.h * b.p), width: b.w, height: Math.max(4, Math.round(b.h * b.p)), background: b.color, borderRadius: "12px 12px 0 0", justifyContent: "center", paddingTop: 10, color: b.ink, fontSize: g.px(30, 40), fontWeight: 600 })}>
            {b.p >= 1 ? b.label : ""}
          </div>
        ) : null))}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: x, top: y + tall, width: w, height: 4, background: P.rule }} />
      {bars.map((b, i) => b.under && (
        <On key={i} layer={layer} own="base" style={{ position: "absolute", left: x + b.x, top: y + tall + 12, width: b.w, flexDirection: "column", alignItems: "center" }}>{b.under}</On>
      ))}
    </>
  );
}

function Cover({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  if (f.coverStyle === "rows") return <RowsCover g={g} c={c} layer={layer} s={s} />;
  const chartW = g.wide ? 940 : g.w - g.side * 2;
  const tall = g.px(300, 420);
  const y = g.wide ? g.top + 90 : g.top + 260;
  if (f.coverStyle === "steps") {
    const bands = f.pension?.bands ?? [];
    const gap = 22;
    const barW = Math.floor((chartW - gap * Math.max(0, bands.length - 1)) / Math.max(1, bands.length));
    const most = Math.max(1, ...bands.map((b) => b.percent));
    return (
      <>
        <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.top, flexDirection: "column", width: g.wide ? 640 : chartW }}>
          <div style={box(kickerStyle(g))}>{f.coverTitle}</div>
          <div style={box({ fontSize: g.px(50, 64), fontWeight: 600, color: P.figure, marginTop: 10 })}>ยิ่งอายุมาก ยิ่งได้มากขึ้น</div>
          {g.wide && f.coverPen && <div style={box({ fontSize: 46, color: P.pen, transform: "rotate(-2deg)", marginTop: 40 })}>{f.coverPen}</div>}
        </On>
        <Bars g={g} layer={layer} x={g.wide ? g.w - g.side - chartW : g.side} y={y} w={chartW} tall={tall} bars={bands.map((b, i) => ({
          x: i * (barW + gap), w: barW, h: Math.round((b.percent / most) * tall), p: s.sweep[i] ?? 1,
          color: i === bands.length - 1 ? P.highlighter : P.figure, ink: i === bands.length - 1 ? P.ink : C.paper, label: `${b.percent}%`,
          under: <div style={box({ flexDirection: "column", alignItems: "center" })}>
            <div style={box({ fontSize: g.px(22, 28), color: P.mute })}>{`อายุ ${b.from}–${b.to}`}</div>
            <div style={box({ fontSize: g.px(28, 36), fontWeight: 600, color: P.ink })}>{b.annual}</div>
          </div>,
        }))} />
      </>
    );
  }
  // Life Protect's two death benefits as bars across the ages
  const [first, second] = f.cover;
  const beforeAge = Number(first.label.match(/(\d+)/)?.[1] ?? f.coverToAge);
  const span = Math.max(1, f.coverToAge - f.age);
  const firstW = second ? Math.round(((beforeAge - f.age) / span) * chartW) : chartW;
  const a1 = num(first.amount);
  const a2 = second ? num(second.amount) : 0;
  const hOf = (a: number) => Math.round((a / Math.max(a1, a2)) * tall);
  const m = (a: number) => `${(a / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  const age = (v: number) => <div style={box({ fontSize: g.px(24, 30), color: P.mute })}>{String(v)}</div>;
  return (
    <>
      <div style={abs({ left: g.side, top: g.top, flexDirection: "column", width: g.wide ? 700 : chartW })}>
        <On layer={layer} own="base" style={kickerStyle(g)}>{f.coverTitle}</On>
        <div style={box({ justifyContent: "space-between", alignItems: "center", marginTop: g.px(10, 30) })}>
          <On layer={layer} own="over"><Swept p={s.sweep[0] ?? 1} size={g.px(32, 40)}>{first.label}</Swept></On>
          <On layer={layer} own="base" style={{ fontSize: g.px(40, 44), fontWeight: 600, color: P.ink, flexShrink: 0, marginLeft: 16 }}>{`${first.amount} บาท`}</On>
        </div>
        {second && (
          <div style={box({ justifyContent: "space-between", alignItems: "center", marginTop: g.px(4, 16) })}>
            <On layer={layer} own="base" style={{ fontSize: g.px(32, 40), color: P.mute }}>{second.label}</On>
            <On layer={layer} own="base" style={{ fontSize: g.px(40, 44), fontWeight: 600, color: P.ink, flexShrink: 0, marginLeft: 16 }}>{`${second.amount} บาท`}</On>
          </div>
        )}
        {g.wide && f.coverPen && <On layer={layer} own="base" style={{ fontSize: 46, color: P.pen, transform: "rotate(-2deg)", marginTop: 40 }}>{f.coverPen}</On>}
      </div>
      <Bars g={g} layer={layer} x={g.wide ? g.w - g.side - chartW : g.side} y={y} w={chartW} tall={tall} bars={[
        { x: 0, w: firstW, h: hOf(a1), p: s.bars[0], color: P.figure, ink: C.paper, label: m(a1), under: <div style={box({ width: firstW, justifyContent: "space-between" })}>{age(f.age)}{second ? null : age(f.coverToAge)}</div> },
        ...(second ? [{ x: firstW, w: chartW - firstW, h: hOf(a2), p: s.bars[1], color: C.barAfter, ink: C.paper, label: m(a2), under: <div style={box({ width: chartW - firstW, justifyContent: "space-between" })}>{age(beforeAge)}{age(f.coverToAge)}</div> }] : []),
      ]} />
    </>
  );
}

function Value({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const t = g.table;
  const heads = f.pension
    ? PENSION_VIDEO_COLUMNS.map((x, i) => ({ h: x.head, w: x.width, left: i === 0 }))
    : ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"].map((h, i) => ({ h, w: COLS[i], left: i < 2 }));
  const p = f.pension;
  return (
    <>
      {p ? (
        <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.wide ? g.top + 40 : g.top - 10, flexDirection: g.wide ? "column" : "row", alignItems: g.wide ? "flex-start" : "flex-end", width: g.wide ? t.x - g.side - 40 : g.w - g.side * 2, justifyContent: "space-between" }}>
          <div style={box({ fontSize: g.px(30, 42), fontWeight: 600, color: BLUE_PEN })}>{`รับประกันจ่าย 15 ปีแรก (อายุ ${p.start}–${p.guaranteeTo})`}</div>
          <div style={box({ flexDirection: "column", marginTop: g.px(0, 40) })}>
            <div style={box({ fontSize: g.px(22, 36), color: P.mute })}>รวมรับบำนาญถึงอายุ 95 ประมาณ</div>
            <div style={box({ fontSize: g.px(54, 100), fontWeight: 600, color: P.figure, lineHeight: 1.1 })}>{`${money(p.totalPension)} บาท`}</div>
          </div>
        </On>
      ) : c.chart && g.wide ? (
        <On layer={layer} own="base" style={{ position: "absolute", left: g.side - 10, top: g.top + 20 }}><Chart chart={c.chart} p={P} /></On>
      ) : (
        <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.top, ...kickerStyle(g) }}>
          {f.breakEven ? `อายุ ${f.breakEven.age} ขอคืนได้ ${f.breakEven.cash} บาท` : "มูลค่าเงินสดโตทุกปี"}
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: t.x, top: t.y - 52, width: t.w, height: 52, background: P.figure, color: C.paper, fontSize: 26, alignItems: "center" }}>
        {heads.map(({ h, w, left }) => (
          <div key={h} style={box({ width: w, justifyContent: left ? "flex-start" : "flex-end", paddingLeft: left ? 14 : 0, paddingRight: left ? 0 : 14 })}>{h}</div>
        ))}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: t.x, top: t.y + t.h, width: t.w, height: 3, background: P.hair }} />
      {layer === "over" && (c.notes ?? []).map((n, i) => {
        const q = s.pen?.[i] ?? 0;
        return q > 0 && q <= 1 ? <div key={n.beat} style={abs({ left: 0, top: 0, width: g.w, height: g.h })}>{noteInWindow(n, q, t)}</div> : null;
      })}
    </>
  );
}

function Ring({ p, x, y, rx, ry }: { p: number; x: number; y: number; rx: number; ry: number }) {
  const len = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) + 40;
  return (
    <svg width={rx * 2 + 30} height={ry * 2 + 30} viewBox={`0 0 ${rx * 2 + 30} ${ry * 2 + 30}`} style={{ position: "absolute", left: x - rx - 15, top: y - ry - 15 }}>
      <path d={`M ${15 + rx * 2} ${15 + ry} A ${rx} ${ry} 0 1 1 ${15 + rx * 2 - 1} ${15 + ry - 12}`} fill="none" stroke={P.pen} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${len} ${len}`} strokeDashoffset={Math.round(len * (1 - p))} />
    </svg>
  );
}

function Compare({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const plans = c.facts.compare ?? [];
  const labelW = g.px(200, 280);
  const colW = Math.floor((g.w - g.side * 2 - labelW) / Math.max(1, plans.length));
  const top = g.top + g.px(50, 60);
  const rowH = g.px(92, 104);
  const rows: [string, (p: (typeof plans)[number]) => string][] = [
    ["วงเงิน/ปี", (p) => p.ceiling], ["ค่าห้อง/วัน", (p) => p.room], ["ผู้ป่วยนอก/ปี", (p) => p.opd], ["รายเดือน", (p) => `${p.monthly} บาท`],
  ];
  const mainAt = plans.findIndex((p) => p.main);
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.top - 10, ...kickerStyle(g) }}>เทียบแผน iHealthy Ultra</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top, flexDirection: "column", width: g.w - g.side * 2 }}>
        <div style={box({ height: rowH })}>
          <div style={box({ width: labelW })} />
          {plans.map((p) => <div key={p.name} style={box({ width: colW - 8, height: rowH - 14, alignItems: "center", justifyContent: "center", background: P.figure, color: C.paper, fontSize: g.px(34, 42), fontWeight: 600, borderRadius: 16, marginRight: 8 })}>{p.name}</div>)}
        </div>
        {rows.map(([label, value], r) => (
          <div key={label} style={box({ height: rowH, alignItems: "center", background: r % 2 ? "transparent" : P.stripe })}>
            <div style={box({ width: labelW, fontSize: g.px(26, 32), color: P.mute, paddingLeft: 10 })}>{label}</div>
            {plans.map((p) => <div key={p.name} style={box({ width: colW - 8, marginRight: 8, justifyContent: "center", alignItems: "center", height: rowH, fontSize: g.px(p.main ? 32 : 28, p.main ? 40 : 34), fontWeight: p.main ? 600 : 400, color: p.main ? P.figure : P.ink, ...(p.main ? { background: P.tint } : {}) })}>{value(p)}</div>)}
          </div>
        ))}
      </On>
      {mainAt >= 0 && s.ring > 0 && (
        <On layer={layer} own="over" style={{ position: "absolute", left: 0, top: 0, width: g.w, height: g.h }}>
          <Ring p={s.ring} x={g.side + labelW + mainAt * colW + (colW - 8) / 2} y={top + (rowH * 5) / 2} rx={Math.round(colW / 2) + 16} ry={Math.round((rowH * 5) / 2) + 8} />
        </On>
      )}
    </>
  );
}

function ContactScene({ g, c, layer }: { g: Geo; c: DrawContext; layer: Layer }) {
  const k = c.contact;
  const initial = [...k.name.trim()][0] ?? "?";
  const face = g.px(170, 220);
  return (
    <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.px(90, 130), height: g.bottom - g.px(90, 130), flexDirection: g.wide ? "row" : "column", alignItems: g.wide ? "center" : "flex-start" })}>
      <On layer={layer} own="base" style={{ flexDirection: "column", ...(g.wide ? { width: 820 } : {}) }}>
        <div style={box({ fontSize: g.px(34, 44), fontWeight: 600, color: P.accent })}>{c.customer ? `สำหรับ คุณ${c.customer}` : "สนใจรายละเอียดเพิ่มเติม"}</div>
        <div style={box({ fontSize: g.px(62, 84), fontWeight: 600, color: P.figure, lineHeight: 1.3, marginTop: 12 })}>ทักมาคุยกันได้เลย</div>
        <div style={box({ fontSize: g.px(62, 84), fontWeight: 600, color: P.figure, lineHeight: 1.3 })}>{c.narrator === "M" ? "ยินดีช่วยดูแผนให้ครับ" : "ยินดีช่วยดูแผนให้ค่ะ"}</div>
      </On>
      <div style={box({ flexDirection: "column", flex: 1, marginLeft: g.wide ? 40 : 0, marginTop: g.wide ? 0 : 36 })}>
        <On layer={layer} own="base" style={{ border: `3px solid ${P.hair}`, borderRadius: 36, padding: g.px(30, 40), alignItems: "center" }}>
          {k.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.photo} width={face} height={face} style={{ borderRadius: face / 2, objectFit: "cover" }} alt="" />
          ) : (
            <div style={box({ width: face, height: face, borderRadius: face / 2, background: C.noPhoto, alignItems: "center", justifyContent: "center", fontSize: g.px(84, 110), fontWeight: 600, color: P.figure })}>{initial}</div>
          )}
          <div style={box({ flexDirection: "column", marginLeft: 34, flexShrink: 1 })}>
            <div style={box({ fontSize: g.px(44, 56), fontWeight: 600, color: P.ink })}>{k.name}</div>
            <div style={box({ fontSize: g.px(34, 44), color: P.mute, marginTop: 6 })}>{`โทร ${k.phone}`}</div>
            {k.line && <div style={box({ fontSize: g.px(34, 44), color: P.mute })}>{`LINE ${k.line}`}</div>}
          </div>
        </On>
        {c.facts.footNote && <On layer={layer} own="base" style={{ fontSize: g.px(20, 26), color: P.mute, marginTop: 18 }}>{c.facts.footNote}</On>}
      </div>
    </div>
  );
}

function StoryScene({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const pts = c.extra?.story.points ?? [];
  return (
    <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.top - 20, height: g.bottom - g.top + 20, alignItems: "center" })}>
      <On layer={layer} own="base" style={{ flexDirection: "column", alignItems: "center", marginRight: g.px(36, 80), flexShrink: 0 }}>
        <div style={box({ ...kickerStyle(g), marginBottom: 20 })}>ลองนึกภาพ</div>
        {insuredFace(c.facts.sex, g.px(200, 300))}
      </On>
      <div style={box({ flexDirection: "column", flex: 1 })}>
        {pts.map((pt, i) => (
          <div key={i} style={box({ alignItems: "center", marginBottom: g.px(30, 44) })}>
            <On layer={layer} own="base" style={{ width: g.px(56, 70), height: g.px(56, 70), borderRadius: 40, background: P.figure, color: C.paper, fontSize: g.px(32, 40), fontWeight: 600, alignItems: "center", justifyContent: "center", marginRight: 26, flexShrink: 0 }}>{String(i + 1)}</On>
            <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={g.px(40, 58)}>{pt}</Swept></On>
          </div>
        ))}
      </div>
    </div>
  );
}

function QaScene({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const qas = c.extra?.qas ?? [];
  const colW = g.wide ? Math.floor((g.w - g.side * 2 - 60) / 2) : g.w - g.side * 2;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.top - 20, ...kickerStyle(g) }}>คำถามที่เจอบ่อย</On>
      <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.top + g.px(50, 70), flexDirection: g.wide ? "row" : "column" })}>
        {qas.map((q, i) => (
          <div key={q.key} style={box({ width: colW, flexDirection: "column", marginRight: g.wide && i === 0 ? 60 : 0, marginBottom: g.wide ? 0 : 30 })}>
            <div style={box({ alignItems: "flex-start" })}>
              <On layer={layer} own="base" style={{ background: P.figure, color: C.paper, borderRadius: 18, padding: "4px 18px", fontSize: g.px(26, 32), fontWeight: 600, marginRight: 18, marginTop: 6, flexShrink: 0 }}>ถาม</On>
              <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={g.px(36, 44)}>{q.q}</Swept></On>
            </div>
            <On layer={layer} own="base" style={{ fontSize: g.px(30, 38), color: P.ink, marginTop: 14, lineHeight: 1.4 }}>{q.a}</On>
          </div>
        ))}
      </div>
    </>
  );
}

function VersusScene({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const v = c.extra?.versus;
  if (!v) return null;
  const right = plainNumber(v.right.amount) ? money(countAt(num(v.right.amount), s.count)) : v.right.amount;
  const cardW = Math.floor((g.w - g.side * 2 - g.px(100, 140)) / 2);
  const top = g.top + g.px(60, 90);
  const cardH = g.px(300, 380);
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.top - 20, ...kickerStyle(g) }}>{c.facts.product === "PENSION" ? "ลดหย่อนภาษีระหว่างทำงาน" : "เก็บเงินเอง กับ แผนนี้"}</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top, width: cardW, height: cardH, flexDirection: "column", justifyContent: "center", background: P.box, borderRadius: 30, padding: g.px("0 26px", "0 40px") }}>
        <div style={box({ fontSize: g.px(30, 40), color: P.mute })}>{v.left.label}</div>
        <div style={box({ fontSize: g.px(66, 100), fontWeight: 600, color: P.ink, lineHeight: 1.2 })}>{v.left.amount}</div>
        <div style={box({ fontSize: g.px(28, 36), color: P.mute })}>{v.left.unit}</div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side + cardW + g.px(10, 25), top: top + cardH / 2 - g.px(40, 45), width: g.px(80, 90), height: g.px(80, 90), borderRadius: 50, background: P.figure, color: C.paper, fontSize: g.px(32, 38), fontWeight: 600, alignItems: "center", justifyContent: "center" }}>
        {c.facts.product === "PENSION" ? "→" : "vs"}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.w - g.side - cardW, top, width: cardW, height: cardH, border: `5px solid ${P.figure}`, borderRadius: 30 }} />
      <div style={abs({ left: g.w - g.side - cardW + g.px(26, 40), top, height: cardH, flexDirection: "column", justifyContent: "center" })}>
        <On layer={layer} own="base" style={{ fontSize: g.px(30, 40), fontWeight: 600, color: P.figure }}>{v.right.label}</On>
        <On layer={layer} own="over" style={{ fontSize: g.px(70, 110), fontWeight: 600, color: P.figure, lineHeight: 1.2 }}>{right}</On>
        <On layer={layer} own="base" style={{ fontSize: g.px(28, 36), color: P.mute }}>{v.right.unit}</On>
      </div>
      <On layer={layer} own="over" style={{ position: "absolute", left: g.side, width: g.w - g.side * 2, top: top + cardH + g.px(30, 40), justifyContent: "center" }}><Swept p={s.sweep[0] ?? 1} size={g.px(36, 46)}>{v.note}</Swept></On>
    </>
  );
}

function StepsScene({ g, c, layer, s }: { g: Geo; c: DrawContext; layer: Layer; s: OverlayState }) {
  const steps = c.extra?.steps ?? [];
  const dot = g.px(96, 130);
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: g.side, top: g.top - 20, ...kickerStyle(g) }}>เริ่มง่ายๆ 3 ขั้น</On>
      <div style={abs({ left: g.side, width: g.w - g.side * 2, top: g.top + g.px(60, 120), flexDirection: g.wide ? "row" : "column" })}>
        {steps.map((st, i) => (
          <div key={i} style={box({ flexDirection: g.wide ? "column" : "row", alignItems: "center", ...(g.wide ? { flex: 1 } : {}), marginBottom: g.wide ? 0 : 36, marginRight: g.wide && i < steps.length - 1 ? 40 : 0 })}>
            <On layer={layer} own="base" style={{ width: dot, height: dot, borderRadius: dot / 2, background: i === steps.length - 1 ? P.highlighter : P.figure, color: i === steps.length - 1 ? P.ink : C.paper, fontSize: g.px(48, 64), fontWeight: 600, alignItems: "center", justifyContent: "center", flexShrink: 0, ...(g.wide ? { marginBottom: 26 } : { marginRight: 30 }) }}>{String(i + 1)}</On>
            <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={g.px(40, 46)}>{st}</Swept></On>
          </div>
        ))}
      </div>
    </>
  );
}

const DONE: OverlayState = { word: -1, count: 1, sweep: [1, 1, 1], bars: [1, 1], ring: 0 };

/** One layer of one classic scene in a square or landscape frame. */
export function wideSceneLayer(key: SceneKey, c: DrawContext, layer: Layer, size: Wide, state: OverlayState = DONE) {
  const g = geo(size);
  const body = {
    lead: <Lead g={g} c={c} layer={layer} s={state} />,
    price: <Price g={g} c={c} layer={layer} s={state} />,
    cover: <Cover g={g} c={c} layer={layer} s={state} />,
    value: <Value g={g} c={c} layer={layer} s={state} />,
    compare: <Compare g={g} c={c} layer={layer} s={state} />,
    contact: c.loop ? <Lead g={g} c={c} layer={layer} s={{ ...state, count: 1, sweep: [1] }} strip /> : <ContactScene g={g} c={c} layer={layer} />,
    story: <StoryScene g={g} c={c} layer={layer} s={state} />,
    qa: <QaScene g={g} c={c} layer={layer} s={state} />,
    versus: <VersusScene g={g} c={c} layer={layer} s={state} />,
    steps: <StepsScene g={g} c={c} layer={layer} s={state} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: g.w, height: g.h, background: layer === "base" ? C.paper : "transparent", fontFamily: "Plex", color: P.ink }}>
      {(key !== "contact" || c.loop) && <Header g={g} c={c} layer={layer} />}
      {body}
      {layer === "over" && <Subtitle g={g} words={c.words} word={state.word} />}
      <Footer g={g} c={c} layer={layer} />
    </div>
  );
}

/** the chart's width beside a landscape table */
export const WIDE_CHART_W = 760;
