import { insuredFace } from "./insured-face";

/** how the corner is drawn on one picture: its figure size, face size and two colours */
export interface WhoStyle { size: number; face: number; color: string; mute: string }

/** the room between the name and the line under it */
const NAME_GAP = 8;
/** the face and "ชาย 35 ปี" under a name, against their size without one */
const UNDER = 0.68;

/** Past this many letters a name with a space in it goes onto two lines, first name over surname. */
const ONE_LINE = 20;

/**
 * The name as it is set: one line, or two split at the first space once it is long. Smaller
 * alone could not do it: a thirty-letter name beside "Life Protect x 2 · ชำระเบี้ยครบอายุ 99 ปี"
 * ran off the card's right edge at the smallest size (2026-10-20). A name with no space stays
 * one line and is set smaller still.
 */
function nameLines(name: string): string[] {
  const length = Array.from(name).length;
  const space = name.indexOf(" ");
  if (length <= ONE_LINE || space < 0) return [name];
  return [name.slice(0, space), name.slice(space + 1).trim()];
}

/** A long name is set smaller, so it never reaches across into the plan's own lines. */
function nameSize(lines: string[], size: number): number {
  const length = Math.max(...lines.map((line) => Array.from(line).length));
  return Math.round(size * (length <= 10 ? 1 : length <= 16 ? 0.8 : length <= 24 ? 0.66 : 0.56));
}

/**
 * The height the top row needs: its own, or more when a name stands over the insured. The
 * pictures are fixed canvases summed band by band (see the card route), so the row is told
 * its height and the canvas grows by the same amount.
 */
export function whoRowHeight(base: number, name: string | undefined, s: WhoStyle): number {
  if (!name) return base;
  const lines = nameLines(name);
  return Math.max(base, lines.length * Math.ceil(nameSize(lines, s.size) * 1.2) + NAME_GAP + Math.round(s.face * UNDER));
}

/**
 * Who a picture is for, at its top right: the face and "ชาย 35 ปี" as they always were — or,
 * with the customer's name, the name in their place and the two set smaller under it (owner,
 * 2026-10-19, option ก). `name` comes already addressed, "คุณสมชาย".
 */
export function insuredWho(sex: "M" | "F", who: string, name: string | undefined, s: WhoStyle) {
  if (!name) {
    return (
      <div
        style={{
          display: "flex", flexShrink: 0, marginLeft: 24, alignItems: "center", gap: 14,
          fontSize: s.size, fontWeight: 600, lineHeight: 1, color: s.color,
        }}
      >
        {insuredFace(sex, s.face)}
        {who}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: 24 }}>
      {nameLines(name).map((line, i, lines) => (
        <div key={i} style={{ display: "flex", fontSize: nameSize(lines, s.size), fontWeight: 600, lineHeight: 1.2, color: s.color }}>
          {line}
        </div>
      ))}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, marginTop: NAME_GAP,
          fontSize: Math.round(s.size * UNDER), fontWeight: 600, lineHeight: 1, color: s.mute,
        }}
      >
        {insuredFace(sex, Math.round(s.face * UNDER))}
        {who}
      </div>
    </div>
  );
}
