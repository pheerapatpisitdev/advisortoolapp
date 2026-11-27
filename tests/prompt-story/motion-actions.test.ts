import { beforeEach, describe, expect, it, vi } from "vitest";

/** writePromptStory and rewritePromptScene carry the page's `design` to the draft and the writer (โมชันกราฟิก) */

const m = vi.hoisted(() => ({
  save: vi.fn(), write: vi.fn(), writeStory: vi.fn(), rewriteScene: vi.fn(), take: vi.fn(),
}));
const OWNER = { owner: true, publish: true, connect: true, admin: true };
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => ({ kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: OWNER }) }));
vi.mock("@/lib/quote-video/make", () => ({ createPromptStory: vi.fn(), produce: vi.fn(), redrawPicture: vi.fn(), redrawScene: vi.fn() }));
vi.mock("@/lib/prompt-story/drafts", () => ({
  draftsUpTo: async () => 1, saveDraft: (...a: unknown[]) => m.save(...a), writeDraft: (...a: unknown[]) => m.write(...a), dropDraft: async () => undefined,
  takeRewrite: (...a: unknown[]) => m.take(...a), keepRewrite: async () => undefined,
}));
vi.mock("@/lib/prompt-story/writer", async (orig) => ({
  ...(await orig<typeof import("@/lib/prompt-story/writer")>()),
  writeStory: (...a: unknown[]) => m.writeStory(...a),
  rewriteScene: (...a: unknown[]) => m.rewriteScene(...a),
}));

const { writePromptStory, rewritePromptScene } = await import("@/app/studio/prompt-story/actions");
const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const scenes = [1, 2, 3].map((n) => ({ voice: `ประโยค ${n}`, screen: "คำบนจอ", picture: "a family" }));

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.save.mockResolvedValue("d1");
  m.writeStory.mockResolvedValue({ ok: true, title: "t", caption: "c", scenes, notes: [] });
});

describe("writePromptStory design", () => {
  it("stores design 'motion' in the draft and gives it to the writer", async () => {
    const r = await writePromptStory({ brief: "ทุน 1 ล้าน", scenes: 3, design: "motion" });
    expect(r.ok).toBe(true);
    expect(m.save.mock.calls[0][1]).toMatchObject({ design: "motion" });
    expect(m.writeStory.mock.calls[0][0]).toMatchObject({ design: "motion" });
  });
  it("anything but the exact word is หน้าตาเดิม: nothing stored, none passed", async () => {
    for (const design of ["x", "Motion", 1, null, {}]) {
      m.save.mockClear(); m.writeStory.mockClear();
      await writePromptStory({ brief: "ทุน 1 ล้าน", scenes: 3, design });
      expect(m.save.mock.calls[0][1]).not.toHaveProperty("design");
      expect(m.writeStory.mock.calls[0][0]).not.toHaveProperty("design");
    }
  });
});

describe("rewritePromptScene design", () => {
  it("reads asked.design and passes it to the rewriter", async () => {
    m.take.mockResolvedValue({ ok: true, n: 1, scenes, asked: { brief: "ทุน 1 ล้าน", design: "motion" } });
    m.rewriteScene.mockResolvedValue({ ok: true, scene: scenes[0] });
    await rewritePromptScene(DRAFT, 0);
    expect(m.rewriteScene.mock.calls[0][0]).toMatchObject({ design: "motion" });
  });
  it("a draft without design is rewritten as before", async () => {
    m.take.mockResolvedValue({ ok: true, n: 1, scenes, asked: { brief: "ทุน 1 ล้าน" } });
    m.rewriteScene.mockResolvedValue({ ok: true, scene: scenes[0] });
    await rewritePromptScene(DRAFT, 0);
    expect(m.rewriteScene.mock.calls[0][0]).not.toHaveProperty("design");
  });
});
