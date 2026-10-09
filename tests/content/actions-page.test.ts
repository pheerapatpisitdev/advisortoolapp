import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Flags, Publish, PublishState } from "@/lib/content/store";
import type { ContentOutput } from "@/lib/content/output";

/**
 * The workbench's edits and deletes against what Facebook holds, over a one-row store kept in
 * memory: a piece on the Page is not changed here, and a held one is changed on Facebook too.
 */

import { CLASSIC, STYLES } from "@/lib/content/looks";
import { READ_FAILED } from "@/lib/content/poster-text";
const PAGE = "105";
let row: ContentItem;
const order: string[] = [];

const store = vi.hoisted(() => ({
  getContent: vi.fn(), saveOutput: vi.fn(), saveOutputIf: vi.fn(), recordPublishIf: vi.fn(), claimPublish: vi.fn(), deleteContent: vi.fn(),
  removeBackground: vi.fn(), listWords: vi.fn(), recentHooks: vi.fn(async (): Promise<string[]> => []), holdContentBudget: vi.fn(), releaseContentBudget: vi.fn(),
  contentSpentThisMonth: vi.fn(), contentCap: vi.fn(), setFixes: vi.fn(), saveBackground: vi.fn(), setStatus: vi.fn(),
  listContent: vi.fn(), countByStatus: vi.fn(), recentLooks: vi.fn(async (): Promise<object[]> => []),
  usedHooks: vi.fn(async (): Promise<string[]> => []), saveContent: vi.fn(),
}));
const fb = vi.hoisted(() => ({ postPhoto: vi.fn(), deletePost: vi.fn(), isPublished: vi.fn() }));
const ai = vi.hoisted(() => ({ chat: vi.fn(), drawImage: vi.fn() }));

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.4"]]) }));
// work left for after the answer is kept here, to be run when a test says so
const later = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (task: () => unknown) => { later.push(task); } }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), ...ai }));
vi.mock("@/lib/facebook/publish", async (orig) => ({ ...(await orig<typeof import("@/lib/facebook/publish")>()), ...fb }));
vi.mock("@/lib/facebook/connection", () => ({
  pageConnections: vi.fn(async () => [{ pageId: PAGE, pageName: "LuckyPlanner", scopes: ["pages_manage_posts"] }]),
  pageToken: vi.fn(async () => "token"),
}));
vi.mock("@/lib/content/poster-draw", () => ({ drawPoster: vi.fn(async () => Buffer.from("png")) }));
// the real one, watched: whether a round was counted at all
vi.mock("@/lib/auth/quota", async (orig) => {
  const real = await orig<typeof import("@/lib/auth/quota")>();
  return { ...real, takeRound: vi.fn(real.takeRound) };
});
// the real one, watched: which brief an edit is checked against
vi.mock("@/lib/content/brief", async (orig) => {
  const real = await orig<typeof import("@/lib/content/brief")>();
  return { ...real, briefFor: vi.fn(real.briefFor) };
});
vi.mock("@/lib/content/people-store", () => ({
  personPhotos: vi.fn(async () => ({ person: { id: "person-1" }, photos: [{ bytes: Buffer.from("x"), mimeType: "image/png" }] })),
}));

const { contentWorkbench, drawBackground, generateContent, proofreadPiece, removeContent, saveContentEdits, setContentStatus } = await import("@/app/studio/actions");
const { NUMBERS_PLANS, numberSheets } = await import("@/lib/content/numbers-plans");
const { NUMBERS_CLOSING, NUMBERS_CLOSING_EN, numbersBody, numbersPoster, numbersYardstick } = await import("@/lib/content/numbers");
const { DISCLAIMER_EN, fullText } = await import("@/lib/content/output");
const { posterText } = await import("@/lib/content/poster");
const { PAINTERS, OVERHEAD_THB } = await import("@/lib/content/models");
const { CONCURRENT } = await import("@/lib/content/publish-flow");
const { strayNumbers } = await import("@/lib/content/check");
const { briefFor } = await import("@/lib/content/brief");
const { takeRound } = await import("@/lib/auth/quota");

const clean: Flags = { numbers: [], words: [], policy: [], fixes: null };
const output: ContentOutput = {
  hooks: ["หัวเรื่อง", "หัวที่สอง"], body: "เนื้อหาเดิม", closing: "ทักแชทได้เลย", hashtags: [], imagePrompt: "", disclaimer: "d",
  poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "หัวเรื่อง" }], background: "p1/old.png" },
};
const make = (publish: Publish | null, out: ContentOutput = output): ContentItem => ({
  id: "p1", createdAt: "2026-09-25T00:00:00Z", planHref: "/nowhere", format: "post", angle: "", length: null,
  output: out, flags: clean, model: null, costThb: 0, status: "used", hookTemplateId: null, publish, agentId: null, pageId: PAGE, plan: null, campaignId: null,
});
const held = (msAhead: number, postId = `${PAGE}_9`): Publish =>
  ({ state: "scheduled", pageId: PAGE, postId, at: new Date(Date.now() + msAhead).toISOString(), error: null });
