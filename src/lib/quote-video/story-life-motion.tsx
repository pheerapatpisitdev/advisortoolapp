import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { TAX_CAPS, TAX_RATES } from "@/lib/scene-library/tax-th";
import { CHILDREN } from "@/lib/story/faces";
import { Fragment, type ReactNode } from "react";
import { a, abs, box, El, look, stroke, type Anim } from "./motion";
import { fitSize } from "./recipe-blocks";
import { baht, Sheet, type Dev } from "./story-health-motion";
import { incomestopLost, LIFE_WORDS as LW, lifeneedTotals, moneysplitRemainder, n, partnerFace, taxbackRefund, type LifeShow } from "./story-knowledge";
import { geoOf, Title, type Rect } from "./story-knowledge-motion";
import { fitHand, line, minimal, paper, Pic, whole } from "./story-motion";
import { countAt, type VideoSize } from "./timeline";

/**
 * ชีวิต โรคร้าย ภาษี มรดก (device round 2, spec 2026-11-14-devices-life-tax-design.md): the eight devices'
 * timing, which kspec hands on, and their drawers in the story looks (paper, warm, line), which showBody hands
 * the frame (as story-health-motion.tsx's). A figure is drawn and counts up only where the inputs give it (the
 * derived helpers in story-knowledge.ts), so a words-only device has no count; every fixed word is in
 * LIFE_WORDS, so the hand font carries it.
 */

const C = STORY_CLIP_COLORS;
const HAND = "Mali";
const GREEN = C.green;

/** the few things a device shows, in the order they come in */
export function lifeSpec(show: LifeShow): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "lifeneed": {
      const t = lifeneedTotals(show);
      if (!t.blocks.length) return { ...s, blocks: a(0.6, "pop"), words: a(1.4, "up") };
      t.blocks.forEach((_, i) => { s[`block${i}`] = a(0.6 + i * 0.4, "grow"); });
      const card = 0.9 + t.blocks.length * 0.4;
      s.need = a(card, "pop");
      s.count = a(card, "count");
      if (t.have !== undefined) s.have = a(card + 0.6, "left");
      if (t.gap !== undefined) s.gap = a(card + 1.1, "pop");
      return s;
    }
    case "beneficiary":
      s.policy = a(0.5, "pop");
      show.rows.forEach((_, i) => { s[`row${i}`] = a(0.9 + i * 0.35, "left"); });
      s.line = a(1.2 + show.rows.length * 0.35, "fade");
      return s;
    case "cilump":
      s.cert = a(0.5, "pop");
      s.arrow = a(0.9, "stroke", 0.5);
      s.cash = a(1.3, "pop");
      s.card = a(1.7, "pop");
      if (show.sum !== undefined) s.count = a(1.7, "count");
      s.line = a(2.4, "fade");
      if (show.note) s.note = a(2.7, "fade");
      return s;
    case "incomestop":
      s.income = a(0.5, "stroke", 1.0);
      s.gap = a(1.2, "pop");
      s.card = a(1.8, "pop");
      if (incomestopLost(show) !== undefined) s.count = a(1.8, "count");
      return s;
    case "taxback": {
      TAX_RATES.forEach((_, i) => { s[`rung${i}`] = a(0.5 + i * 0.2, "grow"); });
      const after = 0.7 + TAX_RATES.length * 0.2;
      if (show.bracket !== undefined) s.pick = a(after, "pop");
      if (taxbackRefund(show) !== undefined) {
        s.line = a(after + 0.4, "up");
        s.count = a(after + 0.4, "count");
      }
      return s;
    }
    case "taxcap":
      TAX_CAPS.forEach((_, i) => { s[`row${i}`] = a(0.5 + i * 0.4, "left"); });
      s.foot = a(0.7 + TAX_CAPS.length * 0.4, "fade");
      return s;
    case "moneysplit": {
      s.total = a(0.5, "pop");
      show.parts.forEach((_, i) => { s[`part${i}`] = a(1.0 + i * 0.35, "pop"); });
      const after = 1.1 + show.parts.length * 0.35;
      if (show.parts.length && show.parts.every((p) => p.amount !== undefined)) s.count = a(after, "count");
      if (moneysplitRemainder(show) !== undefined) s.left = a(after + 0.5, "fade");
      return s;
    }
    case "threegen":
      show.rows.forEach((_, i) => { s[`gen${i}`] = a(0.5 + i * 0.4, "pop"); });
      s.arrow = a(0.7, "stroke", 0.4 + show.rows.length * 0.4);
      if (show.note) s.note = a(1.0 + show.rows.length * 0.4, "fade");
      return s;
  }
}

