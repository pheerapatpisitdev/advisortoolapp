import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Publish, PublishState } from "@/lib/content/store";
import type { ContentOutput } from "@/lib/content/output";
import { blocksKey } from "@/lib/content/poster-text";

/**
 * The trip to the Page as a state machine: what the row says after each thing Facebook or the
 * database does, including the ones that go wrong half way and the ones that happen at once.
 * The store is one row in memory that honours the conditional writes the way the table does.
 */

let row: ContentItem;
const store = vi.hoisted(() => ({
  getContent: vi.fn(), claimPublish: vi.fn(), recordPublishIf: vi.fn(), listDue: vi.fn(), saveOutput: vi.fn(), saveOutputIf: vi.fn(),
  adoptPage: vi.fn(async () => undefined), releasePublish: vi.fn(),
}));
const fb = vi.hoisted(() => ({ postPhoto: vi.fn(), postReel: vi.fn(), deletePost: vi.fn(), postState: vi.fn(), reelState: vi.fn() }));
const clips = vi.hoisted(() => ({ clipReadUrl: vi.fn() }));
const conn = vi.hoisted(() => ({ pageConnections: vi.fn(), pageToken: vi.fn() }));
// the Pages the caller looks after (src/lib/auth/pages.ts): every connected one unless a test narrows it
const mine = vi.hoisted(() => ({ ids: null as string[] | null }));
vi.mock("@/lib/auth/pages", () => ({
  myPages: vi.fn(async () => ((await conn.pageConnections()) as { pageId: string }[]).filter((p) => !mine.ids || mine.ids.includes(p.pageId))),
  myPageIds: vi.fn(async () => new Set(((await conn.pageConnections()) as { pageId: string }[]).map((p) => p.pageId).filter((id) => !mine.ids || mine.ids.includes(id)))),
}));

vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/clip-store", () => clips);
vi.mock("@/lib/facebook/connection", () => conn);
vi.mock("@/lib/facebook/publish", async (orig) => ({ ...(await orig<typeof import("@/lib/facebook/publish")>()), ...fb }));
vi.mock("@/lib/content/poster-draw", () => ({ drawPoster: vi.fn(async () => Buffer.from("png")) }));
vi.mock("@/app/studio/actions", () => ({ setContentStatus: vi.fn(async () => ({ ok: true })) }));

const { AI_TEXT_STALE, AI_TEXT_UNCHECKED, CLIP_EXPIRED, CONCURRENT, MISSED, MOVE_LOST, PAPER_UNCHECKED, POSSIBLY_POSTED, REEL_FAILED, forgetChecks, move, publish, verifyDue, withdraw, VERIFY_MAX } =
  await import("@/lib/content/publish-flow");
const { publishView, STUCK_MESSAGE, POSTING_STALE_MS } = await import("@/lib/content/publish-label");
const { PublishError } = await import("@/lib/facebook/publish");
const { drawPoster } = await import("@/lib/content/poster-draw");

const PAGE = "105";
const output: ContentOutput = { hooks: ["หัว 1", "หัว 2", "หัว 3"], body: "เนื้อ", closing: "", hashtags: [], imagePrompt: "", disclaimer: "d" };
const piece = (publish: Publish | null = null, out: ContentOutput = output): ContentItem => ({
  id: "p1", createdAt: "2026-09-25T00:00:00Z", planHref: "/life-protect", format: "post", angle: "",
  length: null, output: out, flags: { numbers: [], words: [], policy: [], fixes: null }, model: null, costThb: 0, status: "used",
  hookTemplateId: null, publish, agentId: null, pageId: PAGE, plan: null, campaignId: null,
});
const pub = (over: Partial<Publish>): Publish => ({ state: "scheduled", pageId: PAGE, postId: null, at: null, error: null, ...over });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAhead = (h: number) => new Date(Date.now() + h * 3_600_000);
const tick = () => new Promise((r) => setTimeout(r, 0));