const edits = (over: Partial<ContentOutput> = {}) => ({
  hooks: output.hooks, body: "เนื้อหาใหม่", closing: output.closing, hashtags: [], poster: output.poster, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  row = make(null);
  store.getContent.mockImplementation(async () => row);
  let rev = 0;
  store.saveOutput.mockImplementation(async (_id: string, out: ContentOutput, flags?: Flags) => {
    order.push("saveOutput");
    row = { ...row, output: { ...out, rev: `r${++rev}` }, flags: flags ?? row.flags };
    return row;
  });
  // the table's conditional writes: applied only while the row is as the caller read it
  store.saveOutputIf.mockImplementation(async (_id: string, out: ContentOutput, flags: Flags | undefined, expected: string | null) => {
    if ((row.output.rev ?? null) !== expected) return null;
    order.push("saveOutput");
    row = { ...row, output: { ...out, rev: `r${++rev}` }, flags: flags ?? row.flags };
    return row;
  });
  store.recordPublishIf.mockImplementation(async (_id: string, from: { state: PublishState; postId?: string | null; at?: string }, p: Partial<Publish> & { state: PublishState }) => {
    const now = row.publish;
    if (!now || now.state !== from.state) return null;
    if (from.postId !== undefined && now.postId !== from.postId) return null;
    if (from.at !== undefined && now.at !== from.at) return null;
    row = { ...row, publish: { ...now, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)), error: p.error ?? null } as Publish };
    return row;
  });
  store.claimPublish.mockImplementation(async (_id: string, now: Date) => {
    row = { ...row, publish: { ...(row.publish ?? { pageId: null, postId: null, error: null }), state: "posting", at: now.toISOString() } as Publish };
    return true;
  });
  store.deleteContent.mockImplementation(async () => { order.push("deleteContent"); });
  store.listWords.mockResolvedValue([]);
  store.holdContentBudget.mockResolvedValue({ ok: true, id: "hold-1" });
  store.contentSpentThisMonth.mockResolvedValue(0);
  store.contentCap.mockResolvedValue(30);
  fb.postPhoto.mockImplementation(async () => { order.push("postPhoto"); return { id: `${PAGE}_10` }; });
  fb.deletePost.mockImplementation(async () => { order.push("deletePost"); });
});

