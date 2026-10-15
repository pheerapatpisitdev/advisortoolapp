import { OVERHEAD_THB, PAINTERS } from "@/lib/content/models";

/**
 * The fixed prices an agent pays from the wallet, set by the owner on /admin/wallet
 * (owner, 2026-10-12: "ให้ผมตั้งราคาไปเลย"). In satang, not times the multiplier: the price is
 * the price. Pictures, reading a picture into a prompt and the วิดีโอนำเสนอ clips are priced
 * here; the writing rounds and clip editing are still their cost times the multiplier.
 *
 * Browser-safe: the wallet page and the pickers show these, the server charges them.
 */

export type PriceKey =
  | "drawStandard" | "drawSharp" | "drawGemini" | "describe"
  | "videoClassic" | "videoMotion" | "videoFhc" | "elevenExtra"
  /** the longer clips (owner, 2026-10-13): ~90 seconds and ~2 minutes, in each look */
  | "videoLongClassic" | "videoLongMotion" | "videoMaxClassic" | "videoMaxMotion"
  /** คลิปเล่าเรื่อง (owner, 2026-10-15): priced as the classic clip until the owner sets its own */
  | "videoStory";

export type Prices = Record<PriceKey, number>;

/** the owner's prices of 2026-10-12, used until the owner saves others and when they cannot be read */
export const DEFAULT_PRICES: Prices = {
  drawStandard: 100,
  drawSharp: 200,
  drawGemini: 500,
  describe: 100,
  videoClassic: 500,
  videoMotion: 1000,
  videoFhc: 300,
  elevenExtra: 200,
  // the owner's yes to the plan of 2026-10-13: ฿8 / ฿15 for ~90 s, ฿10 / ฿20 for ~2 min
  videoLongClassic: 800,
  videoLongMotion: 1500,
  videoMaxClassic: 1000,
  videoMaxMotion: 2000,
  videoStory: 500,
};

const paint = (id: string): number => (PAINTERS.find((p) => p.id === id)?.thb ?? 0) + OVERHEAD_THB;

export type PriceGroup = "video" | "picture";

/**
 * Each price as the owner sets it and an agent reads it. `costThb` is what one costs the
 * providers, about, so the owner's table can say when a price is under it: a picture is its
 * painter's measured price and the prompt's translation; a read, two measured reads of
 * ฿0.27 and ฿0.30 (2026-10-08); a clip, its Cloud Run run (make.ts RENDER_COST_THB) and voice;
 * an ElevenLabs voice, a clip's characters on the Starter plan (2026-10-11).
 */
export const PRICE_ITEMS: { key: PriceKey; group: PriceGroup; label: string; unit: string; costThb: number; extra?: true }[] = [
  { key: "videoClassic", group: "video", label: "วิดีโอแบบปกติ (รวมคลิปสั้น 15 วินาที)", unit: "คลิป", costThb: 0.4 },
  { key: "videoMotion", group: "video", label: "วิดีโอ Motion Graphic", unit: "คลิป", costThb: 0.4 },
  { key: "videoLongClassic", group: "video", label: "วิดีโอแบบปกติ ยาว ~90 วินาที", unit: "คลิป", costThb: 0.7 },
  { key: "videoLongMotion", group: "video", label: "วิดีโอ Motion Graphic ยาว ~90 วินาที", unit: "คลิป", costThb: 0.8 },
  { key: "videoMaxClassic", group: "video", label: "วิดีโอแบบปกติ 2 นาที", unit: "คลิป", costThb: 0.9 },
  { key: "videoMaxMotion", group: "video", label: "วิดีโอ Motion Graphic 2 นาที", unit: "คลิป", costThb: 1.1 },
  { key: "videoFhc", group: "video", label: "วิดีโอสรุป FHC", unit: "คลิป", costThb: 0.4 },
  { key: "videoStory", group: "video", label: "คลิปเล่าเรื่อง", unit: "คลิป", costThb: 0.4 },
  { key: "elevenExtra", group: "video", label: "เสียง ElevenLabs (บวกเพิ่มต่อคลิป)", unit: "คลิป", costThb: 1, extra: true },
  { key: "drawStandard", group: "picture", label: "วาดรูป มาตรฐาน", unit: "รูป", costThb: paint("standard") },
  { key: "drawSharp", group: "picture", label: "วาดรูป คมชัด", unit: "รูป", costThb: paint("sharp") },
  { key: "drawGemini", group: "picture", label: "วาดรูป Gemini (ใช้อัตโนมัติเมื่อใส่รูปคนจริง)", unit: "รูป", costThb: paint("gemini") },
  { key: "describe", group: "picture", label: "ถอดรูปเป็นพรอมต์", unit: "ครั้ง", costThb: 0.3 },
];

/** the highest price the owner may set, in satang: ฿1,000 */
export const MAX_PRICE_SATANG = 100_000;

const valid = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 1 && v <= MAX_PRICE_SATANG;

/** what was stored, each price checked; a missing or broken one is the default */
export function cleanPrices(raw: unknown): Prices {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_PRICES };
  for (const key of Object.keys(DEFAULT_PRICES) as PriceKey[]) if (valid(stored[key])) out[key] = stored[key];
  return out;
}

const PICTURE: Record<string, PriceKey> = { standard: "drawStandard", sharp: "drawSharp", gemini: "drawGemini" };

/** a painter's picture price in satang; null for "none", which draws nothing */
export function pictureSatang(prices: Prices, painterId: string): number | null {
  const key = PICTURE[painterId];
  return key ? prices[key] : null;
}

/** "1", "1.50": baht as a price list writes it, no satang when there are none */
export function priceBaht(satang: number): string {
  const baht = satang / 100;
  return Number.isInteger(baht) ? baht.toLocaleString("en-US") : baht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The price key of a quote clip of this look and length (owner, 2026-10-13): the 15-second and the
 * ~50-second clips share their look's price, the longer two have their own.
 */
export function videoPriceKey(style: "classic" | "motion", length: "short" | "full" | "long" | "max"): PriceKey {
  if (length === "long") return style === "motion" ? "videoLongMotion" : "videoLongClassic";
  if (length === "max") return style === "motion" ? "videoMaxMotion" : "videoMaxClassic";
  return style === "motion" ? "videoMotion" : "videoClassic";
}
