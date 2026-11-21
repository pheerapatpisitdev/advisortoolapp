/**
 * วิดีโอโฆษณา keys and the plan shape, client-safe: only `import type` from the quote-video files, so the
 * form can import this without pulling the script or drawing code. Owner chose ก ×6 on the mockup, 2026-11-22.
 */
import type { SceneKey } from "@/lib/quote-video/script";

export type AdProduct = "LIFEPROTECT" | "ISHIELD" | "IHEALTHY";
export const AD_PRODUCTS: AdProduct[] = ["LIFEPROTECT", "ISHIELD", "IHEALTHY"];

/** The middle scenes an ad can carry; each is also a quote-video scene key. */
export type AdBodyKey = Extract<SceneKey, "price" | "cover" | "value" | "versus">;
export type AdCtaKey = "chat" | "line" | "comment" | "nextyear" | "meet";
/** The five written openers plus `own`, the agent's own line. */
export type AdHookKind = "question" | "shock" | "myth" | "story" | "list" | "own";

/** ก motion only, ข photos on every scene, ค photos on the first and last scene only (default). */
export type AdArt = "motion" | "photo" | "mixed";
export const DEFAULT_ART: AdArt = "mixed";

export const BODY_NAMES: Record<AdBodyKey, string> = {
  price: "ราคา",
  cover: "ความคุ้มครอง",
  value: "เงินไม่หาย",
  versus: "เทียบเก็บเงินเอง",
};

export const CTA_NAMES: Record<AdCtaKey, string> = {
  chat: "ทักแชทขอใบเสนอ",
  line: "แอด LINE",
  comment: "คอมเมนต์ “สนใจ”",
  nextyear: "รอปีหน้าเบี้ยขึ้น",
  meet: "นัดคุย 15 นาที",
};

/** iShield's cover scene lists 70 illnesses, so the picker says so instead of the generic name. */
export const bodyName = (key: AdBodyKey, product: AdProduct): string =>
  key === "cover" && product === "ISHIELD" ? "70 โรค" : BODY_NAMES[key];

export interface AdPlan {
  mode: "ai" | "pick";
  hook: { kind: AdHookKind; voice: string; headline: string[] };
  body: { key: AdBodyKey; voice: string }[];
  cta: { key: AdCtaKey; voice: string };
  photos: { hook?: string; close?: string; body?: string[] };
  art: AdArt;
  brief?: string;
  written: boolean;
  model?: string;
}

/** One flag per scene in order: lead, bodies…, contact. */
export function photoScenes(art: AdArt, bodies: number): boolean[] {
  const count = bodies + 2;
  return Array.from({ length: count }, (_, i) => art === "photo" || (art === "mixed" && (i === 0 || i === count - 1)));
}

export const readArt = (v: unknown): AdArt => (v === "motion" || v === "photo" || v === "mixed" ? v : DEFAULT_ART);