/** the table's conditional update: applied only when the row still matches `from` */
function applyIf(from: { state: PublishState; postId?: string | null; at?: string }, p: Partial<Publish> & { state: PublishState }) {
  const now = row.publish;
  if (!now || now.state !== from.state) return null;
  if (from.postId !== undefined && now.postId !== from.postId) return null;
  if (from.at !== undefined && now.at !== from.at) return null;
  row = { ...row, publish: { ...now, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)), error: p.error ?? null } as Publish };
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
  mine.ids = null;
  forgetChecks();
  row = piece();
  store.getContent.mockImplementation(async () => row);
  store.claimPublish.mockImplementation(async (_id: string, now: Date) => {
    const p = row.publish;
    const stale = p?.state === "posting" && (!p.at || now.getTime() - new Date(p.at).getTime() > POSTING_STALE_MS);
    if (p && !["failed", "cancelled"].includes(p.state) && !stale) return false;
    row = { ...row, publish: { ...(p ?? pub({})), state: "posting", at: now.toISOString(), error: null } };
    return true;
  });
  store.releasePublish.mockImplementation(async (_id: string, claimAt: string, before: Publish | null) => {
    if (row.publish?.state !== "posting" || row.publish.at !== claimAt) return false;
    row = { ...row, publish: before };
    return true;
  });
  store.recordPublishIf.mockImplementation(async (_id: string, from: Parameters<typeof applyIf>[0], p: Parameters<typeof applyIf>[1]) => applyIf(from, p));
  store.saveOutput.mockImplementation(async (_id: string, out: ContentOutput) => { row = { ...row, output: out }; return row; });
  // the table's guarded write: applied only while the piece's rev is the one the caller read
  store.saveOutputIf.mockImplementation(async (_id: string, out: ContentOutput, _f: unknown, rev: string | null) => {
    if ((row.output.rev ?? null) !== rev) return null;
    row = { ...row, output: { ...out, rev: `r${Math.random()}` } };
    return row;
  });
  conn.pageConnections.mockResolvedValue([{ pageId: PAGE, pageName: "LuckyPlanner", scopes: ["pages_manage_posts"] }]);
  conn.pageToken.mockResolvedValue("token");
  let n = 100;
  fb.postPhoto.mockImplementation(async () => ({ id: String(n++) }));
  fb.postReel.mockImplementation(async () => ({ id: `v${n++}` }));
  clips.clipReadUrl.mockResolvedValue("https://signed");
  fb.deletePost.mockResolvedValue(undefined);
});

describe("a poster whose words the image model drew", () => {
  const blocks = [{ kind: "headline" as const, text: "จ่าย 9 ปี คุ้มครองตลอดชีพ" }];
  const drawn = (checked: boolean, now = blocks): ContentOutput => ({
    ...output,
    poster: { layout: "bottom", theme: "navy", blocks: now, aiText: { blocks: blocksKey({ blocks }), read: "จ่าย 9 ปี คุ้มครองตลอดชีพ", issues: [], checked } },
  });

  it("keeps the piece off the Page, now or later, until the agent has looked at the words", async () => {
    row = piece(null, drawn(false));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: AI_TEXT_UNCHECKED });
    expect(await publish({ id: "p1", pageId: PAGE, at: hoursAhead(2).toISOString() })).toEqual({ ok: false, error: AI_TEXT_UNCHECKED });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("keeps it off when its words were edited after the picture was drawn, ticked or not", async () => {
    row = piece(null, drawn(true, [{ kind: "headline", text: "หัวใหม่" }]));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: AI_TEXT_STALE });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("goes up once it is ticked", async () => {
    row = piece(null, drawn(true));
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(fb.postPhoto).toHaveBeenCalledTimes(1);
  });
});

describe("a รีวิวเคลม paper the owner has not looked at", () => {
  const PAPER = { path: "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.jpg", ratio: 0.75 };
  const withPaper = (paperChecked: boolean): ContentOutput => ({
    ...output, paperChecked, poster: { layout: "top", theme: "navy", blocks: [{ kind: "headline", text: "x" }], documents: [PAPER] },
  });

  it("keeps the piece off the Page, now or later, until it is ticked", async () => {
    row = { ...piece(null, withPaper(false)), planHref: "claim-review" };
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: PAPER_UNCHECKED });
    expect(await publish({ id: "p1", pageId: PAGE, at: hoursAhead(2).toISOString() })).toEqual({ ok: false, error: PAPER_UNCHECKED });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("goes up once it is ticked", async () => {
    row = { ...piece(null, withPaper(true)), planHref: "claim-review" };
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(fb.postPhoto).toHaveBeenCalledTimes(1);
  });
});

