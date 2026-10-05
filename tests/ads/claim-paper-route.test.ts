import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The paper route on campaign claim ads: owner only, and frozen once sent (spec 2026-10-06). */

const run = vi.hoisted(() => ({ claimPaper: vi.fn(), checkPaper: vi.fn() }));
vi.mock("@/lib/content/claim-run", () => run);
const who = vi.hoisted(() => ({ role: "owner" as "owner" | "agent" | null }));
vi.mock("@/lib/auth/viewer", () => ({
  refuseUnless: vi.fn(async (perm?: string) => {
    if (!who.role) return Response.json({ ok: false }, { status: 401 });
    if (perm === "owner" && who.role !== "owner") return Response.json({ ok: false }, { status: 403 });
    return null;
  }),
}));
const store = vi.hoisted(() => ({ getContent: vi.fn() }));
vi.mock("@/lib/content/store", () => store);
const conn = vi.hoisted(() => ({ adManageAccounts: vi.fn() }));
vi.mock("@/lib/facebook/ads-manage-connection", () => conn);
const launches = vi.hoisted(() => ({ findLaunch: vi.fn() }));
vi.mock("@/lib/ads/launch-store", () => launches);
const sends = vi.hoisted(() => ({ sentPieceIds: vi.fn() }));
vi.mock("@/lib/ads/send-store", () => sends);

const { GET, POST } = await import("@/app/api/content-claim/paper/route");

const ID = "11111111-1111-1111-1111-111111111111";
const get = () => GET(new NextRequest(`http://localhost/api/content-claim/paper?id=${ID}&i=0`));
const post = () => {
  const form = new FormData();
  form.set("id", ID);
  return POST(new NextRequest("http://localhost/api/content-claim/paper", { method: "POST", body: form }));
};

beforeEach(() => {
  vi.clearAllMocks();
  who.role = "owner";
  store.getContent.mockResolvedValue({ id: ID, format: "ad", campaignId: "C1" });
  conn.adManageAccounts.mockResolvedValue([{ id: "act_1" }]);
  launches.findLaunch.mockResolvedValue(null);
  sends.sentPieceIds.mockResolvedValue(new Set());
  run.claimPaper.mockResolvedValue({ bytes: Buffer.from([1]), mimeType: "image/png", ratio: 1 });
  run.checkPaper.mockResolvedValue({ ok: true });
});

describe("a campaign claim ad's papers", () => {
  it("are the owner's alone to read and to check", async () => {
    who.role = "agent";
    expect((await get()).status).toBe(403);
    expect((await post()).status).toBe(403);
    expect(run.claimPaper).not.toHaveBeenCalled();
    expect(run.checkPaper).not.toHaveBeenCalled();
  });

  it("are read and checked by the owner while the ad is unsent", async () => {
    expect((await get()).status).toBe(200);
    expect(await (await post()).json()).toEqual({ ok: true });
    expect(run.checkPaper).toHaveBeenCalledTimes(1);
  });

  it("are frozen once in a live send, still readable", async () => {
    sends.sentPieceIds.mockResolvedValue(new Set([ID]));
    expect((await post()).status).toBe(409);
    expect(run.checkPaper).not.toHaveBeenCalled();
    expect((await get()).status).toBe(200);
  });

  it("are frozen once launched in any connected account", async () => {
    launches.findLaunch.mockResolvedValue({ id: "L1" });
    expect((await post()).status).toBe(409);
    expect(run.checkPaper).not.toHaveBeenCalled();
  });

  it("are not checked when a send or launch table cannot be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    sends.sentPieceIds.mockRejectedValue(new Error("db down"));
    expect((await post()).status).toBe(500);
    expect(run.checkPaper).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("an organic claim piece's papers", () => {
  it("stay as they were: any signed-in viewer, no send tables asked", async () => {
    store.getContent.mockResolvedValue({ id: ID, format: "post", campaignId: null });
    who.role = "agent";
    expect((await get()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect(sends.sentPieceIds).not.toHaveBeenCalled();
    expect(conn.adManageAccounts).not.toHaveBeenCalled();
  });
});
