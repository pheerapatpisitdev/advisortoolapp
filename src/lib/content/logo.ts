/**
 * A Page's logo on its posters (owner, 2026-09-29): uploaded once per Page — once per agent for
 * an agent with no Pages — and set in one of six spots, or left off. The spot is chosen when a
 * round is made and moved in the editor, one piece at a time.
 *
 * The logo keeps a margin of its own: words at the same edge move over to make room, so a
 * logo never sits on a headline. Replacing a logo writes a new file and keeps the old one, so a
 * piece already on a Page still draws the logo it went up with.
 *
 * This module is the shapes only, safe for the page; the store is logo-store.ts.
 */

export const LOGO_SPOTS = ["tl", "tc", "tr", "bl", "bc", "br"] as const;
export type LogoSpot = (typeof LOGO_SPOTS)[number];

/** as the spot picker draws them, and in the owner's words for a screen reader */
export const LOGO_SPOT_ARROW: Record<LogoSpot, string> = { tl: "↖", tc: "↑", tr: "↗", bl: "↙", bc: "↓", br: "↘" };
export const LOGO_SPOT_LABEL: Record<LogoSpot, string> = {
  tl: "บนซ้าย", tc: "กลางบน", tr: "บนขวา", bl: "ล่างซ้าย", bc: "กลางล่าง", br: "ล่างขวา",
};

export const isLogoSpot = (v: unknown): v is LogoSpot => typeof v === "string" && (LOGO_SPOTS as readonly string[]).includes(v);

export interface PosterLogo {
  /** in the content-media bucket, "logos/<file id>.<ext>" */
  path: string;
  spot: LogoSpot;
}

/** the only shape a logo's path may have; anything else could point the drawing route elsewhere */
const LOGO_PATH = /^logos\/[0-9a-f-]{36}\.(png|jpe?g|webp)$/;
export const isLogoPath = (v: unknown): v is string => typeof v === "string" && LOGO_PATH.test(v);

export function toLogo(raw: unknown): PosterLogo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return isLogoPath(r.path) && isLogoSpot(r.spot) ? { path: r.path, spot: r.spot } : null;
}

export const atTop = (spot: LogoSpot) => spot.startsWith("t");

/**
 * The box a logo is fitted into, drawn "contain" so a wide wordmark and a square mark both
 * read. Against the canvas's width, so a story and a square carry it at the same size.
 */
export function logoBox(canvasWidth: number): { w: number; h: number } {
  return { w: Math.round(canvasWidth * 0.22), h: Math.round(canvasWidth * 0.1) };
}

/**
 * A PNG's or JPEG's width and height from its bytes — the two the page's shrinking sends — or
 * null. The drawing needs them: an image given only a box is centred in it, and a logo set to
 * the left sat a third of the way in (seen 2026-09-29).
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    const length = view.getUint16(at + 2);
    // a start-of-frame, of any kind but the three that are not (DHT, JPG, DAC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
    }
    at += 2 + length;
  }
  return null;
}

/** The logo's size inside its box, keeping its shape: as large as the box lets it be. */
export function fitInBox(size: { width: number; height: number } | null, box: { w: number; h: number }): { w: number; h: number } {
  if (!size || size.width <= 0 || size.height <= 0) return { w: box.h, h: box.h };
  const scale = Math.min(box.w / size.width, box.h / size.height);
  return { w: Math.round(size.width * scale), h: Math.round(size.height * scale) };
}

/** what the page may send: the file types the bucket takes, and a size the page's shrinking stays under */
export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
