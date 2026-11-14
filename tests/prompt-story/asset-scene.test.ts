import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import { GROUNDS } from "@/lib/story/figure";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { keptRewrite, missingPicture, pictureCount, sceneKind, scenePart, toAsset, toPicture } from "@/lib/prompt-story/editor-state";
import { pictureScenes, promptStoryPrice, type DeviceScene, type PromptScene, type PromptStoryInput } from "@/lib/prompt-story/types";
import { promptStartFrom } from "@/lib/scene-library/links";

/**
 * ภาพจากคลัง in คลิปตามโจทย์ (spec 2026-11-14-library-uploads, "Use in คลิปตามโจทย์"): a scene's picture may be
 * one of the library's approved parts — never painted, never charged, no picture words needed, and a part
 * no longer approved refuses the clip before anything is held.
 */

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const cashless: DeviceScene = { layout: "cashless", title: ["เคลม", "ง่าย"], note: "ไม่ต้องสำรองจ่าย" };
const room: DeviceScene = { layout: "room", title: ["ค่าห้อง", "ต่อคืน"], plan: 5500, real: 6000, planName: "Silver" };
const pic = (over: Partial<PromptScene> = {}): PromptScene => ({ voice: "ฉากนี้ค่ะ", screen: "บ้านอุ่นใจ", picture: "a family", ...over });

const uploads = vi.hoisted(() => ({ okUploads: vi.fn(), uploadFile: vi.fn() }));
vi.mock("@/lib/scene-library/uploads", () => uploads);

