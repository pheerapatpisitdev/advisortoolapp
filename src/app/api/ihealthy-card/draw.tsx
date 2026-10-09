import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CardCell, CardColumn, CardTableRow } from "@/lib/ihealthy-card";
import { CARD_PALETTE } from "@/lib/card-theme";
import { highlighterUri } from "@/lib/highlighter";
import { googleFontSubset } from "@/lib/google-font";
import type { Lang } from "@/lib/ihealthy-lang";
import { WORDS, type IHealthyWords } from "@/lib/ihealthy-words";

/**
 * The ink both health pictures are drawn with: the palette, the bands, and the three
 * primitives that put a table on a fixed canvas.
 *
 * It is a module rather than a second copy because the quote card and the comparison table
 * are the same table under two different headings — and a palette that drifted between them
 * would have the agency send two pictures that do not look like each other.
 */

/**
 * The sales page's palette, so a card dropped into a chat is recognisably the same agency —
 * and, since /ihealthy-ultra was re-themed, recognisably the same page. Taken from the shared
 * registry rather than written out here: this route draws one plan under one theme, so it
 * needs no picking, but the colours still belong beside the other three.
 *
 * GOLD and GOLD_LIT are historical names: the palette they read is navy and olive now, and
 * the registry calls the same two slots `accent` and `figure`. They are left alone because
 * they are the drawing code's vocabulary below and renaming them would change no pixel.
 */
export const GROUND = CARD_PALETTE.ground;
export const GROUND_DEEP = CARD_PALETTE.groundDeep;
export const GOLD = CARD_PALETTE.accent;
export const GOLD_LIT = CARD_PALETTE.figure;
export const WHITE = CARD_PALETTE.ink;
export const MUTE = CARD_PALETTE.mute;
export const RULE = CARD_PALETTE.rule;
export const GRID = CARD_PALETTE.grid;
/** the chosen plan's column, laid over the ground rather than instead of it */
export const TINT = CARD_PALETTE.tint;

/**
 * The canvas, and the table drawn on it.
 *
 * Six plans of Thai and a column of row titles decide the width, not the other way round:
 * "ตามที่จ่ายจริง" is the longest thing any cell says, and a column too narrow for it would
 * have the drawing library wrap it onto a second line inside a row whose height is already
 * fixed — which is how a table quietly loses a word.
 */
export const PAD = 45;
export const TITLE_W = 330;
export const COL_W = 170;

/** How wide the title column and each plan column are drawn. */
export interface Geometry { title: number; col: number }

/**
 * Wider columns for the two readings whose words run longest.
 *
 * "По фактическим расходам" is the Russian for ตามที่จ่ายจริง, and Burmese writes the same
 * thing as one unbroken run with no space to wrap at. In a Thai-width column the one breaks
 * into three lines on a one-line row, and the other runs across its neighbours.
 */
export function geometryOf(lang: Lang): Geometry {
  if (lang === "ru") return { title: 390, col: 280 };
  if (lang === "my") return { title: 440, col: 305 };
  return { title: TITLE_W, col: COL_W };
}

/**
 * Every band of the card, in pixels.
 *
 * The drawing library lays a fixed canvas out in one pass and will squeeze one line on top of
 * another rather than grow the page. So each band is given a height here, every element is
 * told not to shrink, and the canvas is the sum of the bands — layout and canvas can then
 * never disagree, because they are the same numbers.
 */
export const H = {
  plan: 46,
  insured: 42,
  premium: 126,
  noPrice: 60,
  line: 40,
  warn: 36,
  /** one band of what the family receives, set apart from what the customer pays */
  death: 40,
  /** the space above the first of them */
  beforeDeath: 18,
  /** the space above a divided section */
  gap: 30,
  hairline: 1,
  afterHairline: 22,
  head: 62,
  row: 54,
  /** the strip that says everything below it is price and not cover */
  section: 44,
};

