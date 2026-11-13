import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import type React from "react";
import { a, abs, box, El, look, stroke, type Anim } from "./motion";
import { fitSize } from "./recipe-blocks";
import { HEALTH_WORDS as HW, n, type KnowShow } from "./story-knowledge";
import { Note, Pointer, Title, type Geo, type Rect } from "./story-knowledge-motion";
import { fitHand, line, paper, type StoryContext } from "./story-motion";
import { countAt, type VideoSize } from "./timeline";

/**
 * ชุดประกันสุขภาพ (scene library, mockup https://claude.ai/artifact/JdWaEEaNLGbjUU3SZbPa5T): the health devices
 * story-knowledge-motion.tsx's showBody draws through healthBody — แยกจ่าย's capped bars beside เหมาจ่าย's one bar,
 * the year's limit as a tube filling, the room a night against what the plan pays, and a bill rising past the
 * limit. Their figures come in on the show (story-knowledge.ts says what each is given); every fixed word is in
 * HEALTH_WORDS, so the hand font carries it.
 */

const C = STORY_CLIP_COLORS;
const HAND = "Mali";
const GREEN = C.green;

type HealthShow = Extract<KnowShow, { layout: "split" | "limit" | "room" | "overflow" | "waiting" | "cashless" | "groupgap" | "agecost" }>;

/** the few things a device shows, in the order they come in */
export function healthSpec(show: HealthShow): Record<string, Anim> {
  const s: Record<string, Anim> = {};
  switch (show.layout) {
    case "split":
      s.title = a(0.2, "up");
      s.apart = a(0.5, "pop");
      splitParts(show).forEach((_, i) => { s[`part${i}`] = a(0.9 + i * 0.3, "grow"); });
      s.lump = a(1.3 + splitParts(show).length * 0.3, "pop");
      s.whole = a(1.7 + splitParts(show).length * 0.3, "grow");
      s.foot = a(2.8 + splitParts(show).length * 0.3, "fade");
      return s;
    case "limit":
      return {
        title: a(0.2, "up"), tube: a(0.5, "pop"), top: a(0.9, "up"),
        // nothing used: the tube stands empty, nothing fills it
        ...(show.used !== undefined ? { fill: a(1.3, "grow", 1.2), used: a(1.8, "pop"), count: a(1.8, "count"), left: a(2.6, "pop") } : {}),
      };
    case "room":
      return show.real !== undefined
        ? { title: a(0.2, "up"), bed: a(0.5, "pop"), card: a(0.9, "pop"), real: a(1.3, "left"), plan: a(1.7, "left"), own: a(2.3, "pop"), count: a(2.3, "count") }
        : { title: a(0.2, "up"), bed: a(0.5, "pop"), card: a(0.9, "pop"), plan: a(1.3, "left"), words: a(1.9, "up") };
    case "overflow":
      return overflowBar(show)
        ? { title: a(0.2, "up"), paid: a(0.5, "grow"), bill: a(0.7, "left"), insurer: a(1.1, "left"), line: a(1.4, "fade"), over: a(1.8, "grow"), own: a(2.3, "pop"), count: a(2.3, "count"), foot: a(3.2, "fade") }
        : { title: a(0.2, "up"), card: a(0.6, "pop") };
    case "waiting":
      if (!show.rows.length) return { title: a(0.2, "up"), card: a(0.6, "pop") };
      s.title = a(0.2, "up");
      s.line = a(0.5, "stroke", 0.4 + show.rows.length * 0.35);
      show.rows.forEach((_, i) => { s[`row${i}`] = a(0.6 + i * 0.35, "pop"); });
      s.card = a(1.1 + show.rows.length * 0.35, "pop");
      return s;
    case "cashless":
      return { title: a(0.2, "up"), hosp: a(0.5, "pop"), card: a(0.9, "left"), tick: a(1.4, "pop"), word: a(1.9, "up"), note: a(2.3, "fade") };
    case "groupgap":
      return groupBars(show)
        ? { title: a(0.2, "up"), bill: a(0.5, "grow"), billFig: a(0.9, "fade"), group: a(1.2, "grow"), groupFig: a(1.6, "fade"), card: a(2.0, "pop"), count: a(2.0, "count") }
        : { title: a(0.2, "up"), card: a(0.6, "pop") };
    case "agecost":
      if (show.rows.length < 2) return { card: a(0.3, "pop") };
      s.title = a(0.2, "up");
      ageRows(show).forEach((_, i) => { s[`bar${i}`] = a(0.6 + i * 0.35, "grow"); });
      s.source = a(0.9 + ageRows(show).length * 0.35, "fade");
      return s;
  }
}

/** a device's frame body at scene time t (showBody hands it the frame, the movements, where things stand, the ink) */
export function healthBody(show: HealthShow, d: Dev) {
  switch (show.layout) {
    case "split": return <Split d={d} show={show} />;
    case "limit": return <Limit d={d} show={show} />;
    case "room": return <Room d={d} show={show} />;
    case "overflow": return <Overflow d={d} show={show} />;
    case "waiting": return <Waiting d={d} show={show} />;
    case "cashless": return <Cashless d={d} show={show} />;
    case "groupgap": return <GroupGap d={d} show={show} />;
    case "agecost": return <AgeCost d={d} show={show} />;
  }
}

type Show<L extends KnowShow["layout"]> = Extract<KnowShow, { layout: L }>;
/** what each device draws with: the frame and its time, its movements, where things stand, the width and the ink */
export interface Dev { c: StoryContext; t: number; s: Record<string, Anim>; g: Geo; w: number; ink: string }

/**
 * What each device draws, shared by every look (story-info-motion.tsx's plot draws the same): its figures never below
 * nothing — a negative one is a mistake upstream, drawn as nothing rather than as "-5 บาท".
 */
