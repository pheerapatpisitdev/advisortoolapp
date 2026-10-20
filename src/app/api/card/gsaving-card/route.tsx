import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import type { NextRequest } from "next/server";
import { pngResponse } from "@/lib/draw-png";
import { addressedAs, cleanCustomerName, NAME_KEY, NAMED_CACHE } from "@/lib/customer-name";
import { BLUE_PEN } from "@/lib/card-theme";
import { googleFontSubset } from "@/lib/google-font";
import { GSAVING_CARD_KEYS, toCanonical } from "../canonical";
import { SITE_ADDRESS } from "../site-footer";
import {
  GS_AGE_MAX, GS_AGE_MIN, GS_CODE, GS_PREM_YEARS, GS_TAX_CAP, GS_TERM, quoteGlobalSaving, type GsQuote,
} from "@/calc/global-saving/engine";
import {
  INDEX_ALLOCATION, INDEX_ANNUAL_RETURNS, INDEX_BASE_YEAR, INDEX_EVENTS, INDEX_METRICS, INDEX_NAME, indexLevels,
} from "@/calc/global-saving/factsheet";
import { barPens, tablePens, GS_TABLE_COLUMNS, type Box, type PenDrawing } from "@/lib/global-saving-pens";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/**
 * Global Savings Plus 15/8's whole page as one picture, for its ส่งให้ลูกค้า (owner chose ข,
 * 2026-10-20, mockup https://claude.ai/artifact/LFdeuWuES7nPqspkR8GQPd): who it is for and the
 * four headline figures, the bars of everything received at each index return, ตารางที่ 1 against
 * a bank, ตารางที่ 2 year by year with the page's own pen notes (lib/global-saving-pens.ts), the
 * index it follows, and the legal lines — in place of the earlier three-example table (ค).
 *
 * Laid out at the page's own sizes, so the pens land where the page puts them, and drawn twice as
 * large so the figures stay sharp when the customer zooms in on a phone.
 */

const SCALE = 2;
const PAD = 40;
const CW = 1120;
const WIDTH = CW + PAD * 2;

/** the page's colours (globals.css, global-saving/tool.css) */
const K = {
  navy: "#022162", navyDeep: "#01143d", navyLift: "#0a2f7a", navySoft: "#dde3f0",
  ink: "#15181d", mute: "#5b6472", hair: "#c3c6cd", panelLine: "#7d8490", band: "#f2f2f2",
  ok: "#356048", okSoft: "#e4ece7", okLine: "#9dbfae", sand: "#c6bc99", sandSoft: "#e7e3d4", sandLine: "#948763", sandInk: "#5f5436",
  red: "#b44340", pen: "#d62828", olive: "#736c42", highlighter: "#ffe14d",
  eq2: "#2a4f9a", eq3: "#6f8fd0", bond2: "#5f8c72", credit: "#5c4b8a",
};
const BONUS_FILL = [K.hair, "#b9cbea", "#8fb3e3", "#4f78c4", K.navyLift];
const BONUS_INK = [K.ink, K.ink, K.ink, "#fff", "#fff"];
const INK = { red: K.pen, blue: BLUE_PEN } as const;

const baht = (n: number) => Math.round(n).toLocaleString("en-US");
const premiumText = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = (r: number) => `${r >= 0 ? "+" : "−"}${+(Math.abs(r) * 100).toFixed(2)}%`;
const pct2 = (n: number) => n.toFixed(2);

/** a figure's width in 14px Plex, near enough to aim a pen at */
const textW = (s: string, size = 14) => [...s].reduce((w, c) => w + (c === "," || c === "." ? 0.27 : /[0-9]/.test(c) ? 0.6 : 0.58), 0) * size;

const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

type Style = Record<string, string | number>;
const row = (s: Style = {}): Style => ({ display: "flex", flexDirection: "row", ...s });
const col = (s: Style = {}): Style => ({ display: "flex", flexDirection: "column", ...s });
const abs = (x: number, y: number, s: Style = {}): Style => ({ display: "flex", position: "absolute", left: x, top: y, ...s });

/** The quote the address names, priced as the page priced it, or undefined when it names none. */
function quoteFrom(params: URLSearchParams) {
  const age = Number(params.get("age"));
  const prem = params.get("prem");
  const sum = params.get("sum");
  if (!Number.isInteger(age) || age < GS_AGE_MIN || age > GS_AGE_MAX) return undefined;
  if ((prem === null) === (sum === null)) return undefined;
  const amount = Number(prem ?? sum);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const q = quoteGlobalSaving({ basis: prem !== null ? "premium" : "sumAssured", amount, age });
  return q.warnings.length ? undefined : { age, q };
}

