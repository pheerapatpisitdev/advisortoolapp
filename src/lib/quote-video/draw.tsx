import type { CSSProperties, ReactNode } from "react";
import { Chart, chartBlockHeight } from "@/app/api/card/chart-drawing";
import { insuredFace } from "@/app/api/card/insured-face";
import { BLUE_PEN, CARD_PALETTE as P, QUOTE_VIDEO_COLORS as C } from "@/lib/card-theme";
import { highlighterUri } from "@/lib/highlighter";
import type { CardChart } from "@/lib/quote-card";
import type { QuoteVideoFacts, SceneKey } from "./script";
import type { Extra } from "./told";
import { colsOf, PHOTO, ROW_H, TABLE, valueHeads } from "./table-geo";
import { noteInWindow, type TableNote } from "./table-pen";
import { PENSION_VIDEO_COLUMNS } from "./pension-table";
import { bandAges, shortBaht, stairs } from "./legacy";
import { leadBig, leadPill } from "./plb";
import { gsMoney, rateLabel } from "./gsaving";
import { GS_VIDEO_COLUMNS } from "./gsaving-table";
import { countAt, H, W, type OverlayState } from "./timeline";
import { preparedLine, wordsOf } from "./video-words";

/**
 * The pictures of the วิดีโอนำเสนอ clip (owner, 2026-10-11), 1080×1920, in the card's palette.
 *
 * Every scene is drawn twice from one layout: a `base` (opaque, everything that stands still)
 * and any number of `over` frames (transparent, the animated items and the subtitle at one
 * moment). An item belongs to one layer and is drawn at opacity 0 in the other, so the two line
 * up to the pixel. Two things move in ffmpeg rather than here: the family photo (a slow zoom,
 * inside PHOTO) and the value table (a pan, inside TABLE) — the base leaves those boxes empty.
 */

export { PHOTO, ROW_H, TABLE };
const SIDE = 70;

/** more: รายละเอียดเพิ่มเติม (owner, 2026-10-14, option ข), up to 2 lines shown under the card */
export interface Contact { name: string; phone: string; line?: string; more?: string; photo?: string }
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
  /** โจทย์การเล่า (told.ts): the hook's headline over the opening, and whether the clip loops */
  headline?: string[];
  loop?: boolean;
  /** what the longer clips' extra scenes show */
  extra?: Extra;
}

export type Layer = "base" | "over";
export const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
export const abs = (s: CSSProperties): CSSProperties => ({ display: "flex", position: "absolute", ...s });

/** what is drawn on this layer shows; the other layer keeps its place, unseen */
export function On({ layer, own, style, children }: { layer: Layer; own: Layer; style?: CSSProperties; children?: ReactNode }) {
  return <div style={{ display: "flex", ...style, ...(layer === own ? {} : { opacity: 0 }) }}>{children}</div>;
}

/** the highlighter stroke behind a phrase, drawn left to right as p goes 0 → 1 */
export function Swept({ p, children, size }: { p: number; children: ReactNode; size: number }) {
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
      Application by www.advisortool.app
    </On>
  );
}

/** the hook's headline, a navy band over the foot of the family photo (owner, 2026-10-13, mockup §5) */
function Headline({ c, layer }: { c: DrawContext; layer: Layer }) {
  if (!c.headline?.length) return null;
  return (
    <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: PHOTO.y + PHOTO.h - (c.headline.length > 1 ? 190 : 120), flexDirection: "column", alignItems: "center", background: P.figure, borderRadius: 28, padding: "20px 30px" }}>
      {c.headline.map((h, i) => <div key={i} style={box({ fontSize: 56, fontWeight: 600, color: i === 0 ? C.paper : P.highlighter, lineHeight: 1.25 })}>{h}</div>)}
    </On>
  );
}


const money = (n: number) => n.toLocaleString("en-US");
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

function Lead({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  if (f.legacy || f.plb || f.gsaving) return <LegacyLead c={c} layer={layer} s={s} />;
  const vw = wordsOf(f);
  return (
    <>
      {c.customer && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 240, fontSize: 44, color: P.ink }}>
          {preparedLine(vw, c.customer).map((p, i) => <span key={i} style={{ ...(p.name ? { fontWeight: 600, color: P.figure } : {}), marginLeft: i ? 12 : 0 }}>{p.text}</span>)}
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 40, fontSize: 46, color: P.mute }}>{f.lead.label}</On>
      <div style={abs({ left: SIDE, top: PHOTO.y + PHOTO.h + 100, alignItems: "flex-end" })}>
        <On layer={layer} own="over" style={{ fontSize: f.lead.amount.length > 9 ? 140 : 170, fontWeight: 600, color: P.figure, lineHeight: 1 }}>{money(countAt(f.lead.baht, s.count))}</On>
        <On layer={layer} own="base" style={{ fontSize: 56, color: P.mute, marginLeft: 24, marginBottom: 14 }}>{vw.baht}</On>
      </div>
      {f.lead.note && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 300, fontSize: 40, color: P.mute }}>{f.lead.note}</On>
      )}
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: PHOTO.y + PHOTO.h + 370 }}>
        <Swept p={s.sweep[0] ?? 1} size={52}>{f.leadMark}</Swept>
      </On>
      <Headline c={c} layer={layer} />
    </>
  );
}

