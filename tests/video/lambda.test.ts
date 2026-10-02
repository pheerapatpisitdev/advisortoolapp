import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ cmd: null as unknown, fail: null as Error | null, config: null as unknown }));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class { constructor(c: unknown) { sent.config = c; } async send(c: unknown) { if (sent.fail) throw sent.fail; sent.cmd = c; return { StatusCode: 202 }; } },
  InvokeCommand: class { constructor(readonly input: unknown) {} },
}));
const { lambdaEngine, parseAwsKey } = await import("@/lib/video/engines/lambda");

const job = { inputs: [{ name: "in_1", url: "https://s/c.mp4" }], command: "-i {{in_1}} {{out_1}}", outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }] };
beforeEach(() => { sent.cmd = null; sent.fail = null; });

describe("parseAwsKey", () => {
  it("reads id, secret, region and function name; anything else is null", () => {
    expect(parseAwsKey("AKIA1:sec/ret+x:ap-southeast-1:clip-ffmpeg")).toEqual({ accessKeyId: "AKIA1", secretAccessKey: "sec/ret+x", region: "ap-southeast-1", functionName: "clip-ffmpeg" });
    expect(parseAwsKey("AKIA1:secret")).toBeNull();
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
  });
  it("a bad key or an AWS refusal is an error to try elsewhere", async () => {
    await expect(lambdaEngine("nope").submit(job, { callbackUrl: "x", token: "t" })).rejects.toMatchObject({ retryElsewhere: true });
    sent.fail = new Error("AccessDenied");
    await expect(lambdaEngine("A:s:r:f").submit(job, { callbackUrl: "x", token: "t", uploads: {} })).rejects.toMatchObject({ retryElsewhere: true });
  });
});
