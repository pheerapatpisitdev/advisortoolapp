import { SIZES, XFADE, type VideoSize } from "@/lib/quote-video/timeline";
import { thaiLines } from "./lines";

/**
 * ดีไซน์พิเศษ: the three looks of a คลิปตามโจทย์ put together by Shotstack (owner, 2026-10-21,
 * mockup https://claude.ai/artifact/FqkpbJneL55sMh9HSyGr4L v2, ก ก; samples OK'd the same day).
 * Each is a Shotstack timeline built here from the clip's parts: the picture full frame and slowly
 * moving, the scene's words on a band in lines we break ourselves (lines.ts), the narration as one
 * track, our own music under it, and the closing card with the agent's contact.
 */
export type DesignLook = "blue" | "gold" | "film";
export const DESIGN_LOOKS: { id: DesignLook; name: string; music: "bright" | "warm" | "calm" }[] = [
  { id: "blue", name: "แถบน้ำเงิน", music: "bright" },
  { id: "gold", name: "ทองอบอุ่น", music: "warm" },
  { id: "film", name: "ภาพยนตร์", music: "calm" },
];
export const isDesignLook = (v: unknown): v is DesignLook => DESIGN_LOOKS.some((l) => l.id === v);

/** each look's thumbnail on the form, in the clip's own colours: the picture's sky and ground, and its words' band */
export const DESIGN_THUMBS: Record<DesignLook, { sky: string; ground: string; band: string; top?: true }> = {
  blue: { sky: "#bcd3ef", ground: "#b5d4a6", band: "rgba(2,33,98,.88)" },
  gold: { sky: "#f6e7c8", ground: "#e8b86b", band: "rgba(255,250,240,.94)" },
  film: { sky: "#2a2f3d", ground: "#4b5266", band: "#000000", top: true },
};

/** one stretch of the clip, in seconds from its start */
export type DesignPart =
  | { kind: "cover"; start: number; length: number; title: string; kicker?: string }
  /** `lines`: words already set line by line (the figure card's), each kept to its own line */
  | { kind: "scene"; start: number; length: number; picture: string | null; text: string; lines?: string[] }
  | { kind: "contact"; start: number; length: number; greeting: string; name: string; reach: string };

export interface DesignClip {
  look: DesignLook;
  size: VideoSize;
  /** the clip's length, in seconds */
  total: number;
  /** the whole narration as one file, and where it starts (after the cover) */
  voice: string;
  voiceAt: number;
  /** links Shotstack reads: our music, our two Plex weights */
  music: string;
  fonts: { regular: string; semibold: string };
  parts: DesignPart[];
}

const FAMILY = "IBM Plex Sans Thai";
/** each looping music file is 20 s long */
const MUSIC_SEC = 20;
const MUSIC_VOLUME = 0.12;

type Clip = Record<string, unknown>;

interface Palette {
  ground: string; ink: string; accent: string;
  /** the band the words sit on */
  band: { color: string; opacity: number; radius: number; inset: number } | null;
  weight: "400" | "600";
  /** where the words sit, as a share of the frame's height from its foot */
  textFromFoot: number;
  /** the picture's slow moves, scene by scene */
  moves: [string, string];
  enter: string;
}

const PALETTES: Record<DesignLook, Palette> = {
  blue: { ground: "#022162", ink: "#ffffff", accent: "#f6c453", band: { color: "#022162", opacity: 0.88, radius: 0, inset: 0 }, weight: "600", textFromFoot: 0.16, moves: ["zoomInSlow", "zoomOutSlow"], enter: "fade" },
  gold: { ground: "#f6e7c8", ink: "#3a2a12", accent: "#a8691d", band: { color: "#fffaf0", opacity: 0.94, radius: 36, inset: 50 }, weight: "600", textFromFoot: 0.15, moves: ["slideRightSlow", "slideLeftSlow"], enter: "slideLeft" },
  film: { ground: "#000000", ink: "#ffffff", accent: "#cfcfcf", band: null, weight: "400", textFromFoot: 0.085, moves: ["zoomInSlow", "zoomOutSlow"], enter: "fade" },
};

