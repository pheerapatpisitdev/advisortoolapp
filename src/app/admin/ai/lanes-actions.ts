"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearAiConfigCache } from "@/lib/ai/client";
import { CLOUD_TTS_MODEL, TTS_MODEL } from "@/lib/ai/tts";
import { ELEVEN_MODEL, ELEVENLABS } from "@/lib/voice/elevenlabs";
import { requireStaff } from "@/lib/auth/viewer";
import { WRITERS, shortModel } from "@/lib/content/models";
import {
  LANES, READ_TASKS, isLaneKey, laneDef, laneEntries, parseLanes,
  type LaneEntry, type LaneKey, type SavedLanes, type VoiceService,
} from "@/lib/ai/lanes";
import { PROVIDER_LABEL } from "./labels";
import type { Result } from "./actions";

/**
 * ลำดับหลักและสำรอง on ตั้งค่า AI (owner, 2026-10-21, mockup v3
 * https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey): what each lane holds, what may be added to it,
 * whether each choice can be used now, and how often it did the lane's work in the last 30 days.
 */

/** can this choice be used now: why not, when it cannot */
export type LaneStatus = "ready" | "no-key" | "off-provider" | "model-off";

export interface LaneOption {
  id: string;
  name: string;
  company: string;
  /** the price in the lane's unit, said as the page shows it */
  price: string;
  status: LaneStatus;
}

export interface LaneView {
  key: LaneKey;
  entries: LaneEntry[];
  /** every choice this lane may hold, the ones in it included */
  options: LaneOption[];
  /** the lane's work in the last 30 days, by choice id */
  used: Record<string, number>;
}

const USD_TO_THB = 36;
const DAYS = 30;

/** the companies whose chat models read pictures; of DeepSeek's, only Flash (api-docs.deepseek.com, 2026-10-21) */
const READS_PICTURES = new Set(["anthropic", "openai", "google", "openrouter"]);
const readsPictures = (m: { provider: string; model_name: string }) => READS_PICTURES.has(m.provider) || m.model_name === "deepseek-flash";

/** what the voice services cost, as measured (cloud-tts-move, 2026-10-20) */
const VOICE: Record<VoiceService, { name: string; company: string; price: string; model: string }> = {
  "gemini-api": { name: "เสียง Gemini (API)", company: "Google", price: "≈ ฿0.54 / นาที", model: TTS_MODEL },
  "gemini-cloud": { name: "เสียง Gemini ผ่าน Google Cloud", company: "Google Cloud", price: "≈ ฿0.54 / นาที", model: CLOUD_TTS_MODEL },
  elevenlabs: { name: "ElevenLabs (อ้อม / สมชาย)", company: "ElevenLabs", price: "ตามเครดิต", model: ELEVEN_MODEL },
};

/** the tasks that write a whole post or ad; the rest of Studio's text work is the helpers' */
const POST_TASKS = new Set(["content", "content-thumbnail-ideas"]);
const BOT_TASK = /^(route|small_talk|smalltalk|plan_info)(_|$)/;

/** the lane a ledger line's work belongs to — the ledger keeps the task, not the size asked for */
function laneOfLine(task: string, kind: "text" | "image" | "voice", model: string): LaneKey | null {
  if (kind === "voice") return "voice";
  if (kind === "image") return model === "gemini-3.1-flash-image" ? "image-face" : "image-plain";
  if (task === "chat-review") return "bot-large";
  if (BOT_TASK.test(task)) return "bot-small";
  if (READ_TASKS.has(task)) return "write-read";
  return POST_TASKS.has(task) ? "write-post" : "write-help";
}

interface ModelLine { id: string; provider: string; kind: string; model_name: string; enabled: boolean; price: { inputPerMTokUsd?: number; outputPerMTokUsd?: number; perImageUsd?: number } }

