import type React from "react";
import { LIFE_CAP, TAX_CAPS, TAX_FOOT, TAX_YEAR } from "@/lib/scene-library/tax-th";
import { abs, box, look, stroke, type Anim } from "./motion";
import { baht } from "./story-health-motion";
import { Card, devArea, dimmed, E, fill, GEO, glowBox, ink, kit, pen, Tile, Title, type Box, type Dev } from "./story-info-motion";
import { incomestopLost, LIFE_WORDS as LW, lifeneedTotals, moneysplitRemainder, n, taxbackLadder, taxbackRefund, type LifeShow } from "./story-knowledge";
import { fitWrap, handWidth, wrapHand } from "./story-life-motion";
import { countAt, type VideoSize } from "./timeline";

/**
 * ชีวิต โรคร้าย ภาษี มรดก (device round 2) in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน, บลูพริ้นท์ and the
 * retired อินโฟกราฟิก: the same eight devices story-life-motion.tsx draws on paper, with the same figures (the derived
 * helpers in story-knowledge.ts, never a figure on the show) and the same rules (no gap against a partial need, a
 * month's income alone is no loss, shares and amounts only when given), drawn with the Kit story-info-motion.tsx sets
 * for the frame: its inks, its hand, its bold (Sriracha never above 400), its glow, its dimension lines, its reveal.
 * People are the Kit's icon tiles, as the info route draws them elsewhere. Every word is a child of its own column (a
 * fragment's children inside a flex column are laid out apart by satori).
 */

/** a device's frame body in the info route at scene time t (infoShow hands it the frame, the movements, the room) */
export function lifeInfo(d: Dev, show: LifeShow) {
  switch (show.layout) {
    case "lifeneed": return lifeneed(d, show);
    case "beneficiary": return beneficiary(d, show);
    case "cilump": return cilump(d, show);
    case "incomestop": return incomestop(d, show);
    case "taxback": return taxback(d, show);
    case "taxcap": return taxcap(d, show);
    case "moneysplit": return moneysplit(d, show);
    case "threegen": return threegen(d, show);
  }
}

/** the largest size up to `cap` at which `text` on one line fits `room` px in the handwriting measure */
const fitOne = (text: string, room: number, cap: number) => Math.max(8, Math.min(Math.round(cap), Math.floor(room / Math.max(1, handWidth(text, 1)))));
/** the largest size up to `cap` at which a figure fits `room` px (0.62 em a character) */
const fitFig = (text: string, room: number, cap: number) => Math.max(8, Math.min(Math.round(cap), Math.floor(room / (0.62 * Math.max(1, [...text].length)))));
/** a line with no space in it, as two lines broken before `at` (one line when `at` is not in it) */
const breakBefore = (text: string, at: string) => {
  const i = text.indexOf(at);
  return i > 0 ? [text.slice(0, i), text.slice(i)] : [text];
};
/** a Tile's own box: the pen's shading is set off behind it, so it stands a little wider and taller */
const tileBox = (size: number) => size + (kit().shade ? Math.max(6, Math.round(size * 0.06)) : 0);

/** lines set one under another in `color`, each a child of the column */
function Lines({ lines, size, color, bold, align = "flex-start", lh = 1.3 }: { lines: string[]; size: number; color: string; bold?: boolean; align?: "flex-start" | "center" | "flex-end"; lh?: number }) {
  const K = kit();
  return (
    <div style={box({ flexDirection: "column", alignItems: align })}>
      {lines.map((x, i) => <div key={i} style={box({ fontSize: size, lineHeight: lh, ...(bold ? { fontWeight: K.bold } : {}), ...ink(color), ...(align === "center" ? { textAlign: "center" } : {}) })}>{x}</div>)}
    </div>
  );
}

/** a figure in `color`, bold, with บลูพริ้นท์'s dimension line under it */
function Fig({ text, size, color, k, column }: { text: string; size: number; color: string; k: number; column?: boolean }) {
  return dimmed(<div style={box({ fontSize: size, fontWeight: kit().bold, lineHeight: 1.2, ...ink(color) })}>{text}</div>, k, column);
}

/** an arrow drawn out over `p`, `w` wide, pointing right, in the accent */
function Arrow({ w, k, p }: { w: number; k: number; p: number }) {
  const K = kit();
  const th = Math.max(6, Math.round(12 * k));
  const head = Math.round(22 * k);
  return (
    <div style={box({ width: w, height: head * 2, alignItems: "center", flexShrink: 0 })}>
      <div style={box({ width: Math.round((w - head * 1.4) * p), height: th, background: K.gold, borderRadius: 6, ...glowBox(K.gold) })} />
      {p > 0.9 ? <div style={box({ width: 0, height: 0, borderTop: `${head}px solid transparent`, borderBottom: `${head}px solid transparent`, borderLeft: `${Math.round(head * 1.4)}px solid ${K.gold}` })} /> : null}
    </div>
  );
}

/** the tax table's line along the foot of the room */
function footOf(a: Box, k: number) {
  const size = fitOne(TAX_FOOT, a.w - 20, 38 * k);
  const h = Math.round(size * 1.5);
  return { size, top: a.y + a.h - h, h };
}
function TaxFoot({ d, an }: { d: Dev; an?: Anim }) {
  const K = kit();
  const f = footOf(d.a, d.k);
  return <E an={an} t={d.t} style={{ position: "absolute", left: d.a.x, width: d.a.w, top: f.top, justifyContent: "center", fontSize: f.size, ...ink(K.soft) }}>{TAX_FOOT}</E>;
}

/* ---------- lifeneed: ทุนชีวิตที่ควรมี ---------- */

const BLOCKS = ["debts", "living", "education"] as const;

/**
 * ทุนชีวิตที่ควรมี: the needs stacked as blocks from the foot up (debts, the family's years of living, schooling), each
 * with its label and amount, and a card: the need (or รวมที่กรอกไว้ when some are missing), what is had, what is short
 * (all three blocks only). With none typed, the blocks are named and the card says what the cover should meet.
 */
