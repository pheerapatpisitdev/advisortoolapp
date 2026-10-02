import type { EngineName } from "@/lib/content/clip";
import type { FfmpegJob } from "../command";

export type JobState = "queued" | "running" | "done" | "failed";
export interface JobStatus { state: JobState; outputs?: Record<string, { url: string; fileId?: string }>; error?: string }

/** A service that runs one ffmpeg command for us (owner, 2026-10-02: Rendi or our Lambda, switchable). */
export interface RenderEngine {
  name: EngineName;
  /** uploads: where an engine that writes our storage itself (Lambda) puts each output */
  submit(job: FfmpegJob, opts: { callbackUrl: string; token: string; uploads?: Record<string, { uploadUrl: string; path: string }> }): Promise<{ id: string }>;
  /** null: this engine answers by webhook only. throws when the engine could not be asked (network, rate limit, 5xx): the caller asks again later and never fails over on it; a job that never answers fails at EDIT_JOB_TIMEOUT_MS */
  status(id: string): Promise<JobStatus | null>;
  /** lets the engine's own copies of the outputs go, once we have ours */
  cleanup(status: JobStatus): Promise<void>;
}

export class EngineError extends Error {
  /** retryElsewhere: the other engine may well succeed (a key, a plan, a network) — not a bad command */
  constructor(message: string, readonly retryElsewhere: boolean) {
    super(message);
    this.name = "EngineError";
  }
}
