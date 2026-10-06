import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { highlighterUri } from "@/lib/highlighter";
import type { NextRequest } from "next/server";
import { cardInputFrom, quoteCard, type CardRow, type CardSummary, type QuoteCard } from "@/lib/quote-card";
import { cardPaletteFor, type CardPalette } from "@/lib/card-theme";
import { QUOTE_CARD_KEYS, toCanonical } from "./canonical";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;


const WIDTH = 1000;
const PAD = 56;

/**
 * Every band of the card, in pixels.
 *
 * The drawing library lays a fixed canvas out in one pass and will squeeze one line on top of
 * another rather than grow the page — the first draft did exactly that. So each band is given
 * a height here, every element is told not to shrink, and the canvas is the sum of the bands.
 * Layout and canvas can then never disagree, because they are the same numbers.
 */
const H = {
  plan: 44,
  insured: 44,
  premium: 132,
  noPrice: 62,
  perDay: 40,
  /**
   * The price block beside the family photo: as tall as the photo, so the box under it never
   * runs into the picture — the page holds its headline to the photo's height the same way.
   */
  head: 248,
  /** the premium box (components/sales/PremiumSummary.tsx), band by band */
  boxGap: 18,
  boxPad: 26,
  boxTitle: 42,
  boxRow: 46,
  boxMain: 64,
  boxAfter: 36,
  splitGap: 14,
  splitTitle: 34,
  splitRow: 40,
  /** a note's line, and the room above the first */
  noteGap: 14,
  noteLine: 32,
  /** the space above a divided section */
  gap: 36,
  hairline: 1,
  afterHairline: 26,
  sectionTitle: 42,
  row: 54,
  listLine: 29,
  listPadding: 10,
};


function sectionHeight(rows: CardRow[] | undefined): number {
  if (!rows?.length) return 0;
  return H.gap + H.hairline + H.afterHairline + H.sectionTitle + rows.length * H.row;
}

/** Thai disease names vary substantially in length, so the card reserves a second line for
 * longer ones rather than allowing ImageResponse to compress adjacent rows. */
function listItemHeight(item: string, index: number): number {
  const charactersPerLine = 43;
  const text = `${index + 1}. ${item}`;
  return Math.ceil(text.length / charactersPerLine) * H.listLine + H.listPadding;
}

function listSectionHeight(items: string[] | undefined): number {
  if (!items?.length) return 0;
  return H.gap + H.hairline + H.afterHairline + H.sectionTitle
    + items.reduce((height, item, index) => height + listItemHeight(item, index), 0);
}


/**
 * Lines a note takes. Thai is counted by code unit, vowel and tone marks included, so the
 * count runs long and a note is given a line it may not need rather than drawn over what
 * follows it.
 */
const NOTE_CHARS_PER_LINE = 58;
const noteLines = (text: string) => Math.ceil(text.length / NOTE_CHARS_PER_LINE);
const notesHeight = (notes: string[]) => notes.reduce((h, n) => h + noteLines(n) * H.noteLine, 0);

function boxHeight(s: CardSummary): number {
  return 2 * H.boxPad + H.boxTitle
    + s.rows.reduce((h, r) => h + (r.main ? H.boxMain : H.boxRow) + (r.after ? H.boxAfter : 0), 0)
    + (s.split ? 2 * H.splitGap + H.hairline + H.splitTitle + s.split.rows.length * H.splitRow : 0);
}

function heightOf(card: QuoteCard): number {
  return PAD * 2
    + H.plan + H.insured
    + (card.premium ? H.head : H.noPrice + (card.perDay ? H.perDay : 0))
    + (card.summary ? H.boxGap + boxHeight(card.summary) : 0)
    + (card.priceNote ? H.noteGap + notesHeight([card.priceNote]) : 0)
    + (card.footNotes?.length ? H.gap + H.hairline + H.noteGap + notesHeight(card.footNotes) : 0)
    + card.sections.reduce((h, s) => h + (s.items?.length ? listSectionHeight(s.items) : sectionHeight(s.rows)), 0);
}

