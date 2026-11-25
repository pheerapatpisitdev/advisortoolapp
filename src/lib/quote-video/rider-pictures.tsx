import { Fragment, isValidElement, type CSSProperties, type ReactNode } from "react";
import { lifeRow, type PayoutRow, type QuoteVideoFacts, type RiderScene } from "./script";

/**
 * Life Protect's rider scenes (owner, 2026-11-21, ก ก ก on https://claude.ai/artifact/HvVdgdGq4oajv1Hjd1ZBv2):
 * the package at a glance, one picture a rider that shows when it pays and how much, and what each event
 * pays across the contracts. Drawn once here for all four drawers — Motion portrait (motion.tsx) and wide
 * (wide.tsx), the classic portrait (draw.tsx) and wide (classic-wide.tsx) — each passing its colours and
 * how a piece comes in (`Draw`). Flex boxes and plain SVG only, as the drawing library takes them.
 */

/** the colours a drawer paints these in: Motion's constants (so its themes repaint them), or the classic card's */
export interface RiderPal {
  ink: string;
  /** a figure's highlight and the text on it */
  fill: string;
  /** a figure written straight on the ground (Motion's gold, the classic card's navy) */
  figure: string;
  onFill: string;
  /** a card and the text on it */
  card: string;
  onCard: string;
  red: string;
  green: string;
  sky: string;
}

export interface Draw {
  pal: RiderPal;
  /** a piece of the picture, brought in as the drawer does it (Motion: El with the scene's spec; classic: as it is) */
  piece: (name: string, style: CSSProperties, children?: ReactNode) => ReactNode;
  /** how far a counted figure has counted, 0 → 1 */
  count: number;
}

const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });

/** a piece's children as a list: the drawer lays a fragment out as a box of its own, a row, which would undo the piece's column */
export function unwrap(children: ReactNode): ReactNode {
  return isValidElement(children) && children.type === Fragment ? (children.props as { children?: ReactNode }).children : children;
}
const px = (n: number, big: number) => Math.round(n * big);
const baht = (n: number) => n.toLocaleString("en-US");
const counted = (n: number, p: number) => (p >= 1 ? n : Math.round((n * p) / 100) * 100);

/** the scene's heading: what the rider is, the line under it, its price where the split says it */
export function riderHead(r: RiderScene, per: string, d: Draw, w: number, big: number): ReactNode {
  const { pal } = d;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {d.piece("kicker", { fontSize: px(66, big), fontWeight: 700, color: pal.ink, lineHeight: 1.2 }, r.title)}
      {d.piece("sub", { fontSize: px(38, big), color: pal.ink, opacity: 0.8, marginTop: px(6, big) }, r.sub)}
      {r.price
        ? d.piece("price", { alignSelf: "flex-start", marginTop: px(22, big), background: pal.fill, color: pal.onFill, borderRadius: px(40, big), padding: `${px(6, big)}px ${px(30, big)}px`, fontSize: px(42, big), fontWeight: 700 },
          `${per} ${r.price} บาท${r.rises ? " · ปรับตามอายุ" : ""}`)
        : null}
    </div>
  );
}

/** what the rider pays, in a card under its picture */
export function riderWhat(r: RiderScene, d: Draw, w: number, big: number): ReactNode {
  if (!r.what) return null;
  return d.piece("what", { width: w, background: d.pal.card, color: d.pal.onCard, borderRadius: px(30, big), padding: `${px(20, big)}px ${px(30, big)}px`, fontSize: px(36, big), lineHeight: 1.4 }, r.what);
}

/** the rider's own picture, in a box w wide */
export function riderPicture(r: RiderScene, f: QuoteVideoFacts, d: Draw, w: number, big: number): ReactNode {
  switch (r.kind) {
    case "waiver": return waiverPicture(r, f, d, w, big);
    case "medical": return medicalPicture(r, d, w, big);
    case "dci": return dciPicture(r, d, w, big);
    case "ci123": return ciPicture(r, d, w, big);
    case "ap": return apPicture(r, d, w, big);
    case "ecare": return ecarePicture(r, d, w, big);
  }
}

