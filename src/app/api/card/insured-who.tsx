import { insuredFace } from "./insured-face";

/** how the corner is drawn on one picture: its figure size, face size and two colours */
export interface WhoStyle { size: number; face: number; color: string; mute: string }

/** the room between the name and the line under it */
const NAME_GAP = 8;
/** the face and "ชาย 35 ปี" under a name, against their size without one */
const UNDER = 0.68;

/** A long name is set smaller, so it never reaches across into the plan's own lines. */
function nameSize(name: string, size: number): number {
  const length = Array.from(name).length;
  return Math.round(size * (length <= 10 ? 1 : length <= 16 ? 0.8 : 0.66));
}

/**
 * The height the top row needs: its own, or more when a name stands over the insured. The
 * pictures are fixed canvases summed band by band (see the card route), so the row is told
 * its height and the canvas grows by the same amount.
 */
export function whoRowHeight(base: number, name: string | undefined, s: WhoStyle): number {
  if (!name) return base;
  return Math.max(base, Math.ceil(nameSize(name, s.size) * 1.2) + NAME_GAP + Math.round(s.face * UNDER));
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
      <div style={{ display: "flex", fontSize: nameSize(name, s.size), fontWeight: 600, lineHeight: 1.2, color: s.color }}>
        {name}
      </div>
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
