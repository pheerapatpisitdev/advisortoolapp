import { Fragment, type ReactNode } from "react";
import { abs, box, look } from "./motion";
import { devArea, E, fill, glowBox, ink, kit, pen, Title, type Dev } from "./story-info-motion";
import { SAVE_WORDS as SW, type SaveShow } from "./story-knowledge";
import { geoOf } from "./story-knowledge-motion";
import { ln, metaTitleSize, ovalD, rectD, shape } from "./story-meta-info";
import { r1 } from "./story-meta-motion";
import { BASKET, goodParts, goodTransform, GOODS_X, jarAt, JAR, JAR_BODY, JAR_LID, JAR_NECK, jarFill, jarGeo, jarTick, paidGeo, pensionAt, pensionGeo, PRICE, priceAt, priceGeo, type Part, type SavePlace } from "./story-save-motion";
import type { VideoSize } from "./timeline";

/**
 * ออมเงินและเกษียณ (device round 4) in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน, บลูพริ้นท์ and the retired
 * อินโฟกราฟิก: the four saving devices story-save-motion.tsx draws on paper, with the same geometry (its jarGeo, paidGeo,
 * priceGeo and pensionGeo, asked for the info route's room) and the same beats, drawn with the Kit story-info-motion.tsx
 * sets for the frame: its inks, its hand, its bold (Sriracha never above 400), its glow, its hatching. A drawn look
 * draws in outline, a bar hatched (นีออน's glow); อินโฟกราฟิก fills its shapes flat on the navy. Every figure is the
 * device's own number in baht; no percent, no return word, and pricerise and the cost-of-living line carry none.
 */

/** where a saving device stands in the info route: the room under its title (above the plotter's rail), the frame's text size */
export const savePlace = (size: VideoSize): SavePlace => ({ room: devArea(size), text: geoOf(size).text });

/** a saving device's frame body in the info route at scene time t (infoShow hands it the frame, the movements, the room) */
export function saveInfo(d: Dev, show: SaveShow) {
  switch (show.layout) {
    case "savejar": return savejar(d, show);
    case "paidgot": return paidgot(d, show);
    case "pricerise": return pricerise(d, show);
    case "pensionsteps": return pensionsteps(d, show);
  }
}

/** what was paid: the accent (the marker's blue, the tube's cyan); white where the accent is the same ink as the plan's green (บลูพริ้นท์) */
const paidInk = () => { const K = kit(); return K.gold === K.green ? K.white : K.gold; };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** a rounded rect as a path, for shape() */
const rrectD = (x: number, y: number, w: number, h: number, r: number) =>
  `M${r1(x + r)} ${r1(y)} H${r1(x + w - r)} Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)} V${r1(y + h - r)} Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - r)} ${r1(y + h)} H${r1(x + r)} Q${r1(x)} ${r1(y + h)} ${r1(x)} ${r1(y + h - r)} V${r1(y + r)} Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)} Z`;

/** the scene's title, set to fit the frame's width as every info device's is */
function SaveTitle({ d, show }: { d: Dev; show: SaveShow }) {
  return <Title text={show.title} an={d.s.title} t={d.t} w={d.w} g={d.g} sizes={metaTitleSize(d.c.size, show.title)} />;
}

/** the note under the picture, as plain lines of the look's hand, fading in last */
function NoteLines({ n, d }: { n: { x: number; y: number; w: number; h: number; size: number; lines: string[] } | null; d: Dev }) {
  if (!n) return null;
  return (
    <div data-note="" style={abs({ left: n.x, top: n.y, width: n.w, height: n.h })}>
      <E an={d.s.note} t={d.t} style={{ width: n.w, height: n.h, flexDirection: "column", alignItems: "center" }}>
        {n.lines.map((x, i) => <div key={i} style={box({ fontSize: n.size, fontWeight: kit().bold, lineHeight: 1.3, ...ink(kit().white), textAlign: "center" })}>{x}</div>)}
      </E>
    </div>
  );
}