const pos = (v: number) => Math.max(0, v);
/** แยกจ่าย's items: four at most, as its card has room for */
export const splitParts = (show: Show<"split">) => show.parts.slice(0, 4);
/** how full each of แยกจ่าย's bars is under its ceiling */
export const PART_FILL = [0.92, 0.58, 0.78, 0.46];
/** the year's limit and what was used of it (none: nothing used, the tube stands empty) */
export const limitFigs = (show: Show<"limit">) => ({ limit: pos(show.limit), used: show.used === undefined ? undefined : pos(show.used) });
/** what the plan pays a night, and the room's own price when it was given */
export const roomFigs = (show: Show<"room">) => ({ plan: pos(show.plan), real: show.real === undefined ? undefined : pos(show.real) });
/** overflow draws its bar when it has a bill and a limit and either is above nothing; a words card otherwise (null) */
export function overflowBar(show: Show<"overflow">): { bill: number; limit: number } | null {
  if (show.bill === undefined || show.limit === undefined) return null;
  const bill = pos(show.bill);
  const limit = pos(show.limit);
  return Math.max(bill, limit) > 0 ? { bill, limit } : null;
}
/** groupgap draws its bars when it has the bill and what the group plan pays, and the bill is above nothing; words only otherwise (null) */
export function groupBars(show: Show<"groupgap">): { bill: number; group: number } | null {
  if (show.bill === undefined || show.group === undefined || show.bill <= 0) return null;
  return { bill: show.bill, group: pos(show.group) };
}
/** เบี้ยขึ้นตามอายุ's bars: six at most, as the chart has room for */
export const ageRows = (show: Show<"agecost">) => show.rows.slice(0, 6).map((x) => ({ ...x, annual: pos(x.annual) }));

/**
 * a card on paper, as the list's is (each look restyles `cut`), turned a little, popping in. `r.h` is its height;
 * with `middle`, it is the band the card, as tall as its lines, stands in the middle of
 */
function Sheet({ r, an, t, tilt, pad, middle, children }: { r: Rect; an?: Anim; t: number; tilt: number; pad: number; middle?: boolean; children: React.ReactNode }) {
  const l = look(an, t);
  const card = (
    <div className="cut" style={{ display: "flex", ...(middle ? {} : { position: "absolute", left: r.x, top: r.y, height: r.h }), width: r.w, flexDirection: "column", background: C.note, border: `4px solid ${C.ink}`, borderRadius: 16, padding: pad, opacity: l.opacity, transform: `rotate(${tilt}deg)${l.transform ? ` ${l.transform}` : ""}`, fontFamily: HAND, color: C.ink }}>
      {children}
    </div>
  );
  return middle ? <div style={abs({ left: r.x, top: r.y, width: r.w, height: r.h, flexDirection: "column", justifyContent: "center" })}>{card}</div> : card;
}

/** a label over its figure, in a column `room` wide: the figure shrinks to fit it */
function Amount({ label, value, color, labelColor, g, room }: { label?: string; value: string; color: string; labelColor?: string; g: Geo; room: number }) {
  return (
    <div style={box({ flexDirection: "column" })}>
      {label ? <div style={box({ fontSize: g.text, fontWeight: 600, lineHeight: 1.3, color: labelColor })}>{label}</div> : null}
      <div style={box({ fontSize: fitSize(value, room, Math.round(g.text * 1.4)), fontWeight: 700, lineHeight: 1.2, color })}>{value}</div>
    </div>
  );
}

export const baht = (v: number) => `${n(v)} ${HW.baht}`;
/** the size a line wrapped at its spaces is set in so its longest piece fits the width (Thai breaks only at a space) */
const fitWords = (text: string, room: number, cap: number) => Math.min(...text.split(" ").map((x) => fitSize(x, room, cap)));

/** เหมาจ่าย vs แยกจ่าย: a card of items each under its own dashed ceiling, beside one tall green bar paying as billed */
function Split({ d, show }: { d: Dev; show: Show<"split"> }) {
  const { c, t, s, g, w, ink } = d;
  const r = g.dev;
  const parts = splitParts(show);
  const gap = Math.round(r.w * 0.05);
  const cw = Math.round((r.w - gap) / 2);
  const foot = Math.round(g.text * 1.4);
  const ch = r.h - foot;
  const pad = Math.round(g.text * 0.55);
  const head = Math.round(g.text * 1.3);
  const inner = cw - pad * 2 - 8;
  const barH = Math.round(g.text * 0.95);
  // wide enough for its words in a large size, wrapped at their spaces
  const lumpW = Math.round(inner * 0.9);
  const lumpH = ch - pad * 2 - 8 - Math.round(head * 1.6);
  const wl = look(s.whole, t);
  const heading = (text: string) => <div style={box({ justifyContent: "center", fontSize: head, fontWeight: 700, lineHeight: 1.25 })}>{text}</div>;
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <Sheet r={{ x: r.x, y: r.y, w: cw, h: ch }} an={s.apart} t={t} tilt={-1} pad={pad}>
        {heading(HW.apart)}
        <div style={box({ flexDirection: "column", flexGrow: 1, justifyContent: "center" })}>
          {parts.map((part, i) => {
            const p = look(s[`part${i}`], t).p;
            return (
              <div key={i} style={box({ flexDirection: "column", marginTop: i ? Math.round(g.text * 0.45) : 0 })}>
                <div style={box({ fontSize: fitSize(part, inner, Math.round(g.text * 1.1)), fontWeight: 600, lineHeight: 1.3 })}>{part}</div>
                {/* the dashed box is the most the plan pays for the item; the bar what it was billed */}
                <div style={box({ width: inner, height: barH, border: `3px dashed ${C.ink}`, borderRadius: 10, padding: 3 })}>
                  <div style={box({ width: Math.round((inner - 12) * PART_FILL[i] * p), height: barH - 12, background: C.coin, borderRadius: 7 })} />
                </div>
              </div>
            );
          })}
        </div>
      </Sheet>
      <Sheet r={{ x: r.x + cw + gap, y: r.y, w: cw, h: ch }} an={s.lump} t={t} tilt={1.2} pad={pad}>
        {heading(HW.lump)}
        <div style={box({ flexGrow: 1, justifyContent: "center", alignItems: "flex-end" })}>
          <div style={box({ width: lumpW, height: Math.round(lumpH * wl.p), background: GREEN, border: `4px solid ${C.ink}`, borderRadius: 12, justifyContent: "center", alignItems: "center", opacity: wl.opacity })}>
            {/* wrapped at its spaces, so a long one (จ่ายตามจริง ภายในวงเงินต่อปี) stays readable in the narrow bar */}
            <div style={box({ justifyContent: "center", padding: `0 ${Math.round(g.text * 0.25)}px`, fontSize: fitWords(show.whole, lumpW - 24 - Math.round(g.text * 0.5), Math.round(g.text * 1.3)), fontWeight: 700, lineHeight: 1.25, textAlign: "center", color: C.white, opacity: wl.p > 0.5 ? 1 : 0 })}>{show.whole}</div>
          </div>
        </div>
      </Sheet>
      <El an={s.foot} t={t} style={{ position: "absolute", left: r.x, width: r.w, top: r.y + ch + Math.round(g.text * 0.35), justifyContent: "center", fontFamily: HAND, fontSize: Math.round(g.text * 0.62), color: ink }}>{HW.splitFoot}</El>
    </>
  );
}