/** the picture models as the Studio's painter list calls them */
const IMAGE_NAME: Record<string, string> = {
  "gpt-image-medium": "GPT Image (มาตรฐาน)", "gpt-image-high": "GPT Image (คมชัด)",
  "gemini-image-lite": "Gemini Image Lite", "gemini-image": "Gemini Image",
};

const baht = (n: number) => (n === 0 ? "ฟรี" : `฿${n >= 10 ? Math.round(n).toLocaleString("th-TH") : n.toFixed(2)}`);

/** a text model's price in a lane's unit: 1,000 short answers (1,500 tokens in, 300 out), or one post */
function textPrice(m: ModelLine, key: LaneKey): string {
  const cost = (inTok: number, outTok: number) => ((inTok * (m.price.inputPerMTokUsd ?? 0) + outTok * (m.price.outputPerMTokUsd ?? 0)) / 1e6) * USD_TO_THB;
  if (key === "write-post") {
    // the bake-off's measured price where there is one; an estimate of one post's tokens otherwise
    const measured = WRITERS.find((w) => w.model === m.model_name && w.thb > 0)?.thb;
    return measured !== undefined ? `฿${measured.toFixed(2)} / ชิ้น` : `≈ ${baht(cost(3000, 1200))} / ชิ้น`;
  }
  return baht(cost(1500, 300) * 1000);
}

async function context() {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const [models, prefs, keys, settings, counts] = await Promise.all([
    supabase.from("model_configs").select("id, provider, kind, model_name, enabled, price"),
    supabase.from("ins_model_prefs").select("model_id, enabled"),
    supabase.from("ins_api_keys").select("provider, enabled"),
    supabase.from("ins_ai_settings").select("lanes").maybeSingle(),
    supabase.rpc("ins_task_model_counts", { p_since: since }),
  ]);
  const off = new Set((prefs.data ?? []).filter((p) => !p.enabled).map((p) => p.model_id as string));
  const held = new Map(((keys.data ?? []) as { provider: string; enabled: boolean | null }[]).map((k) => [k.provider, k.enabled !== false]));
  const known = new Set(Object.keys(PROVIDER_LABEL));
  const lines = ((models.data ?? []) as ModelLine[])
    // the reference table is shared with another product: only the companies this system calls,
    // and never a free model, which a fallback must not reach (owner, 2026-10-14)
    .filter((m) => known.has(m.provider) && m.provider !== "moonshot" && !m.model_name.endsWith(":free"))
    .map((m) => ({ ...m, enabled: m.enabled && !off.has(m.id) }));
  const status = (provider: string, enabled = true): LaneStatus =>
    !held.has(provider) ? "no-key" : !held.get(provider) ? "off-provider" : enabled ? "ready" : "model-off";
  return {
    lines, status,
    saved: settings.error ? {} : parseLanes((settings.data as { lanes?: unknown } | null)?.lanes),
    counts: counts.error ? [] : ((counts.data ?? []) as { task: string; model: string; calls: number | string }[]),
    savable: !settings.error,
  };
}

function optionsOf(key: LaneKey, ctx: Awaited<ReturnType<typeof context>>): LaneOption[] {
  const def = laneDef(key);
  if (def.kind === "voice") {
    return (Object.keys(VOICE) as VoiceService[]).map((id) => ({
      id, name: VOICE[id].name, company: VOICE[id].company, price: VOICE[id].price,
      status: id === "gemini-api" ? ctx.status("google") : id === "gemini-cloud" ? ctx.status("gcp") : ctx.status(ELEVENLABS),
    }));
  }
  return ctx.lines
    .filter((m) => m.kind === def.kind && (!def.readsPictures || readsPictures(m)))
    .map((m) => ({
      // text lanes name a model by its name; picture lanes by its row, two qualities sharing a name
      id: def.kind === "text" ? m.model_name : m.id,
      name: def.kind === "text" ? shortModel(m.model_name) : IMAGE_NAME[m.id] ?? m.id,
      company: PROVIDER_LABEL[m.provider] ?? m.provider,
      price: def.kind === "text" ? textPrice(m, key) : `${baht((m.price.perImageUsd ?? 0) * USD_TO_THB)} / รูป`,
      status: ctx.status(m.provider, m.enabled),
    }));
}