describe("the price counts an asset scene out, as a device", () => {
  it("one asset and one device among five scenes charge three pictures", () => {
    const v = {
      product: "FREESTORY", brief: "x", title: "t", caption: "", style: "paper", painter: "standard", faces: { narrator: "w26" },
      scenes: [pic(), pic({ asset: U1, picture: "" }), pic(), pic({ device: cashless, picture: "" }), pic()],
    } as PromptStoryInput;
    expect(pictureScenes(v)).toBe(3);
    expect(promptStoryPrice(v, DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoPrompt + 3 * DEFAULT_PRICES.drawStandard);
  });
});

describe("checkedPromptStory and an asset", () => {
  const form = (scenes: unknown[], over: Record<string, unknown> = {}) => ({
    draftId: DRAFT, brief: "ค่าห้องจริงคืนละ 6,000 แผนจ่ายคืนละ 5,500", title: "ดูแลครอบครัว", caption: "", scenes, style: "paper", painter: "standard", ...over,
  });
  const three = (first: Record<string, unknown>) => [first, pic(), pic()];

  it("keeps a uuid asset on a scene with empty picture words", () => {
    const v = checkedPromptStory(form(three({ ...pic({ picture: "" }), asset: U1 })), "F");
    expect(typeof v).toBe("object");
    expect((v as PromptStoryInput).scenes[0]).toEqual({ voice: "ฉากนี้ค่ะ", screen: "บ้านอุ่นใจ", picture: "", asset: U1 });
    expect(pictureScenes(v as PromptStoryInput)).toBe(2);
  });

  it("drops an asset that is not an upload id, and then the scene needs its picture words", () => {
    expect(checkedPromptStory(form(three({ ...pic({ picture: "" }), asset: "../library/x.png" })), "F")).toBe("ใส่คำบรรยายภาพของฉากที่ 1");
    const v = checkedPromptStory(form(three({ ...pic(), asset: 42 })), "F") as PromptStoryInput;
    expect(v.scenes[0].asset).toBeUndefined();
    expect(pictureScenes(v)).toBe(3);
  });

  it("drops the asset when a valid device is on the scene (the device wins)", () => {
    const v = checkedPromptStory(form(three({ ...pic({ picture: "" }), device: cashless, asset: U1 })), "F") as PromptStoryInput;
    expect(v.scenes[0].device).toEqual(cashless);
    expect(v.scenes[0].asset).toBeUndefined();
  });

  it("keeps the asset when the scene's device fails its check and is dropped", () => {
    const v = checkedPromptStory(form(three({ ...pic({ picture: "" }), device: { ...room, real: 7000 }, asset: U1 })), "F") as PromptStoryInput;
    expect(v.scenes[0].device).toBeUndefined();
    expect(v.scenes[0].asset).toBe(U1);
  });
});

describe("the editor's sums and moves with an asset", () => {
  const allowed = new Set([5500, 6000]);

  it("an upload id is an asset scene; anything else is a picture; a valid device still wins", () => {
    expect(sceneKind(pic({ asset: U1 }), allowed)).toEqual({ kind: "asset", id: U1 });
    expect(sceneKind(pic({ asset: "nope" }), allowed)).toEqual({ kind: "picture" });
    expect(sceneKind(pic({ asset: U1, device: room }), allowed)).toMatchObject({ kind: "device" });
    // a device the server will drop leaves the asset, as checkedPromptStory does
    expect(sceneKind(pic({ asset: U1, device: { ...room, real: 7000 } }), allowed)).toEqual({ kind: "asset", id: U1 });
  });

  it("pictureCount and missingPicture skip an asset scene, as the server charges and checks", () => {
    const scenes = [pic({ asset: U1, picture: "" }), pic(), pic({ device: room, picture: "" }), pic({ picture: "" }), pic()];
    expect(pictureCount(scenes, allowed)).toBe(3);
    expect(missingPicture(scenes, allowed)).toBe(3);
    expect(missingPicture([pic({ asset: U1, picture: " " }), pic()], allowed)).toBeNull();
  });

  it("toPicture drops the asset and begins the picture words from the screen", () => {
    expect(toPicture(pic({ asset: U1, picture: "", screen: "ทุน 1 ล้าน" }))).toEqual({ voice: "ฉากนี้ค่ะ", screen: "ทุน 1 ล้าน", picture: "ทุน ล้าน" });
    expect(toPicture(pic({ asset: U1 }))).toEqual(pic());
  });

  it("toAsset drops the device and sets the asset, the words kept", () => {
    expect(toAsset(pic({ device: room, showFigure: true }), U2)).toEqual({ ...pic(), showFigure: true, asset: U2 });
    expect(toAsset(pic({ asset: U1 }), U2)).toEqual({ ...pic(), asset: U2 });
  });
});

describe("keptRewrite: เขียนฉากนี้ใหม่ on a ภาพจากคลัง scene", () => {
  const written = pic({ voice: "เขียนใหม่", screen: "ใหม่", picture: "a new picture" });
  it("keeps the part when the rewrite brings no device", () => {
    expect(keptRewrite(pic({ asset: U1, picture: "" }), written)).toEqual({ ...written, asset: U1 });
  });
  it("drops the part when the rewrite brings a device (the device wins)", () => {
    expect(keptRewrite(pic({ asset: U1 }), { ...written, device: cashless })).toEqual({ ...written, device: cashless });
  });
  it("leaves a scene without a part as the writer wrote it", () => {
    expect(keptRewrite(pic(), written)).toEqual(written);
    expect(keptRewrite(pic({ device: cashless }), written)).toEqual(written);
  });
});

describe("promptStartFrom and ?asset=", () => {
  it("keeps a uuid and ignores anything else", () => {
    expect(promptStartFrom({ asset: U1 })).toEqual({ asset: U1 });
    expect(promptStartFrom({ asset: [U2, U1], style: "line" })).toEqual({ asset: U2, style: "line" });
    expect(promptStartFrom({ asset: "library/x.png" })).toEqual({});
    expect(promptStartFrom({ asset: "" })).toEqual({});
  });
});

// สร้างคลิป and วาดใหม่ as the page calls them; the clip pipeline itself is make.test.ts's
const made = vi.hoisted(() => ({ create: vi.fn(), redraw: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => made.after(f) }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => ({ kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: { owner: true, publish: true, connect: true, admin: true } }) }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => ({ phone: "0812345678" }) }));
vi.mock("@/lib/quote-video/voice-check", () => ({ voiceAsked: () => undefined, voiceRefusal: async () => null }));
vi.mock("@/lib/quote-video/make", () => ({
  createPromptStory: (...a: unknown[]) => made.create(...a),
  produce: vi.fn(), redrawPicture: (...a: unknown[]) => made.redraw(...a), redrawScene: async () => undefined,
}));
vi.mock("@/lib/prompt-story/drafts", () => ({ draftsUpTo: async () => 1, saveDraft: async () => "d", writeDraft: async () => undefined, dropDraft: async () => undefined }));
vi.mock("@/lib/prompt-story/writer", () => ({ writeStory: vi.fn(), SCREEN_MAX: 40, TITLE_MAX: 28 }));
// ตั้งค่าส่วนตัว (main, 20261212): nothing hidden, without reading a store
vi.mock("@/lib/pay-prefs-store", async (orig) => ({ ...(await orig<typeof import("@/lib/pay-prefs-store")>()), hiddenFor: async () => [] }));
const wallet = vi.hoisted(() => ({ holdWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/store")>()), holdWallet: wallet.holdWallet }));

const { makePromptStory } = await import("@/app/studio/prompt-story/actions");

describe("makePromptStory with library pictures", () => {
  const row = (id: string) => ({ id, agentId: "a2", kind: "part", name: "บ้าน", note: "", paths: [`library/${id}.png`], state: "ok", reason: null, createdAt: "" });
  const form = (scenes: unknown[]) => ({ draftId: DRAFT, brief: "ทุน 1 ล้าน", title: "ดูแลครอบครัว", caption: "", scenes, style: "paper", painter: "standard" });
  const asked = [{ ...pic({ picture: "" }), asset: U1 }, pic(), pic(), pic(), { ...pic({ picture: "" }), asset: U2 }];

  beforeEach(() => {
    for (const f of [made.create, made.redraw, made.after, uploads.okUploads, wallet.holdWallet]) f.mockReset();
    made.create.mockResolvedValue({ id: "v1" });
  });

  it("starts the clip when every asset is still an approved part", async () => {
    uploads.okUploads.mockResolvedValue([row(U1), row(U2)]);
    expect(await makePromptStory(form(asked), "")).toEqual({ ok: true, id: "v1" });
    expect(uploads.okUploads).toHaveBeenCalledWith([U1, U2], "part");
    expect((made.create.mock.calls[0][1] as PromptStoryInput).scenes.map((s) => s.asset)).toEqual([U1, undefined, undefined, undefined, U2]);
  });

  it("names the first scene whose part is no longer approved, and holds nothing", async () => {
    uploads.okUploads.mockResolvedValue([row(U1)]);
    expect(await makePromptStory(form(asked), "")).toEqual({ ok: false, error: "ภาพจากคลังของฉากที่ 5 ใช้ไม่ได้แล้ว เลือกภาพใหม่" });
    expect(made.create).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
    expect(made.after).not.toHaveBeenCalled();
  });

  it("treats a store that cannot be read as no part usable", async () => {
    uploads.okUploads.mockRejectedValue(new Error("relation does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await makePromptStory(form(asked), "")).toEqual({ ok: false, error: "ภาพจากคลังของฉากที่ 1 ใช้ไม่ได้แล้ว เลือกภาพใหม่" });
    expect(made.create).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("asks the store nothing when no scene has an asset", async () => {
    expect(await makePromptStory(form([pic(), pic(), pic()]), "")).toEqual({ ok: true, id: "v1" });
    expect(uploads.okUploads).not.toHaveBeenCalled();
  });
});

// the part laid on the look's ground: drawn here, not by the draw service
const drawn = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("@/lib/draw-png", async () => {
  const { drawPngHere } = await import("@/lib/draw/core");
  return { drawPng: async (...a: unknown[]) => { drawn.calls.push(a); return drawPngHere(a[0] as never, a[1] as never, a[2] as never); } };
});
const { assetPicture } = await import("@/lib/prompt-story/asset-picture");
const { freeLook } = await import("@/lib/prompt-story/frames");

describe("assetPicture", () => {
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  async function at(png: Buffer, x: number, y: number): Promise<string> {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return hex(data[i], data[i + 1], data[i + 2]);
  }
  /** a wide red part, 400 × 100 */
  const part = async () => ({ bytes: await sharp({ create: { width: 400, height: 100, channels: 4, background: "#ff0000" } }).png().toBuffer(), type: "image/png" });

  it("is the frame's size, the part contained in the middle 80% × 55% on the look's ground", async () => {
    const png = await assetPicture(await part(), freeLook({ style: "line" }), "portrait");
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1920]);
    expect(await at(png, 5, 5)).toBe(STORY_CLIP_COLORS.lineGround);
    expect(await at(png, 540, 960)).toBe("#ff0000");
    // 80% of 1080 is 864 wide, so the part is 216 tall about the middle: 852 to 1068
    expect(await at(png, 540, 860)).toBe("#ff0000");
    expect(await at(png, 540, 840)).toBe(STORY_CLIP_COLORS.lineGround);
    expect(await at(png, 100, 960)).toBe(STORY_CLIP_COLORS.lineGround);
    expect(await at(png, 120, 960)).toBe("#ff0000");
  });

  it("paints each look's ground as StoryClip does, plain paper when the style has none", async () => {
    const p = await part();
    const ground = async (style: PromptStoryInput["style"]) => at(await assetPicture(p, freeLook({ style }), "square"), 3, 3);
    expect(await ground("paper")).toBe(STORY_CLIP_COLORS.kraft);
    expect(await ground("warm")).toBe(GROUNDS.warm.bg);
    expect(await ground("plot")).toBe(STORY_CLIP_COLORS.plotPaper);
    expect(await ground("line")).toBe(STORY_CLIP_COLORS.lineGround);
    expect(await ground("real")).toBe(STORY_CLIP_COLORS.paper);
    // ไวต์บอร์ด นีออน บลูพริ้นท์: the board's white, the neon's violet at its centre, the blueprint blue
    expect(await ground("board")).toBe(STORY_CLIP_COLORS.boardBoard);
    expect(await ground("neon")).toBe(STORY_CLIP_COLORS.neonCentre);
    expect(await ground("blueprint")).toBe(STORY_CLIP_COLORS.bpGround);
  });

  it("draws nothing else: no words, and only IBM Plex handed to the drawing", async () => {
    drawn.calls.length = 0;
    await assetPicture(await part(), freeLook({ style: "plot" }), "landscape");
    const [element, size, fonts] = drawn.calls[0] as [Parameters<typeof renderToStaticMarkup>[0], { width: number; height: number }, { name: string }[]];
    expect(size).toEqual({ width: 1920, height: 1080 });
    expect(fonts.every((f) => f.name === "Plex")).toBe(true);
    const html = renderToStaticMarkup(element);
    expect(html.replace(/<[^>]*>/g, "")).toBe("");
    expect(html.match(/<img/g)).toHaveLength(1);
  });
});

// the script editor's third chip
vi.mock("@/app/studio/quote-video/actions", () => ({ previewStoryFigure: vi.fn() }));
const { ScriptEditor } = await import("@/app/studio/prompt-story/ScriptEditor");

describe("ScriptEditor's ภาพจากคลัง", () => {
  const assets = [{ id: U1, name: "บ้านหลังเล็ก" }, { id: U2, name: "ร่มกันฝน" }];
  const draft = { id: "d", title: "บ้าน", caption: "", scenes: [pic(), pic({ asset: U1, picture: "" }), pic({ device: room, picture: "" })] };
  const html = (over: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(ScriptEditor, { draft, notes: [], onChange: () => {}, forDevice: new Set([5500, 6000]), assets, ...over }));

  it("offers a third chip on every scene, chosen on the asset scene", () => {
    const out = html();
    expect(out.match(/>ภาพจากคลัง</g)).toHaveLength(3);
    expect(out).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>ภาพจากคลัง</);
  });

  it("shows the parts as thumbnails, the one in use checked, with no picture box and the line under it", () => {
    const out = html();
    expect(out).toContain(`src="/api/library-upload?id=${U1}&amp;n=0"`);
    expect(out).toContain(`src="/api/library-upload?id=${U2}&amp;n=0"`);
    expect(out).toMatch(/aria-label="บ้านหลังเล็ก"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="บ้านหลังเล็ก"/);
    expect(out).toMatch(/aria-label="ร่มกันฝน"[^>]*aria-checked="false"|aria-checked="false"[^>]*aria-label="ร่มกันฝน"/);
    expect(out).not.toContain('aria-label="ภาพฉาก 2"');
    expect(out).toContain('aria-label="ภาพฉาก 1"');
    expect(out).toContain("ภาพวางกลางฉากบนพื้นของหน้าตาคลิป ฉากนี้ไม่คิดค่ารูป");
  });

  it("counts the asset scenes beside the devices", () => {
    expect(html()).toContain("ภาพ AI 1 ฉาก · อุปกรณ์ 1 ฉาก (ระบบวาด ไม่คิดค่ารูป) · ภาพจากคลัง 1 ฉาก");
  });

  it("puts the linked part first", () => {
    const out = html({ startAsset: U2 });
    expect(out.indexOf(`id=${U2}&amp;n=0`)).toBeLessThan(out.indexOf(`id=${U1}&amp;n=0`));
  });

  it("names each scene's own part, not the linked one, and only when it is in the list", () => {
    // scene 2 shows U1 while the link named U2: the line names U1
    const out = html({ startAsset: U2 });
    expect(out).toContain("ภาพที่เลือกจากคลัง: บ้านหลังเล็ก");
    expect(out).not.toContain("ภาพที่เลือกจากคลัง: ร่มกันฝน");
    // two library scenes, two parts: each line names its own
    const two = { ...draft, scenes: [pic({ asset: U2, picture: "" }), pic({ asset: U1, picture: "" })] };
    const both = html({ draft: two });
    expect(both.indexOf("ภาพที่เลือกจากคลัง: ร่มกันฝน")).toBeGreaterThanOrEqual(0);
    expect(both.indexOf("ภาพที่เลือกจากคลัง: ร่มกันฝน")).toBeLessThan(both.indexOf("ภาพที่เลือกจากคลัง: บ้านหลังเล็ก"));
    // a part no longer in the list: no line
    const gone = { ...draft, scenes: [pic({ asset: "33333333-3333-4333-8333-333333333333", picture: "" })] };
    expect(html({ draft: gone, startAsset: U2 })).not.toContain("ภาพที่เลือกจากคลัง");
  });

  it("scenePart finds the scene's own part by its asset id", () => {
    const list = [{ id: U1, name: "บ้านหลังเล็ก" }, { id: U2, name: "ร่มกันฝน" }];
    expect(scenePart(pic({ asset: U2 }), list)?.name).toBe("ร่มกันฝน");
    expect(scenePart(pic(), list)).toBeUndefined();
    expect(scenePart(pic({ asset: "33333333-3333-4333-8333-333333333333" }), list)).toBeUndefined();
  });

  it("says where to upload when the library has no parts", () => {
    expect(html({ assets: [] })).toContain("ยังไม่มีภาพในคลัง อัปโหลดได้ที่เมนูคลังแอนิเมชัน");
    expect(html()).not.toContain("ยังไม่มีภาพในคลัง");
  });
});

/**
 * Review Focus 3 (spec 2026-11-14-story-looks-board-neon-blueprint): a คลิปตามโจทย์ in each new look with a picture
 * scene, a health device scene and a library part scene draws every frame as StoryClip lays them — the look's
 * background, the scene's picture over it (a painted one, or the part on the look's ground), the frame on top — and
 * the screen words can be read off the sign they stand on.
 */
describe("a คลิปตามโจทย์ in ไวต์บอร์ด นีออน บลูพริ้นท์", async () => {
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { drawPngHere } = await import("@/lib/draw/core");
  const { freeFrame } = await import("@/lib/prompt-story/frames");
  const { storyBackground } = await import("@/lib/quote-video/story-motion");
  const { SIZES } = await import("@/lib/quote-video/timeline");
  const face = (f: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", f));
  const FONTS = [
    ["Plex", "IBMPlexSansThai-Regular.ttf", 400], ["Plex", "IBMPlexSansThai-SemiBold.ttf", 600], ["Mali", "Mali-400.ttf", 400],
    ["Mali", "Mali-600.ttf", 600], ["Sriracha", "Sriracha-400.ttf", 400], ["Symbols", "NotoSansSymbols2-400.ttf", 400],
  ].map(([name, file, weight]) => ({ name: name as string, data: face(file as string), weight: weight as 400 | 600, style: "normal" as const }));
  const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (p: number[]) => {
    const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
  };
  const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /** a painted picture stand-in: busy, mid-grey and white stripes, so a sign that does not mask it is caught */
  const painted = async (w: number, h: number) => `data:image/png;base64,${(await sharp({ create: { width: w, height: h, channels: 3, background: "#8a8f99" } })
    .composite(Array.from({ length: 12 }, (_, i) => ({ input: { create: { width: w, height: Math.round(h / 48), channels: 3 as const, background: "#ffffff" } }, left: 0, top: Math.round((i * h) / 12) })))
    .png().toBuffer()).toString("base64")}`;
  const SIGN: Record<string, string> = { board: STORY_CLIP_COLORS.boardBoard, neon: STORY_CLIP_COLORS.neonSub, blueprint: STORY_CLIP_COLORS.bpGround };

  for (const style of ["board", "neon", "blueprint"] as const) {
    it(`${style}: the picture, device and part scenes all draw, the words readable on their sign`, async () => {
      const clip: PromptStoryInput = {
        product: "FREESTORY", brief: "b", title: "ค่าห้องเกินใครจ่าย", caption: "c", style, painter: "standard", faces: { narrator: "w26" },
        scenes: [pic({ screen: "ห้องเดี่ยวคืนละหกพัน" }), { voice: "อุปกรณ์ค่ะ", screen: "", picture: "", device: room }, pic({ screen: "บ้านอุ่นใจ", picture: "", asset: U1 })],
      };
      for (const size of ["portrait", "square", "landscape"] as const) {
        const { w, h } = SIZES[size];
        const c = { input: clip, size, customer: "", narrator: "F" as const, contact: { name: "เอก", phone: "081" }, crowd: [], faces: {}, words: ["ห้อง", "เดี่ยว"], voiceSec: 3 };
        const lookIn = { ...clip, ...freeLook(clip) } as never;
        const red = { bytes: await sharp({ create: { width: 400, height: 100, channels: 4, background: "#ff0000" } }).png().toBuffer(), type: "image/png" };
        const part = `data:image/png;base64,${(await assetPicture(red, freeLook(clip), size)).toString("base64")}`;
        const pictures = [await painted(w, h), undefined, part];
        for (const [i, scene] of clip.scenes.entries()) {
          const picture = pictures[i];
          const el = createElement("div", { style: { display: "flex", position: "relative", width: w, height: h } },
            createElement("div", { style: { position: "absolute", left: 0, top: 0, display: "flex" } }, storyBackground(size, lookIn)),
            picture ? createElement("img", { src: picture, width: w, height: h, style: { position: "absolute", left: 0, top: 0 } }) : null,
            createElement("div", { style: { position: "absolute", left: 0, top: 0, display: "flex" } }, freeFrame(scene, Boolean(picture), c, 3)));
          const png = await drawPngHere(el, { width: w, height: h }, FONTS);
          expect(png.length, `${style} ${size} scene ${i}`).toBeGreaterThan(1000);
          if (i === 0 && size === "portrait") {
            // the words' sign masks the picture under it, and the words stand 3:1 off it
            const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
            const at = (x: number, y: number) => { const j = (y * info.width + x) * info.channels; return [data[j], data[j + 1], data[j + 2]]; };
            let sign = 0, words = 0;
            for (let y = 150; y < 320; y += 2) for (let x = 80; x < w - 80; x += 2) {
              const p = at(x, y);
              if (contrast(p, rgbOf(SIGN[style])) < 1.1) sign++;
              else if (contrast(p, rgbOf(SIGN[style])) >= 3) words++;
            }
            expect(sign, `${style} sign`).toBeGreaterThan(3000);
            expect(words, `${style} words`).toBeGreaterThan(300);
          }
        }
      }
    }, 120_000);
  }
});
