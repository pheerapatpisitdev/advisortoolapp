import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ cmd: null as unknown, opts: null as unknown, fail: null as Error | null, config: null as unknown }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class { constructor(c: unknown) { sent.config = c; } async send(c: unknown, o?: unknown) { if (sent.fail) throw sent.fail; sent.cmd = c; sent.opts = o; return { StatusCode: 202 }; } },
  InvokeCommand: class { constructor(readonly input: unknown) {} },
}));
const { lambdaEngine, parseAwsKey } = await import("@/lib/video/engines/lambda");

const job = { inputs: [{ name: "in_1", url: "https://s/c.mp4" }], command: "-i {{in_1}} {{out_1}}", outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }] };
beforeEach(() => { sent.cmd = null; sent.fail = null; });

describe("parseAwsKey", () => {
  it("reads id, secret, region and function name; anything else is null", () => {
    expect(parseAwsKey("AKIA1:sec/ret+x:ap-southeast-1:clip-ffmpeg")).toEqual({ accessKeyId: "AKIA1", secretAccessKey: "sec/ret+x", region: "ap-southeast-1", functionName: "clip-ffmpeg" });
    expect(parseAwsKey("AKIA1:secret")).toBeNull();
    // a malformed region is refused, so it can never be sent anywhere
    expect(parseAwsKey("AKIA1:s:evil.example.com/x:clip-ffmpeg")).toBeNull();
    expect(parseAwsKey("AKIA1:s:r:clip-ffmpeg")).toBeNull();
  });
});

describe("lambdaEngine", () => {
  it("invokes the function without waiting, carrying the job, where to upload, and how to call back", async () => {
    const e = lambdaEngine("AKIA1:s:ap-southeast-1:clip-ffmpeg");
    const { id } = await e.submit(job, { callbackUrl: "https://app/api/content-video/job", token: "t", uploads: { out_1: { uploadUrl: "https://s/up", path: "p/x.mp4" } } });
    const input = (sent.cmd as { input: { FunctionName: string; InvocationType: string; Payload: Uint8Array } }).input;
    expect(input.FunctionName).toBe("clip-ffmpeg");
    expect(input.InvocationType).toBe("Event");
    expect(JSON.parse(new TextDecoder().decode(input.Payload))).toEqual({ id, job, uploads: { out_1: { uploadUrl: "https://s/up", path: "p/x.mp4" } }, callbackUrl: "https://app/api/content-video/job", token: "t" });
    expect(await e.status(id)).toBeNull();
    // never hangs a server action: one attempt, aborted after a few seconds
    expect((sent.config as { maxAttempts: number }).maxAttempts).toBe(1);
    expect((sent.opts as { abortSignal: AbortSignal }).abortSignal).toBeInstanceOf(AbortSignal);
  });
  it("a bad key or an AWS refusal is an error to try elsewhere, and nothing was queued", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(lambdaEngine("nope").submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: false });
    // a service error: AWS answered with an HTTP status
    sent.fail = Object.assign(new Error("AccessDenied"), { name: "AccessDeniedException", $metadata: { httpStatusCode: 403, attempts: 1 } });
    await expect(lambdaEngine("A:s:us-east-1:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: false });
    sent.fail = Object.assign(new Error("Rate exceeded"), { name: "TooManyRequestsException", $metadata: { httpStatusCode: 429 } });
    await expect(lambdaEngine("A:s:us-east-1:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ mayBeTaken: false });
    // no connection was ever made: the region's endpoint not found
    sent.fail = Object.assign(new Error("getaddrinfo ENOTFOUND lambda.r.amazonaws.com"), { code: "ENOTFOUND", $metadata: { attempts: 1 } });
    await expect(lambdaEngine("A:s:us-east-1:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ mayBeTaken: false });
  });
  it("an invoke with no answer (the 10 s abort, a dropped connection) may have been queued: its outcome is unknown", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // the SDK adds $metadata (attempts) to every error it retried, but an HTTP status only to an AWS answer
    sent.fail = Object.assign(new Error("Request aborted"), { name: "AbortError", $metadata: { attempts: 1 } });
    await expect(lambdaEngine("A:s:us-east-1:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ retryElsewhere: true, mayBeTaken: true });
    sent.fail = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    await expect(lambdaEngine("A:s:us-east-1:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ mayBeTaken: true });
  });
});