/** a round label: a pill in a colour of its own */
const pill = (d: Draw, name: string, color: string, text: string, big: number, filled = false) =>
  d.piece(name, {
    alignSelf: "flex-start", borderRadius: px(40, big), padding: `${px(4, big)}px ${px(26, big)}px`, fontSize: px(34, big), fontWeight: 600,
    ...(filled ? { background: color, color: d.pal.onFill } : { border: `${px(4, big)}px solid ${color}`, color }),
  }, text);

/** ยกเว้นเบี้ย: the instalments as coins, paid up to an example disability, the rest waived, the cover still whole */
function waiverPicture(r: Extract<RiderScene, { kind: "waiver" }>, f: QuoteVideoFacts, d: Draw, w: number, big: number) {
  const { pal } = d;
  const n = r.paid + r.left;
  const perRow = n <= 10 ? n : n <= 20 ? 10 : n <= 39 ? 13 : 16;
  const gap = px(n > 20 ? 10 : 14, big);
  const size = Math.min(px(74, big), Math.floor((w - gap * (perRow - 1)) / perRow));
  const coin = (i: number) => {
    const paid = i < r.paid;
    return (
      <div key={i} style={box({
        width: size, height: size, borderRadius: size / 2, marginRight: (i + 1) % perRow ? gap : 0, marginBottom: gap,
        ...(paid ? { background: pal.fill } : { border: `${Math.max(3, px(4, big))}px dashed ${pal.green}` }),
      })} />
    );
  };
  const cover = lifeRow(f)?.amount ?? f.lead.amount;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {d.piece("pic0", { fontSize: px(36, big), color: pal.ink, marginBottom: px(14, big) }, `เบี้ย ${n} ปี (อายุ ${r.startAge} → ${r.startAge + n - 1})`)}
      {d.piece("pic0", { flexWrap: "wrap", width: w }, Array.from({ length: n }, (_, i) => coin(i)))}
      {pill(d, "pic1", pal.red, `${r.plus ? "ทุพพลภาพหรือโรคร้ายแรง" : "ทุพพลภาพสิ้นเชิงถาวร"} · ตัวอย่างอายุ ${r.startAge + r.paid}`, big)}
      {d.piece("pic2", { fontSize: px(40, big), fontWeight: 600, color: pal.green, marginTop: px(16, big) }, `ที่เหลือ ${r.left} ปี ไม่ต้องจ่าย`)}
      {d.piece("pic3", { alignItems: "center", marginTop: px(26, big) }, (
        <>
          <svg width={px(110, big)} height={px(122, big)} viewBox="0 0 120 130">
            <path d="M60 6 L110 25 V62 C110 96 86 116 60 126 C34 116 10 96 10 62 V25 Z" fill={pal.fill} />
          </svg>
          <div style={box({ flexDirection: "column", marginLeft: px(24, big) })}>
            <div style={box({ fontSize: px(38, big), color: pal.ink })}>ความคุ้มครองยังอยู่ครบ</div>
            <div style={box({ fontSize: px(56, big), fontWeight: 700, color: pal.figure })}>{`${cover} บาท`}</div>
          </div>
        </>
      ))}
    </div>
  );
}

