import { AsyncLocalStorage } from "node:async_hooks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inWalletRound, meterCost } from "@/lib/wallet/round";
import { walletChargedThb } from "@/lib/wallet/store";
import { monthSpend, recordUsage, spendSince } from "./ledger";
import { IMAGE_CALLERS, TAKES_REFERENCES, withAspect, type Aspect, type DrawnImage, type ReferenceImage } from "./images";
import { CALLERS, EMBEDDERS, JUDGE, type JudgeAnswer, type JudgeQuestion } from "./providers";
import type { ChatMessage, ChatResult, ModelRow, Tier } from "./types";

const USD_TO_THB = 36;

/**
 * Preference order per tier. The first enabled model whose provider has a key wins; if a
 * call fails the next one is tried, so one provider being down does not take the bot down.
 */
const TIER_PREFERENCE: Record<Tier, string[]> = {
  small: ["gemini-3.1-flash-lite", "gpt-5-mini", "glm-5.3-flash", "claude-haiku-4-5-20251001"],
  large: ["claude-sonnet-5", "gpt-5", "gemini-3.7-flash", "glm-5.3"],
};

export class BudgetExceeded extends Error {
  constructor() {
    super("ถึงงบค่า AI ของเดือนนี้แล้ว");
    this.name = "BudgetExceeded";
  }
}

interface Config {
  keys: Record<string, string>;
  /** providers switched off on the admin page: their keys stay, their calls stop */
  off: Set<string>;
  models: ModelRow[];
  budgetThb: number | null;
  smallModel: string | null;
  largeModel: string | null;
}

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

let cached: { at: number; config: Config } | null = null;
const CACHE_MS = 60_000;

async function loadConfig(): Promise<Config> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  const supabase = supabaseAdmin();
  // Model names and prices come from the shared reference table (read only); which of them
  // this app may use, and the keys themselves, live in this app's own tables.
  const [keys, models, prefs, settings, switches] = await Promise.all([
    supabase.rpc("ins_get_api_keys", { p_passphrase: passphrase() }),
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled, price, params"),
    supabase.from("ins_model_prefs").select("model_id, enabled"),
    supabase.from("ins_ai_settings").select("small_model, large_model, monthly_budget_thb").maybeSingle(),
    supabase.from("ins_api_keys").select("provider, enabled"),
  ]);
  const disabled = new Set((prefs.data ?? []).filter((p) => !p.enabled).map((p) => p.model_id));
  const off = new Set(((switches?.data ?? []) as { provider: string; enabled: boolean | null }[])
    .filter((k) => k.enabled === false).map((k) => k.provider));
  const config: Config = {
    keys: Object.fromEntries(((keys.data ?? []) as { provider: string; api_key: string }[])
      .filter((k) => k.api_key).map((k) => [k.provider, k.api_key])),
    off,
    models: ((models.data ?? []) as ModelRow[]).map((m) => ({ ...m, enabled: m.enabled && !disabled.has(m.id) })),
    budgetThb: settings.data?.monthly_budget_thb ?? null,
    smallModel: settings.data?.small_model ?? null,
    largeModel: settings.data?.large_model ?? null,
  };
  /**
   * A read that came back with no keys is a failure, not a configuration: every model needs
   * one, so caching it would silence the bot for the minute the cache lives. It cost a
   * customer from the advertisement one evening — the first request on a fresh deployment
   * could not read the key table, and the lead was told to ask again later.
   */
  if (Object.keys(config.keys).length === 0) {
    if (keys.error) console.error("ai keys unreadable:", keys.error.message);
    return config;
  }
  cached = { at: Date.now(), config };
  return config;
}

/** Forces the next call to re-read keys and settings; used after the admin page saves. */
export function clearAiConfigCache() {
  cached = null;
}