function lifeneed(d: Dev, show: LifeShow<"lifeneed">) {
  const K = kit();
  const { c, t, s, g, w, k, a } = d;
  const tot = lifeneedTotals(show);
  const wordsOnly = !tot.blocks.length;
  const blocks: { key: (typeof BLOCKS)[number]; amount?: number }[] = wordsOnly ? BLOCKS.map((key) => ({ key })) : tot.blocks;
  const portrait = c.size === "portrait";
  const gap = Math.round(44 * k);
  const stack: Box = portrait ? { x: a.x, y: a.y, w: a.w, h: Math.round(a.h * 0.5) } : { x: a.x, y: a.y, w: Math.round(a.w * 0.5), h: a.h };
  const band: Box = portrait ? { x: a.x + Math.round(40 * k), y: stack.y + stack.h + gap, w: a.w - Math.round(80 * k), h: a.h - stack.h - gap } : { x: stack.x + stack.w + gap, y: a.y, w: a.w - stack.w - gap, h: a.h };
  const count = blocks.length;
  const bgap = Math.round(18 * k);
  const bw = Math.round(Math.min(stack.w * 0.34, 250 * k));
  const bh = Math.round(Math.min((stack.h - bgap * (count - 1)) / count, (c.size === "square" ? 200 : 165) * k));
  const stackH = count * bh + (count - 1) * bgap;
  const top = stack.y + Math.round((stack.h - stackH) / 2);
  const lx = stack.x + bw + Math.round(30 * k);
  const lw = stack.x + stack.w - lx;
  const label = (key: (typeof BLOCKS)[number]) => (key === "living" && !wordsOnly && show.years !== undefined ? `${LW.living} ${show.years} ${LW.years}` : LW[key]);
  const amountSize = Math.min(Math.round(62 * k), ...blocks.map((b) => (b.amount === undefined ? 999 : fitFig(baht(b.amount), lw, 999))));
  const amountH = wordsOnly ? 0 : Math.ceil(amountSize * 1.25) + (K.dims ? Math.round(24 * k) : 0);
  const labelSize = (key: (typeof BLOCKS)[number]) => fitWrap([label(key)], lw, bh - amountH, Math.round(50 * k));
  const color = (i: number) => (i % 2 ? K.sky : K.gold);
  const inner = band.w - Math.round(80 * k) - pen(3) * 2;
  const words = breakBefore(LW.needWords, "หนี้");
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      {blocks.map((b, i) => {
        const an = wordsOnly ? s.blocks : s[`block${i}`];
        const p = look(an, t).p;
        const y = top + stackH - (i + 1) * bh - i * bgap;
        const size = labelSize(b.key);
        return (
          <div key={b.key} style={abs({ left: 0, top: 0, width: 1, height: 1 })}>
            {/* the block rises from its foot, so the stack is built from the ground up */}
            <div style={abs({ left: stack.x, top: y + Math.round(bh * (1 - p)), width: bw, height: Math.round(bh * p), opacity: p > 0 ? 1 : 0, ...fill(color(i), Math.round(12 * k)) })} />
            <E an={an} t={t} style={{ position: "absolute", left: lx, top: y, width: lw, height: bh, flexDirection: "column", justifyContent: "center" }}>
              <Lines lines={wrapHand(label(b.key), size, lw)} size={size} color={K.white} bold />
              {b.amount !== undefined ? <Fig text={baht(b.amount)} size={amountSize} color={color(i)} k={k} column /> : null}
            </E>
          </div>
        );
      })}
      <div style={abs({ left: band.x, top: band.y, width: band.w, height: band.h, alignItems: "center", justifyContent: "center" })}>
        {wordsOnly ? (
          <Card an={s.words} t={t} k={k} style={{ width: band.w }}>
            {/* the line has no space to wrap at: set as two lines, broken before what it covers */}
            <Lines lines={words} size={Math.min(...words.map((x) => fitOne(x, inner, 60 * k)))} color={K.white} bold align="center" />
          </Card>
        ) : (
          <Card an={s.need} t={t} k={k} style={{ width: band.w, alignItems: "stretch" }}>
            <NeedRows d={d} tot={tot} partial={tot.blocks.length < BLOCKS.length} inner={inner} />
          </Card>
        )}
      </div>
    </>
  );
}

/** the card's rows: the need (or what was typed), what is had, and what is still short or that it is enough */
function NeedRows({ d, tot, partial, inner }: { d: Dev; tot: ReturnType<typeof lifeneedTotals>; partial: boolean; inner: number }) {
  const K = kit();
  const { t, s, k } = d;
  // a card too narrow for a label and its figure side by side sets the figure under its label
  const stacked = inner < Math.round(640 * k);
  const labelSize = Math.round(46 * k);
  const row = (an: Anim | undefined, label: string, value: number, shown: number, color: string, cap: number, first?: boolean) => {
    const room = stacked ? inner : inner - Math.ceil(handWidth(label, labelSize)) - Math.round(24 * k);
    return (
      <E an={an} t={t} style={{ flexDirection: stacked ? "column" : "row", justifyContent: "space-between", alignItems: stacked ? "flex-start" : "center", marginTop: first ? 0 : Math.round(16 * k) }}>
        <div style={box({ fontSize: labelSize, lineHeight: 1.3, flexShrink: 0, ...ink(K.white) })}>{label}</div>
        <Fig text={baht(shown)} size={fitFig(baht(value), room, cap)} color={color} k={k} />
      </E>
    );
  };
  const need = tot.need ?? 0;
  // a partial sum is not the need: the helper gives no gap against it, so neither ขาดอีก nor the enough words is drawn
  const gap = tot.gap;
  return (
    <div style={box({ flexDirection: "column" })}>
      {row(undefined, partial ? LW.partial : LW.need, need, countAt(need, look(s.count, t).p), K.gold, 70 * k, true)}
      {tot.have !== undefined ? row(s.have, LW.have, tot.have, tot.have, K.green, 70 * k) : null}
      {gap !== undefined ? <E an={s.gap} t={t} style={{ height: 0, borderTop: `${pen(3)}px dashed ${K.tileLine}`, marginTop: Math.round(22 * k) }} /> : null}
      {/* what is had meets the need: it is enough, never a gap of nought or a negative */}
      {gap === undefined ? null : gap > 0
        ? row(s.gap, LW.gap, gap, gap, K.red, 84 * k)
        : <E an={s.gap} t={t} style={{ justifyContent: "center", marginTop: Math.round(18 * k), fontSize: fitOne(LW.enough, inner, 72 * k), fontWeight: K.bold, ...ink(K.green) }}>{LW.enough}</E>}
    </div>
  );
}

/* ---------- beneficiary: ผู้รับประโยชน์ ---------- */

/**
 * where ผู้รับประโยชน์ stands in the info route: the policy's tile on the left, a row a person (their tile, the name
 * wrapped at its spaces, the share under it), the line along the foot; the names in the one size at which every name
 * fits its row, the group in the middle of the room
 */
