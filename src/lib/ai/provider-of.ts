import { EMBEDDERS, JUDGE } from "./providers";
import { TTS_MODEL } from "./tts";
import { ELEVEN_MODEL, ELEVENLABS } from "@/lib/voice/elevenlabs";

/**
 * Which company a ledger line's money went to, by the model it names. The reference table
 * knows the chat and picture models; the rest are priced in code and named here. Shared by
 * ตั้งค่า AI's per-company spend and กำไรค่า AI.
 */
export function providerMap(models: { provider: string; model_name: string }[]): (model: string | null) => string {
  // the embedders and the judge are priced in code, not in the table, and still cost money
  const known = new Map([
    ...models.map((m) => [m.model_name, m.provider] as const),
    ...EMBEDDERS.map((e) => [e.model, e.provider] as const),
    [JUDGE.model, JUDGE.provider] as const,
    // a clip's render, written to the ledger under its engine (src/lib/video/jobs.ts): its key's name here
    ["rendi", "rendi"] as const,
    ["lambda", "aws"] as const,
    ["cloudrun", "gcp"] as const,
    // the วิดีโอนำเสนอ voices (owner, 2026-10-15): priced in code too, so the reference table
    // has neither, and ElevenLabs' row read "ยังไม่มีค่าใช้จ่าย" over ฿28 of clips
    [TTS_MODEL, "google"] as const,
    [ELEVEN_MODEL, ELEVENLABS] as const,
  ]);
  // a model the reference table no longer lists still cost money, and saying so under its
  // own name beats dropping the line and quietly under-reporting the month
  return (model) => known.get(model ?? "") ?? judgeVersionOf(model) ?? (model ? `${model} (ไม่รู้จักค่าย)` : "ไม่ทราบ");
}

/**
 * The judge is asked for by an alias and answers under its version — "jev-latest" out,
 * "jev-1.13.0" back — and the ledger keeps the version, because that is what was paid for.
 * Any version of Jev is TypeSafe's.
 */
function judgeVersionOf(model: string | null): string | undefined {
  return model && model.startsWith(JUDGE.model.split("-")[0]) ? JUDGE.provider : undefined;
}
