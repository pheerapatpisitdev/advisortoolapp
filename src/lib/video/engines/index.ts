import { providerKey } from "@/lib/ai/client";
import type { EngineName } from "@/lib/content/clip";
import { videoSettings, type VideoSettings } from "../settings";
import { cloudRunEngine } from "./cloudrun";
import { lambdaEngine } from "./lambda";
import { rendiEngine } from "./rendi";
import type { RenderEngine } from "./types";

/**
 * Which render services to use (owner, 2026-10-02). The keys live in the encrypted key store
 * beside the AI keys: "rendi", "aws" for the Lambda engine and "gcp" for the Cloud Run one
 * (render-providers.ts).
 */

/** the order the engines other than the owner's pick are tried in, when fallback is on */
const FALLBACK_ORDER: readonly EngineName[] = ["rendi", "cloudrun", "lambda"];

async function makers(): Promise<{ s: VideoSettings; make: Record<EngineName, () => RenderEngine | null> }> {
  const [s, rendiKey, awsKey, gcpKey] = await Promise.all([videoSettings(), providerKey("rendi"), providerKey("aws"), providerKey("gcp")]);
  return {
    s,
    make: {
      rendi: () => (rendiKey ? rendiEngine(rendiKey, s.rendiMaxSeconds) : null),
      lambda: () => (awsKey ? lambdaEngine(awsKey) : null),
      cloudrun: () => (gcpKey ? cloudRunEngine(gcpKey) : null),
    },
  };
}

/**
 * The engines to try: the owner's pick first; then, only when fallback is on, every other one
 * that has a key, in the fixed order rendi → cloudrun → lambda. No engine is in it twice.
 */
export async function enginesInOrder(): Promise<RenderEngine[]> {
  const { s, make } = await makers();
  const order = [s.engine, ...(s.fallback ? FALLBACK_ORDER.filter((n) => n !== s.engine) : [])];
  return order.map((n) => make[n]()).filter((e): e is RenderEngine => e !== null);
}

/**
 * The engine a job went to, to ask about it — whatever the owner has picked since, and with
 * fallback on or off. null when its key is gone: the job can only time out.
 */
export async function engineNamed(name: EngineName): Promise<RenderEngine | null> {
  return (await makers()).make[name]?.() ?? null;
}
