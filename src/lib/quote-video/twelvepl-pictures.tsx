import type { CSSProperties, ReactNode } from "react";
import type { Draw } from "./rider-pictures";
import type { QuoteVideoFacts } from "./script";
import { tpMoney, type TwelvePlVideoFacts } from "./twelvepl";

/**
 * 12 พีแอล's three pictures (owner, 2026-11-26, ก ก ข on https://claude.ai/artifact/7eC8eVjT4mFAsSaPie4kfm): the cash
 * backs rising to the maturity, the family's sum along the insured's years, what is paid beside what comes back.
 * Drawn once for all four drawers, as rider-pictures.tsx is. Flex boxes and plain SVG only.
 */

export interface TpDraw extends Draw {
  /** how far a named piece has come in, 0 → 1 (always 1 in the classic clip) */
  p: (name: string) => number;
}

const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
const abs = (s: CSSProperties): CSSProperties => ({ display: "flex", position: "absolute", ...s });
const px = (n: number, big: number) => Math.round(n * big);

/** each year's cash back as a short bar on a scale of its own, then the maturity far above them, its bar broken: it is not to their scale */
export function tpCashPicture(g: TwelvePlVideoFacts, d: TpDraw, w: number, big = 1): ReactNode {
  const { pal } = d;
  const h = px(400, big);
  const matW = Math.round(w * 0.18);
  const n = g.cash.length;
  const step = (w - matW - px(34, big)) / n;
  const shown = Math.round(n * d.p("ticks"));
  const maxH = h * 0.4;
  const m = d.p("mat");
  const matH = Math.round(h * 0.8 * m);
  const lower = Math.min(matH, px(110, big));
  const full = Math.round((g.cashFullYear - 2) * step);
  // a short contract reaches the full cash back near the maturity: its label then ends before the gold bar
  const fullWord = `ปีละ ${tpMoney(g.cashFull)} ทุกปี`;
  const pushed = full + px(fullWord.length * 20, big) > w - matW - px(20, big);
  // the first figure stands above every bar under it, not on them
  const under = g.cash[Math.min(n - 1, Math.ceil(px(tpMoney(g.cashFirst).length * 20, big) / step))] ?? g.cashFirst;
  const firstTop = h + px(70, big) - Math.round((under / g.cashFull) * maxH) - px(54, big);
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ position: "relative", width: w, height: h + px(70, big) })}>
        {g.cash.slice(0, shown).map((c, i) => {
          const barH = Math.max(3, Math.round((c / g.cashFull) * maxH));
          return <div key={i} style={abs({ left: Math.round(i * step), top: h + px(70, big) - barH, width: Math.max(3, Math.round(step * 0.66)), height: barH, background: pal.sky, borderRadius: "4px 4px 0 0" })} />;
        })}
        {d.piece("tickLabel", { position: "absolute", left: 0, top: firstTop, fontSize: px(36, big), color: pal.ink }, tpMoney(g.cashFirst))}
        {d.piece("fullLabel", { position: "absolute", ...(pushed ? { right: matW + px(24, big) } : { left: full }), top: h + px(70, big) - maxH - px(64, big), fontSize: px(42, big), fontWeight: 600, color: pal.ink }, fullWord)}
        {lower > 0 ? <div style={abs({ left: w - matW, top: h + px(70, big) - lower, width: matW, height: lower, background: pal.fill })} /> : null}
        {matH > lower + px(16, big)
          ? <div style={abs({ left: w - matW, top: h + px(70, big) - matH, width: matW, height: matH - lower - px(14, big), background: pal.fill, borderRadius: "12px 12px 0 0" })} />
          : null}
        {d.piece("matLabel", { position: "absolute", right: 0, top: h + px(70, big) - Math.round(h * 0.8) - px(76, big), fontSize: px(56, big), fontWeight: 700, color: pal.figure }, tpMoney(g.maturity))}
        <div style={abs({ left: 0, top: h + px(70, big), width: w, height: 0, borderTop: `4px solid ${pal.ink}`, opacity: 0.55 })} />
      </div>
      {d.piece("ends", { position: "relative", width: w, height: px(60, big), marginTop: px(14, big), fontSize: px(36, big), color: pal.ink }, (
        <>
          <div style={abs({ left: 0, top: 0 })}>ปีที่ 2</div>
          {full > px(150, big) ? <div style={abs({ left: full, top: 0 })}>{`ปีที่ ${g.cashFullYear}`}</div> : null}
          <div style={abs({ right: 0, top: 0, color: pal.figure, fontWeight: 700 })}>{`ครบอายุ ${g.coverToAge}`}</div>
        </>
      ))}
    </div>
  );
}

