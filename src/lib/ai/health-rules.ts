/**
 * The rules of the AI-down alert to the owner's LINE (owner chose ก ก, 2026-10-19; mockup
 * https://claude.ai/artifact/GG8y7e4CvaRW5gLn8nBXrx), kept apart from the database and LINE so
 * they can be tested on their own.
 *
 * Every provider with a live key is asked one word every 30 minutes; Gemini's voice every two
 * hours, because each ask spends one of its 100 a day. A provider is called down only after two
 * checks in a row fail — one stumble that clears itself is normal and not worth waking anyone
 * for — and the owner hears twice per outage: when it goes down and when it comes back.
 */

/** the pseudo-provider for Gemini's speech model, checked apart from Gemini's writing */
export const GEMINI_VOICE = "google-tts";

/** checks that must fail in a row before the owner is told */
export const FAILS_TO_ALERT = 2;

/** Gemini's voice is asked this often while it answers, every run while it does not */
export const VOICE_EVERY_MS = 2 * 60 * 60_000;
/** a run lands a little late or early; a voice checked 1 h 58 min ago is due */
const VOICE_SLACK_MS = 10 * 60_000;

/** the companies that write the bot's answers — when all of them fail, the bot is silent */
export const WRITERS = ["anthropic", "openai", "google", "zai", "typhoon", "deepseek", "openrouter"] as const;

/** What the owner sees each provider called, in LINE and on /admin/line. */
export const HEALTH_LABEL: Record<string, string> = {
  anthropic: "Anthropic", openai: "OpenAI", google: "Google (Gemini)", zai: "Z.ai", typhoon: "Typhoon", deepseek: "DeepSeek",
  typesafe: "TypeSafe", elevenlabs: "ElevenLabs", openrouter: "OpenRouter", [GEMINI_VOICE]: "เสียงพากย์ Gemini",
};
export const healthLabel = (p: string) => HEALTH_LABEL[p] ?? p;

/** One provider's standing, as kept between runs. */
export interface Health {
  provider: string;
  ok: boolean;
  /** failed checks in a row */
  fails: number;
  /** when the first of those failures was seen */
  downSince: string | null;
  lastChecked: string | null;
  lastError: string | null;
  /** the down message went out for this outage, so its end is worth a message too */
  alerted: boolean;
}

export const fresh = (provider: string): Health => ({
  provider, ok: true, fails: 0, downSince: null, lastChecked: null, lastError: null, alerted: false,
});

export type Event =
  | { kind: "down"; provider: string; since: string; error: string }
  | { kind: "up"; provider: string; since: string; at: string };

/** One check's result folded into the standing; an event when the owner should hear of it. */
export function step(prev: Health, result: { ok: boolean; error?: string }, now: string): { next: Health; event: Event | null } {
  if (result.ok) {
    const next: Health = { ...fresh(prev.provider), lastChecked: now };
    return { next, event: prev.alerted && prev.downSince ? { kind: "up", provider: prev.provider, since: prev.downSince, at: now } : null };
  }
  const fails = prev.fails + 1;
  const downSince = prev.downSince ?? now;
  const error = result.error ?? "";
  const tell = fails >= FAILS_TO_ALERT && !prev.alerted;
  return {
    next: { provider: prev.provider, ok: false, fails, downSince, lastChecked: now, lastError: error, alerted: prev.alerted || tell },
    event: tell ? { kind: "down", provider: prev.provider, since: downSince, error } : null,
  };
}

/** Whether Gemini's voice is asked on this run. */
export function voiceDue(prev: Health | undefined, now: number): boolean {
  if (!prev?.lastChecked || prev.fails > 0) return true;
  return now - Date.parse(prev.lastChecked) >= VOICE_EVERY_MS - VOICE_SLACK_MS;
}

/**
 * A provider's refusal in the owner's words. The credit check comes before the status: Anthropic
 * says an empty balance with a 400 and OpenAI with a 429, and both mean "top up", not "wait".
 */
