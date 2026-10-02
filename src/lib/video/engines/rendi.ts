import type { FfmpegJob } from "../command";
import { EngineError, type JobStatus, type RenderEngine } from "./types";

/** Rendi: FFmpeg as a service (https://rendi.dev). Outputs stay on Rendi until deleted. */
export const RENDI_API = "https://api.rendi.dev/v1";

export function rendiEngine(key: string, maxSeconds: number): RenderEngine {
  const headers = { "X-API-KEY": key, "Content-Type": "application/json" };
  async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    try {
      return await fetch(`${RENDI_API}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new EngineError("ติดต่อ Rendi ไม่ได้", true);
    }
  }
  return {
    name: "rendi",
    async submit(job: FfmpegJob) {
      const res = await call("/run-ffmpeg-command", {
        method: "POST",
        body: JSON.stringify({
          input_files: Object.fromEntries(job.inputs.map((i) => [i.name, i.url])),
          output_files: Object.fromEntries(job.outputs.map((o) => [o.name, o.file])),
          ffmpeg_command: job.command,
          max_command_run_seconds: maxSeconds,
        }),
      }, 30_000);
      const body = await res.json().catch(() => ({})) as { command_id?: string; detail?: unknown };
      if (!res.ok || !body.command_id) {
        // a key, a plan or a rate limit: the other engine may do it; a 4xx about the command will fail there too
        const elsewhere = res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500;
        throw new EngineError(`Rendi ไม่รับงาน (${res.status})`, elsewhere);
      }
      return { id: body.command_id };
    },
    async status(id: string): Promise<JobStatus> {
      const res = await call(`/commands/${encodeURIComponent(id)}`, { method: "GET" }, 15_000);
      if (!res.ok) throw new EngineError(`อ่านสถานะงานจาก Rendi ไม่ได้ (${res.status})`, true);
      const b = await res.json().catch(() => ({})) as {
        status?: string; error_message?: string;
        output_files?: Record<string, { storage_url?: string; file_id?: string }>;
      };
      if (b.status === "SUCCESS") {
        const outputs = Object.fromEntries(Object.entries(b.output_files ?? {})
          .filter(([, f]) => f?.storage_url)
          .map(([k, f]) => [k, { url: f.storage_url!, ...(f.file_id ? { fileId: f.file_id } : {}) }]));
        return { state: "done", outputs };
      }
      if (b.status === "FAILED") return { state: "failed", error: b.error_message ?? "Rendi ทำงานไม่สำเร็จ" };
      return { state: b.status === "QUEUED" ? "queued" : "running" };
    },
    async cleanup(status: JobStatus) {
      for (const f of Object.values(status.outputs ?? {})) {
        if (!f.fileId) continue;
        const res = await call(`/files/${encodeURIComponent(f.fileId)}`, { method: "DELETE" }, 15_000).catch(() => null);
        if (res && !res.ok && res.status !== 404) console.error(`rendi file ${f.fileId} not deleted: ${res.status}`);
      }
    },
  };
}