/** a device's frame body at scene time t (showBody hands it the frame, the movements, where things stand, the ink) */
export function lifeBody(show: LifeShow, d: Dev) {
  switch (show.layout) {
    case "lifeneed": return <LifeNeed d={d} show={show} />;
    case "beneficiary": return <Beneficiary d={d} show={show} />;
    case "cilump": return <CiLump d={d} show={show} />;
    case "incomestop": return <IncomeStop d={d} show={show} />;
    // taxback, taxcap, moneysplit and threegen: Task 3 draws them
    default: return null;
  }
}

/** Thai marks set above or below a letter: they take no width of their own (as fitHand counts) */
const MARK = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;
/** a word's width in the handwriting face at `size`: 0.7 em a letter that takes width (Mali's widest), the marks none */
const handWidth = (text: string, size: number) => 0.7 * size * [...text].filter((x) => !MARK.test(x)).length;

/**
 * how many lines `text` wrapped at its spaces takes in `room` px at `size` in the handwriting face (the drawing breaks
 * Thai only at a space); a piece wider than the room on its own counts the lines it would run over
 */
export function handLines(text: string, size: number, room: number): number {
  let lines = 0;
  let used = 0;
  for (const word of text.split(" ").filter(Boolean)) {
    const wide = handWidth(word, size);
    const add = used ? handWidth(` ${word}`, size) : wide;
    if (used && used + add <= room) { used += add; continue; }
    lines += Math.max(1, Math.ceil(wide / room));
    used = wide > room ? 0 : wide;
  }
  return Math.max(1, lines);
}

/** the largest size up to `cap` at which every text, wrapped at its spaces, fits `room` px in `band` px of height */
function fitBlock(texts: string[], room: number, band: number, cap: number): number {
  for (let size = Math.floor(cap); size > 8; size -= 1) {
    if (texts.every((x) => x.split(" ").every((p) => !p || handWidth(p, size) <= room) && handLines(x, size, room) * size * 1.3 <= band)) return size;
  }
  return 8;
}

/** a card on paper standing in its column, as tall as its lines (Sheet's look, not placed on its own) */
function Card({ an, t, tilt, pad, w, children }: { an?: Anim; t: number; tilt: number; pad: number; w: number; children: ReactNode }) {
  const l = look(an, t);
  return (
    <div className="cut" style={{ display: "flex", width: w, flexDirection: "column", background: C.note, border: `4px solid ${C.ink}`, borderRadius: 16, padding: pad, opacity: l.opacity, transform: `rotate(${tilt}deg)${l.transform ? ` ${l.transform}` : ""}`, fontFamily: HAND, color: C.ink }}>
      {children}
    </div>
  );
}

/** the title every device opens with, fitted to the frame */
const DevTitle = ({ d, text }: { d: Dev; text: [string, string] }) => (
  <Title fit cut={paper(d.c.input)} pill={line(d.c.input)} ink={d.ink} g={d.g} w={d.w} an={d.s.title} t={d.t} text={text} />
);

/** a piece popping or rising in at its place */
function Piece({ an, t, r, className, children }: { an?: Anim; t: number; r: Rect; className?: string; children: ReactNode }) {
  const l = look(an, t);
  return <div className={className} style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>{children}</div>;
}

/** a line with no space in it, as two lines broken before `at` (one line when `at` is not in it) */
const breakBefore = (text: string, at: string) => {
  const i = text.indexOf(at);
  return i > 0 ? [text.slice(0, i), text.slice(i)] : [text];
};

/* ---------- lifeneed: ทุนชีวิตที่ควรมี ---------- */

const BLOCK_FILL = { debts: C.tiles[2], living: C.tiles[1], education: C.blanket } as const;
const BLOCK_KEYS = ["debts", "living", "education"] as const;

/**
 * ทุนชีวิตที่ควรมี: the needs stacked as blocks (debts at the foot, the family's years of living on it, the children's
 * schooling on top), each with its amount, and a card: the need, what is had, what is still short. With some inputs
 * missing the card's sum is what was typed (รวมที่กรอกไว้), not the need; with none, the blocks are named and a line
 * says what the cover should meet.
 */