/** Shotstack's edit for one clip: the timeline and the output size */
export function designEdit(c: DesignClip): { timeline: object; output: object } {
  const { w, h } = SIZES[c.size];
  const p = PALETTES[c.look];
  // type is sized against the short side, so a square or landscape clip keeps the portrait's proportions
  const unit = Math.min(w, h) / 1080;
  const px = (n: number) => Math.round(n * unit);
  const textW = w - px(120);
  const sceneSize = px(c.look === "film" ? 54 : 66);
  const bandH = px(c.look === "film" ? 0 : 300);
  // offsets are shares of the frame: y from the middle, up positive
  const fromFoot = (share: number) => -0.5 + share;

  const text = (t: string, o: { start: number; length: number; size: number; color: string; y?: number; weight?: string; width?: number }): Clip => {
    const lines = t.split("\n").length;
    return {
      asset: {
        type: "rich-text", text: t,
        font: { family: FAMILY, size: o.size, weight: o.weight ?? p.weight, color: o.color },
        align: { horizontal: "center", vertical: "middle" },
      },
      start: o.start, length: o.length, width: o.width ?? textW, height: Math.ceil(lines * o.size * 1.5 + px(20)),
      offset: { x: 0, y: o.y ?? 0 }, transition: { in: "fade", out: "fade" },
    };
  };
  const lines = (t: string, size: number, width = textW) => thaiLines(t, (width - px(40)) / size).join("\n");

  const words: Clip[] = [];
  const bands: Clip[] = [];
  const pictures: Clip[] = [];
  let sceneNo = 0;
  for (const part of c.parts) {
    if (part.kind === "cover") {
      const size = px(c.look === "film" ? 72 : 96);
      if (part.kicker && c.look !== "film") words.push(text(part.kicker, { start: part.start + 0.2, length: part.length - 0.2, size: px(44), color: p.accent, y: 0.14 }));
      words.push(text(lines(part.title, size, w - px(180)), { start: part.start + 0.2, length: part.length - 0.2, size, color: c.look === "gold" ? "#5a3a12" : p.ink, y: -0.02, width: w - px(180) }));
    } else if (part.kind === "scene") {
      const move = p.moves[sceneNo++ % 2];
      if (part.picture) {
        pictures.push({ asset: { type: "image", src: part.picture }, start: part.start, length: part.length + 0.4, fit: "crop", effect: move, transition: { in: p.enter } });
      }
      const onPicture = Boolean(part.picture);
      if (p.band && onPicture) {
        const bw = w - 2 * px(p.band.inset);
        bands.push({
          asset: { type: "shape", shape: "rectangle", width: bw, height: bandH, rectangle: { width: bw, height: bandH, cornerRadius: px(p.band.radius) }, fill: { color: p.band.color, opacity: p.band.opacity } },
          start: part.start + 0.15, length: part.length - 0.15, offset: { x: 0, y: fromFoot(p.textFromFoot) }, transition: { in: "fade", out: "fade" },
        });
      }
      const width = p.band && p.band.inset ? w - 2 * px(p.band.inset) - px(60) : textW;
      const color = onPicture ? p.ink : c.look === "gold" ? p.ink : "#ffffff";
      const set = part.lines?.length ? part.lines.map((l) => lines(l, sceneSize, width)).join("\n") : lines(part.text, sceneSize, width);
      // the words leave before the scene's overlap with the next (XFADE), while its band is still there
      words.push(text(set, { start: part.start + 0.3, length: Math.max(0.5, part.length - 0.3 - XFADE), size: sceneSize, color, y: onPicture ? fromFoot(p.textFromFoot) : 0, width }));
    } else {
      words.push(text(part.greeting, { start: part.start, length: part.length, size: px(76), color: c.look === "gold" ? "#5a3a12" : p.ink, y: 0.06 }));
      const who = [part.name, part.reach].filter(Boolean).join(" · ");
      if (who) words.push(text(who, { start: part.start, length: part.length, size: px(46), color: p.accent, y: -0.06 }));
    }
  }

  // the film look's bars, above the pictures and under the words, from the first scene to the closing card
  const scenes = c.parts.filter((x) => x.kind === "scene");
  if (c.look === "film" && scenes.length) {
    const from = scenes[0].start;
    const to = scenes[scenes.length - 1].start + scenes[scenes.length - 1].length;
    for (const [height, y] of [[Math.round(h * 0.135), 0.5 - 0.135 / 2], [Math.round(h * 0.17), -0.5 + 0.17 / 2]] as const) {
      bands.push({ asset: { type: "shape", shape: "rectangle", width: w, height, rectangle: { width: w, height, cornerRadius: 0 }, fill: { color: "#000000", opacity: 1 } }, start: from, length: to - from, offset: { x: 0, y } });
    }
  }

  const music: Clip[] = [];
  for (let at = 0; at < c.total; at += MUSIC_SEC) {
    music.push({ asset: { type: "audio", src: c.music, volume: MUSIC_VOLUME }, start: at, length: Math.min(MUSIC_SEC, c.total - at) });
  }

  return {
    timeline: {
      background: p.ground,
      fonts: [{ src: c.fonts.regular }, { src: c.fonts.semibold }],
      tracks: [
        { clips: words },
        ...(bands.length ? [{ clips: bands }] : []),
        ...(pictures.length ? [{ clips: pictures }] : []),
        { clips: [{ asset: { type: "audio", src: c.voice, volume: 1 }, start: c.voiceAt, length: Math.max(0.1, c.total - c.voiceAt) }] },
        { clips: music },
      ],
    },
    output: { format: "mp4", fps: 25, size: { width: w, height: h } },
  };
}
