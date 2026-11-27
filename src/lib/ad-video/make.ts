/**
 * วิดีโอโฆษณา made as a วิดีโอนำเสนอ clip (owner chose ก ×6 on the mockup, 2026-11-22): an ad is a Motion quote clip
 * whose input carries its plan (`input.ad`). These are the plan's lines, its scenes and its price; the clip pipeline
 * (quote-video/make.ts) calls them in place of the standing clip's, and draws the photos the plan asks for.
 */
import { pictureSatang, type Prices } from "@/lib/wallet/prices";
import type { ClipParts } from "@/lib/quote-video/make";
import type { Contact } from "@/lib/quote-video/draw";
import { motionWindows, MOTION_FPS } from "@/lib/quote-video/motion";
import { productOf, spokenBy, type QuoteVideoFacts, type SceneKey, type VideoInput } from "@/lib/quote-video/script";
import { readTheme } from "@/lib/quote-video/theme-keys";
import { planScenes } from "@/lib/quote-video/timeline";
import { extraOf } from "@/lib/quote-video/told";
import { photoScenes, readArt, type AdPlan, type AdProduct } from "./keys";
import { fixedPhoto } from "./plan";
import { AD_PAINTER } from "./photo";

/** the plan's lines in scene order: the hook on the lead, each body on its own scene, the closing on the contact card */
export function adScript(f: QuoteVideoFacts, plan: AdPlan, narrator: "F" | "M"): { key: SceneKey; voice: string }[] {
  void f; // every line was held to these facts when the plan was cleaned (plan.ts cleanAdPlan)
  return [
    { key: "lead", voice: spokenBy(plan.hook.voice, narrator) },
    ...plan.body.map((b) => ({ key: b.key as SceneKey, voice: spokenBy(b.voice, narrator) })),
    { key: "contact", voice: spokenBy(plan.cta.voice, narrator) },
  ];
}

/**
 * The closing words as the screen shows them above the contact card: the voice without its polite ending, also
 * when punctuation follows it ("…ไหมคะ?" shows "…ไหม?"). A question or exclamation mark stays; a trailing
 * full stop, comma or ellipsis goes with the ending.
 */
export const adCta = (voice: string): string =>
  voice.trim().replace(/\s*(นะคะ|นะครับ|ค่ะ|คะ|ครับ)\s*([?!？！]*)[\s.,…]*$/, "$2");

/** one photo's price: the painter's, or Gemini's own key should the painter list ever drop it (R4) */
export const adPhotoSatang = (prices: Prices): number => pictureSatang(prices, AD_PAINTER) ?? prices.drawGemini;

/**
 * the photos alone: what a free clip still holds, since a free clip covers the Motion clip only and its photos are
 * paid from the wallet as a คลิปตามโจทย์'s pictures are (R11, 2026-11-22)
 */
export function adPhotosPrice(v: VideoInput & { ad: AdPlan }, prices: Prices): number {
  return photoScenes(readArt(v.ad.art), v.ad.body.length).filter(Boolean).length * adPhotoSatang(prices);
}

/** what an ad clip costs: the Motion clip, an ElevenLabs voice on top, and every photo its art draws */
export function adPrice(v: VideoInput & { ad: AdPlan }, prices: Prices): number {
  return prices.videoMotion + (v.voice ? prices.elevenExtra : 0) + adPhotosPrice(v, prices);
}

/**
 * What each scene's photo is drawn from, in scene order (lead, bodies…, contact): null for a scene its art draws
 * without one. An idea the plan does not hold is the product's fixed one (plan.ts fixedPhoto).
 */
export function adPhotoIdeas(v: VideoInput & { ad: AdPlan }): ({ idea: string; scene: "hook" | "body" | "close" } | null)[] {
  const plan = v.ad;
  const product = productOf(v) as AdProduct;
  const flags = photoScenes(readArt(plan.art), plan.body.length);
  return flags.map((on, i) => {
    if (!on) return null;
    const scene = i === 0 ? "hook" : i === flags.length - 1 ? "close" : "body";
    const idea = scene === "hook" ? plan.photos.hook : scene === "close" ? plan.photos.close : plan.photos.body?.[i - 1];
    return { idea: idea?.trim() || fixedPhoto(product, scene), scene };
  });
}

/** an ad is drawn in ไวท์บอร์ด or แบบเดิม only (globals): any other look asked for, a festival's too, is ไวท์บอร์ด */
export const adTheme = (v: unknown): "board" | "navy" => (readTheme(v) === "navy" ? "navy" : "board");

/**
 * An ad clip's parts: always portrait Motion, the plan's lines on the standing clip's scenes (so each moves as it
 * does there), no customer's name, the hook's headline on screen, and none of the loop, piggy jar, road of life or
 * recipe. `ad` carries each scene's photo as filed (null where there is none) and the closing words.
 */
export function adParts(
  f: QuoteVideoFacts, input: VideoInput, plan: AdPlan, contact: Contact, narrator: "F" | "M", secs: number[],
): ClipParts {
  const script = adScript(f, plan, narrator);
  if (secs.length !== script.length) throw new Error("voice lengths do not match the script");
  const plans = planScenes(script.map((s, i) => ({
    key: s.key, voice: s.voice, voiceSec: secs[i], windows: motionWindows(s.key, f, secs[i], s.voice), fps: MOTION_FPS,
  })));
  return {
    size: "portrait", script, motion: true, plans,
    motion$: {
      // an ad is only ever of a plan priced for a person (keys.ts AD_PRODUCTS): its facts carry the sex
      theme: adTheme(input.theme), sex: f.sex ?? "F", facts: f, customer: "", narrator, contact,
      shown: { headline: plan.hook.headline, loop: false, extra: extraOf(f, {}) },
      ad: { photos: script.map((_, i) => input.pictures?.[i] ?? null), cta: adCta(plan.cta.voice) },
    },
  };
}
