import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { pngResponse } from "@/lib/draw-png";
import { insuredFace } from "../insured-face";
import { cardPaletteFor, BLUE_PEN } from "@/lib/card-theme";
import { highlighterUri, loopUri } from "@/lib/highlighter";
import { PENSION_TABLE_KEYS, toCanonical } from "../canonical";
import { RING_PAD, figureWidth, penSvgUri } from "../table/pen-notes";
import { googleFontSubset } from "@/lib/google-font";
import { SiteFooter, SITE_FOOTER_H } from "../site-footer";
import { PENSION_AGES, quotePension, type PensionAge, type PensionPay } from "@/calc/pension/engine";
import {
  PENSION_COLUMNS, PENSION_PEN_TEXT, pensionCells, pensionMarks, pensionPenNotes, pensionFigure,
} from "@/lib/pension-pen-notes";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/**
 * บำนาญ สมาร์ท 95's yearly table as a picture, for the chat to send after its price (owner,
 * 2026-10-11): the /bumnan95 page's table with the same pen notes, drawn the way the other
 * plans' value-table pictures are (../table/route.tsx) — navy column names, the face and who it
 * is for at the top, the unitclub line at the foot.
 *
 * The table runs from the insured's age to 95, forty to seventy rows, so it is drawn at the
 * value table's full width with one column of years, as that picture draws a long contract.
 */

const WIDTH = 1600;
const PAD = 52;
const TABLE_W = WIDTH - PAD * 2;
/** Air either side of a figure, as on the value table. */
const CELL_PAD = 11;

/**
 * The columns, in PENSION_COLUMNS' order. The premium column is wide enough for the
 * เบี้ยคงที่ brace and its word beside the figures, the pension column for the guarantee's
 * brace clear of its rings; the cover takes what is left.
 */
const WIDTHS = [90, 90, 230, 200, 200, 210, 230];
const COLS = [...WIDTHS, TABLE_W - WIDTHS.reduce((s, w) => s + w, 0)];

/** Every band, in pixels: the drawing library lays a fixed canvas out in one pass. */
const H = {
  plan: 42,
  insured: 40,
  premium: 46,
  gap: 30,
  hairline: 1,
  afterHairline: 22,
  caption: 40,
  head: 50,
  row: 36,
  closingGap: 34,
  closing: 42,
};

const CAPTION = "บำนาญทุกปี ตั้งแต่ปีแรกจนอายุ 95";
/** the pen notes' handwriting, as on the value table */
const PEN_FACE = "Sriracha";

const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;

/** The contract the address names, or undefined when it names none. */
function quoteFrom(params: URLSearchParams) {
  const age = Number(params.get("age"));
  const sex = params.get("sex") as "M" | "F" | null;
  const start = Number(params.get("start"));
  const pay = params.get("pay");
  const sum = Number(params.get("sum"));
  if (!Number.isInteger(age) || !Number.isInteger(sum) || (sex !== "M" && sex !== "F")) return undefined;
  if (!PENSION_AGES.includes(start as PensionAge) || (pay !== "6" && pay !== "untilAnnuity")) return undefined;
  const r = quotePension({
    age, sex, annuityAge: start, pay: pay as PensionPay, mode: "annual", basis: "sumAssured", amount: sum,
  });
  return r.ok ? { age, sex, pay, quote: r.quote } : undefined;
}

