import { findWords, strayNumbers, type ContentWord } from "./check";
import type { ModeChecks } from "./mode-checks";
import type { ContentOutput, Lang } from "./output";
import { checkPolicy } from "./policy";
import { posterText } from "./poster";
import type { Fix } from "./proofread";
import type { Flags } from "./store";

/**
 * A piece's warning chips, as the workbench reads them. Apart from the studio's actions, whose
 * file may export only server actions, so the Ads Studio's claim round (claim-ad-run.ts) reads
 * its pieces the same way.
 */

/** every line the checks read — all the hooks, since any may be posted, the tags, which are posted too, and the poster's words */
export function checkedText(o: Pick<ContentOutput, "hooks" | "body" | "closing" | "hashtags" | "poster">): string {
  return [...o.hooks, o.body, o.closing, (o.hashtags ?? []).join(" "), posterText(o.poster)].join("\n");
}

/**
 * `lang`: the piece's language — the round's for a piece just written (its output is not yet
 * marked), the stored piece's for an edit; an English one may carry no Thai (policy.ts).
 * `checks`: a plan-less mode's own (mode-checks.ts) — หาทีม's rules, every figure.
 */
export function flagsFor(o: ContentOutput, lang: Lang, brief: string, words: ContentWord[], fixes: Fix[] | null, checks: Partial<ModeChecks> = {}): Flags {
  const text = checkedText(o);
  return {
    numbers: strayNumbers(text, brief, { every: checks.every }),
    words: findWords(text, words),
    policy: checkPolicy(text, { recruit: checks.recruit, income: checks.income, lang }),
    // a suggestion whose words were edited away cannot be applied any more
    fixes: fixes ? fixes.filter((f) => text.includes(f.find)) : null,
  };
}