export function benInfoGeo(size: VideoSize, rows: { name: string; share?: number }[]) {
  const k = GEO[size].k;
  const a = devArea(size);
  const count = Math.max(1, Math.min(4, rows.length));
  const lineSize = fitOne(LW.name, a.w - 20, 42 * k);
  const lineH = Math.round(lineSize * 1.5);
  const avail = a.h - lineH - Math.round(20 * k);
  const rowH = Math.round(Math.min(avail / count, 250 * k));
  const ps = Math.round(Math.min(rowH - 24 * k, 180 * k));
  const tile = Math.round((size === "square" ? 200 : 250) * k);
  const policyW = tileBox(tile);
  const policyLabel = fitOne(LW.policy, policyW, 46 * k);
  const policyH = tileBox(tile) + Math.round(12 * k) + Math.round(policyLabel * 1.3);
  const arrowW = Math.round((size === "landscape" ? 200 : 90) * k);
  const shares = rows.some((x) => x.share !== undefined);
  const shareSize = Math.round(60 * k);
  // landscape's rows are short and wide: the share stands beside the name, which then has the row's height
  const beside = size === "landscape";
  const shareW = beside && shares ? Math.ceil(handWidth("100%", shareSize)) + Math.round(30 * k) : 0;
  const shareH = shares && !beside ? Math.round(shareSize * 1.25) + (kit().dims ? Math.round(24 * k) : 0) : 0;
  const gapX = Math.round(26 * k);
  const nameBand = rowH - shareH - 8;
  const maxRoom = a.w - policyW - arrowW - tileBox(ps) - gapX - shareW;
  const nameSize = fitWrap(rows.map((x) => x.name), maxRoom, nameBand, 70 * k);
  const widest = Math.max(...rows.map((x) => Math.max(...wrapHand(x.name, nameSize, maxRoom).map((l) => handWidth(l, nameSize)))), shares && !beside ? handWidth("100%", shareSize) : 0);
  const groupW = policyW + arrowW + tileBox(ps) + gapX + Math.ceil(widest) + shareW;
  const x0 = a.x + Math.max(0, Math.round((a.w - groupW) / 2));
  const rowsTop = a.y + Math.round((avail - rowH * count) / 2);
  const policy = { x: x0, y: rowsTop + Math.round((rowH * count - policyH) / 2), w: policyW, h: policyH, tile, label: policyLabel };
  const personX = x0 + policyW + arrowW;
  const nameX = personX + tileBox(ps) + gapX;
  const nameRoom = a.x + a.w - nameX - shareW;
  // wrapped as the size was found (at most nameRoom wide): widest is then the longest line
  const names = rows.map((x) => wrapHand(x.name, nameSize, maxRoom));
  return { count, rowH, ps, policy, personX, nameX, nameRoom, nameSize, nameBand, names, shareSize, shareH, beside, shareW, widest: Math.ceil(widest), rowsTop, lineSize, lineTop: a.y + a.h - lineH };
}

/** ผู้รับประโยชน์: the policy, an arrow out to each person named on it, their share, and how they are named */
function beneficiary(d: Dev, show: LifeShow<"beneficiary">) {
  const K = kit();
  const { c, t, s, g, w, k, a } = d;
  const rows = show.rows.slice(0, 4);
  const geo = benInfoGeo(c.size, rows);
  const pl = geo.policy;
  const from = { x: pl.x + pl.w + 4, y: pl.y + Math.round(tileBox(pl.tile) / 2) };
  const span = { x: from.x, y: Math.min(geo.rowsTop, from.y - 20), w: geo.personX - from.x - 6 };
  const spanH = Math.max(geo.rowsTop + geo.rowH * geo.count, from.y + 20) - span.y;
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <E an={s.policy} t={t} style={{ position: "absolute", left: pl.x, top: pl.y, width: pl.w, flexDirection: "column", alignItems: "center" }}>
        <Tile kind="shield" size={pl.tile} bg={K.gold} color={K.ground} />
        <div style={box({ marginTop: Math.round(12 * k), fontSize: pl.label, fontWeight: K.bold, lineHeight: 1.3, ...ink(K.gold) })}>{LW.policy}</div>
      </E>
      {/* the arrows, each drawn out to its person as the person comes in */}
      <div style={abs({ left: span.x, top: span.y, width: span.w, height: spanH })}>
        <svg width={span.w} height={spanH} viewBox={`0 0 ${span.w} ${spanH}`}>
          {rows.map((_, i) => {
            const y0 = from.y - span.y;
            const y1 = geo.rowsTop - span.y + Math.round(geo.rowH * (i + 0.5));
            const x1 = span.w - 6;
            const len = Math.round(Math.hypot(x1, y1 - y0) * 1.2) + 40;
            return <g key={i}>{stroke({ d: `M2 ${y0} C${Math.round(x1 * 0.5)} ${y0} ${Math.round(x1 * 0.5)} ${y1} ${x1} ${y1} M${x1 - 16} ${y1 - 11} L${x1} ${y1} L${x1 - 16} ${y1 + 11}`, len, p: look(s[`row${i}`], t).p, color: K.gold, width: pen(5 * k + 1) })}</g>;
          })}
        </svg>
      </div>
      {rows.map((row, i) => {
        const y = geo.rowsTop + i * geo.rowH;
        return (
          <E key={i} an={s[`row${i}`]} t={t} style={{ position: "absolute", left: geo.personX, top: y, width: a.x + a.w - geo.personX, height: geo.rowH, alignItems: "center" }}>
            <Tile kind="person" size={geo.ps} bg={i ? K.sky : K.gold} color={i ? K.white : K.ground} />
            <div style={box({ marginLeft: geo.nameX - geo.personX - tileBox(geo.ps), width: geo.beside ? Math.min(geo.nameRoom, geo.widest + 4) : geo.nameRoom, flexDirection: "column", justifyContent: "center" })}>
              <Lines lines={geo.names[i]} size={geo.nameSize} color={K.white} bold />
              {row.share !== undefined && !geo.beside ? <Fig text={`${row.share}%`} size={geo.shareSize} color={K.green} k={k} column /> : null}
            </div>
            {row.share !== undefined && geo.beside ? <div style={box({ marginLeft: Math.round(30 * k) })}><Fig text={`${row.share}%`} size={geo.shareSize} color={K.green} k={k} column /></div> : null}
          </E>
        );
      })}
      <E an={s.line} t={t} style={{ position: "absolute", left: a.x, width: a.w, top: geo.lineTop, justifyContent: "center", fontSize: geo.lineSize, ...ink(K.soft) }}>{LW.name}</E>
    </>
  );
}

/* ---------- cilump: เงินก้อนตอนวินิจฉัย ---------- */

