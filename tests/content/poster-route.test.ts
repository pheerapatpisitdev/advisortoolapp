import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The poster route draws stored pictures (an AI background, a claim's papers) only for someone
 * who may see the piece they belong to, and never lets a shared cache keep the result.
 */

const MINE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const THEIRS = "1c8e4a5f-2d3b-4c6e-9f0a-1b2c3d4e5f60";
const FILE = "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.jpg";

const store = vi.hoisted(() => ({ getContent: vi.fn() }));
const draw = vi.hoisted(() => ({ drawPoster: vi.fn(async () => Buffer.from("png")) }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/poster-draw", () => draw);
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn(async () => null) }));
const logos = vi.hoisted(() => ({ mayUseLogo: vi.fn(async (path: string) => path.includes("0b7d3f4e")) }));
vi.mock("@/lib/content/logo-store", () => logos);

const { GET } = await import("@/app/api/content-poster/route");
const { encodePoster } = await import("@/lib/content/poster");

const url = (spec: Record<string, unknown>) =>
  `http://localhost/api/content-poster?s=${encodePoster({ layout: "top", theme: "navy", blocks: [{ kind: "headline", text: "x" }], ...spec } as never)}`;
const get = (u: string) => GET(new NextRequest(u, { headers: { "x-forwarded-for": `10.1.0.${Math.random()}` } }));

beforeEach(() => {
  vi.clearAllMocks();
  store.getContent.mockImplementation(async (id: string) => (id === MINE ? { id } : null));
});

describe("the poster route", () => {
  it("draws a poster with no stored picture without looking anything up", async () => {
    const res = await get(url({}));
    expect(res.status).toBe(200);
    expect(store.getContent).not.toHaveBeenCalled();
  });

  it("draws the caller's own background and papers", async () => {
    const res = await get(url({ background: `${MINE}/${FILE}`, documents: [{ path: `${MINE}/${FILE}`, ratio: 0.75 }] }));
    expect(res.status).toBe(200);
    expect(draw.drawPoster).toHaveBeenCalledTimes(1);
  });

  it("refuses a background or a paper of a piece the caller may not see", async () => {
    for (const spec of [{ background: `${THEIRS}/${FILE}` }, { documents: [{ path: `${THEIRS}/${FILE}`, ratio: 0.75 }] }]) {
      const res = await get(url(spec));
      expect(res.status).toBe(404);
    }
    expect(draw.drawPoster).not.toHaveBeenCalled();
  });

  it("draws a logo only for someone who may use it", async () => {
    const ok = await get(url({ logo: { path: `logos/${MINE}.png`, spot: "tr" } }));
    expect(ok.status).toBe(200);
    const theirs = await get(url({ logo: { path: `logos/${THEIRS}.png`, spot: "tr" } }));
    expect(theirs.status).toBe(404);
  });

  it("is never kept by a shared cache", async () => {
    const res = await get(url({ background: `${MINE}/${FILE}` }));
    expect(res.headers.get("cache-control")).toMatch(/^private/);
  });
});
