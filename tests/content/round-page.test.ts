import { beforeEach, describe, expect, it, vi } from "vitest";

/** A round is written into the project of a Page the caller looks after, or not at all (owner, 2026-09-30). */

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => null), allowanceOf: vi.fn() }));
const project = vi.hoisted(() => ({ projectPage: vi.fn() }));
const done = { ok: true, items: [], costThb: 0, missing: 0 };
const runs = vi.hoisted(() => ({ writeRecruit: vi.fn(), writeKnowledge: vi.fn(), writeDraft: vi.fn() }));
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.4"]]) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), projectPage: project.projectPage }));
vi.mock("@/lib/content/recruit-run", () => ({ writeRecruit: runs.writeRecruit }));
vi.mock("@/lib/content/knowledge-run", () => ({ writeKnowledge: runs.writeKnowledge }));
vi.mock("@/lib/content/draft-run", () => ({ writeDraft: runs.writeDraft }));

const { generateContent, generateDraft, generateKnowledge, generateRecruit } = await import("@/app/studio/actions");
const { NOT_YOUR_PAGE } = await import("@/lib/auth/pages");
const { CONTENT_PRODUCTS } = await import("@/lib/content/products");

beforeEach(() => {
  vi.clearAllMocks();
  for (const run of Object.values(runs)) run.mockResolvedValue(done);
});

describe("a round and its Page", () => {
  it("is refused before a round is counted when the Page is not the caller's", async () => {
    project.projectPage.mockResolvedValue({ ok: false, error: NOT_YOUR_PAGE });
    const results = [
      await generateContent({ href: CONTENT_PRODUCTS[0].href, format: "post", angle: "", custom: "", length: null, count: 1, hookTemplateId: null, page: "p9" }),
      await generateRecruit({ topic: "t", count: 1, page: "p9" } as never),
      await generateKnowledge({ kind: "article", subject: "waiting", count: 1, page: "p9" } as never),
      await generateDraft({ draft: "ร่างของฉัน", count: 1, page: "p9" } as never),
    ];
    for (const r of results) expect(r).toEqual({ ok: false, error: NOT_YOUR_PAGE });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(project.projectPage).toHaveBeenCalledWith("p9");
  });

  it("hands the runner the Page it resolved, not the one the screen sent", async () => {
    project.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
    await generateRecruit({ topic: "t", count: 1, page: "" } as never);
    await generateKnowledge({ kind: "article", subject: "waiting", count: 1 } as never);
    await generateDraft({ draft: "ร่างของฉัน", count: 1 } as never);
    expect(runs.writeRecruit).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeKnowledge).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeDraft).toHaveBeenCalledWith(expect.anything(), "p1");
  });
});