/**
 * มรดก's opening (owner, 2026-10-14, mockup https://claude.ai/artifact/55oEG3PjdupXzKPkTHbU75):
 * under the family photo the plan's name, the legacy in the largest type, then the most the
 * family receives counted up under the highlighter, and who it is for. Protection Life's the
 * same (mockup https://claude.ai/artifact/WHryu9gcuXHCxg2P2ibBR9): "คุ้มครองชีวิต 1 ล้าน", and
 * the pill says until when.
 */
function LegacyLead({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const big = leadBig(f);
  const y = PHOTO.y + PHOTO.h + 30;
  return (
    <>
      {c.customer && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 240, fontSize: 44, color: P.ink }}>
          จัดทำสำหรับ <span style={{ fontWeight: 600, color: P.figure, marginLeft: 12 }}>คุณ{c.customer}</span>
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: y, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.planLine}</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: y + 60, fontSize: big.length > 16 ? 106 : 130, fontWeight: 600, color: P.figure, lineHeight: 1.1 }}>{big}</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: y + 230, fontSize: 44, color: P.mute }}>{f.lead.label}</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: y + 295 }}>
        <Swept p={s.sweep[0] ?? 1} size={76}>{`${money(countAt(f.lead.baht, s.count))} บาท`}</Swept>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: y + 420, border: `3px solid ${P.accent}`, borderRadius: 40, padding: "4px 30px", fontSize: 40, color: P.accent }}>{leadPill(f)}</On>
      <Headline c={c} layer={layer} />
    </>
  );
}

/**
 * A looping clip's last scene (owner, 2026-10-13, choice ก): the opening's picture again — the
 * photo, the headline, the figure — so the replay runs on without a cut. No agent's card and no
 * agent's line under the scenes (owner, 2026-10-13, choice ข): the voice asks for the chat.
 */
function LoopEnd({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  return <Lead c={c} layer={layer} s={{ ...s, count: 1, sweep: [1] }} />;
}

const kicker = (layer: Layer, text: string) => (
  <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{text}</On>
);

/** the longer clips: the customer's story, in two or three lines lit as the voice reaches them */
function StoryScene({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const pts = c.extra?.story.points ?? [];
  return (
    <>
      {kicker(layer, "ลองนึกภาพ")}
      <On layer={layer} own="base" style={{ position: "absolute", left: (W - 240) / 2, top: 360 }}>{insuredFace(c.facts.sex, 240)}</On>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 700, flexDirection: "column" })}>
        {pts.map((pt, i) => (
          <div key={i} style={box({ alignItems: "center", marginBottom: 56 })}>
            <On layer={layer} own="base" style={{ width: 70, height: 70, borderRadius: 35, background: P.figure, color: C.paper, fontSize: 40, fontWeight: 600, alignItems: "center", justifyContent: "center", marginRight: 34, flexShrink: 0 }}>{String(i + 1)}</On>
            <On layer={layer} own="over"><Swept p={s.sweep[i] ?? 1} size={60}>{pt}</Swept></On>
          </div>
        ))}
      </div>
    </>
  );
}

/** two questions customers ask, each answered as the bots answer it (qa.ts) */
function QaScene({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const qas = c.extra?.qas ?? [];
  return (
    <>
      {kicker(layer, "คำถามที่เจอบ่อย")}
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 360, flexDirection: "column" })}>
        {qas.map((q, i) => (
          <div key={q.key} style={box({ flexDirection: "column", marginBottom: 70 })}>
            <div style={box({ alignItems: "flex-start" })}>
              <On layer={layer} own="base" style={{ background: P.figure, color: C.paper, borderRadius: 22, padding: "6px 22px", fontSize: 38, fontWeight: 600, marginRight: 26, marginTop: 8, flexShrink: 0 }}>ถาม</On>
              <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={54}>{q.q}</Swept></On>
            </div>
            <On layer={layer} own="base" style={{ fontSize: 44, color: P.ink, marginTop: 24, lineHeight: 1.45 }}>{q.a}</On>
          </div>
        ))}
      </div>
    </>
  );
}

