import { briefFor } from "./brief";
import { findWords, strayNumbers, type ContentWord } from "./check";
import type { ModeChecks } from "./mode-checks";
import { checkPolicy } from "./policy";
import type { ContentItem, Flags } from "./store";

/**
 * A Reel caption's checks: banned words, figures not in the plan's data, Facebook's ad rules.
 * (The clip transcription that also lived here went with ตัดต่อคลิป, owner 2026-11-15.)
 */

export function captionFlags(caption: string, yardstick: string, words: ContentWord[], checks: Partial<ModeChecks>): Flags {
  return {
    numbers: strayNumbers(caption, yardstick, { every: checks.every }),
    words: findWords(caption, words),
    policy: checkPolicy(caption, { recruit: checks.recruit }),
    fixes: null,
  };
}

/** where a figure written may come from: the plan's own figures, the script, the agent's note */
export function clipYardstick(item: ContentItem): string {
  const v = item.output.video;
  return [briefFor(item.planHref)?.text ?? "", item.output.hooks.join("\n"), item.output.body, item.output.closing, v?.brief ?? ""].join("\n");
}
