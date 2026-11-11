import { providerKey } from "@/lib/ai/client";
import type { EngineName } from "@/lib/content/clip";
import { cloudRunEngine } from "./cloudrun";
import type { RenderEngine } from "./types";

/**
 * The render service: our Cloud Run job, fed by the "gcp" key in the encrypted key store beside
 * the AI keys (render-providers.ts). Rendi and AWS Lambda were removed 2026-11-11 (owner): Cloud
 * Run is the only one, so there is nothing to fall back to.
 */

async function cloudRun(): Promise<RenderEngine | null> {
  const key = await providerKey("gcp");
  return key ? cloudRunEngine(key) : null;
}

/** The engines to try: Cloud Run when its key is set, else none. */
export async function enginesInOrder(): Promise<RenderEngine[]> {
  const e = await cloudRun();
  return e ? [e] : [];
}

/**
 * The engine a job went to, to ask about it. null when its key is gone, or for a job an engine
 * since removed took: such a job can only time out.
 */
export async function engineNamed(name: EngineName): Promise<RenderEngine | null> {
  return name === "cloudrun" ? cloudRun() : null;
}
