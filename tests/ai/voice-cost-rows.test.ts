import { describe, expect, it } from "vitest";
import { providerMap, VOICE_API, VOICE_CLOUD } from "@/lib/ai/provider-of";
import { CLOUD_TTS_MODEL, TTS_MODEL } from "@/lib/ai/tts";
import { PROVIDER_LABEL, spendLabel } from "@/app/admin/ai/labels";

// Gemini's two voice ways on lines of their own where money is added up (owner, 2026-10-20, ก)
describe("the voice cost lines", () => {
  const of = providerMap([{ provider: "google", model_name: "gemini-2.5-flash" }]);

  it("puts each voice way on its own line, apart from Gemini's writing and Cloud Run's clips", () => {
    expect(of(TTS_MODEL)).toBe(VOICE_API);
    expect(of(CLOUD_TTS_MODEL)).toBe(VOICE_CLOUD);
    expect(of("gemini-2.5-flash")).toBe("google");
    expect(of("cloudrun")).toBe("gcp");
  });

  it("names them by what they paid for", () => {
    expect(spendLabel(VOICE_API)).toBe("Google (เสียง Gemini API)");
    expect(spendLabel(VOICE_CLOUD)).toBe("Google Cloud (เสียง Gemini สำรอง)");
    expect(spendLabel("google")).toBe("Google (Gemini) · ข้อความ / ภาพ");
    expect(spendLabel("gcp")).toBe("Google Cloud Run · ทำวิดีโอ");
    expect(spendLabel("anthropic")).toBe(PROVIDER_LABEL.anthropic);
  });

  it("leaves the key rows' names alone", () => {
    expect(PROVIDER_LABEL.google).toBe("Google (Gemini)");
    expect(PROVIDER_LABEL.gcp).toBe("Google Cloud Run");
  });
});
