import { DISCLAIMER } from "@/lib/content/output";
import { numbersIn } from "@/lib/quote-video/brief";
import { quoteBasis, type PostBasis } from "@/lib/quote-video/post-text";
import type { QuoteVideoFacts } from "@/lib/quote-video/script";
import type { AdPlan } from "./keys";

/**
 * The words posted with an ad clip (owner, 2026-11-22): the clip's own voice lines (hook, a tick on each
 * body, the closing) so the post says what the clip says, then the disclaimer the last scene shows. A plain
 * module: quote-video/actions.ts is a "use server" file and may export only async functions.
 */
export function adCaption(plan: AdPlan): string {
  return [plan.hook.voice, ...plan.body.map((b) => `✓ ${b.voice}`), plan.cta.voice, "", DISCLAIMER].join("\n");
}

/**
 * What the AI writes a post from, for an ad clip: the quote's own facts plus the lines the clip says, so the
 * post follows the clip. The figures the clip said are allowed too (they were checked against the quote).
 */
export function adBasis(f: QuoteVideoFacts, plan: AdPlan): PostBasis {
  const base = quoteBasis(f, "");
  const said = [plan.hook.voice, ...plan.body.map((b) => b.voice), plan.cta.voice];
  const allowed = new Set(base.allowed);
  for (const line of said) for (const n of numbersIn(line)) allowed.add(n);
  return { ...base, facts: [...base.facts, ...said.map((l) => `ในคลิปพูดว่า: ${l}`)], allowed, about: `คลิปโฆษณาแบบประกัน ${f.planLine}` };
}
