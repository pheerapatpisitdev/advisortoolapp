import { beforeEach, describe, expect, it, vi } from "vitest";

/** POST /api/content-describe: signed in, a picture of an accepted kind and size, then the engine. */

const AGENT = "11111111-1111-4111-8111-111111111111";
const auth = vi.hoisted(() => ({
  refuseUnless: vi.fn(async (): Promise<Response | null> => null),
  requireMember: vi.fn(async () => ({ agentId: "11111111-1111-4111-8111-111111111111", staff: null })),
}));
vi.mock("@/lib/auth/viewer", () => auth);
const run = vi.hoisted(() => ({ describePicture: vi.fn() }));
vi.mock("@/lib/content/describe-run", () => run);
const hist = vi.hoisted(() => ({ saveReading: vi.fn() }));
vi.mock("@/lib/content/describe-history", async (orig) => ({ ...(await orig<typeof import("@/lib/content/describe-history")>()), ...hist }));

const { POST } = await import("@/app/api/content-describe/route");
const { MAX_IMAGE_BASE64 } = await import("@/lib/content/describe");

const post = (body: unknown) => POST(new Request("http://localhost/api/content-describe", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" },
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.refuseUnless.mockResolvedValue(null);
  run.describePicture.mockResolvedValue({ ok: true, prompt: "p", summaryTh: "s", costThb: 0.4 });
  hist.saveReading.mockResolvedValue("22222222-2222-4222-8222-222222222222");
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
      base64: "AAAA", mimeType: "image/jpeg", palette: [{ hex: "#C41E3A", share: 38 }, { hex: "#FFFFFF", share: 22 }], asPerson: false,
    });
  });

  it("reads a picture whose colours are missing or not a list, with none", async () => {
    await post({ image: { base64: "AAAA", mimeType: "image/jpeg", palette: "red" } });
    expect(run.describePicture).toHaveBeenCalledWith({ base64: "AAAA", mimeType: "image/jpeg", palette: [], asPerson: false });
  });

  it("hands a good picture to the engine, as it came, and returns its answer", async () => {
    const res = await post({ image: { base64: "AAAA", mimeType: "image/png" } });
    expect(run.describePicture).toHaveBeenCalledWith({ base64: "AAAA", mimeType: "image/png", palette: [], asPerson: false });
    expect(await res.json()).toEqual({ ok: true, prompt: "p", summaryTh: "s", costThb: 0.4, saved: false });
  });
});

describe("the history", () => {
  const THUMB = "/9j/" + "A".repeat(200);
  const PALETTE = [{ hex: "#C41E3A", share: 38 }];
  const image = (extra: Record<string, unknown> = {}) => ({ base64: "AAAA", mimeType: "image/jpeg", palette: PALETTE, thumb: THUMB, ...extra });

  it("keeps a good read for the signed-in member, with its thumbnail, and says so", async () => {
    const res = await (await post({ image: image() })).json();
    expect(hist.saveReading).toHaveBeenCalledTimes(1);
    expect(hist.saveReading).toHaveBeenCalledWith(AGENT, { prompt: "p", summaryTh: "s", palette: PALETTE, thumbBase64: THUMB });
    expect(res).toMatchObject({ ok: true, saved: true, id: "22222222-2222-4222-8222-222222222222" });
  });

  it.each([
    ["is not a JPEG", { thumb: "iVBORw0KGgo" + "A".repeat(100) }],
    ["is too long", { thumb: "/9j/" + "A".repeat(150_000) }],
    ["is missing", { thumb: undefined }],
    ["is not a string", { thumb: 7 }],
  ])("reads but does not keep the picture when its thumbnail %s", async (_name, extra) => {
    const res = await (await post({ image: image(extra) })).json();
    expect(hist.saveReading).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, saved: false });
  });

  it("answers the read even when keeping it fails", async () => {
    hist.saveReading.mockRejectedValueOnce(new Error("storage down"));
    const res = await (await post({ image: image() })).json();
    expect(res).toMatchObject({ ok: true, prompt: "p", saved: false });
    expect(res.id).toBeUndefined();
  });

  it("answers the read after 8 seconds even when keeping it hangs, so a slow store cannot cost the paid read", async () => {
    vi.useFakeTimers();
    try {
      hist.saveReading.mockReturnValueOnce(new Promise(() => undefined));
      const pending = post({ image: image() });
      await vi.advanceTimersByTimeAsync(8_001);
      const res = await (await pending).json();
      expect(res).toMatchObject({ ok: true, prompt: "p", saved: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps nothing for a read that failed", async () => {
    run.describePicture.mockResolvedValueOnce({ ok: false, error: "อ่านรูปนี้ไม่สำเร็จ ลองรูปอื่นนะครับ" });
    const res = await (await post({ image: image() })).json();
    expect(hist.saveReading).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, error: "อ่านรูปนี้ไม่สำเร็จ ลองรูปอื่นนะครับ" });
  });

  it("hands the engine the picture and colours only, never the thumbnail", async () => {
    await post({ image: image() });
    expect(run.describePicture).toHaveBeenCalledWith({ base64: "AAAA", mimeType: "image/jpeg", palette: PALETTE, asPerson: false });
  });
});

describe("a read for a library person", () => {
  it("passes asPerson only when it is exactly true", async () => {
    await post({ image: { base64: "AAAA", mimeType: "image/jpeg", asPerson: true } });
    expect(run.describePicture).toHaveBeenLastCalledWith(expect.objectContaining({ asPerson: true }));
    await post({ image: { base64: "AAAA", mimeType: "image/jpeg", asPerson: "yes" } });
    expect(run.describePicture).toHaveBeenLastCalledWith(expect.objectContaining({ asPerson: false }));
  });
});