function LifeNeed({ d, show }: { d: Dev; show: LifeShow<"lifeneed"> }) {
  const { c, t, s, g } = d;
  const r = g.dev;
  const tot = lifeneedTotals(show);
  const wordsOnly = !tot.blocks.length;
  const blocks: { key: (typeof BLOCK_KEYS)[number]; amount?: number }[] = wordsOnly ? BLOCK_KEYS.map((key) => ({ key })) : tot.blocks;
  const portrait = c.size === "portrait";
  const gapX = Math.round(g.text * 0.8);
  // portrait: the stack over the card; the wider shapes: the stack on the left, the card on the right
  const stack = portrait ? { x: r.x, y: r.y, w: r.w, h: Math.round(r.h * 0.5) } : { x: r.x, y: r.y, w: Math.round(r.w * 0.52), h: r.h };
  const band = portrait ? { x: r.x + 50, y: stack.y + stack.h + gapX, w: r.w - 100, h: r.h - stack.h - gapX } : { x: stack.x + stack.w + gapX, y: r.y, w: r.w - stack.w - gapX, h: r.h };
  const k = blocks.length;
  const gap = Math.round(g.text * 0.22);
  const bw = Math.round(Math.min(stack.w * 0.34, portrait ? 280 : c.size === "square" ? 130 : 240));
  // square's stack is narrow: its blocks taller, so a long label has room for a second line
  const bh = Math.round(Math.min((stack.h - gap * (k - 1)) / k, g.text * (c.size === "square" ? 4.2 : 3.2)));
  const stackH = k * bh + (k - 1) * gap;
  const top = stack.y + Math.round((stack.h - stackH) / 2);
  const lx = stack.x + bw + Math.round(g.text * 0.6);
  const lw = stack.x + stack.w - lx;
  const label = (key: (typeof BLOCK_KEYS)[number]) => (key === "living" && !wordsOnly && show.years !== undefined ? `${LW.living} ${show.years} ${LW.years}` : LW[key]);
  const amountSize = Math.min(Math.round(g.text * 1.3), ...blocks.map((b) => (b.amount === undefined ? 999 : fitSize(baht(b.amount), lw, 999))));
  // each label as large as its own words allow, wrapped at its spaces over its amount (the years' one is the longest)
  const amountH = wordsOnly ? 0 : Math.ceil(amountSize * 1.2);
  const labelSize = (key: (typeof BLOCK_KEYS)[number]) => fitBlock([label(key)], lw, bh - amountH, Math.round(g.text * 1.05));
  const pad = Math.round(g.text * 0.6);
  const inner = band.w - pad * 2 - 8;
  return (
    <>
      <DevTitle d={d} text={show.title} />
      {blocks.map((b, i) => {
        const an = wordsOnly ? s.blocks : s[`block${i}`];
        const p = look(an, t).p;
        const y = top + stackH - (i + 1) * bh - i * gap;
        return (
          <Fragment key={b.key}>
            {/* the block rises from its foot, so the stack is built from the ground up */}
            <div style={abs({ left: stack.x, top: y + Math.round(bh * (1 - p)), width: bw, height: Math.round(bh * p), background: BLOCK_FILL[b.key], border: `4px solid ${C.ink}`, borderRadius: 10, opacity: p > 0 ? 1 : 0 })} />
            <El an={an} t={t} style={{ position: "absolute", left: lx, top: y, width: lw, height: bh, flexDirection: "column", justifyContent: "center", fontFamily: HAND, color: d.ink }}>
              <div style={box({ fontSize: labelSize(b.key), fontWeight: 600, lineHeight: 1.25 })}>{label(b.key)}</div>
              {b.amount !== undefined ? <div style={box({ fontSize: amountSize, fontWeight: 700, lineHeight: 1.2 })}>{baht(b.amount)}</div> : null}
            </El>
          </Fragment>
        );
      })}
      {wordsOnly ? (
        <Sheet r={band} an={s.words} t={t} tilt={0.8} pad={pad} middle>
          {/* the line has no space to wrap at: set as two lines, broken before what it covers */}
          {breakBefore(LW.needWords, "หนี้").map((x, i, all) => (
            <div key={i} style={box({ justifyContent: "center", fontSize: Math.min(...all.map((y) => fitHand(y, inner, Math.round(g.text * 1.2)))), fontWeight: 600, lineHeight: 1.35, textAlign: "center" })}>{x}</div>
          ))}
        </Sheet>
      ) : (
        <Sheet r={band} an={s.need} t={t} tilt={-0.8} pad={pad} middle>
          <NeedRows d={d} tot={tot} partial={tot.blocks.length < BLOCK_KEYS.length} inner={inner} />
        </Sheet>
      )}
    </>
  );
}

