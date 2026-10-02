"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearAiConfigCache, testProviders, type ProviderCheck } from "@/lib/ai/client";
import { monthSpend, monthStart, type SpendLine } from "@/lib/ai/ledger";
import { contentBaht, DEFAULT_CONTENT_CAP_THB } from "@/lib/content/store";
import { EMBEDDERS, JUDGE } from "@/lib/ai/providers";
import { checkBudgets } from "./budget";
import { requireStaff } from "@/lib/auth/viewer";
import { walletChargedThb } from "@/lib/wallet/store";
import { saveVideoSettings, videoSettings, type VideoSettings } from "@/lib/video/settings";
import { parseAwsKey } from "@/lib/video/engines/lambda";

export type { ProviderCheck } from "@/lib/ai/client";

/**
 * The companies this system can call. xAI was here until 2026-09-17: the account was blocked
 * for want of credit, so every Grok call failed, and the owner asked for it to go rather than
 * sit in the chain costing a failed attempt whenever the fallback reached it.
 */
const PROVIDERS = ["anthropic", "openai", "google", "zai", "typesafe"] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * The video render services. Their keys live in the same encrypted table as the AI keys but
 * are NOT in PROVIDERS: the fallback chain and checkKeys walk PROVIDERS, and neither should
 * ever see a service that has no model. loadConfig (src/lib/ai/client.ts) only looks a key up
 * by a model's provider, so extra rows in the table are never reached by it.
 * "aws" is the key's name; the engine it feeds is called "lambda".
 */
export const RENDER_PROVIDERS = ["rendi", "aws"] as const;
export type RenderProvider = (typeof RENDER_PROVIDERS)[number];

export interface VideoKeyRow { provider: RenderProvider; tail: string }

export interface KeyRow { provider: string; tail: string; enabled: boolean }
export interface ModelRow {
  id: string; provider: string; kind: string; model_name: string; enabled: boolean;
  /**
   * The quality an image model is asked for, when its row says. OpenAI's picture model sits in
   * the table twice — `gpt-image-medium` and `gpt-image-high`, one model at two prices (฿0.43
   * and ฿0.86 a picture, both offered on /content) — and without this the table showed two
   * identical "gpt-image-2" lines, which read as a mistake rather than as a choice.
   */
  quality?: string | null;
}

/**
 * What every action that changes something answers with.
 *
 * Returned rather than thrown: Next hides a thrown message in production and puts "An error
 * occurred in the Server Components render" in its place, so every Thai sentence written
 * here to tell the owner what was wrong reached them as English that said nothing.
 */
export type Result = { ok: true } | { ok: false; error: string };

/** A database refusal, said in Thai, with the database's own words kept for whoever reads it next. */
function failed(what: string, e: unknown): Result {
  console.error(`${what}:`, e);
  const detail = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  return { ok: false, error: detail ? `${what} (${detail})` : `${what} ลองใหม่อีกครั้ง` };
}

/**
 * The one model that is not in the reference table, because that table is shared with
 * another product and its provider list is a database constraint. Listed here so the page
 * shows it beside the others; it cannot be switched off from the page, since nothing calls
 * it yet and the key itself is the switch.
 */
const JUDGE_ROW: ModelRow = { id: `${JUDGE.provider}-${JUDGE.model}`, provider: JUDGE.provider, kind: "judge", model_name: JUDGE.model, enabled: true, quality: null };
export interface Settings { small_model: string | null; large_model: string | null; monthly_budget_thb: number | null; content_budget_thb: number | null }

/** What one provider has cost since the first of the month, and what it was asked to do. */
export interface ProviderSpend {
  provider: string;
  calls: number;
  baht: number;
  /** the tasks it was used for, busiest first — "copilot", "route", "plan_info"… */
  tasks: string[];
}

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET ยังไม่ได้ตั้ง");
  return s;
}