/** เงินก้อนตอนวินิจฉัย: the doctor's certificate, an arrow, the money; the lump sum on a card, when it is paid, the note */
function cilump(d: Dev, show: LifeShow<"cilump">) {
  const K = kit();
  const { c, t, s, g, w, k, a } = d;
  const wide = c.size === "landscape";
  const tile = Math.round((c.size === "square" ? 220 : wide ? 290 : 250) * k);
  const labelSize = fitOne(LW.certificate, tileBox(tile) + 60 * k, 44 * k);
  const gap = Math.round(56 * k);
  // landscape: the pictures on the left, the words on the right; else the pictures over the words, the whole in the middle
  const colW = wide ? a.w - Math.round(a.w * 0.56) - gap : a.w;
  const cardW = Math.min(colW, Math.round(780 * k));
  const inner = cardW - Math.round(80 * k) - pen(3) * 2;
  const one = fitOne(LW.diagnosed, colW - 20, 46 * k);
  const lines = one >= Math.round(38 * k) ? [LW.diagnosed] : breakBefore(LW.diagnosed, "ตาม");
  const lineSize = Math.min(...lines.map((x) => fitOne(x, colW - 20, 46 * k)));
  const noteSize = show.note ? fitWrap([show.note], colW - 40, Math.round(40 * k * 1.3 * 2), 40 * k) : 0;
  const pics = (
    <div style={box({ alignItems: "center", justifyContent: "center", ...(wide ? { width: Math.round(a.w * 0.56) } : { marginBottom: gap }) })}>
      <E an={s.cert} t={t} style={{ flexDirection: "column", alignItems: "center" }}>
        <Tile kind="pen" size={tile} bg={K.sky} />
        <div style={box({ marginTop: Math.round(10 * k), fontSize: labelSize, fontWeight: K.bold, lineHeight: 1.3, ...ink(K.white) })}>{LW.certificate}</div>
      </E>
      <div style={box({ margin: `0 ${Math.round(24 * k)}px`, paddingBottom: Math.round(labelSize * 1.5) })}><Arrow w={Math.round(150 * k)} k={k} p={look(s.arrow, t).p} /></div>
      <E an={s.cash} t={t} style={{ paddingBottom: Math.round(labelSize * 1.5) }}><Tile kind="coins" size={tile} bg={K.gold} color={K.ground} /></E>
    </div>
  );
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <div style={abs({ left: a.x, top: a.y, width: a.w, height: a.h, flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center" })}>
        {pics}
        <div style={box({ width: colW, flexDirection: "column", alignItems: "center", ...(wide ? { marginLeft: gap } : {}) })}>
          <Card an={s.card} t={t} k={k} style={{ width: cardW }}>
            {show.sum !== undefined ? (
              <div style={box({ flexDirection: "column", alignItems: "center" })}>
                <div style={box({ fontSize: Math.round(50 * k), lineHeight: 1.3, ...ink(K.white) })}>{LW.lump}</div>
                <Fig text={baht(countAt(show.sum, look(s.count, t).p))} size={fitFig(baht(show.sum), inner, 92 * k)} color={K.green} k={k} />
              </div>
            ) : <div style={box({ fontSize: fitOne(LW.lump, inner, 76 * k), fontWeight: K.bold, lineHeight: 1.3, ...ink(K.green) })}>{LW.lump}</div>}
          </Card>
          <E an={s.line} t={t} style={{ marginTop: Math.round(26 * k), flexDirection: "column", alignItems: "center" }}>
            <Lines lines={lines} size={lineSize} color={K.white} align="center" />
          </E>
          {show.note ? (
            <E an={s.note} t={t} style={{ marginTop: Math.round(12 * k), width: colW - 40, justifyContent: "center" }}>
              <Lines lines={wrapHand(show.note, noteSize, colW - 40)} size={noteSize} color={K.soft} align="center" />
            </E>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ---------- incomestop: รายได้หยุดระหว่างรักษา ---------- */

/**
 * รายได้หยุดระหว่างรักษา: the month's income a green line, broken where treatment stops work by a dashed red dip
 * labelled with the months, a hospital bed above it; a card: a month's income × the months = what is lost
 */
function incomestop(d: Dev, show: LifeShow<"incomestop">) {
  const K = kit();
  const { c, t, s, g, w, k, a } = d;
  const lost = incomestopLost(show);
  const gr: Box = c.size === "portrait" ? { x: a.x, y: a.y, w: a.w, h: 560 } : c.size === "square" ? { x: a.x, y: a.y, w: a.w, h: 330 } : { x: a.x, y: a.y + Math.round(60 * k), w: Math.round(a.w * 0.58), h: a.h - Math.round(100 * k) };
  const card: Box = c.size === "landscape" ? { x: gr.x + gr.w + Math.round(50 * k), y: a.y, w: a.w - gr.w - Math.round(50 * k), h: a.h } : { x: a.x + Math.round(70 * k), y: gr.y + gr.h + Math.round(30 * k), w: a.w - Math.round(140 * k), h: a.h - gr.h - Math.round(30 * k) };
  const incomeLabel = show.monthly !== undefined ? `${LW.income} ${n(show.monthly)} ${LW.perMonth}` : LW.income;
  const labelSize = fitOne(incomeLabel, gr.w - 20, 56 * k);
  const labelH = Math.round(labelSize * 1.4);
  const th = Math.max(6, Math.round(14 * k));
  const hi = gr.y + Math.round(gr.h * 0.6);
  const lo = gr.y + Math.round(gr.h * 0.8);
  const xa = gr.x + Math.round(gr.w * 0.3);
  const xb = gr.x + Math.round(gr.w * 0.7);
  const x0 = gr.x + 8;
  const x1 = gr.x + gr.w - 8;
  const ps = Math.round(Math.min((xb - xa) * 0.62, hi - gr.y - labelH - 30 * k));
  const stopWord = show.months !== undefined ? `${LW.stop} ${show.months} ${LW.months}` : LW.stop;
  const stopSize = fitOne(stopWord, xb - xa + 160 * k, 50 * k);
  const ip = look(s.income, t).p;
  const gp = look(s.gap, t);
  const inner = card.w - Math.round(80 * k) - pen(3) * 2;
  const product = `${n(show.monthly ?? 0)} × ${show.months ?? 0} ${LW.months}`;
  const lossLine = lost !== undefined ? `= ${baht(lost)}` : "";
  // a month's income with no months is no loss yet: its figure under a neutral label, in the plain ink
  const monthWord = `${LW.income}${LW.perMonth}`;
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <E an={s.income} t={t} style={{ position: "absolute", left: gr.x, top: gr.y, width: gr.w, justifyContent: "center", fontSize: labelSize, fontWeight: K.bold, ...ink(K.green) }}>{incomeLabel}</E>
      {/* the income runs before and after; the dip, dashed red, is the months off work */}
      <div style={abs({ left: x0, top: hi - Math.round(th / 2), width: Math.round((xa - x0) * ip), height: th, opacity: ip > 0 ? 1 : 0, ...fill(K.green, th) })} />
      <div style={abs({ left: xb, top: hi - Math.round(th / 2), width: Math.round((x1 - xb) * ip), height: th, opacity: ip > 0 ? 1 : 0, ...fill(K.green, th) })} />
      <div style={abs({ left: xa, top: hi, width: xb - xa, height: lo - hi, borderLeft: `${pen(8 * k)}px dashed ${K.red}`, borderRight: `${pen(8 * k)}px dashed ${K.red}`, borderBottom: `${pen(8 * k)}px dashed ${K.red}`, opacity: gp.opacity })} />
      <E an={s.gap} t={t} style={{ position: "absolute", left: Math.round((xa + xb - tileBox(ps)) / 2), top: hi - tileBox(ps) - Math.round(14 * k) }}>
        <Tile kind="bed" size={ps} bg={K.red} />
      </E>
      <E an={s.gap} t={t} style={{ position: "absolute", left: gr.x, width: gr.w, top: lo + Math.round(14 * k), justifyContent: "center", fontSize: stopSize, fontWeight: K.bold, ...ink(K.red) }}>{stopWord}</E>
      <div style={abs({ left: card.x, top: card.y, width: card.w, height: card.h, alignItems: "center", justifyContent: "center" })}>
        <Card an={s.card} t={t} k={k} style={{ width: card.w }}>
          {lost !== undefined ? (
            <div style={box({ flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: Math.round(48 * k), lineHeight: 1.3, ...ink(K.white) })}>{LW.lost}</div>
              <div style={box({ fontSize: fitFig(product, inner, 54 * k), lineHeight: 1.3, ...ink(K.white) })}>{product}</div>
              <Fig text={`= ${baht(countAt(lost, look(s.count, t).p))}`} size={fitFig(lossLine, inner, 80 * k)} color={K.red} k={k} />
            </div>
          ) : show.monthly !== undefined ? (
            <div style={box({ flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: fitOne(monthWord, inner, 48 * k), lineHeight: 1.3, ...ink(K.white) })}>{monthWord}</div>
              <Fig text={baht(show.monthly)} size={fitFig(baht(show.monthly), inner, 80 * k)} color={K.white} k={k} />
            </div>
          ) : <div style={box({ fontSize: fitOne(LW.lost, inner, 76 * k), fontWeight: K.bold, lineHeight: 1.3, ...ink(K.red) })}>{LW.lost}</div>}
        </Card>
      </div>
    </>
  );
}

/* ---------- taxback: ภาษีที่ได้คืนตามฐาน ---------- */

/**
 * ภาษีที่ได้คืนตามฐาน: the table's rates as a ladder, 5% at its foot to 35% at its top, each rung as long as its rate
 * with what the premium (at most the life cap) gives back at it; the agent's rung ringed as the voice's item is, and its
 * line: ฐานภาษี X% → ได้คืน Y. With a premium the subtitle says it (เบี้ยปีละ X บาท); over the cap, a line says what
 * counts. The table's line along the foot.
 */
function taxback(d: Dev, show: LifeShow<"taxback">) {
  const K = kit();
  const { c, t, s, g, w, k, a } = d;
  const ladder = taxbackLadder(show);
  const refund = taxbackRefund(show);
  const over = show.premium !== undefined && show.premium > LIFE_CAP;
  const side = show.bracket !== undefined || over;
  const foot = footOf(a, k);
  const room = foot.top - a.y - Math.round(14 * k);
  const gap = Math.round(46 * k);
  const portrait = c.size === "portrait";
  const lw = portrait ? a.w : Math.round(a.w * (side ? (c.size === "square" ? 0.56 : 0.52) : c.size === "square" ? 0.8 : 0.6));
  const ladH = portrait && side ? Math.round(room * (over ? 0.52 : 0.58)) : room;
  const lad: Box = { x: portrait || side ? a.x : a.x + Math.round((a.w - lw) / 2), y: a.y, w: lw, h: ladH };
  const sr: Box = portrait ? { x: a.x + Math.round(40 * k), y: a.y + ladH + gap, w: a.w - Math.round(80 * k), h: room - ladH - gap } : { x: lad.x + lw + gap, y: a.y, w: a.w - lw - gap, h: room };
  const rungs = ladder.length;
  const headSize = Math.round(40 * k);
  const headH = Math.round(headSize * 1.5);
  const gapR = Math.round(12 * k);
  const rh = Math.floor(Math.min((lad.h - headH - gapR * (rungs - 1)) / rungs, 84 * k));
  const blockH = headH + rungs * rh + (rungs - 1) * gapR;
  const top = lad.y + Math.round((lad.h - blockH) / 2);
  const figSize = Math.min(Math.round(46 * k), Math.round(rh * 0.66));
  const rateW = Math.ceil(handWidth("35%", figSize)) + Math.round(26 * k);
  const amounts = ladder.map((x) => (x.refund === undefined ? "" : n(x.refund)));
  const amtW = show.premium === undefined ? 0 : Math.ceil(Math.max(...amounts.map((x) => 0.62 * figSize * [...x].length), handWidth(LW.back, headSize))) + Math.round(16 * k);
  const barX = lad.x + rateW;
  const barMax = lad.x + lad.w - barX - (amtW ? amtW + Math.round(20 * k) : 0);
  const cardW = Math.min(sr.w, Math.round(760 * k));
  const inner = cardW - Math.round(80 * k) - pen(3) * 2;
  const capLine = `${LW.deductible} ${baht(LIFE_CAP)}`;
  const capSize = fitWrap([capLine], sr.w, Math.round(46 * k * 2.7), 46 * k);
  const rateLine = show.bracket === undefined ? "" : refund !== undefined ? `${LW.bracket} ${show.bracket}% → ${LW.back}` : `${LW.bracket} ${show.bracket}%`;
  const rateSize = fitWrap([rateLine], inner, Math.round((refund !== undefined ? 52 : 68) * k * 2.7), (refund !== undefined ? 52 : 68) * k);
  const pick = look(s.pick, t);
  // with a premium the subtitle says it: the checked input as typed (over the cap, the cap line says what counts)
  const title: [string, string] = show.premium !== undefined ? [show.title[0], `${LW.premium} ${baht(show.premium)}`] : show.title;
  return (
    <>
      <Title text={title} an={s.title} t={t} w={w} g={g} />
      {/* the ladder's heads: the rate, and what it gives back when there is a premium */}
      <E an={s.rung0} t={t} style={{ position: "absolute", left: lad.x, top, width: lad.w, height: headH, alignItems: "center", justifyContent: "space-between", fontSize: headSize, fontWeight: K.bold }}>
        <div style={box(ink(K.gold))}>{LW.bracket}</div>
        {amtW ? <div style={box(ink(K.gold))}>{LW.back}</div> : null}
      </E>
      {ladder.map((rung, i) => {
        const l = look(s[`rung${i}`], t);
        const y = top + headH + (rungs - 1 - i) * (rh + gapR);
        const bw = Math.max(0, Math.round(barMax * (0.3 + (0.7 * i) / (rungs - 1)) * l.p));
        const text: React.CSSProperties = { top: y, height: rh, alignItems: "center", fontSize: figSize, opacity: l.opacity };
        return (
          <div key={rung.rate} style={abs({ left: 0, top: 0, width: 1, height: 1 })}>
            {/* the agent's rung, ringed as it is picked: in the look's tick (never onLine, red in plot and board =
                what the customer pays), tinted as the voice's item is */}
            {rung.on ? <div data-pick="" style={abs({ left: lad.x - Math.round(12 * k), top: y - Math.round(5 * k), width: lad.w + Math.round(24 * k), height: rh + Math.round(10 * k), background: K.on, border: `${pen(4 * k)}px solid ${K.tick}`, borderRadius: Math.round(16 * k), opacity: pick.opacity, ...glowBox(K.tick) })} /> : null}
            <div style={abs({ left: lad.x, width: rateW - Math.round(14 * k), justifyContent: "flex-end", fontWeight: K.bold, ...ink(K.white), ...text })}>{`${rung.rate}%`}</div>
            <div style={abs({ left: barX, top: y + Math.round(rh * 0.18), width: bw, height: Math.round(rh * 0.64), opacity: l.p > 0 ? 1 : 0, ...fill(K.gold, Math.round(8 * k)) })} />
            {rung.refund !== undefined ? <div style={abs({ left: lad.x + lad.w - amtW, width: amtW, justifyContent: "flex-end", ...ink(rung.on ? K.green : K.white), ...(rung.on ? { fontWeight: K.bold } : {}), ...text })}>{n(rung.refund)}</div> : null}
          </div>
        );
      })}
      {side ? (
        <div style={abs({ left: sr.x, top: sr.y, width: sr.w, height: sr.h, flexDirection: "column", alignItems: "center", justifyContent: "center" })}>
          {/* the premium over the cap: the ladder counts only the cap */}
          {over ? (
            <E an={s.cap} t={t} style={{ marginBottom: Math.round(22 * k) }}>
              <Lines lines={wrapHand(capLine, capSize, sr.w)} size={capSize} color={K.white} align="center" />
            </E>
          ) : null}
          {show.bracket !== undefined ? (
            <Card an={s.line} t={t} k={k} style={{ width: cardW }}>
              <Lines lines={wrapHand(rateLine, rateSize, inner)} size={rateSize} color={K.white} bold align="center" />
              {refund !== undefined ? <Fig text={baht(countAt(refund, look(s.count, t).p))} size={fitFig(baht(refund), inner, 84 * k)} color={K.green} k={k} /> : null}
            </Card>
          ) : null}
        </div>
      ) : null}
      <TaxFoot d={d} an={s.foot} />
    </>
  );
}

/* ---------- taxcap: เพดานลดหย่อนรวม ---------- */

/**
 * where เพดานลดหย่อนรวม's rows stand in the info route: one card over the room (the foot under it), the year at its
 * head, a row a cap (the label wrapped beside its figure, the note under both); landscape in two columns. Every size is
 * the largest at which the year and the four rows fit the card.
 */
export function capInfoGeo(size: VideoSize) {
  const k = GEO[size].k;
  const a = devArea(size);
  const foot = footOf(a, k);
  const card: Box = { x: a.x, y: a.y, w: a.w, h: foot.top - a.y - Math.round(14 * k) };
  const padX = Math.round(40 * k);
  const padY = Math.round(28 * k);
  const inner = card.w - padX * 2 - pen(3) * 2;
  const innerH = card.h - padY * 2 - pen(3) * 2;
  const cols = size === "landscape" ? 2 : 1;
  const colGap = cols > 1 ? Math.round(56 * k) : 0;
  const colW = Math.floor((inner - colGap * (cols - 1)) / cols);
  const per = Math.ceil(TAX_CAPS.length / cols);
  const widest = Math.max(...TAX_CAPS.map((x) => [...n(x.cap)].length));
  const at = (ls: number) => {
    const ns = Math.round(ls * 0.8);
    const capSize = Math.round(ls * 1.15);
    const capW = Math.ceil(0.62 * capSize * widest) + Math.round(20 * k);
    const labelRoom = colW - capW;
    const rowGap = Math.round(ls * 0.35);
    const yearSize = Math.round(ls * 1.1);
    const dim = kit().dims ? Math.round(24 * k) : 0;
    const rows = TAX_CAPS.map((x) => ({ label: wrapHand(x.label, ls, labelRoom), note: x.note ? wrapHand(x.note, ns, colW) : [] }));
    const fits = rows.every((r) => r.label.every((l) => handWidth(l, ls) <= labelRoom) && r.note.every((l) => handWidth(l, ns) <= colW));
    const colH = (c: typeof rows) => c.reduce((sum, x) => sum + Math.max(x.label.length * ls * 1.3, capSize * 1.25 + dim) + x.note.length * ns * 1.3, 0) + (c.length - 1) * (rowGap * 2 + 3);
    const h = Math.round(yearSize * 1.3) + rowGap + Math.max(...Array.from({ length: cols }, (_, i) => colH(rows.slice(i * per, (i + 1) * per))));
    return { ls, ns, capSize, labelRoom, rowGap, yearSize, rows, ok: fits && h <= innerH };
  };
  let ls = Math.round((cols > 1 ? 56 : 58) * k);
  while (ls > 10 && !at(ls).ok) ls -= 1;
  return { card, padX, padY, inner, cols, colGap, colW, per, ...at(ls) };
}

/** เพดานลดหย่อนรวม: the tax table's caps on one card, the year at its head, the table's line under it; nothing typed */
function taxcap(d: Dev, show: LifeShow<"taxcap">) {
  const K = kit();
  const { c, t, s, g, w, k } = d;
  const geo = capInfoGeo(c.size);
  const cd = geo.card;
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <Card an={s.card} t={t} k={k} style={{ position: "absolute", left: cd.x, top: cd.y, width: cd.w, height: cd.h, padding: `${geo.padY}px ${geo.padX}px`, alignItems: "stretch", justifyContent: "center" }}>
        <div style={box({ justifyContent: "center", fontSize: geo.yearSize, fontWeight: K.bold, lineHeight: 1.3, marginBottom: geo.rowGap, ...ink(K.gold) })}>{TAX_YEAR}</div>
        <div style={box({ justifyContent: "space-between" })}>
          {Array.from({ length: geo.cols }, (_, ci) => (
            <div key={ci} style={box({ width: geo.colW, flexDirection: "column" })}>
              {TAX_CAPS.slice(ci * geo.per, (ci + 1) * geo.per).map((row, j) => {
                const i = ci * geo.per + j;
                return (
                  <E key={row.label} an={s[`row${i}`]} t={t} style={{ flexDirection: "column", ...(j ? { marginTop: geo.rowGap, paddingTop: geo.rowGap, borderTop: `${pen(3)}px dashed ${K.tileLine}` } : {}) }}>
                    <div style={box({ justifyContent: "space-between", alignItems: "flex-start" })}>
                      <Lines lines={geo.rows[i].label} size={geo.ls} color={K.white} />
                      <div data-cap={row.cap} style={box({ flexShrink: 0 })}><Fig text={n(row.cap)} size={geo.capSize} color={K.gold} k={k} /></div>
                    </div>
                    {geo.rows[i].note.length ? <Lines lines={geo.rows[i].note} size={geo.ns} color={K.soft} /> : null}
                  </E>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
      <TaxFoot d={d} an={s.foot} />
    </>
  );
}

/* ---------- moneysplit: แบ่งเงินให้คนในบ้าน ---------- */

/**
 * where แบ่งเงินให้คนในบ้าน stands in the info route: the lump (portrait: on top, a trunk down the left to each part;
 * the wider shapes: on the left, an arrow fanning out to each) and a box a part, its label wrapped at its spaces over
 * its amount, what is left under them; the labels in the one size at which every label fits its box
 */
export function splitInfoGeo(size: VideoSize, show: LifeShow<"moneysplit">) {
  const k = GEO[size].k;
  const a = devArea(size);
  const parts = show.parts.slice(0, 3);
  const count = Math.max(1, parts.length);
  const amounts = parts.length > 0 && parts.every((p) => p.amount !== undefined);
  const left = moneysplitRemainder(show);
  const portrait = size === "portrait";
  const lump: Box = portrait ? { x: a.x, y: a.y, w: Math.round(a.w * 0.8), h: 250 } : size === "square" ? { x: a.x, y: a.y + Math.round((a.h - 330) / 2), w: 290, h: 330 } : { x: a.x, y: a.y + Math.round((a.h - 400) / 2), w: 420, h: 400 };
  const rows: Box = portrait ? { x: a.x + 130, y: a.y + 300, w: a.w - 130, h: a.h - 300 } : size === "square" ? { x: a.x + 380, y: a.y, w: a.w - 380, h: a.h } : { x: a.x + 580, y: a.y, w: Math.min(a.w - 580, 820), h: a.h };
  const gap = Math.round(22 * k);
  const leftSize = Math.round(46 * k);
  const leftH = left !== undefined ? Math.round(leftSize * 1.3) + Math.round(30 * k) + gap : 0;
  const rowH = Math.floor(Math.min((rows.h - leftH - gap * (count - 1)) / count, (portrait ? 220 : 200) * k));
  const padX = Math.round(30 * k);
  const padY = Math.round(14 * k);
  const inner = rows.w - padX * 2 - pen(3) * 2;
  const amountSize = amounts ? Math.min(Math.round(54 * k), ...parts.map((p) => fitFig(baht(p.amount!), inner, 999))) : 0;
  const amountH = amounts ? Math.round(amountSize * 1.2) + (kit().dims ? Math.round(24 * k) : 0) : 0;
  const labelBand = rowH - padY * 2 - pen(3) * 2 - amountH;
  const labelSize = fitWrap(parts.map((p) => p.label), inner, labelBand, (amounts ? 50 : 60) * k);
  const labels = parts.map((p) => wrapHand(p.label, labelSize, inner));
  const block = count * rowH + (count - 1) * gap + leftH;
  const rowsTop = rows.y + Math.round((rows.h - block) / 2);
  return { parts, count, amounts, left, lump, rows, rowH, gap, rowsTop, padX, padY, amountSize, labelSize, labelRoom: inner, labelBand, labels, leftSize, leftH };
}

/** แบ่งเงินให้คนในบ้าน: a lump splitting into two or three boxes, each its label and (all given) its amount, and what is left */
function moneysplit(d: Dev, show: LifeShow<"moneysplit">) {
  const K = kit();
  const { c, t, s, g, w, k, a } = d;
  const geo = splitInfoGeo(c.size, show);
  const portrait = c.size === "portrait";
  const lb = geo.lump;
  const rowY = (i: number) => geo.rowsTop + i * (geo.rowH + geo.gap);
  const tile = Math.round((portrait ? 170 : c.size === "square" ? 170 : 190) * k);
  const colW = portrait ? lb.w - tileBox(tile) - Math.round(100 * k) : lb.w - Math.round(80 * k);
  const label = show.total !== undefined ? fitOne(LW.total, colW, 50 * k) : fitOne(LW.total, colW, 70 * k);
  const tint = (i: number) => (i % 2 ? K.sky : K.gold);
  // the arrows: portrait, a trunk down the left from under the lump, out to each part; wider, a fan from the lump's side
  const svg: Box = portrait
    ? { x: a.x, y: lb.y + lb.h, w: geo.rows.x - a.x, h: rowY(geo.count - 1) + geo.rowH - lb.y - lb.h }
    : { x: lb.x + lb.w, y: a.y, w: geo.rows.x - lb.x - lb.w, h: a.h };
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <Card an={s.total} t={t} k={k} style={{ position: "absolute", left: lb.x, top: lb.y, width: lb.w, height: lb.h, flexDirection: portrait ? "row" : "column", justifyContent: "center", padding: Math.round(24 * k) }}>
        <Tile kind="coins" size={tile} bg={K.gold} color={K.ground} />
        <div style={box({ flexDirection: "column", alignItems: "center", ...(portrait ? { marginLeft: Math.round(30 * k) } : { marginTop: Math.round(14 * k) }) })}>
          <div style={box({ fontSize: label, lineHeight: 1.3, ...(show.total === undefined ? { fontWeight: K.bold, ...ink(K.green) } : ink(K.white)) })}>{LW.total}</div>
          {show.total !== undefined ? <Fig text={baht(show.total)} size={fitFig(baht(show.total), colW, 72 * k)} color={K.green} k={k} /> : null}
        </div>
      </Card>
      <div style={abs({ left: svg.x, top: svg.y, width: svg.w, height: svg.h })}>
        <svg width={svg.w} height={svg.h} viewBox={`0 0 ${svg.w} ${svg.h}`}>
          {geo.parts.map((_, i) => {
            const p = look(s[`part${i}`], t).p;
            const y1 = rowY(i) + Math.round(geo.rowH / 2) - svg.y;
            const x1 = svg.w - 12;
            const width = pen(5 * k + 1);
            if (portrait) {
              const x0 = 56;
              return <g key={i}>{stroke({ d: `M${x0} 4 V${y1} H${x1} M${x1 - 16} ${y1 - 11} L${x1} ${y1} L${x1 - 16} ${y1 + 11}`, len: y1 + x1 + 60, p, color: K.gold, width })}</g>;
            }
            const y0 = lb.y + Math.round(lb.h / 2) - svg.y;
            const len = Math.round(Math.hypot(x1, y1 - y0) * 1.2) + 40;
            return <g key={i}>{stroke({ d: `M6 ${y0} C${Math.round(x1 * 0.5)} ${y0} ${Math.round(x1 * 0.5)} ${y1} ${x1} ${y1} M${x1 - 16} ${y1 - 11} L${x1} ${y1} L${x1 - 16} ${y1 + 11}`, len, p, color: K.gold, width })}</g>;
          })}
        </svg>
      </div>
      {geo.parts.map((part, i) => (
        <E key={i} an={s[`part${i}`]} t={t} style={{ position: "absolute", left: geo.rows.x, top: rowY(i), width: geo.rows.w, height: geo.rowH, flexDirection: "column", justifyContent: "center", background: K.tile, border: `${pen(3)}px solid ${tint(i)}`, borderRadius: Math.round(24 * k), padding: `${geo.padY}px ${geo.padX}px`, ...glowBox(tint(i)) }}>
          <Lines lines={geo.labels[i]} size={geo.labelSize} color={K.white} bold />
          {geo.amounts && part.amount !== undefined ? <Fig text={baht(countAt(part.amount, look(s.count, t).p))} size={geo.amountSize} color={tint(i)} k={k} column /> : null}
        </E>
      ))}
      {geo.left !== undefined ? (
        <E an={s.left} t={t} style={{ position: "absolute", left: geo.rows.x, top: rowY(geo.count - 1) + geo.rowH + geo.gap, width: geo.rows.w, height: geo.leftH - geo.gap, alignItems: "center", justifyContent: "center", border: `${pen(3)}px dashed ${K.soft}`, borderRadius: Math.round(24 * k), fontSize: Math.min(geo.leftSize, fitFig(`${LW.left} ${baht(geo.left)}`, geo.rows.w - 40, 999)), fontWeight: K.bold, ...ink(K.white) }}>{`${LW.left} ${baht(geo.left)}`}</E>
      ) : null}
    </>
  );
}

/* ---------- threegen: ส่งต่อสามรุ่น ---------- */

/** the three generations' tiles, against the tallest: the grandparent, the parent, the child */
const GEN_SCALE = [1, 0.9, 0.72];

/**
 * where ส่งต่อสามรุ่น stands in the info route: the arcs passing the money on along the top, the three generations'
 * tiles in a row under them standing on one line, each one's words wrapped under them, the note on a card along the foot
 * (in landscape to the right, so the people have the height); each set of words the largest it can be in its room
 */
export function genInfoGeo(size: VideoSize, show: LifeShow<"threegen">) {
  const k = GEO[size].k;
  const a = devArea(size);
  const portrait = size === "portrait";
  const rows = show.rows.slice(0, 3);
  const arcH = Math.round((portrait ? 170 : 120) * k);
  const pad = Math.round(36 * k);
  const side = size === "landscape" && !!show.note;
  const noteW = side ? Math.round(640 * k) : a.w;
  const noteRoom = noteW - Math.round(80 * k) - pen(3) * 2;
  const noteSize = show.note ? fitWrap([show.note], noteRoom, Math.round((side ? 360 : portrait ? 200 : 120) * k), 50 * k) : 0;
  const note = show.note ? wrapHand(show.note, noteSize, noteRoom) : [];
  const noteH = show.note ? Math.round(note.length * noteSize * 1.3) + pad * 2 + pen(3) * 2 : 0;
  const noteGap = show.note && !side ? Math.round(40 * k) : 0;
  const peopleW = side ? a.w - noteW - Math.round(60 * k) : a.w;
  const colW = Math.min(Math.floor(peopleW / 3), Math.round((size === "landscape" ? 420 : 330) * k));
  const x0 = a.x + Math.round((peopleW - 3 * colW) / 2);
  const rowRoom = colW - Math.round(16 * k);
  const rowBand = Math.round((portrait ? 150 : 100) * k);
  const rowSize = fitWrap(rows, rowRoom, rowBand, 52 * k);
  const lines = rows.map((x) => wrapHand(x, rowSize, rowRoom));
  const rowH = Math.ceil(Math.max(...lines.map((x) => x.length)) * rowSize * 1.3);
  const below = side ? 0 : noteGap + noteH;
  const room = a.h - arcH - rowH - below - Math.round(36 * k);
  const tile = Math.max(40, Math.min(colW - Math.round(40 * k), room, Math.round(280 * k)));
  const block = arcH + Math.round(12 * k) + tileBox(tile) + Math.round(18 * k) + rowH + below;
  const top = a.y + Math.max(0, Math.round((a.h - block) / 2));
  const peopleTop = top + arcH + Math.round(12 * k);
  const labelTop = peopleTop + tileBox(tile) + Math.round(18 * k);
  const noteTop = side ? a.y + Math.round((a.h - noteH) / 2) : labelTop + rowH + noteGap;
  const noteX = side ? a.x + a.w - noteW : a.x;
  return { rows: lines, rowSize, rowRoom, rowBand, note, noteSize, noteRoom, noteW, noteH, noteTop, noteX, colW, x0, arcTop: top, arcH, peopleTop, tile, labelTop };
}

/** ส่งต่อสามรุ่น: three generations side by side, the money passed from each to the next along the arcs, the note */
function threegen(d: Dev, show: LifeShow<"threegen">) {
  const K = kit();
  const { c, t, s, g, w, k } = d;
  const geo = genInfoGeo(c.size, show);
  const W = geo.colW * 3;
  const p = look(s.arrow, t).p;
  const passSize = fitOne(LW.pass, geo.colW, 50 * k);
  const coin = Math.round(geo.arcH * 0.13);
  const foot = geo.peopleTop + tileBox(geo.tile);
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      {/* the arcs, the first drawn and then the second, a coin riding at each top as it is passed */}
      <div style={abs({ left: geo.x0, top: geo.arcTop, width: W, height: geo.arcH })}>
        <svg width={W} height={geo.arcH} viewBox={`0 0 ${W} ${geo.arcH}`}>
          {[0, 1].map((i) => {
            const xa = Math.round(geo.colW * (i + 0.5)) + 24;
            const xb = Math.round(geo.colW * (i + 1.5)) - 24;
            const yb = geo.arcH - 10;
            const pi = Math.min(1, Math.max(0, p * 2 - i));
            const len = Math.round((xb - xa) * 1.6) + 60;
            const mx = Math.round((xa + xb) / 2);
            return (
              <g key={i}>
                {stroke({ d: `M${xa} ${yb} Q${mx} ${Math.round(-geo.arcH * 0.2)} ${xb} ${yb} M${xb - 22} ${yb - 14} L${xb} ${yb} L${xb + 4} ${yb - 24}`, len, p: pi, color: K.gold, width: pen(7 * k + 1) })}
                <circle cx={mx} cy={Math.round(geo.arcH * 0.42)} r={coin} fill={K.drawn ? K.page : K.gold} stroke={K.gold} strokeWidth={pen(4 * k + 1)} opacity={pi > 0.5 ? 1 : 0} />
              </g>
            );
          })}
        </svg>
      </div>
      <E an={s.arrow} t={t} style={{ position: "absolute", left: geo.x0 + geo.colW, width: geo.colW, top: geo.arcTop - Math.round(passSize * 0.3), justifyContent: "center", fontSize: passSize, fontWeight: K.bold, ...ink(K.gold) }}>{LW.pass}</E>
      {geo.rows.map((lines, i) => {
        const size = Math.round(geo.tile * GEN_SCALE[i]);
        const x = geo.x0 + i * geo.colW;
        return (
          <E key={i} an={s[`gen${i}`]} t={t} style={{ position: "absolute", left: x, top: geo.peopleTop, width: geo.colW, flexDirection: "column", alignItems: "center" }}>
            {/* each tile stands on the one line, the child the smallest */}
            <div style={box({ height: foot - geo.peopleTop, alignItems: "flex-end" })}>
              <Tile kind="person" size={size} bg={i === 1 ? K.gold : K.sky} color={i === 1 ? K.ground : K.white} />
            </div>
            <div style={box({ marginTop: geo.labelTop - foot, width: geo.colW, justifyContent: "center" })}>
              <Lines lines={lines} size={geo.rowSize} color={K.white} bold align="center" />
            </div>
          </E>
        );
      })}
      {show.note ? (
        <div style={abs({ left: geo.noteX, top: geo.noteTop, width: geo.noteW, height: geo.noteH, justifyContent: "center" })}>
          <Card an={s.note} t={t} k={k} style={{ width: geo.noteW, padding: `${Math.round(36 * k)}px ${Math.round(40 * k)}px` }}>
            <Lines lines={geo.note} size={geo.noteSize} color={K.white} align="center" />
          </Card>
        </div>
      ) : null}
    </>
  );
}
