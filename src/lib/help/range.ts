/**
 * One slice of a file for a `Range: bytes=…` request. An iPhone plays a video only from a
 * server that answers these with 206, and Cloudflare's static files answer 200 with the whole
 * file (seen on www.advisortool.app, 2026-11-11), so /help/clip/[id] cuts the slice itself.
 * null = no usable range, send the whole file; "bad" = a range past the end (416).
 */
export function byteRange(header: string | null, size: number): { start: number; end: number } | "bad" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) {
    // bytes=-500: the last 500 bytes
    const last = Number(m[2]);
    if (last === 0) return "bad";
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  const start = Number(m[1]);
  if (start >= size) return "bad";
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return end < start ? "bad" : { start, end };
}