describe("a send that died half way (posting)", () => {
  it("shows as failed, with what to check, once the claim is ten minutes old", () => {
    expect(publishView(pub({ state: "posting", at: minutesAgo(2) })).kind).toBe("posting");
    expect(publishView(pub({ state: "posting", at: minutesAgo(11) }))).toEqual({ kind: "failed", error: STUCK_MESSAGE });
  });

  it("refuses a second send while the first may still be running", async () => {
    row = piece(pub({ state: "posting", at: minutesAgo(1) }));
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(false);
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("takes a stale claim again only once the owner has checked the Page (force)", async () => {
    row = piece(pub({ state: "posting", at: minutesAgo(30) }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ ok: false, confirmRepost: true });
    expect(fb.postPhoto).not.toHaveBeenCalled();
    expect((await publish({ id: "p1", pageId: PAGE, at: null, force: true })).ok).toBe(true);
    expect(fb.postPhoto).toHaveBeenCalledOnce();
    expect(row.publish?.state).toBe("published");
  });
});

describe("Facebook took it, the database did not", () => {
  it("tries the record once more, and that is enough when it works", async () => {
    store.recordPublishIf.mockRejectedValueOnce(new Error("db blip"));
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(row.publish).toMatchObject({ state: "published", postId: "100" });
  });

  it("keeps the post id as failed and says the post may be up, never 'try again'", async () => {
    store.recordPublishIf.mockRejectedValueOnce(new Error("db down")).mockRejectedValueOnce(new Error("db down"));
    const r = await publish({ id: "p1", pageId: PAGE, at: null });
    expect(r).toEqual({ ok: false, error: POSSIBLY_POSTED, confirmRepost: true });
    expect(row.publish).toMatchObject({ state: "failed", postId: "100", pageId: PAGE, error: POSSIBLY_POSTED });
  });

  it("records a plain failure, with no post id, when Facebook refused", async () => {
    fb.postPhoto.mockRejectedValueOnce(new PublishError("Facebook ไม่รับโพสต์: x"));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: "Facebook ไม่รับโพสต์: x" });
    // the Page it was meant for, so the calendar can show it on that Page's board
    expect(row.publish).toMatchObject({ state: "failed", postId: null, pageId: PAGE, error: "Facebook ไม่รับโพสต์: x" });
  });

  it("records a plain failure when the poster could not be drawn: nothing reached Facebook", async () => {
    vi.mocked(drawPoster).mockRejectedValueOnce(new Error("font missing"));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ ok: false });
    expect(fb.postPhoto).not.toHaveBeenCalled();
    expect(row.publish).toMatchObject({ state: "failed", postId: null });
    expect(row.publish?.error).not.toBe(POSSIBLY_POSTED);
  });
});

describe("Facebook may have it, and did not say", () => {
  it("a send that timed out may be up: the owner checks the Page before it goes again", async () => {
    fb.postPhoto.mockRejectedValueOnce(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }));
    expect(await publish({ id: "p1", pageId: PAGE, at: hoursAhead(2).toISOString() })).toEqual({ ok: false, error: POSSIBLY_POSTED, confirmRepost: true });
    expect(row.publish).toMatchObject({ state: "failed", postId: null, pageId: PAGE, error: POSSIBLY_POSTED });
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ ok: false, confirmRepost: true });
    expect(fb.postPhoto).toHaveBeenCalledTimes(1);
    expect((await publish({ id: "p1", pageId: PAGE, at: null, force: true })).ok).toBe(true);
  });

  it("so may one Facebook answered without a post id", async () => {
    fb.postPhoto.mockRejectedValueOnce(new PublishError("Facebook ตอบกลับมาไม่มีเลขโพสต์ ลองเช็กในเพจก่อนกดใหม่", undefined, true));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: POSSIBLY_POSTED, confirmRepost: true });
    expect(row.publish).toMatchObject({ state: "failed", error: POSSIBLY_POSTED });
  });
});