/** ค่าชดเชยรายวัน: a bed, five days ticked off, what they come to */
function medicalPicture(r: Extract<RiderScene, { kind: "medical" }>, d: Draw, w: number, big: number) {
  const { pal } = d;
  const dayW = Math.floor((w - px(14, big) * (r.days - 1)) / r.days);
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {d.piece("pic0", { alignItems: "center" }, (
        <>
          <svg width={px(230, big)} height={px(150, big)} viewBox="0 0 230 150">
            <path d="M14 30 V130 M14 104 H216 V130" fill="none" stroke={pal.ink} strokeWidth={9} strokeLinecap="round" />
            <path d="M40 74 h52 v30 h-52 z" fill={pal.sky} />
            <path d="M92 90 H216" fill="none" stroke={pal.ink} strokeWidth={9} strokeLinecap="round" />
          </svg>
          <svg width={px(96, big)} height={px(96, big)} viewBox="0 0 96 96" style={{ marginLeft: px(24, big) }}>
            <path d="M34 8 h28 v26 h26 v28 h-26 v26 h-28 v-26 h-26 v-28 h26 z" fill={pal.red} />
          </svg>
          <div style={box({ flexDirection: "column", marginLeft: px(36, big) })}>
            <div style={box({ fontSize: px(38, big), color: pal.ink })}>นอนโรงพยาบาล</div>
            <div style={box({ fontSize: px(52, big), fontWeight: 700, color: pal.figure })}>{`วันละ ${baht(r.perDay)}`}</div>
          </div>
        </>
      ))}
      <div style={box({ marginTop: px(34, big), width: w })}>
        {Array.from({ length: r.days }, (_, i) => d.piece(`day${i}`, {
          width: dayW, marginRight: i < r.days - 1 ? px(14, big) : 0, flexDirection: "column", alignItems: "center",
          background: pal.card, color: pal.onCard, borderRadius: px(20, big), padding: `${px(12, big)}px 0`,
        }, (
          <>
            <div style={box({ fontSize: px(32, big) })}>{`วันที่ ${i + 1}`}</div>
            <div style={box({ fontSize: px(32, big), fontWeight: 700 })}>{`+${baht(r.perDay)}`}</div>
          </>
        )))}
      </div>
      {d.piece("big", { marginTop: px(34, big), alignItems: "flex-end" }, (
        <>
          <div style={box({ fontSize: px(40, big), color: pal.ink, marginRight: px(20, big), marginBottom: px(12, big) })}>{`ตัวอย่าง นอน ${r.days} วัน รับ`}</div>
          <div style={box({ background: pal.fill, color: pal.onFill, borderRadius: px(30, big), padding: `0 ${px(30, big)}px`, fontSize: px(84, big), fontWeight: 700 })}>{baht(counted(r.perDay * r.days, d.count))}</div>
          <div style={box({ fontSize: px(40, big), color: pal.ink, marginLeft: px(16, big), marginBottom: px(12, big) })}>บาท</div>
        </>
      ))}
    </div>
  );
}

/** the gold lump sum, counted up, with the words before it */
function lump(d: Draw, label: string, sum: number, big: number) {
  return d.piece("big", { flexDirection: "column", alignItems: "center", alignSelf: "center", marginTop: px(20, big) }, (
    <>
      <div style={box({ fontSize: px(42, big), color: d.pal.ink })}>{label}</div>
      <div style={box({ background: d.pal.fill, color: d.pal.onFill, borderRadius: px(40, big), padding: `0 ${px(40, big)}px`, fontSize: px(110, big), fontWeight: 700, lineHeight: 1.2 })}>
        {baht(counted(sum, d.count))}
      </div>
      <div style={box({ fontSize: px(40, big), color: d.pal.ink })}>บาท</div>
    </>
  ));
}

