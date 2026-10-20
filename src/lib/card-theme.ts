import type { Theme } from "@/lib/content/poster";

/**
 * The palette a quote card is drawn in.
 *
 * A card is the sales page torn off and handed over, so it has to be the page's colours. There
 * used to be four of these, one per sales theme, because there used to be four sales themes.
 * There is one now, so there is one here.
 *
 * Two slots are named for their job rather than their colour, and the names are kept even
 * though nothing swaps ends any more: `figure` is whatever the premium is set in, and `ink` is
 * the body text. They read correctly whatever a later palette does to them.
 */
export interface CardPalette {
  /** the two ends of the card's background wash */
  ground: string;
  groundDeep: string;
  /** the plan's name, and anything else the eye should reach before the body text */
  accent: string;
  /** the premium itself, and the break-even marker: the loudest thing on the card */
  figure: string;
  /** body text */
  ink: string;
  /** labels, small print, axis numbers */
  mute: string;
  /** the hairline above a section */
  hair: string;
  /** the plainer rule: chart axes, the line above the notes */
  rule: string;
  /** the wash behind the quoted column of the value table */
  glow: string;
  /** every other row of the value table */
  stripe: string;
  /** the value table's gridlines */
  grid: string;
  /** the tint marking the quoted row */
  tint: string;
  /** the three series of the cash-value drawing */
  line: { cash: string; premium: string; cover: string };
  /** the yellow of the highlighter stroke behind the one figure a card wants read first */
  highlighter: string;
  /** the surrender figures once the policy is worth more than was paid in */
  gain: string;
  /** the red pen: the loop drawn round the break-even figure */
  pen: string;
  /** the sand fill behind the premium box, the page's --bot-sand-soft */
  box: string;
}

/**
 * Navy and sand on white — the one palette, taken from the same Bank of Thailand deck the
 * application's own pages are drawn from, so a card and the page it was quoted on are plainly
 * the same business.
 *
 * The ground is flat white rather than a wash. A card travels as an image and is read beside
 * chat bubbles and printed on office paper; a gradient is the first thing to band in a JPEG
 * and the first thing to come out grey on a laser printer.
 *
 * Two values are the card's own rather than the page's, and both are here because a card is a
 * picture the reader cannot zoom into:
 *
 * `mute` is darker than the page's muted ink. This drawing fades some cells to 85% — the
 * ceiling row, whose figures sit in a column the age cannot buy but which are real figures all
 * the same — and the page's #5b6472 comes out of that fade at 4.26:1. At this value the faded
 * cells hold 5.1:1 and the difference at full strength is invisible.
 *
 * `accent` is the olive rather than the deck's display olive, for the same reason: a plan name
 * on a card is set small.
 */
export const CARD_PALETTE: CardPalette = {
  ground: "#ffffff",
  groundDeep: "#ffffff",
  /* the plan's name — the deck's second headline line, which is the olive one */
  accent: "#736c42",
  /* the premium — the deck answers its own question in navy, and so does this */
  figure: "#022162",
  ink: "#15181d",
  mute: "#4d5563",
  hair: "#c3c6cd",
  rule: "#7d8490",
  /* the sand wash, which is the deck's one way of saying "this is the block you came for" */
  glow: "rgba(198,188,153,0.28)",
  stripe: "rgba(2,33,98,0.035)",
  grid: "#c3c6cd",
  tint: "rgba(198,188,153,0.35)",
  /* The deck ranks its series navy, grey, sand, every time: the answer leads and the two
     supporting quantities follow it in that order. */
  line: { cash: "#022162", premium: "#7f7f7f", cover: "#c6bc99" },
  /* the one colour on the card that is not the deck's: it has to look like a pen */
  highlighter: "#ffe14d",
  /* 5:1 on white */
  gain: "#15803d",
  pen: "#d62828",
  box: "#e7e3d4",
};

/**
 * The face beside "ชาย 35 ปี" / "หญิง 35 ปี" on every card (owner, 2026-10-09): a cartoon
 * man in blue, a cartoon woman in pink. `ground` fills the round badge, `ring` edges it and
 * dresses the shoulders.
 */
export const FACE_THEME = {
  M: { ground: "#dcebfb", ring: "#3b82c4" },
  F: { ground: "#fce4ef", ring: "#e0679a" },
} as const;

