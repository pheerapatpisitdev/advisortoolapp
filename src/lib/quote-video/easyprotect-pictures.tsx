import type { CSSProperties, ReactNode } from "react";
import { epMoney, type EasyProtectVideoFacts } from "./easyprotect";
import type { QuoteVideoFacts } from "./script";
import type { TpDraw } from "./twelvepl-pictures";

/**
 * อีซี่ โพรเทค 6's two pictures (owner, 2026-11-26, ก ก on https://claude.ai/artifact/YCrrpCe5o2uQ14xAoQmZHn): the six
 * premiums as coins, and what is paid beside what the family receives. The cover after the last premium is
 * twelvepl-pictures.tsx tpRoad. Drawn once for all four drawers; flex boxes only.
 */

const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
const abs = (s: CSSProperties): CSSProperties => ({ display: "flex", position: "absolute", ...s });
const px = (n: number, big: number) => Math.round(n * big);

/** the premiums, a coin a year with its amount, the insured's age under each */
export function epCoins(f: QuoteVideoFacts, g: EasyProtectVideoFacts, d: TpDraw, w: number, big = 1): ReactNode {
  const { pal } = d;
  const n = g.payYears;
  const gap = px(18, big);
  const size = Math.min(px(150, big), Math.floor((w - gap * (n - 1)) / n));
  const figure = Math.min(size * 0.22, (size * 0.86) / (g.annual.length * 0.56));
  return (
    <div style={box({ width: w, justifyContent: "space-between" })}>
      {Array.from({ length: n }, (_, i) => d.piece(`coin${i}`, { flexDirection: "column", alignItems: "center", width: size }, (
        <>
          <div style={box({ width: size, height: size, borderRadius: size / 2, background: pal.fill, color: pal.onFill, flexDirection: "column", alignItems: "center", justifyContent: "center" })}>
            <div style={box({ fontSize: Math.round(size * 0.19) })}>{`ปีที่ ${i + 1}`}</div>
            <div style={box({ fontSize: Math.round(figure), fontWeight: 700 })}>{g.annual}</div>
          </div>
          <div style={box({ marginTop: px(8, big), fontSize: px(34, big), color: pal.ink })}>{i === 0 ? `อายุ ${f.age}` : String(f.age + i)}</div>
        </>
      )))}
    </div>
  );
}

/** what is paid beside what the family receives, to one scale */
export function epTotalPicture(g: EasyProtectVideoFacts, d: TpDraw, w: number, h: number, big = 1): ReactNode {
  const { pal } = d;
  const headH = px(90, big);
  const footH = px(70, big);
  const chartH = h - headH - footH;
  const tall = (baht: number) => Math.round((baht / Math.max(g.sum, g.paid)) * chartH);
  const colW = Math.round(w * 0.34);
  const left = Math.round(w * 0.08);
  const right = w - colW - left;
  const base = headH + chartH;
  const paidH = Math.round(tall(g.paid) * d.p("paid"));
  const backH = Math.round(tall(g.sum) * d.p("back"));
  return (
    <div style={box({ position: "relative", width: w, height: h })}>
      <div style={abs({ left, top: base - paidH, width: colW, height: paidH, background: pal.sky, borderRadius: "12px 12px 0 0" })} />
      {d.piece("paidLabel", { position: "absolute", left: left - px(60, big), width: colW + px(120, big), top: base - tall(g.paid) - px(78, big), justifyContent: "center", fontSize: px(54, big), fontWeight: 700, color: pal.ink }, epMoney(g.paid))}
      <div style={abs({ left: right, top: base - backH, width: colW, height: backH, background: pal.fill, borderRadius: "12px 12px 0 0" })} />
      {d.piece("backLabel", { position: "absolute", left: right - px(60, big), width: colW + px(120, big), top: base - tall(g.sum) - px(84, big), justifyContent: "center", fontSize: px(58, big), fontWeight: 700, color: pal.figure }, epMoney(g.sum))}
      <div style={abs({ left: 0, top: base, width: w, height: 0, borderTop: `4px solid ${pal.ink}`, opacity: 0.55 })} />
      <div style={abs({ left: left - px(40, big), width: colW + px(80, big), top: base + px(14, big), justifyContent: "center", fontSize: px(38, big), color: pal.ink })}>{`จ่ายรวม ${g.payYears} ปี`}</div>
      <div style={abs({ left: right - px(80, big), width: colW + px(140, big), top: base + px(14, big), justifyContent: "center", fontSize: px(38, big), fontWeight: 600, color: pal.ink })}>{`ครอบครัวได้${g.atLeast ? "อย่างน้อย" : ""} ถึงอายุ ${g.coverToAge}`}</div>
    </div>
  );
}

export const EP_TOTAL_KICKER = "จ่ายไป เทียบกับ ครอบครัวได้";
export const epTimesPill = (g: EasyProtectVideoFacts) => `คุ้มครอง ${g.times} เท่าของเบี้ยที่จ่าย`;
export const epDonePill = (g: EasyProtectVideoFacts) => `ปีที่ ${g.payYears + 1} เป็นต้นไป ไม่ต้องจ่ายอีก`;
/** the road's words: the sum the family receives all along it */
export const epRoadWord = (g: EasyProtectVideoFacts) => `คุ้มครอง${g.atLeast ? "อย่างน้อย" : ""} ${epMoney(g.sum)}${g.atLeast ? "" : " เท่ากันตลอด"}`;
export const epFloorNote = (g: EasyProtectVideoFacts) => `หรือ ${g.floorPercent}% ของเบี้ยที่จ่าย หรือมูลค่าเวนคืน หากมากกว่า`;
/** what the break-even card says of the cash it names (motion.tsx Value): more than was paid, or อีซี่ โพรเทค 6's "as much as" */
export const breakEvenNote = (f: QuoteVideoFacts) => (f.easyprotect ? `ครบเท่าที่จ่ายไป ${f.totalPaid} บาท` : `มากกว่าที่จ่ายไป ${f.totalPaid} บาท`);