/** A band that keeps its height whatever else is on the card. */
export const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
export const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** One of the card's own figures: what it is on the left, what it costs on the right. */
export function Line({ label }: { label: string }) {
  return (
    <div style={{ ...band(H.line), alignItems: "baseline" }}>
      <div style={{ display: "flex", fontSize: 25, color: MUTE }}>{label}</div>
    </div>
  );
}

/**
 * A cell of the table.
 *
 * Sized rather than spaced: the width is the column's and the height is the row's, and the
 * text is centred inside it. A cell that could grow would move every column to its right.
 */
export function Cell(
  { children, width, height, tint, dim, mark, align = "center", weight = 400, size = 20, color = MUTE }: {
    children: string; width: number; height: number;
    tint?: boolean; dim?: boolean; mark?: boolean; align?: "center" | "flex-start";
    weight?: number; size?: number; color?: string;
  },
) {
  return (
    <div
      style={{
        display: "flex", width, minWidth: width, maxWidth: width, height,
        boxSizing: "border-box", flexShrink: 0,
        alignItems: "center", justifyContent: align,
        padding: align === "center" ? "0 8px" : "0 12px",
        borderRight: `1px solid ${GRID}`,
        background: tint ? TINT : "transparent",
        fontSize: size, fontWeight: weight, color,
        // Faded, not illegible. The screen table refuses to fade this text for the same
        // reason: the ceiling row carries real figures in a column the age cannot buy, and
        // 0.6 took them under 4:1 on this ground — in an image a reader cannot zoom out of.
        ...(dim ? { opacity: 0.85 } : {}),
      }}
    >
      {mark ? (
        // the same pen stroke the quote card uses, behind the one figure this card is about
        <div
          style={{
            display: "flex", padding: "2px 10px",
            backgroundImage: highlighterUri(CARD_PALETTE.highlighter),
            backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          }}
        >
          {children}
        </div>
      ) : children}
    </div>
  );
}

/** One line of the table: a title, then a figure under each plan. */
export function Row(
  { label, cells, selected, mark, height = H.row, weight = 400, color = MUTE, geo = geometryOf("th") }: {
    label: string; cells: CardCell[]; selected: number; height?: number; geo?: Geometry;
    weight?: number; color?: string;
    /** highlight the selected plan's figure on this row */
    mark?: boolean;
  },
) {
  return (
    <div style={{ display: "flex", height, flexShrink: 0, borderTop: `1px solid ${GRID}` }}>
      <Cell width={geo.title} height={height} align="flex-start" size={21} color={WHITE} weight={500} mark={mark}>
        {label}
      </Cell>
      {cells.map((c, i) => (
        <Cell
          key={i} width={geo.col} height={height} tint={i === selected} dim={c.dim}
          weight={weight} color={i === selected ? GOLD_LIT : color} mark={mark && i === selected}
        >
          {c.text}
        </Cell>
      ))}
    </div>
  );
}

/**
 * Where the font files are, and why they are listed in next.config.ts.
 *
 * The same two faces the other card draws with, read from where that route keeps them rather
 * than copied: Thai needs a font that has Thai in it — with none, every letter would be a
 * box. Both are under the SIL Open Font License (see LICENSE.md beside them).
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

/**
 * How wide a canvas with this many plan columns has to be.
 *
 * It was a constant for six. A phone gets three, and a canvas still sized for six would
 * print them against half a page of empty ground — which in a chat is a picture the reader
 * has to pinch to read the small half of.
 */
export function widthOf(columns: number, geo: Geometry = geometryOf("th")): number {
  return PAD * 2 + geo.title + geo.col * columns;
}

/** The three faces, loaded once per request, in the shape `ImageResponse` wants them. */
export async function loadFonts() {
  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);
  return [
    { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Plex", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Trirong", data: display, weight: 600 as const, style: "normal" as const },
  ];
}

/**
 * The Google Fonts face each language needs beyond Thai and Latin, which the Plex face has.
 *
 * Fetched per picture and cut down to the letters on it, the way Vercel's own examples load
 * a face: a Chinese face whole is ten megabytes a weight, and a card uses a hundred of them.
 * The drawing library falls back from Plex to these letter by letter, so digits and plan names
 * keep the card's own face. All three are under the SIL Open Font License.
 */
