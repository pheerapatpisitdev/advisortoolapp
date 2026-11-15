import { Fragment, type CSSProperties, type ReactNode } from "react";
import { abs, box, El, look, type Anim } from "./motion";
import {
  ARROW_D, arcPoint, copayAt, copayGeo, deductibleAt, deductibleGeo, DOOR, DOOR_BED, DOOR_CROSS, DOOR_FRAME, doorLeaf,
  enter as enterAt, groupGeo, H2_INK, hospitalsGeo, ipdopdAt, ipdopdGeo, paclaimGeo, parentsGeo, payArrow, renewAt, renewGeo, type Blk, type H2Place,
} from "./story-health2-motion";
import { devArea, E, fill, glowBox, ink, kit, pen, Tile, Title, type Dev } from "./story-info-motion";
import { HEALTH2_WORDS as W, type Health2Show } from "./story-knowledge";
import { geoOf } from "./story-knowledge-motion";
import { figure, ln, metaTitleSize, ovalD, shape } from "./story-meta-info";
import { r1 } from "./story-meta-motion";
import { NoteLines, paidInk, rrectD } from "./story-save-info";
import type { VideoSize } from "./timeline";

/**
 * สุขภาพเพิ่มเติม (device round 5) in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน, บลูพริ้นท์ and the retired
 * อินโฟกราฟิก: the eight devices story-health2-motion.tsx draws on paper, with the same geometry (its ipdopdGeo,
 * deductibleGeo, copayGeo, renewGeo, parentsGeo, groupGeo, hospitalsGeo and paclaimGeo, asked for the info route's room)
 * and the same beats, drawn with the Kit story-info-motion.tsx sets for the frame: its inks, its hand, its bold (Sriracha
 * never above 400), its glow, its hatching. The paper's four inks map onto the Kit's: the ผู้ป่วยใน blue is the accent, the
 * insurer's and ผู้ป่วยนอก's green is the Kit's green, what we pay is the accent too (white where the accent is the green:
 * บลูพริ้นท์), the cut is the Kit's red. A drawn look draws in outline, a bar hatched; อินโฟกราฟิก fills its shapes flat on
 * the navy. People are plain figures, as faceless as the Kit's icons.
 */

/** where a round-5 device stands in the info route: the room under its title (above the plotter's rail), the frame's text size */
export const health2InfoPlace = (size: VideoSize): H2Place => ({ room: devArea(size), text: geoOf(size).text });