/** what is certain, in a card: the cash backs, the maturity, the two together */
export function tpSureCard(f: QuoteVideoFacts, d: TpDraw, w: number, big = 1): ReactNode {
  const last = f.cover.length - 1;
  return d.piece("card", { flexDirection: "column", width: w, background: d.pal.card, color: d.pal.onCard, borderRadius: px(30, big), padding: `${px(22, big)}px ${px(32, big)}px` }, (
    <>
      {f.cover.map((r, i) => (
        <div key={r.label} style={box({ justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: i ? px(10, big) : 0, fontSize: px(i === last ? 42 : 35, big), fontWeight: i === last ? 700 : 400 })}>
          <div style={box({ flexShrink: 1, marginRight: px(16, big) })}>{r.label}</div>
          <div style={box({ fontWeight: 700, flexShrink: 0 })}>{r.amount}</div>
        </div>
      ))}
    </>
  ));
}

/** the family's sum along the insured's years: the years paid, then the years covered with nothing left to pay */
export function tpRoad(f: QuoteVideoFacts, g: TwelvePlVideoFacts, d: TpDraw, w: number, big = 1): ReactNode {
  const { pal } = d;
  const span = g.coverToAge - f.age;
  const paidTo = f.age + g.payYears;
  const p = d.p("road");
  const bar = px(120, big);
  const paidW = Math.round((g.payYears / span) * w);
  const shown = Math.round(w * p);
  const inside = paidW > px(210, big);
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {d.piece("roadLabel", { width: w, justifyContent: "space-between", marginBottom: px(14, big), fontSize: px(36, big), color: pal.ink }, (
        <>
          <div style={box({})}>{inside ? "" : `ออม ${g.payYears} ปี`}</div>
          <div style={box({})}>{`คุ้มครองต่ออีก ${g.coverToAge - paidTo} ปี`}</div>
        </>
      ))}
      <div style={box({ position: "relative", width: w, height: bar })}>
        <div style={abs({ left: 0, top: 0, width: shown, height: bar, background: pal.sky, borderRadius: px(18, big) })} />
        <div style={abs({ left: 0, top: 0, width: Math.min(shown, paidW), height: bar, background: pal.fill, color: pal.onFill, borderRadius: px(18, big), alignItems: "center", justifyContent: "center", fontSize: px(40, big), fontWeight: 700 })}>
          {inside && shown >= paidW ? `ออม ${g.payYears} ปี` : ""}
        </div>
      </div>
      {d.piece("ages", { position: "relative", width: w, height: px(60, big), marginTop: px(12, big), fontSize: px(38, big), fontWeight: 600, color: pal.ink }, (
        <>
          <div style={abs({ left: 0, top: 0 })}>{`อายุ ${f.age}`}</div>
          <div style={abs({ left: Math.max(px(190, big), paidW - px(30, big)), top: 0 })}>{String(paidTo)}</div>
          <div style={abs({ right: 0, top: 0 })}>{String(g.coverToAge)}</div>
        </>
      ))}
    </div>
  );
}

