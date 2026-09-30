import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Flags, Publish, PublishState } from "@/lib/content/store";
import type { ContentOutput } from "@/lib/content/output";

/**
 * The workbench's edits and deletes against what Facebook holds, over a one-row store kept in
 * memory: a piece on the Page is not changed here, and a held one is changed on Facebook too.
 */

const PAGE = "105";
let row: ContentItem;
const order: string[] = [];

const store = vi.hoisted(() => ({
  getContent: vi.fn(), saveOutput: vi.fn(), saveOutputIf: vi.fn(), recordPublishIf: vi.fn(), claimPublish: vi.fn(), deleteContent: vi.fn(),
  removeBackground: vi.fn(), listWords: vi.fn(), holdContentBudget: vi.fn(), releaseContentBudget: vi.fn(),
  contentSpentThisMonth: vi.fn(), contentCap: vi.fn(), setFixes: vi.fn(), saveBackground: vi.fn(), setStatus: vi.fn(),
  listContent: vi.fn(), countByStatus: vi.fn(),
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
vi.mock("@/lib/content/people-store", () => ({
  personPhotos: vi.fn(async () => ({ person: { id: "person-1" }, photos: [{ bytes: Buffer.from("x"), mimeType: "image/png" }] })),
}));

const { contentWorkbench, drawBackground, generateContent, removeContent, saveContentEdits, setContentStatus } = await import("@/app/studio/actions");
const { NUMBERS_PLANS, numberSheets } = await import("@/lib/content/numbers-plans");
const { NUMBERS_CLOSING, numbersBody, numbersPoster, numbersYardstick } = await import("@/lib/content/numbers");
const { PAINTERS, OVERHEAD_THB } = await import("@/lib/content/models");
const { CONCURRENT } = await import("@/lib/content/publish-flow");
const { strayNumbers } = await import("@/lib/content/check");
const { briefFor } = await import("@/lib/content/brief");

const clean: Flags = { numbers: [], words: [], policy: [], fixes: null };
const output: ContentOutput = {
  hooks: ["หัวเรื่อง", "หัวที่สอง"], body: "เนื้อหาเดิม", closing: "ทักแชทได้เลย", hashtags: [], imagePrompt: "", disclaimer: "d",
  poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "หัวเรื่อง" }], background: "p1/old.png" },
};
const make = (publish: Publish | null, out: ContentOutput = output): ContentItem => ({
  id: "p1", createdAt: "2026-09-25T00:00:00Z", planHref: "/nowhere", format: "post", angle: "", length: null,
  output: out, flags: clean, model: null, costThb: 0, status: "used", hookTemplateId: null, publish, agentId: null, pageId: PAGE,
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