/** DCI: a critical illness or death — either one — pays the lump sum */
function dciPicture(r: Extract<RiderScene, { kind: "dci" }>, d: Draw, w: number, big: number) {
  const { pal } = d;
  const orW = px(120, big);
  const cardW = Math.floor((w - orW) / 2);
  const card = (name: string, top: string, under?: string) => d.piece(name, {
    width: cardW, minHeight: px(170, big), flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: pal.card, color: pal.onCard, borderRadius: px(30, big), padding: `${px(16, big)}px ${px(20, big)}px`,
  }, (
    <>
      <div style={box({ fontSize: px(40, big), fontWeight: 700, textAlign: "center" })}>{top}</div>
      {under ? <div style={box({ fontSize: px(36, big), color: pal.red, fontWeight: 600 })}>{under}</div> : null}
    </>
  ));
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ width: w, alignItems: "center" })}>
        {card("pic0", "ตรวจพบโรคร้ายแรง", r.diseases ? `1 ใน ${r.diseases} โรค` : undefined)}
        {d.piece("pic1", { width: orW, justifyContent: "center", fontSize: px(46, big), fontWeight: 700, color: pal.figure }, "หรือ")}
        {card("pic2", "เสียชีวิต")}
      </div>
      {d.piece("pic3", { alignSelf: "center", marginTop: px(16, big) }, (
        <svg width={px(80, big)} height={px(70, big)} viewBox="0 0 80 70"><path d="M40 4 V50 M18 32 L40 60 L62 32" fill="none" stroke={pal.ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" /></svg>
      ))}
      {lump(d, "รับเงินก้อน", r.sum, big)}
      {r.coverToAge ? <div style={box({ marginTop: px(24, big), alignSelf: "center" })}>{pill(d, "pic4", pal.green, `คุ้มครองถึงอายุ ${r.coverToAge}`, big, true)}</div> : null}
    </div>
  );
}

/** CI 123: the three stages as stairs (to scale, the lowest kept readable), what they pay, the other parts under them */
function ciPicture(r: Extract<RiderScene, { kind: "ci123" }>, d: Draw, w: number, big: number) {
  const { pal } = d;
  const n = r.stairs.length || 1;
  const gap = px(28, big);
  const colW = Math.floor((w - gap * (n - 1)) / n);
  const top = Math.max(...r.stairs.map((x) => x.amount), 1);
  const maxH = px(420, big);
  const minH = px(70, big);
  const shades = [pal.sky, pal.card, pal.fill];
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ width: w, alignItems: "flex-end" })}>
        {r.stairs.map((x, i) => {
          const h = Math.max(minH, Math.round((x.amount / top) * maxH));
          return d.piece(`pic${i}`, { width: colW, marginRight: i < n - 1 ? gap : 0, flexDirection: "column", alignItems: "center" }, (
            <>
              <div style={box({ fontSize: px(i === n - 1 ? 50 : 40, big), fontWeight: 700, color: i === n - 1 ? pal.figure : pal.ink, marginBottom: px(8, big) })}>
                {`${i === n - 1 ? "สูงสุด " : ""}${baht(x.amount)}`}
              </div>
              <div style={box({ width: colW, height: h, background: shades[i] ?? pal.fill, borderRadius: `${px(18, big)}px ${px(18, big)}px 0 0` })} />
            </>
          ));
        })}
      </div>
      <div style={box({ width: w, marginTop: px(12, big) })}>
        {r.stairs.map((x, i) => d.piece(`pic${i}`, { width: colW, marginRight: i < n - 1 ? gap : 0, flexDirection: "column", alignItems: "center" }, (
          <>
            <div style={box({ fontSize: px(32, big), fontWeight: 600, color: pal.ink, textAlign: "center" })}>{x.label}</div>
            <div style={box({ fontSize: px(28, big), color: pal.ink, opacity: 0.8, textAlign: "center" })}>{x.share}</div>
          </>
        )))}
      </div>
      {r.more.length
        ? d.piece("pic3", { marginTop: px(24, big), fontSize: px(32, big), color: pal.ink, flexWrap: "wrap" }, `+ ${r.more.map((x) => `${x.label} ${x.share}`).join(" · ")}`)
        : null}
      <div style={box({ marginTop: px(20, big) })}>{pill(d, "pic4", pal.green, `${r.diseases ? `${r.diseases} โรค · ` : ""}เคลมได้หลายครั้ง`, big, true)}</div>
    </div>
  );
}