describe("editing a piece Facebook is holding", () => {
  it("takes the held post back and holds the edited one for the same time on the same Page", async () => {
    row = make(held(5 * 3_600_000));
    const at = row.publish!.at!;
    const r = await saveContentEdits("p1", edits());
    expect(r.ok).toBe(true);
    expect(order).toEqual(["saveOutput", "deletePost", "postPhoto"]);
    expect(fb.deletePost).toHaveBeenCalledWith(`${PAGE}_9`, "token");
    const sent = fb.postPhoto.mock.calls[0][0];
    expect(sent.pageId).toBe(PAGE);
    expect(sent.at.toISOString()).toBe(at);
    expect(sent.caption).toContain("เนื้อหาใหม่");
    expect(row.publish).toMatchObject({ state: "scheduled", postId: `${PAGE}_10`, at });
  });

  it("refuses to edit a held Reel: nothing written, nothing taken back", async () => {
    const video = { path: "p1/a.mp4", durationSec: 40, width: 1080, height: 1920, sizeBytes: 9, mime: "video/mp4", uploadedAt: "2026-10-02T00:00:00Z", caption: "c", flags: clean, transcript: [] };
    row = { ...make(held(5 * 3_600_000), { ...output, video }), format: "script" };
    expect(await saveContentEdits("p1", edits())).toEqual({ ok: false, error: "Reel นี้ตั้งเวลาไว้แล้ว — ยกเลิกคิวก่อนแก้ข้อความ" });
    expect(store.saveOutputIf).not.toHaveBeenCalled();
    expect(fb.deletePost).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });

  it("sends the edited piece with the opening line it was first posted with", async () => {
    row = make(held(5 * 3_600_000), { ...output, postedHook: 1 });
    expect((await saveContentEdits("p1", edits())).ok).toBe(true);
    expect(fb.postPhoto.mock.calls[0][0].caption.startsWith("หัวที่สอง")).toBe(true);
  });

  it("asks about a new amount before touching Facebook", async () => {
    row = make(held(5 * 3_600_000));
    const r = await saveContentEdits("p1", edits({ body: "เบี้ยเพียง 12,345 บาท" }));
    expect(r).toMatchObject({ ok: false, confirmNumbers: ["12,345 บาท"] });
    expect(fb.deletePost).not.toHaveBeenCalled();
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });

  it("puts the old words back when Facebook would not take the held post back", async () => {
    row = make(held(5 * 3_600_000));
    fb.deletePost.mockRejectedValueOnce(new Error("down"));
    const r = await saveContentEdits("p1", edits());
    expect(r.ok).toBe(false);
    expect(row.output.body).toBe("เนื้อหาเดิม");
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("puts the old words back when another request had the piece, so the Page and the piece agree", async () => {
    row = make(held(5 * 3_600_000));
    // the claim is lost: another move or edit took the row between the check and the claim
    store.recordPublishIf.mockResolvedValueOnce(null);
    const r = await saveContentEdits("p1", edits());
    expect(r).toEqual({ ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วบันทึกอีกครั้ง" });
    expect(row.output.body).toBe("เนื้อหาเดิม");
    expect(fb.deletePost).not.toHaveBeenCalled();
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("leaves the row failed, and says so, when the edited one could not be held", async () => {
    row = make(held(5 * 3_600_000));
    fb.postPhoto.mockRejectedValueOnce(new Error("down"));
    const r = await saveContentEdits("p1", edits());
    expect(r.ok).toBe(false);
    expect(row.publish?.state).toBe("failed");
  });
});

describe("a piece on the Page", () => {
  it("is not edited here — the Page would not change", async () => {
    row = make(held(-3_600_000));
    expect(await saveContentEdits("p1", edits())).toEqual({ ok: false, error: expect.stringContaining("ขึ้นเพจแล้ว") });
    row = make({ state: "posting", pageId: PAGE, postId: null, at: new Date().toISOString(), error: null });
    expect((await saveContentEdits("p1", edits())).ok).toBe(false);
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });

  it("is not deleted here either", async () => {
    row = make({ state: "published", pageId: PAGE, postId: `${PAGE}_9`, at: new Date().toISOString(), error: null });
    expect(await removeContent("p1")).toEqual({ ok: false, error: expect.stringContaining("ขึ้นเพจแล้ว") });
    expect(store.deleteContent).not.toHaveBeenCalled();
  });
});

describe("deleting a held piece", () => {
  it("takes the Facebook post back first, then the row", async () => {
    row = make(held(5 * 3_600_000));
    expect(await removeContent("p1")).toEqual({ ok: true });
    expect(order).toEqual(["deletePost", "deleteContent"]);
  });

  it("refuses while another request holds it, and deletes nothing", async () => {
    row = make(held(5 * 3_600_000));
    const stale = row;
    row = { ...row, publish: { ...row.publish!, state: "posting", at: new Date().toISOString() } };
    store.getContent.mockResolvedValueOnce(stale);
    expect(await removeContent("p1")).toEqual({ ok: false, error: CONCURRENT });
    expect(fb.deletePost).not.toHaveBeenCalled();
    expect(store.deleteContent).not.toHaveBeenCalled();
  });

  it("keeps the row when Facebook would not let the post go", async () => {
    row = make(held(5 * 3_600_000));
    fb.deletePost.mockRejectedValueOnce(new Error("down"));
    const r = await removeContent("p1");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(store.deleteContent).not.toHaveBeenCalled();
  });
});

describe("the bin", () => {
  it("takes a piece off the Page's list only — ทิ้ง keeps the row and its pictures", async () => {
    expect(await setContentStatus("p1", "trashed")).toEqual({ ok: true });
    expect(store.setStatus).toHaveBeenCalledWith("p1", "trashed");
    expect(store.deleteContent).not.toHaveBeenCalled();
  });

  it("marks a piece used without waiting for its formula to be drawn out", async () => {
    later.length = 0;
    row = { ...make(null), status: "draft" };
    ai.chat.mockResolvedValue({ text: "{}" });
    expect(await setContentStatus("p1", "used")).toEqual({ ok: true });
    expect(store.setStatus).toHaveBeenCalledWith("p1", "used");
    // the model is asked after the answer has gone back, not before
    expect(ai.chat).not.toHaveBeenCalled();
    expect(later).toHaveLength(1);
    await later[0]();
    expect(ai.chat).toHaveBeenCalledOnce();
  });

  it("approving an ad leaves the hook-formula library alone — an ad headline is not an organic hook", async () => {
    later.length = 0;
    for (const over of [{ format: "ad" as const }, { campaignId: "c1" }]) {
      row = { ...make(null), status: "draft", ...over };
      expect(await setContentStatus("p1", "used")).toEqual({ ok: true });
      expect(store.setStatus).toHaveBeenCalledWith("p1", "used");
    }
    expect(later).toHaveLength(0);
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("will not take a piece Facebook holds or shows — the post would stay up", async () => {
    for (const publish of [held(5 * 3_600_000), held(-3_600_000)]) {
      row = make(publish);
      expect(await setContentStatus("p1", "trashed")).toEqual({ ok: false, error: expect.stringContaining("ปฏิทินโพสต์") });
    }
    expect(store.setStatus).not.toHaveBeenCalled();
  });

  it("takes a failed send, which is not on the Page", async () => {
    row = make({ state: "failed", pageId: PAGE, postId: null, at: null, error: "x" });
    expect(await setContentStatus("p1", "trashed")).toEqual({ ok: true });
  });
});

describe("deleting a piece that may already be on the Page", () => {
  it("asks the owner to check the Page first, and deletes with force", async () => {
    row = make({ state: "failed", pageId: PAGE, postId: "777", at: null, error: "x" });
    expect(await removeContent("p1")).toEqual({
      ok: false, error: "โพสต์นี้อาจขึ้นเพจไปแล้ว — เปิดเพจเช็กก่อน ถ้าขึ้นแล้วให้ลบในเพจ", confirmDelete: true,
    });
    expect(store.deleteContent).not.toHaveBeenCalled();
    expect(await removeContent("p1", { force: true })).toEqual({ ok: true });
  });

  it("treats a stuck send the same way", async () => {
    row = make({ state: "posting", pageId: PAGE, postId: null, at: new Date(Date.now() - 20 * 60_000).toISOString(), error: null });
    expect(await removeContent("p1")).toMatchObject({ ok: false, confirmDelete: true });
  });
});

describe("saving an edit", () => {
  it("says what is wrong with a poster it cannot draw, instead of keeping the old one quietly", async () => {
    const poster = (blocks: unknown) => edits({ poster: { layout: "bottom", theme: "navy", blocks } as never });
    expect(await saveContentEdits("p1", poster([{ kind: "sub", text: "x" }]))).toEqual({ ok: false, error: "ภาพไม่มีพาดหัว — เพิ่มพาดหัวก่อนบันทึก" });
    expect(await saveContentEdits("p1", poster([{ kind: "headline", text: "  " }]))).toEqual({ ok: false, error: "พาดหัวบนภาพว่างอยู่ — ใส่พาดหัวก่อนบันทึก" });
    expect(await saveContentEdits("p1", poster([]))).toEqual({ ok: false, error: "ภาพไม่มีข้อความเลย — ใส่พาดหัวก่อนบันทึก" });
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });

  it("keeps a photograph a redraw put on file while the edit was being saved", async () => {
    // the first write finds the piece changed under it (the redraw landed and deleted old.png)
    store.saveOutputIf.mockImplementationOnce(async () => {
      row = { ...row, output: { ...row.output, poster: { ...row.output.poster!, background: "p1/new.png" }, rev: "redrawn" } };
      return null;
    });
    const r = await saveContentEdits("p1", edits());
    expect(r.ok).toBe(true);
    expect(row.output.poster?.background).toBe("p1/new.png");
    expect(row.output.body).toBe("เนื้อหาใหม่");
  });

  it("removes the photograph's file when the owner goes back to the plain colour", async () => {
    const { background: _drop, ...plain } = output.poster!;
    void _drop;
    const r = await saveContentEdits("p1", edits({ poster: plain }), { plain: true });
    expect(r.ok).toBe(true);
    expect(row.output.poster?.background).toBeUndefined();
    expect(store.removeBackground).toHaveBeenCalledWith("p1", "p1/old.png");
  });

  it("keeps the photograph on file whatever path the browser sends", async () => {
    await saveContentEdits("p1", edits({ poster: { ...output.poster!, background: "p2/someone-else.png" } }));
    expect(row.output.poster?.background).toBe("p1/old.png");
    expect(store.removeBackground).not.toHaveBeenCalled();
  });

  it("reads the hashtags for Facebook's rules too", async () => {
    await saveContentEdits("p1", edits({ hashtags: ["#คุณป่วยอยู่ใช่ไหม"] }));
    expect(row.flags.policy?.map((f) => f.code)).toContain("health_you");
  });

  it("checks a numbers post against the figures it was written from, not only the brief", async () => {
    // a sheet whose figures the brief does not carry (the brief prices one example person)
    const { href, s } = Object.keys(NUMBERS_PLANS)
      .flatMap((h) => numberSheets(h, 3).map((sheet) => ({ href: h, s: sheet })))
      .find(({ href: h, s: sheet }) => strayNumbers(numbersBody(sheet), briefFor(h)!.text).length > 0)!;
    const figures = numbersYardstick([s]);
    const numbers: ContentOutput = {
      hooks: ["เบี้ยจริงของคนจริง"], body: numbersBody(s), closing: NUMBERS_CLOSING, hashtags: [], imagePrompt: "",
      disclaimer: "d", poster: numbersPoster(s), figures,
    };
    // the bug this guards: against the brief alone, the engine's own premium reads as stray
    expect(strayNumbers(numbers.body, briefFor(href)!.text).length).toBeGreaterThan(0);
    row = { ...make(null, numbers), planHref: href };
    const r = await saveContentEdits("p1", { hooks: numbers.hooks, body: numbers.body, closing: numbers.closing, hashtags: [], poster: numbers.poster });
    expect(r.ok).toBe(true);
    expect(row.flags.numbers).toEqual([]);
    expect(row.output.figures).toBe(figures);
  });
});

describe("the content ceiling", () => {
  it("refuses a round when the money set aside does not fit beside rounds already running", async () => {
    store.holdContentBudget.mockResolvedValueOnce({ ok: false, left: 1.5 });
    const r = await generateContent({ href: Object.keys(NUMBERS_PLANS)[0], format: "post", angle: "", custom: "", length: null, count: 2, hookTemplateId: null });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("เหลือ 1.50 บาท") });
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("sets a person's picture aside at Gemini's price, and gives the hold back after", async () => {
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gemini", id: "gemini-image", costThb: 2.41 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const r = await drawBackground("p1", "", "standard", { id: "person-1", pose: "auto" });
    expect(r.ok).toBe(true);
    const gemini = PAINTERS.find((p) => p.id === "gemini")!.thb;
    expect(store.holdContentBudget).toHaveBeenCalledWith(gemini + OVERHEAD_THB, 30);
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
    // the picture it replaced goes; the flags are not written over
    expect(store.removeBackground).toHaveBeenCalledWith("p1", "p1/old.png");
    expect(store.saveOutputIf.mock.calls[0][2]).toBeUndefined();
  });

  it("draws the look picked for the piece, not the Page's last one, and keeps it with the piece", async () => {
    store.recentLooks.mockResolvedValueOnce([CLASSIC]);
    ai.chat.mockResolvedValueOnce({ text: JSON.stringify({ style: "flatlay", subject: "objects", place: "home", light: "morning", mood: "calm", space: "table" }), model: "m", costThb: 0.01, outputTokens: 30 });
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const r = await drawBackground("p1", "", "standard", null);
    expect(r.ok).toBe(true);
    expect(store.recentLooks).toHaveBeenCalledWith(row.pageId);
    expect(ai.drawImage.mock.calls[0][0].prompt).toContain(STYLES.find((s) => s.id === "flatlay")!.say);
    expect(row.output.look).toEqual({ style: "flatlay", subject: "objects", place: "home", light: "morning", mood: "calm", space: "table" });
  });

  it("still draws, in the original look, when the look cannot be picked", async () => {
    store.recentLooks.mockRejectedValueOnce(new Error("db down"));
    ai.chat.mockRejectedValueOnce(new Error("ai down"));
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const r = await drawBackground("p1", "", "standard", null);
    expect(r.ok).toBe(true);
    expect(ai.drawImage.mock.calls[0][0].prompt).toContain("editorial-quality");
    expect(row.output.look).toEqual(CLASSIC);
  });

  it("keeps the drawn-words record the server wrote, whatever an edit from the browser sends", async () => {
    const aiText = { blocks: "headline:หัวเรื่อง", read: "หัวเรื่อง", issues: ["x"], checked: false };
    row = make(null, { ...output, poster: { ...output.poster!, aiText } });
    const forged = { ...output.poster!, aiText: { ...aiText, issues: [], checked: true } };
    expect((await saveContentEdits("p1", edits({ poster: forged }))).ok).toBe(true);
    expect(row.output.poster?.aiText).toEqual(aiText);
    row = make(null, { ...output });
    expect((await saveContentEdits("p1", edits({ poster: forged }))).ok).toBe(true);
    expect(row.output.poster?.aiText).toBeUndefined();
  });

  it("with a brief, has the model draw the whole poster, words and all, and reads the words back", async () => {
    row = { ...row, output: { ...row.output, look: CLASSIC } };
    ai.chat
      .mockResolvedValueOnce({ text: "a scrapbook collage of family photos", model: "m", costThb: 0.01, outputTokens: 10 })
      .mockResolvedValueOnce({ text: JSON.stringify({ text: "หัวเรื่อง" }), model: "reader", costThb: 0.02, outputTokens: 10 });
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-high", costThb: 0.86 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const r = await drawBackground("p1", "ภาพแปะหลายรูปแบบสมุดภาพ", "sharp", null);
    expect(r.ok).toBe(true);
    const prompt = ai.drawImage.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("a scrapbook collage of family photos");
    expect(prompt).toContain("หัวเรื่อง");
    expect(prompt).not.toContain("NO text, letters, numbers or words");
    expect(store.recentLooks).not.toHaveBeenCalled();
    // the second call reads the picture it drew
    expect(ai.chat.mock.calls[1][0].messages.at(-1).images[0].mimeType).toBe("image/png");
    expect(row.output.poster?.aiText).toEqual({ blocks: "headline:หัวเรื่อง", read: "หัวเรื่อง", issues: [], checked: false });
    expect(row.output.look).toBeUndefined();
  });

  it("takes a long art direction whole: translated in full, not cut to a sentence", async () => {
    const english = `Premium editorial poster. ${"Torn paper layers, masking tape, muted gold accents. ".repeat(30)}`.trim();
    ai.chat
      .mockResolvedValueOnce({ text: english, model: "m", costThb: 0.02, outputTokens: 600 })
      .mockResolvedValueOnce({ text: JSON.stringify({ text: "หัวเรื่อง" }), model: "reader", costThb: 0.02, outputTokens: 10 });
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-high", costThb: 0.86 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const thai = `ออกแบบโปสเตอร์แบบ Premium Editorial ${"ใช้กระดาษฉีก เทปกระดาษ สีทองหม่น ".repeat(40)}`;
    expect(thai.length).toBeGreaterThan(1000);
    expect((await drawBackground("p1", thai, "sharp", null)).ok).toBe(true);
    const translate = ai.chat.mock.calls[0][0];
    expect(String(translate.messages[1].content).length).toBe(thai.trim().length);
    expect(String(translate.messages[0].content)).not.toContain("one short");
    expect(ai.drawImage.mock.calls[0][0].prompt).toContain(english);
  });

  it("keeps the picture when its words cannot be read back, and asks the agent to look", async () => {
    ai.chat.mockRejectedValueOnce(new Error("reader down"));
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-high", costThb: 0.86 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const r = await drawBackground("p1", "a scrapbook collage", "sharp", null);
    expect(r.ok).toBe(true);
    expect(row.output.poster?.aiText).toMatchObject({ issues: [READ_FAILED], checked: false });
  });

  it("draws only the picture behind a รีวิวเคลม's papers, brief or not: the papers are laid by the code", async () => {
    const PAPER = { path: "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.jpg", ratio: 0.75 };
    row = make(null, { ...output, poster: { ...output.poster!, documents: [PAPER] } });
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    expect((await drawBackground("p1", "a sunny beach", "standard", null)).ok).toBe(true);
    expect(ai.drawImage.mock.calls[0][0].prompt).toContain("NO text, letters, numbers or words");
    expect(row.output.poster?.aiText).toBeUndefined();
  });

  it("takes the drawn-words record away when the picture is drawn again without a brief", async () => {
    row = make(null, { ...output, poster: { ...output.poster!, aiText: { blocks: "headline:หัวเรื่อง", read: "หัวเรื่อง", issues: [], checked: true } } });
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    expect((await drawBackground("p1", "", "standard", null)).ok).toBe(true);
    expect(row.output.poster?.aiText).toBeUndefined();
  });

  it("does not write a picture's older copy of the words over an edit saved while it drew", async () => {
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    // the owner's edit lands between the drawing's re-read and its write
    store.saveOutputIf.mockImplementationOnce(async () => {
      row = { ...row, output: { ...row.output, body: "แก้ระหว่างวาด", rev: "edited" } };
      return null;
    });
    const r = await drawBackground("p1", "", "standard", null);
    expect(r.ok).toBe(true);
    expect(row.output.body).toBe("แก้ระหว่างวาด");
    expect(row.output.poster?.background).toBe("p1/new.png");
  });

  it("does not draw for a piece already held by Facebook, nor spend on it", async () => {
    row = make(held(5 * 3_600_000));
    const r = await drawBackground("p1", "", "standard", null);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("ตั้งเวลา") });
    expect(ai.drawImage).not.toHaveBeenCalled();
    expect(store.holdContentBudget).not.toHaveBeenCalled();
  });

  it("puts nothing on a piece that went up while it drew, and removes the picture it drew", async () => {
    ai.drawImage.mockImplementation(async () => {
      // the owner pressed ตั้งเวลา while the picture was still being drawn
      row = { ...row, publish: held(5 * 3_600_000) };
      return { bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 };
    });
    store.saveBackground.mockResolvedValue("p1/new.png");
    const r = await drawBackground("p1", "", "standard", null);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("ภาพเดิม") });
    expect(store.saveOutputIf).not.toHaveBeenCalled();
    expect(row.output.poster?.background).toBe("p1/old.png");
    expect(store.removeBackground).toHaveBeenCalledWith("p1", "p1/new.png");
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("gives up after three edits in a row, and removes the picture it drew", async () => {
    ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
    store.saveBackground.mockResolvedValue("p1/new.png");
    store.saveOutputIf.mockResolvedValue(null);
    const r = await drawBackground("p1", "", "standard", null);
    expect(r).toEqual({ ok: false, error: "ชิ้นนี้ถูกแก้ระหว่างวาดรูป — กดวาดใหม่อีกครั้งนะครับ" });
    expect(store.saveOutputIf).toHaveBeenCalledTimes(3);
    expect(store.removeBackground).toHaveBeenCalledWith("p1", "p1/new.png");
  });
});

describe("the workbench list", () => {
  it("says it could not be read, rather than showing an empty tab", async () => {
    store.listContent.mockRejectedValueOnce(new Error("db down"));
    store.countByStatus.mockResolvedValueOnce({ draft: 3, used: 0, trashed: 0 });
    const wb = await contentWorkbench({ status: "draft" });
    expect(wb.failed).toBe(true);
    expect(wb.items).toEqual([]);
  });

  it("gives the next older pieces after the ones shown", async () => {
    store.listContent.mockResolvedValueOnce([row]);
    store.countByStatus.mockResolvedValueOnce({ draft: 57, used: 0, trashed: 0 });
    const wb = await contentWorkbench({ status: "draft", planHref: "/cancer", offset: 40 });
    expect(wb.failed).toBeUndefined();
    // the owner's first Page's project, none being named (2026-09-30)
    expect(store.listContent).toHaveBeenCalledWith({ status: "draft", planHref: "/cancer", pageId: PAGE }, 40, 40);
    expect(wb.counts.draft).toBe(57);
  });

  it("reads a nonsense offset as the start", async () => {
    store.listContent.mockResolvedValueOnce([]);
    store.countByStatus.mockResolvedValueOnce({ draft: 0, used: 0, trashed: 0 });
    await contentWorkbench({ status: "draft", offset: -5 });
    expect(store.listContent).toHaveBeenCalledWith({ status: "draft", planHref: undefined, pageId: PAGE }, 40, 0);
  });
});

describe("a round is not counted for nothing (review, 2026-10-01)", () => {
  const ROUND = { href: Object.keys(NUMBERS_PLANS)[0], format: "post" as const, angle: "" as const, custom: "", length: null, count: 2, hookTemplateId: null };

  it("says the ceiling is reached before a round is taken, not after", async () => {
    store.contentSpentThisMonth.mockResolvedValue(30);
    expect(await generateContent(ROUND)).toEqual({ ok: false, error: expect.stringContaining("ครบ 30 บาท") });
    expect(await drawBackground("p1", "", "standard", null)).toEqual({ ok: false, error: expect.stringContaining("ครบ 30 บาท") });
    expect(takeRound).not.toHaveBeenCalled();
    expect(store.holdContentBudget).not.toHaveBeenCalled();
  });
});

describe("a round inside its function's time (review, 2026-10-01)", () => {
  const t0 = Date.now();
  const later = (ms: number) => vi.spyOn(Date, "now").mockReturnValue(t0 + ms);
  const drawn = { bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-high", costThb: 0.86 };

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(t0);
    store.saveBackground.mockResolvedValue("p1/new.png");
  });
  afterEach(() => vi.restoreAllMocks());

  it("gives the planner a time of its own, and stops — saving nothing — when the writers would have none", async () => {
    ai.chat.mockImplementationOnce(async () => {
      later(262_000);
      return { text: JSON.stringify({ plans: [{ hook: "หนึ่ง" }, { hook: "สอง" }] }), model: "m", costThb: 0.01, outputTokens: 50 };
    });
    const r = await generateContent({ href: Object.keys(NUMBERS_PLANS)[0], format: "post", angle: "", custom: "", length: null, count: 2, hookTemplateId: null });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("ใช้เวลานานเกินไป") });
    expect(ai.chat.mock.calls[0][0].timeoutMs).toBeLessThanOrEqual(50_000);
    // no writer was started with no time to finish
    expect(ai.chat).toHaveBeenCalledTimes(1);
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("puts a picture with drawn words on the piece, marked not read, before the reader is asked", async () => {
    let onPieceWhenRead: unknown;
    ai.chat
      .mockResolvedValueOnce({ text: "a scrapbook collage", model: "m", costThb: 0.01, outputTokens: 10 })
      .mockImplementationOnce(async () => {
        onPieceWhenRead = row.output.poster;
        return { text: JSON.stringify({ text: "หัวเรื่อง" }), model: "reader", costThb: 0.02, outputTokens: 10 };
      });
    ai.drawImage.mockResolvedValue(drawn);
    const r = await drawBackground("p1", "ภาพแปะหลายรูปแบบสมุดภาพ", "sharp", null);
    expect(onPieceWhenRead).toMatchObject({ background: "p1/new.png", aiText: { issues: [READ_FAILED], checked: false } });
    // then the reading is written over the "not read" record, and handed back
    expect(r).toMatchObject({ ok: true, item: { output: { poster: { aiText: { read: "หัวเรื่อง", issues: [], checked: false } } } } });
  });

  it("skips reading the words back when the drawing used the time, and keeps the picture", async () => {
    ai.chat.mockResolvedValueOnce({ text: "a scrapbook collage", model: "m", costThb: 0.01, outputTokens: 10 });
    ai.drawImage.mockImplementation(async () => { later(268_000); return drawn; });
    const r = await drawBackground("p1", "ภาพแปะหลายรูปแบบสมุดภาพ", "sharp", null);
    expect(r.ok).toBe(true);
    // the translation only: no reader was asked with no time to answer
    expect(ai.chat).toHaveBeenCalledTimes(1);
    expect(row.output.poster).toMatchObject({ background: "p1/new.png", aiText: { issues: [READ_FAILED], checked: false } });
  });

  it("does not order a picture it would have no time to keep", async () => {
    ai.chat.mockImplementationOnce(async () => {
      later(100_000);
      return { text: "a scrapbook collage", model: "m", costThb: 0.01, outputTokens: 10 };
    });
    const r = await drawBackground("p1", "ภาพแปะหลายรูปแบบสมุดภาพ", "sharp", null);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("ไม่ทันเวลา") });
    expect(ai.drawImage).not.toHaveBeenCalled();
    expect(row.output.poster?.background).toBe("p1/old.png");
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("gives the translation only the time the picture can spare", async () => {
    ai.chat
      .mockResolvedValueOnce({ text: "a scrapbook collage", model: "m", costThb: 0.01, outputTokens: 10 })
      .mockResolvedValueOnce({ text: JSON.stringify({ text: "หัวเรื่อง" }), model: "reader", costThb: 0.02, outputTokens: 10 });
    ai.drawImage.mockResolvedValue(drawn);
    await drawBackground("p1", "ภาพแปะหลายรูปแบบสมุดภาพ", "sharp", null);
    expect(ai.chat.mock.calls[0][0].timeoutMs).toBeGreaterThan(0);
    expect(ai.chat.mock.calls[0][0].timeoutMs).toBeLessThanOrEqual(25_000);
  });
});


describe("a round ticked for expats (spec 2026-10-02)", () => {
  const EN_ROW = (): ContentItem => make(null, { ...output, lang: "en", disclaimer: DISCLAIMER_EN, poster: { ...output.poster!, lang: "en" } });

  beforeEach(() => {
    let n = 0;
    store.saveContent.mockImplementation(async (r: Omit<ContentItem, "id" | "createdAt" | "status" | "publish" | "agentId" | "plan">) =>
      ({ ...make(null, r.output), ...r, id: `new-${++n}`, status: "draft" }) as ContentItem);
  });

  it("writes an expat numbers round on iHealthy Ultra in English", async () => {
    // a lapsed rate table fails here, loudly, rather than passing the round by on another path
    expect(numberSheets("/ihealthy-ultra", 1, new Date()).length).toBeGreaterThan(0);
    expect(numberSheets("/ihealthy-ultra", 1, new Date(), "en").length).toBeGreaterThan(0);
    ai.chat.mockResolvedValue({ text: "{}", model: "m", costThb: 0 }); // headlines fall back
    const r = await generateContent({ href: "/ihealthy-ultra", format: "post", angle: "numbers", custom: "", length: null, count: 1, hookTemplateId: null, expat: true });
    expect(r.ok).toBe(true);
    expect(store.saveContent).toHaveBeenCalledOnce();
    const o = (r as { items: ContentItem[] }).items[0].output;
    expect(o).toMatchObject({ lang: "en", disclaimer: DISCLAIMER_EN, closing: NUMBERS_CLOSING_EN, poster: { lang: "en" } });
    expect(fullText(o)).not.toMatch(/[\u0E00-\u0E7F]/);
    expect(posterText(o.poster)).not.toMatch(/[\u0E00-\u0E7F]/);
    // the headline was asked for in English
    expect(JSON.stringify(ai.chat.mock.calls[0][0].messages)).toMatch(/English/);
  });

  it("tells the planner the Page's past openings, and none when กันซ้ำ is switched off (owner, 2026-10-09)", async () => {
    store.recentHooks.mockResolvedValue(["ประโยคเปิดเดิมของเพจ"]);
    const planned = () => JSON.stringify(ai.chat.mock.calls[0][0].messages);
    const reply = () => ai.chat
      .mockResolvedValueOnce({ text: JSON.stringify({ plans: [{ hook: "Hospital bills add up", angle: "a" }] }), model: "m", costThb: 0, outputTokens: 10 })
      .mockResolvedValueOnce({ text: JSON.stringify({ body: "Private hospitals charge in full.", closing: "Message us.", hashtags: [], imagePrompt: "a ward" }), model: "m", costThb: 0, outputTokens: 10 });
    const ask = { href: "/ihealthy-ultra", format: "post" as const, angle: "expat_hospital" as const, custom: "", length: null, count: 1, hookTemplateId: null, expat: true };
    reply();
    await generateContent(ask);
    expect(planned()).toContain("ประโยคเปิดเดิมของเพจ");
    ai.chat.mockReset();
    store.recentHooks.mockClear();
    reply();
    await generateContent({ ...ask, avoid: false });
    expect(store.recentHooks).not.toHaveBeenCalled();
    expect(planned()).not.toContain("ประโยคเปิดเดิมของเพจ");
    store.recentHooks.mockResolvedValue([]);
  });

  it("gives an English post with no poster of its own, in the round's colour, an English one", async () => {
    ai.chat
      .mockResolvedValueOnce({ text: JSON.stringify({ plans: [{ hook: "Hospital bills in Bangkok add up fast", angle: "a" }] }), model: "m", costThb: 0, outputTokens: 10 })
      .mockResolvedValueOnce({ text: JSON.stringify({ body: "Private hospitals charge you in full.", closing: "Message us to check.", hashtags: [], imagePrompt: "a ward" }), model: "m", costThb: 0, outputTokens: 10 });
    const r = await generateContent({ href: "/ihealthy-ultra", format: "post", angle: "expat_hospital", custom: "", length: null, count: 1, hookTemplateId: null, expat: true, theme: "navy" });
    expect(r.ok).toBe(true);
    const o = (r as { items: ContentItem[] }).items[0].output;
    expect(o).toMatchObject({ lang: "en", disclaimer: DISCLAIMER_EN, poster: { lang: "en", theme: "navy" } });
    expect(posterText(o.poster)).not.toMatch(/[\u0E00-\u0E7F]/);
    // the planner and the writer were both told to write English, to the expat reader
    for (const call of ai.chat.mock.calls) expect(call[0].messages[0].content).toMatch(/English/);
    expect(JSON.stringify(ai.chat.mock.calls[0][0].messages)).toContain("ชาวต่างชาติที่อาศัยอยู่ในไทย (expat)");
  });

  it("writes the same request for another plan in Thai", async () => {
    const href = Object.keys(NUMBERS_PLANS).find((h) => h !== "/ihealthy-ultra" && numberSheets(h, 1).length > 0)!;
    expect(href).toBeTruthy();
    ai.chat.mockResolvedValue({ text: "{}", model: "m", costThb: 0 });
    const r = await generateContent({ href, format: "post", angle: "numbers", custom: "", length: null, count: 1, hookTemplateId: null, expat: true });
    expect(r.ok).toBe(true);
    const o = (r as { items: ContentItem[] }).items[0].output;
    expect(o.lang).toBeUndefined();
    expect(o.closing).toBe(NUMBERS_CLOSING);
    expect(o.poster).not.toHaveProperty("lang");
  });

  it("keeps an English poster English through an edit from the browser", async () => {
    row = EN_ROW();
    const { lang: _, ...sent } = row.output.poster!;
    void _;
    const r = await saveContentEdits("p1", edits({ poster: sent }));
    expect(r.ok && r.item.output.poster?.lang).toBe("en");
  });

  it("does not take a browser's word that a Thai poster is English", async () => {
    const r = await saveContentEdits("p1", edits({ poster: { ...output.poster!, lang: "en" } }));
    expect(r.ok).toBe(true);
    expect(r.ok && r.item.output.poster).not.toHaveProperty("lang");
  });

  it("proofreads an English piece with the English editor", async () => {
    row = EN_ROW();
    ai.chat.mockResolvedValue({ text: JSON.stringify({ fixes: [] }), model: "m", costThb: 0 });
    expect(await proofreadPiece("p1")).toEqual({ fixes: [] });
    const sys = ai.chat.mock.calls[0][0].messages[0].content as string;
    expect(sys).toMatch(/English/);
  });

  it("stops an English round whose writer put Thai in it, from the round's language", async () => {
    ai.chat
      .mockResolvedValueOnce({ text: JSON.stringify({ plans: [{ hook: "Hospital bills in Bangkok add up fast", angle: "a" }] }), model: "m", costThb: 0, outputTokens: 10 })
      .mockResolvedValueOnce({ text: JSON.stringify({ body: "Private hospitals bill in full.", closing: "Message us to check.", hashtags: ["#ประกันสุขภาพ"], imagePrompt: "a ward" }), model: "m", costThb: 0, outputTokens: 10 });
    const r = await generateContent({ href: "/ihealthy-ultra", format: "post", angle: "expat_hospital", custom: "", length: null, count: 1, hookTemplateId: null, expat: true });
    expect(r.ok).toBe(true);
    const f = (r as { items: ContentItem[] }).items[0].flags.policy?.find((x) => x.code === "thai_in_english");
    expect(f).toMatchObject({ severity: "block", match: "ประกันสุขภาพ" });
  });

  it("stops an English piece saved with Thai in it, and only an English one", async () => {
    const english = {
      hooks: ["Cover that stays"], body: "Cover that stays with you.", closing: "Message us.",
      poster: { layout: "bottom" as const, theme: "navy" as const, blocks: [{ kind: "headline" as const, text: "Cover that stays" }] },
    };
    row = EN_ROW();
    await saveContentEdits("p1", edits({ ...english, hashtags: ["#ประกันสุขภาพ"] }));
    expect(row.flags.policy?.find((f) => f.code === "thai_in_english")).toMatchObject({ severity: "block", match: "ประกันสุขภาพ" });
    row = make(null);
    await saveContentEdits("p1", edits({ hashtags: ["#ประกันสุขภาพ"] }));
    expect(row.flags.policy?.map((f) => f.code)).not.toContain("thai_in_english");
    // the system's own footer is never read: an English piece in English is clean
    row = EN_ROW();
    await saveContentEdits("p1", edits({ ...english, hashtags: ["#expat"] }));
    expect(row.flags.policy).toEqual([]);
  });

  it("checks an edited English piece against the expat brief, and a Thai one against the plain brief", async () => {
    row = { ...EN_ROW(), planHref: "/ihealthy-ultra" };
    await saveContentEdits("p1", edits({ body: "Cover that stays with you." }));
    expect(briefFor).toHaveBeenLastCalledWith("/ihealthy-ultra", undefined, { expat: true });
    row = { ...make(null), planHref: "/ihealthy-ultra" };
    await saveContentEdits("p1", edits());
    expect(briefFor).toHaveBeenLastCalledWith("/ihealthy-ultra", undefined, { expat: false });
  });

  it("still refuses ตัวเลขชัดๆ asked for a script, rather than writing it with the AI's angle", async () => {
    const r = await generateContent({ href: "/ihealthy-ultra", format: "script", angle: "numbers", custom: "", length: "60", count: 1, hookTemplateId: null });
    expect(r).toEqual({ ok: false, error: "มุมตัวเลขชัดๆ ใช้ได้กับโพสต์เฟซบุ๊กเท่านั้น" });
    expect(store.saveContent).not.toHaveBeenCalled();
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("learns no hook formula from an English piece", async () => {
    later.length = 0;
    row = { ...EN_ROW(), status: "draft" };
    ai.chat.mockResolvedValue({ text: "{}" });
    expect(await setContentStatus("p1", "used")).toEqual({ ok: true });
    for (const task of later) await task();
    expect(ai.chat.mock.calls.some(([a]) => a.task === "content-hook-template")).toBe(false);
  });
});