/** Never returns a whole key: the page only ever sees the last four characters. */
export async function loadAiPage(): Promise<{
  keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[];
  /** null when the ledger could not be read — the page still opens, so the keys stay reachable */
  spentThisMonth: number | null; spend: ProviderSpend[];
  /**
   * What the content workbench has spent of its own ceiling, the ceiling in force, and what
   * that ceiling is when the box is left empty — the page says so beside the box.
   */
  content: { spent: number | null; cap: number; fallback: number };
  /** the clip render services: how they are set, and the last four characters of each key held */
  video: { settings: VideoSettings; keys: VideoKeyRow[] };
}> {
  await requireStaff("admin");
  const supabase = supabaseAdmin();
  const [keys, models, prefs, settings, spend] = await Promise.all([
    supabase.from("ins_api_keys").select("provider, tail, enabled"),
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled, params").order("provider").order("model_name"),
    supabase.from("ins_model_prefs").select("model_id, enabled"),
    supabase.from("ins_ai_settings").select("small_model, large_model, monthly_budget_thb, content_budget_thb").maybeSingle(),
    // the model rather than the provider is what the ledger records, so the lines are joined
    // back to the model table below; the ledger has no column saying which company was paid
    //
    // It is allowed to fail. It used to take the whole page down with it — Promise.all rejects
    // on the first refusal — and this page is where the keys are, which is the first place
    // anybody goes when the AI is misbehaving. A missing figure is said on the page instead.
    monthSpend(monthStart()).catch((e) => {
      console.error("อ่านยอดใช้ AI ไม่สำเร็จ:", e);
      return null;
    }),
  ]);
  // the ceiling leaves out what agents paid for from their wallets (src/lib/content/store.ts),
  // so the figure beside it does too, or the two disagree by exactly that (owner, 2026-09-30)
  const contentSpent = spend ? Math.max(0, contentBaht(spend.lines) - (await walletChargedThb(monthStart()))) : null;
  const disabled = new Set((prefs.data ?? []).filter((p) => !p.enabled).map((p) => p.model_id));
  const heldKeys = (keys.data ?? []) as { provider: string; tail: string; enabled: boolean | null }[];
  // a settings row that cannot be read must not take the keys page down with it
  const videoCfg = await videoSettings().catch((e) => {
    console.error("อ่านการตั้งค่าตัดต่อไม่สำเร็จ:", e instanceof Error ? e.message : "unknown");
    return { engine: "rendi", fallback: true, rendiMaxSeconds: 60 } as VideoSettings;
  });
  return {
    video: {
      settings: videoCfg,
      keys: heldKeys.filter((k): k is typeof k & { provider: RenderProvider } => (RENDER_PROVIDERS as readonly string[]).includes(k.provider))
        .map((k) => ({ provider: k.provider, tail: k.tail })),
    },
    keys: heldKeys
      .filter((k) => (PROVIDERS as readonly string[]).includes(k.provider))
      .map((k) => ({ provider: k.provider, tail: k.tail, enabled: k.enabled !== false })),
    /**
     * Only the companies above. `model_configs` is shared with another product, so it lists
     * models this system has no key for and no code to call — Grok is in it still, and would
     * otherwise go on being offered here as something to switch on.
     */
    models: [
      ...(models.data ?? [])
        .filter((m) => (PROVIDERS as readonly string[]).includes(m.provider))
        .map(({ params, ...m }) => ({
          ...m,
          enabled: m.enabled && !disabled.has(m.id),
          quality: typeof (params as { quality?: unknown } | null)?.quality === "string" ? String((params as { quality: string }).quality) : null,
        })),
      JUDGE_ROW,
    ],
    settings: settings.data ?? null,
    providers: [...PROVIDERS],
    spentThisMonth: spend ? spend.baht : null,
    spend: spend ? byProvider(spend.lines, (models.data ?? []) as { provider: string; model_name: string }[]) : [],
    content: {
      spent: contentSpent,
      cap: settings.data?.content_budget_thb == null ? DEFAULT_CONTENT_CAP_THB : Number(settings.data.content_budget_thb),
      fallback: DEFAULT_CONTENT_CAP_THB,
    },
  };
}

/**
 * The month's spending, one line per company.
 *
 * A single total says the month is costing money; it does not say which of five keys is
 * doing it, and that is the question somebody looking at this card is actually asking.
 */