export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (../canonical.ts)
  const moved = toCanonical(req, PENSION_TABLE_KEYS);
  if (moved) return moved;
  const asked = quoteFrom(req.nextUrl.searchParams);
  if (!asked) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  const { age, sex, pay, quote: q } = asked;
  const rows = q.illustration;
  const p = cardPaletteFor();

  const [regular, semibold, pen] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    // a handwriting face for the pen notes; without it they are written in Plex
    googleFontSubset(PEN_FACE, PENSION_PEN_TEXT, "400"),
  ]);

  const marks = pensionMarks(rows);
  // the same notes as the page's, aimed by this table's own geometry; the ring stands RING_PAD
  // out beside a figure that does not move, so half of it is passed as the ring's reach
  const notes = pensionPenNotes(rows, q.sumAssured, {
    widths: COLS, caption: H.caption, head: H.head, row: H.row, cellPad: CELL_PAD,
    // Plex's figures at 22px run a little wider than the value table's estimate
    measure: (f) => figureWidth(f) * 1.07,
  }, RING_PAD / 2);
  const ringed = (n: number, c: string) => notes.rings.some((g) => g.row === n && g.column === c);
  const tableHeight = H.caption + H.head + rows.length * H.row;

  const start = q.plan.annuityStartAge;
  const planLine = `บำนาญ สมาร์ท 95 · รับบำนาญอายุ ${start}–95`;
  const payLine = pay === "6" ? "ชำระเบี้ย 6 ปี" : `ชำระเบี้ยจนถึงอายุ ${start} (${q.payYears} ปี)`;
  const insuredLine = `ทุน ${pensionFigure(q.sumAssured)} บาท · ${payLine}`;
  const who = `${sex === "F" ? "หญิง" : "ชาย"} ${age} ปี`;
  const premiumLine = `เบี้ยปีละ ${pensionFigure(q.annualPremium)} บาท · บำนาญเดือนละ ${pensionFigure(q.monthlyPension)} บาท`;
  const closing = `รวมรับบำนาญถึงอายุ 95 ประมาณ ${pensionFigure(q.totalPension)} บาท จากเบี้ยรวม ${pensionFigure(q.totalPremium)} บาท`;

  const height = PAD * 2 + H.plan + H.insured + H.premium + H.gap + H.hairline + H.afterHairline
    + tableHeight + H.closingGap + H.closing + SITE_FOOTER_H;

  return pngResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: PAD,
          background: p.ground, fontFamily: "Plex", color: p.ink,
        }}
      >
        <div style={{ display: "flex", height: H.plan + H.insured, flexShrink: 0, width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>{planLine}</div>
            <div style={{ ...band(H.insured), fontSize: 25, color: p.ink }}>{insuredLine}</div>
          </div>
          <div style={{ display: "flex", flexShrink: 0, marginLeft: 24, alignItems: "center", gap: 14, fontSize: 42, fontWeight: 600, lineHeight: 1, color: p.figure }}>
            {insuredFace(sex, 64)}
            {who}
          </div>
        </div>
        <div style={{ ...band(H.premium), fontWeight: 600, fontSize: 30, color: p.figure }}>{premiumLine}</div>

        <div style={band(H.gap)} />
        <div style={{ ...band(H.hairline), background: p.hair }} />
        <div style={band(H.afterHairline)} />

        <div style={{ display: "flex", flexDirection: "column", position: "relative", width: TABLE_W, height: tableHeight, flexShrink: 0 }}>
          <div style={{ ...band(H.caption), fontSize: 25, color: p.accent }}>{CAPTION}</div>
          {/* the column names on a navy bar, white and heavy, as the value table's */}
          <div style={{ ...band(H.head), width: TABLE_W, fontSize: 24, fontWeight: 600, background: p.figure, color: p.ground }}>
            {PENSION_COLUMNS.map((c, i) => (
              <div
                key={c}
                style={{
                  display: "flex", width: COLS[i], height: H.head, alignItems: "center",
                  justifyContent: i < 2 ? "flex-start" : "flex-end", paddingLeft: CELL_PAD, paddingRight: CELL_PAD,
                  ...(i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.35)" } : {}),
                }}
              >
                {c}
              </div>
            ))}
          </div>
          {rows.map((y, n) => {
            const cells = pensionCells(y);
            return (
              <div key={y.age} style={{ ...band(H.row), width: TABLE_W, fontSize: 22, ...(n % 2 ? { background: p.stripe } : {}) }}>
                {PENSION_COLUMNS.map((c, i) => (
                  <div
                    key={c}
                    style={{
                      display: "flex", width: COLS[i], height: H.row, alignItems: "center",
                      justifyContent: i < 2 ? "flex-start" : "flex-end", paddingLeft: CELL_PAD, paddingRight: CELL_PAD,
                      ...(i > 0 ? { borderLeft: `1px solid ${p.rule}` } : {}),
                      // the pension received goes green once it is more than was paid in
                      color: c === "บำนาญสะสม" && marks.breakEven >= 0 && n > marks.breakEven ? p.gain : p.ink,
                    }}
                  >
                    {ringed(n, c) ? (
                      // pulled back by its own padding, so the ringed figure stays in line with the column
                      <div style={{ display: "flex", position: "relative", padding: `5px ${RING_PAD}px`, marginRight: -RING_PAD }}>
                        <div
                          style={{
                            position: "absolute", top: -4, bottom: -4, left: 0, right: 0,
                            backgroundImage: loopUri(p.pen), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
                          }}
                        />
                        {cells[c]}
                      </div>
                    ) : cells[c]}
                  </div>
                ))}
              </div>
            );
          })}

          {/* over the table, as a pen would be */}
          {([[notes.strokes, p.pen], [notes.blueStrokes, BLUE_PEN]] as const).map(([strokes, ink]) => strokes.length > 0 && (
            <div
              key={ink}
              style={{
                position: "absolute", left: 0, top: 0, width: TABLE_W, height: tableHeight,
                backgroundImage: penSvgUri(strokes, TABLE_W, tableHeight, ink),
                backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
              }}
            />
          ))}
          {notes.labels.map((l, i) => (
            <div
              key={`${i}:${l.text}`}
              style={{
                position: "absolute", display: "flex", top: l.top,
                ...(l.left !== undefined ? { left: l.left } : { right: l.right }),
                fontFamily: pen ? PEN_FACE : "Plex", fontSize: l.size, lineHeight: 1.5,
                color: l.mark ? p.figure : l.ink === "blue" ? BLUE_PEN : p.pen,
                transform: `rotate(${l.tilt}deg)`, whiteSpace: "nowrap",
                // the break-even word is run over with the highlighter, as the page's is
                ...(l.mark ? {
                  padding: "0 8px", backgroundImage: highlighterUri(p.highlighter),
                  backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
                } : {}),
              }}
            >
              {l.text}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex", flexShrink: 0, justifyContent: "center", width: TABLE_W, marginTop: H.closingGap,
            height: H.closing, fontSize: 28, lineHeight: `${H.closing}px`, color: p.accent,
          }}
        >
          {closing}
        </div>
        <SiteFooter color={p.mute} />
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        ...(pen ?? []),
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
