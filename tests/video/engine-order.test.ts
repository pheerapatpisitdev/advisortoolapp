import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which render engines a job is offered to: our Cloud Run job alone since 2026-11-11 (owner
 * removed Rendi and AWS Lambda), and only while its key is held. The key is faked; the engine is
 * the real one, never called.
 */

const keys = vi.hoisted(() => ({ held: {} as Record<string, string | undefined> }));
vi.mock("@/lib/ai/client", () => ({ providerKey: async (p: string) => keys.held[p] ?? null }));

const { enginesInOrder, engineNamed } = await import("@/lib/video/engines/index");

const GCP = '{"client_email":"x@y"}';
const names = async () => (await enginesInOrder()).map((e) => e.name);

beforeEach(() => { keys.held = { gcp: GCP }; });

describe("enginesInOrder", () => {
  it("is Cloud Run when its key is held", async () => {
    expect(await names()).toEqual(["cloudrun"]);
  });

  it("is nothing without the Google key, whatever other keys are left in the store", async () => {
    keys.held = { rendi: "rendi-key-1234", aws: "AKIA:secret:ap-southeast-1:clip-ffmpeg", shotstack: "ss-key" };
    expect(await names()).toEqual([]);
  });
});

describe("engineNamed", () => {
  it("finds Cloud Run; null without its key, and null for an engine since removed", async () => {
    const cr = await engineNamed("cloudrun");
    expect(cr?.name).toBe("cloudrun");
    expect(cr?.takesId).toBe(true);
    expect(await cr?.status("job-1")).toBeNull(); // callback only: a re-poll learns nothing
    keys.held = { rendi: "rendi-key-1234", aws: "AKIA:secret:ap-southeast-1:clip-ffmpeg" };
    expect(await engineNamed("rendi" as never)).toBeNull();
    expect(await engineNamed("lambda" as never)).toBeNull();
    expect(await engineNamed("cloudrun")).toBeNull();
  });
});
