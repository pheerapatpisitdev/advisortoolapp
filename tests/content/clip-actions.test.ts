import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/content/store";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";

const store = vi.hoisted(() => ({ getContent: vi.fn(), saveContent: vi.fn(), saveOutputIf: vi.fn(), listWords: vi.fn(async () => [{ word: "การันตี", kind: "banned", fix: null }]) }));
const clips = vi.hoisted(() => ({ createClipUpload: vi.fn(), clipSize: vi.fn(), clipReadUrl: vi.fn(), removeClip: vi.fn() }));
const pages = vi.hoisted(() => ({ projectPage: vi.fn() }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/clip-store", () => clips);
vi.mock("@/lib/auth/pages", () => pages);
const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/content/clip-run", () => ({ runTranscribe: vi.fn(async (i: unknown) => ({ ok: true, item: i })) }));
vi.mock("@/lib/wallet/round", () => ({ payRound: (_p: unknown, run: () => unknown) => run() }));
const auth = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => auth);

const { finishClipUpload, saveClipCaption, startClipUpload, transcribeClip } = await import("@/app/studio/clip");
const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const file = { sizeBytes: 9_000_000, durationSec: 40, width: 1080, height: 1920, mime: "video/mp4" };
const item = (over: Partial<ContentItem> = {}): ContentItem => ({
  id: PIECE, createdAt: "", planHref: "/life-protect", format: "script", angle: "", length: "60",
  output: { ...clipOutput("d"), hooks: ["h"], body: "บท" }, flags: NO_FLAGS, model: null, costThb: 0, status: "draft",
  hookTemplateId: null, publish: null, agentId: "a1", pageId: "105", plan: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireMember.mockImplementation(async () => ({ kind: "unitos", agentId: "a1", staff: null }));
  clips.createClipUpload.mockResolvedValue({ token: "tok" });
  store.saveOutputIf.mockImplementation(async (_id: string, output: ContentItem["output"]) => item({ output }));
  pages.projectPage.mockResolvedValue({ ok: true, pageId: "105" });
});

describe("startClipUpload", () => {
  it("refuses a file that is not a Reel before anything is made", async () => {
    expect(await startClipUpload({ page: "105", file: { ...file, width: 1920, height: 1080 } })).toMatchObject({ ok: false });
    expect(store.saveContent).not.toHaveBeenCalled();
    expect(clips.createClipUpload).not.toHaveBeenCalled();
  });

  it("a clip on its own: makes a clip piece in the Page's project, then a token under it", async () => {
    store.saveContent.mockResolvedValue(item({ format: "clip", planHref: "clip" }));
    const r = await startClipUpload({ page: "105", file });
    expect(store.saveContent).toHaveBeenCalledWith(expect.objectContaining({ format: "clip", planHref: "clip", pageId: "105" }));
    expect(r).toMatchObject({ ok: true, pieceId: PIECE, token: "tok" });
    expect((r as { path: string }).path.startsWith(`${PIECE}/`)).toBe(true);
  });

  it("attaches to a script it may see; refuses a post, an unseen piece, and a held one", async () => {
    store.getContent.mockResolvedValue(item());
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: true });
    store.getContent.mockResolvedValue(item({ format: "post" }));
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: false });
    store.getContent.mockResolvedValue(null);
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: false });
    store.getContent.mockResolvedValue(item({ publish: { state: "scheduled", pageId: "105", postId: "v1", at: "2099-01-01T00:00:00Z", error: null } }));
    expect(await startClipUpload({ pieceId: PIECE, file })).toMatchObject({ ok: false });
  });
});