const plainNumber = (s: string) => /^[\d,]+$/.test(s);

/** saving alone against the plan (บำนาญ 95: the tax, owner 2026-10-13) */
function VersusScene({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const v = c.extra?.versus;
  if (!v) return null;
  const right = plainNumber(v.right.amount) ? money(countAt(num(v.right.amount), s.count)) : v.right.amount;
  return (
    <>
      {kicker(layer, c.facts.product === "PENSION" ? "ลดหย่อนภาษีระหว่างทำงาน" : "เก็บเงินเอง กับ แผนนี้")}
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 360, flexDirection: "column", background: P.box, borderRadius: 36, padding: "40px 50px" }}>
        <div style={box({ fontSize: 44, color: P.mute })}>{v.left.label}</div>
        <div style={box({ alignItems: "flex-end" })}>
          <div style={box({ fontSize: 110, fontWeight: 600, color: P.ink, lineHeight: 1.15 })}>{v.left.amount}</div>
          <div style={box({ fontSize: 44, color: P.mute, marginLeft: 18, marginBottom: 16 })}>{v.left.unit}</div>
        </div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: (W - 120) / 2, top: 690, width: 120, height: 120, borderRadius: 60, background: P.figure, color: C.paper, fontSize: 44, fontWeight: 600, alignItems: "center", justifyContent: "center" }}>
        {c.facts.product === "PENSION" ? "→" : "vs"}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 840, height: 300, border: `5px solid ${P.figure}`, borderRadius: 36 }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE + 50, top: 880, fontSize: 44, color: P.figure, fontWeight: 600 }}>{v.right.label}</On>
      <div style={abs({ left: SIDE + 50, top: 950, alignItems: "flex-end" })}>
        <On layer={layer} own="over" style={{ fontSize: 130, fontWeight: 600, color: P.figure, lineHeight: 1.1 }}>{right}</On>
        <On layer={layer} own="base" style={{ fontSize: 44, color: P.mute, marginLeft: 18, marginBottom: 18 }}>{v.right.unit}</On>
      </div>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 1220 }}><Swept p={s.sweep[0] ?? 1} size={50}>{v.note}</Swept></On>
    </>
  );
}

/** how to start, in three steps */
function StepsScene({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const steps = c.extra?.steps ?? [];
  return (
    <>
      {kicker(layer, "เริ่มง่ายๆ 3 ขั้น")}
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 400, flexDirection: "column" })}>
        {steps.map((st, i) => (
          <div key={i} style={box({ alignItems: "center", marginBottom: 80 })}>
            <On layer={layer} own="base" style={{ width: 130, height: 130, borderRadius: 65, background: i === steps.length - 1 ? P.highlighter : P.figure, color: i === steps.length - 1 ? P.ink : C.paper, fontSize: 64, fontWeight: 600, alignItems: "center", justifyContent: "center", marginRight: 40, flexShrink: 0 }}>{String(i + 1)}</On>
            <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={54}>{st}</Swept></On>
          </div>
        ))}
      </div>
    </>
  );
}

function Price({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const baht = wordsOf(f).baht;
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
              <On layer={layer} own="over" style={{ fontSize: 88, fontWeight: 600, color: P.figure }}>{`${money(countAt(num(r.amount), s.count))} ${baht}`}</On>
            ) : (
              <On layer={layer} own="base" style={{ fontSize: 48, color: P.ink }}>{`${r.amount} ${baht}`}</On>
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
        // a Life Protect price split by contract (owner, 2026-10-17) is four lines: set closer, clear of the subtitle
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: f.pills.length ? (f.priceNotes.length > 2 ? 1310 : 1330) : 1080, flexDirection: "column", fontSize: f.priceNotes.length > 2 ? 30 : 34, color: P.mute }}>
          {f.priceNotes.map((n) => <div key={n} style={box({ marginBottom: f.priceNotes.length > 2 ? 2 : 10 })}>{n}</div>)}
        </On>
      )}
    </>
  );
}

