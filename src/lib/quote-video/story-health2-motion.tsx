import { Fragment, type ReactNode } from "react";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { a, abs, box, El, look, type Anim } from "./motion";
import type { Dev } from "./story-health-motion";
import { HEALTH2_FIXED } from "@/lib/scene-library/health2-fixed";
import { TAX_YEAR } from "@/lib/scene-library/tax-th";
import { BAND_WORDS, HEALTH2_WORDS as W, n, provinceShort, thaiDate, type Health2Show } from "./story-knowledge";
import { geoOf, Title, type Rect } from "./story-knowledge-motion";
import { Card, handWidth } from "./story-life-motion";
import { line, paper, Pic, type StoryContext } from "./story-motion";
import { figWidth, fitFig, noteGeo, NoteLines } from "./story-save-motion";
import type { VideoSize } from "./timeline";

/**
 * สุขภาพเพิ่มเติม (device round 5, spec 2026-11-15-devices-health2-design.md): the eight devices' timing, which kspec hands
 * on. ipdopd opens its two doors in turn, deductible grows its bill bar in two parts, copay splits its sheet, renew98 draws
 * the timeline and its arc, parentshealth shows the parents then the child, groupcost the six people and two cards,
 * hospitals one bar a province, paclaim its cards in turn. The drawers of ipdopd, deductible, copay and renew98 in the story looks (paper, warm, line) are below (Task 2); the other four and the info looks' come with Tasks 3-4.
 */
export function health2Spec(show: Health2Show): Record<string, Anim> {
  const s: Record<string, Anim> = { title: a(0.2, "up") };
  switch (show.layout) {
    case "ipdopd":
      // the blue door (ผู้ป่วยใน) opens and its card follows; then the green door (ผู้ป่วยนอก) and its card; the line last
      s.door0 = a(0.5, "pop");
      s.card0 = a(1.0, "pop");
      s.door1 = a(1.8, "pop");
      s.card1 = a(2.3, "pop");
      s.line = a(3.1, "fade");
      break;
    case "deductible":
      // the bill bar; our part (gold), then the insurer's (green); the card
      s.bill = a(0.5, "grow", 0.7);
      s.ours = a(1.3, "grow", 0.6);
      s.theirs = a(2.0, "grow", 0.6);
      s.card = a(2.8, "pop");
      break;
    case "copay":
      // the bill sheet, the dashed red line across it, our share, the insurer's, the card
      s.sheet = a(0.5, "pop");
      s.cut = a(1.2, "stroke", 0.6);
      s.ours = a(1.9, "pop");
      s.theirs = a(2.4, "pop");
      s.card = a(3.0, "pop");
      break;
    case "renew98":
      // the timeline, today's mark, the dashed arc to the renewal age, the two cards
      s.line = a(0.5, "stroke", 0.8);
      s.today = a(1.0, "pop");
      s.arc = a(1.5, "stroke", 0.9);
      s.to = a(2.3, "pop");
      s.card = a(2.9, "pop");
      break;
    case "parentshealth":
      // the two parents, the child who pays, the card, the foot
      s.parents = a(0.5, "pop");
      s.child = a(1.2, "pop");
      s.card = a(1.9, "pop");
      s.foot = a(2.8, "fade");
      break;
    case "groupcost":
      // six people, then the year's cost and the month's
      s.people = a(0.5, "pop");
      s.year = a(1.4, "pop");
      s.month = a(2.2, "pop");
      break;
    case "hospitals":
      // one bar for each province, to one scale from zero; the foot and the line after
      show.rows.forEach((_, i) => { s[`bar${i}`] = a(0.6 + i * 0.4, "grow", 0.6); });
      s.foot = a(0.8 + show.rows.length * 0.4, "fade");
      s.line = a(1.1 + show.rows.length * 0.4, "fade");
      break;
    case "paclaim":
      // what one accident's treatment may cost at most; then, when the plan has it, the weekly sum and its weeks
      s.medical = a(0.5, "pop");
      s.weekly = a(1.4, "pop");
      s.weeks = a(2.1, "pop");
      break;
  }
  const end = Math.max(...Object.values(s).map((x) => x.at + x.dur));
  s.note = a(end + 0.2, "fade");
  return s;
}

const C = STORY_CLIP_COLORS;
const HAND = "Mali";
/** the blue of ผู้ป่วยใน, the green of what the insurer pays and of ผู้ป่วยนอก, the gold of what we pay, the red of the cut */
const BLUE = C.plotPen;
const GREEN = C.green;
const GOLD = C.coin;
const RED = C.red;

/**
 * Where a round-5 health device stands in the frame: the device's room and the frame's text size (the story looks'), or the
 * info route's room under its own title. Every geometry below takes it so that route can reuse the same placing.
 */
export interface H2Place { room: Rect; text: number }
export const health2Place = (size: VideoSize): H2Place => ({ room: geoOf(size).dev, text: geoOf(size).text });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (x: number) => clamp(x, 0, 1);
const ease = (p: number) => 1 - (1 - clamp01(p)) ** 3;
const inside = (r: Rect, room: Rect) => r.x >= room.x && r.y >= room.y && r.x + r.w <= room.x + room.w && r.y + r.h <= room.y + room.h;
export { inside as h2Inside };

/* ---------- the words, set as lines ---------- */

/** where each long phrase may break (the drawing breaks Thai only where it is told to): its words, in order */
const PHRASE: Record<string, string[]> = {
  [W.noOpd]: ["แผนนี้", "ไม่มี", "ผู้ป่วยนอก"],
  [W.opdIncludes]: ["ผู้ป่วยนอก", "รวม", "ค่าแพทย์ ", "ยา ", "และ", "กายภาพ"],
  [W.notBeyond]: ["ไม่เกิน", "ระยะเวลา", "ของ", "สัญญาหลัก"],
  [W.byAge]: ["เบี้ยปรับ", "ตาม", "ช่วงอายุ"],
  [W.notYet]: ["ยังไม่ถึง", "ส่วนที่", "ประกันจ่าย"],
  [W.restPays]: ["ประกันจ่าย", "ส่วนที่เหลือ"],
  [W.deductibleCard]: ["ส่วนรับผิดชอบ", "แรก", "ของแผน"],
  [W.taxCut]: ["ลูก", "นำ", "เบี้ย", "ไป", "ลดหย่อน", "ภาษี", "ได้"],
  [W.bothParents]: ["ต่อปี ", "รวม", "พ่อ", "และ", "แม่"],
  [`${W.taxFoot} ${TAX_YEAR}`]: ["ตามเกณฑ์", "กรม", "สรรพากร ", "ปีภาษี ", TAX_YEAR.slice("ปีภาษี ".length)],
  [W.perHeadYear]: ["ต่อคน", "ต่อปี"],
  [W.perHeadMonth]: ["เฉลี่ย", "ต่อคน", "ต่อเดือน"],
  [W.perAccident]: ["ค่ารักษา", "ต่อ", "อุบัติเหตุ ", "ไม่เกิน"],
  [W.offWork]: ["ทำงาน", "ไม่ได้", "ชั่วคราว ", "สัปดาห์", "ละ"],
  [W.fullList]: ["ดูรายชื่อ", "เต็ม", "ได้ที่", "เว็บ", "บริษัท"],
};
const segsOf = (text: string) => PHRASE[text] ?? text.split(/(?<= )/);

/** `segs` filled into lines `room` px wide at `size`; null when one piece alone is wider than the room */
function fill(segs: string[], size: number, room: number): string[] | null {
  const lines: string[] = [];
  let cur = "";
  for (const seg of segs) {
    if (handWidth(seg.trimEnd(), size) > room) return null;
    const next = cur + seg;
    if (cur && handWidth(next.trimEnd(), size) > room) { lines.push(cur.trimEnd()); cur = seg; } else cur = next;
  }
  if (cur) lines.push(cur.trimEnd());
  return lines;
}

/**
 * `text` as at most `maxLines` lines in the largest size up to `cap` that fits `room` px; fewer lines are preferred: a phrase
 * goes on one line unless that costs more than a fifth of the size, on two unless that costs more again
 */
export function setPhrase(text: string, room: number, cap: number, maxLines = 2): { size: number; lines: string[] } {
  const segs = segsOf(text);
  for (let ml = 1; ml <= maxLines; ml += 1) {
    const floor = ml === maxLines ? 8 : Math.round(cap * 0.8);
    for (let size = Math.floor(cap); size > floor; size -= 1) {
      const lines = fill(segs, size, room);
      if (lines && lines.length <= ml) return { size, lines };
    }
  }
  return { size: 8, lines: [text] };
}

/** a block of text lines in one size, colour and weight */
export interface Blk { lines: string[]; size: number; color: string; weight: number }
export const blkH = (b: Blk) => Math.round(b.lines.length * b.size * 1.3);
const one = (text: string, room: number, cap: number, color: string, weight = 700): Blk => ({ lines: [text], size: fitFig(text, room, Math.max(10, Math.round(cap))), color, weight });
const phrase = (text: string, room: number, cap: number, color: string, weight = 600, maxLines = 2): Blk => ({ ...setPhrase(text, room, Math.max(10, Math.round(cap)), maxLines), color, weight });

