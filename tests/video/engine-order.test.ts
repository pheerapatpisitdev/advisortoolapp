import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineName } from "@/lib/content/clip";

/**
 * Which render engines a job is offered to, and in what order: the owner's pick first; with
 * fallback on, every other engine that has a key, in the fixed order rendi → cloudrun → lambda.
 * The keys and the settings row are faked; the engines are the real ones, never called.
 */

const keys = vi.hoisted(() => ({ held: {} as Record<string, string | undefined> }));
vi.mock("@/lib/ai/client", () => ({ providerKey: async (p: string) => keys.held[p] ?? null }));
const settings = vi.hoisted(() => ({ engine: "rendi" as EngineName, fallback: true }));
vi.mock("@/lib/video/settings", () => ({
  videoSettings: async () => ({ engine: settings.engine, fallback: settings.fallback, rendiMaxSeconds: 60, enabled: true }),
}));

const { enginesInOrder, engineNamed } = await import("@/lib/video/engines/index");

const ALL = { rendi: "rendi-key-1234", aws: "AKIA:secret:ap-southeast-1:clip-ffmpeg", gcp: '{"client_email":"x@y"}' };
const names = async () => (await enginesInOrder()).map((e) => e.name);

beforeEach(() => { keys.held = { ...ALL }; settings.engine = "rendi"; settings.fallback = true; });

describe("enginesInOrder", () => {
  it("with every key and fallback on: the pick first, then the others in the fixed order", async () => {
    const expected: Record<EngineName, EngineName[]> = {
      rendi: ["rendi", "cloudrun", "lambda"],
      cloudrun: ["cloudrun", "rendi", "lambda"],
      lambda: ["lambda", "rendi", "cloudrun"],
    };
    for (const pick of ["rendi", "cloudrun", "lambda"] as EngineName[]) {
      settings.engine = pick;
      expect(await names()).toEqual(expected[pick]);
    }
  });

  it("with fallback off: the pick alone — or nothing when it has no key", async () => {
    settings.fallback = false;
    for (const pick of ["rendi", "cloudrun", "lambda"] as EngineName[]) {
      settings.engine = pick;
      expect(await names()).toEqual([pick]);
    }
    keys.held.gcp = undefined;
    settings.engine = "cloudrun";
    expect(await names()).toEqual([]);
  });

  it("leaves out every engine without a key, the pick among them, and never lists one twice", async () => {
    const cases: { pick: EngineName; held: (keyof typeof ALL)[]; want: EngineName[] }[] = [
      { pick: "cloudrun", held: ["rendi", "aws"], want: ["rendi", "lambda"] },
      { pick: "cloudrun", held: ["gcp"], want: ["cloudrun"] },
      { pick: "rendi", held: ["aws"], want: ["lambda"] },
      { pick: "rendi", held: ["gcp", "aws"], want: ["cloudrun", "lambda"] },
      { pick: "lambda", held: ["gcp"], want: ["cloudrun"] },
      { pick: "lambda", held: ["rendi", "aws"], want: ["lambda", "rendi"] },
      { pick: "rendi", held: [], want: [] },
    ];
    for (const c of cases) {
      settings.engine = c.pick;
      keys.held = Object.fromEntries(c.held.map((k) => [k, ALL[k]]));
      const got = await names();
      expect(got, `${c.pick} with ${c.held.join(",")}`).toEqual(c.want);
      expect(new Set(got).size).toBe(got.length);
    }
  });
});

describe("engineNamed", () => {
  it("finds a job's engine by name, Cloud Run included, whatever the pick and fallback; null without its key", async () => {
    settings.engine = "rendi";
    settings.fallback = false;
    const cr = await engineNamed("cloudrun");
    expect(cr?.name).toBe("cloudrun");
    expect(cr?.takesId).toBe(true);
    expect(await cr?.status("job-1")).toBeNull(); // callback only: a re-poll learns nothing
    expect((await engineNamed("lambda"))?.name).toBe("lambda");
    expect((await engineNamed("rendi"))?.name).toBe("rendi");
    keys.held.gcp = undefined;
    expect(await engineNamed("cloudrun")).toBeNull();
  });
});