/** iShield's lump sums and iHealthy's cover, one row each, lit as the voice reads them */
function RowsCover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const baht = wordsOf(f).baht;
  const tight = f.cover.length > 4;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.coverTitle}</On>
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: 360, flexDirection: "column" })}>
        {f.cover.map((r, i) => (
          <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", marginBottom: tight ? 26 : 40 })}>
            <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={tight ? 40 : 42}>{r.label}</Swept></On>
            <On layer={layer} own="base" style={{ fontSize: tight ? 44 : 52, fontWeight: 600, color: P.ink, marginLeft: 24, flexShrink: 0 }}>{/^[\d,]+$/.test(r.amount) ? `${r.amount} ${baht}` : r.amount}</On>
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

/**
 * มรดก: what the family receives by age as a staircase — each bar as wide as its years, as tall
 * as its sum — grown as the voice reaches it, the exact figures listed under it.
 */
function BandsCover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const bands = f.legacy?.bands ?? [];
  const chartW = W - SIDE * 2;
  const top = 420;
  const tall = 440;
  const bars = stairs(bands, chartW, tall, 150, 70);
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.coverTitle}</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 0, width: chartW, height: H }}>
        {bars.map((b, i) => {
          const p = s.sweep[i] ?? 1;
          const h = Math.round(b.h * p);
          return p > 0 ? (
            <div key={b.band.from} style={abs({ left: b.x, top: 0, width: b.w, height: H })}>
              <div style={abs({ left: 4, top: top + tall - h, width: b.w - 8, height: Math.max(4, h), background: i === 0 ? P.figure : i === 1 ? C.barAfter : P.box, borderRadius: "12px 12px 0 0" })} />
              {p >= 1 && <div style={abs({ left: 0, top: top + tall - h - 62, width: b.w, justifyContent: "center", fontSize: 42, fontWeight: 600, color: P.ink })}>{shortBaht(b.band.amount)}</div>}
            </div>
          ) : null;
        })}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + tall, width: chartW, height: 4, background: P.rule }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + tall + 16, width: chartW, height: 60 }}>
        {bars.map((b, i) => <div key={b.band.from} style={abs({ left: b.x, width: b.w, justifyContent: "center", fontSize: 36, color: P.mute })}>{bandAges(b.band, i, bands)}</div>)}
      </On>
      <div style={abs({ left: SIDE, width: chartW, top: top + tall + 110, flexDirection: "column" })}>
        {f.cover.map((r, i) => (
          <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", marginBottom: 26 })}>
            <On layer={layer} own="over" style={{ flexShrink: 1 }}><Swept p={s.sweep[i] ?? 1} size={44}>{r.label}</Swept></On>
            <On layer={layer} own="base" style={{ fontSize: 52, fontWeight: 600, color: P.ink, marginLeft: 24, flexShrink: 0 }}>{`${r.amount} บาท`}</On>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * มรดก's fourth scene, where the others have their value table (owner, 2026-10-14): a critical
 * illness pays the insured a lump sum once, counted up under the highlighter, and the life
 * cover stays on for the family.
 */
function Critical({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const l = f.legacy;
  if (!l) return null;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 48, fontWeight: 600, color: P.accent }}>{`ตรวจพบโรคร้ายแรง 1 ใน ${l.diseaseCount} โรค`}</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 350, fontSize: 70, fontWeight: 600, color: P.figure }}>รับเงินก้อนไว้รักษาตัวเอง</On>
      <div style={abs({ left: SIDE, top: 500, alignItems: "flex-end" })}>
        <On layer={layer} own="over"><Swept p={s.sweep[0] ?? 1} size={150}>{money(countAt(l.critical, s.count))}</Swept></On>
        <On layer={layer} own="base" style={{ fontSize: 60, color: P.mute, marginLeft: 24, marginBottom: 24 }}>บาท</On>
      </div>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 780, flexDirection: "column", background: P.box, borderRadius: 36, padding: "36px 46px" }}>
        <div style={box({ fontSize: 46, fontWeight: 600, color: P.ink })}>จ่ายครั้งเดียว</div>
        <div style={box({ fontSize: 46, color: P.ink, marginTop: 8 })}>ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว</div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 1100, justifyContent: "flex-end", fontSize: 52, color: P.pen, transform: "rotate(-2deg)" }}>
        {`โรคร้ายแรงคุ้มครองถึงอายุ ${l.criticalToAge}`}
      </On>
    </>
  );
}

/**
 * Protection Life (owner, 2026-10-14): the cover as one flat bar — the whole sum every year from
 * the insured's age to the end of the term, the term's years in the middle — and the plan's rule
 * in a line under it: as many years as are paid, so many are covered.
 */