/** วงเงินต่อปีเติมหลอด: the year's limit a tube, filled to what was used, what is left beside it */
function Limit({ d, show }: { d: Dev; show: Show<"limit"> }) {
  const { c, t, s, g, w, ink } = d;
  const r = g.dev;
  const tubeW = Math.round(Math.min(r.w * 0.2, r.h * 0.3));
  const tubeH = Math.round(Math.min(r.h * 0.86, 720));
  const tx = r.x + Math.round(r.w * (c.size === "landscape" ? 0.3 : 0.12));
  const ty = r.y + Math.round((r.h - tubeH) / 2);
  const pad = Math.round(tubeW * 0.09);
  const inside = tubeH - pad * 2;
  const { limit, used } = limitFigs(show);
  // what was used, at least a sliver so it shows; never more than the tube. Nothing used: the tube stands empty
  const share = used === undefined ? 0 : limit <= 0 ? 1 : Math.min(1, Math.max(0.04, used / limit));
  const fill = Math.round(inside * share * look(s.fill, t).p);
  const tl = look(s.tube, t);
  const lx = tx + tubeW + Math.round(g.text * 1.2);
  const lw = r.x + r.w - lx;
  const line3 = Math.round(g.text * 3);
  // ใช้ไป beside the top of what was used, below เหลืออีก and above the tube's foot
  const usedTop = Math.min(Math.max(ty + tubeH - pad - Math.round(inside * share) - Math.round(g.text * 1.3), ty + Math.round(g.text * 7.6)), ty + tubeH - line3);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <div className="piece" style={abs({ left: tx, top: ty, width: tubeW, height: tubeH, opacity: tl.opacity, ...(tl.transform ? { transform: tl.transform } : {}) })}>
        <svg width={tubeW} height={tubeH} viewBox={`0 0 ${tubeW} ${tubeH}`}>
          <rect x={3} y={3} width={tubeW - 6} height={tubeH - 6} rx={(tubeW - 6) / 2} fill={C.note} stroke={C.ink} strokeWidth={6} />
          {/* what was used fills the tube's inside from the foot, to its round ends (a path, so no id two tubes on one page could share) */}
          {fill > 0 ? <path d={capsuleFill(pad, pad, tubeW - pad * 2, inside, fill)} fill={C.coin} /> : null}
          {[0.25, 0.5, 0.75].map((f) => <path key={f} d={`M${tubeW - pad - 4} ${Math.round(pad + inside * f)} h${-Math.round(tubeW * 0.22)}`} stroke={C.ink} strokeWidth={3} strokeLinecap="round" opacity={0.5} />)}
        </svg>
      </div>
      <El an={s.top} t={t} style={{ position: "absolute", left: lx, top: ty, width: lw, flexDirection: "column", fontFamily: HAND, color: ink }}>
        <Amount value={baht(limit)} color={ink} g={g} room={lw} />
        <div style={box({ fontSize: Math.round(g.text * 1.1), fontWeight: 600, lineHeight: 1.3 })}>{HW.perYear}</div>
        <div style={box({ fontSize: Math.round(g.text * 0.8), lineHeight: 1.3, opacity: 0.8 })}>{show.planName}</div>
      </El>
      {used !== undefined ? (
        <>
          <El an={s.left} t={t} style={{ position: "absolute", left: lx, top: ty + Math.round(g.text * 4.5), width: lw, flexDirection: "column", fontFamily: HAND }}>
            {used >= limit
              ? <Amount value={HW.full} color={C.red} g={g} room={lw} />
              : <Amount label={HW.left} labelColor={ink} value={baht(limit - used)} color={GREEN} g={g} room={lw} />}
          </El>
          <El an={s.used} t={t} style={{ position: "absolute", left: lx, top: usedTop, width: lw, flexDirection: "column", fontFamily: HAND, color: ink }}>
            <Amount label={HW.used} value={baht(countAt(used, look(s.count, t).p))} color={ink} g={g} room={lw} />
          </El>
        </>
      ) : null}
    </>
  );
}

