import { beforeEach, describe, expect, it, vi } from "vitest";

/** POST /api/content-describe: signed in, a picture of an accepted kind and size, then the engine. */

const auth = vi.hoisted(() => ({ refuseUnless: vi.fn(async (): Promise<Response | null> => null) }));
vi.mock("@/lib/auth/viewer", () => auth);
const run = vi.hoisted(() => ({ describePicture: vi.fn() }));
vi.mock("@/lib/content/describe-run", () => run);

const { POST } = await import("@/app/api/content-describe/route");
const { MAX_IMAGE_BASE64 } = await import("@/lib/content/describe");

const post = (body: unknown) => POST(new Request("http://localhost/api/content-describe", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.refuseUnless.mockResolvedValue(null);
  run.describePicture.mockResolvedValue({ ok: true, prompt: "p", summaryTh: "s", costThb: 0.4 });
});

describe("POST /api/content-describe", () => {
  it("answers 401 when nobody is signed in, and reads nothing", async () => {
    auth.refuseUnless.mockResolvedValueOnce(Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 }));
    expect((await post({ image: { base64: "AAAA", mimeType: "image/jpeg" } })).status).toBe(401);
    expect(run.describePicture).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "not json"],
    ["no image", {}],
    ["no base64", { image: { mimeType: "image/jpeg" } }],
    ["base64 not a string", { image: { base64: 5, mimeType: "image/jpeg" } }],
    ["a type that is not accepted", { image: { base64: "AAAA", mimeType: "image/gif" } }],
    ["a body that is too big", { image: { base64: "A".repeat(MAX_IMAGE_BASE64 + 1), mimeType: "image/jpeg" } }],
  ])("answers 400 for %s, before any round", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false });
    expect(run.describePicture).not.toHaveBeenCalled();
  });

  it("passes on the measured colours, checked: capitals, at most six, and nothing that is not a colour", async () => {
    const palette = [{ hex: "#c41e3a", share: 38 }, { hex: "javascript:alert(1)", share: 20 }, { hex: "#FFFFFF", share: 22.4 }];
    await post({ image: { base64: "AAAA", mimeType: "image/jpeg", palette } });
    expect(run.describePicture).toHaveBeenCalledWith({
      base64: "AAAA", mimeType: "image/jpeg", palette: [{ hex: "#C41E3A", share: 38 }, { hex: "#FFFFFF", share: 22 }],
    });
  });

  it("reads a picture whose colours are missing or not a list, with none", async () => {
    await post({ image: { base64: "AAAA", mimeType: "image/jpeg", palette: "red" } });
    expect(run.describePicture).toHaveBeenCalledWith({ base64: "AAAA", mimeType: "image/jpeg", palette: [] });
  });

  it("hands a good picture to the engine, as it came, and returns its answer", async () => {
    const res = await post({ image: { base64: "AAAA", mimeType: "image/png" } });
    expect(run.describePicture).toHaveBeenCalledWith({ base64: "AAAA", mimeType: "image/png", palette: [] });
    expect(await res.json()).toEqual({ ok: true, prompt: "p", summaryTh: "s", costThb: 0.4 });
  });
});