/** the card's lines: the need (or what was typed), what is had, and what is still short or that it is enough */
function NeedRows({ d, tot, partial, inner }: { d: Dev; tot: ReturnType<typeof lifeneedTotals>; partial: boolean; inner: number }) {
  const { t, s, g } = d;
  // a card too narrow for a label and its figure side by side sets the figure under its label
  const stacked = inner < 560;
  const labelSize = Math.round(g.text * 1.05);
  const row = (an: Anim | undefined, label: string, value: number, shown: number, color: string, cap: number, first?: boolean) => {
    const room = stacked ? inner : inner - Math.ceil(handWidth(label, labelSize)) - 24;
    const size = fitSize(baht(value), room, cap);
    return (
      <El an={an} t={t} style={{ flexDirection: stacked ? "column" : "row", justifyContent: "space-between", alignItems: stacked ? "flex-start" : "center", marginTop: first ? 0 : Math.round(g.text * 0.35) }}>
        <div style={box({ fontSize: labelSize, fontWeight: 600, lineHeight: 1.3, flexShrink: 0 })}>{label}</div>
        <div style={box({ fontSize: size, fontWeight: 700, lineHeight: 1.2, color })}>{baht(shown)}</div>
      </El>
    );
  };
  const need = tot.need ?? 0;
  return (
    <div style={box({ flexDirection: "column" })}>
      {row(undefined, partial ? LW.partial : LW.need, need, countAt(need, look(s.count, t).p), C.ink, Math.round(g.text * 1.4), true)}
      {tot.have !== undefined ? row(s.have, LW.have, tot.have, tot.have, GREEN, Math.round(g.text * 1.4)) : null}
      {/* (each piece a child of its own: satori lays a fragment's children out apart from the column) */}
      {tot.gap !== undefined ? <El an={s.gap} t={t} style={{ height: 0, borderTop: `3px dashed ${C.ink}`, marginTop: Math.round(g.text * 0.45) }} /> : null}
      {/* what is had meets the need: it is enough, never a gap of nought or a negative */}
      {tot.gap === undefined ? null : tot.gap > 0
        ? row(s.gap, LW.gap, tot.gap, tot.gap, C.red, Math.round(g.text * 1.7))
        : <El an={s.gap} t={t} style={{ justifyContent: "center", marginTop: Math.round(g.text * 0.4), fontSize: fitHand(LW.enough, inner, Math.round(g.text * 1.5)), fontWeight: 700, color: GREEN }}>{LW.enough}</El>}
    </div>
  );
}

/* ---------- beneficiary: ผู้รับประโยชน์ ---------- */

/** who the people are drawn as, row by row: the partner, the two children, a grandmother (the episode's own faces where it has them) */
const benFaces = (input: Dev["c"]["input"]) => [partnerFace(input), CHILDREN[0], CHILDREN[1], "e02"];

/**
 * where ผู้รับประโยชน์ stands: the policy on the left, a row a person (their figure, the name wrapped at its spaces
 * and the share under it), the line along the foot. The names are set in the one size at which the longest piece of
 * every name fits its column and every name fits its row with the share under it.
 */
export function beneficiaryGeo(size: VideoSize, rows: { name: string; share?: number }[]) {
  const g = geoOf(size);
  const r = g.dev;
  const k = Math.max(1, Math.min(4, rows.length));
  const bottom = r.y + r.h;
  const lineSize = fitHand(LW.name, r.w - 40, Math.round(g.text * 0.85));
  const lineH = Math.round(lineSize * 1.35);
  const avail = r.h - lineH - Math.round(g.text * 0.4);
  const rowH = Math.round(Math.min(avail / k, size === "portrait" ? 240 : size === "square" ? 160 : 180));
  const ps = Math.min(rowH - 12, size === "portrait" ? 200 : size === "square" ? 130 : 150);
  const policy = { w: size === "square" ? 180 : 220, h: size === "square" ? 230 : 280 };
  const arrowW = size === "landscape" ? 170 : size === "portrait" ? 70 : 60;
  const shares = rows.some((x) => x.share !== undefined);
  const shareSize = Math.round(g.text * 1.25);
  const shareH = shares ? Math.round(shareSize * 1.2) : 0;
  const nameBand = rowH - shareH - 6;
  const maxRoom = r.w - policy.w - arrowW - ps - 20;
  const nameSize = fitBlock(rows.map((x) => x.name), maxRoom, nameBand, Math.round(g.text * 1.1));
  // the group in the middle of the room, as wide as its longest name needs
  const widest = Math.max(...rows.map((x) => Math.min(maxRoom, handWidth(x.name, nameSize))), shares ? shareSize * 2.6 : 0);
  const groupW = policy.w + arrowW + ps + 20 + Math.ceil(widest);
  const x0 = r.x + Math.max(0, Math.round((r.w - groupW) / 2));
  const rowsTop = r.y + Math.round((avail - rowH * k) / 2);
  const policyR = { x: x0, y: rowsTop + Math.round((rowH * k - policy.h) / 2), w: policy.w, h: policy.h };
  const personX = x0 + policy.w + arrowW;
  const nameX = personX + ps + 20;
  const nameRoom = r.x + r.w - nameX;
  const nameLines = Math.max(...rows.map((x) => handLines(x.name, nameSize, nameRoom)));
  const lineTop = bottom - lineH;
  return { k, rowH, ps, policy: policyR, personX, nameX, nameRoom, nameSize, nameLines, nameBand, shareSize, shareH, rowsTop, lineSize, lineTop, lineBottom: lineTop + lineH, bottom };
}

