import type { EngineName } from "@/lib/content/clip";
import type { FfmpegJob } from "../command";

export type JobState = "queued" | "running" | "done" | "failed";
export interface JobStatus { state: JobState; outputs?: Record<string, { url: string; fileId?: string }>; error?: string }

/** A service that runs one ffmpeg command for us (owner, 2026-10-02: Rendi or our Lambda, switchable). */
export interface RenderEngine {
  name: EngineName;
  /**
   * The engine runs a job under the id it is handed (opts.id), so the job can be recorded before
   * the engine hears of it and a callback that comes back at once finds it (Lambda). Without it
   * the engine names the job itself (Rendi) and the job is recorded once submit answers.
   */
  takesId?: boolean;
  /**
   * uploads: where an engine that writes our storage itself (Lambda, Cloud Run) puts each output; id: the job's id, for an engine that takesId;
   * payloadUrl: a signed link to the whole job written as a file, for an engine that fetches it itself (Cloud Run)
   */
  submit(job: FfmpegJob, opts: { callbackUrl: string; token: string; uploads?: Record<string, { uploadUrl: string; path: string }>; id?: string; payloadUrl?: string }): Promise<{ id: string }>;
  /** null: this engine answers by webhook only. throws when the engine could not be asked (network, rate limit, 5xx): the caller asks again later and never fails over on it; a job that never answers fails at EDIT_JOB_TIMEOUT_MS */
  status(id: string): Promise<JobStatus | null>;
  /** lets the engine's own copies of the outputs go, once we have ours */
  cleanup(status: JobStatus): Promise<void>;
}

export class EngineError extends Error {
  /**
   * retryElsewhere: the other engine may well succeed (a key, a plan, a network) — not a bad command.
   * mayBeTaken: the submit's outcome is unknown — the request went out and no answer came back
   * (a timeout, a dropped connection), so the engine may be running the job now. The caller keeps
   * the job as taken and never hands it to another engine: it ends by callback or by the time limit.
   */
  constructor(message: string, readonly retryElsewhere: boolean, readonly mayBeTaken = false) {
    super(message);
    this.name = "EngineError";
  }
}

/** network failures where no connection was ever made, so nothing can have reached the engine */
const NEVER_CONNECTED = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"]);

/**
 * A request that failed without an answer may still have been taken — unless the failure says the
 * connection was never made (the host not found or refusing). A timeout says nothing either way.
 */
export function mayHaveReached(e: unknown): boolean {
  const codes = [e, e instanceof Error ? e.cause : undefined].map((x) => (x && typeof x === "object" ? (x as { code?: unknown }).code : undefined));
  return !codes.some((c) => typeof c === "string" && NEVER_CONNECTED.has(c));
}
