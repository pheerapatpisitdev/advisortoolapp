import type { CSSProperties, ReactNode } from "react";
import type { TpDraw } from "./twelvepl-pictures";

/**
 * Two pictures for the plans that pay by stage or by event (CI 123 first, owner 2026-11-26, ข on
 * https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p; the cancer, PA and group plans after it): stairs that climb
 * to the largest sum, and a column of what each case pays. Drawn once for all four drawers — each passes its
 * colours and how a piece comes in (`TpDraw`) — in flex boxes only, as the drawing library takes them.
 *
 * Pieces: the stairs name theirs `bar0…` (grown), `amt0…` and `lab0…`; the rows `row0…`.
 */

const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
const px = (n: number, big: number) => Math.round(n * big);
const money = (n: number) => Math.round(n).toLocaleString("en-US");

/** one step of the stairs: what it is, the line under it, what it pays */
export interface Stair { label: string; sub?: string; amount: number }

/**
 * The steps side by side, each bar as tall as what it pays against the largest (the smallest kept readable),
 * the figure over it and the names under it; the last, the top, in the highlight. `tall`: the top bar's height at
 * `big` 1, more where a portrait frame has the room.
 */
export function stairsPicture(steps: Stair[], d: TpDraw, w: number, big = 1, tall = 430): ReactNode {
  const { pal } = d;
  const n = Math.max(1, steps.length);
  const gap = px(30, big);
  const colW = Math.floor((w - gap * (n - 1)) / n);
  const top = Math.max(1, ...steps.map((s) => s.amount));
  const maxH = px(tall, big);
  const minH = px(80, big);
  const figH = px(76, big);
  // the lower steps in the sky's blue, lighter the lower they are (a theme that paints cards white keeps them seen); the top in the highlight
  const shade = (i: number) => (i === n - 1 ? { background: pal.fill } : { background: pal.sky, opacity: n > 2 && i < n - 2 ? 0.55 : 1 });
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      <div style={box({ width: w, height: maxH + figH, alignItems: "flex-end" })}>
        {steps.map((s, i) => {
          const full = Math.max(minH, Math.round((s.amount / top) * maxH));
          const h = Math.round(full * d.p(`bar${i}`));
          const last = i === n - 1;
          return (
            <div key={i} style={box({ width: colW, marginRight: i < n - 1 ? gap : 0, height: full + figH, flexDirection: "column", justifyContent: "flex-end", alignItems: "center" })}>
              {d.piece(`amt${i}`, { height: figH, alignItems: "flex-end", paddingBottom: px(10, big), fontSize: px(last ? 54 : 44, big), fontWeight: 700, color: last ? pal.figure : pal.ink }, money(s.amount))}
              <div style={box({ width: colW, height: full, alignItems: "flex-end" })}>
                {h > 0 ? <div style={box({ width: colW, height: h, ...shade(i), borderRadius: `${px(20, big)}px ${px(20, big)}px 0 0` })} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div style={box({ width: w, height: 0, borderTop: `${Math.max(3, px(4, big))}px solid ${pal.ink}`, opacity: 0.55 })} />
      <div style={box({ width: w, marginTop: px(16, big) })}>
        {steps.map((s, i) => d.piece(`lab${i}`, { width: colW, marginRight: i < n - 1 ? gap : 0, flexDirection: "column", alignItems: "center" }, (
          <>
            <div style={box({ fontSize: px(36, big), fontWeight: 700, color: pal.ink, textAlign: "center", justifyContent: "center" })}>{s.label}</div>
            {s.sub ? <div style={box({ fontSize: px(30, big), color: pal.ink, opacity: 0.8, marginTop: px(2, big), textAlign: "center", justifyContent: "center" })}>{s.sub}</div> : null}
          </>
        )))}
      </div>
    </div>
  );
}

/** one case and what it pays: its name, up to two lines under it, the figure; `on` lights it */
export interface AmountRow { label: string; sub?: string; note?: string; amount: number; on?: boolean }

/** the cases in a column, `rowGap` under each: the lit one filled, the others outlined */
export function amountRows(rows: AmountRow[], d: TpDraw, w: number, big = 1, rowGap = 24): ReactNode {
  const { pal } = d;
  return (
    <div style={box({ flexDirection: "column", width: w })}>
      {rows.map((r, i) => d.piece(`row${i}`, {
        width: w, justifyContent: "space-between", alignItems: "center", borderRadius: px(26, big), marginBottom: px(rowGap, big),
        padding: `${px(22, big)}px ${px(34, big)}px`,
        background: r.on ? pal.fill : "transparent", border: `${Math.max(3, px(4, big))}px solid ${r.on ? pal.fill : pal.ink}`, color: r.on ? pal.onFill : pal.ink,
      }, (
        <>
          <div style={box({ flexDirection: "column", flexShrink: 1, marginRight: px(20, big) })}>
            <div style={box({ fontSize: px(44, big), fontWeight: r.on ? 700 : 600 })}>{r.label}</div>
            {r.sub ? <div style={box({ fontSize: px(30, big), marginTop: px(4, big), opacity: r.on ? 1 : 0.85 })}>{r.sub}</div> : null}
            {r.note ? <div style={box({ fontSize: px(26, big), marginTop: px(2, big), opacity: r.on ? 0.9 : 0.75 })}>{r.note}</div> : null}
          </div>
          <div style={box({ flexShrink: 0, alignItems: "baseline", fontSize: px(58, big), fontWeight: 700, color: r.on ? pal.onFill : pal.figure })}>
            {money(r.amount)}
            <div style={box({ fontSize: px(30, big), fontWeight: 400, marginLeft: px(8, big), color: r.on ? pal.onFill : pal.ink })}>บาท</div>
          </div>
        </>
      )))}
    </div>
  );
}