/** blocks one under another, centred, each line a child of its column */
function Blocks({ blocks, align = "center" }: { blocks: Blk[]; align?: "center" | "flex-start" }) {
  return (
    <div style={box({ flexDirection: "column", alignItems: align })}>
      {blocks.map((b) => b.lines.map((x, i) => <div key={`${b.color}${x}${i}`} style={box({ fontSize: b.size, fontWeight: b.weight, lineHeight: 1.3, color: b.color, whiteSpace: "nowrap" })}>{x}</div>))}
    </div>
  );
}

/** a piece popping in at its place */
function Pop({ an, t, r, part, children }: { an?: Anim; t: number; r: Rect; part: string; children?: ReactNode }) {
  const l = look(an, t);
  return <div data-part={part} style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>{children}</div>;
}

/** a card standing at `r`, as tall as its blocks, centred in `r` vertically */
function CardAt({ an, t, r, pad, tilt, part, children }: { an?: Anim; t: number; r: Rect; pad: number; tilt: number; part: string; children: ReactNode }) {
  return (
    <div data-part={part} style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, flexDirection: "column", justifyContent: "center" })}>
      <Card an={an} t={t} tilt={tilt} pad={pad} w={r.w}>{children}</Card>
    </div>
  );
}

/** the line under the picture, in the hand, fading in */
function LineBlock({ an, t, g, color }: { an?: Anim; t: number; g: { x: number; y: number; w: number; h: number; size: number; lines: string[] }; color: string }) {
  return (
    <El an={an} t={t} style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, flexDirection: "column", alignItems: "center", fontFamily: HAND, color }}>
      {g.lines.map((x, i) => <div key={i} style={box({ fontSize: g.size, fontWeight: 600, lineHeight: 1.3 })}>{x}</div>)}
    </El>
  );
}

/** the line's geometry: as many lines as it needs, `w` wide at its place `y` */
function lineGeo(text: string, x: number, y: number, w: number, cap: number) {
  const p = setPhrase(text, w - 40, cap, 2);
  return { x, y, w, size: p.size, lines: p.lines, h: Math.round(p.lines.length * p.size * 1.3) };
}

/* ---------- ipdopd: สองประตู ผู้ป่วยใน ผู้ป่วยนอก ---------- */

/** a door's own sheet, in its units */
export const DOOR = { w: 200, h: 270 };

/** how far each door is open at t (0 closed, 1 open); the second stays shut when the plan has no OPD */
export function ipdopdAt(s: Record<string, Anim>, show: Health2Show<"ipdopd">, t: number) {
  return { open: [look(s.door0, t).p, show.opd === "none" ? 0 : look(s.door1, t).p] };
}

/** the card of one door: its name, then the figure (or the words that stand for it) */
function doorBlocks(kind: 0 | 1, show: Health2Show<"ipdopd">, inner: number, text: number, f: number): Blk[] {
  const color = kind === 0 ? BLUE : GREEN;
  const head = one(kind === 0 ? W.inpatient : W.outpatient, inner, text * 1.25 * f, color, 700);
  if (kind === 0) return [head, one(W.room, inner, text * 0.95 * f, C.ink, 600), one(`${n(show.room)} ${W.perDay}`, inner, text * 1.6 * f, color, 700)];
  if (show.opd === "none") return [head, phrase(W.noOpd, inner, text * 1.15 * f, C.ink, 700)];
  if (show.opd === "actual") return [head, phrase(W.actual, inner, text * 1.5 * f, color, 700, 1)];
  return [head, one(W.opdLimit, inner, text * 0.95 * f, C.ink, 600), one(`${n(show.opd)} ${W.baht}`, inner, text * 1.6 * f, color, 700)];
}

/** where the two doors stand with their cards, the plan's name over them, the line and the note under */
export function ipdopdGeo(size: VideoSize, show: Health2Show<"ipdopd">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.4);
  const padChip = Math.round(text * 0.4);
  let planSize = Math.round(text * 1.1);
  while (show.planName && planSize > 10 && handWidth(show.planName, planSize) + padChip * 2 + 8 > r.w * 0.8) planSize -= 1;
  const plan = show.planName ? (() => { const w = Math.ceil(handWidth(show.planName!, planSize)) + padChip * 2 + 8; const h = Math.round(planSize * 1.3) + padChip + 8; return { text: show.planName!, size: planSize, pad: padChip, w, h, x: r.x + Math.round((r.w - w) / 2), y: r.y }; })() : null;
  const ln = show.opd === "none" ? null : lineGeo(W.opdIncludes, r.x, 0, r.w, Math.round(text * 0.95));
  const lineBlock = ln ? ln.h + gap : 0;
  const top = r.y + (plan ? plan.h + gap : 0);
  const bottom = r.y + r.h - noteBlock - lineBlock;
  const body = { x: r.x, y: top, w: r.w, h: bottom - top };
  const side = r.w / r.h > 2;
  const gapC = Math.round(text * 0.7);
  const cells: Rect[] = side
    ? [0, 1].map((i) => { const w = Math.floor((body.w - gapC) / 2); return { x: body.x + i * (w + gapC), y: body.y, w, h: body.h }; })
    : [0, 1].map((i) => { const h = Math.floor((body.h - gap) / 2); return { x: body.x, y: body.y + i * (h + gap), w: body.w, h }; });
  const pad = Math.round(text * 0.4);
  const doors = cells.map((cell, i) => {
    const k = Math.min(cell.h / DOOR.h, (cell.w * 0.36) / DOOR.w);
    const door = { x: cell.x + 4, y: cell.y + Math.round((cell.h - DOOR.h * k) / 2), w: Math.round(DOOR.w * k), h: Math.round(DOOR.h * k), k };
    const cx = cell.x + door.w + gapC;
    const cardW = cell.x + cell.w - cx;
    const inner = cardW - pad * 2 - 8;
    let blocks: Blk[] = [];
    for (let f = 1; f > 0.3; f -= 0.04) {
      blocks = doorBlocks(i as 0 | 1, show, inner, text, f);
      if (blocks.reduce((h, b) => h + blkH(b), 0) + pad * 2 + 8 <= cell.h) break;
    }
    const content = blocks.reduce((h, b) => h + blkH(b), 0) + pad * 2 + 8;
    return { cell, door, card: { x: cx, y: cell.y, w: cardW, h: cell.h, pad, inner, blocks, content }, color: i === 0 ? BLUE : GREEN };
  });
  const lineAt = ln ? { ...ln, y: bottom + gap } : null;
  return { plan, doors, line: lineAt, side, note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null };
}

