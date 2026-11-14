import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { STYLE_PREFIX, drawScenePicture, picturePrompt } from "@/lib/prompt-story/pictures";
import type { PromptScene, PromptStoryInput } from "@/lib/prompt-story/types";
import { promptStartFrom } from "@/lib/scene-library/links";

/**
 * ภาพสไตล์ in คลิปตามโจทย์ (spec 2026-11-14-library-uploads, "Use in คลิปตามโจทย์"): one of the library's
 * approved style pictures sent to the painter as a reference, followed for its palette and line, never
 * for its subject. A style no longer approved refuses the clip before anything is held.
 */

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const SUFFIX = "no text, no numbers, no logos, no real person's likeness";
const WITH_REF = "Paint it in the colour palette, texture and line style of the reference image. Do not copy the reference image's subject, people, objects or any text in it.";
const pic = (over: Partial<PromptScene> = {}): PromptScene => ({ voice: "ฉากนี้ค่ะ", screen: "บ้านอุ่นใจ", picture: "a family at the table", ...over });
const ref = { bytes: Buffer.from("style-bytes"), mimeType: "image/png" };

const uploads = vi.hoisted(() => ({ okUploads: vi.fn(), uploadFile: vi.fn(), sharedUploads: vi.fn() }));
vi.mock("@/lib/scene-library/uploads", () => uploads);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("picturePrompt and a style reference", () => {
  it("without one: the style's words, the scene's, then the suffix", () => {
    expect(picturePrompt(pic(), "line")).toBe(`${STYLE_PREFIX.line} a family at the table. ${SUFFIX}`);
    expect(picturePrompt(pic(), "line", false)).toBe(picturePrompt(pic(), "line"));
  });

  it("with one: the scene's words, both instructions and the suffix, and none of the style's words", () => {
    // สไตล์ภาพ AI too (spec 2026-11-14-ai-picture-styles-design): a library style still overrides the prefix
    for (const s of ["paper", "warm", "plot", "line", "cartoon3d", "clay", "anime", "watercolor", "isometric", "collage", "pixel"] as const) {
      const p = picturePrompt(pic(), s, true);
      expect(p).toBe(`a family at the table. ${WITH_REF} ${SUFFIX}`);
      expect(p).not.toContain(STYLE_PREFIX[s]);
    }
  });
});

describe("drawScenePicture and a style reference", () => {
  const ok = () => vi.fn().mockResolvedValue({ bytes: Buffer.from("png") });

  it("hands the reference to the draw, with the reference's prompt", async () => {
    const draw = ok();
    expect((await drawScenePicture(pic(), "paper", "standard", "portrait", draw, ref))?.toString()).toBe("png");
    const arg = draw.mock.calls[0][0];
    expect(arg.references).toEqual([ref]);
    expect(arg.prompt).toBe(picturePrompt(pic(), "paper", true));
  });

  it("sends no references at all without one", async () => {
    const draw = ok();
    await drawScenePicture(pic(), "paper", "standard", "portrait", draw);
    const arg = draw.mock.calls[0][0];
    expect("references" in arg).toBe(false);
    expect(arg.prompt).toBe(picturePrompt(pic(), "paper"));
  });

  it("keeps the reference on the retry", async () => {
    const draw = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ bytes: Buffer.from("b") });
    await drawScenePicture(pic(), "plot", "standard", "square", draw, ref);
    expect(draw.mock.calls.map((c) => c[0].references)).toEqual([[ref], [ref]]);
  });
});

describe("checkedPromptStory and styleRef", () => {
  const form = (over: Record<string, unknown> = {}) => ({
    draftId: DRAFT, brief: "ทุน 1 ล้าน", title: "ดูแลครอบครัว", caption: "", scenes: [pic(), pic(), pic()], style: "paper", painter: "standard", ...over,
  });

  it("keeps an upload id", () => {
    expect((checkedPromptStory(form({ styleRef: U1 }), "F") as PromptStoryInput).styleRef).toBe(U1);
  });

  it("drops anything that is not an upload id, and leaves no key", () => {
    for (const styleRef of ["library/x.png", "", 42, null, undefined]) {
      const v = checkedPromptStory(form({ styleRef }), "F") as PromptStoryInput;
      expect(typeof v).toBe("object");
      expect("styleRef" in v).toBe(false);
    }
  });
});