function FlatCover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const p = f.plb;
  if (!p) return null;
  const chartW = W - SIDE * 2;
  const top = 560;
  const barH = 200;
  const grow = s.sweep[0] ?? 1;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{f.coverTitle}</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 340, fontSize: 52, color: P.ink }}>{f.cover[0]?.label ?? ""}</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: top, width: Math.max(8, Math.round(chartW * grow)), height: barH, background: P.figure, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {grow >= 1 ? <div style={box({ fontSize: 66, fontWeight: 600, color: C.paper })}>{`${f.lead.amount} บาท ทุกปี`}</div> : null}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + barH + 20, width: chartW, height: 6, background: P.rule }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + barH + 6, width: 6, height: 40, background: P.rule }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE + chartW - 6, top: top + barH + 6, width: 6, height: 40, background: P.rule }} />
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: chartW, top: top + barH + 56, justifyContent: "space-between", alignItems: "center", fontSize: 44, color: P.mute }}>
        <div style={box({})}>{`อายุ ${f.age}`}</div>
        <div style={box({ fontSize: 50, fontWeight: 600, color: P.figure })}>{`${p.years} ปี`}</div>
        <div style={box({})}>{`อายุ ${p.endAge}`}</div>
      </On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: top + barH + 200 }}><Swept p={s.sweep[1] ?? 1} size={54}>จ่ายเท่าไหร่ คุ้มครองเท่านั้นปี</Swept></On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: chartW, justifyContent: "flex-end", top: top + barH + 330, fontSize: 52, color: P.pen, transform: "rotate(-2deg)" }}>{`คุ้มครองถึงอายุ ${p.endAge}`}</On>
    </>
  );
}

/**
 * Protection Life's fourth scene, where the others have their value table (owner, 2026-10-14):
 * the terms this age can buy side by side, the chosen one lit, what the chosen one costs in all,
 * tax relief for the 10-, 12- and 15-year terms only, and in small type that it pays nothing at
 * its end (never voiced).
 */
function TermsScene({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const p = c.facts.plb;
  if (!p) return null;
  const rowH = 118;
  const top = 360;
  const after = top + p.terms.length * (rowH + 22) + 30;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>เลือกระยะได้ตามภาระ</On>
      {p.terms.map((r, i) => (
        <div key={r.years} style={abs({ left: SIDE, width: W - SIDE * 2, top: top + i * (rowH + 22), height: rowH })}>
          <On layer={layer} own="base" style={{ position: "absolute", left: 0, top: 0, width: W - SIDE * 2, height: rowH, borderRadius: 26, border: `3px solid ${r.on ? P.figure : P.hair}`, background: r.on ? P.box : C.paper }} />
          {r.on ? (
            <On layer={layer} own="over" style={{ position: "absolute", left: 36, top: 0, height: rowH, alignItems: "center" }}><Swept p={s.sweep[0] ?? 1} size={52}>{`${r.years} ปี · ถึง ${r.endAge}`}</Swept></On>
          ) : (
            <On layer={layer} own="base" style={{ position: "absolute", left: 36, top: 0, height: rowH, alignItems: "center", fontSize: 48, color: P.mute }}>{`${r.years} ปี · ถึง ${r.endAge}`}</On>
          )}
          <On layer={layer} own="base" style={{ position: "absolute", right: 36, top: 0, height: rowH, alignItems: "center", fontSize: r.on ? 56 : 48, fontWeight: r.on ? 600 : 400, color: r.on ? P.figure : P.mute }}>{`${r.annual}/ปี`}</On>
        </div>
      ))}
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: after }}><Swept p={s.sweep[1] ?? 1} size={52}>{`รวมจ่าย ${p.years} ปี ${p.total} บาท`}</Swept></On>
      {p.tax && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: after + 110, border: `3px solid ${P.accent}`, borderRadius: 40, padding: "4px 30px", fontSize: 42, color: P.accent }}>ลดหย่อนภาษีได้</On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: after + (p.tax ? 210 : 110), fontSize: 32, color: P.mute }}>ความคุ้มครองล้วน ครบสัญญาไม่มีเงินคืน</On>
    </>
  );
}

/**
 * Global Savings' seven index returns as bars in the classic look (owner, 2026-10-20): the navy
 * guaranteed base under every one, the bonus on top, the picked return's bonus in the highlighter's
 * yellow. Shared by the portrait and the wide classic clips.
 */