export function reason(error: string): string {
  const code = error.match(/\b([1-5]\d\d)\b/)?.[1];
  const tag = code ? ` (${code})` : "";
  if (/ไม่ตอบภายใน|timeout|abort/i.test(error)) return "ไม่ตอบภายใน 15 วินาที";
  if (/credit|balance|insufficient|billing|payment/i.test(error) || code === "402") return `เงินในบัญชีผู้ให้บริการหมด ต้องเติม${tag}`;
  if (code === "401" || code === "403") return `กุญแจใช้ไม่ได้หรือหมดอายุ ต้องใส่กุญแจใหม่${tag}`;
  if (code === "429") return `เกินโควตา หรือเครดิตหมด${tag}`;
  if (code && code.startsWith("5")) return `ฝั่งผู้ให้บริการล่ม รอเขาแก้${tag}`;
  if (/no audio|ไม่มีเสียง/i.test(error)) return "ตอบกลับมาแต่ไม่มีเสียง";
  return `ตอบผิดปกติ${tag}`;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

/** "1 ชม. 30 นาที", "45 นาที", "2 วัน 3 ชม." */
export function lasted(fromIso: string, toIso: string): string {
  const mins = Math.max(1, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [d && `${d} วัน`, h && `${h} ชม.`, !d && m && `${m} นาที`].filter(Boolean).join(" ");
}

/**
 * The one message a run sends, or null when nothing changed. Everything that changed on one
 * run goes in one push, because each push is one of the account's 300 a month.
 *
 * `standing` is every checked provider after the run, so the message can say who is still
 * answering in a down provider's place, and whether every writer is now down.
 */
export function alertText(events: Event[], standing: Health[], link: string): string | null {
  if (events.length === 0) return null;
  const down = events.filter((e): e is Extract<Event, { kind: "down" }> => e.kind === "down");
  const up = events.filter((e): e is Extract<Event, { kind: "up" }> => e.kind === "up");
  const checkedWriters = standing.filter((h) => (WRITERS as readonly string[]).includes(h.provider));
  const writersOk = checkedWriters.filter((h) => h.ok).map((h) => healthLabel(h.provider));
  const allWritersDown = checkedWriters.length > 0 && writersOk.length === 0
    && down.some((e) => (WRITERS as readonly string[]).includes(e.provider));

  const blocks: string[] = [];
  if (allWritersDown) {
    const since = checkedWriters.map((h) => h.downSince).filter((s): s is string => Boolean(s)).sort()[0];
    blocks.push([
      "🚨 AI ตอบไม่ได้ทุกเจ้า",
      checkedWriters.map((h) => healthLabel(h.provider)).join(" · "),
      "บอทตอบลูกค้าไม่ได้ และทำโพสต์/คลิปไม่ได้",
      ...(since ? [`ตั้งแต่ ${clock(since)} น.`] : []),
    ].join("\n"));
  }
  for (const e of down) {
    if (allWritersDown && (WRITERS as readonly string[]).includes(e.provider)) continue;
    const lines = ["⚠️ AI ใช้ไม่ได้", healthLabel(e.provider), `สาเหตุ: ${reason(e.error)}`, `ตั้งแต่ ${clock(e.since)} น. · ตรวจไม่ผ่าน ${FAILS_TO_ALERT} รอบติด`];
    if ((WRITERS as readonly string[]).includes(e.provider) && writersOk.length > 0) {
      lines.push("", `บอทยังตอบลูกค้าได้ ใช้ ${writersOk.join(", ")} แทน`);
    }
    if (e.provider === GEMINI_VOICE) {
      const eleven = standing.find((h) => h.provider === "elevenlabs");
      lines.push("", eleven?.ok ? "เสียงพากย์คลิปจะเปลี่ยนไปใช้ ElevenLabs" : "คลิปที่ต้องใช้เสียงพากย์จะทำไม่ได้");
    }
    blocks.push(lines.join("\n"));
  }
  for (const e of up) {
    blocks.push(["✅ AI กลับมาใช้ได้แล้ว", healthLabel(e.provider), `ใช้ไม่ได้ ${lasted(e.since, e.at)} (${clock(e.since)}–${clock(e.at)} น.)`].join("\n"));
  }
  return [...blocks, down.length ? link : null].filter(Boolean).join("\n\n");
}
