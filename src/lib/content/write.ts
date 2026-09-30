import { BudgetExceeded, chat, parseJsonReply } from "@/lib/ai/client";
import { DISCLAIMER, TAX_LINE, type ContentOutput } from "./output";
import { adCopyMessages, matrixCells, matrixMessages, parseAdCopy, parseMatrix } from "./ads";
import { parsePoster } from "./poster";
import { WRITERS } from "./models";
import { headlineMessages, parseHeadlines, type NumberSheet } from "./numbers";
import { parsePlans, planMessages, type PiecePlan } from "./plan";
import { buildMessages, type AngleId, type Ask } from "./prompt";
import { markFormula } from "./formula";
import { ownerWording } from "./wording";

export { DISCLAIMER, TAX_LINE, fullText, type ContentOutput } from "./output";

/**
 * One call to the model, and what comes back made into a post.
 *
 * The large tier, and the first caller of it in this system: everything else here parses a
 * question or answers one, which the cheapest models do well, but an advertisement is read by
 * strangers deciding whether to keep scrolling, and the cheap models write Thai that reads
 * like a form. About a baht a piece at the prices on 2026-09-23.
 */

interface RawPiece {
  poster?: unknown;
  body?: unknown;
  closing?: unknown;
  hashtags?: unknown;
  imagePrompt?: unknown;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * One post per plan, or null.
 *
 * All or nothing, as in Maryjane's parseDraftResponse: a reply with one piece fewer than the
 * plans is a reply that lost track, and the owner would be shown three posts for four angles
 * without knowing which one went missing.
 *
 * The hooks come from the plans, not from the reply. Told to keep a hook, models reword it
 * anyway — Maryjane found this and overwrites in code, and so does this — and the hook is the
 * line the formula, the used-hooks list and the policy were all checked against.
 */
export function parsePieces(reply: string, plans: PiecePlan[], angle: AngleId): ContentOutput[] | null {
  const raw = parseJsonReply<{ pieces?: unknown; body?: unknown }>(reply);
  if (!raw) return null;
  // asked for one piece, a model sometimes answers with the piece itself rather than a list of one
  const list = Array.isArray(raw.pieces) ? raw.pieces : plans.length === 1 && typeof raw.body === "string" ? [raw] : null;
  if (!list) return null;
  const pieces = (list as RawPiece[]).slice(0, plans.length);
  if (pieces.length !== plans.length) return null;
  const out: ContentOutput[] = [];
  for (const [i, p] of pieces.entries()) {
    const body = text(p?.body);
    if (!body) return null;
    out.push({
      hooks: [plans[i].hook],
      angle: plans[i].angle,
      body,
      closing: text(p.closing),
      hashtags: [...new Set(strings(p.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
      imagePrompt: text(p.imagePrompt),
      disclaimer: angle === "tax" ? `${DISCLAIMER}\n${TAX_LINE}` : DISCLAIMER,
      // a poster that cannot be read is left out, and the page draws one from the hook
      ...(parsePoster(p.poster) ? { poster: parsePoster(p.poster)! } : {}),
    });
  }
  return out;
}

export class UnreadableReply extends Error {
  constructor() {
    super("AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่อีกครั้งนะครับ");
    this.name = "UnreadableReply";
  }
}

export interface Planned {
  plans: PiecePlan[];
  model: string;
  costThb: number;
}

/** The cheap call: angles and hooks. */
export async function plan(opts: Parameters<typeof planMessages>[0]): Promise<Planned> {
  const r = await chat({ tier: "small", task: "content-plan", messages: planMessages(opts), maxTokens: 900, json: true });
  const plans = parsePlans(r.text, opts.count);
  if (!plans) throw new UnreadableReply();
  return { plans, model: r.model, costThb: r.costThb };
}

export interface WrittenPiece {
  output: ContentOutput;
  model: string;
  costThb: number;
}

/**
 * The writers a pick may fall back to when its model is down.
 *
 * ประหยัด — picked, or chosen by อัตโนมัติ because the month's money is nearly gone — falls
 * back to nothing dearer: a cheap pick answered by Sonnet at six times the price is exactly
 * the spend it was picked to avoid. The dearer picks keep the whole list.
 */
export function fallbackWriters(prefer: string | undefined): string[] | undefined {
  if (!prefer) return undefined;
  const cheapest = Math.min(...WRITERS.map((w) => w.thb));
  const picked = WRITERS.find((w) => w.model === prefer);
  return picked && picked.thb <= cheapest ? [prefer] : WRITERS.map((w) => w.model);
}

/** What a round of parallel calls came to: the pieces, and how many the budget stopped. */
export interface Round {
  pieces: WrittenPiece[];
  /** pieces refused because the month's AI budget ran out while the round was writing */
  budgetHit: number;
}

/** The fulfilled ones; all failed throws the first reason, a budget refusal before any other. */
function gather(settled: PromiseSettledResult<WrittenPiece>[]): Round {
  const pieces = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
  const budgetHit = reasons.filter((r) => r instanceof BudgetExceeded).length;
  if (pieces.length === 0) throw reasons.find((r) => r instanceof BudgetExceeded) ?? reasons[0] ?? new UnreadableReply();
  return { pieces, budgetHit };
}

/** a large model writing one post in Thai; comfortably past the 25 seconds a chat reply gets */
const WRITE_TIMEOUT_MS = 60_000;

/**
 * Every planned piece, written in parallel — one call each.
 *
 * It was one call for all of them, as Maryjane does it, and that call took long enough that the
 * provider timeout cut Sonnet off and the round was quietly written by the fallback model. One
 * call per piece finishes a round of five in about the time one piece takes, keeps each reply
 * short enough to finish, and a piece that fails costs only itself. The planner already made
 * the angles distinct, so no writer needs to see the others' plans.
 */
export async function write(ask: Ask, opts: { only?: string; prefer?: string } = {}): Promise<Round> {
  const within = fallbackWriters(opts.prefer);
  const settled = await Promise.allSettled(ask.plans.map(async (p) => {
    const r = await chat({
      tier: "large", task: "content", messages: buildMessages({ ...ask, plans: [p] }),
      // low effort: ad copy from a fixed brief needs little reasoning, and the room left over
      // is for the post; 4,000 covers what thinking remains plus a long script
      maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low", only: opts.only, prefer: opts.prefer, within,
    });
    const [parsed] = parsePieces(r.text, [p], ask.angle) ?? [];
    // told to say ตลอดชีพ and no ครับ, a model may still write "ถึงอายุ 99" or ครับ; the net catches it
    const output = parsed && ownerWording(parsed);
    if (!output) {
      // the reply is the only evidence of why; its opening is enough to tell the shapes apart
      console.error(`content piece unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
      throw new UnreadableReply();
    }
    // the formula named on the piece; สูตรอ่าน-ดูจนจบ's reason is the planner's, its loops the writer's
    return { output: markFormula(output, ask.formula ?? null, r.text, p.shareWhy ?? null), model: r.model, costThb: r.costThb };
  }));
  return gather(settled);
}

/**
 * A round of ads: the cheap model designs the angles and tones, then every cell is written in
 * parallel by the large one, as posts are. A cell that fails costs only itself.
 */
export async function writeAds(opts: { brief: string; angles: number; tones: number; hint: string; prefer?: string }): Promise<Round & { planThb: number; planned: number }> {
  const m = await chat({ tier: "small", task: "content-plan", messages: matrixMessages(opts.brief, opts.angles, opts.tones, opts.hint), maxTokens: 900, json: true })
    .catch(() => null);
  const matrix = parseMatrix(m?.text ?? "", opts.angles, opts.tones);
  const cells = matrixCells(matrix);
  const settled = await Promise.allSettled(cells.map(async (cell) => {
    const r = await chat({
      tier: "large", task: "content", messages: adCopyMessages(opts.brief, cell),
      maxTokens: 3000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low", prefer: opts.prefer,
      within: fallbackWriters(opts.prefer),
    });
    const copy = parseAdCopy(r.text);
    if (!copy) {
      console.error(`content ad unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
      throw new UnreadableReply();
    }
    const poster = parsePoster(copy.poster);
    const output: ContentOutput = {
      hooks: [copy.headline],
      angle: `${cell.angle.label} · ${cell.tone.label}`,
      body: copy.primaryText,
      closing: copy.description,
      hashtags: [],
      imagePrompt: copy.imagePrompt,
      disclaimer: DISCLAIMER,
      ...(poster ? { poster } : {}),
      ad: { angle: cell.angle.label, tone: cell.tone.label },
    };
    return { output: ownerWording(output), model: r.model, costThb: r.costThb };
  }));
  return { ...gather(settled), planThb: m?.costThb ?? 0, planned: cells.length };
}

/**
 * The ตัวเลขชัดๆ angle's one call: a headline and a picture line per sheet, from the cheap
 * model. Any failure gives the fallback headlines — the figures under them are the post.
 */
export async function headlines(sheets: NumberSheet[]): Promise<{ lines: ReturnType<typeof parseHeadlines>; model: string; costThb: number }> {
  const r = await chat({ tier: "small", task: "content-headline", messages: headlineMessages(sheets), maxTokens: 800, json: true })
    .catch((e) => { console.error("content headlines failed:", e); return null; });
  return { lines: parseHeadlines(r?.text ?? "", sheets.length), model: r?.model ?? "fallback", costThb: r?.costThb ?? 0 };
}