describe("sending again a piece that may be on the Page", () => {
  it("is refused without force and sent with it", async () => {
    row = piece(pub({ state: "failed", postId: `${PAGE}_1`, error: POSSIBLY_POSTED }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ ok: false, confirmRepost: true });
    expect(fb.postPhoto).not.toHaveBeenCalled();
    expect((await publish({ id: "p1", pageId: PAGE, at: null, force: true })).ok).toBe(true);
  });

  it("needs no force for a refusal that never reached Facebook", async () => {
    row = piece(pub({ state: "failed", postId: null, error: "x" }));
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
  });
});

describe("moving a held post", () => {
  const held = () => piece(pub({ postId: "9", at: hoursAhead(5).toISOString() }));

  it("takes the old post back, holds the new one, and keeps the opening line it went with", async () => {
    row = held();
    row = { ...row, output: { ...row.output, postedHook: 2 } };
    const r = await move("p1", hoursAhead(30));
    expect(r.ok).toBe(true);
    expect(fb.deletePost).toHaveBeenCalledWith("9", "token");
    expect(fb.postPhoto.mock.calls[0][0].caption.startsWith("หัว 3")).toBe(true);
    expect(row.publish).toMatchObject({ state: "scheduled", postId: "100" });
  });

  it("says the old post is gone, and leaves no post id, when the move could not be written", async () => {
    row = held();
    // the claim goes through; the write after Facebook's delete does not
    store.recordPublishIf
      .mockImplementationOnce(async (_id, from, p) => applyIf(from, p))
      .mockRejectedValueOnce(new Error("db down"));
    expect(await move("p1", hoursAhead(30))).toEqual({ ok: false, error: MOVE_LOST });
    expect(fb.deletePost).toHaveBeenCalledWith("9", "token");
    expect(row.publish).toMatchObject({ state: "failed", postId: null, error: MOVE_LOST });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("gives the claim back, still held, when Facebook would not take the old post back", async () => {
    row = held();
    const at = row.publish!.at;
    fb.deletePost.mockRejectedValueOnce(new PublishError("down"));
    expect((await move("p1", hoursAhead(30))).ok).toBe(false);
    expect(row.publish).toMatchObject({ state: "scheduled", postId: "9", at });
  });
});

describe("two requests on one held post at once", () => {
  it("two moves: one wins, the other stops before touching Facebook — one post on the Page", async () => {
    row = piece(pub({ postId: "9", at: hoursAhead(5).toISOString() }));
    const [a, b] = await Promise.all([move("p1", hoursAhead(30)), move("p1", hoursAhead(40))]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect([a, b].find((r) => !r.ok)).toEqual({ ok: false, error: CONCURRENT });
    expect(fb.deletePost).toHaveBeenCalledOnce();
    expect(fb.postPhoto).toHaveBeenCalledOnce();
  });

  it("a cancel during a move is refused, not run behind it", async () => {
    row = piece(pub({ postId: "9", at: hoursAhead(5).toISOString() }));
    const moving = move("p1", hoursAhead(30));
    await tick();
    await tick();
    const cancelled = await withdraw(piece(pub({ postId: "9", at: hoursAhead(5).toISOString() })));
    expect(cancelled).toEqual({ ok: false, error: CONCURRENT });
    expect((await moving).ok).toBe(true);
    expect(fb.postPhoto).toHaveBeenCalledOnce();
  });

  it("a send that lost its claim while Facebook was busy takes its own post back", async () => {
    fb.postPhoto.mockImplementationOnce(async () => {
      // another request took the row meanwhile (a stale claim re-taken)
      row = { ...row, publish: { ...row.publish!, at: new Date(Date.now() + 1).toISOString() } };
      return { id: "555" };
    });
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: CONCURRENT });
    expect(fb.deletePost).toHaveBeenCalledWith("555", "token");
    expect(row.publish?.postId).not.toBe("555");
  });
});

describe("held posts whose time has come", () => {
  const due = (n: number, postId = String(1000 + n)) => ({ ...piece(pub({ postId, at: minutesAgo(60) })), id: `d${n}` });
  /** verifyDue over a store of several due rows, each its own */
  function rows(items: ContentItem[]) {
    const byId = new Map(items.map((i) => [i.id, i]));
    store.listDue.mockResolvedValue(items);
    store.recordPublishIf.mockImplementation(async (id: string, from: { state: PublishState; postId?: string | null }, p: Partial<Publish> & { state: PublishState }) => {
      const it = byId.get(id)!;
      if (it.publish?.state !== from.state || (from.postId !== undefined && it.publish.postId !== from.postId)) return null;
      const next = { ...it, publish: { ...it.publish, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)), error: p.error ?? null } as Publish };
      byId.set(id, next);
      return next;
    });
    return byId;
  }

  it("marks one Facebook put up as published", async () => {
    const byId = rows([due(1)]);
    fb.postState.mockResolvedValue("published");
    await verifyDue();
    expect(byId.get("d1")?.publish?.state).toBe("published");
  });

  it("takes back one Facebook says is not up, and says it can be scheduled again", async () => {
    const byId = rows([due(1)]);
    fb.postState.mockResolvedValue("unpublished");
    await verifyDue();
    expect(fb.deletePost).toHaveBeenCalledWith("1001", "token");
    expect(byId.get("d1")?.publish).toMatchObject({ state: "failed", postId: null, error: MISSED });
  });

  it("never marks a post failed because it could not be asked — and does not ask again for a while", async () => {
    const byId = rows([due(1), due(2)]);
    fb.postState.mockRejectedValueOnce(new PublishError("การเชื่อมเพจหมดอายุ", 190)).mockResolvedValueOnce("unknown");
    await expect(verifyDue()).resolves.toBeUndefined();
    expect(byId.get("d1")?.publish?.state).toBe("scheduled");
    expect(byId.get("d2")?.publish?.state).toBe("scheduled");
    expect(fb.deletePost).not.toHaveBeenCalled();
    // a render loop reloading the calendar does not ask Facebook again
    await verifyDue();
    expect(fb.postState).toHaveBeenCalledTimes(2);
    // half an hour later it does
    await verifyDue(new Date(Date.now() + 31 * 60_000));
    expect(fb.postState).toHaveBeenCalledTimes(4);
  });

  it("never throws, even when the rows cannot be read", async () => {
    store.listDue.mockRejectedValueOnce(new Error("db down"));
    await expect(verifyDue()).resolves.toBeUndefined();
  });

  it("asks about at most ten a load", async () => {
    rows(Array.from({ length: 15 }, (_, i) => due(i)));
    fb.postState.mockResolvedValue("published");
    await verifyDue();
    expect(fb.postState).toHaveBeenCalledTimes(VERIFY_MAX);
  });
});

