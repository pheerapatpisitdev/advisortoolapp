import { beforeEach, describe, expect, it, vi } from "vitest";

/** A round is written into the project of a Page the caller looks after, or not at all (owner, 2026-09-30). */

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })), allowanceOf: vi.fn() }));
const project = vi.hoisted(() => ({ projectPage: vi.fn() }));
const done = { ok: true, items: [], costThb: 0, missing: 0 };
const runs = vi.hoisted(() => ({ writeRecruit: vi.fn(), writeKnowledge: vi.fn(), writeDraft: vi.fn(), writeThanks: vi.fn() }));
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.4"]]) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), projectPage: project.projectPage }));
vi.mock("@/lib/content/recruit-run", () => ({ writeRecruit: runs.writeRecruit }));
vi.mock("@/lib/content/knowledge-run", () => ({ writeKnowledge: runs.writeKnowledge }));
vi.mock("@/lib/content/draft-run", () => ({ writeDraft: runs.writeDraft }));
vi.mock("@/lib/content/thanks-run", () => ({ writeThanks: runs.writeThanks }));
// the owner's ceiling, asked before the round (ceiling.ts): not reached
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
const store = vi.hoisted(() => ({ listContent: vi.fn(async () => []), countByStatus: vi.fn(async () => ({ draft: 0, used: 0, trashed: 0 })) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));

const { contentWorkbench, generateContent, generateDraft, generateKnowledge, generateRecruit, generateThanks } = await import("@/app/studio/actions");
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
      await generateThanks({ occasion: "trust", count: 1, page: "p9" } as never),
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
    await generateThanks({ occasion: "trust", count: 1 } as never);
    expect(runs.writeRecruit).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeKnowledge).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeDraft).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeThanks).toHaveBeenCalledWith(expect.anything(), "p1");
  });
});

describe("a round for an ad", () => {
  it("is refused by หาทีม and เขียนเอง before anything is written or counted — ads moved to Ads Studio", async () => {
    project.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
    const refused = { ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" };
    expect(await generateRecruit({ topic: "t", count: 1, format: "ad", page: "p1" } as never)).toEqual(refused);
    expect(await generateDraft({ draft: "ร่างของฉัน", count: 1, format: "ad", page: "p1" } as never)).toEqual(refused);
    expect(runs.writeRecruit).not.toHaveBeenCalled();
    expect(runs.writeDraft).not.toHaveBeenCalled();
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});

describe("the workbench's lists", () => {
  it("are the Page's the request resolved to", async () => {
    project.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
    await contentWorkbench({ status: "draft", page: "p1" });
    expect(store.listContent).toHaveBeenCalledWith({ status: "draft", planHref: undefined, pageId: "p1" }, 40, 0);
    expect(store.countByStatus).toHaveBeenCalledWith(undefined, "p1");
  });

  it("are empty for a Page taken from the caller while the page was open", async () => {
    project.projectPage.mockResolvedValue({ ok: false, error: NOT_YOUR_PAGE });
    expect(await contentWorkbench({ status: "draft", page: "p9" })).toMatchObject({ items: [], failed: true });
    expect(store.listContent).not.toHaveBeenCalled();
  });
});