/**
 * The owner's spend so far this calendar month, in baht — summed in the database, never from
 * rows.
 *
 * What agents paid for from their own wallets is taken off, the same way the content ceiling
 * does it (contentSpentThisMonth, src/lib/content/store.ts). It was not, and the ledger holds
 * every call whoever paid for it: once agents began spending from their wallets their rounds
 * filled the owner's monthly budget, and the Messenger and LINE bots told every customer they
 * were out of budget on money the owner never spent (review, 2026-10-01). walletChargedThb is
 * the providers' cost of the wallet rounds that were charged — the same baht as the ledger's
 * cost_thb, not the marked-up satang the agent paid — so the two subtract cleanly. A round that
 * failed and was released stays the owner's, which is what it was. When the wallet figure
 * cannot be read it is 0, and the guard stops sooner rather than later.
 */
async function spentThisMonth(): Promise<number> {
  const since = await spendSince();
  const [spend, paidByAgents] = await Promise.all([monthSpend(since), walletChargedThb(since)]);
  return Math.max(0, spend.baht - paidByAgents);
}

/**
 * Stops every call once the month's spend reaches the owner's budget.
 *
 * Empty means no limit. A number means that number, 0 included: a ฿0 budget is a ceiling
 * already reached, and the bot stops. That reading is deliberate, and it is why the admin
 * page refuses 0 rather than storing it — the page once showed a 0 as "ยังไม่ได้ตั้งงบ" while
 * this line switched off every customer's answers. Only a value that is not a number at all
 * (a hand edit in the table) is taken as no limit, and said so in the log, because a
 * NaN compared with anything is false and would have meant the same thing silently.
 */
async function assertWithinBudget(config: Config) {
  if (config.budgetThb === null || config.budgetThb === undefined) return;
  /**
   * A round the agent pays for from their wallet is not the owner's money, so the owner's
   * budget does not stand over it — the wallet's hold does (src/lib/wallet/round.ts). Without
   * this an agent with money in the wallet was refused because the owner's month had run out.
   */
  if (inWalletRound()) return;
  const budget = Number(config.budgetThb);
  if (!Number.isFinite(budget)) {
    console.error(`monthly_budget_thb is not a number (${String(config.budgetThb)}); treating it as no limit`);
    return;
  }
  if ((await spentThisMonth()) >= budget) throw new BudgetExceeded();
}

/** Records what a call cost. Never records the customer's words, only counts and money. */
async function record(model: string, task: string, inTok: number, outTok: number, costThb: number) {
  // a wallet round's meter (src/lib/wallet/round.ts); outside one this does nothing
  meterCost(costThb);
  await recordUsage(model, task, inTok, outTok, costThb);
}

/**
 * How far past the tier's own price a fallback may go before it is refused.
 *
 * Four, which is wide enough to survive a provider being down — the small tier's models
 * spread further than that between cheapest and dearest — and narrow enough that the thing
 * the ledger recorded cannot happen again: a routing call, worth 0.009 baht, answered at
 * 0.819 by the large tier's model. Ninety times, unnoticed, on a budget that switches the
 * assistant off when it runs out.
 */
const PRICE_CEILING = 4;

/** What a call on this model costs per million tokens, in and out weighted as they are used. */
const priceOf = (m: ModelRow) => m.price.inputPerMTokUsd + m.price.outputPerMTokUsd / 4;

/**
 * The models to try, in order, for one task.
 *
 * Three rules, and the order of them is the point.
 *
 * The owner's own choice from the admin page goes first and is never questioned: an explicit
 * decision is not an accident, and this is not the place to overrule it.
 *
 * Then the tier's preference list, which is what the task was designed around.
 *
 * Then everything else — but cheapest first, and only up to a multiple of what this tier
 * already costs. It used to be "then everything else" with no order and no limit, which is
 * how a classifier came to be answered by the most expensive model in the account. Keeping
 * the fallback matters, because one provider having a bad afternoon must not take the
 * assistant down; keeping it bounded matters for the same reason, since the budget running
 * out takes the assistant down too, only for longer and without a message.
 *
 * Exported for the test that holds the ceiling in place.
 */