/** a car met by a bolt: the accident */
function crash(pal: RiderPal, big: number) {
  return (
    <svg width={px(260, big)} height={px(150, big)} viewBox="0 0 260 150">
      <path d="M14 86 h120 l26 -36 h50 l26 36 h14 v34 H14 z" fill={pal.sky} />
      <circle cx={64} cy={124} r={18} fill={pal.ink} /><circle cx={204} cy={124} r={18} fill={pal.ink} />
      <path d="M70 8 l-24 46 h26 l-22 46" fill="none" stroke={pal.red} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** AP: death, a limb or sight lost in an accident, up to the sum */
function apPicture(r: Extract<RiderScene, { kind: "ap" }>, d: Draw, w: number, big: number) {
  const { pal } = d;
  const gap = px(18, big);
  const cw = Math.floor((w - gap * 2) / 3);
  const outcomes = ["เสียชีวิต", "สูญเสียอวัยวะ", "สูญเสียสายตา"];
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {d.piece("pic0", { alignSelf: "center" }, crash(pal, big))}
      <div style={box({ width: w, marginTop: px(26, big) })}>
        {outcomes.map((o, i) => d.piece(`pic${i + 1}`, {
          width: cw, marginRight: i < 2 ? gap : 0, justifyContent: "center", background: pal.card, color: pal.onCard,
          borderRadius: px(26, big), padding: `${px(20, big)}px ${px(8, big)}px`, fontSize: px(36, big), fontWeight: 600,
        }, o))}
      </div>
      {lump(d, "จากอุบัติเหตุ รับสูงสุด", r.sum, big)}
      {r.coverToAge ? <div style={box({ marginTop: px(24, big), alignSelf: "center" })}>{pill(d, "pic4", pal.green, `คุ้มครองถึงอายุ ${r.coverToAge}`, big, true)}</div> : null}
    </div>
  );
}

/** ECARE: the accident sum, disability, hospital, treatment up to 5% of the sum */
function ecarePicture(r: Extract<RiderScene, { kind: "ecare" }>, d: Draw, w: number, big: number) {
  const { pal } = d;
  const gap = px(20, big);
  const cw = Math.floor((w - gap) / 2);
  const cells: [string, string][] = [
    ["อุบัติเหตุ", `ทุน ${baht(r.sum)}`], ["ทุพพลภาพ", "ตามกรมธรรม์"],
    ["นอนโรงพยาบาล", "ตามกรมธรรม์"], ["ค่ารักษา", `ไม่เกิน ${baht(r.care)}`],
  ];
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {d.piece("pic0", { alignSelf: "center", marginBottom: px(26, big) }, crash(pal, big))}
      <div style={box({ width: w, flexWrap: "wrap" })}>
        {cells.map(([a, b], i) => d.piece(`pic${i + 1}`, {
          width: cw, marginRight: i % 2 ? 0 : gap, marginBottom: gap, flexDirection: "column", alignItems: "center",
          background: pal.card, color: pal.onCard, borderRadius: px(26, big), padding: `${px(22, big)}px ${px(10, big)}px`,
        }, (
          <>
            <div style={box({ fontSize: px(38, big), fontWeight: 600 })}>{a}</div>
            <div style={box({ fontSize: px(40, big), fontWeight: 700 })}>{b}</div>
          </>
        )))}
      </div>
      {d.piece("pic4", { alignSelf: "center", fontSize: px(32, big), color: pal.ink }, "ค่ารักษาไม่เกิน 5% ของทุน")}
    </div>
  );
}

/**
 * แพ็กเกจของคุณ: the life cover as a shield in the middle, each rider a badge round it, joined to it.
 * `h`: the picture's height (the badges sit on an ellipse inside it).
 */