/** the pen notes over a block: strokes as one SVG, words in the handwriting */
function Pens({ pens, w, h, face }: { pens: PenDrawing; w: number; h: number; face: string }) {
  return (
    <div style={abs(0, 0, { width: w, height: h })}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {pens.strokes.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={INK[s.ink]} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {pens.labels.map((l, i) => {
        const wide = Math.max(...l.lines.map((x) => textW(x, 14.5)));
        return (
          <div key={`${i}:${l.lines[0]}`} style={abs(l.alignRight ? l.x - wide : l.x, l.y, {
            flexDirection: "column", fontFamily: face, fontSize: 14, lineHeight: 1.25, color: INK[l.ink], whiteSpace: "nowrap",
            transform: `rotate(${l.tilt}deg)`, transformOrigin: "0 0", alignItems: l.alignRight ? "flex-end" : "flex-start",
          })}>
            {l.lines.map((x) => <div key={x} style={{ display: "flex" }}>{x}</div>)}
          </div>
        );
      })}
    </div>
  );
}

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <div style={row({ alignItems: "baseline", height: 30 })}>
      <div style={{ display: "flex", fontSize: 17, fontWeight: 600, color: K.ink }}>{title}</div>
      {note ? <div style={{ display: "flex", fontSize: 14, color: K.mute, marginLeft: 8 }}>{note}</div> : null}
    </div>
  );
}

function Tag({ guaranteed }: { guaranteed: boolean }) {
  return (
    <div style={{
      display: "flex", marginLeft: 6, padding: "0 6px", borderRadius: 4, fontSize: 11, fontWeight: 600, height: 18, alignItems: "center",
      background: guaranteed ? K.okSoft : K.sandSoft, color: guaranteed ? K.ok : K.sandInk,
    }}>
      {guaranteed ? "การันตี" : "ไม่การันตี"}
    </div>
  );
}

// ── the bars ─────────────────────────────────────────────────────────────────────────────────

const BAR = { h: 256, top: 48, gap: 10 };
const BAR_W = (CW - BAR.gap * 4) / 5;
const BARS_H = BAR.h + 60 + 30;

function Bars({ q, face }: { q: GsQuote; face: string }) {
  const area = BAR.h - BAR.top;
  const top = Math.max(...q.scenarios.map((s) => s.total)) * 1.12;
  const bars = q.scenarios.map((s, i) => {
    const x = i * (BAR_W + BAR.gap);
    const gh = q.guaranteed / top * area;
    const bh = (s.total - q.guaranteed) / top * area;
    const g: Box = { x, y: BAR.h - gh, w: BAR_W, h: gh };
    const b: Box | null = bh > 0 ? { x, y: g.y - bh, w: BAR_W, h: bh } : null;
    const label = baht(s.total);
    const lw = textW(label, 14);
    const t: Box = { x: x + (BAR_W - lw) / 2, y: (b ?? g).y - 4 - 20, w: lw, h: 20 };
    return { s, i, g, b, t, label };
  });
  const pens = barPens({ guaranteed: bars.map((b) => b.g), totals: bars.map((b) => b.t), topBonus: bars[bars.length - 1].b }, q.guaranteed);
  return (
    <div style={col({ width: CW })}>
      <Heading title={`เงินรับรวมเมื่อถือครบ ${GS_TERM} ปี`} note="แยกตามผลตอบแทนดัชนีต่อปี" />
      <div style={{ display: "flex", position: "relative", width: CW, height: BAR.h, marginTop: 8, borderBottom: `1px solid ${K.panelLine}` }}>
        {bars.map(({ s, i, g, b, t, label }) => [
          <div key={`t${i}`} style={abs(t.x, t.y, { fontSize: 14, fontWeight: 600, color: K.ink })}>{label}</div>,
          b ? (
            <div key={`b${i}`} style={abs(b.x, b.y, {
              width: b.w, height: b.h, background: BONUS_FILL[i], color: BONUS_INK[i], justifyContent: "center",
              borderRadius: "4px 4px 0 0", fontSize: 12, paddingTop: 2,
            })}>{`+${baht(s.total - q.guaranteed)}`}</div>
          ) : null,
          <div key={`g${i}`} style={abs(g.x, g.y, {
            width: g.w, height: g.h, background: K.navy, color: "#fff", fontSize: 12, alignItems: "center", justifyContent: "center",
          })}>{i === 0 ? "การันตี" : ""}</div>,
        ])}
        <Pens pens={pens} w={CW} h={BAR.h} face={face} />
      </div>
      <div style={row({ width: CW, marginTop: 6, height: 44 })}>
        {q.scenarios.map((s, i) => (
          <div key={s.rate} style={col({ width: BAR_W, marginLeft: i ? BAR.gap : 0, alignItems: "center", fontSize: 14, color: K.mute, lineHeight: 1.45 })}>
            <div style={{ display: "flex" }}>{`ดัชนี ${pct(s.rate)}`}</div>
            <div style={{ display: "flex", fontWeight: 600, color: K.ink }}>{`IRR ${s.irr.toFixed(2)}%`}</div>
          </div>
        ))}
      </div>
      <div style={row({ height: 24, fontSize: 12, color: K.mute, alignItems: "center", marginTop: 6 })}>
        <div style={{ display: "flex", width: 10, height: 10, background: K.navy, marginRight: 6 }} />
        <div style={{ display: "flex", marginRight: 20 }}>เงินการันตี เท่ากันทุกแท่ง</div>
        <div style={{ display: "flex", width: 10, height: 10, background: BONUS_FILL[2], marginRight: 6 }} />
        <div style={{ display: "flex" }}>โบนัสดัชนี ไม่การันตี</div>
      </div>
    </div>
  );
}

