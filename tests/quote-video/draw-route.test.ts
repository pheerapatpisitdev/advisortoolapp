import { beforeEach, describe, expect, it, vi } from "vitest";

// the drawing route (owner, 2026-10-12): produce calls it once per scene with the clip's secret
// the spy records each call; `fails` makes the drawing throw (a rejecting spy trips vitest's own tracking)
const drawScene = vi.fn();
let fails = false;
vi.mock("@/lib/quote-video/make", () => ({
  drawScene: async (...a: unknown[]) => {
    const r = drawScene(...a);
    if (fails) throw new Error("upload in_9: fetch failed");
    return r;
  },
}));
import { POST } from "@/app/api/quote-video/draw/route";

const ID = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const call = (body: unknown) => POST(new Request("http://x/api/quote-video/draw", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/quote-video/draw", () => {
  beforeEach(() => { drawScene.mockReset(); fails = false; });

  it("turns away a body without an id, scene, token and name", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ id: "x", scene: 0, token: "t", agentName: "a" })).status).toBe(400);
    expect((await call({ id: ID, scene: "0", token: "t", agentName: "a" })).status).toBe(400);
    expect(drawScene).not.toHaveBeenCalled();
  });

  it("draws the asked scene and says ok", async () => {
    drawScene.mockResolvedValue("drawn");
    const r = await call({ id: ID, scene: 2, token: "t", agentName: "ภีรพัฒน์" });
    expect(r.status).toBe(200);
    expect(drawScene).toHaveBeenCalledWith(ID, 2, "t", "ภีรพัฒน์");
  });

  it("a wrong secret or a clip not drawing is 401; a failed drawing is 500", async () => {
    drawScene.mockResolvedValue("refused");
    expect((await call({ id: ID, scene: 0, token: "t", agentName: "a" })).status).toBe(401);
    fails = true;
    expect((await call({ id: ID, scene: 0, token: "t", agentName: "a" })).status).toBe(500);
  });
});