/** the part of a standing capsule (`x`, `y`, `w` × `h`, round at both ends) from its foot up to `fill` px, as a path */
export function capsuleFill(x: number, y: number, w: number, h: number, fill: number): string {
  const r = w / 2;
  const cx = x + r;
  const top = y + h - Math.min(h, fill);
  const low = y + h - r;
  const high = y + r;
  const f = (v: number) => Math.round(v * 100) / 100;
  // the arcs run against the clock (sweep 0): left to the foot to the right
  const arc = (to: [number, number]) => `A${f(r)} ${f(r)} 0 0 0 ${f(to[0])} ${f(to[1])}`;
  if (top >= low) {
    const dx = Math.sqrt(Math.max(0, r * r - (top - low) ** 2));
    return `M${f(cx - dx)} ${f(top)} ${arc([cx + dx, top])} Z`;
  }
  if (top >= high) return `M${f(x)} ${f(top)} V${f(low)} ${arc([x + w, low])} V${f(top)} Z`;
  const dx = Math.sqrt(Math.max(0, r * r - (high - top) ** 2));
  return `M${f(cx - dx)} ${f(top)} ${arc([x, high])} V${f(low)} ${arc([x + w, low])} V${f(high)} ${arc([cx + dx, top])} Z`;
}

/** a hospital bed, in a 160 × 100 box */
const BED = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 160 100">
    <path d="M118 6 h10 v10 h10 v10 h-10 v10 h-10 v-10 h-10 v-10 h10 Z" fill={C.red} stroke={C.ink} strokeWidth={2} />
    <rect x={8} y={20} width={14} height={70} rx={4} fill={C.jar} stroke={C.ink} strokeWidth={3.4} />
    <rect x={140} y={44} width={12} height={46} rx={4} fill={C.jar} stroke={C.ink} strokeWidth={3.4} />
    <path d="M16 76 V94 M144 76 V94" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
    <rect x={14} y={56} width={134} height={22} rx={6} fill={C.note} stroke={C.ink} strokeWidth={3.4} />
    <rect x={26} y={42} width={34} height={16} rx={8} fill={C.white} stroke={C.ink} strokeWidth={3} />
    <path d="M58 52 Q100 42 146 52 V70 H58 Z" fill={C.blanket} stroke={C.ink} strokeWidth={3.4} strokeLinejoin="round" />
  </svg>
);

