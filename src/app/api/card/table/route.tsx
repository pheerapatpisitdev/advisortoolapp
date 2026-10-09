import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardInputFrom, valueTableCard, valueTableChart, type CardChart, type ValueTableCard, type ValueTableRow } from "@/lib/quote-card";
import { cardPaletteFor, type CardPalette } from "@/lib/card-theme";
import { highlighterUri, loopUri } from "@/lib/highlighter";
import { QUOTE_CARD_KEYS, toCanonical } from "../canonical";
import { Chart, chartBlockHeight } from "../chart-drawing";
import { quoteFor } from "@/lib/life-quotes";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** Six columns twice over; 1400 left the seven-figure ones touching their rules. */
const WIDTH = 1600;
/**
 * And wider again for the plans that hand money back, which need a seventh column. The extra
 * room is spent on the column rather than taken from the others: this is an image, where
 * width costs nothing, and squeezing "1,662,000" into a narrower cell costs legibility.
 */
const WIDTH_WITH_PAYOUT = 1900;
const PAD = 52;
/** the space between the two halves the years are dealt into */
const GUTTER = 48;
const halfOf = (width: number) => (width - PAD * 2 - GUTTER) / 2;
const HALF = halfOf(WIDTH);

/**
 * How many years a table can hold before it is dealt into two halves.
 *
 * Every table is one column now. The halving was for the sixty-row contracts, which in a
 * narrow canvas make a picture three times taller than it is wide — but the answer to that is
 * the canvas, not the gutter: a long table is drawn at the full width instead, with every
 * column widened to fill it, so the figures are as large as they were when there were two of
 * them side by side. What the reader no longer does is cross a gutter to find year four.
 *
 * Short tables keep the narrow canvas, because stretching five rows across sixteen hundred
 * pixels is mostly rule and air.
 */
const SINGLE_MAX = 16;
const isShort = (card: ValueTableCard) => card.rows.length <= SINGLE_MAX;

/**
 * Every band of the card, in pixels. As on the quote card, the drawing library lays a fixed
 * canvas out in one pass and will squeeze one line on top of another rather than grow the
 * page, so each band is given a height here and the canvas is the sum of the bands.
 */
const H = {
  plan: 42,
  insured: 40,
  premium: 46,
  gap: 30,
  hairline: 1,
  afterHairline: 22,
  caption: 40,
  head: 44,
  row: 36,
  /** the closing line: the room above it, and each line of it */
  quoteGap: 34,
  quoteLine: 42,
};

/** The closing line's size, and how many characters of it a line holds before it wraps. */
const QUOTE_SIZE = 28;
const quoteLines = (text: string, width: number) => Math.ceil(text.length / Math.floor(width / (QUOTE_SIZE * 0.6)));

const CAPTION = "มูลค่าทุกปี ตั้งแต่ปีแรกจนครบสัญญา";
/** A plan with no surrender column is not showing a value, it is showing a term. */
const COVER_CAPTION = "ความคุ้มครองทุกปี ตั้งแต่ปีแรกจนครบสัญญา";

/**
 * The five columns, and how each sits in its own half.
 *
 * The year and the age read as labels and sit left; the three amounts are read against each
 * other down the column, so they sit right.
 */
const COLS = [
  { w: 60, align: "flex-start" as const },
  { w: 60, align: "flex-start" as const },
  { w: 136, align: "flex-end" as const },
  { w: 152, align: "flex-end" as const },
  { w: 152, align: "flex-end" as const },
  { w: HALF - 60 - 60 - 136 - 152 - 152, align: "flex-end" as const },
];

/**
 * And the layout for a plan with no surrender column, which is one narrower.
 *
 * The room the missing column frees goes to the two money columns rather than to the margin:
 * a five-column table stretched across the same canvas would be mostly rule and air.
 */
const COVER_COLS = [
  { w: 66, align: "flex-start" as const },
  { w: 66, align: "flex-start" as const },
  { w: 176, align: "flex-end" as const },
  { w: 200, align: "flex-end" as const },
  { w: HALF - 66 - 66 - 176 - 200, align: "flex-end" as const },
];

/** The same layout with the payout column, in the wider canvas that makes room for it. */
const PAYOUT_HALF = halfOf(WIDTH_WITH_PAYOUT);
const PAYOUT_COLS = [
  { w: 60, align: "flex-start" as const },
  { w: 60, align: "flex-start" as const },
  { w: 150, align: "flex-end" as const },
  { w: 168, align: "flex-end" as const },
  { w: 150, align: "flex-end" as const },
  { w: 168, align: "flex-end" as const },
  { w: PAYOUT_HALF - 60 - 60 - 150 - 168 - 150 - 168, align: "flex-end" as const },
];

