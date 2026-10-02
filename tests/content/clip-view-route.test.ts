import { beforeEach, describe, expect, it, vi } from "vitest";

/** The editor's player reads the clip through a GET that redirects to a signed link (2026-10-02). */

const deps = vi.hoisted(() => ({
  refuseUnless: vi.fn(),
  getContent: vi.fn(),
  clipReadUrl: vi.fn(),
}));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: deps.refuseUnless }));
vi.mock("@/lib/content/store", () => ({ getContent: deps.getContent }));
vi.mock("@/lib/content/clip-store", () => ({ clipReadUrl: deps.clipReadUrl }));

const { GET } = await import("@/app/api/content-video/[id]/route");

const ID = "6fc789ce-1234-4abc-8def-0123456789ab";
const PATH = `${ID}/0f8fad5b-d9cb-469f-a165-70867728950e.mp4`;
const TAKE = `${ID}/9a8b7c6d-1111-4222-8333-444455556666.mp4`;
const call = (id: string, query = "") => GET(new Request(`http://localhost/api/content-video/${id}${query}`), { params: Promise.resolve({ id }) });
const piece = (video?: Record<string, unknown>) => ({ id: ID, output: { video } });

beforeEach(() => {
  vi.clearAllMocks();
  deps.refuseUnless.mockResolvedValue(null);
  deps.clipReadUrl.mockResolvedValue("https://storage.example/signed?token=t");
});

describe("GET /api/content-video/[id]", () => {
  it("sends a piece with a clip to its signed link, never cached", async () => {
    deps.getContent.mockResolvedValue(piece({ path: PATH, caption: "" }));
    const res = await call(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.example/signed?token=t");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(deps.clipReadUrl).toHaveBeenCalledWith(PATH, 3600);
  });

  it("answers 404 for a piece with no clip, an expired one, or one the caller may not see", async () => {
    deps.getContent.mockResolvedValueOnce(piece());
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "", expired: true }));
    expect((await call(ID)).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(null);
    expect((await call(ID)).status).toBe(404);
    expect(deps.clipReadUrl).not.toHaveBeenCalled();
  });

  it("sends ?take=edited to the edited take, and answers 404 when there is none", async () => {
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "", edit: { renderedPath: TAKE } }));
    const res = await call(ID, `?take=edited&v=${encodeURIComponent(TAKE)}`);
    expect(res.status).toBe(302);
    expect(deps.clipReadUrl).toHaveBeenCalledWith(TAKE, 3600);
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "", edit: {} }));
    expect((await call(ID, "?take=edited")).status).toBe(404);
    deps.getContent.mockResolvedValueOnce(piece({ path: PATH, caption: "", expired: true, edit: { renderedPath: TAKE } }));
    expect((await call(ID, "?take=edited")).status).toBe(404);
    expect(deps.clipReadUrl).toHaveBeenCalledTimes(1);
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
