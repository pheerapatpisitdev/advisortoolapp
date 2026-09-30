import { FINISH_HOOK_RULES, FINISH_NAME, finishRules, withFinish, type ShareWhy } from "./finish";
import type { ContentOutput } from "./output";
import { PRO_HOOK_RULES, PRO_NAME, proRules } from "./pro";
import type { Format, Length } from "./prompt";

/**
 * The writing formulas a round may be written to, one at a time (owner, 2026-10-01): สูตรคอนเทนต์โปร
 * (pro.ts) or สูตรอ่าน-ดูจนจบ (finish.ts). They overlap by half and disagree on the hook, so
 * the choice is one value rather than two boxes — no path can hand a writer both.
 * Every writer and runner asks this file which rules and which mark; none of them names a
 * formula itself. Browser-safe.
 */

export type Formula = "pro" | "finish";

export const FORMULA_NAME: Record<Formula, string> = { pro: PRO_NAME, finish: FINISH_NAME };
/** the card's word for it; "สูตรโปร" is what cards said before there were two */
export const FORMULA_SHORT: Record<Formula, string> = { pro: "สูตรโปร", finish: FINISH_NAME };

export function readFormula(v: unknown): Formula | null {
  return v === "pro" || v === "finish" ? v : null;
}

/**
 * The formula a round asked for. A page loaded before there were two sends `pro: true`; it is
 * still สูตรโปร. An ad's lengths are Ads Manager's, so an ad is written to none.
 */
export function formulaOf(input: { formula?: unknown; pro?: unknown }, format: string): Formula | null {
  if (format === "ad") return null;
  return readFormula(input.formula) ?? (input.pro === true ? "pro" : null);
}

/** a stored piece's formula; one written before there were two carries `pro: true` */
export function outputFormula(o: { formula?: unknown; pro?: unknown }): Formula | null {
  return readFormula(o.formula) ?? (o.pro === true ? "pro" : null);
}

/** the hook's rules, for the planner */
export function formulaHookRules(f: Formula | null): string {
  return f === "pro" ? PRO_HOOK_RULES : f === "finish" ? FINISH_HOOK_RULES : "";
}

/**
 * The rules for the one writing the body. `oneCall`: the call writes its own hook too
 * (รีวิวเคลม, หาทีม, ความรู้, เขียนเอง), so the hook's rules go first.
 */
export function formulaRules(f: Formula | null, format: Format, length: Length | null, loop: boolean, oneCall = false): string {
  if (!f || format === "ad") return "";
  const body = f === "pro" ? proRules(format, length, loop) : finishRules(format, length, loop, oneCall);
  return oneCall ? `${formulaHookRules(f)}\n${body}` : body;
}

/** A written piece with its formula named, and สูตรอ่าน-ดูจนจบ's reports read from the reply. */
export function markFormula(output: ContentOutput, f: Formula | null, reply: string, planned: ShareWhy | null = null): ContentOutput {
  if (f === "finish") return withFinish(output, reply, planned);
  return f === "pro" ? { ...output, formula: "pro" } : output;
}
