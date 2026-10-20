/** What each company is called on the back-office pages: ตั้งค่า AI and การใช้งานและค่า AI. */
export const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)", google: "Google (Gemini)", zai: "Z.ai (GLM)",
  typhoon: "Typhoon (SCB 10X)", moonshot: "Kimi (Moonshot)", openrouter: "OpenRouter (สำรองรวมหลายเจ้า)",
  typesafe: "TypeSafe (Jev)", elevenlabs: "ElevenLabs (เสียงพากย์)",
  // the clip renderers write to the same ledger; named here for the all-provider breakdown
  rendi: "Rendi", aws: "AWS Lambda", gcp: "Google Cloud Run", fal: "fal.ai (ภาพขยับ)", runware: "Runware (ภาพขยับ)",
};

/**
 * A company's line where money is added up (การใช้งานและค่า AI, กำไรค่า AI): Gemini's writing, its
 * two voice ways and Cloud Run's clips each on their own (owner, 2026-10-20, ก). The key rows keep
 * PROVIDER_LABEL: one Google key still serves both the writing and the API voice.
 */
const SPEND_LABEL: Record<string, string> = {
  google: "Google (Gemini) · ข้อความ / ภาพ",
  gcp: "Google Cloud Run · ทำวิดีโอ",
  "google-voice": "Google (เสียง Gemini API)",
  "gcp-voice": "Google Cloud (เสียง Gemini สำรอง)",
};
export const spendLabel = (provider: string): string => SPEND_LABEL[provider] ?? PROVIDER_LABEL[provider] ?? provider;
