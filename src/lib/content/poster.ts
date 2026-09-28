/**
 * A post's poster, as data: which lines, of which kind, laid where, on which colours.
 *
 * The design is the owner's Maryjane project's (src/lib/poster-spec.ts and poster-render.tsx):
 * four kinds of line — a small badge, the headline, a supporting line, a footer — stacked at the
 * top, middle or bottom of the canvas. What changes is who picks the colours. Maryjane lets the
 * model choose hex values; this site has one palette and a test that guards it, so the model
 * chooses words and a layout, and the colours come from three themes drawn from that palette.
 *
 * Nothing here touches the server, so the page can build, edit and encode a poster in the
 * browser and the drawing route can decode the same thing.
 */

import { toLogo, type PosterLogo } from "./logo";

export const BLOCK_KINDS = ["badge", "headline", "sub", "footer"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const LAYOUTS = ["top", "center", "bottom"] as const;
export type Layout = (typeof LAYOUTS)[number];

/**
 * The brand's three first, then seventeen tones popular in advertising the owner picked on
 * 2026-09-24 — for content posters only; the sales pages and quote cards stay on the brand.
 */
export const THEMES = [
  "navy", "sand", "white",
  "noir", "champagne", "emerald", "mint", "sky", "royal", "violet", "lavender",
  "blush", "red", "orange", "peach", "sunny", "teal", "terracotta", "charcoal", "cream",
  // ภาพล้วน (owner, 2026-09-25): the photograph and the words, nothing laid between them
  "photo",
] as const;
export type Theme = (typeof THEMES)[number];

export interface PosterBlock {
  kind: BlockKind;
  text: string;
}

export interface PosterSpec {
  layout: Layout;
  theme: Theme;
  blocks: PosterBlock[];
  /** a picture behind the words: a path in the content-media bucket, "<piece id>/<file id>.<ext>" */
  background?: string;
  /**
   * รีวิวเคลม: the owner's claim papers, stickered and checked, drawn as a small pile of cards
   * under the words — one to MAX_PAPERS. Same path shape as a background; ratio is width over height.
   */
  documents?: PosterDocument[];
  /**
   * รีวิวเคลม with a person from the library in the photograph: they stand in its right third,
   * so the papers keep to the left and leave them in sight.
   */
  personAside?: boolean;
  /** the Page's logo and where it sits (logo.ts) */
  logo?: PosterLogo;
}

/** papers on one claim poster: more and each is too small to read */
export const MAX_PAPERS = 3;

export interface PosterDocument {
  path: string;
  ratio: number;
}

/** the only shape a background may have; anything else could point the drawing route elsewhere */
const BACKGROUND_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpe?g|webp)$/;
export const isBackgroundPath = (v: unknown): v is string => typeof v === "string" && BACKGROUND_PATH.test(v);

/**
 * A poster's papers, kept only when each is one; a poster from before there could be several
 * carried one as `document`, and is read as a list of that one.
 */
function documentsOf(raw: Record<string, unknown>): { documents?: PosterDocument[] } {
  const list = Array.isArray(raw.documents) ? raw.documents : raw.document ? [raw.document] : [];
  const documents = list.map(toDocument).filter((d): d is PosterDocument => d !== null).slice(0, MAX_PAPERS);
  return documents.length ? { documents } : {};
}

/** a paper's width over its height, as a real one could be: a claims table screenshot runs to 5 or more */
export const okRatio = (r: unknown): r is number => typeof r === "number" && Number.isFinite(r) && r >= 0.15 && r <= 8;

/** a document from anywhere, or null: a path of the one allowed shape and a ratio a paper could have */
export function toDocument(v: unknown): PosterDocument | null {
  if (!v || typeof v !== "object") return null;
  const { path, ratio } = v as Record<string, unknown>;
  if (!isBackgroundPath(path) || !okRatio(ratio)) return null;
  return { path, ratio };
}

export const BLOCK_LABEL: Record<BlockKind, string> = {
  badge: "ป้ายเล็ก",
  headline: "พาดหัว",
  sub: "ข้อความรอง",
  footer: "ท้ายภาพ",
};
export const LAYOUT_LABEL: Record<Layout, string> = { top: "บน", center: "กลาง", bottom: "ล่าง" };
/**
 * What each theme suits, as the writers are told it when the owner leaves the colour to them
 * (ให้ AI เลือก, 2026-09-25). Short, and about the story rather than the colour.
 */
export const THEME_MOOD: Record<Theme, string> = {
  navy: "น่าเชื่อถือ มั่นคง ใช้ได้ทุกเรื่อง", sand: "อบอุ่น สุภาพ", white: "สะอาด เรียบง่าย",
  noir: "หรูหรา พรีเมียม มรดก ทุนสูง", champagne: "หรู นุ่มนวล ของขวัญ", emerald: "สุขภาพ การเติบโต ความมั่นคง",
  mint: "สดชื่น สุขภาพดี", sky: "ไว้ใจได้ สบายใจ", royal: "มั่นใจ ทันสมัย", violet: "พรีเมียม ลึกซึ้ง",
  lavender: "อ่อนโยน ผู้หญิง", blush: "ครอบครัว ลูก ความรัก", red: "เร่งด่วน เตือนให้ระวัง กระตุ้นให้ลงมือ",
  orange: "พลังงาน ชวนลงมือ", peach: "อบอุ่น ครอบครัว", sunny: "สดใส ดึงสายตา ตัวเลขเด่น",
  teal: "สุขภาพ การรักษา สงบ", terracotta: "ธรรมชาติ อบอุ่น วัยเกษียณ", charcoal: "ทันสมัย จริงจัง คนทำงาน",
  cream: "มินิมอล เรียบหรู",
  photo: "ไม่มีเฉดสีทับภาพ ให้ภาพเล่าเรื่องเอง เหมาะเมื่อฉากสวยและเรียบพอให้ตัวอักษรขาวอ่านออก",
};