/** the door on its sheet: its frame, what is inside (a bed, a cross), and the leaf swung `open` (0 to 1) toward the hinge */
function DoorSvg({ color, tint, open, kind }: { color: string; tint: string; open: number; kind: 0 | 1 }) {
  const e = ease(open);
  const rx = 14 + 172 * (1 - 0.8 * e);
  const dy = 18 * e;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${DOOR.w} ${DOOR.h}`}>
      <rect x={14} y={10} width={172} height={250} rx={8} fill={tint} />
      {e > 0.15 ? (
        <g opacity={clamp01((e - 0.15) * 1.6)}>
          {kind === 0 ? (
            <>
              <rect x={46} y={106} width={10} height={64} rx={3} fill={C.ink} />
              <rect x={56} y={132} width={96} height={24} rx={6} fill={C.white} stroke={C.ink} strokeWidth={3} />
              <rect x={88} y={132} width={64} height={24} rx={6} fill={BLUE} stroke={C.ink} strokeWidth={3} />
              <ellipse cx={74} cy={126} rx={15} ry={8} fill={C.white} stroke={C.ink} strokeWidth={3} />
              <rect x={56} y={156} width={96} height={8} fill={C.ink} />
              <rect x={146} y={156} width={8} height={16} fill={C.ink} />
            </>
          ) : (
            <>
              <path d="M100 100 V176 M62 138 H138" stroke={C.ink} strokeWidth={30} strokeLinecap="round" fill="none" />
              <path d="M100 100 V176 M62 138 H138" stroke={C.white} strokeWidth={20} strokeLinecap="round" fill="none" />
            </>
          )}
        </g>
      ) : null}
      <polygon points={`14,10 ${rx.toFixed(1)},${(10 + dy).toFixed(1)} ${rx.toFixed(1)},${(260 - dy).toFixed(1)} 14,260`} fill={color} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      <rect x={14 + (rx - 14) * 0.2} y={42 + dy * 0.3} width={(rx - 14) * 0.6} height={62 - dy * 0.6} rx={6} fill={C.white} opacity={0.55} />
      <circle cx={rx - 14} cy={150} r={7} fill={C.coin} stroke={C.ink} strokeWidth={3} />
      <rect x={14} y={10} width={172} height={250} rx={8} fill="none" stroke={C.ink} strokeWidth={5} />
      <path d="M2 264 H198" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}

/** สองประตู: the blue door of ผู้ป่วยใน opens and its card follows, then the green door of ผู้ป่วยนอก; the line last */
function IpdOpd({ d, show }: { d: Dev; show: Health2Show<"ipdopd"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = ipdopdGeo(c.size, show);
  const at = ipdopdAt(s, show, t);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.plan ? (
        <El an={s.title} t={t} style={{ position: "absolute", left: geo.plan.x, top: geo.plan.y, width: geo.plan.w, height: geo.plan.h, justifyContent: "center", alignItems: "center", background: C.note, border: `4px solid ${C.ink}`, borderRadius: 999, fontFamily: HAND, fontSize: geo.plan.size, fontWeight: 700, lineHeight: 1.3, color: C.ink }}>{geo.plan.text}</El>
      ) : null}
      {geo.doors.map((dr, i) => (
        <Fragment key={i}>
          <div data-part={`door${i}`} style={abs({ left: dr.door.x, top: dr.door.y, width: dr.door.w, height: dr.door.h })}>
            <DoorSvg color={i === 1 && show.opd === "none" ? C.struck : dr.color} tint={i === 0 ? C.blanket : C.tiles[1]} open={at.open[i]} kind={i as 0 | 1} />
          </div>
          <CardAt an={s[`card${i}`]} t={t} r={dr.card} pad={dr.card.pad} tilt={i === 0 ? -0.8 : 0.8} part={`card${i}`}>
            <Blocks blocks={dr.card.blocks} />
          </CardAt>
        </Fragment>
      ))}
      {geo.line ? <LineBlock an={s.line} t={t} g={geo.line} color={ink} /> : null}
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- deductible: ส่วนรับผิดชอบแรก ---------- */

/** what the bill splits into: ours up to the deductible, the insurer's the rest (never negative); none of it without a bill */
export function deductibleParts(show: Health2Show<"deductible">) {
  const bill = show.bill !== undefined && show.bill > 0 ? show.bill : undefined;
  if (bill === undefined) return { bill, ours: undefined, theirs: undefined, below: false, frac: 0.4 };
  const ours = Math.min(bill, show.deductible);
  const theirs = Math.max(0, bill - show.deductible);
  return { bill, ours, theirs, below: bill <= show.deductible, frac: ours / bill };
}

/** how much of the bar, our part and the insurer's part is drawn at t (0 to 1 each) */
export function deductibleAt(s: Record<string, Anim>, t: number) {
  return { bill: look(s.bill, t).p, ours: look(s.ours, t).p, theirs: look(s.theirs, t).p };
}

/** where the bill bar stands: the bar to one scale (the split at the deductible), the amounts under each part, the card */
export function deductibleGeo(size: VideoSize, show: Health2Show<"deductible">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const parts = deductibleParts(show);
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.55);
  const W0 = r.w - 40;
  const x0 = r.x + 20;
  const barH = Math.round(text * 2.6);
  // the split: to scale, a few pixels at least so a small part is still seen
  const hasGreen = parts.theirs !== undefined ? parts.theirs > 0 : true;
  let goldW = parts.below ? W0 : Math.round(W0 * parts.frac);
  if (!parts.below && parts.ours !== undefined && parts.ours > 0) goldW = clamp(goldW, 14, W0 - 14);
  const greenW = hasGreen ? W0 - goldW : 0;
  // a label's size: the largest at which both fit side by side under the bar
  const names: [string, string] = [W.weOwn, W.insurerPays];
  const amounts: [string | undefined, string | undefined] = [parts.ours === undefined ? undefined : n(parts.ours), parts.theirs === undefined || !hasGreen ? undefined : n(parts.theirs)];
  const labelW = (i: 0 | 1, ns: number, as: number) => Math.ceil(Math.max(handWidth(names[i], ns), amounts[i] ? figWidth(`${amounts[i]} ${W.baht}`, as) : 0));
  let nameSize = Math.round(text * 1.05);
  let amtSize = Math.round(text * 1.45);
  while (amtSize > 12 && labelW(0, nameSize, amtSize) + (hasGreen ? labelW(1, nameSize, amtSize) : 0) + 24 > W0) { amtSize -= 1; nameSize = Math.min(nameSize, Math.round(amtSize * 0.8)); }
  const lw = [labelW(0, nameSize, amtSize), labelW(1, nameSize, amtSize)];
  const labelH = Math.round(nameSize * 1.3 + (amounts[0] ? amtSize * 1.3 : 0));
  const goldC = x0 + goldW / 2;
  const greenC = x0 + goldW + greenW / 2;
  let gx = clamp(Math.round(goldC - lw[0] / 2), x0, x0 + W0 - lw[0]);
  let rx = clamp(Math.round(greenC - lw[1] / 2), x0, x0 + W0 - lw[1]);
  if (hasGreen && gx + lw[0] + 16 > rx) { gx = x0; rx = x0 + W0 - lw[1]; }
  const tick = 22;
  // the bar's own caption: the bill's total, over its left end
  const billSize = Math.round(text * 1.0);
  const billH = parts.bill !== undefined ? Math.round(billSize * 1.3) + 8 : 0;
  // the "not yet" line, only when the bill stays inside our part
  const notYet = parts.below ? lineGeo(W.notYet, r.x, 0, r.w, Math.round(text * 1.0)) : null;
  // the card
  const pad = Math.round(text * 0.4);
  const cardW = Math.min(r.w - 40, 760);
  const inner = cardW - pad * 2 - 8;
  const cardBlocks: Blk[] = [phrase(W.deductibleCard, inner, text * 1.05, C.ink, 600, 1), one(`${n(show.deductible)} ${W.perYear}`, inner, text * 1.6, C.ink, 700)];
  const cardH = cardBlocks.reduce((h, b) => h + blkH(b), 0) + pad * 2 + 8;
  const groupH = billH + barH + tick + labelH + (notYet ? gap + notYet.h : 0) + gap * 1.5 + cardH;
  const area = r.h - noteBlock;
  const y0 = r.y + Math.max(0, Math.round((area - groupH) / 2));
  const barY = y0 + billH;
  const labelY = barY + barH + tick;
  const notYetY = labelY + labelH + gap;
  const cardY = (notYet ? notYetY + notYet.h : labelY + labelH) + Math.round(gap * 1.5);
  const seg = (i: 0 | 1) => (i === 0 ? { x: x0, w: goldW } : { x: x0 + goldW, w: greenW });
  const lab = (i: 0 | 1, lx: number) => {
    const sg = seg(i);
    const lo = Math.max(sg.x, lx);
    const hi = Math.min(sg.x + sg.w, lx + lw[i]);
    return { x: lx, y: labelY, w: lw[i], h: labelH, name: names[i], amount: amounts[i] ? `${amounts[i]} ${W.baht}` : undefined, nameSize, amtSize, tickX: Math.round((lo + hi) / 2), color: i === 0 ? GOLD : GREEN, textColor: i === 0 ? C.ink : GREEN };
  };
  return {
    parts, goldW, greenW,
    bar: { x: x0, y: barY, w: W0, h: barH },
    bill: parts.bill !== undefined ? { text: `${W.bill} ${n(parts.bill)} ${W.baht}`, size: billSize, x: x0, y: y0, w: W0, h: billH } : null,
    labels: [lab(0, gx), ...(hasGreen ? [lab(1, rx)] : [])],
    tick: { y: barY + barH, h: tick },
    notYet: notYet ? { ...notYet, y: notYetY } : null,
    card: { x: r.x + Math.round((r.w - cardW) / 2), y: cardY, w: cardW, h: cardH, pad, inner, blocks: cardBlocks },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** ส่วนรับผิดชอบแรก: the bill bar, our part gold up to the deductible then the insurer's green, to scale; amounts only when a bill was given */
function Deductible({ d, show }: { d: Dev; show: Health2Show<"deductible"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = deductibleGeo(c.size, show);
  const at = deductibleAt(s, t);
  const b = geo.bar;
  const inner = { x: b.x + 4, y: b.y + 4, h: b.h - 8 };
  const goldNow = Math.round(Math.max(0, geo.goldW - 4) * at.ours);
  const greenNow = Math.round((geo.greenW - (geo.goldW === b.w ? 0 : 0)) * at.theirs);
  const bothDone = at.ours >= 1 && at.theirs >= 1 && geo.greenW > 0;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.bill ? <div data-part="bill" style={abs({ left: geo.bill.x, top: geo.bill.y, width: geo.bill.w, height: geo.bill.h, fontFamily: HAND, fontSize: geo.bill.size, fontWeight: 700, lineHeight: 1.3, color: ink, opacity: at.bill > 0 ? 1 : 0 })}>{geo.bill.text}</div> : null}
      <div data-part="trough" style={abs({ left: b.x, top: b.y, width: Math.round(b.w * at.bill), height: b.h, background: C.note, borderRadius: 14, opacity: at.bill > 0 ? 1 : 0 })} />
      {goldNow > 0 ? <div data-part="ours" style={abs({ left: inner.x, top: inner.y, width: goldNow, height: inner.h, background: GOLD })} /> : null}
      {geo.greenW > 0 && greenNow > 0 ? <div data-part="theirs" style={abs({ left: b.x + geo.goldW, top: inner.y, width: Math.min(greenNow, geo.greenW - 4), height: inner.h, background: GREEN })} /> : null}
      <div style={abs({ left: b.x, top: b.y, width: Math.round(b.w * at.bill), height: b.h, border: `4px solid ${C.ink}`, borderRadius: 14, opacity: at.bill > 0 ? 1 : 0 })} />
      {bothDone ? (
        <div data-part="split" style={abs({ left: b.x + geo.goldW - 2, top: b.y - 10, width: 4, height: b.h + 20 })}>
          <svg width={4} height={b.h + 20} viewBox={`0 0 4 ${b.h + 20}`}><line x1={2} y1={0} x2={2} y2={b.h + 20} stroke={C.ink} strokeWidth={4} strokeDasharray="8 6" /></svg>
        </div>
      ) : null}
      {geo.labels.map((l, i) => {
        const p = i === 0 ? at.ours : at.theirs;
        return (
          <Fragment key={i}>
            <div data-part={i === 0 ? "tick-ours" : "tick-theirs"} style={abs({ left: l.tickX - 3, top: geo.tick.y, width: 6, height: geo.tick.h, background: l.color, opacity: p > 0 ? 1 : 0 })} />
            <div data-part={i === 0 ? "label-ours" : "label-theirs"} style={abs({ left: l.x, top: l.y, width: l.w, height: l.h, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: l.textColor, opacity: p > 0 ? 1 : 0 })}>
              <div style={box({ fontSize: l.nameSize, fontWeight: 700, lineHeight: 1.3, color: l.textColor })}>{l.name}</div>
              {l.amount ? <div style={box({ fontSize: l.amtSize, fontWeight: 700, lineHeight: 1.3, color: l.textColor, whiteSpace: "nowrap" })}>{l.amount}</div> : null}
            </div>
          </Fragment>
        );
      })}
      {geo.notYet ? <LineBlock an={s.theirs} t={t} g={geo.notYet} color={ink} /> : null}
      <CardAt an={s.card} t={t} r={geo.card} pad={geo.card.pad} tilt={-0.8} part="card"><Blocks blocks={geo.card.blocks} /></CardAt>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- copay: ร่วมจ่าย ---------- */

/** how the bill splits at the sheet's percent: ours is the floor (computed, never supplied); the insurer pays the rest */
export function copaySplit(show: Health2Show<"copay">) {
  if (show.bill === undefined || !(show.bill > 0)) return null;
  const ours = Math.floor((show.bill * show.percent) / 100);
  return { bill: show.bill, ours, theirs: show.bill - ours };
}

/** how much of the dashed cut is drawn, and whether each part has come in, at t */
export function copayAt(s: Record<string, Anim>, t: number) {
  return { sheet: look(s.sheet, t).p, cut: look(s.cut, t).p, ours: look(s.ours, t).p, theirs: look(s.theirs, t).p };
}

/** where the bill sheet stands: the sheet split at the percent (to scale), the two labels beside it, the card */
export function copayGeo(size: VideoSize, show: Health2Show<"copay">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const split = copaySplit(show);
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.55);
  const row = r.w / r.h > 2;
  const pad = Math.round(text * 0.4);
  const area = { x: r.x, y: r.y, w: r.w, h: r.h - noteBlock };
  // the card: three short lines, only with a bill
  const cardW = row ? Math.min(Math.round(area.w * 0.36), 600) : Math.min(area.w - 40, 760);
  const inner = cardW - pad * 2 - 8;
  const cap = text * 1.15;
  const build = (f: number) => split ? [
    one(`${W.bill} ${n(split.bill)}`, inner, cap * f, C.ink, 700),
    one(`${W.weOwn} ${n(split.ours)}`, inner - Math.round(cap * f), cap * f, C.ink, 700),
    one(`${W.insurerPays} ${n(split.theirs)}`, inner, cap * f, GREEN, 700),
  ] : [];
  const cardBlocks = build(1);
  const cardH = split ? cardBlocks.reduce((h, b) => h + blkH(b), 0) + pad * 2 + 8 : 0;
  // the sheet and its labels
  const tabSize = Math.round(text * 0.95);
  const tabH = Math.round(tabSize * 1.4);
  const sheetArea = row
    ? { x: area.x, y: area.y, w: area.w - (split ? cardW + gap * 2 : 0), h: area.h }
    : { x: area.x, y: area.y, w: area.w, h: area.h - (split ? cardH + gap : 0) };
  const sh = Math.min(sheetArea.h - tabH - 8, Math.round(sheetArea.w * 0.8));
  const sw = Math.min(Math.round(sh * 0.74), Math.round(sheetArea.w * 0.4));
  const innerH = sh - 8;
  const oursH = clamp(Math.round((innerH * show.percent) / 100), show.percent > 0 ? 10 : 0, innerH);
  const theirsH = innerH - oursH;
  const hasTheirs = show.percent < 100;
  // labels: "เราจ่าย 20%" beside the top part, "ประกันจ่ายส่วนที่เหลือ" beside the rest
  const oursText = `${W.weOwn} ${show.percent}%`;
  const labelRoom = Math.max(120, sheetArea.w - sw - 60 - Math.round(text * 0.5));
  const oursB = one(oursText, labelRoom, text * 1.5, C.ink, 700);
  const theirsB = phrase(W.restPays, labelRoom, text * 1.15, GREEN, 700, 2);
  const oh = blkH(oursB);
  const th = hasTheirs ? blkH(theirsB) : 0;
  const bw = Math.max(figWidth(oursText, oursB.size), hasTheirs ? Math.max(...theirsB.lines.map((x) => handWidth(x, theirsB.size))) : 0);
  const groupW = sw + 28 + Math.ceil(bw);
  // in a wide room the sheet with its labels and the card are centred together
  const together = row && split ? groupW + gap * 2 + cardW : groupW;
  const sx = row && split ? area.x + Math.round((area.w - together) / 2) : sheetArea.x + Math.round((sheetArea.w - groupW) / 2);
  const sy = sheetArea.y + Math.round((sheetArea.h - (sh + tabH + 8)) / 2) + tabH + 8;
  const sheet = { x: sx, y: sy, w: sw, h: sh };
  const oursMid = sy + 4 + oursH / 2;
  const theirsMid = sy + 4 + oursH + theirsH / 2;
  const oy = clamp(Math.round(oursMid - oh / 2), sy, sy + sh - oh - (hasTheirs ? th + 12 : 0));
  const ty = clamp(Math.round(theirsMid - th / 2), oy + oh + 12, sy + sh - th);
  const lx = sx + sw + 28;
  const cardRect = split ? (row ? { x: sx + groupW + gap * 2, y: area.y + Math.round((area.h - cardH) / 2), w: cardW, h: cardH } : { x: area.x + Math.round((area.w - cardW) / 2), y: area.y + area.h - cardH, w: cardW, h: cardH }) : null;
  return {
    split, row, sheet, tab: { x: sx, y: sy - tabH - 8, w: sw, h: tabH, size: tabSize },
    ours: { y: sy + 4, h: oursH }, theirs: { y: sy + 4 + oursH, h: theirsH }, cutY: sy + 4 + oursH,
    bracket: { x: sx + sw + 10, w: 10 },
    labels: { ours: { x: lx, y: oy, h: oh, blk: oursB, w: Math.ceil(bw) }, theirs: hasTheirs ? { x: lx, y: ty, h: th, blk: theirsB, w: Math.ceil(bw) } : null },
    card: cardRect ? { ...cardRect, pad, inner, blocks: cardBlocks } : null,
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** an arrow from the bill to our part, in the card (drawn, not a letter the hand font may lack) */
const Arrow = ({ size, color }: { size: number; color: string }) => (
  <svg width={Math.round(size * 0.9)} height={Math.round(size * 0.7)} viewBox="0 0 36 28"><path d="M3 14 H29 M19 5 L30 14 L19 23" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
);

/** ร่วมจ่าย: a bill sheet cut by a dashed red line at the percent (to scale); what we pay at the top, the insurer's share below it */
function Copay({ d, show }: { d: Dev; show: Health2Show<"copay"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = copayGeo(c.size, show);
  const at = copayAt(s, t);
  const sh = geo.sheet;
  const lines = 7;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <div data-part="tab" style={abs({ left: geo.tab.x, top: geo.tab.y, width: geo.tab.w, height: geo.tab.h, justifyContent: "center", fontFamily: HAND, fontSize: geo.tab.size, fontWeight: 700, lineHeight: 1.3, color: ink, opacity: at.sheet > 0 ? 1 : 0 })}>{W.bill}</div>
      <Pop an={s.sheet} t={t} r={sh} part="sheet">
        <div style={abs({ left: 0, top: 0, width: sh.w, height: sh.h, background: C.note, border: `4px solid ${C.ink}`, borderRadius: 10 })} />
        {at.ours > 0 ? <div data-part="ours" style={abs({ left: 4, top: geo.ours.y - sh.y, width: sh.w - 8, height: geo.ours.h, background: GOLD, opacity: clamp01(at.ours * 2) })} /> : null}
        {at.theirs > 0 && geo.theirs.h > 0 ? <div data-part="theirs" style={abs({ left: 4, top: geo.theirs.y - sh.y, width: sh.w - 8, height: geo.theirs.h, background: GREEN, opacity: clamp01(at.theirs * 2) })} /> : null}
        <svg width={sh.w} height={sh.h} viewBox={`0 0 ${sh.w} ${sh.h}`} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: lines }, (_, i) => { const y = 4 + ((sh.h - 8) * (i + 1)) / (lines + 1); return <line key={i} x1={20} y1={y} x2={sh.w - 20} y2={y} stroke={C.ink} strokeWidth={3} opacity={0.18} strokeLinecap="round" />; })}
        </svg>
        <div style={abs({ left: 0, top: 0, width: sh.w, height: sh.h, border: `4px solid ${C.ink}`, borderRadius: 10 })} />
      </Pop>
      {at.cut > 0 ? (
        <div data-part="cut" style={abs({ left: sh.x - 16, top: geo.cutY - 5, width: sh.w + 32, height: 10 })}>
          <svg width={sh.w + 32} height={10} viewBox={`0 0 ${sh.w + 32} 10`}><line x1={0} y1={5} x2={Math.round((sh.w + 32) * at.cut)} y2={5} stroke={C.white} strokeWidth={10} strokeLinecap="round" opacity={0.9} /><line x1={0} y1={5} x2={Math.round((sh.w + 32) * at.cut)} y2={5} stroke={RED} strokeWidth={6} strokeLinecap="round" strokeDasharray="16 10" /></svg>
        </div>
      ) : null}
      {at.ours > 0 ? <div data-part="bracket-ours" style={abs({ left: geo.bracket.x, top: geo.ours.y + 2, width: geo.bracket.w, height: Math.max(4, geo.ours.h - 4), background: GOLD, border: `3px solid ${C.ink}`, borderRadius: 6, opacity: clamp01(at.ours * 2) })} /> : null}
      {at.theirs > 0 && geo.theirs.h > 0 ? <div data-part="bracket-theirs" style={abs({ left: geo.bracket.x, top: geo.theirs.y + 2, width: geo.bracket.w, height: Math.max(4, geo.theirs.h - 4), background: GREEN, border: `3px solid ${C.ink}`, borderRadius: 6, opacity: clamp01(at.theirs * 2) })} /> : null}
      <Pop an={s.ours} t={t} r={{ x: geo.labels.ours.x, y: geo.labels.ours.y, w: geo.labels.ours.w, h: geo.labels.ours.h }} part="label-ours">
        <div style={abs({ left: 0, top: 0, width: geo.labels.ours.w, flexDirection: "column", alignItems: "flex-start", fontFamily: HAND })}><Blocks blocks={[geo.labels.ours.blk]} align="flex-start" /></div>
      </Pop>
      {geo.labels.theirs ? (
        <Pop an={s.theirs} t={t} r={{ x: geo.labels.theirs.x, y: geo.labels.theirs.y, w: geo.labels.theirs.w, h: geo.labels.theirs.h }} part="label-theirs">
          <div style={abs({ left: 0, top: 0, width: geo.labels.theirs.w, flexDirection: "column", alignItems: "flex-start", fontFamily: HAND })}><Blocks blocks={[geo.labels.theirs.blk]} align="flex-start" /></div>
        </Pop>
      ) : null}
      {geo.card ? (
        <CardAt an={s.card} t={t} r={geo.card} pad={geo.card.pad} tilt={0.8} part="card">
          <div style={box({ flexDirection: "column", alignItems: "center" })}>
            <Blocks blocks={[geo.card.blocks[0]]} />
            <div style={box({ alignItems: "center", justifyContent: "center", marginTop: 2 })}>
              <Arrow size={geo.card.blocks[1].size} color={C.ink} />
              <div style={box({ width: Math.round(geo.card.blocks[1].size * 0.25) })} />
              <Blocks blocks={[geo.card.blocks[1]]} />
            </div>
            <Blocks blocks={[geo.card.blocks[2]]} />
          </div>
        </CardAt>
      ) : null}
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- renew98: ต่ออายุได้ถึง ---------- */

/** how far the timeline, its dashed arc, and the two marks are drawn at t */
export function renewAt(s: Record<string, Anim>, t: number) {
  return { line: look(s.line, t).p, arc: look(s.arc, t).p, today: look(s.today, t).p, to: look(s.to, t).p };
}

/** the age shown for today: only below the renewal age (a person at or past it has no timeline to show) */
export const renewAge = (show: Health2Show<"renew98">) => (show.age !== undefined && show.age < show.to ? show.age : undefined);

/** a point on the dashed arc (a quadratic from one mark to the other) at fraction u */
export function arcPoint(g: { x1: number; x2: number; y: number; peak: number }, u: number) {
  const cx = (g.x1 + g.x2) / 2;
  const cy = g.y - g.peak * 2;
  return { x: (1 - u) * (1 - u) * g.x1 + 2 * (1 - u) * u * cx + u * u * g.x2, y: (1 - u) * (1 - u) * g.y + 2 * (1 - u) * u * cy + u * u * g.y };
}

/** where the timeline stands: today's mark at the left, the renewal age at the right, the arc over them, the card under */
export function renewGeo(size: VideoSize, show: Health2Show<"renew98">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const age = renewAge(show);
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const area = r.h - noteBlock;
  const gap = Math.round(text * 0.5);
  const pad = Math.round(text * 0.4);
  const cardW = Math.min(r.w - 40, 760);
  const inner = cardW - pad * 2 - 8;
  const DOT = Math.round(text * 0.5);
  const build = (f: number) => {
    const todayBlocks: Blk[] = [one(W.today, r.w * 0.4, text * 1.2 * f, C.ink, 700), ...(age !== undefined ? [one(`อายุ ${age}`, r.w * 0.4, text * 1.1 * f, C.ink, 600)] : [])];
    const toBlocks: Blk[] = [one(W.renewTo.split(" ")[0], r.w * 0.5, text * 0.95 * f, C.ink, 600), one(`${W.renewTo.split(" ")[1]} ${show.to}`, r.w * 0.5, text * 1.6 * f, GREEN, 700)];
    const cardBlocks: Blk[] = [phrase(W.notBeyond, inner, text * 1.1 * f, C.ink, 700), phrase(W.byAge, inner, text * 1.1 * f, GREEN, 700)];
    return { todayBlocks, toBlocks, cardBlocks };
  };
  let f = 1;
  let parts = build(1);
  const labelH = (bs: Blk[]) => bs.reduce((h, b) => h + blkH(b), 0);
  const heights = (p: typeof parts) => ({ labels: Math.max(labelH(p.todayBlocks), labelH(p.toBlocks)), card: labelH(p.cardBlocks) + pad * 2 + 8 });
  const arcMin = Math.round(text * 1.2);
  for (; f > 0.4; f -= 0.04) {
    parts = build(f);
    const h = heights(parts);
    if (arcMin + DOT * 2 + gap + h.labels + gap * 1.5 + h.card <= area) break;
  }
  const h = heights(parts);
  const wToday = Math.ceil(Math.max(...parts.todayBlocks.map((b) => Math.max(...b.lines.map((x) => figWidth(x, b.size))))));
  const wTo = Math.ceil(Math.max(...parts.toBlocks.map((b) => Math.max(...b.lines.map((x) => figWidth(x, b.size))))));
  const m = Math.round(Math.max(wToday, wTo) / 2) + 12;
  const x1 = r.x + m;
  const x2 = r.x + r.w - m;
  const rest = DOT * 2 + gap + h.labels + Math.round(gap * 1.5) + h.card;
  const peak = clamp(Math.min(Math.round((x2 - x1) * 0.2), area - rest), arcMin, Math.round(r.h * 0.3));
  const total = peak * 2 + rest - peak; // the arc's visible height is its peak (a quadratic reaches half its control's lift)
  const y0 = r.y + Math.max(0, Math.round((area - (peak + rest)) / 2));
  const lineY = y0 + peak + DOT;
  const labelsY = lineY + DOT + gap;
  const cardY = labelsY + h.labels + Math.round(gap * 1.5);
  void total;
  return {
    age, f, x1, x2, lineY, dot: DOT, peak,
    arc: { x1, x2, y: lineY - DOT, peak },
    today: { x: x1 - Math.round(wToday / 2) - 6, y: labelsY, w: wToday + 12, blocks: parts.todayBlocks },
    to: { x: x2 - Math.round(wTo / 2) - 6, y: labelsY, w: wTo + 12, blocks: parts.toBlocks },
    labelsH: h.labels,
    card: { x: r.x + Math.round((r.w - cardW) / 2), y: cardY, w: cardW, h: h.card, pad, inner, blocks: parts.cardBlocks },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** ต่ออายุได้ถึง: a timeline from วันนี้ to the renewal age, a dashed arc over it, and what the renewal is bound by */
function Renew({ d, show }: { d: Dev; show: Health2Show<"renew98"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = renewGeo(c.size, show);
  const at = renewAt(s, t);
  const D = geo.dot;
  const pts = Array.from({ length: 41 }, (_, i) => arcPoint(geo.arc, (i / 40) * at.arc));
  const x0 = geo.x1 - D - 6;
  const arcPath = at.arc > 0 ? `M${pts.map((p) => `${(p.x - x0).toFixed(1)} ${(p.y - (geo.arc.y - geo.arc.peak - 6)).toFixed(1)}`).join(" L")}` : "";
  const svgW = geo.x2 - geo.x1 + (D + 6) * 2;
  const svgH = geo.peak + D * 2 + 12;
  const top = geo.arc.y - geo.arc.peak - 6;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <div data-part="timeline" style={abs({ left: x0, top, width: svgW, height: svgH })}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <line x1={D + 6} y1={geo.lineY - top} x2={D + 6 + (geo.x2 - geo.x1) * at.line} y2={geo.lineY - top} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
          {arcPath ? <path d={arcPath} fill="none" stroke={GREEN} strokeWidth={6} strokeLinecap="round" strokeDasharray="16 12" /> : null}
        </svg>
      </div>
      <Pop an={s.today} t={t} r={{ x: geo.x1 - D, y: geo.lineY - D, w: D * 2, h: D * 2 }} part="dot-today">
        <div style={box({ width: D * 2, height: D * 2, borderRadius: D, background: GOLD, border: `4px solid ${C.ink}` })} />
      </Pop>
      <Pop an={s.to} t={t} r={{ x: geo.x2 - D, y: geo.lineY - D, w: D * 2, h: D * 2 }} part="dot-to">
        <div style={box({ width: D * 2, height: D * 2, borderRadius: D, background: GREEN, border: `4px solid ${C.ink}` })} />
      </Pop>
      <Pop an={s.today} t={t} r={{ x: geo.today.x, y: geo.today.y, w: geo.today.w, h: geo.labelsH }} part="label-today">
        <div style={abs({ left: 0, top: 0, width: geo.today.w, justifyContent: "center", fontFamily: HAND })}><Blocks blocks={geo.today.blocks} /></div>
      </Pop>
      <Pop an={s.to} t={t} r={{ x: geo.to.x, y: geo.to.y, w: geo.to.w, h: geo.labelsH }} part="label-to">
        <div style={abs({ left: 0, top: 0, width: geo.to.w, justifyContent: "center", fontFamily: HAND })}><Blocks blocks={geo.to.blocks} /></div>
      </Pop>
      <CardAt an={s.card} t={t} r={geo.card} pad={geo.card.pad} tilt={-0.8} part="card"><Blocks blocks={geo.card.blocks} /></CardAt>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- the people (parentshealth, groupcost) ---------- */

/** a person's box is this much taller than wide (a doll is about half as wide as it is tall, so the box fits it) */
const TALL = 1.7;
/** the older generation the parents are drawn as, and the six colleagues of a group */
const PARENT_FACES = ["e01", "e02"];
const STAFF_FACES = ["m02", "w03", "m06", "w07", "m10", "w11"];
/** person `i` of a row comes in a moment after the one before it */
const enter = (an: Anim | undefined, i: number): Anim | undefined => (an ? { ...an, at: an.at + i * 0.1, dur: 0.4 } : undefined);

/** someone standing in `r`, popping in on `an` */
function Who({ c, id, r, t, an, part }: { c: StoryContext; id: string; r: Rect; t: number; an?: Anim; part: string }) {
  const l = look(an, t);
  return (
    <div data-part={part} data-face={id} style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>
      <Pic c={c} id={id} r={{ x: 0, y: 0, w: r.w, h: r.h }} pose="stand" t={t} />
    </div>
  );
}

/** a caption under a picture: the hand's words, centred on `cx`, kept in the room */
function capRect(text: string, size: number, cx: number, y: number, room: Rect) {
  const w = Math.ceil(handWidth(text, size)) + 8;
  const x = clamp(Math.round(cx - w / 2), room.x, room.x + room.w - w);
  return { text, size, x, y, w, h: Math.round(size * 1.3) };
}
type Cap = ReturnType<typeof capRect>;
function Caption({ cap, an, t, color }: { cap: Cap; an?: Anim; t: number; color: string }) {
  return (
    <El an={an} t={t} style={{ position: "absolute", left: cap.x, top: cap.y, width: cap.w, height: cap.h, justifyContent: "center", fontFamily: HAND, fontSize: cap.size, fontWeight: 700, lineHeight: 1.3, color, whiteSpace: "nowrap" }}>{cap.text}</El>
  );
}

/* ---------- parentshealth: ประกันสุขภาพให้พ่อแม่ ---------- */

/** the tax foot: the words, then the table's year (a constant of the tax table, never a word field) */
export const parentsFoot = () => `${W.taxFoot} ${TAX_YEAR}`;

/** where the parents, the child who pays, the card and the tax foot stand (a wide room: the people left, the card right) */
export function parentsGeo(size: VideoSize, show: Health2Show<"parentshealth">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.5);
  const pad = Math.round(text * 0.4);
  const row = r.w / r.h > 2;
  const area = { x: r.x, y: r.y, w: r.w, h: r.h - noteBlock };
  const cardW = row ? Math.min(Math.round(area.w * 0.4), 600) : Math.min(area.w - 40, 760);
  const inner = cardW - pad * 2 - 8;
  const capSize = Math.round(text * 0.95);
  const capH = Math.round(capSize * 1.3);
  const peopleW = row ? Math.round(area.w * 0.54) : area.w - 40;
  // across: the two parents side by side, a gap for the arrow, the child
  const SPAN = 4.08;
  const build = (f: number) => {
    const cardBlocks: Blk[] = [phrase(W.taxCut, inner, text * 1.1 * f, C.ink, 700), one(`${W.upTo} ${n(show.cap)} ${W.baht}`, inner, text * 1.6 * f, GREEN, 700), phrase(W.bothParents, inner, text * 1.0 * f, C.ink, 600)];
    const foot = setPhrase(parentsFoot(), (row ? cardW + 40 : area.w) - 40, text * 0.9 * f, 2);
    return { cardBlocks, foot, cardH: cardBlocks.reduce((h, b) => h + blkH(b), 0) + pad * 2 + 8, footH: Math.round(foot.lines.length * foot.size * 1.3) };
  };
  let f = 1;
  let parts = build(1);
  let fw = 0;
  for (; f > 0.4; f -= 0.04) {
    parts = build(f);
    const left = row ? area.h : area.h - (parts.cardH + parts.footH + Math.round(gap * 2.5));
    fw = Math.min(Math.round(peopleW / SPAN), 340, Math.floor((left - capH - 8) / TALL));
    if (fw >= Math.round(text * 4)) break;
  }
  const figH = Math.round(fw * TALL);
  const peopleH = figH + 8 + capH;
  const x0 = area.x + 20 + Math.round((peopleW - SPAN * fw) / 2);
  const colH = row ? 0 : peopleH + Math.round(gap * 1.5) + parts.cardH + gap + parts.footH;
  const top = row ? area.y + Math.round((area.h - peopleH) / 2) : area.y + Math.max(0, Math.round((area.h - colH) / 2));
  const mk = (i: number, x: number) => ({ x: Math.round(x), y: top, w: fw, h: figH, id: i });
  const people = [mk(0, x0), mk(1, x0 + fw * 1.08), mk(2, x0 + fw * 3.08)];
  const pairC = Math.round(x0 + fw * 1.04);
  const childC = Math.round(x0 + fw * 3.58);
  const capY = top + figH + 8;
  const caps = { parents: capRect(W.insured, capSize, pairC, capY, area), child: capRect(W.childPays, capSize, childC, capY, area) };
  const arrow = { x: Math.round(x0 + fw * 2.08) + 6, y: top + Math.round(figH * 0.3), w: Math.round(fw * 1.0) - 12, h: Math.round(figH * 0.45) };
  const zoneX = row ? area.x + peopleW + 40 : area.x;
  const zoneW = row ? area.x + area.w - 20 - zoneX : area.w;
  const cardX = zoneX + Math.round((zoneW - cardW) / 2);
  const cardY = row ? area.y + Math.round((area.h - (parts.cardH + gap + parts.footH)) / 2) : top + peopleH + Math.round(gap * 1.5);
  const footY = cardY + parts.cardH + gap;
  const footW = row ? zoneW : area.w;
  return {
    row, f, fw, people, caps, arrow,
    card: { x: cardX, y: cardY, w: cardW, h: parts.cardH, pad, inner, blocks: parts.cardBlocks },
    foot: { x: zoneX, y: footY, w: footW, h: parts.footH, size: parts.foot.size, lines: parts.foot.lines },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** the arrow the child's money takes to the parents' cover, a gold coin on it (drawn, no letter the hand font may lack) */
function PayArrow({ w, h }: { w: number; h: number }) {
  const coin = Math.min(Math.round(h * 0.7), Math.round(w * 0.5));
  const y = h - 10;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={`M${w - 4} ${y} L14 ${y}`} stroke={C.ink} strokeWidth={6} strokeLinecap="round" fill="none" strokeDasharray="14 10" />
      <path d={`M26 ${y - 12} L10 ${y} L26 ${y + 12}`} stroke={C.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={Math.round(w / 2)} cy={Math.round(coin / 2) + 2} r={Math.round(coin / 2)} fill={GOLD} stroke={C.ink} strokeWidth={4} />
      <circle cx={Math.round(w / 2)} cy={Math.round(coin / 2) + 2} r={Math.round(coin / 4)} fill="none" stroke={C.ink} strokeWidth={3} />
    </svg>
  );
}

/** ประกันสุขภาพให้พ่อแม่: the parents (ผู้เอาประกัน), the child who pays (ลูกจ่ายเบี้ย), the tax card and its foot */
function Parents({ d, show }: { d: Dev; show: Health2Show<"parentshealth"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = parentsGeo(c.size, show);
  const faces = [PARENT_FACES[0], PARENT_FACES[1], c.input.faces.hero];
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.people.map((p) => <Who key={p.id} c={c} id={faces[p.id]} r={p} t={t} an={p.id === 2 ? s.child : enter(s.parents, p.id)} part={p.id === 2 ? "child" : `parent${p.id}`} />)}
      <Pop an={s.child} t={t} r={geo.arrow} part="arrow"><PayArrow w={geo.arrow.w} h={geo.arrow.h} /></Pop>
      <Caption cap={geo.caps.parents} an={s.parents} t={t} color={ink} />
      <Caption cap={geo.caps.child} an={s.child} t={t} color={GREEN} />
      <CardAt an={s.card} t={t} r={geo.card} pad={geo.card.pad} tilt={-0.8} part="card"><Blocks blocks={geo.card.blocks} /></CardAt>
      <LineBlock an={s.foot} t={t} g={geo.foot} color={ink} />
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- groupcost: ต้นทุนต่อหัว ประกันกลุ่ม ---------- */

/** what one head costs a month: the year's figure over twelve, to the baht below (computed, never supplied) */
export const groupMonth = (perYear: number) => Math.floor(perYear / 12);

/** where the six people, the head-count band and the two cards stand */
export function groupGeo(size: VideoSize, show: Health2Show<"groupcost">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.5);
  const pad = Math.round(text * 0.4);
  const area = { x: r.x, y: r.y, w: r.w, h: r.h - noteBlock };
  const bandText = show.band ? BAND_WORDS[show.band] : undefined;
  // a tall room stacks the two cards (the month's label then stays on one line); a wide one sets them side by side
  const stacked = r.h >= r.w * 0.9;
  const cw = stacked ? Math.min(area.w - 40, 640) : Math.min(Math.floor((area.w - 40 - gap) / 2), 560);
  const inner = cw - pad * 2 - 8;
  const month = groupMonth(show.perYear);
  const capSize = Math.round(text * 1.0);
  const capH = bandText ? Math.round(capSize * 1.3) : 0;
  const build = (f: number) => {
    const year: Blk[] = [phrase(W.perHeadYear, inner, text * 1.05 * f, C.ink, 600), one(`${n(show.perYear)} ${W.baht}`, inner, text * 1.6 * f, GREEN, 700)];
    const mon: Blk[] = [phrase(W.perHeadMonth, inner, text * 1.05 * f, C.ink, 600), one(`${n(month)} ${W.baht}`, inner, text * 1.6 * f, C.ink, 700)];
    const h = (bs: Blk[]) => bs.reduce((s, b) => s + blkH(b), 0) + pad * 2 + 8;
    return { year, mon, cardH: Math.max(h(year), h(mon)) };
  };
  let f = 1;
  let parts = build(1);
  let fw = 0;
  for (; f > 0.4; f -= 0.04) {
    parts = build(f);
    const cards = stacked ? parts.cardH * 2 + gap : parts.cardH;
    fw = Math.min(Math.round((area.w - 40) / 6.3), 260, Math.floor((area.h - cards - Math.round(gap * 1.5) - (capH ? capH + 8 : 0) - 8) / TALL));
    if (fw >= Math.round(text * 2.8)) break;
  }
  const figH = Math.round(fw * TALL);
  const rowW = Math.round(fw * 6.3);
  const groupH = figH + 8 + (capH ? capH + 8 : 0) + Math.round(gap * 1.5) + (stacked ? parts.cardH * 2 + gap : parts.cardH);
  const top = area.y + Math.max(0, Math.round((area.h - groupH) / 2));
  const x0 = area.x + Math.round((area.w - rowW) / 2);
  const people = Array.from({ length: 6 }, (_, i) => ({ x: x0 + Math.round(fw * 1.06 * i), y: top, w: fw, h: figH, id: i }));
  const band = bandText ? { ...capRect(bandText, capSize, area.x + Math.round(area.w / 2), top + figH + 8, area), w: Math.ceil(handWidth(bandText, capSize)) + 8 } : null;
  const bracket = { x: x0, y: top + figH + 2, w: rowW - Math.round(fw * 0.2) };
  const cardY = top + figH + 8 + (capH ? capH + 8 : 0) + Math.round(gap * 1.5);
  const cx0 = area.x + Math.round((area.w - (stacked ? cw : cw * 2 + gap)) / 2);
  return {
    f, fw, month, people, band, bracket, stacked,
    year: { x: cx0, y: cardY, w: cw, h: parts.cardH, pad, inner, blocks: parts.year },
    monthCard: stacked ? { x: cx0, y: cardY + parts.cardH + gap, w: cw, h: parts.cardH, pad, inner, blocks: parts.mon } : { x: cx0 + cw + gap, y: cardY, w: cw, h: parts.cardH, pad, inner, blocks: parts.mon },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** ต้นทุนต่อหัว ประกันกลุ่ม: six people, the head-count band under them (words from the code), the year's cost and the month's */
function Group({ d, show }: { d: Dev; show: Health2Show<"groupcost"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = groupGeo(c.size, show);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {geo.people.map((p) => <Who key={p.id} c={c} id={STAFF_FACES[p.id]} r={p} t={t} an={enter(s.people, p.id)} part={`staff${p.id}`} />)}
      {geo.band ? <Caption cap={geo.band} an={s.people} t={t} color={ink} /> : null}
      <CardAt an={s.year} t={t} r={geo.year} pad={geo.year.pad} tilt={-0.8} part="card-year"><Blocks blocks={geo.year.blocks} /></CardAt>
      <CardAt an={s.month} t={t} r={geo.monthCard} pad={geo.monthCard.pad} tilt={0.8} part="card-month"><Blocks blocks={geo.monthCard.blocks} /></CardAt>
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- hospitals: โรงพยาบาลในเครือ ---------- */

/** the date the hospital list was fetched, as the foot writes it (Thai month, Buddhist year) */
export const hospitalsFoot = () => `${W.asOf} ${thaiDate(HEALTH2_FIXED.hospitals.fetchedAt)}`;

/** a bar's length at its full growth: to one scale from zero; a province with one hospital still shows a few pixels */
export const barLength = (count: number, max: number, room: number) => (count <= 0 ? 0 : clamp(Math.round((room * count) / Math.max(max, 1)), 8, room));

/** where the provinces' bars, the total, the date and the line stand */
export function hospitalsGeo(size: VideoSize, show: Health2Show<"hospitals">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const rows = show.rows.slice(0, 5);
  if (rows.length === 0) throw new Error("hospitals needs one to five provinces");
  const wide = r.w / r.h > 2;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.45);
  const area = { x: r.x, y: r.y, w: r.w, h: r.h - noteBlock };
  const max = Math.max(1, ...rows.map((x) => x.count));
  const names = rows.map((x) => provinceShort(x.province));
  const head = one(`${n(show.total)} ${W.nationwide}`, r.w - 40, text * 1.6, GREEN, 700);
  const headH = blkH(head);
  // a wide, short room sets the date and the line side by side, so the names keep their size
  const half = Math.round(r.w / 2);
  const foot = setPhrase(hospitalsFoot(), (wide ? half : r.w) - 40, text * 0.9, 1);
  const footH = Math.round(foot.lines.length * foot.size * 1.3);
  const ln = lineGeo(W.fullList, wide ? r.x + half : r.x, 0, wide ? half : r.w, Math.round(text * 0.95));
  const tail = wide ? Math.max(footH, ln.h) : footH + Math.round(gap * 0.3) + ln.h;
  const build = (f: number) => {
    const cap = text * (wide ? 1.3 : 1.15) * f;
    let nameSize = Math.round(cap);
    const labelMax = Math.round((area.w - 40) * 0.4);
    while (nameSize > 10 && Math.max(...names.map((x) => handWidth(x, nameSize))) > labelMax) nameSize -= 1;
    const labelW = Math.ceil(Math.max(...names.map((x) => handWidth(x, nameSize))));
    const countSize = Math.max(10, Math.round(nameSize * 1.1));
    const countW = Math.ceil(Math.max(...rows.map((x) => figWidth(n(x.count), countSize)))) + 14;
    const rowH = Math.round(Math.max(nameSize, countSize) * 1.3) + 8;
    return { nameSize, labelW, countSize, countW, rowH };
  };
  let f = 1;
  let b = build(1);
  const stack = (k: ReturnType<typeof build>) => headH + gap + rows.length * k.rowH + (rows.length - 1) * Math.round(gap * (wide ? 0.2 : 0.4)) + gap + tail;
  for (; f > 0.7; f -= 0.04) {
    b = build(f);
    if (stack(b) <= area.h) break;
  }
  const rowGap = Math.round(gap * (wide ? 0.2 : 0.4));
  const total = stack(b);
  const y0 = area.y + Math.max(0, Math.round((area.h - total) / 2));
  const headRect = { x: r.x + 20, y: y0, w: r.w - 40, h: headH, blk: head };
  const barsY = y0 + headH + gap;
  const x0 = r.x + 20;
  const barX = x0 + b.labelW + 16;
  const barRoom = Math.max(40, area.x + area.w - 20 - barX - b.countW);
  const bars = rows.map((x, i) => {
    const y = barsY + i * (b.rowH + rowGap);
    const len = barLength(x.count, max, barRoom);
    return { name: names[i], full: x.province, count: x.count, countText: n(x.count), x: barX, y, w: len, h: b.rowH - 8, rowY: y, rowH: b.rowH, nameBox: { x: x0, y, w: b.labelW, h: b.rowH } };
  });
  const footY = barsY + rows.length * b.rowH + (rows.length - 1) * rowGap + gap;
  return {
    f, max, barRoom, barX, ...b, head: headRect, bars,
    foot: { x: r.x, y: footY, w: wide ? half : r.w, h: footH, size: foot.size, lines: foot.lines },
    line: { ...ln, y: wide ? footY : footY + footH + Math.round(gap * 0.3) },
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** โรงพยาบาลในเครือ: one bar a province to one scale from zero, the count at its end, the total over them, the date and the line under */
function Hospitals({ d, show }: { d: Dev; show: Health2Show<"hospitals"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = hospitalsGeo(c.size, show);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <El an={s.bar0} t={t} style={{ position: "absolute", left: geo.head.x, top: geo.head.y, width: geo.head.w, height: geo.head.h, justifyContent: "center", fontFamily: HAND }}><Blocks blocks={[geo.head.blk]} /></El>
      {geo.bars.map((bar, i) => {
        const p = look(s[`bar${i}`], t).p;
        const now = Math.round(bar.w * p);
        return (
          <Fragment key={bar.full + i}>
            <El an={s[`bar${i}`]} t={t} style={{ position: "absolute", left: bar.nameBox.x, top: bar.nameBox.y, width: bar.nameBox.w, height: bar.rowH, alignItems: "center", fontFamily: HAND, fontSize: geo.nameSize, fontWeight: 700, lineHeight: 1.3, color: ink, whiteSpace: "nowrap" }}>{bar.name}</El>
            {now > 0 ? <div data-part={`bar${i}`} style={abs({ left: bar.x, top: bar.y + 4, width: Math.max(now, 4), height: bar.h, background: GREEN, border: `4px solid ${C.ink}`, borderRadius: 10 })} /> : null}
            {p > 0 ? <div data-part={`count${i}`} style={abs({ left: bar.x + now + 10, top: bar.y, width: geo.countW, height: bar.rowH, alignItems: "center", fontFamily: HAND, fontSize: geo.countSize, fontWeight: 700, lineHeight: 1.3, color: ink, whiteSpace: "nowrap" })}>{bar.countText}</div> : null}
          </Fragment>
        );
      })}
      <LineBlock an={s.foot} t={t} g={geo.foot} color={ink} />
      <LineBlock an={s.line} t={t} g={geo.line} color={ink} />
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/* ---------- paclaim: อุบัติเหตุหนึ่งครั้ง ---------- */

/** where the treatment card, the weekly card and its weeks stand (a wide room: the treatment left, the weekly side right) */
export function paclaimGeo(size: VideoSize, show: Health2Show<"paclaim">, place: H2Place = health2Place(size)) {
  const r = place.room;
  const text = place.text;
  const note = noteGeo(show.note, r.w - 40, text);
  const noteBlock = note ? note.h + Math.round(text * 0.6) : 0;
  const gap = Math.round(text * 0.55);
  const pad = Math.round(text * 0.4);
  const area = { x: r.x, y: r.y, w: r.w, h: r.h - noteBlock };
  const weekly = show.weekly !== undefined;
  const weeks = weekly && show.weeks !== undefined;
  const row = area.w / area.h > 2 && weekly;
  const cardW = row ? Math.min(Math.round(area.w * 0.46), 640) : Math.min(area.w - 40, 760);
  const ic = Math.round(text * 2.1);
  const inner = cardW - pad * 3 - 8 - ic;
  const build = (f: number) => {
    const med: Blk[] = [phrase(W.perAccident, inner, text * 1.2 * f, C.ink, 600), one(`${n(show.medical)} ${W.baht}`, inner, text * 2.1 * f, GREEN, 700)];
    const wk: Blk[] = weekly ? [phrase(W.offWork, inner, text * 1.2 * f, C.ink, 600), one(`${n(show.weekly!)} ${W.baht}`, inner, text * 2.1 * f, C.ink, 700)] : [];
    const wkS = weeks ? one(`${W.atMost} ${show.weeks} ${W.weeks}`, cardW - pad * 2 - 8, text * 1.35 * f, C.ink, 700) : null;
    const h = (bs: Blk[]) => Math.max(bs.reduce((s, b) => s + blkH(b), 0), ic) + pad * 2 + 8;
    return { med, wk, wkS, medH: h(med), wkH: weekly ? h(wk) : 0, chipH: wkS ? blkH(wkS) + pad * 2 + 8 : 0 };
  };
  let f = 1;
  let parts = build(1);
  const col = (p: typeof parts) => p.medH + (weekly ? gap + p.wkH : 0) + (weeks ? Math.round(gap * 0.6) + p.chipH : 0);
  for (; f > 0.4; f -= 0.04) {
    parts = build(f);
    if ((row ? Math.max(parts.medH, parts.wkH + (weeks ? Math.round(gap * 0.6) + parts.chipH : 0)) : col(parts)) <= area.h) break;
  }
  const rect = (x: number, y: number, h: number) => ({ x, y, w: cardW, h, pad, inner, ic });
  let med; let wk = null; let chip = null;
  if (row) {
    const rightH = parts.wkH + (weeks ? Math.round(gap * 0.6) + parts.chipH : 0);
    const total = cardW * 2 + gap * 2;
    const lx = area.x + Math.round((area.w - total) / 2);
    med = rect(lx, area.y + Math.round((area.h - parts.medH) / 2), parts.medH);
    const ry = area.y + Math.round((area.h - rightH) / 2);
    wk = rect(lx + cardW + gap * 2, ry, parts.wkH);
    if (weeks) chip = { ...rect(lx + cardW + gap * 2, ry + parts.wkH + Math.round(gap * 0.6), parts.chipH) };
  } else {
    const total = col(parts);
    const x = area.x + Math.round((area.w - cardW) / 2);
    let y = area.y + Math.max(0, Math.round((area.h - total) / 2));
    med = rect(x, y, parts.medH);
    y += parts.medH + gap;
    if (weekly) { wk = rect(x, y, parts.wkH); y += parts.wkH + Math.round(gap * 0.6); }
    if (weeks) chip = rect(x, y, parts.chipH);
  }
  // the weeks chip is as wide as its words, centred under the weekly card
  const chipW = parts.wkS ? Math.min(cardW, Math.ceil(Math.max(...parts.wkS.lines.map((x) => figWidth(x, parts.wkS!.size)))) + pad * 2 + 24) : 0;
  const chipBox = chip && wk ? { ...chip, x: wk.x + Math.round((cardW - chipW) / 2), w: chipW, inner: chipW - pad * 2 - 8 } : null;
  return {
    row, f, ic,
    medical: { ...med, blocks: parts.med },
    weekly: wk ? { ...wk, blocks: parts.wk } : null,
    weeks: chipBox && parts.wkS ? { ...chipBox, blocks: [parts.wkS] } : null,
    note: note ? { x: r.x, y: r.y + r.h - note.h, w: r.w, ...note } : null,
  };
}

/** a first-aid cross in a green disc, drawn */
const CrossIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <circle cx={20} cy={20} r={18} fill="#ffffff" stroke={C.ink} strokeWidth={3} />
    <path d="M17 9 H23 V17 H31 V23 H23 V31 H17 V23 H9 V17 H17 Z" fill={GREEN} stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round" />
  </svg>
);
/** a week on a calendar page, drawn (a week, never a day: no day is picked out) */
const WeekIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <rect x={5} y={8} width={30} height={27} rx={4} fill="#ffffff" stroke={C.ink} strokeWidth={3} />
    <rect x={5} y={8} width={30} height={8} rx={3} fill={GOLD} stroke={C.ink} strokeWidth={3} />
    <path d="M10 24 H30" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" />
    <path d="M10 30 H30" stroke={C.ink} strokeWidth={2} strokeLinecap="round" strokeDasharray="4 4" />
  </svg>
);

/** อุบัติเหตุหนึ่งครั้ง: what the treatment may cost at most; when the plan has it, the weekly sum for the weeks off work and their most */
function PaClaim({ d, show }: { d: Dev; show: Health2Show<"paclaim"> }) {
  const { c, t, s, g, w, ink } = d;
  const geo = paclaimGeo(c.size, show);
  const withIcon = (icon: ReactNode, blocks: Blk[]) => (
    <div style={box({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: geo.medical.pad })}>
      <div style={box({ flexShrink: 0 })}>{icon}</div>
      <Blocks blocks={blocks} />
    </div>
  );
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <CardAt an={s.medical} t={t} r={geo.medical} pad={geo.medical.pad} tilt={-0.8} part="card-medical">{withIcon(<CrossIcon size={geo.ic} />, geo.medical.blocks)}</CardAt>
      {geo.weekly ? <CardAt an={s.weekly} t={t} r={geo.weekly} pad={geo.weekly.pad} tilt={0.8} part="card-weekly">{withIcon(<WeekIcon size={geo.ic} />, geo.weekly.blocks)}</CardAt> : null}
      {geo.weeks ? <CardAt an={s.weeks} t={t} r={geo.weeks} pad={geo.weeks.pad} tilt={-0.5} part="card-weeks"><Blocks blocks={geo.weeks.blocks} /></CardAt> : null}
      <NoteLines n={geo.note} an={s.note} t={t} ink={ink} />
    </>
  );
}

/** a round-5 health device's frame body at scene time t (showBody hands it the frame, the movements, where things stand, the ink); the eight are drawn here (Task 4 draws them again in the info route) */
export function health2Body(show: Health2Show, d: Dev) {
  switch (show.layout) {
    case "ipdopd": return <IpdOpd d={d} show={show} />;
    case "deductible": return <Deductible d={d} show={show} />;
    case "copay": return <Copay d={d} show={show} />;
    case "renew98": return <Renew d={d} show={show} />;
    case "parentshealth": return <Parents d={d} show={show} />;
    case "groupcost": return <Group d={d} show={show} />;
    case "hospitals": return <Hospitals d={d} show={show} />;
    case "paclaim": return <PaClaim d={d} show={show} />;
    default: return null;
  }
}