/** a layer of a device's own sheet, drawn in its units into `w` × `h` px */
const Sheet = ({ w, h, sheet, children }: { w: number; h: number; sheet: { w: number; h: number }; children: ReactNode }) => (
  <svg width={w} height={h} viewBox={`0 0 ${sheet.w} ${sheet.h}`}>{children}</svg>
);

/* ---------- savejar: กระปุกโตทุกปี ---------- */

/** the jar and its gold lid on its sheet, filled to `level` (0 to 1) with three coins on the surface, a mark at each step reached */
function jarPic(level: number, marks: boolean[]) {
  const K = kit();
  const { fill: spot, coins: spots } = jarFill(level);
  const water = K.drawn ? K.gold : K.sky;
  const wet = { fill: water, fillOpacity: K.drawn ? 0.35 : 1 };
  const filled = !spot ? null : "d" in spot ? <path key="level" d={spot.d} {...wet} /> : <rect key="level" x={spot.x} y={spot.y} width={spot.width} height={spot.height} rx={spot.rx} {...wet} />;
  const coins = spots ? spots.map((c) => shape(`coin${c.x}`, ovalD(c.x, c.y, c.rx, c.ry), K.gold, 2.4, true)) : null;
  return (
    <>
      {K.drawn ? <path d={JAR_BODY} fill={K.page} /> : <path d={JAR_BODY} fill={K.tile} />}
      {filled}
      {coins}
      {K.drawn ? ln("body", JAR_BODY, K.white, 3.6) : <path d={JAR_BODY} fill="none" stroke={K.soft} strokeWidth={4} strokeLinejoin="round" />}
      {shape("neck", rectD(JAR_NECK.x, JAR_NECK.y, JAR_NECK.w, JAR_NECK.h), K.drawn ? K.white : K.soft, 3.2, true)}
      {shape("lid", rrectD(JAR_LID.x, JAR_LID.y, JAR_LID.w, JAR_LID.h, JAR_LID.r), K.gold, 3.6, true)}
      {marks.map((on, i) => (on ? ln(`mark${i}`, `M206 ${jarTick(i)} H234`, K.white, 3.6) : null))}
    </>
  );
}