describe("a Page the caller does not look after (owner, 2026-09-29)", () => {
  it("is refused for a post or a schedule, before Facebook hears of it", async () => {
    mine.ids = [];
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ ok: false });
    expect(await publish({ id: "p1", pageId: PAGE, at: hoursAhead(2).toISOString() })).toMatchObject({ ok: false });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("is refused for a move of a post held there", async () => {
    row = piece(pub({ state: "scheduled", postId: `${PAGE}_1`, at: hoursAhead(3).toISOString() }));
    mine.ids = [];
    expect(await move("p1", hoursAhead(5))).toMatchObject({ ok: false });
    expect(fb.deletePost).not.toHaveBeenCalled();
  });

  it("is refused for taking a held post back", async () => {
    row = piece(pub({ state: "scheduled", postId: `${PAGE}_1`, at: hoursAhead(3).toISOString() }));
    mine.ids = [];
    expect(await withdraw(row)).toEqual({ ok: false, error: "โพสต์นี้อยู่ในเพจที่คุณไม่ได้ดูแล" });
    expect(fb.deletePost).not.toHaveBeenCalled();
  });
});

describe("a piece of one Page's project (owner, 2026-09-30)", () => {
  const TALK = "205";
  beforeEach(() => {
    conn.pageConnections.mockResolvedValue([
      { pageId: PAGE, pageName: "LuckyPlanner", scopes: ["pages_manage_posts"] },
      { pageId: TALK, pageName: "ประกัน Talk", scopes: ["pages_manage_posts"] },
    ]);
  });

  it("is refused on another Page, before Facebook hears of it", async () => {
    row = { ...piece(), pageId: PAGE };
    const r = await publish({ id: "p1", pageId: TALK, at: null });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("LuckyPlanner") });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("goes up on its own Page, and is not tied again", async () => {
    row = { ...piece(), pageId: PAGE };
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(store.adoptPage).not.toHaveBeenCalled();
  });

  it("on no Page yet, becomes the Page's it goes to", async () => {
    row = { ...piece(), pageId: null };
    expect((await publish({ id: "p1", pageId: TALK, at: null })).ok).toBe(true);
    expect(store.adoptPage).toHaveBeenCalledWith("p1", TALK);
  });
});