/** ค่าห้องต่อคืน: the bed, and a card of the room a night against what the plan pays; with no room typed, the plan's figure and a line */
function Room({ d, show }: { d: Dev; show: Show<"room"> }) {
  const { c, t, s, g, w, ink } = d;
  const r = g.dev;
  // portrait: the bed over the card; the wider shapes: the bed beside it, both in the middle of the room
  const bed = c.size === "portrait" ? { x: r.x + 170, y: r.y, w: 560, h: 350 } : c.size === "square" ? { x: r.x, y: r.y + Math.round((r.h - 225) / 2), w: 360, h: 225 } : { x: r.x + 20, y: r.y + Math.round((r.h - 325) / 2), w: 520, h: 325 };
  const card = c.size === "portrait" ? { x: r.x + 30, y: r.y + 380, w: r.w - 60, h: r.h - 380 } : c.size === "square" ? { x: r.x + 390, y: r.y, w: r.w - 390, h: r.h } : { x: r.x + 620, y: r.y, w: r.w - 620, h: r.h };
  const pad = Math.round(g.text * 0.7);
  const inner = card.w - pad * 2 - 8;
  const bl = look(s.bed, t);
  const row = (an: Anim | undefined, label: string, value: string, color: string, size: number) => (
    <El an={an} t={t} style={{ justifyContent: "space-between", alignItems: "center", marginTop: Math.round(g.text * 0.5) }}>
      <div style={box({ fontSize: Math.round(g.text * 1.15), fontWeight: 500, flexShrink: 0 })}>{label}</div>
      <div style={box({ fontSize: size, fontWeight: 700, color })}>{value}</div>
    </El>
  );
  const rule = <div style={box({ height: 0, borderTop: `3px dashed ${C.ink}`, marginTop: Math.round(g.text * 0.5) })} />;
  const { plan, real } = roomFigs(show);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      <div className="piece" style={abs({ left: bed.x, top: bed.y, width: bed.w, height: bed.h, opacity: bl.opacity, ...(bl.transform ? { transform: bl.transform } : {}) })}>{BED({ x: 0, y: 0, w: bed.w, h: bed.h })}</div>
      <Sheet r={card} an={s.card} t={t} tilt={-0.8} pad={pad} middle>
        <div style={box({ fontSize: Math.round(g.text * 0.85), opacity: 0.75 })}>{show.planName}</div>
        {real !== undefined ? (
          <div style={box({ flexDirection: "column" })}>
            {row(s.real, HW.realRoom, n(real), C.ink, Math.round(g.text * 1.45))}
            {row(s.plan, HW.planPays, n(plan), GREEN, Math.round(g.text * 1.45))}
            {rule}
            {/* a room within what the plan pays is paid: no difference to show, never a negative one */}
            {real > plan
              ? row(s.own, HW.ownNight, n(countAt(real - plan, look(s.count, t).p)), C.red, Math.round(g.text * 1.8))
              : <El an={s.own} t={t} style={{ justifyContent: "center", marginTop: Math.round(g.text * 0.4), fontSize: fitSize(HW.enough, inner, Math.round(g.text * 1.7)), fontWeight: 700, color: GREEN }}>{HW.enough}</El>}
            <div style={box({ justifyContent: "flex-end", marginTop: Math.round(g.text * 0.3), fontSize: Math.round(g.text * 0.6), opacity: 0.7 })}>{HW.example}</div>
          </div>
        ) : (
          <div style={box({ flexDirection: "column" })}>
            {row(s.plan, HW.planNight, n(plan), GREEN, Math.round(g.text * 1.6))}
            {rule}
            <El an={s.words} t={t} style={{ justifyContent: "center", marginTop: Math.round(g.text * 0.5), fontSize: fitWords(HW.roomWords, inner, Math.round(g.text * 1.2)), fontWeight: 600, lineHeight: 1.35, textAlign: "center" }}>{HW.roomWords}</El>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** ส่วนต่างที่จ่ายเอง: the bill a bar, green up to the dashed limit and red above it, what each side pays beside it; a words card with no bill */
function Overflow({ d, show }: { d: Dev; show: Show<"overflow"> }) {
  const { c, t, s, g, w, ink } = d;
  const bar = overflowBar(show);
  const title = <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />;
  if (!bar) {
    return (
      <>
        {title}
        <Note g={g} r={{ ...g.card, y: g.card.y + Math.round(g.card.h * 0.1) }} an={s.card} t={t} lines={[{ text: HW.choose, big: true }, { text: HW.chooseFoot }]} tilt={0.8} scale={1.35} />
        <Pointer c={c} t={t} an={s.card} />
      </>
    );
  }
  const { bill, limit } = bar;
  const r = g.dev;
  const foot = Math.round(g.text * 1.6);
  const barW = Math.round(Math.min(r.w * 0.24, 260));
  const bx = r.x + (c.size === "landscape" ? 200 : 40);
  // room over the bar for the limit's word and its figure, when the limit is the top
  const over = Math.round(g.text * 2.4);
  const top = r.y + over;
  const barH = r.h - foot - over;
  const base = top + barH;
  const most = Math.max(bill, limit);
  const paidH = Math.round((barH * Math.min(bill, limit)) / most);
  const limitY = base - Math.round((barH * limit) / most);
  const overH = bill > limit ? limitY - top : 0;
  const pp = look(s.paid, t).p;
  const op = look(s.over, t).p;
  const lineEnd = bx + barW + Math.round(g.text * 4.4);
  // the limit's word with its own figure under it (as plot has it), so the dashed line is never read as the bill
  const wordSize = Math.round(g.text * 0.8);
  const capRoom = lineEnd - bx - barW - 18;
  const capSize = fitSize(n(limit), capRoom, Math.round(g.text * 0.9));
  const capTop = limitY - Math.round(wordSize * 1.2) - Math.round(capSize * 1.2) - 6;
  const lx = lineEnd + Math.round(g.text * 0.6);
  const lw = r.x + r.w - lx;
  const part = (y: number, h: number, color: string) => <div style={abs({ left: bx, top: y, width: barW, height: h, background: color, border: `4px solid ${C.ink}`, borderRadius: 10, opacity: h > 0 ? 1 : 0 })} />;
  return (
    <>
      {title}
      {part(base - Math.round(paidH * pp), Math.round(paidH * pp), GREEN)}
      {overH ? part(limitY - Math.round(overH * op), Math.round(overH * op), C.red) : null}
      <El an={s.line} t={t} style={{ position: "absolute", left: bx - 30, top: limitY - 3, width: lineEnd - bx + 30, height: 0, borderTop: `6px dashed ${C.red}` }} />
      <El an={s.line} t={t} style={{ position: "absolute", left: bx + barW + 14, top: capTop, flexDirection: "column", fontFamily: HAND, fontWeight: 700, color: C.red }}>
        <div style={box({ fontSize: wordSize, lineHeight: 1.2 })}>{HW.limit}</div>
        <div style={box({ fontSize: capSize, lineHeight: 1.2 })}>{n(limit)}</div>
      </El>
      <div style={abs({ left: lx, top, width: lw, height: barH, flexDirection: "column", justifyContent: "center", fontFamily: HAND })}>
        <El an={s.bill} t={t} style={{ flexDirection: "column" }}><Amount label={HW.bill} labelColor={ink} value={baht(bill)} color={ink} g={g} room={lw} /></El>
        <El an={s.insurer} t={t} style={{ flexDirection: "column", marginTop: Math.round(g.text * 0.5) }}><Amount label={HW.insurerPays} labelColor={ink} value={baht(Math.min(bill, limit))} color={GREEN} g={g} room={lw} /></El>
        {/* a bill within the limit is paid: no part the customer pays, never a negative one */}
        <El an={s.own} t={t} style={{ flexDirection: "column", marginTop: Math.round(g.text * 0.5) }}>
          {bill > limit
            ? <Amount label={HW.own} labelColor={C.red} value={baht(countAt(bill - limit, look(s.count, t).p))} color={C.red} g={g} room={lw} />
            : <Amount value={HW.enough} color={GREEN} g={g} room={lw} />}
        </El>
      </div>
      <El an={s.foot} t={t} style={{ position: "absolute", left: r.x, width: r.w, top: base + Math.round(g.text * 0.45), justifyContent: "center", fontFamily: HAND, fontSize: Math.round(g.text * 0.8), fontWeight: 600, color: ink }}>{`${HW.choose}${HW.chooseFoot}`}</El>
    </>
  );
}


/**
 * how many lines a label wrapped at its spaces takes in `room` px at `size` (a letter 0.6 of the size, as fitSize
 * counts it, so it never says fewer lines than are drawn)
 */
export function wrapLines(text: string, size: number, room: number): number {
  const width = (x: string) => [...x].length * 0.6 * size;
  let lines = 1;
  let used = 0;
  for (const word of text.split(" ").filter(Boolean)) {
    const add = used ? width(` ${word}`) : width(word);
    if (used && used + add > room) { lines += 1; used = width(word); } else used += add;
  }
  return lines;
}

/**
 * where ระยะรอคอย stands on paper: the line, the days and dots on it, the labels under them (as many lines as the
 * longest wraps to) and the card's top below the lowest label — in portrait no higher than its own place
 */
export function waitingGeo(size: VideoSize, g: Pick<Geo, "text" | "dev">, rows: { at: string; label: string }[]) {
  const r = g.dev;
  const col = Math.round(r.w / Math.max(1, rows.length));
  const dot = Math.round(g.text * 1.1);
  const atSize = Math.min(...rows.map((x) => fitSize(x.at, col - 24, Math.round(g.text * 1.9))), Math.round(g.text * 1.9));
  const atH = Math.round(atSize * 1.4);
  const labelSize = Math.min(...rows.map((x) => fitWords(x.label, col - 24, Math.round(g.text * 1.4))), Math.round(g.text * 1.4));
  const ly = r.y + Math.round(r.h * (size === "portrait" ? 0.3 : 0.32));
  const margin = Math.round(g.text * 0.4);
  const lines = Math.max(1, ...rows.map((x) => wrapLines(x.label, labelSize, col - 24)));
  const labelBottom = ly + Math.round(dot / 2) + margin + Math.ceil(lines * labelSize * 1.3);
  const below = labelBottom + Math.round(g.text * 0.6);
  const cardY = size === "portrait" ? Math.max(r.y + Math.round(r.h * 0.62), below) : below;
  return { col, dot, atSize, atH, labelSize, ly, margin, lines, labelBottom, cardY };
}

/** ระยะรอคอย: a line from today, a dot where each cover starts (the day above, what it covers under), the plan's conditions on a card */
function Waiting({ d, show }: { d: Dev; show: Show<"waiting"> }) {
  const { c, t, s, g, w, ink } = d;
  const r = g.dev;
  const rows = show.rows;
  const last = rows.length - 1;
  const { col, dot, atSize, atH, labelSize, ly, margin, cardY } = waitingGeo(c.size, g, rows);
  const x0 = r.x + Math.round(col / 2);
  const len = Math.max(0, last) * col;
  const pad = Math.round(g.text * 0.7);
  // the card under the labels, below the lowest; alone in the room's middle with no rows yet
  const card = rows.length
    ? { x: r.x + Math.round(r.w * 0.12), y: cardY, w: Math.round(r.w * 0.76), h: Math.round(g.text * 3) }
    : { x: r.x + Math.round(r.w * 0.12), y: r.y, w: Math.round(r.w * 0.76), h: Math.round(r.h * 0.6) };
  const dotColor = (i: number) => (i === 0 ? GREEN : i === last ? C.red : C.coin);
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {len > 0 ? (
        <div style={abs({ left: x0, top: ly - 6, width: len, height: 12 })}>
          <svg width={len} height={12} viewBox={`0 0 ${len} 12`}>{stroke({ d: `M0 6 H${len}`, len, p: look(s.line, t).p, color: ink, width: 8 })}</svg>
        </div>
      ) : null}
      {rows.map((row, i) => (
        <El key={i} an={s[`row${i}`]} t={t} style={{ position: "absolute", left: r.x + i * col, top: ly - atH - Math.round(dot / 2), width: col, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: ink }}>
          <div style={box({ height: atH, alignItems: "flex-end", fontSize: atSize, fontWeight: 700, lineHeight: 1.2, color: i === 0 ? GREEN : ink })}>{row.at}</div>
          <div style={box({ width: dot, height: dot, borderRadius: dot, background: dotColor(i), border: `4px solid ${C.ink}`, flexShrink: 0 })} />
          <div style={box({ marginTop: margin, width: col - 24, justifyContent: "center", fontSize: labelSize, fontWeight: 600, lineHeight: 1.3, textAlign: "center" })}>{row.label}</div>
        </El>
      ))}
      <Sheet r={card} an={s.card} t={t} tilt={0.8} pad={pad} middle>
        <div style={box({ justifyContent: "center", fontSize: fitWords(HW.waitFoot, card.w - pad * 2 - 8, Math.round(g.text * 1.3)), fontWeight: 600, lineHeight: 1.3, textAlign: "center" })}>{HW.waitFoot}</div>
      </Sheet>
    </>
  );
}

/** a hospital with a red cross, in a 100 × 100 box */
const HOSPITAL = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 100 100">
    <rect x={12} y={20} width={76} height={76} rx={5} fill={C.note} stroke={C.ink} strokeWidth={3.4} />
    <rect x={6} y={10} width={88} height={14} rx={4} fill={C.jar} stroke={C.ink} strokeWidth={3.4} />
    <path d="M45 32 h10 v10 h10 v10 h-10 v10 h-10 v-10 h-10 v-10 h10 Z" fill={C.red} stroke={C.ink} strokeWidth={2} />
    <rect x={20} y={70} width={14} height={12} rx={2} fill={C.blanket} stroke={C.ink} strokeWidth={2.4} />
    <rect x={66} y={70} width={14} height={12} rx={2} fill={C.blanket} stroke={C.ink} strokeWidth={2.4} />
    <rect x={42} y={72} width={16} height={24} rx={2} fill={C.jar} stroke={C.ink} strokeWidth={2.4} />
  </svg>
);
/** the insurance card handed over, in a 160 × 100 box */
const CARD = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 160 100">
    <rect x={4} y={4} width={152} height={92} rx={12} fill={C.navy} stroke={C.ink} strokeWidth={4} />
    <rect x={20} y={28} width={30} height={22} rx={4} fill={C.coin} stroke={C.ink} strokeWidth={2} />
    <path d="M20 70 H112 M20 82 H80" stroke={C.white} strokeWidth={5} strokeLinecap="round" />
  </svg>
);
/** a green tick in a circle, in a 100 × 100 box */
const TICK = (r: Rect) => (
  <svg width={r.w} height={r.h} viewBox="0 0 100 100">
    <circle cx={50} cy={50} r={45} fill={GREEN} stroke={C.ink} strokeWidth={4} />
    <path d="M28 52 L44 67 L73 35" fill="none" stroke={C.white} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** เคลมไม่ต้องสำรองจ่าย: the network hospital, the card handed over, a green tick, รพ. ในเครือ and the show's note */
function Cashless({ d, show }: { d: Dev; show: Show<"cashless"> }) {
  const { c, t, s, g, w, ink } = d;
  const r = g.dev;
  const portrait = c.size === "portrait";
  // portrait: the hospital and card over the tick and the words; the wider shapes: they on the left, the rest on the right
  const hs = portrait ? 420 : Math.round(r.h * (c.size === "square" ? 0.55 : 0.62));
  const hosp = portrait ? { x: r.x + 160, y: r.y, w: hs, h: hs } : { x: r.x + Math.round(r.w * 0.06), y: r.y + Math.round(r.h * 0.08), w: hs, h: hs };
  const card = { x: hosp.x + Math.round(hs * 0.72), y: hosp.y + Math.round(hs * 0.55), w: Math.round(hs * 0.72), h: Math.round(hs * 0.45) };
  // the right side starts past the card (square is narrow: the hospital smaller, the side further right)
  const right = c.size === "square" ? 0.6 : 0.5;
  const side = portrait ? { x: r.x, y: r.y + 480, w: r.w } : { x: r.x + Math.round(r.w * right), y: r.y + Math.round(r.h * 0.04), w: Math.round(r.w * (1 - right)) };
  const tick = Math.round(portrait ? 200 : r.h * 0.36);
  const pop = (an: Anim | undefined, rect: Rect, body: React.ReactNode, cls?: string) => {
    const l = look(an, t);
    return <div className={cls} style={abs({ left: rect.x, top: rect.y, width: rect.w, height: rect.h, opacity: l.opacity, ...(l.transform ? { transform: l.transform } : {}) })}>{body}</div>;
  };
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {pop(s.hosp, hosp, HOSPITAL({ x: 0, y: 0, w: hosp.w, h: hosp.h }), "piece")}
      {pop(s.card, card, <div style={box({ transform: "rotate(-8deg)" })}>{CARD({ x: 0, y: 0, w: card.w, h: card.h })}</div>, "piece")}
      {pop(s.tick, { x: side.x + Math.round((side.w - tick) / 2), y: side.y, w: tick, h: tick }, TICK({ x: 0, y: 0, w: tick, h: tick }))}
      <El an={s.word} t={t} style={{ position: "absolute", left: side.x, top: side.y + tick + Math.round(g.text * 0.5), width: side.w, justifyContent: "center", fontFamily: HAND, fontSize: fitSize(HW.network, side.w - 40, Math.round(g.text * 1.6)), fontWeight: 700, color: ink }}>{HW.network}</El>
      <El an={s.note} t={t} style={{ position: "absolute", left: side.x + 20, top: side.y + tick + Math.round(g.text * 2.9), width: side.w - 40, justifyContent: "center", fontFamily: HAND, fontSize: fitWords(show.note, side.w - 40, Math.round(g.text * 1.05)), fontWeight: 500, lineHeight: 1.35, textAlign: "center", color: ink, opacity: 0.85 }}>{show.note}</El>
    </>
  );
}

