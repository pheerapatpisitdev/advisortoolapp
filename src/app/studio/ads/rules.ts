/**
 * The numbers Ads Studio's browser code needs from src/lib/content/ads.ts, handed down by the
 * pages as a prop so the writer's prompts in that file stay on the server.
 */
export interface AdRules {
  /** the most selling angles and tones one round writes (MAX_ANGLES, MAX_TONES) */
  maxAngles: number;
  maxTones: number;
  /** AD_LIMITS: where Facebook folds the primary text, and the headline's and description's lengths */
  limits: { fold: number; headline: number; description: number };
}

/** the numbers 1..n, for a row of chips */
export const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