describe("finishClipUpload", () => {
  const path = `${PIECE}/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4`;

  it("keeps the clip once the file is there at its size, and lets the old file go", async () => {
    const old = `${PIECE}/11111111-2222-4333-8444-555555555555.mp4`;
    store.getContent.mockResolvedValue(item({ output: { ...item().output, video: { path: old, durationSec: 1, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "เดิม", flags: NO_FLAGS } } }));
    clips.clipSize.mockResolvedValue(file.sizeBytes);
    const r = await finishClipUpload({ pieceId: PIECE, path, file, brief: " เรื่องภาษี " });
    expect(r.ok).toBe(true);
    const saved = store.saveOutputIf.mock.calls[0][1] as ContentItem["output"];
    expect(saved.video).toMatchObject({ path, sizeBytes: file.sizeBytes, caption: "เดิม", brief: "เรื่องภาษี" });
    expect(saved.video?.transcript).toBeUndefined();
    expect(clips.removeClip).toHaveBeenCalledWith(old);
  });

  it("refuses a missing file or one of another size", async () => {
    store.getContent.mockResolvedValue(item());
    clips.clipSize.mockResolvedValue(null);
    expect((await finishClipUpload({ pieceId: PIECE, path, file })).ok).toBe(false);
    clips.clipSize.mockResolvedValue(5);
    expect((await finishClipUpload({ pieceId: PIECE, path, file })).ok).toBe(false);
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });

  it("refuses another piece's path", async () => {
    store.getContent.mockResolvedValue(item());
    expect((await finishClipUpload({ pieceId: PIECE, path: "other/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", file })).ok).toBe(false);
    expect(clips.clipSize).not.toHaveBeenCalled();
  });

  it("refuses a held piece", async () => {
    store.getContent.mockResolvedValue(item({ publish: { state: "scheduled", pageId: "105", postId: "v1", at: "2099-01-01T00:00:00Z", error: null } }));
    clips.clipSize.mockResolvedValue(file.sizeBytes);
    expect((await finishClipUpload({ pieceId: PIECE, path, file })).ok).toBe(false);
  });
});

describe("transcribeClip", () => {
  it("takes an ai-clip round and runs it", async () => {
    store.getContent.mockResolvedValue(item({ output: { ...item().output, video: { path: "x", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS } } }));
    const r = await transcribeClip(PIECE);
    expect(quota.takeRound).toHaveBeenCalledWith(expect.anything(), "ai-clip");
    expect(r.ok).toBe(true);
  });

  it("refuses a piece with no clip before taking a round", async () => {
    store.getContent.mockResolvedValue(item());
    expect(await transcribeClip(PIECE)).toMatchObject({ ok: false });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  const withClip = (over: Record<string, unknown> = {}, v: Record<string, unknown> = {}) => item({
    output: { ...item().output, video: { path: "x", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS, ...v } },
    ...over,
  });

  it("refuses a Reel that is scheduled, posting or posted, before taking a round", async () => {
    store.getContent.mockResolvedValue(withClip({ publish: { state: "scheduled", pageId: "105", postId: "v1", at: "2099-01-01T00:00:00Z", error: null } }));
    expect(await transcribeClip(PIECE)).toMatchObject({ ok: false, error: expect.stringContaining("ตั้งเวลาหรือลงเพจแล้ว") });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  it("counts the hour's 20 listens per person, staff included, not in one shared bucket", async () => {
    store.getContent.mockResolvedValue(withClip());
    const as = (agentId: string, staff: object | null) => auth.requireMember.mockImplementation(async () => ({ kind: "unitos", agentId, staff }));
    as("staff-1", { owner: true, publish: true, connect: true, admin: true });
    for (let i = 0; i < 20; i++) expect((await transcribeClip(PIECE)).ok).toBe(true);
    expect(await transcribeClip(PIECE)).toMatchObject({ ok: false, error: expect.stringContaining("ครบ 20 ครั้ง") });
    as("staff-2", { owner: false, publish: true, connect: false, admin: false });
    expect((await transcribeClip(PIECE)).ok).toBe(true);
  });

  it("refuses an expired clip before taking a round", async () => {
    store.getContent.mockResolvedValue(withClip({}, { expired: true }));
    expect(await transcribeClip(PIECE)).toMatchObject({ ok: false, error: expect.stringContaining("หมดอายุ") });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});

describe("saveClipCaption", () => {
  const withClip = (over: Partial<ContentItem> = {}) => item({
    output: { ...item().output, video: { path: "x", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "เดิม", flags: NO_FLAGS } },
    ...over,
  });

  it("keeps the words and checks them again", async () => {
    store.getContent.mockResolvedValue(withClip());
    const r = await saveClipCaption(PIECE, "  การันตีครับ  ");
    expect(r.ok).toBe(true);
    const v = (store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!;
    expect(v.caption).toBe("การันตีครับ");
    expect(v.flags.words.map((w) => w.word)).toEqual(["การันตี"]);
  });

  it("refuses a Reel already held or posted, and a piece with no clip", async () => {
    store.getContent.mockResolvedValue(withClip({ publish: { state: "scheduled", pageId: "105", postId: "v", at: "2099-01-01T00:00:00Z", error: null } }));
    expect((await saveClipCaption(PIECE, "x")).ok).toBe(false);
    store.getContent.mockResolvedValue(item());
    expect((await saveClipCaption(PIECE, "x")).ok).toBe(false);
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });
});