export function classicIndexBars(f: QuoteVideoFacts, w: number, h: number, big = 1) {
  const g = f.gsaving;
  if (!g) return null;
  const top = Math.max(...g.bars.map((b) => b.total)) * 1.05;
  const gap = Math.round(12 * big);
  const bw = (w - gap * (g.bars.length - 1)) / g.bars.length;
  const labelH = Math.round(56 * big);
  const chartH = h - labelH;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ position: "relative", width: w, height: chartH, borderBottom: `3px solid ${P.rule}` })}>
        {g.bars.map((b, i) => {
          const baseH = Math.round((g.guaranteed / top) * chartH);
          const bonusH = Math.round(((b.total - g.guaranteed) / top) * chartH);
          return (
            <div key={b.rate} style={abs({ left: Math.round(i * (bw + gap)), top: 0, width: Math.round(bw), height: chartH, flexDirection: "column", justifyContent: "flex-end" })}>
              {bonusH > 1 ? <div style={box({ width: "100%", height: bonusH, background: b.on ? P.highlighter : C.motionSky, borderRadius: "10px 10px 0 0", ...(b.on ? { border: `3px solid ${P.figure}` } : {}) })} /> : null}
              <div style={box({ width: "100%", height: baseH, background: P.figure, ...(bonusH > 1 ? {} : { borderRadius: "10px 10px 0 0" }) })} />
            </div>
          );
        })}
      </div>
      <div style={box({ width: w, height: labelH, marginTop: Math.round(8 * big) })}>
        {g.bars.map((b, i) => (
          <div key={b.rate} style={box({ width: Math.round(bw), marginLeft: i ? gap : 0, justifyContent: "center", fontSize: Math.round((b.on ? 38 : 32) * big), fontWeight: b.on ? 700 : 400, color: b.on ? P.figure : P.mute })}>{rateLabel(b.rate)}</div>
        ))}
      </div>
    </div>
  );
}

/** Global Savings' fourth scene (owner, 2026-10-20): the picked return, what comes back at it, the seven returns as bars */
function IndexScene({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  const f = c.facts;
  const g = f.gsaving;
  if (!g) return null;
  const up = g.rate > 0;
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>โบนัสตามดัชนีโลก</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 340 }}><Swept p={s.sweep[0] ?? 1} size={52}>{`${up ? "ถ้าดัชนีโตเฉลี่ยปีละ" : "ถ้าดัชนีเฉลี่ยปีละ"} ${rateLabel(g.rate)}`}</Swept></On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 450, alignItems: "baseline" }}>
        <div style={box({ fontSize: 40, color: P.mute, marginRight: 20 })}>{up ? "รวมรับประมาณ" : "รวมรับ (การันตี)"}</div>
        <div style={box({ fontSize: 100, fontWeight: 700, color: P.figure })}>{gsMoney(g.total)}</div>
        <div style={box({ fontSize: 44, color: P.ink, marginLeft: 14 })}>บาท</div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 640 }}>{classicIndexBars(f, W - SIDE * 2, 520)}</On>
      <On layer={layer} own="over" style={{ position: "absolute", left: SIDE, top: 1220 }}>
        <Swept p={s.sweep[1] ?? 1} size={46}>{up ? `โบนัส ${gsMoney(g.bonus10 + g.bonus15)} บาท ไม่การันตี` : `ยังได้การันตี ${gsMoney(g.guaranteed)} บาทเต็ม`}</Swept>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, justifyContent: "flex-end", top: 1320, fontSize: 48, color: up ? P.pen : BLUE_PEN, transform: "rotate(-2deg)" }}>{up ? "ตัวอย่างเท่านั้น" : "ได้แน่นอน ✓"}</On>
    </>
  );
}

/** the header cells of Global Savings' table: the bonus columns in two lines */
export const gsHeads = () => GS_VIDEO_COLUMNS.map((x, i) => ({ h: x.head, w: x.width, left: i < 2, ...(x.lines ? { lines: x.lines } : {}) }));

/**
 * Global Savings' third scene in the classic clip (owner, 2026-10-20, mockup FkimdNb2v5u2mUJhdiQB2R, ก ก):
 * what is saved, what comes back for certain and the cover over the yearly table, whose picture
 * (gsaving-table.tsx) the clip lays into the window and walks down.
 */
function GsTableCover({ c, layer }: { c: DrawContext; layer: Layer }) {
  const g = c.facts.gsaving;
  if (!g) return null;
  const card = { border: `3px solid ${P.hair}`, borderRadius: 22, padding: "16px 24px", flexDirection: "column" as const };
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>เงินคืนทุกปี + โบนัสดัชนี 3 ตัวอย่าง</On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 340, width: W - SIDE * 2, flexDirection: "column" }}>
        <div style={box({ width: "100%" })}>
          <div style={box({ ...card, flex: 1, marginRight: 22 })}>
            <div style={box({ fontSize: 30, color: P.mute })}>{`ออมรวม ${g.payYears} ปี`}</div>
            <div style={box({ fontSize: 64, fontWeight: 600, color: P.figure, lineHeight: 1.15 })}>{gsMoney(g.paid)}</div>
          </div>
          <div style={box({ ...card, flex: 1 })}>
            <div style={box({ fontSize: 30, color: P.mute })}>รับคืนการันตี</div>
            <div style={box({ fontSize: 64, fontWeight: 600, color: P.figure, lineHeight: 1.15 })}><Highlit>{gsMoney(g.guaranteed)}</Highlit></div>
          </div>
        </div>
        <div style={box({ ...card, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 })}>
          <div style={box({ fontSize: 30, color: P.mute })}>คุ้มครองชีวิตสูงสุด</div>
          <div style={box({ fontSize: 50, fontWeight: 600, color: P.figure })}>{`${gsMoney(g.deathMax)} บาท`}</div>
        </div>
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y - 60, width: TABLE.w, height: 60, background: P.figure, color: C.paper, fontSize: 28, alignItems: "center" }}>
        {gsHeads().map((x) => <HeadCell key={x.h} {...x} />)}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y + TABLE.h, width: TABLE.w, height: 3, background: P.hair }} />
    </>
  );
}