export function packagePicture(f: QuoteVideoFacts, d: Draw, w: number, h: number, big: number): ReactNode {
  const { pal } = d;
  const sc = f.riders?.scenes ?? [];
  const n = sc.length;
  const badge = px(200, big);
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(0, w / 2 - badge / 2 - px(6, big));
  const ry = Math.max(0, h / 2 - badge / 2 - px(6, big));
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  };
  const shieldW = px(250, big);
  const shieldH = px(280, big);
  const life = lifeRow(f)?.amount ?? f.lead.amount;
  const tints = [pal.red, pal.green, pal.fill, pal.sky, pal.red, pal.green];
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      {d.piece("lines", { position: "absolute", left: 0, top: 0, width: w, height: h }, (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {sc.map((_, i) => {
            const p = at(i);
            return <path key={i} d={`M${cx} ${cy} L${p.x.toFixed(0)} ${p.y.toFixed(0)}`} fill="none" stroke={pal.ink} strokeWidth={4} strokeDasharray="12 10" />;
          })}
        </svg>
      ))}
      {d.piece("shield", { position: "absolute", left: cx - shieldW / 2, top: cy - shieldH / 2, width: shieldW, height: shieldH }, (
        <>
          <svg width={shieldW} height={shieldH} viewBox="0 0 120 134" style={{ position: "absolute", left: 0, top: 0 }}>
            <path d="M60 4 L114 24 V64 C114 100 88 120 60 130 C32 120 6 100 6 64 V24 Z" fill={pal.fill} />
          </svg>
          {/* the figure on a box of its own: a theme repaints a box's ground with its text, a drawn shape's on its own */}
          <div style={box({ position: "absolute", left: 0, top: 0, width: shieldW, height: shieldH, alignItems: "center", justifyContent: "center" })}>
            <div style={box({ flexDirection: "column", alignItems: "center", background: pal.fill, borderRadius: px(20, big), padding: `${px(4, big)}px ${px(10, big)}px` })}>
              <div style={box({ fontSize: px(40, big), color: pal.onFill })}>ชีวิต</div>
              <div style={box({ fontSize: px(44, big), fontWeight: 700, color: pal.onFill })}>{life}</div>
            </div>
          </div>
        </>
      ))}
      {sc.map((r, i) => {
        const p = at(i);
        return d.piece(`b${i}`, {
          position: "absolute", left: Math.round(p.x - badge / 2), top: Math.round(p.y - badge / 2), width: badge, height: badge, borderRadius: badge / 2,
          background: pal.card, border: `${px(8, big)}px solid ${tints[i % tints.length]}`, alignItems: "center", justifyContent: "center",
          color: pal.onCard, fontSize: px(r.badge.length > 8 ? 30 : 40, big), fontWeight: 700, textAlign: "center", padding: px(10, big),
        }, r.badge);
      })}
    </div>
  );
}

/** เกิดเรื่องนี้ ได้เท่าไร: a row an event, the contracts that pay it small under it, what they come to on the right */
export function payoutList(rows: PayoutRow[], d: Draw, w: number, big: number): ReactNode {
  const { pal } = d;
  const tone: Record<PayoutRow["tone"], string> = { early: pal.fill, major: pal.red, hospital: pal.green, accident: pal.sky, waiver: pal.green };
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {rows.map((r, i) => d.piece(`row${i}`, {
        width: w, alignItems: "center", justifyContent: "space-between", background: pal.card, color: pal.onCard, borderRadius: px(26, big),
        borderLeft: `${px(16, big)}px solid ${tone[r.tone]}`, padding: `${px(16, big)}px ${px(26, big)}px`, marginBottom: px(18, big),
      }, (
        <>
          <div style={box({ flexDirection: "column", flexShrink: 1, marginRight: px(16, big) })}>
            <div style={box({ fontSize: px(38, big), fontWeight: 700 })}>{r.event}</div>
            <div style={box({ fontSize: px(28, big), opacity: 0.8 })}>{r.from}</div>
          </div>
          <div style={box({ fontSize: px(r.amount.length > 10 ? 38 : 52, big), fontWeight: 700, flexShrink: 0 })}>{r.amount}</div>
        </>
      )))}
    </div>
  );
}
