import type { DiseaseList } from "@/lib/copilot/knowledge";
import type { CardPalette } from "@/lib/card-theme";

/**
 * A contract's illnesses, drawn: the title, the count by stage, a rule, then the names in three
 * columns. The illnesses' own picture (./diseases) is this and a footer; iShield's value table
 * carries it under the years (owner, 2026-10-19, option ก on mockup
 * https://claude.ai/artifact/WVkVf2BcZB8pD8GWxeF1aE), so the customer has the price and the
 * cover in one picture.
 *
 * Laid out for whatever width it is given, because the two pictures are not the same width.
 */

const GUTTER = 40;
/** three columns, or two on a narrow picture, where three would wrap every name */
const COLUMNS = 3;
const NARROW_BELOW = 1200;
/** the number before each name */
const NUMBER_W = 44;

/**
 * Every band of the block, in pixels.
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
 * How many characters of a diagnosis fit on one line of a name column.
 *
 * Measured against the drawing rather than reasoned about: at 22px in the illnesses' own
 * picture (1700 wide, 52 of padding a side) the long names — "โรคหลอดเลือดสมองที่ได้รับการรักษา
 * โดยวิธีใส่สายสวนเส้นเลือด…" — run to three lines at 34 characters a line. A narrower column
 * holds proportionally fewer. The figure has to be right because the canvas is laid out in one
 * pass: a row given one line of height and handed two draws the second on top of whatever
 * follows it.
 */
const MEASURED_CHARS = 34;
const MEASURED_NAME_W = (1700 - 52 * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS - NUMBER_W;

/**
 * Thai vowels above and below the line, and the tone marks, take no width at all.
 *
 * Counting them made every name look longer than it draws, so rows were given two lines of
 * height for one line of text and the column came out with gaps down it. "โรคเยื่อหุ้มสมอง
 * และไขสันหลังอักเสบจากเชื้อแบคทีเรีย" is 43 characters and 33 of them advance.
 */
const COMBINING = /[ัิ-ฺ็-๎]/g;
const advance = (name: string) => name.replace(COMBINING, "").length;

/** the columns' geometry for a block `width` pixels wide */
function geometry(width: number) {
  const columns = width < NARROW_BELOW ? 2 : COLUMNS;
  const col = (width - GUTTER * (columns - 1)) / columns;
  const wrapsAt = Math.floor(MEASURED_CHARS * ((col - NUMBER_W) / MEASURED_NAME_W) + 1e-9);
  const rowsFor = (name: string) => Math.max(1, Math.ceil(advance(name) / wrapsAt));
  return { columns, col, rowsFor };
}

type Numbered = { name: string; no: number };

/** The names dealt down the columns, balanced so no column runs far past the others. */
function columnsOf(names: string[], columns: number, rowsFor: (name: string) => number): Numbered[][] {
  const numbered = names.map((name, i) => ({ name, no: i + 1 }));
  const total = numbered.reduce((n, d) => n + rowsFor(d.name), 0);
  const target = Math.ceil(total / columns);
  const cols: Numbered[][] = Array.from({ length: columns }, () => []);
  let col = 0;
  let filled = 0;
  for (const d of numbered) {
    if (filled >= target && col < columns - 1) {
      col += 1;
      filled = 0;
    }
    cols[col].push(d);
    filled += rowsFor(d.name);
  }
  return cols;
}

/** one list needs no headings inside it, and no line under the title saying what it is made of */
const isGrouped = (list: DiseaseList) => list.groups.length > 1;

/** The tallest column decides how much height a group needs. */
function groupHeight(names: string[], heading: boolean, width: number): number {
  const { columns, rowsFor } = geometry(width);
  const cols = columnsOf(names, columns, rowsFor);
  const tallest = Math.max(...cols.map((c) => c.reduce((n, d) => n + rowsFor(d.name), 0)));
  return (heading ? H.groupHead : 0) + tallest * H.row + H.afterGroup;
}

/** The block's height at `width`, for the canvas sum of whichever picture carries it. */
export function diseaseListHeight(list: DiseaseList, width: number): number {
  const grouped = isGrouped(list);
  return H.title + (grouped ? H.count : 0)
    + H.gap + H.hairline + H.afterHairline
    + list.groups.reduce((n, g) => n + groupHeight(g.diseases, grouped, width), 0);
}

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

function Group(
  { title, names, p, heading, width }: { title: string; names: string[]; p: CardPalette; heading: boolean; width: number },
) {
  const { columns, col, rowsFor } = geometry(width);
  return (
    <div style={{ display: "flex", flexDirection: "column", width, flexShrink: 0 }}>
      {/* a contract with one list has already said its name and its count in the title above */}
      {heading && (
        <div style={{ ...band(H.groupHead), fontSize: 26, fontWeight: 600, color: p.accent }}>
          {title} · {names.length} โรค
        </div>
      )}
      <div style={{ display: "flex", gap: GUTTER }}>
        {columnsOf(names, columns, rowsFor).map((c, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", width: col }}>
            {c.map((d) => (
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
                <span style={{ width: NUMBER_W, color: p.mute, flexShrink: 0 }}>{d.no}.</span>
                {/*
                  * Thai is written without spaces, so a line breaker looking for one finds
                  * nothing and lets the name run out of its column and across the one beside
                  * it — which is exactly what the first drawing of this card did. Breaking
                  * anywhere is not how Thai is properly broken, and it is what there is.
                  */}
                <span style={{ width: col - NUMBER_W, wordBreak: "break-all" }}>{d.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={spacer(H.afterGroup)} />
    </div>
  );
}

/** The block itself, `width` pixels wide. */
export function DiseaseListBlock({ list, width, p }: { list: DiseaseList; width: number; p: CardPalette }) {
  const total = list.groups.reduce((n, g) => n + g.diseases.length, 0);
  const grouped = isGrouped(list);
  return (
    <div style={{ display: "flex", flexDirection: "column", width, flexShrink: 0 }}>
      <div style={{ ...band(H.title), fontFamily: "Plex", fontWeight: 600, fontSize: 38, color: p.figure }}>
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
        <Group key={g.title} title={g.title} names={g.diseases} p={p} heading={grouped} width={width} />
      ))}
    </div>
  );
}