// ── ตารางที่ 1 ───────────────────────────────────────────────────────────────────────────────

const T1 = { label: 320, cell: 100, bank: 150, head: 40, row: 36 };

function Overview({ q }: { q: GsQuote }) {
  const head = (text: string, w: number, first = false) => (
    <div key={text} style={row({
      width: w, height: T1.head, alignItems: "center", justifyContent: first ? "flex-start" : "flex-end", padding: "0 8px",
      background: K.navy, color: "#fff", fontWeight: 600, fontSize: 14, ...(first ? {} : { borderLeft: "1px solid rgba(255,255,255,0.35)" }),
    })}>{text}</div>
  );
  const line = (key: string, label: ReactNode, cells: string[], banks: string[], o: { total?: boolean; strong?: boolean; bonus?: boolean } = {}) => (
    <div key={key} style={row({
      height: T1.row, alignItems: "center", fontSize: 14,
      borderTop: o.total ? `2px solid ${K.panelLine}` : `1px solid ${K.hair}`,
      ...(o.total ? { background: K.navySoft, color: K.navy, fontWeight: 600 } : {}), ...(o.strong ? { fontWeight: 600 } : {}),
    })}>
      <div style={row({ width: T1.label, padding: "0 8px", alignItems: "center" })}>{label}</div>
      {cells.map((c, i) => (
        <div key={i} style={row({ width: T1.cell, justifyContent: "flex-end", padding: "0 8px", ...(o.bonus ? { fontWeight: 600, color: K.navyLift } : {}) })}>{c}</div>
      ))}
      {banks.map((c, i) => <div key={`b${i}`} style={row({ width: T1.bank, justifyContent: "flex-end", padding: "0 8px" })}>{c}</div>)}
    </div>
  );
  const dash = q.banks.map(() => "—");
  return (
    <div style={col({ width: CW })}>
      <Heading title="ตารางที่ 1 · ภาพรวมผลประโยชน์" note={`เมื่ออยู่ครบสัญญา ${GS_TERM} ปี เทียบกับฝากธนาคาร`} />
      <div style={col({ marginTop: 8, border: `1px solid ${K.panelLine}`, borderRadius: 8, overflow: "hidden" })}>
        <div style={row()}>
          {head("รายการผลประโยชน์", T1.label, true)}
          {q.scenarios.map((s) => head(`ดัชนี ${pct(s.rate)}`, T1.cell))}
          {q.banks.map((b) => head(`ฝากธนาคาร ${+(b.rate * 100).toFixed(2)}%`, T1.bank))}
        </div>
        {line("pb", <><div style={{ display: "flex" }}>{`เงินคืนรายปี (สิ้นปี 1–${GS_TERM - 1})`}</div><Tag guaranteed /></>, q.scenarios.map((s) => baht(s.paybackTotal)), dash)}
        {line("mat", <><div style={{ display: "flex" }}>{`เงินครบสัญญา (สิ้นปี ${GS_TERM})`}</div><Tag guaranteed /></>, q.scenarios.map((s) => baht(s.maturity)), q.banks.map((b) => baht(b.total)))}
        {q.scenarios[0].bonuses.map((b, bi) => line(`b${b.year}`,
          <><div style={{ display: "flex" }}>{`โบนัสดัชนี · ${b.year === GS_TERM ? "ครบสัญญา" : `สิ้นปี ${b.year}`}`}</div><Tag guaranteed={false} /></>,
          q.scenarios.map((s) => (s.bonuses[bi].value > 0 ? baht(s.bonuses[bi].value) : "—")), dash, { bonus: true }))}
        {line("tot", "รวมรับทั้งหมดตลอดสัญญา", q.scenarios.map((s) => baht(s.total)), q.banks.map((b) => baht(b.total)), { total: true })}
        {line("irr", "ผลตอบแทนเฉลี่ยต่อปี (IRR)", q.scenarios.map((s) => `${s.irr.toFixed(2)}%`), q.banks.map((b) => `${+(b.rate * 100).toFixed(2)}%`), { strong: true })}
      </div>
    </div>
  );
}
const OVERVIEW_H = 30 + 8 + 2 + T1.head + 6 * T1.row + 1;

// ── ตารางที่ 2 ───────────────────────────────────────────────────────────────────────────────

/** the page's columns: ปีที่ อายุ เบี้ยต่อปี เบี้ยสะสม เงินคืน คุ้มครองชีวิต, five bonuses, ลดหย่อนภาษี */
const T2_COLS = [58, 70, 92, 92, 102, 120, 92, 92, 92, 92, 92, 126];
const T2_X = T2_COLS.reduce<number[]>((xs, w, i) => [...xs, xs[i] + w], [0]);
const T2 = { group: 28, head: 36, row: 33, total: 36, pad: 8 };

