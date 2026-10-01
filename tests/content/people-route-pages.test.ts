import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** A person tied to a Page the caller does not look after cannot be edited or deleted by them. */

const store = vi.hoisted(() => ({
  getPerson: vi.fn(), deletePerson: vi.fn(async () => undefined), updatePerson: vi.fn(async () => ({ id: "x" })), addPerson: vi.fn(),
  MAX_PHOTO_BYTES: 5_000_000, PHOTO_TYPES: { "image/jpeg": "jpg" }, PersonError: class extends Error {},
}));
vi.mock("@/lib/content/people-store", () => store);
const pieces = vi.hoisted(() => ({ piecesWithPerson: vi.fn(async () => ({ total: 2, onPage: 1 })) }));
vi.mock("@/lib/content/store", () => pieces);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null), getViewer: vi.fn(async () => ({ agentId: "s1", staff: { publish: true } })) }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => [{ pageId: "p1" }, { pageId: "p2" }]) }));
vi.mock("@/lib/auth/pages", () => ({ myPages: vi.fn(async () => [{ pageId: "p1" }]), myPageIds: vi.fn(async () => new Set(["p1"])) }));

const { DELETE, GET, PATCH } = await import("@/app/api/content-people/route");
const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const del = () => DELETE(new NextRequest(`http://localhost/api/content-people?id=${ID}`, { method: "DELETE" }));
const patch = () => {
  const form = new FormData();
  form.set("id", ID);
  form.set("name", "phet");
  return PATCH(new NextRequest("http://localhost/api/content-people", { method: "PATCH", body: form }));
};

beforeEach(() => vi.clearAllMocks());

describe("someone of another Page", () => {
  it("cannot be deleted or edited", async () => {
    store.getPerson.mockResolvedValue({ id: ID, name: "phet", pageId: "p2", photos: [], consentedAt: "" });
    expect((await del()).status).toBe(403);
    expect((await patch()).status).toBe(403);
    expect(store.deletePerson).not.toHaveBeenCalled();
    expect(store.updatePerson).not.toHaveBeenCalled();
  });

  it("stays out of reach while the Pages cannot be read: not knowing it is theirs is not a yes", async () => {
    const { pageConnections } = await import("@/lib/facebook/connection");
    const { myPageIds } = await import("@/lib/auth/pages");
    store.getPerson.mockResolvedValue({ id: ID, name: "phet", pageId: "p2", photos: [], consentedAt: "" });
    for (const unreadable of [pageConnections, myPageIds]) {
      vi.mocked(unreadable).mockRejectedValueOnce(new Error("db down"));
      expect((await del()).status).toBe(503);
      vi.mocked(unreadable).mockRejectedValueOnce(new Error("db down"));
      expect((await patch()).status).toBe(503);
    }
    expect(store.deletePerson).not.toHaveBeenCalled();
    expect(store.updatePerson).not.toHaveBeenCalled();
  });

  it("of the caller's own Page, of every Page, or of a disconnected Page, can be", async () => {
    for (const pageId of ["p1", null, "gone"]) {
      store.getPerson.mockResolvedValue({ id: ID, name: "x", pageId, photos: [], consentedAt: "" });
      expect((await del()).status).toBe(200);
    }
  });
});

describe("how many pieces a person is in", () => {
  const usage = () => GET(new NextRequest(`http://localhost/api/content-people?usage=${ID}`));

  it("is not told about a person the caller may not see — another tenant's, or nobody's (review, 2026-10-01)", async () => {
    store.getPerson.mockResolvedValue(null);
    const res = await usage();
    expect(res.status).toBe(404);
    expect(pieces.piecesWithPerson).not.toHaveBeenCalled();
  });

  it("is told about the caller's own", async () => {
    store.getPerson.mockResolvedValue({ id: ID, name: "phet", pageId: null, photos: [], consentedAt: "" });
    const res = await usage();
    expect(await res.json()).toEqual({ ok: true, total: 2, onPage: 1 });
    expect(pieces.piecesWithPerson).toHaveBeenCalledWith(ID);
  });
});