/** A band that keeps its height whatever else is on the card. */
const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/**
 * A price line with a highlighter stroke behind it — every card marks what the premium comes
 * to by the day and in the other instalments. The stroke is stretched
 * to the text with room for the nib either side, and pulled left by that much so the words
 * still start where the lines above and below them do.
 */
function Marked({ p, children, end = false }: { p: CardPalette; children: string; end?: boolean }) {
  return (
    <div
      style={{
        // at the end of a row the stroke reaches past the words on the right instead
        display: "flex", padding: "2px 16px", ...(end ? { marginRight: -16 } : { marginLeft: -16 }), color: p.ink,
        backgroundImage: highlighterUri(p.highlighter), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </div>
  );
}

function Rows({ title, rows, p }: { title: string; rows: CardRow[]; p: CardPalette }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, p.hair)} />
      <div style={spacer(H.afterHairline)} />
      <div style={{ ...band(H.sectionTitle), fontSize: 26, color: p.mute }}>{title}</div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{ ...band(H.row), width: "100%", justifyContent: "space-between", alignItems: "center" }}
        >
          {/* a marked row is marked across: what the figure is for, then the figure */}
          {r.mark
            ? <div style={{ display: "flex", fontSize: 27 }}><Marked p={p}>{r.label}</Marked></div>
            : <div style={{ display: "flex", fontSize: 27, color: p.mute }}>{r.label}</div>}
          <div
            style={{
              display: "flex", fontFamily: "Trirong", fontSize: 34, color: p.ink,
              // the pen stroke is stretched to the figure, with room for the nib either side
              ...(r.mark ? {
                padding: "4px 18px", marginRight: -18,
                backgroundImage: highlighterUri(p.highlighter), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
              } : {}),
            }}
          >
            {r.amount} บาท
          </div>
        </div>
      ))}
    </div>
  );
}