/** Which layout a card is drawn in, decided by the columns it carries. */
function layoutFor(card: ValueTableCard) {
  if (card.columns.length > 6) return { cols: PAYOUT_COLS, half: PAYOUT_HALF, width: WIDTH_WITH_PAYOUT };
  if (card.columns.length < 6) return { cols: COVER_COLS, half: HALF, width: WIDTH };
  return { cols: COLS, half: HALF, width: WIDTH };
}

/** Air either side of a figure, so no column ever touches the rule beside it. */
const CELL_PAD = 11;

/**
 * One cell of the table, ruled off from the one before it.
 *
 * The rule is drawn by the cell rather than by a line of its own so that it runs the whole
 * height of the row: a border on a box that is only as tall as its text leaves a dashed
 * ladder down the table instead of a column.
 */
function Cell(
  { i, cols, height, color, rule, mark, highlighter, pen, children }:
  {
    i: number; cols: typeof COLS; height: number; color: string; rule: string; children: string;
    /** drawn with the quote card's highlighter stroke behind the figure */
    mark?: boolean; highlighter?: string;
    /** a loop in this colour drawn round the figure, as with a pen */
    pen?: string;
  },
) {
  const figure = mark && highlighter ? (
    <div
      style={{
        display: "flex", padding: "1px 8px",
        backgroundImage: highlighterUri(highlighter), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </div>
  ) : children;
  return (
    <div
      style={{
        display: "flex",
        width: cols[i].w,
        height,
        alignItems: "center",
        justifyContent: cols[i].align,
        paddingLeft: CELL_PAD,
        paddingRight: CELL_PAD,
        ...(i > 0 ? { borderLeft: `1px solid ${rule}` } : {}),
        color,
      }}
    >
      {pen ? (
        <div style={{ display: "flex", position: "relative", padding: "5px 12px" }}>
          <div
            style={{
              position: "absolute", top: -4, bottom: -4, left: 0, right: 0,
              backgroundImage: loopUri(pen), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
            }}
          />
          {figure}
        </div>
      ) : figure}
    </div>
  );
}

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** The years, under one row of column names. */
function Half(
  { columns, rows, p, cols, half }:
  { columns: string[]; rows: ValueTableRow[]; p: CardPalette; cols: typeof COLS; half: number },
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: half, flexShrink: 0 }}>
      <div style={{ ...band(H.head), width: half, fontSize: 21, borderBottom: `1px solid ${p.hair}` }}>
        {columns.map((c, i) => (
          <Cell key={c} i={i} cols={cols} height={H.head - 1} color={p.ink} rule={p.rule}>{c}</Cell>
        ))}
      </div>
      {rows.map((r, n) => {
        // the break-even year is marked by the highlighter on its cells, not by a tinted row —
        // the owner asked for the old tint to go, so the stripe runs through it like any year
        const ground = n % 2 ? p.stripe : undefined;
        /**
         * One ink for the whole table.
         *
         * The opening years used to recede, and the year and age columns were grey the way a
         * label is. On a phone, zoomed in, that reads as text that has been switched off —
         * the owner's word for it was "why is it grey". The years worth nothing say so in
         * their own column, with a nought and a note underneath; they do not also need to be
         * hard to read.
         */
        const ink = p.ink;
        /**
         * Built from the columns the row actually carries, so the three shapes of this table
         * — with a payout, with a surrender value, with neither — all draw from one path.
         */
        const cells = [
          String(r.year), String(r.age), r.due,
          ...(r.rider === undefined ? [] : [r.rider]),
          // as the page does: where the running total has stopped, the break-even row says what it is
          r.paid ?? (r.breakEven ? "จุดคุ้มทุน >" : "—"),
          ...(r.payout === undefined ? [] : [r.payout]),
          ...(r.cash === undefined ? [] : [r.cash]),
          r.cover,
        ];
        return (
          <div
            key={r.year}
            style={{ ...band(H.row), width: half, fontSize: 22, ...(ground ? { background: ground } : {}) }}
          >
            {cells.map((cell, i) => (
              <Cell
                key={columns[i]} i={i} cols={cols} height={H.row} rule={p.rule}
                // the surrender figure goes green once the policy is worth more than was paid in
                color={r.pastBreakEven && columns[i] === "เวนคืนได้" ? p.gain : ink}
                // the break-even year: the age it happens at and the surrender value that gets there
                mark={r.breakEven && (columns[i] === "อายุ" || columns[i] === "เวนคืนได้" || (columns[i] === "เบี้ยสะสม" && r.paid === null))}
                highlighter={p.highlighter}
                // and the surrender value is ringed in red pen
                pen={r.breakEven && columns[i] === "เวนคืนได้" ? p.pen : undefined}
              >
                {cell}
              </Cell>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function heightOf(card: ValueTableCard, chart: CardChart | undefined, quote: string, width: number): number {
  const perHalf = card.rows.length;
  return PAD * 2
    + (chart ? chartBlockHeight(chart) : 0)
    + H.plan + H.insured + H.premium
    + H.gap + H.hairline + H.afterHairline
    + H.caption + H.head + perHalf * H.row
    + H.quoteGap + quoteLines(quote, width - PAD * 2) * H.quoteLine;
}

/**
 * The three faces, read off disk beside the quote card's own route — see the note there for
 * why they cannot simply be imported.
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

/**
 * The contract year by year, drawn as an image.
 *
 * The quote card answers what it costs; this one answers what it is worth, every year, to
 * the end — the table the sales page shows, in a form a chat can hand over and a customer
 * can show whoever else in the house has to agree to it.
 *
 * The years run down one column, however many there are; a long contract is given the wider
 * canvas so that column can carry its figures at full size — see SINGLE_MAX.
 */
export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, QUOTE_CARD_KEYS);
  if (moved) return moved;
  const input = cardInputFrom(req.nextUrl.searchParams);
  const card = input?.kind === "plan" ? valueTableCard(input) : undefined;
  if (!input || !card) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  /** the theme the plan is sold under, so the sheet matches the page it was quoted from */
  const p = cardPaletteFor();

  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);

  const { cols: narrow, half, width: wide } = layoutFor(card);
  /**
   * The canvas, and the column widths that fill it.
   *
   * A short table is drawn in the half it was already sized for, on a canvas trimmed to it. A
   * long one keeps the full width and spends it on the columns rather than on a second half:
   * the same figures, at the same size, in one file.
   */
  const short = isShort(card);
  const width = short ? half + PAD * 2 : wide;
  const stretch = (width - PAD * 2) / half;
  const cols = short ? narrow : narrow.map((c) => ({ ...c, w: Math.floor(c.w * stretch) }));
  // the drawing as wide as the table it is read with
  // the characters are asked for by the link, which only a chat's table carries
  const characters = req.nextUrl.searchParams.get("fig") === "1";
  const chart = input.kind === "plan" ? valueTableChart(input, width - PAD * 2, undefined, { characters }) : undefined;
  /** one line to close on, chosen by the arrangement so the same table is always the same picture */
  const quote = quoteFor(
    ["plan", "variant", "age", "sex", "sum", "rider", "payer", "meb"].map((k) => req.nextUrl.searchParams.get(k) ?? "").join("|"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: `linear-gradient(160deg, ${p.ground} 0%, ${p.groundDeep} 82%)`,
          fontFamily: "Plex",
          color: p.ink,
        }}
      >
        {/* The insured opposite the plan, at a size a glance answers — see the card route. */}
        <div
          style={{
            display: "flex", height: H.plan + H.insured, flexShrink: 0,
            width: "100%", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>{card.planLine}</div>
            <div style={{ ...band(H.insured), fontSize: 25, color: p.ink }}>{card.insuredLine}</div>
          </div>
          <div
            style={{
              display: "flex", flexShrink: 0, marginLeft: 24,
              fontSize: 42, fontWeight: 600, lineHeight: 1, color: p.figure,
            }}
          >
            {card.insuredWho}
          </div>
        </div>
        <div style={{ ...band(H.premium), fontFamily: "Trirong", fontSize: 30, color: p.figure }}>
          {card.premiumLine}
        </div>

        {chart && <Chart chart={chart} p={p} />}

        <div style={spacer(H.gap)} />
        <div style={spacer(H.hairline, p.hair)} />
        <div style={spacer(H.afterHairline)} />
        <div style={{ ...band(H.caption), fontSize: 25, color: p.accent }}>
          {card.columns.includes("เวนคืนได้") ? CAPTION : COVER_CAPTION}
        </div>

        <div style={{ display: "flex", width: width - PAD * 2, flexShrink: 0 }}>
          <Half columns={card.columns} rows={card.rows} p={p} cols={cols} half={width - PAD * 2} />
        </div>

        <div
          style={{
            display: "flex", flexShrink: 0, justifyContent: "center", textAlign: "center",
            width: width - PAD * 2, marginTop: H.quoteGap, fontSize: QUOTE_SIZE, lineHeight: `${H.quoteLine}px`,
            color: p.accent,
          }}
        >
          {quote}
        </div>

      </div>
    ),
    {
      width,
      height: heightOf(card, chart, quote, width),
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        { name: "Trirong", data: display, weight: 600, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