/**
 * The colours of the little people on a chat's value table (src/app/api/card/chart-figures.tsx).
 *
 * A cartoon is not drawn in the card's palette — skin, hair and a pair of trousers have no slot
 * in it — so these are its own, held here for the same reason as the rest: a drawing cannot
 * read a CSS variable. The navy, sand, olive and yellow on them are the palette's.
 */
export const FIGURE_COLORS = {
  skin: "#f3d2b3",
  hair: "#15181d",
  blush: "#f4a6a0",
  grey: "#9aa0ab",
  silver: "#eceef2",
  white: "#ffffff",
  edge: "#c3c6cd",
  suit: "#1f2b4d",
  denim: "#3b4f86",
  slacks: "#4d5563",
  trousers: "#5a5f6b",
  heel: "#7d3b4a",
  lips: "#b23a48",
} as const;

/**
 * The palette to draw this card in.
 *
 * A function rather than the constant itself, because this used to choose by plan code and
 * could again — a plan sold under a second brand would come back through here, and every
 * caller already asks rather than reaching for a value.
 */
export function cardPaletteFor(): CardPalette {
  return CARD_PALETTE;
}

/**
 * A short fingerprint of a card's palette and drawing revision, written into every card link.
 *
 * A card is cached by its address — an hour in the browser, a day at the edge — and the
 * palette is not part of the address, so re-colouring a plan leaves every card already
 * fetched serving the old colours until its cache expires. An agent who sent a quote
 * yesterday would keep getting yesterday's palette for a day after the change went out.
 *
 * Deriving the palette part from the colours keeps it current whenever the palette changes;
 * DRAWING_REVISION is bumped when the card's contents or layout change. The route
 * ignores the parameter: it is an address, not an instruction, and a card asked for under
 * any `v` is drawn in the palette the plan is currently sold under.
 *
 * It covers the colours only, which is what it is named for. Changing the drawing's *shape* —
 * a band's height, a new row — still serves stale pictures for up to a day.
 */