/** กระปุกโตทุกปี: the jar with its gold lid fills in four steps, each marked with its year; the card of what was sent under or beside it */
function savejar(d: Dev, show: SaveShow<"savejar">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = jarGeo(c.size, show, savePlace(c.size));
  const { level, marks } = jarAt(s, t);
  const j = geo.jar;
  const cd = geo.card;
  const radius = Math.round(geoOf(c.size).text * 0.5);
  return (
    <>
      <SaveTitle d={d} show={show} />
      <div data-part="jar" style={abs({ left: j.x, top: j.y, width: j.w, height: j.h })}>
        <E an={s.set} t={t} style={{ position: "absolute", left: 0, top: 0, width: j.w, height: j.h }}>
          <Sheet w={j.w} h={j.h} sheet={JAR}>{jarPic(level, marks)}</Sheet>
        </E>
      </div>
      {geo.labels ? geo.labels.texts.map((text, i) => {
        const l = geo.labels!;
        const p = look(s[`fill${i}`], t).p;
        return text ? (
          <div key={i} data-part="mark" style={abs({ left: l.x, top: l.ys[i] - Math.round(l.size * 0.65), width: l.w, fontSize: l.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(K.white), opacity: clamp01(p * 3) })}>{text}</div>
        ) : null;
      }) : null}
      <div data-part="card" style={abs({ left: cd.x, top: cd.y, width: cd.w, height: cd.h })}>
        <E an={s.card} t={t} style={{ width: cd.w, height: cd.h, flexDirection: "column", alignItems: "center", justifyContent: "center", background: K.tile, border: `${pen(3)}px solid ${K.tileLine}`, borderRadius: radius, ...glowBox(K.tileLine) }}>
          {cd.lines.map((l, i) => (
            <div key={i} style={box({ fontSize: l.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(show.paid !== undefined && i === cd.lines.length - 1 ? paidInk() : K.white) })}>{l.text}</div>
          ))}
        </E>
      </div>
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- paidgot: ส่งเท่าไร ได้คืนเท่าไร ---------- */

/** ส่งเท่าไร ได้คืนเท่าไร: the two bars to one scale grow in turn, each with its baht above, its name and ages under; the foot line under both when the plan's own (fromPlan) */
function paidgot(d: Dev, show: SaveShow<"paidgot">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = paidGeo(c.size, show, savePlace(c.size));
  const first = geo.bars[0].col.x;
  const last = geo.bars[1].col.x + geo.bars[1].col.w;
  const rule = pen(6);
  const inks = [paidInk(), K.green];
  return (
    <>
      <SaveTitle d={d} show={show} />
      {geo.bars.map((b, i) => {
        const p = look(s[b.key], t).p;
        const h = Math.round(b.h * p);
        const color = inks[i];
        return (
          <Fragment key={b.key}>
            <div data-part="fig" style={abs({ left: b.col.x, top: geo.base - h - geo.headH, width: b.col.w, height: geo.headH, justifyContent: "center", alignItems: "flex-end", fontSize: geo.figSize, fontWeight: K.bold, lineHeight: 1.2, whiteSpace: "nowrap", ...ink(color), opacity: p > 0 ? 1 : 0 })}>{b.fig}</div>
            <div data-part="bar" style={abs({ left: b.x, top: geo.base - h, width: b.w, height: h, ...fill(color, "10px 10px 0 0"), borderRadius: "10px 10px 0 0", borderBottom: "none", opacity: p > 0 ? 1 : 0 })} />
            <div data-part="label" style={abs({ left: b.col.x, top: geo.base + Math.round(geo.labelSize * 0.2), width: b.col.w, justifyContent: "center", fontSize: geo.labelSize, fontWeight: K.bold, lineHeight: 1.2, whiteSpace: "nowrap", ...ink(color), opacity: p > 0 ? 1 : 0 })}>{b.label}</div>
            {b.age ? <div data-part="age" style={abs({ left: b.col.x, top: geo.base + Math.round(geo.labelSize * 1.5), width: b.col.w, justifyContent: "center", fontSize: geo.ageSize, fontWeight: K.bold, lineHeight: 1.2, whiteSpace: "nowrap", ...ink(K.soft), opacity: p > 0 ? 1 : 0 })}>{b.age}</div> : null}
          </Fragment>
        );
      })}
      <div style={abs({ left: first - 16, top: geo.base - Math.round(rule / 2), width: last - first + 32, height: rule, background: K.white, borderRadius: Math.round(rule / 2), ...glowBox(K.white) })} />
      {show.fromPlan ? <E an={s.foot} t={t} style={{ position: "absolute", left: geo.foot.x, top: geo.foot.y, width: geo.foot.w, justifyContent: "center", fontSize: geo.footSize, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(K.soft) }}>{SW.foot}</E> : null}
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- pricerise: เงินเท่าเดิม ซื้อได้น้อยลง ---------- */

/**
 * one of the five goods standing at centre x, its foot at y = 124 (geometry: story-save-motion.tsx's goodParts): an outline in a
 * drawn look, a flat fill in อินโฟกราฟิก
 */
function good(i: number, cx: number) {
  const K = kit();
  // what is drawn on a flat fill (a stem, a band) is the navy; on the page, the look's white
  const mark = K.drawn ? K.white : K.page;
  // each piece's own key, ink and width in this route; `sharp`: drawn square-cornered, as this route always has
  const style: Record<string, { key: string; color: string; w: number; sharp?: true }> = {
    apple: { key: "a", color: K.red, w: 3 }, "apple-stem": { key: "as", color: K.white, w: 2.8 }, "apple-leaf": { key: "al", color: K.green, w: 2.2 },
    bottle: { key: "b", color: K.sky, w: 3 }, "bottle-neck": { key: "bn", color: K.sky, w: 3, sharp: true }, "bottle-cap": { key: "bc", color: K.gold, w: 2.4, sharp: true },
    loaf: { key: "l", color: K.white, w: 3 }, "loaf-slits": { key: "ls", color: mark, w: 2.4 },
    can: { key: "c", color: K.soft, w: 3 }, "can-bands": { key: "cb", color: mark, w: 2.4 },
    lettuce: { key: "t", color: K.green, w: 3 }, "lettuce-vein": { key: "ts", color: mark, w: 2.8 },
  };
  const draw = (p: Part) => {
    const st = style[p.id];
    if (p.kind === "line") return ln(st.key, p.d, st.color, st.w);
    if (p.kind === "oval") return shape(st.key, ovalD(p.cx, p.cy, p.rx, p.ry === p.rx ? undefined : p.ry), st.color, st.w, true);
    return shape(st.key, st.sharp ? rectD(p.x, p.y, p.w, p.h) : rrectD(p.x, p.y, p.w, p.h, p.r), st.color, st.w, true);
  };
  return <>{goodParts(i, cx).map(draw)}</>;
}

/** a basket on its sheet with its goods (each at its opacity; 0 leaves it out) and the banknote under it */
function basketPic(which: "a" | "b", goods: number[]) {
  const K = kit();
  const B = BASKET;
  const basket = K.drawn ? K.white : K.gold;
  const mark = K.drawn ? K.white : K.page;
  return (
    <>
      {ln("handle", B.handle, basket, 4.6)}
      {GOODS_X.map((cx, i) => (goods[i] > 0.01 ? <g key={i} data-good={which} opacity={goods[i].toFixed(3)} transform={goodTransform(cx)}>{good(i, cx)}</g> : null))}
      {shape("body", B.body, basket, 3.6, true)}
      {ln("weave", B.weave, mark, 2.2, { opacity: 0.45 })}
      {shape("rim", rrectD(B.rim.x, B.rim.y, B.rim.w, B.rim.h, B.rim.r), K.drawn ? K.white : K.soft, 3.6, true)}
      <g data-part="banknote">
        {shape("note", rrectD(B.note.x, B.note.y, B.note.w, B.note.h, B.note.r), K.green, 3.4, true)}
        {ln("noteIn", rrectD(B.noteIn.x, B.noteIn.y, B.noteIn.w, B.noteIn.h, B.noteIn.r), K.drawn ? K.green : K.white, 2.2)}
        {shape("coin", ovalD(B.coin.cx, B.coin.cy, B.coin.r), K.gold, 3, true)}
        {B.dots.map((dot, i) => shape(`d${i + 1}`, ovalD(dot.cx, dot.cy, dot.r), K.drawn ? K.green : K.white, 1.6))}
      </g>
    </>
  );
}

/** เงินเท่าเดิม ซื้อได้น้อยลง: today's basket with five goods and a banknote; later, the same banknote, and two goods fade out; the red line under both. No figure. */
function pricerise(d: Dev, show: SaveShow<"pricerise">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = priceGeo(c.size, show, savePlace(c.size));
  const at = priceAt(s, t);
  return (
    <>
      <SaveTitle d={d} show={show} />
      {geo.cols.map((col) => {
        const an = col.key === "a" ? s.today : s.later;
        const goods = col.key === "a" ? [1, 1, 1, 1, 1] : [1, 1, 1, at.extra, at.extra];
        return (
          <div key={col.key} data-part={col.key === "a" ? "today" : "later"} style={abs({ left: col.x, top: col.y, width: col.w, height: col.h })}>
            <E an={an} t={t} style={{ width: col.w, height: col.h, flexDirection: "column", alignItems: "center" }}>
              <div style={box({ height: col.labelH, justifyContent: "center", alignItems: "center", fontSize: col.labelSize, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(K.white) })}>{col.label}</div>
              <Sheet w={col.sheet.w} h={col.sheet.h} sheet={PRICE}>{basketPic(col.key as "a" | "b", goods)}</Sheet>
            </E>
          </div>
        );
      })}
      <E an={s.line} t={t} style={{ position: "absolute", left: geo.line.x, top: geo.line.y, width: geo.line.w, height: geo.line.h, flexDirection: "column", alignItems: "center" }}>
        {geo.line.lines.map((x, i) => <div key={i} style={box({ fontSize: geo.line.size, fontWeight: K.bold, lineHeight: 1.3, ...ink(K.red) })}>{x}</div>)}
      </E>
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- pensionsteps: บำนาญขั้นบันได ---------- */

/** บำนาญขั้นบันได: the green steps rise one by one with their baht a year above and their ages under; a red dashed line labelled ค่าครองชีพ is drawn over them; the caption under */
function pensionsteps(d: Dev, show: SaveShow<"pensionsteps">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = pensionGeo(c.size, show, savePlace(c.size));
  const at = pensionAt(s, show.rows.length, t);
  const { line: lv } = geo;
  const lx = lv.x1 + (lv.x2 - lv.x1) * at.living;
  const ly = lv.y1 + (lv.y2 - lv.y1) * at.living;
  const pad = 12;
  const top = Math.min(lv.y1, lv.y2) - pad;
  const rule = pen(6);
  return (
    <>
      <SaveTitle d={d} show={show} />
      {geo.bars.map((b, i) => {
        const p = at.steps[i];
        const h = Math.round(b.h * p);
        return (
          <Fragment key={i}>
            <div data-part="step" style={abs({ left: b.x, top: geo.base - h, width: b.w, height: h, ...fill(K.green, "10px 10px 0 0"), borderRadius: "10px 10px 0 0", borderBottom: "none", opacity: p > 0 ? 1 : 0 })} />
            <div data-part="fig" style={abs({ left: b.fig.x, top: b.fig.y + (b.h - h), width: b.fig.w, height: b.fig.h, justifyContent: "center", alignItems: "center", fontSize: geo.figSize, fontWeight: K.bold, lineHeight: 1.2, whiteSpace: "nowrap", ...ink(K.green), opacity: p > 0 ? 1 : 0 })}>{b.fig.text}</div>
            {b.leader ? <div data-part="leader" style={abs({ left: b.leader.x - 1, top: b.leader.y + (b.h - h), width: 2, height: b.leader.h, background: K.green, opacity: p > 0 ? 0.8 : 0 })} /> : null}
            <div data-part="age" style={abs({ left: b.age.x, top: b.age.y, width: b.age.w, height: b.age.h, justifyContent: "center", fontSize: geo.ageSize, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(K.white), opacity: p > 0 ? 1 : 0 })}>{b.age.text}</div>
          </Fragment>
        );
      })}
      <div style={abs({ left: geo.chart.x - 12, top: geo.base - Math.round(rule / 2), width: geo.chart.w + 24, height: rule, background: K.white, borderRadius: Math.round(rule / 2), ...glowBox(K.white) })} />
      {at.living > 0 ? (
        <div data-part="living" style={abs({ left: lv.x1 - pad, top, width: lv.x2 - lv.x1 + pad * 2, height: Math.abs(lv.y1 - lv.y2) + pad * 2 })}>
          <svg width={lv.x2 - lv.x1 + pad * 2} height={Math.abs(lv.y1 - lv.y2) + pad * 2} viewBox={`0 0 ${lv.x2 - lv.x1 + pad * 2} ${Math.abs(lv.y1 - lv.y2) + pad * 2}`}>
            {ln("living", `M${pad} ${r1(lv.y1 - top)} L${r1(lx - lv.x1 + pad)} ${r1(ly - top)}`, K.red, 6.6, { strokeDasharray: "16 12" })}
          </svg>
        </div>
      ) : null}
      <div data-part="living-label" style={abs({ left: geo.label.x, top: geo.label.y, width: geo.label.w, height: geo.label.h, justifyContent: "flex-end", alignItems: "center", fontSize: geo.label.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(K.red), opacity: Math.min(1, at.living * 2) })}>{geo.label.text}</div>
      <E an={s.caption} t={t} style={{ position: "absolute", left: geo.caption.x, top: geo.caption.y, width: geo.caption.w, justifyContent: "center", fontSize: geo.caption.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...ink(K.soft) }}>{SW.perYear}</E>
      <NoteLines n={geo.note} d={d} />
    </>
  );
}