/** ประกันกลุ่มไม่พอ: the bill a long bar, what the group plan pays a short green one, what is still short on a card; words only without both */
function GroupGap({ d, show }: { d: Dev; show: Show<"groupgap"> }) {
  const { c, t, s, g, w, ink } = d;
  const title = <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />;
  const figs = groupBars(show);
  if (!figs) {
    return (
      <>
        {title}
        <Note g={g} r={{ ...g.card, y: g.card.y + Math.round(g.card.h * 0.1) }} an={s.card} t={t} lines={[{ text: HW.groupMaybe, big: true }]} tilt={0.8} scale={Math.min(1.35, fitHand(HW.groupMaybe, g.card.w - 64, 999) / (g.text * 1.4))} />
        <Pointer c={c} t={t} an={s.card} />
      </>
    );
  }
  const r = g.dev;
  const { bill, group } = figs;
  const wide = c.size === "landscape";
  const labelSize = Math.round(g.text * 1.15);
  const barH = Math.round(g.text * 1.6);
  const block = Math.round(labelSize * 1.3) + barH + Math.round(g.text * 1.1);
  const bars = wide ? { x: r.x, y: r.y + Math.round((r.h - block * 2) / 2), w: Math.round(r.w * 0.6) } : { x: r.x, y: r.y + (c.size === "portrait" ? 60 : 0), w: r.w };
  const figW = Math.round(bars.w * 0.34);
  const track = bars.w - figW - 24;
  const most = Math.max(bill, group);
  const card = wide
    ? { x: r.x + Math.round(r.w * 0.66), y: r.y, w: Math.round(r.w * 0.34), h: r.h }
    : { x: r.x + Math.round(r.w * 0.15), y: bars.y + block * 2 + Math.round(g.text * 0.4), w: Math.round(r.w * 0.7), h: r.y + r.h - (bars.y + block * 2 + Math.round(g.text * 0.4)) };
  const pad = Math.round(g.text * 0.7);
  const inner = card.w - pad * 2 - 8;
  const row = (i: number, label: string, value: number, color: string, an: string) => {
    const p = look(s[an], t).p;
    const len = Math.max(12, Math.round((track * value) / most));
    return (
      <div style={abs({ left: bars.x, top: bars.y + i * block, width: bars.w, flexDirection: "column", fontFamily: HAND, color: ink })}>
        <div style={box({ fontSize: labelSize, fontWeight: 600, lineHeight: 1.3 })}>{label}</div>
        <div style={box({ alignItems: "center" })}>
          <div style={box({ width: track, height: barH, flexShrink: 0 })}>
            <div style={box({ width: Math.round(len * p), height: barH, background: color, border: `4px solid ${C.ink}`, borderRadius: 10, opacity: p > 0 ? 1 : 0 })} />
          </div>
          <El an={s[`${an}Fig`]} t={t} style={{ marginLeft: 24, width: figW, fontSize: fitSize(n(value), figW, Math.round(g.text * 1.5)), fontWeight: 700, color: color === GREEN ? GREEN : ink }}>{n(value)}</El>
        </div>
      </div>
    );
  };
  return (
    <>
      {title}
      {row(0, HW.realBill, bill, C.coin, "bill")}
      {row(1, HW.groupPays, group, GREEN, "group")}
      <Sheet r={card} an={s.card} t={t} tilt={-0.8} pad={pad} middle>
        {/* what the group plan pays covers the bill: nothing short, never a negative */}
        {bill > group ? (
          <div style={box({ flexDirection: "column", alignItems: "center" })}>
            <div style={box({ fontSize: Math.round(g.text * 1.2), fontWeight: 600, lineHeight: 1.3 })}>{HW.short}</div>
            <div style={box({ fontSize: fitSize(baht(bill - group), inner, Math.round(g.text * 2)), fontWeight: 700, lineHeight: 1.25, color: C.red })}>{baht(countAt(bill - group, look(s.count, t).p))}</div>
          </div>
        ) : <div style={box({ justifyContent: "center", fontSize: fitSize(HW.groupEnough, inner, Math.round(g.text * 1.6)), fontWeight: 700, color: GREEN })}>{HW.groupEnough}</div>}
      </Sheet>
    </>
  );
}

