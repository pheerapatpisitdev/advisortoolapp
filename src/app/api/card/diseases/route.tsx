import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { diseaseListFor } from "@/lib/copilot/knowledge";
import { CARD_PALETTE, type CardPalette } from "@/lib/card-theme";
import { DISEASE_CARD_KEYS, toCanonical } from "../canonical";

export const runtime = "nodejs";
/** The names come from a benefit sheet, which changes with a rate revision and not oftener. */
export const revalidate = 86400;

/**
 * The illnesses a contract names, drawn as a picture.
 *
 * The sales page has carried these for a while and the assistant can read them out, but
 * neither travels: a customer asks "โรคอะไรบ้าง" in an inbox, and the honest answer is
 * seventy names — a wall of text nobody reads on a phone, and one that cannot be sent on to
 * the husband who has to agree to it. A picture can be saved, forwarded and shown.
 *
 * The names are read from the same list the assistant answers from. A card drawn from a
 * second copy would go on saying fifty after the benefit sheet moved to fifty-two, and there
 * would be nothing to say which of the two was lying.
 */

/** Three columns of names; two left the longer diagnoses wrapping to three lines each. */
const WIDTH = 1700;
const PAD = 52;
const GUTTER = 40;
const COLUMNS = 3;
const COL_W = (WIDTH - PAD * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;

/**
 * Every band of the card, in pixels.
 *
 * The drawing library lays a fixed canvas out in one pass and will put one line on top of
 * another rather than grow the page, so the height is the sum of the bands and every band
 * has to be tall enough for what goes in it — see the quote card's own note.
 */
const H = {
  title: 52,
  count: 40,
  gap: 28,
  hairline: 1,
  afterHairline: 22,
  groupHead: 46,
  row: 34,
  afterGroup: 26,
};

/**
 * How many characters of a diagnosis fit on one line of a column.
 *
 * Measured against the drawing rather than reasoned about: at 22px in this column the long
 * names — "โรคหลอดเลือดสมองที่ได้รับการรักษาโดยวิธีใส่สายสวนเส้นเลือด…" — run to three lines.
 * The figure has to be right because the canvas is laid out in one pass: a row given one
 * line of height and handed two draws the second on top of whatever follows it.
 */
const WRAPS_AT = 34;

/**
 * Thai vowels above and below the line, and the tone marks, take no width at all.
 *
 * Counting them made every name look longer than it draws, so rows were given two lines of
 * height for one line of text and the column came out with gaps down it. "โรคเยื่อหุ้มสมอง
 * และไขสันหลังอักเสบจากเชื้อแบคทีเรีย" is 43 characters and 33 of them advance.
 */
const COMBINING = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;
const widthOf = (name: string) => name.replace(COMBINING, "").length;

const rowsFor = (name: string) => {
  const w = widthOf(name);
  return w > WRAPS_AT * 2 ? 3 : w > WRAPS_AT ? 2 : 1;
};

/** The names dealt down three columns, balanced so no column runs far past the others. */
function columnsOf(names: string[]): { name: string; no: number }[][] {
  const numbered = names.map((name, i) => ({ name, no: i + 1 }));
  const total = numbered.reduce((n, d) => n + rowsFor(d.name), 0);
  const target = Math.ceil(total / COLUMNS);
  const cols: { name: string; no: number }[][] = [[], [], []];
  let col = 0;
  let filled = 0;
  for (const d of numbered) {
    if (filled >= target && col < COLUMNS - 1) {
      col += 1;
      filled = 0;
    }
    cols[col].push(d);
    filled += rowsFor(d.name);
  }
  return cols;
}

/** The tallest column decides how much height the group needs. */
function groupHeight(names: string[], heading: boolean): number {
  const cols = columnsOf(names);
  const tallest = Math.max(...cols.map((c) => c.reduce((n, d) => n + rowsFor(d.name), 0)));
  return (heading ? H.groupHead : 0) + tallest * H.row + H.afterGroup;
}

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

function Group(
  { title, names, p, heading }: { title: string; names: string[]; p: CardPalette; heading: boolean },
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: WIDTH - PAD * 2, flexShrink: 0 }}>
      {/* a contract with one list has already said its name and its count in the title above */}
      {heading && (
        <div style={{ ...band(H.groupHead), fontSize: 26, fontWeight: 600, color: p.accent }}>
          {title} · {names.length} โรค
        </div>
      )}
      <div style={{ display: "flex", gap: GUTTER }}>
        {columnsOf(names).map((col, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", width: COL_W }}>
            {col.map((d) => (
              <div
                key={d.no}
                style={{
                  display: "flex",
                  height: rowsFor(d.name) * H.row,
                  flexShrink: 0,
                  fontSize: 22,
                  color: p.ink,
                  lineHeight: 1.35,
                }}
              >
                <span style={{ width: 44, color: p.mute, flexShrink: 0 }}>{d.no}.</span>
                {/*
                  * Thai is written without spaces, so a line breaker looking for one finds
                  * nothing and lets the name run out of its column and across the one beside
                  * it — which is exactly what the first drawing of this card did. Breaking
                  * anywhere is not how Thai is properly broken, and it is what there is.
                  */}
                <span style={{ width: COL_W - 44, wordBreak: "break-all" }}>{d.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={spacer(H.afterGroup)} />
    </div>
  );
}

const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, DISEASE_CARD_KEYS);
  if (moved) return moved;
  const code = (req.nextUrl.searchParams.get("of") ?? "").toUpperCase();
  const list = diseaseListFor(code);
  if (!list) return new Response("ไม่พบรายชื่อโรคตามที่ระบุ", { status: 400 });

  const p = CARD_PALETTE;
  const total = list.groups.reduce((n, g) => n + g.diseases.length, 0);
  /** one list needs no headings inside it, and no line above saying what it is made of */
  const grouped = list.groups.length > 1;
  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);

  const height = PAD * 2
    + H.title + (grouped ? H.count : 0)
    + H.gap + H.hairline + H.afterHairline
    + list.groups.reduce((n, g) => n + groupHeight(g.diseases, grouped), 0);

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
        <div style={{ ...band(H.title), fontFamily: "Trirong", fontSize: 38, color: p.figure }}>
          {list.name} · คุ้มครอง {total} โรคร้ายแรง
        </div>
        {grouped && (
          <div style={{ ...band(H.count), fontSize: 23, color: p.mute }}>
            {list.groups.map((g) => `${g.title} ${g.diseases.length} โรค`).join(" · ")}
          </div>
        )}

        <div style={spacer(H.gap)} />
        <div style={spacer(H.hairline, p.hair)} />
        <div style={spacer(H.afterHairline)} />

        {list.groups.map((g) => (
          <Group key={g.title} title={g.title} names={g.diseases} p={p} heading={grouped} />
        ))}

      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        { name: "Trirong", data: display, weight: 600, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