function usedOf(key: LaneKey, ctx: Awaited<ReturnType<typeof context>>, options: LaneOption[]): Record<string, number> {
  const def = laneDef(key);
  const used: Record<string, number> = {};
  for (const line of ctx.counts) {
    let id: string | undefined;
    if (def.kind === "voice") id = (Object.keys(VOICE) as VoiceService[]).find((v) => VOICE[v].model === line.model);
    else if (def.kind === "image") id = ctx.lines.find((m) => m.kind === "image" && m.model_name === line.model && options.some((o) => o.id === m.id))?.id;
    else id = options.find((o) => o.id === line.model)?.id;
    const model = ctx.lines.find((m) => m.model_name === line.model);
    const kind = def.kind === "voice" ? (id ? "voice" : null) : model?.kind === def.kind ? def.kind : null;
    if (!id || !kind || laneOfLine(line.task, kind, line.model) !== key) continue;
    used[id] = (used[id] ?? 0) + Number(line.calls);
  }
  return used;
}

export async function loadLanes(): Promise<{ lanes: LaneView[]; savable: boolean }> {
  await requireStaff("backoffice");
  const ctx = await context();
  return {
    savable: ctx.savable,
    lanes: LANES.map((l) => {
      const options = optionsOf(l.key, ctx);
      return { key: l.key, entries: laneEntries(ctx.saved, l.key), options, used: usedOf(l.key, ctx, options) };
    }),
  };
}

/**
 * Saves one group's lanes. Every id must be a choice that lane may hold, none twice; and each lane
 * must keep at least one choice that is switched on and can be used now, or its work would stop.
 */
export async function saveLanes(lanes: { key: string; entries: LaneEntry[] }[]): Promise<Result> {
  await requireStaff("backoffice");
  const ctx = await context();
  if (!ctx.savable) return { ok: false, error: "บันทึกลำดับไม่ได้ ฐานข้อมูลยังไม่พร้อม (รอ migration)" };
  const next: SavedLanes = { ...ctx.saved };
  for (const { key, entries } of lanes) {
    if (!isLaneKey(key) || !Array.isArray(entries)) return { ok: false, error: "ลำดับที่ส่งมาไม่ถูกต้อง ลองโหลดหน้าใหม่" };
    const options = optionsOf(key, ctx);
    const ids = entries.map((e) => e?.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: `“${laneDef(key).title}” มีตัวเลือกซ้ำกัน` };
    const unknown = entries.find((e) => typeof e?.on !== "boolean" || !options.some((o) => o.id === e.id));
    if (unknown) return { ok: false, error: `“${laneDef(key).title}” ใส่ ${String(unknown?.id)} ไม่ได้` };
    const ready = entries.some((e) => e.on && options.find((o) => o.id === e.id)?.status === "ready");
    if (!ready) {
      return { ok: false, error: `บันทึกไม่ได้: “${laneDef(key).title}” ไม่มีตัวที่พร้อมใช้เลย งานนี้จะหยุดทำงาน ติ๊กเปิดอย่างน้อยหนึ่งตัวที่ขึ้นว่า พร้อม` };
    }
    next[key] = entries.map(({ id, on }) => ({ id, on }));
  }
  try {
    const { error } = await supabaseAdmin().from("ins_ai_settings")
      .upsert({ id: true, lanes: next, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return { ok: false, error: `บันทึกลำดับไม่สำเร็จ (${error.message})` };
  } catch (e) {
    console.error("บันทึกลำดับไม่สำเร็จ:", e);
    return { ok: false, error: "บันทึกลำดับไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  clearAiConfigCache();
  revalidatePath("/admin/ai");
  return { ok: true };
}