/** เบี้ยขึ้นตามอายุ: a bar of the year's premium at each age, rising, the last in red, where the figures come from under them */
function AgeCost({ d, show }: { d: Dev; show: Show<"agecost"> }) {
  const { c, t, s, g, w, ink } = d;
  // one age is no rise to show: the title on a card (the episode should not build one; this is its guard)
  if (show.rows.length < 2) {
    return (
      <>
        <Note g={g} r={{ ...g.card, y: g.card.y + Math.round(g.card.h * 0.1) }} an={s.card} t={t} lines={[{ text: show.title[0], big: true }, ...(show.title[1] ? [{ text: show.title[1] }] : [])]} tilt={0.8} scale={1.35} />
        <Pointer c={c} t={t} an={s.card} />
      </>
    );
  }
  const r = g.dev;
  const rows = ageRows(show);
  const last = rows.length - 1;
  const chart = c.size === "landscape" ? { x: r.x + 200, w: r.w - 400 } : { x: r.x + 40, w: r.w - 80 };
  const slot = Math.round(chart.w / rows.length);
  const barW = Math.min(Math.round(slot * 0.62), 200);
  const figSize = Math.min(...rows.map((x) => fitSize(n(x.annual), slot - 12, Math.round(g.text * 1.1))));
  const labels = rows.map((x) => `${x.age} ${HW.years}`);
  const labelSize = Math.min(...labels.map((x) => fitSize(x, slot - 12, Math.round(g.text * 1.2))));
  const sourceSize = fitWords(show.source, r.w - 40, Math.round(g.text * 0.75));
  const foot = Math.round(labelSize * 1.6) + Math.round(sourceSize * 3.2);
  const top = r.y + Math.round(figSize * 1.5);
  const base = r.y + r.h - foot;
  const room = base - top;
  const most = Math.max(1, ...rows.map((x) => x.annual));
  return (
    <>
      <Title fit cut={paper(c.input)} pill={line(c.input)} ink={ink} g={g} w={w} an={s.title} t={t} text={show.title} />
      {rows.map((row, i) => {
        const p = look(s[`bar${i}`], t).p;
        const h = Math.max(8, Math.round((room * row.annual) / most));
        const x = chart.x + i * slot;
        return (
          <div key={i} style={abs({ left: x, top: base - Math.round(h * p) - Math.round(figSize * 1.4), width: slot, flexDirection: "column", alignItems: "center", fontFamily: HAND, color: ink })}>
            <div style={box({ height: Math.round(figSize * 1.4), alignItems: "flex-end", fontSize: figSize, fontWeight: 700, opacity: p > 0.6 ? 1 : 0, color: i === last ? C.red : ink })}>{n(row.annual)}</div>
            <div style={box({ width: barW, height: Math.round(h * p), background: i === last ? C.red : C.coin, border: `4px solid ${C.ink}`, borderBottom: "none", borderRadius: "10px 10px 0 0", opacity: p > 0 ? 1 : 0 })} />
          </div>
        );
      })}
      <div style={abs({ left: chart.x - 20, top: base - 3, width: chart.w + 40, height: 6, background: ink, borderRadius: 3 })} />
      {labels.map((label, i) => (
        <div key={i} style={abs({ left: chart.x + i * slot, top: base + Math.round(labelSize * 0.25), width: slot, justifyContent: "center", fontFamily: HAND, fontSize: labelSize, fontWeight: 700, color: i === last ? C.red : ink })}>{label}</div>
      ))}
      <El an={s.source} t={t} style={{ position: "absolute", left: r.x + 20, width: r.w - 40, top: base + Math.round(labelSize * 1.7), justifyContent: "center", fontFamily: HAND, fontSize: sourceSize, lineHeight: 1.35, textAlign: "center", color: ink, opacity: 0.85 }}>{show.source}</El>
    </>
  );
}