function Yearly({ q, age, face }: { q: GsQuote; age: number; face: string }) {
  const rows = q.scenarios[0].rows;
  const bodyH = rows.length * T2.row + T2.total;
  const C = GS_TABLE_COLUMNS;
  /** each body cell's words, by policy year and column */
  const cellText = (y: number, c: number): string => {
    const r = rows[y - 1];
    if (c === C.year) return String(r.year);
    if (c === C.age) return String(age + r.year - 1);
    if (c === C.premium) return r.premium ? baht(r.premium) : "";
    if (c === C.paid) return r.year <= GS_PREM_YEARS ? baht(r.paid) : "";
    if (c === C.payback) return baht(r.payback);
    if (c === C.death) return baht(r.death);
    if (c === C.tax) return r.premium ? baht(Math.min(r.premium, GS_TAX_CAP)) : "";
    const s = q.scenarios[c - C.bonusFirst];
    const b = s.bonuses.find((x) => x.year === r.year);
    return b ? (b.value > 0 ? baht(b.value) : "—") : "";
  };
  const left = (c: number) => c === C.year;
  const cellBox = (y: number, c: number): Box => ({ x: T2_X[c], y: (y - 1) * T2.row, w: T2_COLS[c], h: T2.row });
  const textBox = (y: number, c: number): Box | null => {
    const t = cellText(y, c);
    if (!t || t === "—") return null;
    const w = textW(t), cell = cellBox(y, c);
    return { x: left(c) ? cell.x + T2.pad : cell.x + cell.w - T2.pad - w, y: cell.y + (T2.row - 18) / 2, w, h: 18 };
  };
  const pens = tablePens({ cell: cellBox, text: textBox }, {
    premYears: GS_PREM_YEARS, term: GS_TERM, payback: rows[0].payback, maturity: q.scenarios[0].maturity,
    bonusYears: q.scenarios[0].bonuses.map((b) => b.year),
  });
  const th = (key: string, text: string, w: number, s: Style = {}) => (
    <div key={key} style={row({
      width: w, height: T2.head, alignItems: "flex-end", justifyContent: "flex-end", padding: "0 8px 8px",
      background: K.navy, color: "#fff", fontWeight: 600, fontSize: 14, borderLeft: "1px solid rgba(255,255,255,0.35)", ...s,
    })}>{text}</div>
  );
  const bonusW = T2_COLS.slice(C.bonusFirst, C.bonusLast + 1).reduce((a, b) => a + b, 0);
  return (
    <div style={col({ width: CW })}>
      <Heading title="ตารางที่ 2 · ผลประโยชน์รายปี" note={`ปีที่ 1–${GS_TERM}`} />
      <div style={col({ marginTop: 8, border: `1px solid ${K.panelLine}`, borderRadius: 8, overflow: "hidden" })}>
        <div style={row({ height: T2.group, fontSize: 12, fontWeight: 600, color: "#fff" })}>
          <div style={{ display: "flex", width: T2_X[C.premium], background: K.navyDeep }} />
          <div style={row({ width: T2_X[C.bonusFirst] - T2_X[C.premium], background: K.navyDeep, justifyContent: "center", alignItems: "center", borderLeft: "1px solid rgba(255,255,255,0.35)" })}>ส่วนการันตี</div>
          <div style={row({ width: bonusW, background: K.navyLift, justifyContent: "center", alignItems: "center", borderLeft: "1px solid rgba(255,255,255,0.35)" })}>โบนัสดัชนี (ไม่การันตี)</div>
          <div style={{ display: "flex", width: T2_COLS[C.tax], background: K.navyDeep, borderLeft: "1px solid rgba(255,255,255,0.35)" }} />
        </div>
        <div style={row()}>
          {["ปีที่", "อายุ", "เบี้ยต่อปี", "เบี้ยสะสม", "เงินคืน", "คุ้มครองชีวิต"].map((h, i) =>
            th(h, h, T2_COLS[i], i === 0 ? { justifyContent: "flex-start", borderLeft: "0" } : {}))}
          {q.scenarios.map((s, k) => th(`s${s.rate}`, pct(s.rate), T2_COLS[C.bonusFirst + k]))}
          {th("tax", "ลดหย่อนภาษี", T2_COLS[C.tax])}
        </div>
        <div style={{ display: "flex", position: "relative", width: CW, height: bodyH, flexDirection: "column" }}>
          {rows.map((r, n) => (
            <div key={r.year} style={row({
              height: T2.row, fontSize: 14, alignItems: "center", background: n % 2 ? "rgba(242,242,242,0.6)" : "#fff",
              borderTop: `1px solid ${K.hair}`, ...(r.year === GS_PREM_YEARS ? { borderBottom: `2px solid ${K.navy}`, height: T2.row } : {}),
            })}>
              {T2_COLS.map((w, c) => {
                const t = cellText(r.year, c);
                const bonus = c >= C.bonusFirst && c <= C.bonusLast && t !== "";
                const matured = c === C.payback && r.year === GS_TERM;
                return (
                  <div key={c} style={row({
                    width: w, justifyContent: left(c) ? "flex-start" : "flex-end", padding: `0 ${T2.pad}px`,
                    ...(bonus ? { fontWeight: 600, color: K.navyLift } : {}),
                  })}>
                    {matured ? (
                      <div style={{ display: "flex", fontWeight: 600, background: K.highlighter, padding: "0 3px", margin: "0 -3px" }}>{t}</div>
                    ) : t}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={row({ height: T2.total, alignItems: "center", background: K.navy, color: "#fff", fontWeight: 700, fontSize: 14 })}>
            <div style={row({ width: T2_X[C.premium], padding: `0 ${T2.pad}px` })}>รวมรับทั้งหมด</div>
            {[baht(GS_PREM_YEARS * q.premium), "", baht(q.guaranteed), "", ...q.scenarios.map((s) => baht(s.total)), baht(GS_PREM_YEARS * Math.min(q.premium, GS_TAX_CAP))]
              .map((t, k) => (
                <div key={k} style={row({ width: T2_COLS[C.premium + k], justifyContent: "flex-end", padding: `0 ${T2.pad}px` })}>{t}</div>
              ))}
          </div>
          <Pens pens={pens} w={CW} h={bodyH} face={face} />
        </div>
      </div>
      <div style={row({ marginTop: 8, fontSize: 12, height: 20 })}>
        <div style={{ display: "flex", color: BLUE_PEN, marginRight: 20 }}>✎ ปากกาน้ำเงิน = เงินที่การันตี ได้แน่นอน</div>
        <div style={{ display: "flex", color: K.pen }}>✎ ปากกาแดง = เบี้ยที่จ่าย และโบนัสดัชนีที่ไม่การันตี</div>
      </div>
      <div style={{ display: "flex", fontSize: 12, color: K.mute, height: 20 }}>
        โบนัสดัชนีจ่ายจริง 2 ครั้ง คือสิ้นปีที่ 10 และตอนครบสัญญา ปีอื่นจึงเว้นว่าง
      </div>
    </div>
  );
}
const yearlyH = (q: GsQuote) => 30 + 8 + 2 + T2.group + T2.head + q.scenarios[0].rows.length * T2.row + T2.total + 8 + 40;

// ── the index ────────────────────────────────────────────────────────────────────────────────

const GROUP_COLOURS: Record<string, string[]> = {
  "หุ้น": [K.navy, K.eq2, K.eq3],
  "พันธบัตรรัฐบาล": [K.ok, K.bond2, K.okLine],
  "ตราสารหนี้เอกชน": [K.credit],
  "โภคภัณฑ์": [K.sandLine, K.sand],
};
const PANEL = { gap: 20, h: 400 };
const LEFT_W = Math.round((CW - PANEL.gap) * 5 / 12);
const RIGHT_W = CW - PANEL.gap - LEFT_W;
const ANNUAL_H = 296;

/** one ring segment, from `a0` to `a1` turns clockwise from the top */
function arc(cx: number, cy: number, r1: number, r0: number, a0: number, a1: number): string {
  const pt = (r: number, a: number) => [cx + r * Math.sin(a * 2 * Math.PI), cy - r * Math.cos(a * 2 * Math.PI)].map((v) => v.toFixed(2)).join(" ");
  const big = a1 - a0 > 0.5 ? 1 : 0;
  return `M${pt(r1, a0)} A${r1} ${r1} 0 ${big} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 ${big} 0 ${pt(r0, a0)} Z`;
}

const panel = (w: number, h: number): Style => ({
  display: "flex", flexDirection: "column", position: "relative", width: w, height: h, padding: 16,
  border: `1px solid ${K.panelLine}`, borderRadius: 8, background: "#fff",
});

function Allocation() {
  let acc = 0;
  const groups = INDEX_ALLOCATION.map((g) => ({
    ...g,
    total: g.items.reduce((s, i) => s + i.pct, 0),
    items: g.items.map((it, k) => {
      const from = acc / 100;
      acc += it.pct;
      return { ...it, colour: GROUP_COLOURS[g.name]?.[k] ?? K.mute, from, to: acc / 100 };
    }),
  }));
  const count = INDEX_ALLOCATION.reduce((s, g) => s + g.items.length, 0);
  return (
    <div style={panel(LEFT_W, PANEL.h)}>
      <div style={{ display: "flex", fontSize: 16, fontWeight: 600, height: 26 }}>สัดส่วนการลงทุนเฉลี่ย</div>
      <div style={row({ marginTop: 12, alignItems: "center" })}>
        <div style={{ display: "flex", position: "relative", width: 160, height: 160, flexShrink: 0 }}>
          <svg width={160} height={160} viewBox="0 0 160 160">
            {groups.flatMap((g) => g.items.map((it) => <path key={it.en} d={arc(80, 80, 80, 52, it.from, Math.min(it.to, 0.99999))} fill={it.colour} />))}
          </svg>
          <div style={abs(0, 0, { width: 160, height: 160, flexDirection: "column", alignItems: "center", justifyContent: "center" })}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: K.ink }}>100%</div>
            <div style={{ display: "flex", fontSize: 12, color: K.mute }}>{`${count} สินทรัพย์`}</div>
          </div>
        </div>
        <div style={col({ flex: 1, marginLeft: 20, fontSize: 14 })}>
          {groups.map((g) => (
            <div key={g.name} style={col()}>
              <div style={{ display: "flex", fontSize: 12, color: K.mute, marginTop: 6 }}>{`${g.name} · ${pct2(g.total)}%`}</div>
              {g.items.map((it) => (
                <div key={it.en} style={row({ alignItems: "center", height: 22 })}>
                  <div style={{ display: "flex", width: 10, height: 10, background: it.colour, marginRight: 8 }} />
                  <div style={{ display: "flex", flex: 1 }}>{it.th}</div>
                  <div style={{ display: "flex" }}>{`${pct2(it.pct)}%`}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={abs(16, PANEL.h - 34, { fontSize: 12, color: K.mute })}>ข้อมูลเฉลี่ย ม.ค. 2548 – เม.ย. 2569</div>
    </div>
  );
}

function Level() {
  const pts = indexLevels();
  const last = pts[pts.length - 1];
  const W = RIGHT_W - 32, H = 230, L = 40, R = 12, T = 14, B = 26;
  const x0 = INDEX_BASE_YEAR, x1 = last.year, yMin = 90, yMax = 300;
  const X = (y: number) => L + (y - x0) / (x1 - x0) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)} ${Y(p.level).toFixed(1)}`).join(" ");
  const events = INDEX_EVENTS.map((e) => `${e.text} ${e.from === e.to ? e.from : `${e.from}–${String(e.to).slice(2)}`}`).join(" · ");
  return (
    <div style={panel(RIGHT_W, PANEL.h)}>
      <div style={row({ alignItems: "baseline", height: 26 })}>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 600 }}>ราคาดัชนี</div>
        <div style={{ display: "flex", fontSize: 14, color: K.mute, marginLeft: 8 }}>{`เริ่ม 100 จุด ธ.ค. ${INDEX_BASE_YEAR}`}</div>
      </div>
      <div style={{ display: "flex", position: "relative", width: W, height: H, marginTop: 8 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {INDEX_EVENTS.map((e) => <rect key={e.from} x={X(e.from - 1)} y={T} width={X(e.to) - X(e.from - 1)} height={H - T - B} fill={K.sandSoft} />)}
          {[100, 150, 200, 250, 300].map((g) => <line key={g} x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke={K.hair} strokeWidth={1} />)}
          <path d={`${d} L${X(x1)} ${Y(yMin)} L${X(x0)} ${Y(yMin)} Z`} fill={K.navySoft} fillOpacity={0.6} />
          <path d={d} fill="none" stroke={K.navy} strokeWidth={2.2} />
          <circle cx={X(x1)} cy={Y(last.level)} r={4} fill={K.navy} />
        </svg>
        {[100, 150, 200, 250, 300].map((g) => (
          <div key={g} style={abs(0, Y(g) - 8, { width: L - 6, justifyContent: "flex-end", fontSize: 11, color: K.mute })}>{String(g)}</div>
        ))}
        {[2545, 2550, 2555, 2560, 2565].map((g) => (
          <div key={g} style={abs(X(g) - 20, H - 20, { width: 40, justifyContent: "center", fontSize: 11, color: K.mute })}>{String(g)}</div>
        ))}
        <div style={abs(X(x1) - 80, Y(last.level) - 24, { width: 72, justifyContent: "flex-end", fontSize: 12, fontWeight: 600, color: K.navy })}>
          {`${Math.round(last.level)} จุด`}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 12, color: K.mute, marginTop: 8, lineHeight: 1.5 }}>{`แถบสีทราย = ช่วงตลาดผันผวน: ${events}`}</div>
    </div>
  );
}

function Annual() {
  const years = Object.keys(INDEX_ANNUAL_RETURNS).map(Number).sort((a, b) => a - b);
  const bw = 46, W = years.length * bw + 30, H = 216, zero = 124, k = 8.5;
  return (
    <div style={panel(CW, ANNUAL_H)}>
      <div style={row({ alignItems: "baseline", height: 26 })}>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 600 }}>ผลตอบแทนรายปี</div>
        <div style={{ display: "flex", fontSize: 14, color: K.mute, marginLeft: 8 }}>% ต่อปี</div>
      </div>
      <div style={{ display: "flex", position: "relative", width: W, height: H, marginTop: 8 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <line x1={20} x2={W - 6} y1={zero} y2={zero} stroke={K.panelLine} strokeWidth={1} />
          {years.map((y, i) => {
            const r = INDEX_ANNUAL_RETURNS[y], cx = 24 + i * bw, h = Math.abs(r) * k;
            return <rect key={y} x={cx + 6} y={r >= 0 ? zero - h : zero} width={bw - 12} height={h} fill={r >= 0 ? K.navy : K.red} />;
          })}
        </svg>
        {years.flatMap((y, i) => {
          const r = INDEX_ANNUAL_RETURNS[y], cx = 24 + i * bw, h = Math.abs(r) * k, up = r >= 0;
          return [
            <div key={`v${y}`} style={abs(cx - 6, up ? zero - h - 18 : zero + h + 2, { width: bw + 12, justifyContent: "center", fontSize: 11, color: up ? K.ink : K.red })}>
              {`${r > 0 ? "+" : ""}${r.toFixed(2)}`}
            </div>,
            <div key={`y${y}`} style={abs(cx, H - 16, { width: bw, justifyContent: "center", fontSize: 11, color: K.mute })}>{String(y).slice(2)}</div>,
          ];
        })}
      </div>
      <div style={{ display: "flex", fontSize: 12, color: K.mute, marginTop: 6 }}>ปี พ.ศ. 2546–2568 (ตัวเลขใต้แท่ง = 2 หลักท้ายของปี)</div>
    </div>
  );
}

const INDEX_HEAD_H = 64;
function Index() {
  const metric = (value: string, label: string) => (
    <div key={label} style={col({ marginLeft: 28, alignItems: "flex-start" })}>
      <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: K.navy }}>{value}</div>
      <div style={{ display: "flex", fontSize: 12, color: K.mute }}>{label}</div>
    </div>
  );
  return (
    <div style={col({ width: CW })}>
      <div style={row({ height: INDEX_HEAD_H, justifyContent: "space-between", alignItems: "flex-end" })}>
        <div style={col()}>
          <div style={{ display: "flex", fontSize: 12, color: K.mute }}>ดัชนีอ้างอิงของแบบนี้ · หลายสินทรัพย์ ควบคุมความผันผวน</div>
          <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 21, fontWeight: 600, color: K.ink }}>{INDEX_NAME}</div>
        </div>
        <div style={row()}>
          {metric(`${pct2(INDEX_METRICS.avgReturn)}%`, "ผลตอบแทนเฉลี่ยต่อปี")}
          {metric(`${pct2(INDEX_METRICS.avgVolatility)}%`, "ความผันผวนเฉลี่ยต่อปี")}
          {metric(pct2(INDEX_METRICS.sharpe), "Sharpe ratio")}
        </div>
      </div>
      <div style={row({ marginTop: 16 })}>
        <Allocation />
        <div style={{ display: "flex", width: PANEL.gap }} />
        <Level />
      </div>
      <div style={{ display: "flex", marginTop: PANEL.gap }}><Annual /></div>
    </div>
  );
}
const INDEX_H = INDEX_HEAD_H + 16 + PANEL.h + PANEL.gap + ANNUAL_H;

// ── the card ─────────────────────────────────────────────────────────────────────────────────

const HEAD_H = 40 + 24 + 34 + 12 + 112;
const LEGAL = [
  "เงินการันตี (เงินคืนรายปี 1% ของทุน · ครบสัญญา 801% ของทุน · มูลค่าเวนคืน) ได้รับแน่นอน โบนัสตามดัชนีไม่การันตี จ่ายสิ้นปีที่ 10 และครบสัญญา",
  "ผลการดำเนินงานในอดีตมิได้เป็นสิ่งยืนยันผลในอนาคต · ผลตอบแทนดัชนีเป็นค่าก่อนปรับด้วยอัตราการมีส่วนร่วม · ข้อมูลตั้งแต่ พ.ค. 2565 เป็นผลจริง ก่อนหน้านั้นจำลองย้อนหลัง",
  "นำเบี้ยไปลดหย่อนภาษีได้ตามจ่ายจริง สูงสุด 100,000 บาท/ปี ตามเกณฑ์กรมสรรพากร · ตัวเลขเป็นประมาณการ อาจต่างจากใบเสนอของบริษัทเล็กน้อยจากการปัดเศษ",
  "“โกลบอล เซฟวิ่งส์ พลัส 15/8 (อินเด็กซ์ ลิงค์)” ของบริษัท กรุงไทย-แอกซา ประกันชีวิต จำกัด (มหาชน) ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง",
];
const LEGAL_H = LEGAL.length * 20 + 8;
const FOOT_H = 52;
const GAP = 36;

/** every letter the pen notes write, for the handwriting face cut to them */
const PEN_LETTERS = "✎ปากกาน้ำเงินแดง=เงินที่การันตีได้แน่นอนเบี้ยที่จ่ายและโบนัสดัชนีที่ไม่การันตี"
  + "เบี้ยเท่าเดิมทุกปีจ่ายแค่ปีแล้วหยุดเงินคืน1%ของทุนทุกปีปีละบาท(การันตี)ครบสัญญารับ801%"
  + "โบนัสดัชนีก้อนแรกสิ้นปีที่ไม่การันตี·ดัชนีขึ้นมากได้มากดัชนีติดลบได้0โบนัสก้อนใหญ่ตอนครบสัญญา"
  + "การันตีเท่ากันทุกกรณีส่วนสีฟ้าบนแท่ง=โบนัสดัชนี 0123456789,";

export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (../canonical.ts)
  const moved = toCanonical(req, GSAVING_CARD_KEYS);
  if (moved) return moved;
  const asked = quoteFrom(req.nextUrl.searchParams);
  if (!asked) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  const { age, q } = asked;
  /** the customer's name the send panel added, before the age */
  const name = cleanCustomerName(req.nextUrl.searchParams.get(NAME_KEY));
  const named = name ? addressedAs(name) : undefined;

  const [regular, semibold, serif, pen] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
    // the pen notes' handwriting; without it they are written in Plex
    googleFontSubset("Sriracha", PEN_LETTERS, "400"),
  ]);
  const face = pen ? "Sriracha" : "Plex";

  const rows = q.scenarios[0].rows;
  const figures: [string, string, string, boolean][] = [
    ["เงินการันตีรวม (เงินคืน + ครบสัญญา)", `${baht(q.guaranteed)} บาท`, `จากเบี้ยรวม ${baht(GS_PREM_YEARS * q.premium)} บาท · ได้แน่นอน`, true],
    ["ทุนประกัน", baht(q.sa), "บาท", false],
    [`เบี้ยต่อปี × ${GS_PREM_YEARS} ปี`, premiumText(q.premium), `ลดหย่อนภาษีได้ ${baht(Math.min(q.premium, GS_TAX_CAP))} บาท/ปี`, false],
    ["คุ้มครองชีวิต", baht(rows[0].death), `ปีแรก → สูงสุด ${baht(rows[GS_PREM_YEARS - 1].death)}`, false],
  ];
  const height = PAD * 2 + HEAD_H + GAP + BARS_H + GAP + OVERVIEW_H + GAP + yearlyH(q) + GAP + INDEX_H + GAP + LEGAL_H + FOOT_H;

  return pngResponse(
    (
      <div style={col({ width: "100%", height: "100%", padding: PAD, background: "#fff", fontFamily: "Plex", color: K.ink })}>
        <div style={col({ height: HEAD_H })}>
          <div style={row({ height: 40, alignItems: "center" })}>
            <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 28, fontWeight: 600, color: K.navy }}>Global Savings Plus 15/8</div>
          </div>
          <div style={{ display: "flex", height: 24, fontSize: 14, color: K.mute }}>
            {`ประกันออมทรัพย์ ผลตอบแทนตามดัชนี (Index Linked) · คุ้มครอง ${GS_TERM} ปี · จ่ายเบี้ย ${GS_PREM_YEARS} ปี · รหัสแบบ ${GS_CODE}`}
          </div>
          <div style={{ display: "flex", height: 34, alignItems: "center", fontSize: 20, fontWeight: 600, color: K.olive }}>
            {named ? `สำหรับ ${named} · อายุ ${age} ปี` : `อายุ ${age} ปี`}
          </div>
          <div style={row({ marginTop: 12, height: 112, padding: 16, background: K.band, borderRadius: 8 })}>
            {figures.map(([label, value, note, main], i) => (
              <div key={label} style={col({ width: main ? 340 : 230, marginLeft: i ? 24 : 0 })}>
                <div style={{ display: "flex", fontSize: 14, color: K.mute }}>{label}</div>
                <div style={row({ marginTop: 2 })}>
                  <div style={{
                    display: "flex", fontSize: main ? 28 : 21, fontWeight: 600, color: main ? K.ink : K.navy,
                    ...(main ? { background: `linear-gradient(transparent 45%, ${K.highlighter} 45%)`, padding: "0 4px" } : {}),
                  }}>{value}</div>
                </div>
                <div style={{ display: "flex", fontSize: 12, color: K.mute, marginTop: 2 }}>{note}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", height: GAP }} />
        <Bars q={q} face={face} />
        <div style={{ display: "flex", height: GAP }} />
        <Overview q={q} />
        <div style={{ display: "flex", height: GAP }} />
        <Yearly q={q} age={age} face={face} />
        <div style={{ display: "flex", height: GAP, borderBottom: `1px solid ${K.hair}`, marginBottom: GAP / 2 }} />
        <Index />

        <div style={col({ marginTop: GAP, height: LEGAL_H, fontSize: 12, color: K.mute, lineHeight: 1.6 })}>
          {LEGAL.map((l) => <div key={l} style={{ display: "flex" }}>{`• ${l}`}</div>)}
        </div>
        <div style={row({ height: FOOT_H, justifyContent: "center", alignItems: "flex-end", fontSize: 15, color: K.mute, letterSpacing: 0.4 })}>
          {`Application by ${SITE_ADDRESS}`}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: height + GAP / 2,
      scale: SCALE,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        { name: "Plex", data: semibold, weight: 700, style: "normal" },
        { name: "Trirong", data: serif, weight: 600, style: "normal" },
        ...(pen ?? []),
      ],
      headers: { "cache-control": named ? NAMED_CACHE : "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