/** what the plan itself costs beside what comes back, to one scale: the cash backs, the maturity, the dividend outlined on top */
export function tpTotalPicture(g: TwelvePlVideoFacts, d: TpDraw, w: number, h: number, big = 1): ReactNode {
  const { pal } = d;
  const headH = px(90, big);
  const footH = px(70, big);
  const chartH = h - headH - footH;
  const top = Math.max(g.total, g.paid);
  const tall = (baht: number) => Math.round((baht / top) * chartH);
  const colW = Math.round(w * 0.36);
  const left = Math.round(w * 0.06);
  const right = w - colW - left;
  const paidH = Math.round(tall(g.paid) * d.p("paid"));
  const back = d.p("back");
  const cashH = Math.round(tall(g.cashBacks) * back);
  const matH = Math.round(tall(g.maturity) * back);
  const divH = g.dividend ? Math.round(tall(g.dividend.total) * d.p("div")) : 0;
  const word = (name: string, text: string, color: string, at: number, size: number, bold = 400) =>
    d.piece(name, { position: "absolute", left: right, width: colW, top: at, justifyContent: "center", fontSize: px(size, big), fontWeight: bold, color }, text);
  const base = headH + chartH;
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <div style={abs({ left, top: base - paidH, width: colW, height: paidH, background: pal.sky, borderRadius: "12px 12px 0 0" })} />
      {d.piece("paidLabel", { position: "absolute", left, width: colW, top: base - tall(g.paid) - px(78, big), justifyContent: "center", fontSize: px(54, big), fontWeight: 700, color: pal.ink }, tpMoney(g.paid))}
      <div style={abs({ left: right, top: base - cashH, width: colW, height: cashH, background: pal.green })} />
      <div style={abs({ left: right, top: base - cashH - matH, width: colW, height: matH, background: pal.fill, ...(divH ? {} : { borderRadius: "12px 12px 0 0" }) })} />
      {divH > 2 ? <div style={abs({ left: right, top: base - cashH - matH - divH, width: colW, height: divH, border: `${Math.max(3, px(5, big))}px dashed ${pal.red}` })} /> : null}
      <div style={abs({ left: right, width: colW, top: base - tall(g.cashBacks), height: tall(g.cashBacks), alignItems: "center", justifyContent: "center" })}>
        {tall(g.cashBacks) > px(50, big) ? d.piece("cashWord", { background: pal.green, color: pal.card, fontSize: px(34, big), fontWeight: 600 }, `เงินคืน ${tpMoney(g.cashBacks)}`) : null}
      </div>
      <div style={abs({ left: right, width: colW, top: base - tall(g.cashBacks) - tall(g.maturity), height: tall(g.maturity), alignItems: "center", justifyContent: "center" })}>
        {d.piece("matWord", { background: pal.fill, color: pal.onFill, flexDirection: "column", alignItems: "center" }, (
          <>
            <div style={box({ fontSize: px(34, big) })}>{`ครบอายุ ${g.coverToAge}`}</div>
            <div style={box({ fontSize: px(44, big), fontWeight: 700 })}>{tpMoney(g.maturity)}</div>
          </>
        ))}
      </div>
      {g.dividend && tall(g.dividend.total) > px(52, big)
        ? word("divWord", `ปันผล ~${tpMoney(g.dividend.total)}`, pal.red, base - tall(g.cashBacks) - tall(g.maturity) - Math.round(tall(g.dividend.total) / 2) - px(26, big), 33, 600)
        : null}
      {word("backLabel", `${g.dividend ? "~" : ""}${tpMoney(g.total)}`, pal.figure, base - tall(g.total) - px(84, big), 58, 700)}
      <div style={abs({ left: 0, top: base, width: w, height: 0, borderTop: `4px solid ${pal.ink}`, opacity: 0.55 })} />
      <div style={abs({ left, width: colW, top: base + px(14, big), justifyContent: "center", fontSize: px(40, big), color: pal.ink })}>{`ออมรวม ${g.payYears} ปี`}</div>
      <div style={abs({ left: right - px(40, big), width: colW + px(80, big), top: base + px(14, big), justifyContent: "center", fontSize: px(40, big), fontWeight: 600, color: pal.ink })}>{g.dividend ? "รับรวมประมาณ" : "รับการันตีรวม"}</div>
    </div>
  );
}

/** the words of the fifth scene round its picture */
export const tpTotalHead = (f: QuoteVideoFacts, g: TwelvePlVideoFacts) => ({
  kicker: "ออมไป เทียบกับ รับคืน",
  sub: `${f.riders ? "เฉพาะสัญญาหลัก " : ""}${f.insuredLine.replace(/ บาท$/, "")} · ถือครบถึงอายุ ${g.coverToAge}`,
  pill: g.dividend ? `ปันผล ตัวอย่างที่ ${g.dividend.example} ไม่การันตี` : "✓ การันตี ได้แน่นอน",
  sure: !g.dividend,
});

/** the lines kept small at the foot of a scene (facts.screenNote), one under another */
export const screenNoteLines = (f: QuoteVideoFacts): string[] => f.screenNote?.split(" · ") ?? [];