/**
 * The judge is asked for by an alias and answers under its version — "jev-latest" out,
 * "jev-1.13.0" back — and the ledger keeps the version, because that is what was paid for.
 * The card is asked which company, so any version of Jev is TypeSafe's.
 */
function judgeVersionOf(model: string | null): string | undefined {
  return model && model.startsWith(JUDGE.model.split("-")[0]) ? JUDGE.provider : undefined;
}

function byProvider(lines: SpendLine[], models: { provider: string; model_name: string }[]): ProviderSpend[] {
  // the embedders and the judge are priced in code, not in the table, and still cost money
  const providerOf = new Map([
    ...models.map((m) => [m.model_name, m.provider] as const),
    ...EMBEDDERS.map((e) => [e.model, e.provider] as const),
    [JUDGE.model, JUDGE.provider] as const,
  ]);
  const acc = new Map<string, { calls: number; baht: number; tasks: Map<string, number> }>();
  for (const l of lines) {
    // a model the reference table no longer lists still cost money, and saying so under its
    // own name beats dropping the line and quietly under-reporting the month
    const provider = providerOf.get(l.model ?? "") ?? judgeVersionOf(l.model) ?? (l.model ? `${l.model} (ไม่รู้จักค่าย)` : "ไม่ทราบ");
    const at = acc.get(provider) ?? { calls: 0, baht: 0, tasks: new Map<string, number>() };
    at.calls += l.calls;
    at.baht += l.baht;
    const task = l.task ?? "ไม่ระบุ";
    at.tasks.set(task, (at.tasks.get(task) ?? 0) + l.calls);
    acc.set(provider, at);
  }
  return [...acc.entries()]
    .map(([provider, v]) => ({
      provider, calls: v.calls, baht: v.baht,
      tasks: [...v.tasks.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
    }))
    .sort((a, b) => b.baht - a.baht);
}

/**
 * Everything a key is not.
 *
 * An API key is printable ASCII by construction, and `trim()` only cleans the ends. One
 * arrived here with U+2028 — a line separator, invisible, picked up from a copied web page
 * — ninety characters in, and every xAI call then died building its own HTTP header:
 * "character at index 91 has a value of 8232". On the page that reads as the provider
 * being down, which it was not, and no amount of re-reading the provider's status would
 * ever have said so. (":" is printable, so an AWS key's separators survive.)
 */
const cleanKey = (key: string) => String(key ?? "").replace(/[^\x21-\x7e]/g, "");

/** Encrypts and stores one key. Messages never carry the key itself. */
async function storeKey(provider: string, value: string): Promise<Result> {
  try {
    const { error } = await supabaseAdmin().rpc("ins_set_api_key", {
      p_provider: provider, p_key: value, p_passphrase: passphrase(),
    });
    if (error) return failed("บันทึกกุญแจไม่สำเร็จ", error);
  } catch (e) {
    return failed("บันทึกกุญแจไม่สำเร็จ", e);
  }
  clearAiConfigCache();
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function saveApiKey(provider: string, key: string): Promise<Result> {
  await requireStaff("admin");
  if (!PROVIDERS.includes(provider as Provider)) return { ok: false, error: "ค่ายไม่ถูกต้อง" };
  const value = cleanKey(key);
  if (value.length < 8) return { ok: false, error: "กุญแจสั้นเกินไป — วางกุญแจทั้งเส้นอีกครั้ง" };
  return storeKey(provider, value);
}

/**
 * The key of a video render service. Rendi's is a plain API key; AWS's is one string,
 * "accessKeyId:secretAccessKey:region:functionName", checked here so a half-pasted one is
 * refused now instead of failing the first clip.
 */
export async function saveRenderKey(provider: RenderProvider, key: string): Promise<Result> {
  await requireStaff("admin");
  if (!(RENDER_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, error: "บริการไม่ถูกต้อง" };
  const value = cleanKey(key);
  if (value.length < 8) return { ok: false, error: "กุญแจสั้นเกินไป — วางกุญแจทั้งเส้นอีกครั้ง" };
  if (provider === "aws" && !parseAwsKey(value)) {
    return { ok: false, error: "กุญแจ AWS ต้องเป็นรูปแบบ accessKeyId:secretAccessKey:region:functionName ครบสี่ส่วน" };
  }
  return storeKey(provider, value);
}

/** Which service renders clips, whether the other is tried when it cannot, and Rendi's time limit. */
export async function saveVideoEngine(s: VideoSettings): Promise<Result> {
  await requireStaff("admin");
  if (s?.engine !== "rendi" && s?.engine !== "lambda") return { ok: false, error: "ตัวตัดต่อไม่ถูกต้อง" };
  if (s.rendiMaxSeconds !== 60 && s.rendiMaxSeconds !== 600) return { ok: false, error: "เวลาสูงสุดของ Rendi ต้องเป็น 60 หรือ 600 วินาที" };
  try {
    await saveVideoSettings({ engine: s.engine, fallback: Boolean(s.fallback), rendiMaxSeconds: s.rendiMaxSeconds });
  } catch (e) {
    return failed("บันทึกตัวตัดต่อไม่สำเร็จ", e);
  }
  revalidatePath("/admin/ai");
  return { ok: true };
}

/**
 * The switch beside a key. Off means the provider is not called at all — its models leave
 * the fallback chain, the judge refuses — and the key stays where it is for when it is
 * wanted again. For TypeSafe it is also the shadow's off switch.
 */
export async function setProviderEnabled(provider: string, enabled: boolean): Promise<Result> {
  await requireStaff("admin");
  if (!PROVIDERS.includes(provider as Provider)) return { ok: false, error: "ค่ายไม่ถูกต้อง" };
  try {
    const { error } = await supabaseAdmin().from("ins_api_keys").update({ enabled: Boolean(enabled) }).eq("provider", provider);
    if (error) return failed("เปิด/ปิดค่ายไม่สำเร็จ", error);
  } catch (e) {
    return failed("เปิด/ปิดค่ายไม่สำเร็จ", e);
  }
  clearAiConfigCache();
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function setModelEnabled(id: string, enabled: boolean): Promise<Result> {
  await requireStaff("admin");
  if (!id || typeof id !== "string") return { ok: false, error: "ไม่รู้จักโมเดลนี้" };
  try {
    const { error } = await supabaseAdmin().from("ins_model_prefs")
      .upsert({ model_id: id, enabled: Boolean(enabled), updated_at: new Date().toISOString() }, { onConflict: "model_id" });
    if (error) return failed("เปิด/ปิดโมเดลไม่สำเร็จ", error);
  } catch (e) {
    return failed("เปิด/ปิดโมเดลไม่สำเร็จ", e);
  }
  clearAiConfigCache();
  revalidatePath("/admin/ai");
  return { ok: true };
}

/**
 * The defaults and the two budgets. The budgets come as the strings typed into the boxes and
 * are read here, by the rules in ./budget.ts — the browser is not the guard.
 */
export async function saveSettings(smallModel: string, largeModel: string, monthlyBudget: string, contentBudget: string): Promise<Result> {
  await requireStaff("admin");
  const budgets = checkBudgets(monthlyBudget, contentBudget, DEFAULT_CONTENT_CAP_THB);
  if (!budgets.ok) return budgets;
  try {
    const { error } = await supabaseAdmin().from("ins_ai_settings").upsert({
      id: true, small_model: smallModel || null, large_model: largeModel || null,
      monthly_budget_thb: budgets.monthly, content_budget_thb: budgets.content, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) return failed("บันทึกค่าเริ่มต้นไม่สำเร็จ", error);
  } catch (e) {
    return failed("บันทึกค่าเริ่มต้นไม่สำเร็จ", e);
  }
  clearAiConfigCache();
  revalidatePath("/admin/ai");
  return { ok: true };
}

/**
 * Which providers are answering right now.
 *
 * On demand rather than on load: it costs a token per provider, which is nothing, but a
 * page that spends money every time it is opened is a page nobody should have written.
 */
export async function checkKeys(): Promise<ProviderCheck[]> {
  await requireStaff("admin");
  return testProviders([...PROVIDERS]);
}
