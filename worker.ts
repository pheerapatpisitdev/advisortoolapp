// The Worker's entry on Cloudflare (wrangler.jsonc "main"): OpenNext's app, plus the consumer of LATER_QUEUE, the
// work runLater sends there (src/lib/later.ts). Each message is handed to the app's own /api/later and waited for,
// so a job has a request's time rather than a Worker tail's 30 seconds. A message is never retried: an answer sent
// twice to a customer is worse than one that failed and was logged.
// @ts-expect-error .open-next/worker.js is written by the build (npm run cf:build)
import { default as handler } from "./.open-next/worker.js";

interface Env { WORKER_SELF_REFERENCE: { fetch: (input: string, init?: RequestInit) => Promise<Response> } }
interface QueueMessage { body: unknown; ack(): void }

export default {
  fetch: handler.fetch,
  async queue(batch: { messages: readonly QueueMessage[] }, env: Env): Promise<void> {
    await Promise.all(batch.messages.map(async (m) => {
      try {
        const res = await env.WORKER_SELF_REFERENCE.fetch("https://advisortool.app/api/later", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(m.body),
        });
        if (!res.ok) console.error(`later queue: ${res.status} ${(await res.text()).slice(0, 200)}`);
      } catch (e) {
        console.error("later queue: not run:", e instanceof Error ? e.message : e);
      }
      m.ack();
    }));
  },
};

// @ts-expect-error written by the build, as above
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