const SCRIPT_FAMILY: Partial<Record<Lang, string>> = {
  zh: "Noto Sans SC",
  ru: "Noto Sans",
  my: "Noto Sans Myanmar",
};

/**
 * The faces `lang` needs on top of `loadFonts`, or undefined where they could not be had.
 * Thai and English need none, and get an empty list without asking anyone.
 */
export async function scriptFonts(lang: Lang, text: string) {
  const family = SCRIPT_FAMILY[lang];
  if (family === undefined) return [];
  return googleFontSubset(family, text);
}

/** One day at the edge, an hour in a browser — the same as every other card here. */
export const CARD_HEADERS = {
  "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};


/**
 * The plans side by side: a header row, the cover rows, then what each plan costs.
 *
 * One component rather than the same fifty lines in two routes. The quote card lights the
 * column it is pricing and the comparison table lights none — `selected` of -1 — and that is
 * the whole of the difference between them, so it is the whole of what is passed in.
 */
export function PlanTable(
  { card, selected, markLabel, w = WORDS.th, geo = geometryOf("th") }: {
    card: { columns: CardColumn[]; rows: CardTableRow[]; premiumRows: { label: string; cells: CardCell[] }[] };
    selected: number;
    /** the row whose selected figure gets the highlighter; the quote card marks the yearly ceiling */
    markLabel?: string;
    /** the page's words in the language the picture is drawn in */
    w?: IHealthyWords;
    geo?: Geometry;
  },
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", height: H.head, flexShrink: 0 }}>
        <Cell width={geo.title} height={H.head} align="flex-start" size={21} color={MUTE} weight={500}>
          {w.benefitColumn}
        </Cell>
        {card.columns.map((c, i) => (
          <div
            key={c.name}
            style={{
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              width: geo.col, minWidth: geo.col, maxWidth: geo.col, height: H.head,
              boxSizing: "border-box", flexShrink: 0, padding: "0 8px",
              borderRight: `1px solid ${GRID}`,
              background: i === selected ? TINT : "transparent",
            }}
          >
            <div style={{ display: "flex", fontSize: 23, fontWeight: 600, color: i === selected ? GOLD_LIT : MUTE }}>
              {c.name}
            </div>
            {!c.sold && (
              <div style={{ display: "flex", fontSize: 15, color: MUTE, marginTop: 2 }}>{w.notSold}</div>
            )}
          </div>
        ))}
      </div>

      {card.rows.map((r) =>
        r.span === undefined ? (
          <Row key={r.label} label={r.label} cells={r.cells} selected={selected} mark={r.label === markLabel} geo={geo} />
        ) : (
          // One answer across every plan, because it is the same cover whichever is bought
          <div key={r.label} style={{ display: "flex", height: H.row, flexShrink: 0, borderTop: `1px solid ${GRID}` }}>
            <Cell width={geo.title} height={H.row} align="flex-start" size={21} color={WHITE} weight={500}>
              {r.label}
            </Cell>
            <Cell width={geo.col * card.columns.length} height={H.row} size={20} color={WHITE}>{r.span}</Cell>
          </div>
        ),
      )}

      {card.premiumRows.length > 0 && (
        <div
          style={{
            display: "flex", height: H.section, flexShrink: 0, alignItems: "center",
            paddingLeft: 12, borderTop: `1px solid ${GRID}`, background: GROUND_DEEP,
            fontSize: 21, fontWeight: 600, color: GOLD,
          }}
        >
          {w.premiumHeading}
        </div>
      )}
      {card.premiumRows.map((r) => (
        // the chosen plan's price in each instalment, marked as every quote card marks its price lines
        <Row key={r.label} label={r.label} cells={r.cells} selected={selected} weight={600} color={WHITE} mark={markLabel !== undefined} geo={geo} />
      ))}
      {/* the table's own bottom edge; every row above draws only its top */}
      <div style={spacer(H.hairline, GRID)} />
    </div>
  );
}