function ListRows({ title, items, p }: { title: string; items: string[]; p: CardPalette }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, p.hair)} />
      <div style={spacer(H.afterHairline)} />
      <div style={{ ...band(H.sectionTitle), fontSize: 26, color: p.mute }}>{title}</div>
      {items.map((item, index) => (
        <div
          key={item}
          style={{
            display: "flex", minHeight: listItemHeight(item, index), flexShrink: 0,
            alignItems: "flex-start", fontSize: 21, lineHeight: 1.35, color: p.mute,
          }}
        >
          <span style={{ display: "flex", width: 42, flexShrink: 0, color: p.accent }}>{index + 1}.</span>
          <span style={{ display: "flex", flex: 1 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The sales pages' "เบี้ยประกันที่ต้องชำระ" box: every instalment the company takes, the one
 * the card headlines set large and the others marked, what paying monthly takes up front under
 * the monthly row, and for a Life Protect with riders what the headline is made of.
 */
function Summary({ s, p }: { s: CardSummary; p: CardPalette }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.boxGap)} />
      <div
        style={{
          display: "flex", flexDirection: "column", flexShrink: 0, height: boxHeight(s),
          padding: `${H.boxPad}px 32px`, borderRadius: 18, background: p.box, color: p.figure,
        }}
      >
        <div style={{ ...band(H.boxTitle), alignItems: "center", fontSize: 26 }}>{s.title}</div>
        {s.rows.map((r) => (
          <div key={r.label} style={{ display: "flex", flexDirection: "column", flexShrink: 0, width: "100%" }}>
            <div
              style={{
                ...band(r.main ? H.boxMain : H.boxRow), width: "100%",
                justifyContent: "space-between", alignItems: "center",
              }}
            >
              {/* two plain children, no fragment: the drawing library spaces a fragment's
                  children as if they were one */}
              {r.main
                ? <div style={{ display: "flex", fontSize: 27, fontWeight: 600 }}>{r.label}</div>
                : <div style={{ display: "flex", fontSize: 26 }}><Marked p={p}>{r.label}</Marked></div>}
              {r.main
                ? <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>{`${r.amount} บาท`}</div>
                : <div style={{ display: "flex", fontSize: 28 }}><Marked p={p} end>{`${r.amount} บาท`}</Marked></div>}
            </div>
            {r.after && (
              <div style={{ ...band(H.boxAfter), justifyContent: "flex-end", alignItems: "center", fontSize: 22 }}>
                <Marked p={p} end>{r.after}</Marked>
              </div>
            )}
          </div>
        ))}
        {s.split && (
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, width: "100%" }}>
            <div style={spacer(H.splitGap)} />
            <div style={spacer(H.hairline, p.rule)} />
            <div style={spacer(H.splitGap)} />
            <div style={{ ...band(H.splitTitle), alignItems: "center", fontSize: 21 }}>{s.split.title}</div>
            {s.split.rows.map((r) => (
              <div
                key={r.label}
                style={{ ...band(H.splitRow), width: "100%", justifyContent: "space-between", alignItems: "center", fontSize: 23 }}
              >
                <div style={{ display: "flex" }}>{r.label}</div>
                <div style={{ display: "flex", flexShrink: 0, marginLeft: 20 }}>{`${r.amount} บาท`}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The page's four-pointed star, which the card's Thai faces do not have a glyph for. */
const STAR = "✦";

/** Sentences set small, each given the lines it was measured for. */
function Notes({ notes, color, size }: { notes: string[]; color: string; size: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {notes.map((n) => {
        const starred = n.startsWith(STAR);
        return (
          <div
            key={n}
            style={{
              display: "flex", height: noteLines(n) * H.noteLine, flexShrink: 0,
              fontSize: size, lineHeight: `${H.noteLine}px`, color,
            }}
          >
            {/* drawn rather than typed: a missing glyph comes out as a box */}
            {starred && (
              <svg width={14} height={H.noteLine} viewBox={`0 0 14 ${H.noteLine}`} style={{ marginRight: 10, flexShrink: 0 }}>
                <path
                  d={`M7 ${H.noteLine / 2 - 7} Q8 ${H.noteLine / 2 - 1} 14 ${H.noteLine / 2} Q8 ${H.noteLine / 2 + 1} 7 ${H.noteLine / 2 + 7} Q6 ${H.noteLine / 2 + 1} 0 ${H.noteLine / 2} Q6 ${H.noteLine / 2 - 1} 7 ${H.noteLine / 2 - 7} Z`}
                  fill={color}
                />
              </svg>
            )}
            <div style={{ display: "flex" }}>{starred ? n.slice(STAR.length).trim() : n}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The three faces, read off disk beside this file.
 *
 * They cannot be imported the way a component imports an image: what the bundler hands back
 * is a public asset path, which the drawing library cannot take and which the development
 * server does not serve to a route handler anyway. They are therefore read as files, and
 * next.config.ts lists them so they travel with the deployed function.
 *
 * Thai needs a font that has Thai in it — with none, every letter on the card would be a box.
 * Both faces are under the SIL Open Font License (see LICENSE.md beside them).
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

/**
 * The family beside the premium, as the data URI the drawing library takes.
 *
 * Read from disk for the same reason as the faces; next.config.ts lists it. Its ground is white,
 * which is the card's own, so it needs no cut-out. A card that cannot find it is drawn without
 * rather than not at all — a missing picture must never cost a customer their quote.
 */
const PHOTO_SIZE = H.head;
async function loadPhoto(): Promise<string | undefined> {
  try {
    const file = await readFile(path.join(process.cwd(), "public/card/family.jpg"));
    return `data:image/jpeg;base64,${file.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * A quote drawn as an image, so LINE can hand a customer the same card the sales page
 * shows — something to keep, and to show whoever else in the house has to agree to it.
 *
 * The arrangement is named in the query and priced here, never carried in it: the picture is
 * a rendering of the engine's answer, not of whatever the link happened to say.
 */
export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, QUOTE_CARD_KEYS);
  if (moved) return moved;
  const input = cardInputFrom(req.nextUrl.searchParams);
  const card = input ? quoteCard(input) : undefined;
  if (!input || !card) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  /** the theme the plan is sold under, so the card matches the page it was quoted from */
  const p = cardPaletteFor();

  const [regular, semibold, display, photo] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
    loadPhoto(),
  ]);

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
        {/* The insured sits opposite the plan rather than under it: who a card is for is what
            an agent checks before forwarding it, and at this size a glance answers it. The row
            keeps the two bands' combined height, so the canvas arithmetic is unchanged. */}
        <div
          style={{
            display: "flex", height: H.plan + H.insured, flexShrink: 0,
            width: "100%", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>{card.planLine}</div>
            <div style={{ ...band(H.insured), fontSize: 27, color: p.mute }}>{card.insuredLine}</div>
          </div>
          <div
            style={{
              display: "flex", flexShrink: 0, marginLeft: 24,
              fontSize: 44, fontWeight: 600, lineHeight: 1, color: p.figure,
            }}
          >
            {card.insuredWho}
          </div>
        </div>

        {/* the premium and what it comes to, with the family at the right of them: the picture
            is laid over the corner of this block, so no band changes height */}
        <div
          style={{
            display: "flex", flexDirection: "column", position: "relative", flexShrink: 0,
            ...(card.premium ? { height: H.head } : {}),
          }}
        >
          {card.premium && photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo} width={PHOTO_SIZE} height={PHOTO_SIZE} alt=""
              style={{ position: "absolute", right: 0, top: 0, width: PHOTO_SIZE, height: PHOTO_SIZE }}
            />
          )}
          {card.premium ? (
            <div style={{ ...band(H.premium), alignItems: "baseline", paddingTop: 14 }}>
              <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 86, lineHeight: 1, color: p.figure }}>
                {card.premium.amount}
              </div>
              <div style={{ display: "flex", fontSize: 30, color: p.mute, marginLeft: 16 }}>
                บาท {card.premium.per}
              </div>
            </div>
          ) : (
            <div style={{ ...band(H.noPrice), fontSize: 34, color: p.accent, alignItems: "center" }}>
              ขอราคาปัจจุบันได้ทางแชท
            </div>
          )}
          {card.perDay && (
            <div style={{ ...band(H.perDay), fontSize: 26, color: p.mute }}>
              <Marked p={p}>{card.perDay}</Marked>
            </div>
          )}
        </div>

        {card.summary && <Summary s={card.summary} p={p} />}
        {card.priceNote && (
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={spacer(H.noteGap)} />
            <Notes notes={[card.priceNote]} color={p.mute} size={21} />
          </div>
        )}

        {card.sections.map((s) => (
          s.items?.length
            ? <ListRows key={s.title} title={s.title} items={s.items} p={p} />
            : <Rows key={s.title} title={s.title} rows={s.rows} p={p} />
        ))}
        {card.footNotes?.length ? (
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={spacer(H.gap)} />
            <div style={spacer(H.hairline, p.hair)} />
            <div style={spacer(H.noteGap)} />
            {/* the child's note in the plan's accent, as the page sets it; the small print muted */}
            {card.footNotes.map((n, i) => (
              <Notes
                key={n} notes={[n]}
                color={i < card.footNotes!.length - 1 ? p.accent : p.mute}
                size={i < card.footNotes!.length - 1 ? 22 : 20}
              />
            ))}
          </div>
        ) : null}

      </div>
    ),
    {
      width: WIDTH,
      height: heightOf(card),
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        { name: "Trirong", data: display, weight: 600, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
