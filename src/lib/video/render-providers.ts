/**
 * The video render services whose keys are kept beside the AI keys. A plain module, not
 * actions.ts: a "use server" file may export only async functions, and the page imports this.
 * "aws" is the key's name; the engine it feeds is called "lambda". "gcp" (a Google service
 * account, region and job) feeds "cloudrun".
 */
export const RENDER_PROVIDERS = ["rendi", "aws", "gcp"] as const;
export type RenderProvider = (typeof RENDER_PROVIDERS)[number];