/** a figure with the highlighter behind it, as the cards draw one */
function Highlit({ children }: { children: ReactNode }) {
  return (
    <div style={box({ position: "relative", padding: "0 6px" })}>
      <div style={abs({ left: 0, right: 0, top: "48%", bottom: "4%", background: P.highlighter })} />
      <div style={box({ position: "relative" })}>{children}</div>
    </div>
  );
}

function Cover({ c, layer, s }: { c: DrawContext; layer: Layer; s: OverlayState }) {
  if (c.facts.coverStyle === "flat") return <FlatCover c={c} layer={layer} s={s} />;
  // Global Savings: the yearly table with three index examples, as the other plans' value scene (owner, 2026-10-20, ก ก)
  if (c.facts.coverStyle === "payback") return <GsTableCover c={c} layer={layer} />;
  if (c.facts.coverStyle === "rows") return <RowsCover c={c} layer={layer} s={s} />;
  if (c.facts.coverStyle === "steps") return <StepsCover c={c} layer={layer} s={s} />;
  if (c.facts.coverStyle === "bands") return <BandsCover c={c} layer={layer} s={s} />;
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
    : valueHeads(c.facts);
  return (
    <>
      <PensionValueTop c={c} layer={layer} />
      {chart && (
        <On layer={layer} own="base" style={{ position: "absolute", left: SIDE - 10, top: 190 }}>
          <Chart chart={chart} p={P} />
        </On>
      )}
      <On layer={layer} own="base" style={{ position: "absolute", left: TABLE.x, top: TABLE.y - 60, width: TABLE.w, height: 60, background: P.figure, color: C.paper, fontSize: 28, alignItems: "center" }}>
        {heads.map((x) => (
          <HeadCell key={x.h} {...x} />
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
  const vw = wordsOf(c.facts);
  const labelW = 250;
  const colW = Math.floor((W - SIDE * 2 - labelW) / Math.max(1, plans.length));
  const top = 380;
  const rowH = 110;
  const rows: [string, (p: (typeof plans)[number]) => string][] = [
    [vw.compareRows[0], (p) => p.ceiling],
    [vw.compareRows[1], (p) => p.room],
    [vw.compareRows[2], (p) => p.opd],
    [vw.compareRows[3], (p) => `${p.monthly} ${vw.baht}`],
  ];
  const mainAt = plans.findIndex((p) => p.main);
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 250, fontSize: 44, fontWeight: 600, color: P.accent }}>{vw.compareTitle}</On>
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
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: top + rowH * 5 + 40, fontSize: 34, color: P.mute }}>{vw.renewNote(c.facts.coverToAge)}</On>
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
  const more = k.more ? k.more.split("\n") : [];
  const vw = wordsOf(c.facts);
  const [said, help] = vw.contactLines(c.narrator ?? "F");
  return (
    <>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, top: 220, fontSize: 44, fontWeight: 600, color: P.accent }}>
        {c.customer ? vw.contactFor(c.customer) : vw.contactMore}
      </On>
      <On layer={layer} own="base" style={{ position: "absolute", left: SIDE, width: W - SIDE * 2, top: 320, flexDirection: "column", fontSize: c.facts.lang && c.facts.lang !== "th" ? 72 : 88, fontWeight: 600, color: P.figure, lineHeight: vw.lineHeight }}>
        <div style={box({})}>{said}</div>
        <div style={box({})}>{help}</div>
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
          <div style={box({ fontSize: 46, color: P.mute, marginTop: 10 })}>{`${vw.phone} ${k.phone}`}</div>
          {k.line && <div style={box({ fontSize: 46, color: P.mute })}>{`LINE ${k.line}`}</div>}
        </div>
      </On>
      {/* the foot note runs on under รายละเอียดเพิ่มเติม, however many lines it wraps to */}
      <div style={abs({ left: SIDE, width: W - SIDE * 2, top: more.length ? 1050 : 1080, flexDirection: "column" })}>
        {more.length > 0 && (
          <On layer={layer} own="base" style={{ flexDirection: "column", fontSize: 44, color: P.ink, lineHeight: 1.45, marginBottom: 24 }}>
            {more.map((m, i) => <div key={i} style={box({})}>{m}</div>)}
          </On>
        )}
        {c.facts.footNote && <On layer={layer} own="base" style={{ fontSize: 32, color: P.mute }}>{c.facts.footNote}</On>}
      </div>
    </>
  );
}