/** a round-5 device's frame body in the info route at scene time t (infoShow hands it the frame, the movements, the room) */
export function health2Info(d: Dev, show: Health2Show) {
  switch (show.layout) {
    case "ipdopd": return ipdopd(d, show);
    case "deductible": return deductible(d, show);
    case "copay": return copay(d, show);
    case "renew98": return renew98(d, show);
    case "parentshealth": return parentshealth(d, show);
    case "groupcost": return groupcost(d, show);
    case "hospitals": return hospitals(d, show);
    case "paclaim": return paclaim(d, show);
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const place = (d: Dev) => health2InfoPlace(d.c.size);

/** บลูพริ้นท์'s words sit on a plate of the sheet's own blue, so the grid's coarse lines never run through a letter */
const plate = (): CSSProperties => (kit().dims ? { background: kit().page } : {});

/** the paper's ink of a block, as the Kit's */
function inkOf(color: string): string {
  const K = kit();
  if (color === H2_INK.blue) return K.gold;
  if (color === H2_INK.green) return K.green;
  if (color === H2_INK.gold) return paidInk();
  if (color === H2_INK.red) return K.red;
  return K.white;
}

/** blocks one under another, each line in its block's size and its Kit ink */
function Blocks({ blocks, align = "center" }: { blocks: Blk[]; align?: "center" | "flex-start" }) {
  const K = kit();
  return (
    <div style={box({ flexDirection: "column", alignItems: align })}>
      {blocks.map((b) => b.lines.map((x, i) => <div key={`${b.color}${x}${i}`} style={box({ fontSize: b.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(inkOf(b.color)) })}>{x}</div>))}
    </div>
  );
}

/**
 * Words and figures coming in: whole or not at all. The pen's write-in (a clip that sweeps across the piece) would show half a
 * figure, "2,55" for "2,552", so in a look that writes, a piece with text fades in whole instead; นีออน's flicker and
 * อินโฟกราฟิก's own entrance are whole already.
 */
function Say({ an, t, style, children }: { an?: Anim; t: number; style: CSSProperties; children?: ReactNode }) {
  return kit().reveal === "write" ? <El an={an} t={t} style={style}>{children}</El> : <E an={an} t={t} style={style}>{children}</E>;
}

/** a card standing at `r`: the Kit's card ground and edge, its content centred */
function InfoCard({ d, an, r, part, children }: { d: Dev; an?: Anim; r: { x: number; y: number; w: number; h: number }; part: string; children: ReactNode }) {
  const K = kit();
  return (
    <div data-part={part} style={abs({ left: r.x, top: r.y, width: r.w, height: r.h })}>
      {/* the card's edge is written in; what is on it comes in whole */}
      <E an={an} t={d.t} style={{ position: "absolute", left: 0, top: 0, width: r.w, height: r.h, background: K.dims ? K.page : K.tile, border: `${pen(3)}px solid ${K.tileLine}`, borderRadius: Math.round(place(d).text * 0.5), ...glowBox(K.tileLine) }} />
      <Say an={an} t={d.t} style={{ position: "absolute", left: 0, top: 0, width: r.w, height: r.h, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</Say>
    </div>
  );
}

/** a short line under or beside the picture, as plain lines in the Kit's quieter words, fading in */
function Words({ d, an, g, color }: { d: Dev; an?: Anim; g: { x: number; y: number; w: number; h: number; size: number; lines: string[] }; color?: string }) {
  const K = kit();
  return (
    <Say an={an} t={d.t} style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, flexDirection: "column", alignItems: "center" }}>
      {g.lines.map((x, i) => <div key={i} style={box({ fontSize: g.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(color ?? K.soft) })}>{x}</div>)}
    </Say>
  );
}

/** the scene's title, set to fit the frame's width as every info device's is */
function H2Title({ d, show }: { d: Dev; show: Health2Show }) {
  return <Title text={show.title} an={d.s.title} t={d.t} w={d.w} g={d.g} sizes={metaTitleSize(d.c.size, show.title)} />;
}

/** a rect as a hatched or flat block in `color`, `r` its radius (fill()'s own) */
const block = (color: string, radius: number): CSSProperties => fill(color, radius);

/** the plain figure of the meta devices, in `color`, standing in its own box (the figure's 100 × 130 sheet cut to its width) */
function Person({ d, part, r, an, color }: { d: Dev; part: string; r: { x: number; y: number; w: number; h: number }; an?: Anim; color: string }) {
  return (
    <div data-part={part} style={abs({ left: r.x, top: r.y, width: r.w, height: r.h })}>
      <E an={an} t={d.t} style={{ width: r.w, height: r.h }}>
        <svg width={r.w} height={r.h} viewBox="14 0 72 130">{figure("stand", color, 0)}</svg>
      </E>
    </div>
  );
}

/* ---------- ipdopd: สองประตู ผู้ป่วยใน ผู้ป่วยนอก ---------- */

/** a door on its sheet: its frame, what is inside (a bed, a cross) and the leaf swung `open`; a locked door's leaf in the dim ink */
function doorPic(kind: 0 | 1, open: number, locked: boolean) {
  const K = kit();
  const F = DOOR_FRAME;
  const B = DOOR_BED;
  const L = doorLeaf(open);
  const leaf = locked ? K.dim : kind === 0 ? K.gold : K.green;
  const frameD = rrectD(F.x, F.y, F.w, F.h, F.r);
  const bedInk = K.drawn ? K.white : K.soft;
  const part = (key: string, r: { x: number; y: number; w: number; h: number; r: number }, color: string) => shape(key, rrectD(r.x, r.y, r.w, r.h, r.r), color, 3, false);
  return (
    <>
      {K.drawn ? null : <path d={frameD} fill={K.tile} />}
      {L.e > 0.15 ? (
        <g opacity={clamp01((L.e - 0.15) * 1.6)}>
          {kind === 0 ? (
            <>
              {part("post", B.post, K.white)}
              {part("mattress", B.mattress, bedInk)}
              {part("blanket", B.blanket, K.gold)}
              {shape("pillow", ovalD(B.pillow.cx, B.pillow.cy, B.pillow.rx, B.pillow.ry), K.white, 3, false)}
              {part("rail", { ...B.rail, r: 0 }, K.white)}
              {part("foot", { ...B.foot, r: 0 }, K.white)}
            </>
          ) : ln("cross", DOOR_CROSS, K.green, 16)}
        </g>
      ) : null}
      {shape("leaf", `M${L.points.replace(/ /g, " L")} Z`, leaf, 3.8, true)}
      {shape("knob", ovalD(L.knob.cx, L.knob.cy, L.knob.r), K.white, 3, true)}
      {ln("frame", frameD, K.white, 3.6)}
      {ln("floor", "M2 264 H198", K.white, 3.6)}
    </>
  );
}

/** สองประตู: the accent's door of ผู้ป่วยใน opens and its card follows, then the green door of ผู้ป่วยนอก; the line last */
function ipdopd(d: Dev, show: Health2Show<"ipdopd">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = ipdopdGeo(c.size, show, place(d));
  const at = ipdopdAt(s, show, t);
  return (
    <>
      <H2Title d={d} show={show} />
      {geo.plan ? (
        <Say an={s.title} t={t} style={{ position: "absolute", left: geo.plan.x, top: geo.plan.y, width: geo.plan.w, height: geo.plan.h, justifyContent: "center", alignItems: "center", background: K.tile, border: `${pen(3)}px solid ${K.gold}`, borderRadius: 999, fontSize: geo.plan.size, fontWeight: K.bold, lineHeight: 1.3, ...ink(K.white), ...glowBox(K.gold) }}>{geo.plan.text}</Say>
      ) : null}
      {geo.doors.map((dr, i) => (
        <Fragment key={i}>
          <div data-part={`door${i}`} style={abs({ left: dr.door.x, top: dr.door.y, width: dr.door.w, height: dr.door.h })}>
            <svg width={dr.door.w} height={dr.door.h} viewBox={`0 0 ${DOOR.w} ${DOOR.h}`}>{doorPic(i as 0 | 1, at.open[i], i === 1 && show.opd === "none")}</svg>
          </div>
          <InfoCard d={d} an={s[`card${i}`]} r={dr.card} part={`card${i}`}><Blocks blocks={dr.card.blocks} /></InfoCard>
        </Fragment>
      ))}
      {geo.line ? <Words d={d} an={s.line} g={geo.line} /> : null}
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- deductible: ส่วนรับผิดชอบแรก ---------- */

/** ส่วนรับผิดชอบแรก: the bill bar, our part up to the deductible then the insurer's green, to scale; amounts only when a bill was given */
function deductible(d: Dev, show: Health2Show<"deductible">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = deductibleGeo(c.size, show, place(d));
  const at = deductibleAt(s, t);
  const b = geo.bar;
  const inner = { x: b.x + 4, y: b.y + 4, h: b.h - 8 };
  const goldNow = Math.round(Math.max(0, geo.goldW - 4) * at.ours);
  const greenNow = Math.round(geo.greenW * at.theirs);
  const bothDone = at.ours >= 1 && at.theirs >= 1 && geo.greenW > 0;
  const ours = paidInk();
  const rule = pen(4);
  return (
    <>
      <H2Title d={d} show={show} />
      {geo.bill ? <div data-part="bill" style={abs({ left: geo.bill.x, top: geo.bill.y, width: geo.bill.w, height: geo.bill.h, fontSize: geo.bill.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(K.white), opacity: at.bill > 0 ? 1 : 0 })}>{geo.bill.text}</div> : null}
      <div data-part="trough" style={abs({ left: b.x, top: b.y, width: Math.round(b.w * at.bill), height: b.h, background: K.tile, border: `${rule}px solid ${K.white}`, borderRadius: 14, opacity: at.bill > 0 ? 1 : 0, ...glowBox(K.white) })} />
      {goldNow > 0 ? <div data-part="ours" style={abs({ left: inner.x, top: inner.y, width: goldNow, height: inner.h, ...block(ours, 0), borderRadius: 0 })} /> : null}
      {geo.greenW > 0 && greenNow > 0 ? <div data-part="theirs" style={abs({ left: b.x + geo.goldW, top: inner.y, width: Math.min(greenNow, geo.greenW - 4), height: inner.h, ...block(K.green, 0), borderRadius: 0 })} /> : null}
      {bothDone ? (
        <div data-part="split" style={abs({ left: b.x + geo.goldW - 2, top: b.y - 10, width: 4, height: b.h + 20 })}>
          <svg width={4} height={b.h + 20} viewBox={`0 0 4 ${b.h + 20}`}>{ln("split", `M2 0 V${b.h + 20}`, K.white, 4, { strokeDasharray: "8 6" })}</svg>
        </div>
      ) : null}
      {geo.labels.map((l, i) => {
        const p = i === 0 ? at.ours : at.theirs;
        const tint = i === 0 ? ours : K.green;
        const word = i === 0 ? K.white : K.green;
        return (
          <Fragment key={i}>
            <div data-part={i === 0 ? "tick-ours" : "tick-theirs"} style={abs({ left: l.tickX - 3, top: geo.tick.y, width: 6, height: geo.tick.h, background: tint, opacity: p > 0 ? 1 : 0, ...glowBox(tint) })} />
            <div data-part={i === 0 ? "label-ours" : "label-theirs"} style={abs({ left: l.x, top: l.y, width: l.w, height: l.h, flexDirection: "column", alignItems: "center", opacity: p > 0 ? 1 : 0 })}>
              <div style={box({ fontSize: l.nameSize, fontWeight: K.bold, lineHeight: 1.3, ...plate(), ...ink(word) })}>{l.name}</div>
              {l.amount ? <div style={box({ fontSize: l.amtSize, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(word) })}>{l.amount}</div> : null}
            </div>
          </Fragment>
        );
      })}
      {geo.notYet ? <Words d={d} an={s.theirs} g={geo.notYet} /> : null}
      <InfoCard d={d} an={s.card} r={geo.card} part="card"><Blocks blocks={geo.card.blocks} /></InfoCard>
      <Words d={d} an={s.title} g={geo.when} />
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- copay: ร่วมจ่าย ---------- */

/** ร่วมจ่าย: a bill sheet cut by a dashed red line at the percent (to scale); what we pay at the top, the insurer's share below it */
function copay(d: Dev, show: Health2Show<"copay">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = copayGeo(c.size, show, place(d));
  const at = copayAt(s, t);
  const sh = geo.sheet;
  const ours = paidInk();
  const rows = 7;
  const cutW = sh.w + 32;
  return (
    <>
      <H2Title d={d} show={show} />
      <div data-part="tab" style={abs({ left: geo.tab.x, top: geo.tab.y, width: geo.tab.w, height: geo.tab.h, justifyContent: "center", fontSize: geo.tab.size, fontWeight: K.bold, lineHeight: 1.3, ...ink(K.white), opacity: at.sheet > 0 ? 1 : 0 })}>{W.bill}</div>
      <div data-part="sheet" style={abs({ left: sh.x, top: sh.y, width: sh.w, height: sh.h })}>
        <E an={s.sheet} t={t} style={{ position: "absolute", left: 0, top: 0, width: sh.w, height: sh.h }}>
          <div style={abs({ left: 0, top: 0, width: sh.w, height: sh.h, background: K.tile, border: `${pen(4)}px solid ${K.white}`, borderRadius: 10, ...glowBox(K.white) })} />
          {at.ours > 0 ? <div data-part="ours" style={abs({ left: 4, top: geo.ours.y - sh.y, width: sh.w - 8, height: geo.ours.h, ...block(ours, 0), borderRadius: 0, opacity: clamp01(at.ours * 2) })} /> : null}
          {at.theirs > 0 && geo.theirs.h > 0 ? <div data-part="theirs" style={abs({ left: 4, top: geo.theirs.y - sh.y, width: sh.w - 8, height: geo.theirs.h, ...block(K.green, 0), borderRadius: 0, opacity: clamp01(at.theirs * 2) })} /> : null}
          <svg width={sh.w} height={sh.h} viewBox={`0 0 ${sh.w} ${sh.h}`} style={{ position: "absolute", left: 0, top: 0 }}>
            {Array.from({ length: rows }, (_, i) => { const y = 4 + ((sh.h - 8) * (i + 1)) / (rows + 1); return ln(`row${i}`, `M20 ${r1(y)} H${sh.w - 20}`, K.white, 3, { opacity: 0.22 }); })}
          </svg>
        </E>
      </div>
      {at.cut > 0 ? (
        <div data-part="cut" style={abs({ left: sh.x - 16, top: geo.cutY - 5, width: cutW, height: 10 })}>
          <svg width={cutW} height={10} viewBox={`0 0 ${cutW} 10`}>{ln("cut", `M0 5 H${r1(cutW * at.cut)}`, K.red, 6, { strokeDasharray: "16 10" })}</svg>
        </div>
      ) : null}
      {at.ours > 0 ? <div data-part="bracket-ours" style={abs({ left: geo.bracket.x, top: geo.ours.y + 2, width: geo.bracket.w, height: Math.max(4, geo.ours.h - 4), ...block(ours, 6), opacity: clamp01(at.ours * 2) })} /> : null}
      {at.theirs > 0 && geo.theirs.h > 0 ? <div data-part="bracket-theirs" style={abs({ left: geo.bracket.x, top: geo.theirs.y + 2, width: geo.bracket.w, height: Math.max(4, geo.theirs.h - 4), ...block(K.green, 6), opacity: clamp01(at.theirs * 2) })} /> : null}
      <div data-part="label-ours" style={abs({ left: geo.labels.ours.x, top: geo.labels.ours.y, width: geo.labels.ours.w, height: geo.labels.ours.h })}>
        <Say an={s.ours} t={t} style={{ width: geo.labels.ours.w, height: geo.labels.ours.h, flexDirection: "column", alignItems: "flex-start" }}><Blocks blocks={[geo.labels.ours.blk]} align="flex-start" /></Say>
      </div>
      {geo.labels.theirs ? (
        <div data-part="label-theirs" style={abs({ left: geo.labels.theirs.x, top: geo.labels.theirs.y, width: geo.labels.theirs.w, height: geo.labels.theirs.h })}>
          <Say an={s.theirs} t={t} style={{ width: geo.labels.theirs.w, height: geo.labels.theirs.h, flexDirection: "column", alignItems: "flex-start" }}><Blocks blocks={[geo.labels.theirs.blk]} align="flex-start" /></Say>
        </div>
      ) : null}
      {geo.card ? (
        <InfoCard d={d} an={s.card} r={geo.card} part="card">
          <div style={box({ flexDirection: "column", alignItems: "center" })}>
            <Blocks blocks={[geo.card.blocks[0]]} />
            <div style={box({ alignItems: "center", justifyContent: "center", marginTop: 2 })}>
              <svg width={Math.round(geo.card.blocks[1].size * 0.9)} height={Math.round(geo.card.blocks[1].size * 0.7)} viewBox="0 0 36 28">{ln("arrow", ARROW_D, K.white, 5)}</svg>
              <div style={box({ width: Math.round(geo.card.blocks[1].size * 0.25) })} />
              <Blocks blocks={[geo.card.blocks[1]]} />
            </div>
            <Blocks blocks={[geo.card.blocks[2]]} />
          </div>
        </InfoCard>
      ) : null}
      <Words d={d} an={s.title} g={geo.when} />
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- renew98: ต่ออายุได้ถึง ---------- */

/** ต่ออายุได้ถึง: a timeline from วันนี้ to the renewal age, a dashed arc over it, and what the renewal is bound by */
function renew98(d: Dev, show: Health2Show<"renew98">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = renewGeo(c.size, show, place(d));
  const at = renewAt(s, t);
  const D = geo.dot;
  const pts = Array.from({ length: 41 }, (_, i) => arcPoint(geo.arc, (i / 40) * at.arc));
  const x0 = geo.x1 - D - 6;
  const top = geo.arc.y - geo.arc.peak - 6;
  const arcPath = at.arc > 0 ? `M${pts.map((p) => `${r1(p.x - x0)} ${r1(p.y - top)}`).join(" L")}` : "";
  const svgW = geo.x2 - geo.x1 + (D + 6) * 2;
  const svgH = geo.peak + D * 2 + 12;
  const dot = (part: string, cx: number, cy: number, an: Anim | undefined, color: string) => (
    <div data-part={part} style={abs({ left: cx - D - 4, top: cy - D - 4, width: D * 2 + 8, height: D * 2 + 8 })}>
      <E an={an} t={t} style={{ width: D * 2 + 8, height: D * 2 + 8 }}>
        <svg width={D * 2 + 8} height={D * 2 + 8} viewBox={`0 0 ${D * 2 + 8} ${D * 2 + 8}`}>{shape("dot", ovalD(D + 4, D + 4, D), color, 4, true)}</svg>
      </E>
    </div>
  );
  return (
    <>
      <H2Title d={d} show={show} />
      <div data-part="timeline" style={abs({ left: x0, top, width: svgW, height: svgH })}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          {ln("line", `M${D + 6} ${r1(geo.lineY - top)} H${r1(D + 6 + (geo.x2 - geo.x1) * at.line)}`, K.white, 7)}
          {arcPath ? ln("arc", arcPath, K.green, 6, { strokeDasharray: "16 12" }) : null}
        </svg>
      </div>
      {dot("dot-today", geo.x1, geo.lineY, s.today, K.gold)}
      {dot("dot-to", geo.x2, geo.lineY, s.to, K.green)}
      <div data-part="label-today" style={abs({ left: geo.today.x, top: geo.today.y, width: geo.today.w, height: geo.labelsH })}>
        <Say an={s.today} t={t} style={{ width: geo.today.w, height: geo.labelsH, justifyContent: "center" }}><Blocks blocks={geo.today.blocks} /></Say>
      </div>
      <div data-part="label-to" style={abs({ left: geo.to.x, top: geo.to.y, width: geo.to.w, height: geo.labelsH })}>
        <Say an={s.to} t={t} style={{ width: geo.to.w, height: geo.labelsH, justifyContent: "center" }}><Blocks blocks={geo.to.blocks} /></Say>
      </div>
      <InfoCard d={d} an={s.card} r={geo.card} part="card"><Blocks blocks={geo.card.blocks} /></InfoCard>
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- parentshealth: ประกันสุขภาพให้พ่อแม่ ---------- */

/** a caption under a picture: words in the Kit's ink, fading in */
function Caption({ d, an, cap, color }: { d: Dev; an?: Anim; cap: { text: string; size: number; x: number; y: number; w: number; h: number }; color: string }) {
  const K = kit();
  return (
    <Say an={an} t={d.t} style={{ position: "absolute", left: cap.x, top: cap.y, width: cap.w, height: cap.h, justifyContent: "center", fontSize: cap.size, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(color) }}>{cap.text}</Say>
  );
}

/** ประกันสุขภาพให้พ่อแม่: the parents (ผู้เอาประกัน), the child who pays (ลูกจ่ายเบี้ย), the tax card and its foot */
function parentshealth(d: Dev, show: Health2Show<"parentshealth">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = parentsGeo(c.size, show, place(d));
  const a = payArrow(geo.arrow.w, geo.arrow.h);
  const coin = paidInk();
  return (
    <>
      <H2Title d={d} show={show} />
      {geo.people.map((p) => <Person key={p.id} d={d} part={p.id === 2 ? "child" : `parent${p.id}`} r={p} an={p.id === 2 ? s.child : enterAt(s.parents, p.id)} color={p.id === 2 ? K.green : K.sky} />)}
      <div data-part="arrow" style={abs({ left: geo.arrow.x, top: geo.arrow.y, width: geo.arrow.w, height: geo.arrow.h })}>
        <E an={s.child} t={t} style={{ width: geo.arrow.w, height: geo.arrow.h }}>
          <svg width={geo.arrow.w} height={geo.arrow.h} viewBox={`0 0 ${geo.arrow.w} ${geo.arrow.h}`}>
            {ln("line", a.line, K.white, 6, { strokeDasharray: "14 10" })}
            {ln("head", a.head, K.white, 6)}
            {shape("coin", ovalD(a.coin.cx, a.coin.cy, a.coin.r), coin, 4, true)}
            {ln("coin-in", ovalD(a.coin.cx, a.coin.cy, a.coin.inner), coin, 3)}
          </svg>
        </E>
      </div>
      <Caption d={d} an={s.parents} cap={geo.caps.parents} color={K.white} />
      <Caption d={d} an={s.child} cap={geo.caps.child} color={K.green} />
      <InfoCard d={d} an={s.card} r={geo.card} part="card"><Blocks blocks={geo.card.blocks} /></InfoCard>
      <Words d={d} an={s.foot} g={geo.foot} />
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- groupcost: ต้นทุนต่อหัว ประกันกลุ่ม ---------- */

/** ต้นทุนต่อหัว ประกันกลุ่ม: six people, the head-count band under them (words from the code), the year's cost and the month's */
function groupcost(d: Dev, show: Health2Show<"groupcost">) {
  const K = kit();
  const { c, s } = d;
  const geo = groupGeo(c.size, show, place(d));
  return (
    <>
      <H2Title d={d} show={show} />
      {geo.people.map((p) => <Person key={p.id} d={d} part={`staff${p.id}`} r={p} an={enterAt(s.people, p.id)} color={K.sky} />)}
      {geo.band ? <Caption d={d} an={s.people} cap={geo.band} color={K.white} /> : null}
      <InfoCard d={d} an={s.year} r={geo.year} part="card-year"><Blocks blocks={geo.year.blocks} /></InfoCard>
      <InfoCard d={d} an={s.month} r={geo.monthCard} part="card-month"><Blocks blocks={geo.monthCard.blocks} /></InfoCard>
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- hospitals: โรงพยาบาลในเครือ ---------- */

/** โรงพยาบาลในเครือ: one bar a province to one scale from zero, the count at its end, the total over them, the date and the line under */
function hospitals(d: Dev, show: Health2Show<"hospitals">) {
  const K = kit();
  const { c, t, s } = d;
  const geo = hospitalsGeo(c.size, show, place(d));
  return (
    <>
      <H2Title d={d} show={show} />
      <Say an={s.bar0} t={t} style={{ position: "absolute", left: geo.head.x, top: geo.head.y, width: geo.head.w, height: geo.head.h, justifyContent: "center" }}><Blocks blocks={[geo.head.blk]} /></Say>
      {geo.bars.map((bar, i) => {
        const p = look(s[`bar${i}`], t).p;
        const now = Math.round(bar.w * p);
        return (
          <Fragment key={bar.full + i}>
            <Say an={s[`bar${i}`]} t={t} style={{ position: "absolute", left: bar.nameBox.x, top: bar.nameBox.y, width: bar.nameBox.w, height: bar.rowH, alignItems: "center", fontSize: geo.nameSize, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(K.white) }}>{bar.name}</Say>
            {now > 0 ? <div data-part={`bar${i}`} style={abs({ left: bar.x, top: bar.y + 4, width: now, height: bar.h, ...block(K.green, 10) })} /> : null}
            {p > 0 ? <div data-part={`count${i}`} style={abs({ left: bar.x + now + 10, top: bar.y, width: geo.countW, height: bar.rowH, alignItems: "center", fontSize: geo.countSize, fontWeight: K.bold, lineHeight: 1.3, whiteSpace: "nowrap", ...plate(), ...ink(K.white) })}>{bar.countText}</div> : null}
          </Fragment>
        );
      })}
      <Words d={d} an={s.foot} g={geo.foot} />
      <Words d={d} an={s.line} g={geo.line} />
      <NoteLines n={geo.note} d={d} />
    </>
  );
}

/* ---------- paclaim: อุบัติเหตุหนึ่งครั้ง ---------- */

/** อุบัติเหตุหนึ่งครั้ง: what the treatment may cost at most; when the plan has it, the weekly sum for the weeks off work and their most */
function paclaim(d: Dev, show: Health2Show<"paclaim">) {
  const K = kit();
  const { c, s } = d;
  const geo = paclaimGeo(c.size, show, place(d));
  const withIcon = (icon: ReactNode, blocks: Blk[]) => (
    <div style={box({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: geo.medical.pad })}>
      <div style={box({ flexShrink: 0 })}>{icon}</div>
      <Blocks blocks={blocks} />
    </div>
  );
  return (
    <>
      <H2Title d={d} show={show} />
      <InfoCard d={d} an={s.medical} r={geo.medical} part="card-medical">{withIcon(<Tile kind="hospital" size={geo.ic} bg={K.green} color={K.white} />, geo.medical.blocks)}</InfoCard>
      {geo.weekly ? <InfoCard d={d} an={s.weekly} r={geo.weekly} part="card-weekly">{withIcon(<Tile kind="calendar" size={geo.ic} bg={K.gold} color={K.ground} />, geo.weekly.blocks)}</InfoCard> : null}
      {geo.weeks ? <InfoCard d={d} an={s.weeks} r={geo.weeks} part="card-weeks"><Blocks blocks={geo.weeks.blocks} /></InfoCard> : null}
      <NoteLines n={geo.note} d={d} />
    </>
  );
}
