import { supabaseAdmin } from "@/lib/supabase/admin";
import { liveProviders, providerKey, testProviders } from "@/lib/ai/client";
import { TTS_MODEL, TTS_VOICE } from "@/lib/ai/tts";
import { alertAiDown } from "@/lib/line/owner-alert";
import { siteUrl } from "@/lib/site-url";
import { alertText, fresh, GEMINI_VOICE, step, voiceDue, type Event, type Health } from "./health-rules";

/**
 * The AI-down check, run every 30 minutes by the database's scheduler (owner chose ก ก,
 * 2026-10-19). The rules — two failures in a row, one message down and one back — are in
 * health-rules.ts; this reads and writes the standing and sends the message.
 */

/** the providers on ตั้งค่า AI; the render services share the key table but have no ping */
const CHECKED = ["anthropic", "openai", "google", "zai", "typhoon", "deepseek", "typesafe", "elevenlabs", "openrouter"];

interface Row {
  provider: string; ok: boolean; fails: number; down_since: string | null;
  last_checked: string | null; last_error: string | null; alerted: boolean;
}
const fromRow = (r: Row): Health => ({
  provider: r.provider, ok: r.ok, fails: r.fails, downSince: r.down_since,
  lastChecked: r.last_checked, lastError: r.last_error, alerted: r.alerted,
});
const toRow = (h: Health): Row => ({
  provider: h.provider, ok: h.ok, fails: h.fails, down_since: h.downSince,
  last_checked: h.lastChecked, last_error: h.lastError, alerted: h.alerted,
});

export async function readHealth(): Promise<Health[]> {
  const { data, error } = await supabaseAdmin().from("ins_ai_health")
    .select("provider, ok, fails, down_since, last_checked, last_error, alerted");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

const VOICE_TIMEOUT_MS = 30_000;

/**
 * Gemini's voice asked to say one word, with no waiting out a busy minute: a check that fails
 * once is asked again in half an hour, and only two failures in a row reach the owner. Not on
 * the usage ledger, like the other checks — a diagnostic, not work for anyone.
 */
async function checkVoice(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  // now and then the voice answers 200 with no audio and speaks when asked again, as speakThai
  // knows (src/lib/ai/tts.ts) — seen on the second live run, 2026-10-19
  const first = await askVoice(apiKey);
  return first.error === "no audio" ? askVoice(apiKey) : first;
}

async function askVoice(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        // said as an instruction, the way speakThai asks: a bare word is taken as a question, and
        // the voice model refuses with a 400 "tried to generate text" (first live run, 2026-10-19)
        contents: [{ parts: [{ text: "พูดว่า: สวัสดีครับ" }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
        },
      }),
      signal: AbortSignal.timeout(VOICE_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: `${res.status}: ${(body.error?.message ?? "").slice(0, 160)}` };
    const audio = body.candidates?.[0]?.content?.parts?.some((p) => p.inlineData?.data);
    return audio ? { ok: true } : { ok: false, error: "no audio" };
  } catch (e) {
    return { ok: false, error: e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "ไม่ตอบภายใน 30 วินาที" : String(e).slice(0, 160) };
  }
}

export interface HealthRun { checked: string[]; events: Event[]; sent: boolean }

/** One round: ask, fold in, save, and tell the owner what changed. */
export async function runHealthCheck(now = new Date()): Promise<HealthRun> {
  const at = now.toISOString();
  const [live, prior] = await Promise.all([liveProviders(), readHealth()]);
  const before = new Map(prior.map((h) => [h.provider, h]));
  const providers = CHECKED.filter((p) => live.includes(p));
  const googleKey = live.includes("google") ? await providerKey("google") : null;
  const askVoice = Boolean(googleKey) && voiceDue(before.get(GEMINI_VOICE), now.getTime());

  const [checks, voice] = await Promise.all([
    testProviders(providers),
    askVoice ? checkVoice(googleKey!) : Promise.resolve(null),
  ]);
  const results: { provider: string; ok: boolean; error?: string }[] = checks
    // no model to ask is not an outage: nothing would reach for it either
    .filter((c) => c.state === "ok" || c.state === "failed")
    .map((c) => ({ provider: c.provider, ok: c.state === "ok", error: c.error }));
  if (voice) results.push({ provider: GEMINI_VOICE, ...voice });

  const events: Event[] = [];
  const after = new Map(before);
  for (const r of results) {
    const { next, event } = step(before.get(r.provider) ?? fresh(r.provider), r, at);
    after.set(r.provider, next);
    if (event) events.push(event);
  }
  // a provider switched off or without a key is no longer watched, and its end is not news
  const gone = [...after.keys()].filter((p) => p === GEMINI_VOICE ? !googleKey : !providers.includes(p));
  for (const p of gone) after.delete(p);

  const db = supabaseAdmin();
  const changed = results.map((r) => toRow(after.get(r.provider)!));
  if (changed.length) {
    const { error } = await db.from("ins_ai_health").upsert(changed, { onConflict: "provider" });
    if (error) throw new Error(error.message);
  }
  if (gone.length) {
    const { error } = await db.from("ins_ai_health").delete().in("provider", gone);
    if (error) console.error("[ai-health] old rows not removed:", error.message);
  }

  const text = alertText(events, [...after.values()], siteUrl("/admin/ai"));
  const sent = text ? await alertAiDown(text) : false;
  return { checked: results.map((r) => r.provider), events, sent };
}