describe("a Reel", () => {
  const clean = { numbers: [], words: [], policy: [], fixes: null };
  const video = (over: Partial<NonNullable<ContentOutput["video"]>> = {}): NonNullable<ContentOutput["video"]> => ({
    path: "p1/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.mp4", durationSec: 40, width: 1080, height: 1920, sizeBytes: 9, mime: "video/mp4",
    uploadedAt: "2026-10-02T00:00:00Z", caption: "แคปชัน", flags: clean, transcript: [], ...over,
  });
  const reel = (v = video(), format: ContentItem["format"] = "clip", flags: ContentItem["flags"] = clean) =>
    ({ ...piece(null, { ...output, hooks: [], body: "", video: v }), format, flags });

  const edit = (over: Record<string, unknown> = {}) => ({ rev: "r1", cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" as const, ...over });
  const jobOf = (kind: "prepare" | "render", ago = 60_000) =>
    ({ kind, engine: "lambda" as const, id: "j1", startedAt: new Date(Date.now() - ago).toISOString(), tokenHash: "h" });

  it("goes up as the edited take when there is one", async () => {
    row = reel(video({ edit: edit({ renderedPath: "p1/edited.mp4", renderedRev: "r1" }) }));
    await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true });
    expect(clips.clipReadUrl).toHaveBeenCalledWith("p1/edited.mp4", expect.any(Number));
  });
  it("asks before posting a take older than the edit, and posts it once confirmed", async () => {
    row = reel(video({ edit: edit({ renderedPath: "p1/edited.mp4", renderedRev: "r1", rev: "r2" }) }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toMatchObject({ ok: false, confirmStale: true });
    expect(fb.postReel).not.toHaveBeenCalled();
    expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true, confirmStale: true })).ok).toBe(true);
  });
  it("posts the original when the edit was never rendered", async () => {
    row = reel(video({ edit: edit() }));
    await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true });
    expect(clips.clipReadUrl).toHaveBeenCalledWith(row.output.video!.path, expect.any(Number));
  });

  it("will not post or schedule while a render is running or being sent, but a prepare does not stop it", async () => {
    const wait = "กำลังสร้างคลิปที่ตัดต่อ — รอให้เสร็จก่อนลงเพจ";
    row = reel(video({ edit: edit({ job: jobOf("render") }) }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toEqual({ ok: false, error: wait });
    expect(await publish({ id: "p1", pageId: PAGE, at: hoursAhead(2).toISOString(), confirmSpoken: true })).toEqual({ ok: false, error: wait });
    row = reel(video({ edit: edit({ submitting: { id: "c", at: new Date().toISOString(), kind: "render" } }) }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toEqual({ ok: false, error: wait });
    expect(fb.postReel).not.toHaveBeenCalled();
    row = reel(video({ edit: edit({ job: jobOf("prepare") }) }));
    expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).ok).toBe(true);
  });
  describe("a render pressed, or the take let go, between clear() and the claim (final review, 2026-10-02)", () => {
    /** the claim lands, and the edit changes just after clear() read it */
    const raceWith = (change: (e: ReturnType<typeof edit>) => ReturnType<typeof edit>) => {
      store.claimPublish.mockImplementationOnce(async (_id: string, now: Date) => {
        row = { ...row, publish: { ...(row.publish ?? pub({})), state: "posting", at: now.toISOString(), error: null } };
        const v = row.output.video!;
        row = { ...row, output: { ...row.output, rev: "rZ", video: { ...v, edit: change(v.edit as ReturnType<typeof edit>) as typeof v.edit } } };
        return true;
      });
    };

    it("a render claim that appeared stops the send and gives the claim back, nothing sent", async () => {
      row = reel(video({ edit: edit() }));
      raceWith((e) => ({ ...e, submitting: { id: "c", at: new Date().toISOString(), kind: "render" } }));
      expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toEqual({ ok: false, error: "กำลังสร้างคลิปที่ตัดต่อ — รอให้เสร็จก่อนลงเพจ" });
      expect(row.publish).toBeNull();
      expect(clips.clipReadUrl).not.toHaveBeenCalled();
      expect(fb.postReel).not.toHaveBeenCalled();
    });

    it("a take that changed stops it too, and the row goes back to how it was", async () => {
      row = { ...reel(video({ edit: edit({ renderedPath: "p1/e.mp4", renderedRev: "r1" }) })), publish: pub({ state: "failed", error: "ครั้งก่อน" }) };
      raceWith((e) => ({ ...e, renderedPath: undefined, renderedRev: undefined }));
      expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toEqual({ ok: false, error: CONCURRENT });
      expect(row.publish).toMatchObject({ state: "failed", error: "ครั้งก่อน" });
      expect(fb.postReel).not.toHaveBeenCalled();
    });

    it("a Reel whose take stayed the same goes up", async () => {
      row = reel(video({ edit: edit({ renderedPath: "p1/e.mp4", renderedRev: "r1" }) }));
      raceWith((e) => ({ ...e, hook: { main: "แก้หัว" } }));
      expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).ok).toBe(true);
      expect(clips.clipReadUrl).toHaveBeenCalledWith("p1/e.mp4", expect.any(Number));
    });
  });

  it("a render that never answered, or a dead submit claim, does not hold the Reel", async () => {
    row = reel(video({ edit: edit({ job: jobOf("render", 20 * 60_000), submitting: { id: "c", at: minutesAgo(10), kind: "render" } }) }));
    expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).ok).toBe(true);
  });
  it("moving a held Reel is not stopped by a render or a stale take", async () => {
    row = reel(video({ edit: edit({ rev: "r2", renderedPath: "p1/e.mp4", renderedRev: "r1", job: jobOf("render") }) }));
    row = { ...row, publish: pub({ postId: "v9", at: hoursAhead(3).toISOString() }) };
    expect((await move("p1", hoursAhead(5))).ok).toBe(true);
  });

  it("an edit a render wrote while publish worked is not wiped by publish's own write", async () => {
    row = reel(video());
    fb.postReel.mockImplementationOnce(async () => {
      // the render finishes between publish's read and its write of the opening line
      row = { ...row, output: { ...row.output, rev: "rX", video: { ...row.output.video!, edit: edit({ renderedPath: "p1/new.mp4", renderedRev: "r1" }) } } };
      return { id: "v500" };
    });
    const r = await publish({ id: "p1", pageId: PAGE, at: null, hook: 2, confirmSpoken: true });
    expect(r.ok).toBe(true);
    expect(row.output.video?.edit?.renderedPath).toBe("p1/new.mp4");
    expect(row.output.postedHook).toBe(2);
    expect(store.saveOutput).not.toHaveBeenCalled();
  });

  it("an expired clip never gets a link to its removed file, edited take or not", async () => {
    row = reel(video({ expired: true, edit: edit({ renderedPath: "p1/edited.mp4", renderedRev: "r1" }) }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).toEqual({ ok: false, error: CLIP_EXPIRED });
    expect(clips.clipReadUrl).not.toHaveBeenCalled();
  });

  it("goes up through postReel with the caption and no poster drawn", async () => {
    row = reel();
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(fb.postReel).toHaveBeenCalledWith(expect.objectContaining({ pageId: PAGE, fileUrl: "https://signed" }));
    expect((fb.postReel.mock.calls[0][0] as { caption: string }).caption.startsWith("แคปชัน")).toBe(true);
    expect(fb.postPhoto).not.toHaveBeenCalled();
    expect(drawPoster).not.toHaveBeenCalled();
    expect(row.publish).toMatchObject({ state: "published", postId: "v100" });
  });

  it("a Reel is judged by its caption: a script's blocked words do not stop it, a blocked caption does", async () => {
    const block = { numbers: [], words: [], policy: [{ code: "x", severity: "block" as const, message: "ผิด", fix: "", match: "" }], fixes: null };
    row = reel(video(), "script", block);
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    row = reel(video({ flags: block }), "script", clean);
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(false);
  });

  it("asks about what was said, once, and lets it go when confirmed", async () => {
    row = reel(video({ spokenFlags: [{ at: 42, kind: "word", text: "การันตี", message: "ได้ยินว่า “การันตี”" }] }));
    const asked = await publish({ id: "p1", pageId: PAGE, at: null });
    expect(asked).toMatchObject({ ok: false, confirmSpoken: ["0:42 ได้ยินว่า “การันตี”"] });
    expect(fb.postReel).not.toHaveBeenCalled();
    expect((await publish({ id: "p1", pageId: PAGE, at: null, confirmSpoken: true })).ok).toBe(true);
  });

  it("asks too when nobody has listened to it", async () => {
    row = reel(video({ transcript: undefined }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toMatchObject({ confirmSpoken: ["ยังไม่ได้ตรวจเสียงพูดในคลิป"] });
  });

  it("refuses an expired file, and a script with no clip", async () => {
    row = reel(video({ expired: true }));
    expect(await publish({ id: "p1", pageId: PAGE, at: null })).toEqual({ ok: false, error: CLIP_EXPIRED });
    row = { ...piece(), format: "script" };
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(false);
  });

  it("holds up to 29 days, not 30", async () => {
    row = reel();
    expect((await publish({ id: "p1", pageId: PAGE, at: hoursAhead(24 * 29.5).toISOString() })).ok).toBe(false);
    expect((await publish({ id: "p1", pageId: PAGE, at: hoursAhead(24 * 28).toISOString() })).ok).toBe(true);
  });

  it("no read link: a plain failure, nothing sent, not 'may be on the Page'", async () => {
    row = reel();
    clips.clipReadUrl.mockRejectedValue(new Error("storage down"));
    const r = await publish({ id: "p1", pageId: PAGE, at: null });
    expect(r).toMatchObject({ ok: false });
    expect(r).not.toHaveProperty("confirmRepost");
    expect(fb.postReel).not.toHaveBeenCalled();
    expect(row.publish?.state).toBe("failed");
  });

  it("a move re-sends the file and does not ask about what was said again", async () => {
    row = reel(video({ spokenFlags: [{ at: 1, kind: "word", text: "x", message: "m" }] }));
    row = { ...row, publish: pub({ state: "scheduled", postId: "v9", at: hoursAhead(5).toISOString() }) };
    expect((await move("p1", hoursAhead(30))).ok).toBe(true);
    expect(fb.deletePost).toHaveBeenCalledWith("v9", "token");
    expect(fb.postReel).toHaveBeenCalledTimes(1);
  });

  it("a held Reel Facebook failed to process is taken back and marked failed", async () => {
    row = { ...reel(), publish: pub({ state: "scheduled", postId: "v9", at: minutesAgo(30) }) };
    store.listDue.mockImplementation(async () => [row]);
    fb.reelState.mockResolvedValue("failed");
    await verifyDue();
    expect(fb.postState).not.toHaveBeenCalled();
    expect(row.publish).toMatchObject({ state: "failed", error: REEL_FAILED });
  });

  it("a held Reel still processing is left as it is", async () => {
    row = { ...reel(), publish: pub({ state: "scheduled", postId: "v9", at: minutesAgo(30) }) };
    store.listDue.mockImplementation(async () => [row]);
    fb.reelState.mockResolvedValue("unknown");
    await verifyDue();
    expect(row.publish?.state).toBe("scheduled");
  });
});