/** ผู้รับประโยชน์: the policy, an arrow to each person named on it with their share, and how they are named */
function Beneficiary({ d, show }: { d: Dev; show: LifeShow<"beneficiary"> }) {
  const { c, t, s, g } = d;
  const rows = show.rows.slice(0, 4);
  const geo = beneficiaryGeo(c.size, rows);
  const faces = benFaces(c.input);
  const pl = geo.policy;
  const from = { x: pl.x + pl.w + 6, y: pl.y + Math.round(pl.h / 2) };
  const span = { x: from.x, y: geo.rowsTop, w: geo.personX - from.x, h: geo.rowH * geo.k };
  return (
    <>
      <DevTitle d={d} text={show.title} />
      <Piece an={s.policy} t={t} r={pl} className="piece">
        <PolicyDoc w={pl.w} h={pl.h} size={fitHand(LW.policy, pl.w - 36, Math.round(g.text * 0.95))} />
      </Piece>
      {/* the arrows, each drawn out to its person as the person comes in */}
      <div style={abs({ left: span.x, top: span.y, width: span.w, height: span.h })}>
        <svg width={span.w} height={span.h} viewBox={`0 0 ${span.w} ${span.h}`}>
          {rows.map((_, i) => {
            const y0 = from.y - span.y;
            const y1 = Math.round(geo.rowH * (i + 0.5));
            const x1 = span.w - 10;
            const len = Math.round(Math.hypot(x1, y1 - y0) * 1.1) + 40;
            const p = look(s[`row${i}`], t).p;
            return <g key={i}>{stroke({ d: `M2 ${y0} C${Math.round(x1 * 0.5)} ${y0} ${Math.round(x1 * 0.5)} ${y1} ${x1} ${y1} M${x1 - 16} ${y1 - 11} L${x1} ${y1} L${x1 - 16} ${y1 + 11}`, len, p, color: d.ink, width: 5 })}</g>;
          })}
        </svg>
      </div>
      {rows.map((row, i) => {
        const y = geo.rowsTop + i * geo.rowH;
        // มินิมอล: a whole person in a face's square is small, so they stand the row's whole height
        const pr = minimal(c.input) ? { x: geo.personX, y: y + 2, w: geo.ps, h: geo.rowH - 4 } : { x: geo.personX, y: y + Math.round((geo.rowH - geo.ps) / 2), w: geo.ps, h: geo.ps };
        const l = look(s[`row${i}`], t);
        return (
          <div key={i} style={abs({ left: 0, top: 0, width: 1, height: 1, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>
            {whole(c.input) ? <Pic c={c} id={faces[i]} r={pr} t={t + i * 0.5} pose={i ? "stand" : "wave"} /> : null}
            <div style={abs({ left: geo.nameX, top: y, width: geo.nameRoom, height: geo.rowH, flexDirection: "column", justifyContent: "center", fontFamily: HAND, color: d.ink })}>
              <div style={box({ fontSize: geo.nameSize, fontWeight: 600, lineHeight: 1.3, flexWrap: "wrap" })}>{row.name}</div>
              {row.share !== undefined ? <div style={box({ fontSize: geo.shareSize, fontWeight: 700, lineHeight: 1.2, color: shareInk(c) })}>{`${row.share}%`}</div> : null}
            </div>
          </div>
        );
      })}
      <El an={s.line} t={t} style={{ position: "absolute", left: g.dev.x, width: g.dev.w, top: geo.lineTop, justifyContent: "center", fontFamily: HAND, fontSize: geo.lineSize, fontWeight: 600, color: d.ink }}>{LW.name}</El>
    </>
  );
}

/** a share's colour: the policy's navy on paper and the line look's white; on มินิมอล's ground, its own ink */
const shareInk = (c: Dev["c"]) => (minimal(c.input) ? GREEN : C.navy);

/** the policy: a sheet with กรมธรรม์ at its head, its lines and a red seal, `w` × `h` */
function PolicyDoc({ w, h, size }: { w: number; h: number; size: number }) {
  const sx = (x: number) => Math.round((x / 100) * w);
  const sy = (y: number) => Math.round((y / 130) * h);
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={10} fill={C.note} stroke={C.ink} strokeWidth={5} />
        {[52, 66, 80, 94].map((y, i) => <path key={y} d={`M${sx(16)} ${sy(y)} H${sx(i === 3 ? 56 : 84)}`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" opacity={0.55} />)}
        <circle cx={sx(72)} cy={sy(110)} r={Math.round(w * 0.11)} fill={C.red} />
        <path d={`M${sx(66)} ${sy(118)} L${sx(62)} ${sy(129)} L${sx(72)} ${sy(124)} L${sx(82)} ${sy(129)} L${sx(78)} ${sy(118)}`} fill={C.red} />
      </svg>
      <div style={abs({ left: 0, top: sy(10), width: w, justifyContent: "center", fontFamily: HAND, fontSize: size, fontWeight: 700, color: C.ink })}>{LW.policy}</div>
    </div>
  );
}

/* ---------- cilump: เงินก้อนตอนวินิจฉัย ---------- */

/** where เงินก้อนตอนวินิจฉัย stands: the certificate, the arrow and the notes; the card, the line and the note in a column */
function ciGeo(size: VideoSize) {
  const r = geoOf(size).dev;
  if (size === "portrait") {
    return { cert: { x: r.x + 50, y: r.y, w: 290, h: 360 }, arrow: { x: r.x + 365, y: r.y + 140, w: 150, h: 80 }, cash: { x: r.x + 540, y: r.y + 50, w: 330, h: 260 }, col: { x: r.x, y: r.y + 400, w: r.w, h: r.h - 400 }, card: r.w - 160 };
  }
  if (size === "square") {
    return { cert: { x: r.x + 110, y: r.y, w: 190, h: 236 }, arrow: { x: r.x + 325, y: r.y + 85, w: 130, h: 70 }, cash: { x: r.x + 480, y: r.y + 20, w: 270, h: 210 }, col: { x: r.x, y: r.y + 256, w: r.w, h: r.h - 256 }, card: r.w - 260 };
  }
  return { cert: { x: r.x + 10, y: r.y + 70, w: 300, h: 380 }, arrow: { x: r.x + 330, y: r.y + 215, w: 150, h: 80 }, cash: { x: r.x + 500, y: r.y + 125, w: 330, h: 260 }, col: { x: r.x + 880, y: r.y, w: r.w - 880, h: r.h }, card: r.w - 880 };
}

/** เงินก้อนตอนวินิจฉัย: the doctor's certificate, an arrow, a stack of notes; the lump sum on a card, when it is paid, the show's note */
function CiLump({ d, show }: { d: Dev; show: LifeShow<"cilump"> }) {
  const { c, t, s, g } = d;
  const geo = ciGeo(c.size);
  const pad = Math.round(g.text * 0.6);
  const inner = geo.card - pad * 2 - 8;
  const ar = geo.arrow;
  // the line on one line where it is readable so; in a narrow column, two, broken before its conditions
  const oneLine = fitHand(LW.diagnosed, geo.col.w - 20, Math.round(g.text * 0.9));
  const lines = oneLine >= Math.round(g.text * 0.8) ? [LW.diagnosed] : breakBefore(LW.diagnosed, "ตาม");
  const lineSize = Math.min(...lines.map((x) => fitHand(x, geo.col.w - 20, Math.round(g.text * 0.9))));
  const noteSize = show.note ? Math.min(Math.round(g.text * 0.85), ...show.note.split(" ").map((x) => fitHand(x, geo.col.w - 40, 999))) : 0;
  return (
    <>
      <DevTitle d={d} text={show.title} />
      <Piece an={s.cert} t={t} r={geo.cert} className="piece">
        <Certificate w={geo.cert.w} h={geo.cert.h} size={fitHand(LW.certificate, geo.cert.w - 30, Math.round(g.text * 0.85))} />
      </Piece>
      <div style={abs({ left: ar.x, top: ar.y, width: ar.w, height: ar.h })}>
        <svg width={ar.w} height={ar.h} viewBox={`0 0 ${ar.w} ${ar.h}`}>
          {stroke({ d: `M6 ${ar.h / 2} H${ar.w - 10} M${ar.w - 34} ${ar.h / 2 - 22} L${ar.w - 8} ${ar.h / 2} L${ar.w - 34} ${ar.h / 2 + 22}`, len: ar.w + 80, p: look(s.arrow, t).p, color: d.ink, width: 8 })}
        </svg>
      </div>
      <Piece an={s.cash} t={t} r={geo.cash} className="piece"><Notes w={geo.cash.w} h={geo.cash.h} /></Piece>
      <div style={abs({ left: geo.col.x, top: geo.col.y, width: geo.col.w, height: geo.col.h, flexDirection: "column", alignItems: "center", justifyContent: "center" })}>
        <Card an={s.card} t={t} tilt={-0.8} pad={pad} w={geo.card}>
          {show.sum !== undefined ? (
            <div style={box({ flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: Math.round(g.text * 1.05), fontWeight: 600, lineHeight: 1.3 })}>{LW.lump}</div>
              <div style={box({ fontSize: fitSize(baht(show.sum), inner, Math.round(g.text * 1.8)), fontWeight: 700, lineHeight: 1.2, color: GREEN })}>{baht(countAt(show.sum, look(s.count, t).p))}</div>
            </div>
          ) : <div style={box({ justifyContent: "center", fontSize: fitHand(LW.lump, inner, Math.round(g.text * 1.5)), fontWeight: 700, lineHeight: 1.3, color: GREEN })}>{LW.lump}</div>}
        </Card>
        <El an={s.line} t={t} style={{ marginTop: Math.round(g.text * 0.55), flexDirection: "column", alignItems: "center", fontFamily: HAND, fontSize: lineSize, fontWeight: 600, lineHeight: 1.3, color: d.ink }}>
          {lines.map((x) => <div key={x} style={box({})}>{x}</div>)}
        </El>
        {show.note ? <El an={s.note} t={t} style={{ marginTop: Math.round(g.text * 0.25), width: geo.col.w - 40, justifyContent: "center", fontFamily: HAND, fontSize: noteSize, lineHeight: 1.3, textAlign: "center", color: d.ink, opacity: 0.85 }}>{show.note}</El> : null}
      </div>
    </>
  );
}

/** the doctor's certificate: ใบรับรองแพทย์ at its head, a red cross, its lines and a signature, `w` × `h` */
function Certificate({ w, h, size }: { w: number; h: number; size: number }) {
  const sx = (x: number) => Math.round((x / 100) * w);
  const sy = (y: number) => Math.round((y / 125) * h);
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={10} fill={C.white} stroke={C.ink} strokeWidth={5} />
        <path d={`M${sx(44)} ${sy(34)} h${sx(12)} v${sx(12)} h${sx(12)} v${sx(12)} h${-sx(12)} v${sx(12)} h${-sx(12)} v${-sx(12)} h${-sx(12)} v${-sx(12)} h${sx(12)} Z`} fill={C.red} stroke={C.ink} strokeWidth={3} />
        {[78, 90, 102].map((y, i) => <path key={y} d={`M${sx(14)} ${sy(y)} H${sx(i === 2 ? 50 : 86)}`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" opacity={0.5} />)}
        <path d={`M${sx(58)} ${sy(112)} q${sx(6)} ${-sy(10)} ${sx(10)} 0 t${sx(10)} 0 t${sx(12)} ${-sy(2)}`} fill="none" stroke={C.navy} strokeWidth={4} strokeLinecap="round" />
      </svg>
      <div style={abs({ left: 0, top: sy(8), width: w, justifyContent: "center", fontFamily: HAND, fontSize: size, fontWeight: 700, color: C.ink })}>{LW.certificate}</div>
    </div>
  );
}

/** a stack of banknotes, `w` × `h` (in a 160 × 125 box) */
const Notes = ({ w, h }: { w: number; h: number }) => (
  <svg width={w} height={h} viewBox="0 0 160 125">
    {[0, 1, 2, 3].map((i) => (
      <g key={i} transform={`translate(${12 - i * 3} ${70 - i * 18}) rotate(${[-4, 3, -2, 2][i]} 68 22)`}>
        <rect x={0} y={0} width={136} height={48} rx={6} fill={GREEN} stroke={C.ink} strokeWidth={3.4} />
        <rect x={9} y={8} width={118} height={32} rx={4} fill="none" stroke={C.note} strokeWidth={2.4} />
        <circle cx={68} cy={24} r={11} fill={C.note} stroke={C.ink} strokeWidth={2} />
      </g>
    ))}
  </svg>
);

/* ---------- incomestop: รายได้หยุดระหว่างรักษา ---------- */

/** where รายได้หยุดระหว่างรักษา stands: the income line's room and the card's band */
function stopGeo(size: VideoSize) {
  const r = geoOf(size).dev;
  if (size === "portrait") return { graph: { x: r.x, y: r.y, w: r.w, h: 540 }, card: { x: r.x + 60, y: r.y + 580, w: r.w - 120, h: r.h - 580 } };
  if (size === "square") return { graph: { x: r.x, y: r.y, w: r.w, h: 330 }, card: { x: r.x + 130, y: r.y + 350, w: r.w - 260, h: r.h - 350 } };
  return { graph: { x: r.x, y: r.y, w: Math.round(r.w * 0.6), h: r.h }, card: { x: r.x + Math.round(r.w * 0.64), y: r.y, w: Math.round(r.w * 0.36), h: r.h } };
}

/**
 * รายได้หยุดระหว่างรักษา: the month's income a green line, broken where treatment stops work by a dashed red dip
 * labelled with the months, the one being treated grey above it; a card: a month's income × the months = what is lost
 */
function IncomeStop({ d, show }: { d: Dev; show: LifeShow<"incomestop"> }) {
  const { c, t, s, g } = d;
  const { graph: gr, card } = stopGeo(c.size);
  const lost = incomestopLost(show);
  const incomeLabel = show.monthly !== undefined ? `${LW.income} ${n(show.monthly)} ${LW.perMonth}` : LW.income;
  const labelSize = fitHand(incomeLabel, gr.w - 20, Math.round(g.text * 1.05));
  const labelH = Math.round(labelSize * 1.4);
  const yHi = gr.y + Math.round(gr.h * 0.6);
  const yLo = gr.y + Math.round(gr.h * 0.78);
  const x0 = 8;
  const xa = Math.round(gr.w * 0.3);
  const xb = Math.round(gr.w * 0.7);
  const x1 = gr.w - 8;
  const hi = yHi - gr.y;
  const lo = yLo - gr.y;
  const ps = Math.min(Math.round((xb - xa) * 0.85), hi - labelH - 16);
  const stopWord = show.months !== undefined ? `${LW.stop} ${show.months} ${LW.months}` : LW.stop;
  const stopSize = fitHand(stopWord, xb - xa + 160, Math.round(g.text * 1.05));
  const gp = look(s.gap, t);
  const pad = Math.round(g.text * 0.6);
  const inner = card.w - pad * 2 - 8;
  const product = `${n(show.monthly ?? 0)} × ${show.months ?? 0} ${LW.months}`;
  const lossLine = lost !== undefined ? `= ${baht(lost)}` : show.monthly !== undefined ? `${baht(show.monthly)} ${LW.perMonth}` : "";
  return (
    <>
      <DevTitle d={d} text={show.title} />
      <El an={s.income} t={t} style={{ position: "absolute", left: gr.x, top: gr.y, width: gr.w, justifyContent: "center", fontFamily: HAND, fontSize: labelSize, fontWeight: 700, color: GREEN }}>{incomeLabel}</El>
      <div style={abs({ left: gr.x, top: gr.y, width: gr.w, height: gr.h })}>
        <svg width={gr.w} height={gr.h} viewBox={`0 0 ${gr.w} ${gr.h}`}>
          {/* the income runs before and after; the dip, dashed red, is the months off work */}
          {stroke({ d: `M${x0} ${hi} H${xa} M${xb} ${hi} H${x1}`, len: xa - x0 + x1 - xb, p: look(s.income, t).p, color: GREEN, width: 12 })}
          <path d={`M${xa} ${hi} V${lo} H${xb} V${hi}`} fill="none" stroke={C.red} strokeWidth={8} strokeDasharray="18 12" strokeLinejoin="round" opacity={gp.opacity} />
        </svg>
      </div>
      <Piece an={s.gap} t={t} r={{ x: gr.x + Math.round((xa + xb - ps) / 2), y: yHi - ps - 6, w: ps, h: ps }}>
        <Pic c={c} id={c.input.faces.hero} r={{ x: 0, y: 0, w: ps, h: ps }} gray pose="sad" t={t} />
      </Piece>
      <El an={s.gap} t={t} style={{ position: "absolute", left: gr.x, width: gr.w, top: yLo + Math.round(g.text * 0.3), justifyContent: "center", fontFamily: HAND, fontSize: stopSize, fontWeight: 700, color: C.red }}>{stopWord}</El>
      <Sheet r={card} an={s.card} t={t} tilt={0.8} pad={pad} middle>
        <div style={box({ flexDirection: "column", alignItems: "center" })}>
          <div style={box({ fontSize: lossLine ? Math.round(g.text * 1.05) : fitHand(LW.lost, inner, Math.round(g.text * 1.6)), fontWeight: lossLine ? 600 : 700, lineHeight: 1.3, color: lossLine ? C.ink : C.red })}>{LW.lost}</div>
          {lost !== undefined ? <div style={box({ fontSize: fitSize(product, inner, Math.round(g.text * 1.2)), fontWeight: 600, lineHeight: 1.3 })}>{product}</div> : null}
          {lossLine ? <div style={box({ fontSize: fitSize(lossLine, inner, Math.round(g.text * 1.6)), fontWeight: 700, lineHeight: 1.25, color: C.red })}>{lost !== undefined ? `= ${baht(countAt(lost, look(s.count, t).p))}` : lossLine}</div> : null}
        </div>
      </Sheet>
    </>
  );
}
