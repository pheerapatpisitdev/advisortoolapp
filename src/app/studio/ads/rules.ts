/**
 * The numbers Ads Studio's browser code needs from src/lib/content/ads.ts, handed down by the
 * pages as a prop so the writer's prompts in that file stay on the server.
 */
export interface AdRules {
  /** AD_LIMITS: where Facebook folds the primary text, and the headline's and description's lengths */
  limits: { fold: number; headline: number; description: number };
}