export function cardPaletteVersion(palette: CardPalette): string {
  const canonical = [
    palette.ground, palette.groundDeep, palette.accent, palette.figure, palette.ink,
    palette.mute, palette.hair, palette.rule, palette.glow, palette.stripe,
    palette.grid, palette.tint, palette.line.cash, palette.line.premium, palette.line.cover, palette.box,
  ].join("|");
  // FNV-1a: a few lines, no dependency, and the same answer in the browser and on the server —
  // the link is written in both. Math.imul keeps the multiply in 32 bits.
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** the owner's blue pen on the value table, beside the palette's red one (2026-10-11) */
export const BLUE_PEN = "#1f5fbf";

/** Bump when a card gains or removes visible content without changing its palette. */
const DRAWING_REVISION = "25";

/** The fingerprint of the palette and layout this card will be drawn in. */
export function cardVersionFor(): string {
  return `${cardPaletteVersion(cardPaletteFor())}-${DRAWING_REVISION}`;
}

/**
 * The content posters' themes (src/lib/content/poster.ts), drawn by the same library as the
 * quote card and so held here for the same reason: a drawing cannot read a CSS variable.
 * The first three are --bot-* tokens from globals.css; the other seventeen are the ad tones
 * the owner picked on 2026-09-24, for posters only. tests/content/poster-themes.test.ts
 * holds every theme's words to a readable contrast on both ends of its ground.
 */
export interface PosterColors {
  from: string;
  to: string;
  headline: string;
  sub: string;
  footer: string;
  badgeBg: string;
  badgeInk: string;
  /**
   * The wash laid over a poster's photograph on the side its words sit, as "r, g, b" —
   * Maryjane's scrim (poster-render.tsx), tinted to the theme: light words need the photo
   * darkened, dark words need it lightened. Null lays nothing over the photo (ภาพล้วน).
   */
  scrim: string | null;
  /** a shadow under the words, for a theme that has no wash to read them against */
  textShadow?: string;
}

export const POSTER_THEMES: Record<Theme, PosterColors> = {
  // --bot-navy → --bot-navy-deep, white words, sand accents
  navy: { from: "#022162", to: "#01143d", headline: "#ffffff", sub: "#dde3f0", footer: "#c6bc99", badgeBg: "#c6bc99", badgeInk: "#01143d", scrim: "1, 20, 61" },
  // --bot-sand-soft → --bot-sand, navy words
  sand: { from: "#e7e3d4", to: "#c6bc99", headline: "#022162", sub: "#15181d", footer: "#5f5436", badgeBg: "#022162", badgeInk: "#ffffff", scrim: "231, 227, 212" },
  // --bot-surface → --bot-band, navy words
  white: { from: "#ffffff", to: "#f2f2f2", headline: "#022162", sub: "#5b6472", footer: "#5f5436", badgeBg: "#022162", badgeInk: "#ffffff", scrim: "255, 255, 255" },
  noir: { from: "#1a1a1a", to: "#050505", headline: "#ffffff", sub: "#e5e5e5", footer: "#d4af37", badgeBg: "#d4af37", badgeInk: "#1a1a1a", scrim: "5, 5, 5" },
  champagne: { from: "#f7ecd0", to: "#e6c77a", headline: "#3b2a08", sub: "#5c4412", footer: "#5c4412", badgeBg: "#3b2a08", badgeInk: "#f7ecd0", scrim: "247, 236, 208" },
  emerald: { from: "#0f5132", to: "#0a3622", headline: "#ffffff", sub: "#d1f0e0", footer: "#f2c94c", badgeBg: "#f2c94c", badgeInk: "#0a3622", scrim: "10, 54, 34" },
  mint: { from: "#e6f7f0", to: "#b8ead6", headline: "#0b4d3b", sub: "#1f5f4c", footer: "#1f5f4c", badgeBg: "#0b4d3b", badgeInk: "#ffffff", scrim: "230, 247, 240" },
  sky: { from: "#e8f3ff", to: "#bcdcff", headline: "#0b3d91", sub: "#1e3a5f", footer: "#1e3a5f", badgeBg: "#0b3d91", badgeInk: "#ffffff", scrim: "232, 243, 255" },
  royal: { from: "#1d4ed8", to: "#1e3a8a", headline: "#ffffff", sub: "#dbeafe", footer: "#fbbf24", badgeBg: "#fbbf24", badgeInk: "#1e3a8a", scrim: "30, 58, 138" },
  violet: { from: "#4c1d95", to: "#2e1065", headline: "#ffffff", sub: "#ede9fe", footer: "#f5d0fe", badgeBg: "#f5d0fe", badgeInk: "#2e1065", scrim: "46, 16, 101" },
  lavender: { from: "#f3e8ff", to: "#ddd6fe", headline: "#4c1d95", sub: "#5b3a8c", footer: "#5b3a8c", badgeBg: "#4c1d95", badgeInk: "#ffffff", scrim: "243, 232, 255" },
  blush: { from: "#fde8ef", to: "#f9c5d5", headline: "#831843", sub: "#9d2a57", footer: "#9d2a57", badgeBg: "#831843", badgeInk: "#ffffff", scrim: "253, 232, 239" },
  red: { from: "#c81e1e", to: "#7f1d1d", headline: "#ffffff", sub: "#fee2e2", footer: "#fde047", badgeBg: "#fde047", badgeInk: "#7f1d1d", scrim: "127, 29, 29" },
  orange: { from: "#c2410c", to: "#9a3412", headline: "#ffffff", sub: "#ffedd5", footer: "#ffedd5", badgeBg: "#1f2937", badgeInk: "#ffffff", scrim: "154, 52, 18" },
  peach: { from: "#ffe4d6", to: "#ffc4a8", headline: "#7c2d12", sub: "#8a3b1c", footer: "#8a3b1c", badgeBg: "#7c2d12", badgeInk: "#ffffff", scrim: "255, 228, 214" },
  sunny: { from: "#fde68a", to: "#facc15", headline: "#1f2937", sub: "#374151", footer: "#374151", badgeBg: "#1f2937", badgeInk: "#fde68a", scrim: "253, 230, 138" },
  teal: { from: "#0f766e", to: "#134e4a", headline: "#ffffff", sub: "#ccfbf1", footer: "#fde68a", badgeBg: "#fde68a", badgeInk: "#134e4a", scrim: "19, 78, 74" },
  terracotta: { from: "#a3542f", to: "#6b2f1a", headline: "#ffffff", sub: "#f5e6c8", footer: "#f5e6c8", badgeBg: "#f5e6c8", badgeInk: "#6b2f1a", scrim: "107, 47, 26" },
  charcoal: { from: "#374151", to: "#111827", headline: "#ffffff", sub: "#e5e7eb", footer: "#93c5fd", badgeBg: "#93c5fd", badgeInk: "#111827", scrim: "17, 24, 39" },
  cream: { from: "#fffaf0", to: "#f5ecd9", headline: "#3f3f46", sub: "#52525b", footer: "#92400e", badgeBg: "#92400e", badgeInk: "#ffffff", scrim: "255, 250, 240" },
  // ภาพล้วน: white words on the photograph itself, held up by a shadow; a plain dark ground
  // until a photograph is drawn
  photo: {
    from: "#2b2b2b", to: "#111111", headline: "#ffffff", sub: "#f5f5f5", footer: "#ffffff", badgeBg: "#111111", badgeInk: "#ffffff",
    scrim: null, textShadow: "0 2px 14px rgba(0, 0, 0, 0.75), 0 1px 3px rgba(0, 0, 0, 0.9)",
  },
};

export function posterScrim(theme: Theme, layout: "top" | "center" | "bottom"): string {
  const c = POSTER_THEMES[theme].scrim;
  if (c === null) return "none";
  const a = (alpha: number) => `rgba(${c}, ${alpha})`;
  if (layout === "center") return `linear-gradient(180deg, ${a(0.25)} 0%, ${a(0.8)} 50%, ${a(0.25)} 100%)`;
  const toward = layout === "top" ? "180deg" : "0deg";
  return `linear-gradient(${toward}, ${a(0.85)} 0%, ${a(0.55)} 40%, ${a(0.05)} 100%)`;
}

/** The words laid on a clip, drawn at a fixed width like the posters; the "page" style takes POSTER_THEMES instead. */
export interface ClipStyleColors {
  boxBg: string | null;
  color: string;
  stroke: string | null;
  hookTopBg: string;
  hookTopInk: string;
  hookMainBg: string;
  hookMainInk: string;
}
export const CLIP_STYLE_COLORS: Record<"box" | "outline" | "yellow", ClipStyleColors> = {
  box: { boxBg: "rgba(0,0,0,0.62)", color: "#ffffff", stroke: null, hookTopBg: "#facc15", hookTopInk: "#111111", hookMainBg: "rgba(17,24,39,0.88)", hookMainInk: "#ffffff" },
  outline: { boxBg: null, color: "#ffffff", stroke: "6px #000000", hookTopBg: "#ffffff", hookTopInk: "#111111", hookMainBg: "rgba(0,0,0,0)", hookMainInk: "#ffffff" },
  yellow: { boxBg: "#facc15", color: "#111111", stroke: null, hookTopBg: "#111111", hookTopInk: "#facc15", hookMainBg: "#facc15", hookMainInk: "#111111" },
};

/**
 * The วิดีโอนำเสนอ clip's own colours (owner, 2026-10-11), beside the card palette it is drawn in:
 * the white of its ground and subtitle words, the yellow of the word being said, the paler navy
 * of the cover's second bar and the wash behind an agent with no photo.
 */
export const QUOTE_VIDEO_COLORS = {
  paper: "#ffffff",
  spoken: "#ffe14d",
  barAfter: "#4c6fbf",
  noPhoto: "#e9edf6",
  /* the Motion Graphic style (owner, 2026-10-11): a navy world, gold figures, sky shapes */
  motionNavy: "#022162",
  motionGold: "#ffd23f",
  motionSky: "#4c7fd6",
  motionRed: "#e5484d",
  motionGreen: "#1f9d55",
  /* the pen notes on the Motion chart (owner, 2026-10-13): the card's red and blue, lifted to read on navy */
  motionPen: "#ff6b6b",
  motionBluePen: "#8cc4ff",
  coinSide: "#e8b923",
  coinTop: "#ffe680",
} as const;

/**
 * คลิปเล่าเรื่อง's palette (owner, 2026-10-15, mockup https://claude.ai/artifact/FmDZmdTf6Mwgb2Dza8hQtM):
 * the paper the cartoon faces were brought to (public/story/faces), the pen's ink and red ring,
 * the coins, a note's paper, the agent's navy button, and the subtitle's spoken word.
 */
export const STORY_CLIP_COLORS = {
  paper: "#ece8df",
  ink: "#22252b",
  red: "#c2412d",
  coin: "#d6a63a",
  navy: "#022162",
  note: "#fbf8f0",
  jar: "#f6f2e9",
  white: "#ffffff",
  spoken: "#f2c75c",
  /* ความรู้ประกัน 1 นาที: the fact's stamp and a promise kept, and a belief's struck-out words */
  green: "#2f7d4f",
  struck: "#8b8c90",
  /* the phone around the form's preview */
  bezel: "#111317",
  /* หลังการขาย: the birthday cake's icing, and a Songkran bowl of water */
  cake: "#f3c9c0",
  water: "#cfe3ea",
  waterInk: "#3b7ea1",
} as const;

/**
 * วิดีโอนำเสนอ's themes (owner, 2026-10-17; src/lib/quote-video/themes.tsx repaints the navy drawing
 * in these). What each colour does: ink on the ground, accent for the figures and lines drawn, fill
 * a pill and onFill its words, card a white card and onCard its words, the subtitle's band and words.
 */
export interface VideoThemePalette {
  /** words on the ground, and the rgb its faint lines and muted words are made from */
  ink: string; inkRgb: string;
  /** the gold of the figures and the lines drawn */
  accent: string;
  /** a gold pill or band, and the words on it */
  fill: string; onFill: string;
  /** a white card, and the words on it */
  card: string; onCard: string; onCardRgb: string;
  second: string; red: string; green: string; pen: string; bluePen: string;
  /** the subtitle's band, its words and the word being said */
  subBg: string; subInk: string; subRgb: string; subAccent: string;
  /** the face every word is set in: Plex unless the theme has its own (renderPng loads it) */
  font?: "Mali" | "Sriracha";
  /** the ground under the drawing: a colour and its soft round shapes */
  ground: string; shapes: { color: string; opacity: number }[];
  /** a paper picture as the ground instead of the colour and shapes (public/collage, themes.tsx) */
  texture?: "paper-light";
  /** ไวท์บอร์ด: each piece written in left to right behind a marker, in place of its own entrance (motion.tsx El) */
  marker?: true;
}

export const VIDEO_THEME_COLORS = {
  paper: {
    ink: "#22252b", inkRgb: "34,37,43", accent: "#c2412d", fill: "#f2c75c", onFill: "#22252b",
    card: "#fbf8f0", onCard: "#22252b", onCardRgb: "34,37,43", second: "#d6a63a", red: "#c2412d", green: "#2f7d4f", pen: "#c2412d", bluePen: "#2f5fa8",
    subBg: "rgba(251,248,240,0.94)", subInk: "#22252b", subRgb: "34,37,43", subAccent: "#c2412d",
    font: "Mali", ground: "#ece8df", shapes: [{ color: "#e3ddd0", opacity: 0.8 }, { color: "#f3efe6", opacity: 0.8 }, { color: "#e3ddd0", opacity: 0.6 }, { color: "#f3efe6", opacity: 0.7 }],
    // the crumpled paper (owner chose ค, 2026-10-17)
    texture: "paper-light",
  },
  // ไวท์บอร์ด (owner, 2026-10-20): black and navy marker on a white board, the red pen for what to remember
  board: {
    ink: "#1a1a1a", inkRgb: "26,26,26", accent: "#022162", fill: "#fde68a", onFill: "#1a1a1a",
    card: "#ffffff", onCard: "#1a1a1a", onCardRgb: "26,26,26", second: "#7aa0d8", red: "#c2412d", green: "#2f7d4f", pen: "#c2412d", bluePen: "#022162",
    subBg: "rgba(26,26,26,0.85)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#fde68a",
    font: "Sriracha", ground: "#fbfbf8", shapes: [{ color: "#f1f2ee", opacity: 0.8 }, { color: "#ffffff", opacity: 0.9 }, { color: "#eef0ec", opacity: 0.6 }, { color: "#f6f7f3", opacity: 0.8 }],
    marker: true,
  },
} satisfies Record<string, VideoThemePalette>;

/**
 * ธีมเทศกาล (owner, 2026-10-20; quote-video/festival.ts): each festival's colours, the Motion Graphic
 * drawing repainted into them as a theme is (themes.tsx), over its own ground.
 */
const SHAPES = (a: string, b: string) => [{ color: a, opacity: 0.7 }, { color: b, opacity: 0.8 }, { color: a, opacity: 0.5 }, { color: b, opacity: 0.7 }];
export const VIDEO_FESTIVAL_COLORS = {
  // ปีใหม่: the navy night under gold fireworks
  newyear: {
    ink: "#ffffff", inkRgb: "255,255,255", accent: "#f2c75c", fill: "#f2c75c", onFill: "#01143d",
    card: "#ffffff", onCard: "#022162", onCardRgb: "2,33,98", second: "#9fc3ff", red: "#ff8a80", green: "#6ee7a8", pen: "#ff8a80", bluePen: "#9fc3ff",
    subBg: "rgba(0,0,0,0.45)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#f2c75c",
    ground: "#0a1a4a", shapes: SHAPES("#12266a", "#071238"),
  },
  // ตรุษจีน: red and gold, the lanterns'
  cny: {
    ink: "#ffffff", inkRgb: "255,255,255", accent: "#fde047", fill: "#fde047", onFill: "#7f1d1d",
    card: "#fff7e6", onCard: "#7f1d1d", onCardRgb: "127,29,29", second: "#fca5a5", red: "#ffd0c2", green: "#bbf7d0", pen: "#fde047", bluePen: "#fde68a",
    subBg: "rgba(60,0,0,0.55)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#fde047",
    ground: "#a51b1b", shapes: SHAPES("#b92525", "#8c1414"),
  },
  // สงกรานต์: water blue on light, flowers
  songkran: {
    ink: "#0b3d6b", inkRgb: "11,61,107", accent: "#0e7ac4", fill: "#0e7ac4", onFill: "#ffffff",
    card: "#ffffff", onCard: "#0b3d6b", onCardRgb: "11,61,107", second: "#7cc4ef", red: "#d64045", green: "#1f9d55", pen: "#e0457b", bluePen: "#0e7ac4",
    subBg: "rgba(11,61,107,0.88)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#ffd23f",
    ground: "#e3f3fc", shapes: SHAPES("#cbe8f8", "#f1f9fe"),
  },
  // วันแม่: a soft blue, jasmine falling
  mother: {
    ink: "#1e3a5f", inkRgb: "30,58,95", accent: "#2563eb", fill: "#2563eb", onFill: "#ffffff",
    card: "#ffffff", onCard: "#1e3a5f", onCardRgb: "30,58,95", second: "#93c5fd", red: "#d64045", green: "#1f9d55", pen: "#d64045", bluePen: "#2563eb",
    subBg: "rgba(30,58,95,0.88)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#ffd23f",
    ground: "#e8f1fb", shapes: SHAPES("#d6e6f8", "#f4f8fd"),
  },
  // ลอยกระทง: the full moon's night, candle gold
  loykrathong: {
    ink: "#ffffff", inkRgb: "255,255,255", accent: "#ffd27a", fill: "#ffd27a", onFill: "#0d1b3d",
    card: "#ffffff", onCard: "#0d1b3d", onCardRgb: "13,27,61", second: "#8fb3ff", red: "#ff8a80", green: "#7ee2a8", pen: "#ffb86b", bluePen: "#8fb3ff",
    subBg: "rgba(0,0,0,0.5)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#ffd27a",
    ground: "#0d1b3d", shapes: SHAPES("#152a5a", "#08122a"),
  },
  // วันพ่อ: yellow, the canna's
  father: {
    ink: "#3d2e00", inkRgb: "61,46,0", accent: "#a16207", fill: "#f5c400", onFill: "#3d2e00",
    card: "#ffffff", onCard: "#3d2e00", onCardRgb: "61,46,0", second: "#e0b84a", red: "#c2410c", green: "#3f7d20", pen: "#c2410c", bluePen: "#1d4ed8",
    subBg: "rgba(61,46,0,0.88)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#ffd84d",
    ground: "#fff6cf", shapes: SHAPES("#fdeba0", "#fffbe8"),
  },
} satisfies Record<string, VideoThemePalette>;

/** what each festival's decorations are drawn in (themes.tsx festivalLayer) */
export const FESTIVAL_DECOR = {
  gold: "#f2c75c", white: "#ffffff", lantern: "#ef4444", lanternGold: "#fde047", drop: "#3b7ea1", petal: "#f9a8d4",
  petalHeart: "#fde047", moon: "#fff3c4", leaf: "#2f7d4f", flame: "#ffb347", jasmine: "#ffffff", jasmineHeart: "#fde68a",
  canna: "#f5c400", cannaDeep: "#e09a00",
} as const;

/** ตัวหนังสือเด้ง (owner, 2026-10-20; quote-video/kinetic.tsx): the grounds the scenes take in turn, their words and figures */
export const KINETIC_COLORS = [
  { ground: "#111111", ink: "#ffffff", figure: "#facc15", soft: "rgba(255,255,255,0.6)" },
  { ground: "#facc15", ink: "#111111", figure: "#022162", soft: "rgba(17,17,17,0.6)" },
  { ground: "#022162", ink: "#ffffff", figure: "#f2c75c", soft: "rgba(255,255,255,0.6)" },
] as const;

/** แชทถาม-ตอบ (owner, 2026-10-20; quote-video/chat.tsx): a plain chat, nobody's brand */
export const CHAT_COLORS = {
  ground: "#eef1f6", head: "#022162", headInk: "#ffffff", online: "#4ade80", avatar: "#f5e6c8",
  mine: "#1f5bd6", mineInk: "#ffffff", theirs: "#ffffff", theirsInk: "#141a26", dots: "#9aa4b8", dotsMine: "#cfe0ff",
  mark: "#facc15", cardHead: "#022162", cardInk: "#141a26", rule: "#e5e7eb", mute: "#8a93a6", pen: "#c2412d", button: "#1f5bd6",
} as const;

/**
 * สีของฉัน (owner, 2026-10-20, idea 7 on https://claude.ai/artifact/MsvkeeeepPz4XG4TDvhN9n): the agent's own
 * colour for every clip, one of the quote cards' sets (POSTER_THEMES), made into a video palette.
 */
export const MY_COLORS = ["emerald", "royal", "violet", "red", "orange", "teal", "terracotta", "charcoal", "noir", "sky", "mint", "blush", "sunny", "champagne"] as const;
export type MyColor = (typeof MY_COLORS)[number];
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
export function myColorPalette(key: MyColor): VideoThemePalette {
  const c = POSTER_THEMES[key];
  const shapes = [{ color: c.to, opacity: 0.7 }, { color: c.from, opacity: 0.8 }, { color: c.to, opacity: 0.5 }, { color: c.from, opacity: 0.7 }];
  // white words on a dark set; the set's own dark words on a light one
  return c.headline === "#ffffff"
    ? {
      ink: "#ffffff", inkRgb: "255,255,255", accent: c.badgeBg, fill: c.badgeBg, onFill: c.badgeInk,
      card: "#ffffff", onCard: c.to, onCardRgb: rgbOf(c.to), second: c.sub, red: "#ff8a80", green: "#6ee7a8", pen: "#ff8a80", bluePen: c.sub,
      subBg: "rgba(0,0,0,0.45)", subInk: "#ffffff", subRgb: "255,255,255", subAccent: c.badgeBg, ground: c.from, shapes,
    }
    : {
      ink: c.headline, inkRgb: rgbOf(c.headline), accent: c.badgeBg, fill: c.badgeBg, onFill: c.badgeInk,
      card: "#ffffff", onCard: c.headline, onCardRgb: rgbOf(c.headline), second: c.sub, red: "#d64045", green: "#1f9d55", pen: "#d64045", bluePen: c.headline,
      subBg: `rgba(${rgbOf(c.headline)},0.88)`, subInk: "#ffffff", subRgb: "255,255,255", subAccent: "#ffd23f", ground: c.from, shapes,
    };
}

/** the rest a theme draws in: the hand-drawn faces' rings, and each theme's chip in the form */
export const VIDEO_THEME_EXTRA = {
  paperFaceRing: "#22252b",
  swatch: { navy: "#022162", paper: "#ece8df", festival: "#e0457b", kinetic: "#facc15", board: "#fbfbf8", mine: "#0f5132" },
  /** ไวท์บอร์ด's marker: its body, cap band and tip */
  marker: { body: "#022162", band: "#c2412d", tip: "#1a1a1a" },
} as const;
