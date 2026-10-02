import { providerKey } from "@/lib/ai/client";
import type { EngineName } from "@/lib/content/clip";
import { videoSettings, type VideoSettings } from "../settings";
import { lambdaEngine } from "./lambda";
import { rendiEngine } from "./rendi";
import type { RenderEngine } from "./types";

/**
 * Which render services to use (owner, 2026-10-02). The keys live in the encrypted key store
 * beside the AI keys: "rendi", and "aws" for the Lambda engine (render-providers.ts).
 */

async function makers(): Promise<{ s: VideoSettings; make: Record<EngineName, () => RenderEngine | null> }> {
  const [s, rendiKey, awsKey] = await Promise.all([videoSettings(), providerKey("rendi"), providerKey("aws")]);
  return {
    s,
    make: {
      rendi: () => (rendiKey ? rendiEngine(rendiKey, s.rendiMaxSeconds) : null),
      lambda: () => (awsKey ? lambdaEngine(awsKey) : null),
    },
  };
}

/** The engines to try, the owner's pick first; the other only when fallback is on and it has a key. */
export async function enginesInOrder(): Promise<RenderEngine[]> {
  const { s, make } = await makers();
  const order = s.engine === "lambda" ? (["lambda", "rendi"] as const) : (["rendi", "lambda"] as const);
  const first = make[order[0]]();
  const second = s.fallback ? make[order[1]]() : null;
  return [first, second].filter((e): e is RenderEngine => e !== null);
}

/**
 * The engine a job went to, to ask about it — whatever the owner has picked since, and with
 * fallback on or off. null when its key is gone: the job can only time out.
 */
export async function engineNamed(name: EngineName): Promise<RenderEngine | null> {
  return (await makers()).make[name]();
}