export function fallbackOrder(models: ModelRow[], tier: Tier, chosen: string | null, keys?: Record<string, string>): ModelRow[] {
  const enabled = models.filter((m) => m.kind === "text" && m.enabled && (!keys || keys[m.provider]));
  /**
   * Deduplicated, because the owner's choice is usually one of the tier's own models.
   *
   * gemini-3.7-flash is picked for the large tier on the admin page today and is also third
   * in that tier's list, so the chain read: gemini-3.7-flash, sonnet, gpt-5, gemini-3.7-flash
   * again. The second attempt is the one that matters — it lands exactly when the first has
   * just failed, which is when the provider is down, so the fallback spends a call and a
   * customer's wait asking the same dead endpoint a second time before trying anyone else.
   */
  const order = [...new Set(chosen ? [chosen, ...TIER_PREFERENCE[tier]] : TIER_PREFERENCE[tier])];
  const preferred = order
    .map((name) => enabled.find((m) => m.model_name === name))
    .filter((m): m is ModelRow => Boolean(m));

  // the ceiling is measured against what this tier actually costs, so it moves with the
  // prices rather than against a number written here once
  const baseline = preferred.length ? Math.min(...preferred.map(priceOf)) : undefined;
  const rest = enabled
    .filter((m) => !preferred.includes(m))
    .filter((m) => baseline === undefined || priceOf(m) <= baseline * PRICE_CEILING)
    .sort((a, b) => priceOf(a) - priceOf(b));

  const out = [...preferred, ...rest];
  /**
   * A tier with nothing in it falls back to the cheapest thing available rather than to
   * nothing. Refusing to answer at all is worse than answering dearly, and this only happens
   * when the preference list has gone stale against the model table.
   */
  if (out.length === 0 && enabled.length > 0) return [...enabled].sort((a, b) => priceOf(a) - priceOf(b));
  return out;
}

/** The keys the chain may use: every key the owner has not switched off. */
function liveKeys(config: Config): Record<string, string> {
  return Object.fromEntries(Object.entries(config.keys).filter(([provider]) => !config.off.has(provider)));
}

/** A provider's key, as the chain would use it — for calls that are not a chat (Gemini's Files API); null when off or missing. */
export async function providerKey(provider: string): Promise<string | null> {
  return liveKeys(await loadConfig())[provider] ?? null;
}

/** The named text models that can answer now: the first as given, the rest cheapest first. */
function keptTo(config: Config, names: string[]): ModelRow[] {
  const keys = liveKeys(config);
  const usable = (name: string) => config.models.find((m) => m.kind === "text" && m.enabled && m.model_name === name && keys[m.provider]);
  const [first, ...rest] = [...new Set(names)];
  const tail = rest.map(usable).filter((m): m is ModelRow => Boolean(m)).sort((a, b) => priceOf(a) - priceOf(b));
  const head = usable(first);
  return head ? [head, ...tail] : tail;
}

function candidates(config: Config, tier: Tier): ModelRow[] {
  return fallbackOrder(config.models, tier, tier === "small" ? config.smallModel : config.largeModel, liveKeys(config));
}

/**
 * How long one provider may take when the caller names no time of its own: the providers'
 * own 25 seconds (src/lib/ai/providers.ts), written out here so it survives being combined
 * with a turn's deadline below — a signal handed to a provider replaces its default rather
 * than adding to it. Callers that pass longer (60s for a post, 90s for a picture) keep theirs.
 */
export const DEFAULT_CALL_TIMEOUT_MS = 25_000;

/** A turn ran out of time: whatever it was waiting on is abandoned and the caller apologises. */
export class TurnTimeout extends Error {
  constructor(ms: number) {
    super(`turn took longer than ${Math.round(ms / 1000)} seconds`);
    this.name = "TurnTimeout";
  }
}

const deadlines = new AsyncLocalStorage<AbortSignal>();

