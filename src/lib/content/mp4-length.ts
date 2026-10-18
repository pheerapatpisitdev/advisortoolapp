/**
 * A clip's length as its own file says it (owner chose 17ก, 2026-10-18): the browser's figure
 * is the browser's word, and a clip longer than a Reel would be listened to by Gemini at the
 * owner's cost. An .mp4 or .mov keeps its length in the movie header (moov → mvhd); the walk
 * reads only the top-level boxes' headers and the start of moov, a few small range reads
 * whether moov sits before the picture data or after it, never the whole file.
 */

/** reads bytes [start, end] of the file, both ends included, or fewer at its end */
export type ReadRange = (start: number, end: number) => Promise<Uint8Array>;

const MAX_BOXES = 32;
/** mvhd comes first in moov in every camera's file; this much of moov is plenty to find it */
const MOOV_HEAD = 64 * 1024;

const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const u64 = (b: Uint8Array, at: number) => u32(b, at) * 2 ** 32 + u32(b, at + 4);
const kind = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

/** the seconds in an mvhd box's body (after its 8-byte header); null when it does not read */
export function mvhdSeconds(body: Uint8Array): number | null {
  if (body.length < 20) return null;
  const v1 = body[0] === 1;
  if (v1 && body.length < 32) return null;
  const scale = v1 ? u32(body, 20) : u32(body, 12);
  const units = v1 ? u64(body, 24) : u32(body, 16);
  if (!scale || !Number.isFinite(units)) return null;
  return units / scale;
}

/** the children of a box body, as [type, body start, body end] within `b` */
function* boxes(b: Uint8Array, from: number, to: number): Generator<[string, number, number]> {
  let at = from;
  while (at + 8 <= to) {
    let size = u32(b, at);
    let head = 8;
    if (size === 1) {
      if (at + 16 > to) return;
      size = u64(b, at + 8);
      head = 16;
    } else if (size === 0) size = to - at;
    if (size < head) return;
    yield [kind(b, at + 4), at + head, Math.min(at + size, to)];
    at += size;
  }
}

/** The clip's length in seconds, or null when the file is not one this can read. */
export async function mp4Seconds(read: ReadRange, fileBytes: number): Promise<number | null> {
  let at = 0;
  for (let n = 0; n < MAX_BOXES && at + 8 <= fileBytes; n++) {
    const h = await read(at, Math.min(at + 15, fileBytes - 1));
    if (h.length < 8) return null;
    let size = u32(h, 0);
    let head = 8;
    if (size === 1) {
      if (h.length < 16) return null;
      size = u64(h, 8);
      head = 16;
    } else if (size === 0) size = fileBytes - at;
    if (size < head) return null;
    if (kind(h, 4) === "moov") {
      const moov = await read(at + head, Math.min(at + size, at + head + MOOV_HEAD, fileBytes) - 1);
      for (const [t, s, e] of boxes(moov, 0, moov.length)) if (t === "mvhd") return mvhdSeconds(moov.subarray(s, e));
      return null;
    }
    at += size;
  }
  return null;
}

/** ReadRange over HTTP: a signed link, asked for one byte range at a time */
export function rangeReader(url: string): ReadRange {
  return async (start, end) => {
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
    // a server that ignores Range would send the whole file, hundreds of MB: not read, not waited for
    if (res.status !== 206) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`clip range ${start}-${end}: ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  };
}