const DONE: OverlayState = { word: -1, count: 1, sweep: [1, 1], bars: [1, 1], ring: 0 };

/** One layer of one scene, as a full 1080×1920 picture. */
export function sceneLayer(key: SceneKey, c: DrawContext, layer: Layer, state: OverlayState = DONE) {
  const body = {
    lead: <Lead c={c} layer={layer} s={state} />,
    compare: <Compare c={c} layer={layer} s={state} />,
    critical: <Critical c={c} layer={layer} s={state} />,
    terms: <TermsScene c={c} layer={layer} s={state} />,
    index: <IndexScene c={c} layer={layer} s={state} />,
    price: <Price c={c} layer={layer} s={state} />,
    cover: <Cover c={c} layer={layer} s={state} />,
    value: <Value c={c} layer={layer} s={state} />,
    contact: c.loop ? <LoopEnd c={c} layer={layer} s={state} /> : <ContactScene c={c} layer={layer} />,
    story: <StoryScene c={c} layer={layer} s={state} />,
    qa: <QaScene c={c} layer={layer} s={state} />,
    versus: <VersusScene c={c} layer={layer} s={state} />,
    steps: <StepsScene c={c} layer={layer} s={state} />,
  }[key];
  return (
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: layer === "base" ? C.paper : "transparent", fontFamily: "Plex", color: P.ink }}>
      {(key !== "contact" || c.loop) && <Header f={c.facts} layer={layer} />}
      {body}
      {layer === "over" && <Subtitle words={c.words} word={state.word} />}
      <Footer layer={layer} />
    </div>
  );
}

/** a value-table column's name; the riders' one in two smaller lines, to fit its narrow column */
export function HeadCell({ h, w, left, lines }: { h: string; w: number; left: boolean; lines?: string[] }) {
  return (
    <div style={box({ width: w, flexDirection: "column", justifyContent: "center", alignItems: left ? "flex-start" : "flex-end", paddingLeft: left ? 14 : 0, paddingRight: left ? 0 : 14, ...(lines ? { fontSize: 20, lineHeight: 1.1 } : {}) })}>
      {(lines ?? [h]).map((l) => <div key={l} style={box({})}>{l}</div>)}
    </div>
  );
}

/** the chart over the value table, as wide as the scene allows */
export const CHART_W = W - (SIDE - 10) * 2;
export { chartBlockHeight };

/** The whole value table as one tall picture, without its header (drawn on the base). */
export function tableImage(f: QuoteVideoFacts) {
  const all = f.rows ?? [];
  const cols = colsOf(f);
  // with riders, their premium sits after the plan's (owner, 2026-10-17, 1ก): every later column moves one along
  const rider = cols.length > 6 ? 1 : 0;
  const height = Math.max(ROW_H, all.length * ROW_H);
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: TABLE.w, height, background: C.paper, fontFamily: "Plex", fontSize: 28, color: P.ink }}>
      {all.map((r, i) => {
        // a premium no longer due is left blank, as on the card: the pen writes there
        const cells = [
          String(r.year), String(r.age), r.due === "—" ? "" : r.due,
          ...(rider ? [r.rider === undefined || r.rider === "—" ? "" : r.rider] : []),
          r.paid ?? "", r.cash ?? "", r.cover,
        ];
        return (
          <div key={r.year} style={box({ height: ROW_H, alignItems: "center", background: i % 2 ? "rgba(2,33,98,0.045)" : C.paper })}>
            {cells.map((v, k) => (
              <div
                key={k}
                style={box({
                  width: cols[k], height: ROW_H, alignItems: "center",
                  justifyContent: k < 2 ? "flex-start" : "flex-end", paddingLeft: k < 2 ? 14 : 0, paddingRight: k < 2 ? 0 : 14,
                  ...(k === 1 && r.breakEven ? { background: P.highlighter, fontWeight: 600 } : {}),
                  ...(k === 4 + rider && (r.pastBreakEven || r.breakEven) ? { color: P.gain, fontWeight: r.breakEven ? 600 : 400 } : {}),
                  ...(k === 4 + rider && r.empty ? { color: P.mute } : {}),
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