/**
 * Runs one turn of a conversation under a deadline, and gives up on it at the deadline.
 *
 * The webhooks answer inside `after()`, and a serverless function that reaches its limit is
 * killed where it stands — mid-answer, before the apology in its catch has been sent, so the
 * customer met silence (review, 2026-10-01). A single call already had its 25 seconds, but a
 * turn is several calls (a router, an answer, a judge), each with a fallback chain, and the
 * conversation retries the whole answer once: added up, that could pass the function's limit.
 *
 * So the turn has a clock of its own. When it runs out the promise rejects with TurnTimeout
 * at once, whatever is still in flight; the calls made under it see the same signal, so the
 * one waiting on a provider is aborted and no further one is started. Nothing that has
 * already been paid for is lost from the ledger — a call records its cost as it returns.
 */
export async function withTurnDeadline<T>(ms: number, run: () => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const e = new TurnTimeout(ms);
      controller.abort(e);
      reject(e);
    }, Math.max(0, ms));
  });
  try {
    return await Promise.race([deadlines.run(controller.signal, run), expired]);
  } finally {
    clearTimeout(timer);
  }
}

/** a provider call's own leash, tied to the turn's deadline when there is one */
function leash(own: AbortSignal): AbortSignal {
  const turn = deadlines.getStore();
  return turn ? AbortSignal.any([own, turn]) : own;
}

/** throws when the turn this call belongs to has already run out of time */
function assertTurnAlive() {
  const turn = deadlines.getStore();
  if (turn?.aborted) throw turn.reason instanceof Error ? turn.reason : new TurnTimeout(0);
}

export interface ChatOptions {
  tier: Tier;
  task: string;
  messages: ChatMessage[];
  maxTokens?: number;
  json?: boolean;
  /** passed to Gemini as is; see CallArgs.mediaResolution */
  mediaResolution?: "low";
  /**
   * How long each provider may take before the next is tried. Left out, DEFAULT_CALL_TIMEOUT_MS
   * — the providers' own 25 seconds — applies, which is right for a chat reply and wrong for a whole Facebook post:
   * a large model writing a thousand words of Thai takes longer than that, and was being cut
   * off and silently replaced by a faster, thinner one.
   */
  timeoutMs?: number;
  /** thinking effort for Claude models; see CallArgs.effort */
  effort?: "low" | "medium" | "high";
  /**
   * One named model and nothing else — no fallback. For comparing models side by side, where
   * a reply quietly written by another would make the comparison a lie. The model must be
   * enabled and its provider's key live, like any other.
   */
  only?: string;
  /**
   * A model to try first, ahead of the tier's own choice; the usual fallback follows it, so
   * a pick that is down is answered by the next rather than not at all.
   */
  prefer?: string;
  /**
   * With `prefer`: the only models its fallback may use, cheapest first. /content passes the
   * writers it offers, so a pick of ประหยัด that fails is not answered by Sonnet at six
   * times the price, nor by a model the bake-off turned away for its Thai.
   */
  within?: string[];
}

