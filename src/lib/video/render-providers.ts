/**
 * The video render services whose keys are kept beside the AI keys. A plain module, not
 * actions.ts: a "use server" file may export only async functions, and the page imports this.
 * "aws" is the key's name; the engine it feeds is called "lambda". "gcp" (a Google service
 * account, region and job) feeds "cloudrun". "shotstack" (owner, 2026-10-21) puts together the
 * ดีไซน์พิเศษ look of a คลิปตามโจทย์ (src/lib/shotstack), a Production or a Sandbox key.
 */
export const RENDER_PROVIDERS = ["rendi", "aws", "gcp", "shotstack"] as const;
export type RenderProvider = (typeof RENDER_PROVIDERS)[number];
