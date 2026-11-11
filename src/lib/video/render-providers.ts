/**
 * The video render services whose keys are kept beside the AI keys. A plain module, not
 * actions.ts: a "use server" file may export only async functions, and the page imports this.
 * "gcp" (a Google service account, region and job) feeds "cloudrun". Rendi, AWS Lambda and
 * Shotstack were removed 2026-11-11 (owner).
 */
export const RENDER_PROVIDERS = ["gcp"] as const;
export type RenderProvider = (typeof RENDER_PROVIDERS)[number];
