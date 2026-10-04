import { BudgetExceeded, chat, parseJsonReply } from "@/lib/ai/client";
import { DISCLAIMER, TAX_LINE, type ContentOutput, type Lang } from "./output";
import { assembleLongAd, longAdMessages, parseLongAd, type LongAdContext } from "./ads";
import { parsePoster, posterText, type PosterSpec } from "./poster";
import { WRITERS } from "./models";
import { headlineMessages, parseHeadlines, type NumberSheet } from "./numbers";
import { parsePlans, planMessages, type PiecePlan } from "./plan";
import { buildMessages, type AngleId, type Ask } from "./prompt";
import { markFormula } from "./formula";
import { OutOfTime, within as inTime, type Deadline } from "./deadline";
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
 * A poster from the model's reply. parsePoster keeps `lang` (the drawing route reads it from
 * the URL), but the language is the round's, not the model's: one that added "lang":"en" to a
 * Thai poster would put the English insurer line under a Thai piece. englishOutput marks the
 * English ones.
 */
function modelPoster(raw: unknown): PosterSpec | null {
  const poster = parsePoster(raw);
  if (!poster) return null;
  const { lang: _lang, ...rest } = poster;
  void _lang;
  return rest;
}

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
    const poster = modelPoster(p.poster);
    out.push({
      hooks: [plans[i].hook],
      angle: plans[i].angle,
      body,
      closing: text(p.closing),
      hashtags: [...new Set(strings(p.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
      imagePrompt: text(p.imagePrompt),
      disclaimer: angle === "tax" ? `${DISCLAIMER}\n${TAX_LINE}` : DISCLAIMER,
      // a poster that cannot be read is left out, and the page draws one from the hook
      ...(poster ? { poster } : {}),
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

/**
 * A call bounded by the round's time, when it has a limit (deadline.ts): each provider gets
 * `usual` or the limit, whichever is less, and the whole call — fallbacks included — the limit.
 * No limit leaves the call as it was.
 */
function timed<T>(call: (timeoutMs: number | undefined) => Promise<T>, usual: number | undefined, budgetMs: number | undefined, what: string): Promise<T> {
  if (budgetMs === undefined) return call(usual);
  // no time left (Deadline.budget's 0): not called at all — 0 as a timeoutMs would mean no limit
  if (budgetMs <= 0) return Promise.reject(new OutOfTime(what));
  return inTime(call(usual ? Math.min(usual, budgetMs) : budgetMs), budgetMs, what);
}

/**
 * The cheap call: angles and hooks. `budgetMs`: the most it may take in all, the round's
 * deadline (deadline.ts); without it each provider has its own 25 s.
 */
export async function plan(opts: Parameters<typeof planMessages>[0], limits: { budgetMs?: number } = {}): Promise<Planned> {
  const r = await timed((timeoutMs) => chat({ tier: "small", task: "content-plan", messages: planMessages(opts), maxTokens: 900, json: true, timeoutMs }), undefined, limits.budgetMs, "plan");
  const plans = parsePlans(r.text, opts.count);
  if (!plans) throw new UnreadableReply();
  return { plans, model: r.model, costThb: r.costThb };
}

export interface WrittenPiece {
  output: ContentOutput;
  model: string;
  costThb: number;
  /**
   * A long ad's words as the model wrote them — opening, bullets, cta, hashtags, headline,
   * description and the poster's text — without the code's figures, so the round can check
   * them alone (restatedFigures). Not saved on the piece.
   */
  modelText?: string;
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
/**
 * `budgetMs`: the most each piece may take in all, fallbacks included — what is left of the
 * round's time (deadline.ts). A piece that runs past it is a piece that failed; the others are kept.
 */
export async function write(ask: Ask, opts: { only?: string; prefer?: string; budgetMs?: number } = {}): Promise<Round> {
  const within = fallbackWriters(opts.prefer);
  const settled = await Promise.allSettled(ask.plans.map(async (p) => {
    const r = await timed((timeoutMs) => chat({
      tier: "large", task: "content", messages: buildMessages({ ...ask, plans: [p] }),
      // low effort: ad copy from a fixed brief needs little reasoning, and the room left over
      // is for the post; 4,000 covers what thinking remains plus a long script
      maxTokens: 4000, json: true, timeoutMs, effort: "low", only: opts.only, prefer: opts.prefer, within,
    }), WRITE_TIMEOUT_MS, opts.budgetMs, "piece");
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
 * Long-form ads, one per plan (Ads Studio, 2026-10-05), each in its own call to the large model,
 * all in parallel, as posts are; a piece that fails costs only itself. The model writes the
 * opening, bullets, cta and hashtags; the code puts the headline figures, the premium table and
 * the contacts around them.
 *
 * `clock`: the round's deadline (deadline.ts), with `saveMs` kept back for saving the pieces
 * after; each call gets what is left then, fallbacks included. Without it the calls are as usual.
 */
export async function writeLongAds(opts: { brief: string; plans: PiecePlan[]; ctx: LongAdContext; prefer?: string; clock?: Deadline; saveMs?: number }): Promise<Round> {
  const { contact, ...shown } = opts.ctx;
  const cellMs = opts.clock?.budget(Infinity, opts.saveMs ?? 0);
  const settled = await Promise.allSettled(opts.plans.map(async (plan) => {
    const r = await timed((timeoutMs) => chat({
      tier: "large", task: "content", messages: longAdMessages(opts.brief, plan, shown),
      maxTokens: 3000, json: true, timeoutMs, effort: "low", prefer: opts.prefer,
      within: fallbackWriters(opts.prefer),
    }), WRITE_TIMEOUT_MS, cellMs, "ad");
    const ad = parseLongAd(r.text);
    if (!ad) {
      console.error(`content long ad unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
      throw new UnreadableReply();
    }
    const poster = modelPoster(ad.poster);
    const output: ContentOutput = {
      hooks: [ad.headline],
      angle: plan.angle,
      body: assembleLongAd(ad, { headline: opts.ctx.headline, table: opts.ctx.table, contact }),
      closing: ad.description,
      hashtags: [],
      imagePrompt: ad.imagePrompt,
      disclaimer: DISCLAIMER,
      ...(poster ? { poster } : {}),
      ad: { angle: plan.angle, tone: "" },
    };
    const modelText = [ad.opening, ...ad.bullets, ad.cta, ad.hashtags.join(" "), ad.headline, ad.description, posterText(poster ?? undefined)]
      .filter(Boolean).join("\n");
    return { output: ownerWording(output), model: r.model, costThb: r.costThb, modelText };
  }));
  return gather(settled);
}

/**
 * The ตัวเลขชัดๆ angle's one call: a headline and a picture line per sheet, from the cheap
 * model. Any failure gives the fallback headlines — the figures under them are the post.
 * `lang`: "en" asks for English headlines (and falls back to the English ones).
 */
export async function headlines(sheets: NumberSheet[], limits: { budgetMs?: number; lang?: Lang } = {}): Promise<{ lines: ReturnType<typeof parseHeadlines>; model: string; costThb: number }> {
  const lang = limits.lang ?? "th";
  const r = await timed((timeoutMs) => chat({ tier: "small", task: "content-headline", messages: headlineMessages(sheets, lang), maxTokens: 800, json: true, timeoutMs }), undefined, limits.budgetMs, "headlines")
    .catch((e) => { console.error("content headlines failed:", e); return null; });
  return { lines: parseHeadlines(r?.text ?? "", sheets.length, lang), model: r?.model ?? "fallback", costThb: r?.costThb ?? 0 };
}
