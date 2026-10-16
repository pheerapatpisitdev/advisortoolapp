/** What each company is called on the back-office pages: ตั้งค่า AI and การใช้งานและค่า AI. */
export const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)", google: "Google (Gemini)", zai: "Z.ai (GLM)",
  typhoon: "Typhoon (SCB 10X)", moonshot: "Kimi (Moonshot)", openrouter: "OpenRouter (สำรองรวมหลายเจ้า)",
  typesafe: "TypeSafe (Jev)", elevenlabs: "ElevenLabs (เสียงพากย์)",
  // the clip renderers write to the same ledger; named here for the all-provider breakdown
  rendi: "Rendi", aws: "AWS Lambda", gcp: "Google Cloud Run", fal: "fal.ai (ภาพขยับ)",
};
