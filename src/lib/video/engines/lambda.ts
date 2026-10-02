import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { EngineError, mayHaveReached, type RenderEngine } from "./types";

/**
 * Our own ffmpeg on AWS Lambda (owner, 2026-10-02), infra/lambda-ffmpeg. Invoked without
 * waiting; it writes the outputs into our storage itself and calls back. The key is kept in
 * the encrypted key store as ACCESS_KEY_ID:SECRET:REGION:FUNCTION_NAME.
 */
export function parseAwsKey(key: string): { accessKeyId: string; secretAccessKey: string; region: string; functionName: string } | null {
  const parts = key.split(":");
  if (parts.length !== 4 || parts.some((p) => !p)) return null;
  const [accessKeyId, secretAccessKey, region, functionName] = parts;
  if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) return null;
  return { accessKeyId, secretAccessKey, region, functionName };
}

const INVOKE_TIMEOUT_MS = 10_000;

/** the SDK's service errors carry the HTTP status AWS answered with; a network failure or an abort has none */
function awsAnswered(e: unknown): boolean {
  const meta = e && typeof e === "object" ? (e as { $metadata?: { httpStatusCode?: unknown } }).$metadata : undefined;
  return typeof meta?.httpStatusCode === "number";
}

export function lambdaEngine(key: string): RenderEngine {
  return {
    name: "lambda",
    // the id is ours to give, so the job is on the row before the function can call back about it
    takesId: true,
    async submit(job, opts) {
      const aws = parseAwsKey(key);
      if (!aws) throw new EngineError("ตั้งค่า AWS ไม่ครบ", true);
      const id = opts.id ?? crypto.randomUUID();
      const client = new LambdaClient({ region: aws.region, credentials: { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey }, maxAttempts: 1 });
      try {
        await client.send(new InvokeCommand({
          FunctionName: aws.functionName,
          InvocationType: "Event",
          Payload: new TextEncoder().encode(JSON.stringify({ id, job, uploads: opts.uploads ?? {}, callbackUrl: opts.callbackUrl, token: opts.token })),
        }), { abortSignal: AbortSignal.timeout(INVOKE_TIMEOUT_MS) }); // an invoke must never hang a server action
      } catch (e) {
        // name and message only, never the error object (it may carry the request config)
        console.error("lambda invoke failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
        // AWS answered (an HTTP status came back): a refusal, nothing queued. No answer at all (the
        // 10 s abort, a dropped connection): the event may have been queued — the job may be running
        throw new EngineError("ส่งงานให้ AWS ไม่ได้", true, !awsAnswered(e) && mayHaveReached(e));
      }
      return { id };
    },
    async status() { return null; },
    async cleanup() { /* the function writes straight into our storage */ },
  };
}