/** Sends one prompt, trying providers in order until one answers. */
export async function chat({ tier, task, messages, maxTokens = 700, json, mediaResolution, timeoutMs, effort, only, prefer, within }: ChatOptions): Promise<ChatResult> {
  assertTurnAlive();
  const config = await loadConfig();
  await assertWithinBudget(config);
  const tried: string[] = [];
  const chain = only
    ? config.models.filter((m) => m.kind === "text" && m.enabled && m.model_name === only && liveKeys(config)[m.provider])
    : prefer && within
      ? keptTo(config, [prefer, ...within])
      : prefer
        ? fallbackOrder(config.models, tier, prefer, liveKeys(config))
        : candidates(config, tier);
  if (only && chain.length === 0) throw new Error(`โมเดล ${only} ใช้ไม่ได้ในตอนนี้`);
  for (const model of chain) {
    const call = CALLERS[model.provider];
    if (!call) continue;
    // a turn out of time stops here rather than asking the next provider for nobody
    assertTurnAlive();
    try {
      // 0 or less has always meant "no time of the caller's own" (src/lib/content/deadline.ts):
      // the default, never a signal that is aborted before the call is made
      const signal = leash(AbortSignal.timeout(timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_CALL_TIMEOUT_MS));
      const r = await call({ apiKey: config.keys[model.provider], model: model.model_name, messages, maxTokens, json, mediaResolution, signal, effort });
      const costThb = (r.inputTokens / 1e6 * model.price.inputPerMTokUsd
        + r.outputTokens / 1e6 * model.price.outputPerMTokUsd) * USD_TO_THB;
      await record(model.model_name, task, r.inputTokens, r.outputTokens, costThb);
      /**
       * An empty reply is a failure, not an answer. It was returned as one: a model that spent
       * its whole allowance thinking came back with "" and a 200, and the callers fell back to
       * canned text for the customer instead of trying the next provider. It was paid for, so
       * it is recorded above; then the next model is asked.
       */
      if (!r.text.trim()) throw new Error(`empty reply after ${r.outputTokens} tokens`);
      return { text: r.text, model: model.model_name, provider: model.provider, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costThb };
    } catch (e) {
      tried.push(`${model.model_name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (tried.length === 0) throw new Error("ไม่มีคีย์ผู้ให้บริการ AI ที่ใช้ได้ในตอนนี้");
  throw new Error(`ไม่มีผู้ให้บริการ AI ที่ตอบได้\n${tried.join("\n")}`);
}

/**
 * Image models to try, in order, by their model_configs id. Cheapest first — gpt-image-2 at
 * medium quality is $0.012 a picture — then Gemini's lite model at $0.034 if OpenAI is down.
 * Nothing past the list is tried: the dearest image model is five times the first, and a
 * picture nobody asked to be expensive should not become so because a provider was busy.
 */
const IMAGE_PREFERENCE = ["gpt-image-medium", "gemini-image-lite"];
/** with a person's photos: Gemini keeps a face best, OpenAI's edit endpoint behind it */
const REFERENCE_PREFERENCE = ["gemini-image", "gpt-image-medium", "gemini-image-lite"];

/** an image takes far longer than a reply; 90 seconds each, two tries, inside the route's 300 */
const IMAGE_TIMEOUT_MS = 90_000;

export interface DrawResult extends DrawnImage {
  model: string;
  /** the model_configs id — two qualities of one model share a name, not an id */
  id: string;
  costThb: number;
}

/** Draws one picture, checking the month's budget first and recording what it cost. `prefer` is a model_configs id. */
export async function drawImage({ task, prompt, prefer, references, aspect }: {
  task: string; prompt: string; prefer?: string; references?: ReferenceImage[]; aspect?: Aspect;
}): Promise<DrawResult> {
  const config = await loadConfig();
  await assertWithinBudget(config);
  const keys = liveKeys(config);
  // a picked model goes first; the cheap list stays behind it for when it is down
  const withPeople = Boolean(references?.length);
  // a person's photos go first to the model best at keeping them, whatever the painter picked
  const order = withPeople ? REFERENCE_PREFERENCE : prefer ? [prefer, ...IMAGE_PREFERENCE] : IMAGE_PREFERENCE;
  const models = [...new Set(order)]
    .map((id) => config.models.find((m) => m.id === id && m.kind === "image" && m.enabled))
    .filter((m): m is ModelRow => Boolean(m && keys[m.provider] && IMAGE_CALLERS[m.provider]))
    // a caller that cannot send the photos would draw a stranger
    .filter((m) => !withPeople || TAKES_REFERENCES.has(m.provider));
  const tried: string[] = [];
  // a provider that has just run out the clock is not asked again for its other quality
  const stalled = new Set<string>();
  for (const model of models) {
    if (stalled.has(model.provider)) continue;
    try {
      const img = await IMAGE_CALLERS[model.provider]({
        apiKey: keys[model.provider], model: model.model_name, prompt, params: withAspect(model.provider, model.params ?? {}, aspect),
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), references,
      });
      const costThb = Number(model.price.perImageUsd ?? 0) * USD_TO_THB;
      await record(model.model_name, task, 0, 0, costThb);
      return { ...img, model: model.model_name, id: model.id, costThb };
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) stalled.add(model.provider);
      tried.push(`${model.model_name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (models.length === 0) throw new Error("ไม่มีโมเดลวาดรูปที่ใช้ได้ในตอนนี้");
  throw new Error(`วาดรูปไม่สำเร็จ\n${tried.join("\n")}`);
}

/** Turns text into vectors for the knowledge base, trying each embedding provider in turn. */
export async function embedTexts(texts: string[], task = "embed"): Promise<number[][]> {
  const config = await loadConfig();
  await assertWithinBudget(config);
  const tried: string[] = [];
  for (const e of EMBEDDERS) {
    const key = liveKeys(config)[e.provider];
    if (!key) continue;
    try {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 32) {
        const { vectors, tokens } = await e.embed(key, texts.slice(i, i + 32));
        out.push(...vectors);
        await record(e.model, task, tokens, 0, tokens / 1e6 * e.usdPerMTok * USD_TO_THB);
      }
      return out;
    } catch (err) {
      tried.push(`${e.model}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`แปลงข้อความเป็นเวกเตอร์ไม่สำเร็จ\n${tried.join("\n")}`);
}

export interface JudgeOptions {
  task: string;
  /** what is being judged: a message, a record, a short transcript */
  state: unknown;
  questions: Record<string, JudgeQuestion>;
  /** a shorter leash than the provider default, for callers that would rather go without */
  signal?: AbortSignal;
}

export interface Judged {
  answers: Record<string, JudgeAnswer>;
  model: string;
  inputTokens: number;
  costThb: number;
}

/**
 * Puts typed questions to TypeSafe and records what it cost.
 *
 * No fallback chain here: nothing else in the account answers in probabilities, so a call
 * that fails is a failure the caller has to handle — by asking a chat model the old way, or
 * by deciding without. It still sits behind the month's budget, because a judge that keeps
 * running after the assistant has switched itself off is spending on nobody.
 */
export async function judge({ task, state, questions, signal }: JudgeOptions): Promise<Judged> {
  assertTurnAlive();
  const config = await loadConfig();
  await assertWithinBudget(config);
  if (config.off.has(JUDGE.provider)) throw new Error("TypeSafe ปิดอยู่");
  const apiKey = config.keys[JUDGE.provider];
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งกุญแจ TypeSafe");
  const r = await JUDGE.ask(apiKey, state, questions, leash(signal ?? AbortSignal.timeout(DEFAULT_CALL_TIMEOUT_MS)));
  const costThb = r.inputTokens / 1e6 * JUDGE.usdPerMTokIn * USD_TO_THB;
  await record(r.model, task, r.inputTokens, r.outputTokens, costThb);
  return { answers: r.answers, model: r.model, inputTokens: r.inputTokens, costThb };
}

export { closeBrackets, escapeBareControls, parseJsonReply } from "./json-reply";

/** Why a provider is or is not answering right now. */
export type ProviderState = "ok" | "failed" | "no-key" | "no-model";

export interface ProviderCheck {
  provider: string;
  state: ProviderState;
  /** how long the provider took to answer or to refuse, in milliseconds */
  ms: number;
  /** the model the question was put to */
  model?: string;
  /** what the provider said when it refused, trimmed and with anything key-shaped removed */
  error?: string;
}

/** Long enough for a cold provider, short enough that five of them do not hang the page. */
const CHECK_TIMEOUT_MS = 15_000;

/**
 * Output tokens the check allows itself.
 *
 * One was the obvious answer and it was wrong: a reasoning model spends its output budget
 * thinking before it writes anything, so GPT-5 hit the ceiling before its first character
 * and returned 400 — "max_tokens or model output limit was reached". The check then reported
 * a perfectly good key as a dead provider, which is the one mistake a health check must not
 * make.
 *
 * Sixteen was the next answer, and on 2026-09-23 it was wrong too: OpenAI now refuses a cap
 * that small outright, before the model writes anything. Probed with the stored key: gpt-5 and
 * gpt-5-mini at 16 → 400 with that same message; at 64 → "pong" in 10 and 19 tokens, none of
 * them reasoning. So the key was fine and the check said "หยุดทำงาน". Sixty-four finishes on
 * every provider here and still costs a fraction of a satang.
 */
const CHECK_MAX_TOKENS = 64;

/**
 * Anything in an error that looks like a credential, taken out before it reaches a screen.
 *
 * Providers do not normally quote the key back, but this text is written by five different
 * companies and read in a browser, and the cost of being wrong once is a key in a screenshot.
 */
function scrub(message: string): string {
  return message
    .replace(/\b(sk|xai|gsk)-[A-Za-z0-9_-]{8,}/g, "[คีย์]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[คีย์]")
    .slice(0, 200);
}

/**
 * Ask every provider one question, and report which of them answered.
 *
 * There is no way to read this off the usage history. The chat call tries providers in
 * order and stops at the first that answers, so a provider with no usage may be perfectly
 * healthy and simply never reached — and a key that expired this morning looks identical to
 * one that has been fine all year until something actually asks it.
 *
 * So this asks. A few tokens of output each, which is thousandths of a satang, and only when
 * somebody presses the button. The result is not written to the usage ledger: it is a
 * diagnostic about the keys, not work done for a customer.
 */
/**
 * The judge has no chat model to ping, so it is asked the smallest question it can take: one
 * word of state and one yes/no. Same shape of answer as the others, same rule that nothing
 * is written to the ledger.
 */
async function checkJudge(apiKey: string): Promise<ProviderCheck> {
  const provider = JUDGE.provider;
  const began = Date.now();
  try {
    const r = await JUDGE.ask(apiKey, "ping", {
      alive: { type: "noul", instructions: "Is this a greeting?" },
    }, AbortSignal.timeout(CHECK_TIMEOUT_MS));
    return { provider, state: "ok", ms: Date.now() - began, model: r.model };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      provider, state: "failed", ms: Date.now() - began, model: JUDGE.model,
      error: scrub(raw.includes("timeout") || raw.includes("abort") ? `ไม่ตอบภายใน ${CHECK_TIMEOUT_MS / 1000} วินาที` : raw),
    };
  }
}

export async function testProviders(providers: string[]): Promise<ProviderCheck[]> {
  const config = await loadConfig();
  return Promise.all(providers.map(async (provider): Promise<ProviderCheck> => {
    const apiKey = config.keys[provider];
    if (!apiKey) return { provider, state: "no-key", ms: 0 };
    if (provider === JUDGE.provider) return checkJudge(apiKey);

    // an enabled model first, because that is what the bot would actually reach for; a
    // disabled one still proves the key, which is the question being asked
    const models = config.models.filter((m) => m.provider === provider && m.kind === "text");
    const model = models.find((m) => m.enabled) ?? models[0];
    const call = CALLERS[provider];
    if (!model || !call) return { provider, state: "no-model", ms: 0 };

    const began = Date.now();
    try {
      await call({
        apiKey, model: model.model_name,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: CHECK_MAX_TOKENS,
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      return { provider, state: "ok", ms: Date.now() - began, model: model.model_name };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      return {
        provider, state: "failed", ms: Date.now() - began, model: model.model_name,
        error: scrub(raw.includes("timeout") || raw.includes("abort") ? `ไม่ตอบภายใน ${CHECK_TIMEOUT_MS / 1000} วินาที` : raw),
      };
    }
  }));
}
