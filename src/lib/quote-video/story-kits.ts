import { QUOTE_VIDEO_COLORS, STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { StoryVideoInput } from "./story";

/**
 * The looks the อินโฟกราฟิก route draws in (story-info-motion.tsx), on their own so that what is drawn around the
 * scenes (story-motion.tsx: the background, the titles, the subtitle, the agent's card) dresses in the same Kit
 * without the two drawing files reading each other as they load.
 */

const C = QUOTE_VIDEO_COLORS;
const S = STORY_CLIP_COLORS;

/** อินโฟกราฟิก's ground: วิดีโอนำเสนอ Motion's navy */
export const INFO_GROUND = C.motionNavy;

/**
 * What a look draws with: อินโฟกราฟิก's navy and gold, ปากกาพล็อตเตอร์'s one pen on cream paper, or (owner, 2026-11-14,
 * spec 2026-11-14-story-looks-board-neon-blueprint) ไวต์บอร์ด's markers, นีออน's glowing tubes, บลูพริ้นท์'s white lines.
 */
export interface Kit {
  /** drawn by hand rather than set in tiles: outlined tiles and stamps, hollow dots, thicker card lines */
  drawn: boolean;
  /** the ground the pieces stand on (the clip's background is drawn to match it) */
  page: string;
  /** the face its words are written in, or none (อินโฟกราฟิก: the frame's own Plex) */
  hand: string | null;
  /**
   * the weight of its bold words: 400 in a face with no bold (Sriracha) — the clip registers Plex under every
   * family and synthesises no bold, so a 600 line in Sriracha would be drawn in Plex SemiBold (as themes.tsx's โน้ตแปะ)
   */
  bold: 600 | 400;
  /** how a piece comes in: its own entrance, written left to right, or switched on with a flicker */
  reveal: "fade" | "write" | "switch";
  /** ปากกาพล็อตเตอร์'s rail and carriage over the sheet; a title in outline; a tile's hatched shading set off behind it */
  machine: boolean; hollowTitle: boolean; shade: boolean;
  /** bars hatched inside their outline; a glow in the line's own colour; a dimension line under each figure */
  hatch: boolean; glow: boolean; dims: boolean;
  /** the width of a drawn line, against the pen's; a stamp's tilt; how far down a struck-out belief's line crosses it, as a share of its size (its face's own) */
  line: number; tilt: number; strike: number;
  /** headings and the accent, a title's second line, a tile's own ground, bad and good news, the words, a card's ground and edge, the quieter words */
  gold: string; sub: string; sky: string; red: string; green: string; white: string; tile: string; tileLine: string; soft: string;
  /** what is drawn on a gold tile, a struck-out belief, the list item the voice is on and its edge, a tick, a recap's ground and small line */
  ground: string; dim: string; on: string; onLine: string; tick: string; card: string; mute: string;
  /** ไวต์บอร์ด: a scene's title underlined in one marker stroke of the accent */
  underline: boolean;
  /**
   * What is drawn around the scenes in a look of its own (story-motion.tsx): the subtitle's band, its words and the
   * word being spoken, the footer, and the edge of the agent's card. อินโฟกราฟิก and ปากกาพล็อตเตอร์ have none: theirs
   * are the clip's shared ones.
   */
  dress?: { band: string; words: string; spoken: string; foot: string; cardEdge: string };
}
export const INFO_KIT: Kit = {
  drawn: false, page: INFO_GROUND, hand: null, bold: 600, reveal: "fade", machine: false, hollowTitle: false, shade: false, hatch: false, glow: false, dims: false, line: 1, tilt: 0, strike: 0.62,
  gold: C.motionGold, sub: S.white, sky: C.motionSky, red: C.motionRed, green: C.motionGreen, white: S.white, tile: "rgba(255,255,255,0.08)", tileLine: "rgba(255,255,255,0.2)", soft: "rgba(255,255,255,0.82)",
  ground: INFO_GROUND, dim: "rgba(255,255,255,0.45)", on: "rgba(255,210,63,0.12)", onLine: C.motionGold, tick: S.infoTick, card: S.white, mute: S.infoMute, underline: false,
};
const PLOT_KIT: Kit = {
  drawn: true, page: S.plotPaper, hand: "Mali", bold: 600, reveal: "write", machine: true, hollowTitle: true, shade: true, hatch: true, glow: false, dims: false, line: 1, tilt: -2, strike: 0.62,
  gold: S.plotInk, sub: S.plotInk, sky: S.plotInk, red: S.red, green: S.green, white: S.plotInk, tile: "transparent", tileLine: S.plotInk, soft: S.plotSoft,
  ground: S.plotInk, dim: S.plotDim, on: S.plotOn, onLine: S.red, tick: S.green, card: S.plotPaper, mute: S.plotSoft, underline: false,
};
/** ไวต์บอร์ด: dark ink and the blue and red markers on the white board, written in as the pen writes, with no machine */
const BOARD_KIT: Kit = {
  drawn: true, page: S.boardBoard, hand: "Mali", bold: 600, reveal: "write", machine: false, hollowTitle: false, shade: false, hatch: false, glow: false, dims: false, line: 1, tilt: -2, strike: 0.62,
  gold: S.boardBlue, sub: S.boardInk, sky: S.boardInk, red: S.boardRed, green: S.boardGreen, white: S.boardInk, tile: "transparent", tileLine: S.boardInk, soft: S.boardMuted,
  ground: S.boardInk, dim: S.boardMuted, on: "transparent", onLine: S.boardRed, tick: S.boardGreen, card: S.boardBoard, mute: S.boardMuted, underline: true,
  dress: { band: S.boardSub, words: S.white, spoken: S.spoken, foot: S.boardFooter, cardEdge: S.boardInk },
};
/** นีออน: cyan and pink tubes on the dark violet, lavender words, each piece switched on */
const NEON_KIT: Kit = {
  drawn: true, page: S.neonCentre, hand: "Sriracha", bold: 400, reveal: "switch", machine: false, hollowTitle: false, shade: false, hatch: false, glow: true, dims: false, line: 0.8, tilt: 0, strike: 0.98,
  gold: S.neonCyan, sub: S.neonPink, sky: S.neonPink, red: S.neonRed, green: S.neonGreen, white: S.neonInk, tile: "transparent", tileLine: S.neonMuted, soft: S.neonMuted,
  ground: S.white, dim: S.neonMuted, on: "transparent", onLine: S.neonCyan, tick: S.neonGreen, card: "transparent", mute: S.neonMuted, underline: false,
  dress: { band: S.neonSub, words: S.neonCyan, spoken: S.neonPink, foot: S.neonFooter, cardEdge: S.neonPink },
};
/** บลูพริ้นท์: thin white lines on the blueprint blue, light cyan for the accent, amber for what the customer pays */
const BLUEPRINT_KIT: Kit = {
  drawn: true, page: S.bpGround, hand: "Plex", bold: 600, reveal: "write", machine: false, hollowTitle: false, shade: false, hatch: true, glow: false, dims: true, line: 0.6, tilt: 0, strike: 0.84,
  gold: S.bpCyan, sub: S.bpInk, sky: S.bpInk, red: S.bpAmber, green: S.bpCyan, white: S.bpInk, tile: "transparent", tileLine: S.bpInk, soft: S.bpMuted,
  ground: S.bpInk, dim: S.bpMuted, on: "transparent", onLine: S.bpAmber, tick: S.bpCyan, card: "transparent", mute: S.bpMuted, underline: false,
  dress: { band: S.bpSub, words: S.bpInk, spoken: S.bpAmber, foot: S.bpMuted, cardEdge: S.bpInk },
};
const KITS: Partial<Record<string, Kit>> = { plot: PLOT_KIT, board: BOARD_KIT, neon: NEON_KIT, blueprint: BLUEPRINT_KIT };
/** the Kit a clip is drawn with, from its look; อินโฟกราฟิก's for "info" and any other */
export const kitFor = (input: Pick<StoryVideoInput, "art">): Kit => KITS[input.art ?? ""] ?? INFO_KIT;
