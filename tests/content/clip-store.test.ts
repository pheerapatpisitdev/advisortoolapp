import { beforeEach, describe, expect, it, vi } from "vitest";

const bucket = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));
const from = vi.hoisted(() => vi.fn(() => bucket));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ storage: { from } }) }));

const { clipReadUrl, clipSize, createClipUpload, removeClip, removeClipsOf } = await import("@/lib/content/clip-store");
const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const PATH = `${PIECE}/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4`;

beforeEach(() => vi.clearAllMocks());

describe("clip-store", () => {
  it("hands out an upload token for a clip path only", async () => {
    bucket.createSignedUploadUrl.mockResolvedValue({ data: { token: "tok", path: PATH, signedUrl: "u" }, error: null });
    expect(await createClipUpload(PATH)).toEqual({ token: "tok" });
    expect(from).toHaveBeenCalledWith("content-video");
    await expect(createClipUpload("x/../y.mp4")).rejects.toThrow();
  });

  it("reads a file's size from its folder listing; a missing file is null", async () => {
    bucket.list.mockResolvedValue({ data: [{ name: "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", metadata: { size: 1234 } }], error: null });
    expect(await clipSize(PATH)).toBe(1234);
    expect(bucket.list).toHaveBeenCalledWith(PIECE, { search: "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4" });
    bucket.list.mockResolvedValue({ data: [], error: null });
    expect(await clipSize(PATH)).toBeNull();
  });

  it("signs a read link for the asked seconds, and throws when it cannot", async () => {
    bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://s" }, error: null });
    expect(await clipReadUrl(PATH, 3600)).toBe("https://s");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(PATH, 3600);
    bucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });
    await expect(clipReadUrl(PATH, 60)).rejects.toThrow();
  });

  it("removing one file never throws", async () => {
    bucket.remove.mockResolvedValue({ error: { message: "down" } });
    await expect(removeClip(PATH)).resolves.toBeUndefined();
  });

  it("removes every clip under a piece", async () => {
    bucket.list.mockResolvedValue({ data: [{ name: "a.mp4" }, { name: "b.mov" }], error: null });
    bucket.remove.mockResolvedValue({ error: null });
    await removeClipsOf(PIECE);
    expect(bucket.remove).toHaveBeenCalledWith([`${PIECE}/a.mp4`, `${PIECE}/b.mov`]);
    bucket.list.mockResolvedValue({ data: [], error: null });
    bucket.remove.mockClear();
    await removeClipsOf(PIECE);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("removes every clip under a piece, past the first page of the listing (final review, 2026-10-02)", async () => {
    const names = Array.from({ length: 150 }, (_, i) => ({ name: `${i}.png` }));
    bucket.list.mockImplementation(async (_dir: string, o: { limit: number; offset: number }) => ({ data: names.slice(o.offset, o.offset + o.limit), error: null }));
    bucket.remove.mockResolvedValue({ error: null });
    await removeClipsOf(PIECE);
    const gone = bucket.remove.mock.calls.flatMap((c) => c[0] as string[]);
    expect(gone).toHaveLength(150);
    expect(new Set(gone)).toEqual(new Set(names.map((n) => `${PIECE}/${n.name}`)));
    bucket.list.mockReset();
  });

  it("removing a piece's clips never blocks its delete: a refused list, remove or a throw is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    bucket.list.mockResolvedValue({ data: [{ name: "a.mp4" }], error: null });
    bucket.remove.mockResolvedValue({ error: { message: "down" } });
    await expect(removeClipsOf(PIECE)).resolves.toBeUndefined();
    bucket.list.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(removeClipsOf(PIECE)).resolves.toBeUndefined();
    bucket.list.mockRejectedValue(new Error("network"));
    await expect(removeClipsOf(PIECE)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });
});
