import { beforeEach, describe, expect, it, vi } from "vitest";

/** The clip editor's live player reads the clip's preview through a GET that redirects to a signed link (2026-10-02). */

const deps = vi.hoisted(() => ({
  refuseUnless: vi.fn(),
  getContent: vi.fn(),
  clipReadUrl: vi.fn(),
}));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: deps.refuseUnless }));
vi.mock("@/lib/content/store", () => ({ getContent: deps.getContent }));
vi.mock("@/lib/content/clip-store", () => ({ clipReadUrl: deps.clipReadUrl }));

const { GET } = await import("@/app/api/content-video/[id]/proxy/route");

const ID = "6fc789ce-1234-4abc-8def-0123456789ab";
const PATH = `${ID}/0f8fad5b-d9cb-469f-a165-70867728950e.mp4`;
const PROXY = `${ID}/1b4e28ba-2fa1-11d2-883f-0016d3cca427.mp4`;
const call = (id: string) => GET(new Request(`http://localhost/api/content-video/${id}/proxy`), { params: Promise.resolve({ id }) });
const piece = (video?: Record<string, unknown>) => ({ id: ID, output: { video } });
const edit = (more: Record<string, unknown> = {}) => ({ cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: "r1", ...more });

beforeEach(() => {
  vi.clearAllMocks();
  deps.refuseUnless.mockResolvedValue(null);
  deps.clipReadUrl.mockResolvedValue("https://storage.example/signed?token=p");
});

describe("GET /api/content-video/[id]/proxy", () => {
  it("sends a prepared clip to its preview's signed link, never cached", async () => {
    deps.getContent.mockResolvedValue(piece({ path: PATH, caption: "", edit: edit({ proxyPath: PROXY, silences: [] }) }));
    const res = await call(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.example/signed?token=p");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    // the preview, never the full-quality original
    expect(deps.clipReadUrl).toHaveBeenCalledWith(PROXY, 3600);
  });

  it("answers 404 for no clip, no preview yet, an expired clip, or a piece the caller may not see", async () => {
    deps.getContent.mockResolvedValueOnce(piece());
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "" }));
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "", edit: edit() }));
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "", expired: true, edit: edit({ proxyPath: PROXY }) }));
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(null);
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockRejectedValueOnce(new Error("read failed"));
    expect((await call(ID)).status).toBe(404);
    expect(deps.clipReadUrl).not.toHaveBeenCalled();
  });

  it("answers 502 when the link cannot be signed", async () => {
    deps.getContent.mockResolvedValue(piece({ path: PATH, caption: "", edit: edit({ proxyPath: PROXY }) }));
    deps.clipReadUrl.mockRejectedValue(new Error("storage down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call(ID);
    err.mockRestore();
    expect(res.status).toBe(502);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("answers 400 for an id that is not a uuid, before reading anything", async () => {
    const res = await call("../secret");
    expect(res.status).toBe(400);
    expect(deps.getContent).not.toHaveBeenCalled();
  });

  it("passes the refusal through for someone not signed in", async () => {
    deps.refuseUnless.mockResolvedValue(Response.json({ ok: false }, { status: 401 }));
    const res = await call(ID);
    expect(res.status).toBe(401);
    expect(deps.getContent).not.toHaveBeenCalled();
  });
});