describe("promptStartFrom and ?ref=", () => {
  it("keeps a uuid and ignores anything else", () => {
    expect(promptStartFrom({ ref: U1 })).toEqual({ ref: U1 });
    expect(promptStartFrom({ ref: [U2, U1], style: "plot", asset: U1 })).toEqual({ ref: U2, style: "plot", asset: U1 });
    expect(promptStartFrom({ ref: "library/x.png" })).toEqual({});
    expect(promptStartFrom({ ref: "" })).toEqual({});
  });
});

// สร้างคลิป as the page calls it; the clip pipeline itself is make.test.ts's
const made = vi.hoisted(() => ({ create: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => made.after(f) }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => ({ kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: { owner: true, publish: true, connect: true, admin: true } }) }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }) }));
vi.mock("@/lib/quote-video/voice-check", () => ({ voiceAsked: () => undefined, voiceRefusal: async () => null }));
vi.mock("@/lib/quote-video/make", () => ({
  createPromptStory: (...a: unknown[]) => made.create(...a), produce: vi.fn(), redrawPicture: vi.fn(), redrawScene: async () => undefined,
}));
vi.mock("@/lib/prompt-story/drafts", () => ({ draftsUpTo: async () => 1, saveDraft: async () => "d", writeDraft: async () => undefined, dropDraft: async () => undefined }));
vi.mock("@/lib/prompt-story/writer", () => ({ writeStory: vi.fn(), SCREEN_MAX: 40, TITLE_MAX: 28 }));
// ตั้งค่าส่วนตัว (main, 20261212): nothing hidden, without reading a store
vi.mock("@/lib/pay-prefs-store", async (orig) => ({ ...(await orig<typeof import("@/lib/pay-prefs-store")>()), hiddenFor: async () => [] }));
const wallet = vi.hoisted(() => ({ holdWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/store")>()), holdWallet: wallet.holdWallet }));

const { makePromptStory } = await import("@/app/studio/prompt-story/actions");

describe("makePromptStory with a style reference", () => {
  const row = (id: string, kind: "part" | "style") => ({ id, agentId: "a2", kind, name: "สีพาสเทล", note: "", paths: [`library/${id}.png`], state: "ok", reason: null, createdAt: "" });
  const form = (over: Record<string, unknown> = {}) => ({
    draftId: DRAFT, brief: "ทุน 1 ล้าน", title: "ดูแลครอบครัว", caption: "", scenes: [pic(), pic(), pic()], style: "paper", painter: "standard", styleRef: U1, ...over,
  });
  const REFUSED = { ok: false, error: "ภาพสไตล์ที่เลือกใช้ไม่ได้แล้ว เลือกใหม่หรือเอาออก" };

  beforeEach(() => {
    for (const f of [made.create, made.after, uploads.okUploads, wallet.holdWallet]) f.mockReset();
    made.create.mockResolvedValue({ id: "v1" });
  });

  it("starts the clip with the reference when the style is still approved", async () => {
    uploads.okUploads.mockResolvedValue([row(U1, "style")]);
    expect(await makePromptStory(form(), "")).toEqual({ ok: true, id: "v1" });
    expect(uploads.okUploads).toHaveBeenCalledWith([U1], "style");
    expect((made.create.mock.calls[0][1] as PromptStoryInput).styleRef).toBe(U1);
  });

  it("refuses a style no longer approved, and holds nothing", async () => {
    uploads.okUploads.mockResolvedValue([]);
    expect(await makePromptStory(form(), "")).toEqual(REFUSED);
    expect(made.create).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
    expect(made.after).not.toHaveBeenCalled();
  });

  it("treats a store that cannot be read as the style not usable", async () => {
    uploads.okUploads.mockRejectedValue(new Error("relation does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await makePromptStory(form(), "")).toEqual(REFUSED);
    expect(made.create).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("asks about the scenes' parts first, then the style", async () => {
    uploads.okUploads.mockResolvedValue([]);
    const scenes = [{ ...pic({ picture: "" }), asset: U2 }, pic(), pic()];
    expect(await makePromptStory(form({ scenes }), "")).toEqual({ ok: false, error: "ภาพจากคลังของฉากที่ 1 ใช้ไม่ได้แล้ว เลือกภาพใหม่" });
    expect(uploads.okUploads.mock.calls.map((c) => c[1])).toEqual(["part"]);
    uploads.okUploads.mockImplementation(async (_ids: string[], kind: string) => (kind === "part" ? [row(U2, "part")] : []));
    expect(await makePromptStory(form({ scenes }), "")).toEqual(REFUSED);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("asks the store nothing without a style reference", async () => {
    expect(await makePromptStory(form({ styleRef: undefined }), "")).toEqual({ ok: true, id: "v1" });
    expect(uploads.okUploads).not.toHaveBeenCalled();
    expect("styleRef" in (made.create.mock.calls[0][1] as PromptStoryInput)).toBe(false);
  });
});

// the form's group under the four picture styles
vi.mock("@/app/studio/quote-video/actions", () => ({
  makeStoryVideo: vi.fn(), myCost: vi.fn(), myVideos: vi.fn(), previewStoryFigure: vi.fn(), previewStoryHealth: vi.fn(),
  previewStoryPension: vi.fn(), voiceQuota: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));
const { PromptStoryBoard } = await import("@/app/studio/prompt-story/PromptStoryBoard");

describe("the form's ภาพอ้างอิงสไตล์จากคลัง", () => {
  const styles = [{ id: U1, name: "สีพาสเทล" }, { id: U2, name: "ลายเส้นดินสอ" }];
  const html = (over: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PromptStoryBoard, {
    initial: [], cost: null, prices: {} as never, quota: null, pages: [], eleven: [], styles, ...over,
  }));

  it("draws the group under the four picture styles, ไม่ใช้ first and chosen", () => {
    const out = html();
    expect(out).toContain("ภาพอ้างอิงสไตล์จากคลัง (ไม่บังคับ)");
    expect(out).toContain("AI เลียนโทนสีและลายเส้นได้คร่าวๆ ไม่ตรงทุกเส้น");
    expect(out.indexOf('aria-label="สไตล์รูป"')).toBeLessThan(out.indexOf("ภาพอ้างอิงสไตล์จากคลัง"));
    expect(out.indexOf("ภาพอ้างอิงสไตล์จากคลัง")).toBeLessThan(out.indexOf('aria-label="คุณภาพรูป"'));
    expect(out).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>ไม่ใช้</);
    expect(out.indexOf(">ไม่ใช้<")).toBeLessThan(out.indexOf(`id=${U1}&amp;n=0`));
  });

  it("shows each style as a thumbnail, its name as label and caption", () => {
    const out = html();
    for (const s of styles) {
      expect(out).toContain(`src="/api/library-upload?id=${s.id}&amp;n=0"`);
      expect(out).toMatch(new RegExp(`aria-label="${s.name}"[^>]*aria-checked="false"|aria-checked="false"[^>]*aria-label="${s.name}"`));
      expect(out).toContain(`>${s.name}</span>`);
    }
  });

  it("opens with the linked style chosen", () => {
    const out = html({ startRef: U2 });
    expect(out).toMatch(/aria-label="ลายเส้นดินสอ"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="ลายเส้นดินสอ"/);
    expect(out).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>ไม่ใช้</);
  });

  it("is not drawn when the library has no styles", () => {
    expect(html({ styles: [] })).not.toContain("ภาพอ้างอิงสไตล์จากคลัง");
    expect(html({ styles: undefined })).not.toContain("ไม่ใช้<");
  });
});
