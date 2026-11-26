import type { CSSProperties, ReactNode } from "react";
import type { LifeTreasureVideoFacts } from "./lifetreasure";
import type { TpDraw } from "./twelvepl-pictures";

/**
 * ไลฟ์เทรเชอร์'s own picture (owner, 2026-11-26, ก on https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p): its three paying
 * terms, each with its yearly saving, the total and the multiple, the chosen one lit. What is paid beside what the
 * family receives is อีซี่ โพรเทค 6's (easyprotect-pictures.tsx). Drawn once for all four drawers; flex boxes only.
 */

const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
const px = (n: number, big: number) => Math.round(n * big);

export const LT_TERMS_KICKER = "เลือกระยะจ่ายได้";
export const LT_TERMS_NOTE = "ตัวเลขคือยอดออมต่อปี";

/** the terms in a column, `rowH` each with a gap under it: the chosen one filled, the others outlined */
export function ltTermRows(g: LifeTreasureVideoFacts, d: TpDraw, w: number, big = 1): ReactNode {
  const { pal } = d;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {g.terms.map((r, i) => d.piece(r.on ? "on" : `row${i}`, {
        width: w, justifyContent: "space-between", alignItems: "center", borderRadius: px(26, big), marginBottom: px(24, big),
        padding: `${px(r.on ? 26 : 20, big)}px ${px(36, big)}px`,
        background: r.on ? pal.fill : "transparent", border: `${px(4, big)}px solid ${r.on ? pal.fill : pal.ink}`, color: r.on ? pal.onFill : pal.ink,
      }, (
        <>
          <div style={box({ flexDirection: "column", flexShrink: 1, marginRight: px(20, big) })}>
            <div style={box({ fontSize: px(r.on ? 50 : 44, big), fontWeight: r.on ? 700 : 600 })}>{`จ่าย ${r.years} ปี`}</div>
            <div style={box({ fontSize: px(30, big), marginTop: px(4, big), opacity: r.on ? 1 : 0.85 })}>{`รวม ${r.total}${r.times ? ` · ส่งต่อ ${r.times} เท่า` : ""}`}</div>
          </div>
          <div style={box({ flexShrink: 0, alignItems: "baseline", fontSize: px(r.on ? 62 : 52, big), fontWeight: 700, color: r.on ? pal.onFill : pal.figure })}>
            {r.annual}
            <div style={box({ fontSize: px(32, big), fontWeight: 400, marginLeft: px(8, big), color: r.on ? pal.onFill : pal.ink })}>/ปี</div>
          </div>
        </>
      )))}
    </div>
  );
}
