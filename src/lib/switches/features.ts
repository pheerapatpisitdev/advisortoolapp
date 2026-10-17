/**
 * เปิด-ปิดฟังก์ชันชั่วคราว (owner chose ก ก ก, 2026-10-17; mockup
 * https://claude.ai/artifact/QHYvw2p19iTuj9LcnxWge7): the tools the Super Admin can switch off
 * while something they need is down — that day, Google's voice was used up and the ElevenLabs
 * key refused, so every clip failed at its voice. Switched off, a tool starts nothing new and
 * charges nothing; what is under way finishes and what was made stays to be seen. The owner and
 * the Super Admin go on using it, to try it before it is switched back on.
 *
 * `hrefs`: the menu items marked ปิดชั่วคราว while it is off. Ads Studio and คลิปตามโจทย์ are the
 * owner's alone today, so for now their switches only mark the menu and the page.
 */
export const FEATURES = [
  { key: "quote-video", label: "วิดีโอนำเสนอ", note: "รวมสรุป FHC", hrefs: ["/studio/quote-video"] },
  { key: "story-clip", label: "คลิปเล่าเรื่อง", hrefs: ["/studio/story-clip"] },
  { key: "prompt-story", label: "คลิปตามโจทย์", note: "ตอนนี้เปิดให้เจ้าของคนเดียว", hrefs: ["/studio/prompt-story"] },
  { key: "write", label: "Organic Studio", note: "เขียนโพสต์และวาดภาพโพสต์", hrefs: ["/studio/write"] },
  { key: "thumbnail", label: "ภาพปกคลิป", hrefs: ["/studio/thumbnail"] },
  { key: "describe", label: "ถอดรูปเป็น prompt", hrefs: ["/studio/describe"] },
  { key: "ads", label: "Ads Studio", note: "ตอนนี้เปิดให้เจ้าของคนเดียว", hrefs: ["/studio/ads"] },
  { key: "ask", label: "ถาม AI", note: "แชทในแอป /ask", hrefs: ["/ask"] },
] as const satisfies readonly { key: string; label: string; note?: string; hrefs: readonly string[] }[];

export type FeatureKey = (typeof FEATURES)[number]["key"];

export const DEFAULT_CLOSED = "ปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก";
export const MESSAGE_MAX = 200;

/** one tool's switch: `at` is when it was last flipped */
export interface Switch { off: boolean; message: string; at: string | null }
export type Switches = Record<FeatureKey, Switch>;

export const isFeature = (k: unknown): k is FeatureKey => typeof k === "string" && FEATURES.some((f) => f.key === k);

/** the words a user is shown: the Super Admin's, trimmed to one short line, or the default */
export function cleanMessage(raw: unknown): string {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX) : "";
  return text || DEFAULT_CLOSED;
}

/** What was stored, read as every tool's switch: anything not readable is on. */
export function cleanSwitches(raw: unknown): Switches {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as Switches;
  for (const f of FEATURES) {
    const s = stored[f.key] && typeof stored[f.key] === "object" ? (stored[f.key] as Record<string, unknown>) : {};
    out[f.key] = { off: s.off === true, message: cleanMessage(s.message), at: typeof s.at === "string" ? s.at : null };
  }
  return out;
}

/** the menu items of every tool switched off */
export const closedHrefs = (s: Switches): string[] => FEATURES.filter((f) => s[f.key].off).flatMap((f) => [...f.hrefs]);