export const THEME_LABEL: Record<Theme, string> = {
  navy: "น้ำเงินกรมท่า", sand: "ทราย", white: "ขาว",
  noir: "ดำหรู + ทอง", champagne: "แชมเปญทอง", emerald: "เขียวมรกต", mint: "เขียวมิ้นต์",
  sky: "ฟ้าน่าเชื่อถือ", royal: "น้ำเงินรอยัล", violet: "ม่วงพรีเมียม", lavender: "ลาเวนเดอร์",
  blush: "ชมพูพาสเทล", red: "แดงพลัง", orange: "ส้มพลังงาน", peach: "พีชอบอุ่น",
  sunny: "เหลืองสดใส", teal: "เทอร์ควอยซ์", terracotta: "เอิร์ธโทน", charcoal: "เทาโมเดิร์น", cream: "ครีมมินิมอล",
  photo: "ภาพล้วน (ไม่มีเฉดสี)",
};

/** how long each kind of line may be — a poster is read in a second, not studied */
export const MAX_CHARS: Record<BlockKind, number> = { badge: 24, headline: 70, sub: 110, footer: 50 };
const MAX_BLOCKS = 5;

// the themes' colours are in src/lib/card-theme.ts (POSTER_THEMES), beside the quote card's
// palette: the one file a drawing's hex values are allowed to live in

export const SIZES = {
  square: { width: 1080, height: 1080, label: "โพสต์ 1:1" },
  portrait: { width: 1080, height: 1350, label: "ฟีด 4:5" },
  story: { width: 1080, height: 1920, label: "สตอรี่ 9:16" },
} as const;
export type SizeId = keyof typeof SIZES;
export const isSizeId = (v: unknown): v is SizeId => typeof v === "string" && v in SIZES;

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("th", { granularity: "word" })
  : null;

/**
 * A line cut to fit, at a word and with an ellipsis — "ทั้งแบ" is what cutting by character
 * did to a long hook, and a poster that stops mid-word looks broken rather than short.
 */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if ([...t].length <= max) return t;
  if (!segmenter) return [...t].slice(0, max - 1).join("") + "…";
  let out = "";
  for (const { segment } of segmenter.segment(t)) {
    if ([...out].length + [...segment].length > max - 1) break;
    out += segment;
  }
  return (out.trim() || [...t].slice(0, max - 1).join("")) + "…";
}

/**
 * A poster from whatever came in, repaired where it can be and refused where it cannot —
 * Maryjane's rule. A missing layout or theme is a default; an unknown kind of line is dropped;
 * a poster with no headline is not a poster.
 */
export function parsePoster(input: unknown): PosterSpec | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).flatMap((b): PosterBlock[] => {
    if (!b || typeof b !== "object") return [];
    const r = b as Record<string, unknown>;
    const kind = r.kind as BlockKind;
    if (!BLOCK_KINDS.includes(kind)) return [];
    const text = typeof r.text === "string" ? clip(r.text, MAX_CHARS[kind]) : "";
    return text ? [{ kind, text }] : [];
  }).slice(0, MAX_BLOCKS);
  if (!blocks.some((b) => b.kind === "headline")) return null;
  return {
    layout: LAYOUTS.includes(raw.layout as Layout) ? (raw.layout as Layout) : "bottom",
    theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : "navy",
    blocks,
    ...(isBackgroundPath(raw.background) ? { background: raw.background } : {}),
    ...documentsOf(raw),
    ...(raw.personAside === true ? { personAside: true } : {}),
    ...(toLogo(raw.logo) ? { logo: toLogo(raw.logo)! } : {}),
  };
}

/** For a piece written before posters: its hook as the headline, under the product's name. */
export function defaultPoster(hook: string, productName: string): PosterSpec {
  const blocks: PosterBlock[] = [];
  const badge = clip(productName.replace(/\s*\(.*\)\s*$/, ""), MAX_CHARS.badge);
  if (badge) blocks.push({ kind: "badge", text: badge });
  blocks.push({ kind: "headline", text: clip(hook || productName, MAX_CHARS.headline) });
  blocks.push({ kind: "footer", text: "ทักแชทสอบถามได้เลย" });
  return { layout: "bottom", theme: "navy", blocks };
}

/** The poster as the words the checks read — its figures are claims like any other. */
export function posterText(p: PosterSpec | undefined): string {
  return p ? p.blocks.map((b) => b.text).join("\n") : "";
}

/* -------- carried in a URL, so an <img> can draw it and a link can download it -------- */

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodePoster(p: PosterSpec): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(p)));
}

export function decodePoster(s: string): PosterSpec | null {
  try {
    return parsePoster(JSON.parse(new TextDecoder().decode(fromBase64Url(s))));
  } catch {
    return null;
  }
}

export function posterUrl(p: PosterSpec, size: SizeId = "square", download = false): string {
  return `/api/content-poster?s=${encodePoster(p)}&size=${size}${download ? "&download=1" : ""}`;
}
