import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkedPromptStory } from "@/lib/prompt-story/checked";

/** สร้างคลิป and วาดภาพฉากนี้ใหม่ as the page calls them (studio/prompt-story/actions.ts) */

const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const form = (over: Record<string, unknown> = {}) => ({
  draftId: DRAFT, brief: "ทุน 1 ล้าน", title: "ดูแลครอบครัว", caption: "ทักมาคุยกัน",
  scenes: [1, 2, 3].map((n) => ({ voice: `ประโยคที่ ${n}`, screen: "คำบนจอ", picture: "a family" })),
  style: "cartoon", painter: "standard", ...over,
});

describe("checkedPromptStory", () => {
  it("makes the clip's input from the form", () => {
    const v = checkedPromptStory(form({ size: "square" }), "M");
    expect(typeof v).toBe("object");
    expect(v).toMatchObject({ product: "FREESTORY", draftId: DRAFT, size: "square", narrator: "M", style: "cartoon", painter: "standard", faces: { narrator: "w26" } });
  });
  it("refuses a form without a written draft, a bad count, style or painter", () => {
    expect(typeof checkedPromptStory(form({ draftId: "x" }), "F")).toBe("string");
    expect(typeof checkedPromptStory(form({ scenes: form().scenes.slice(0, 2) }), "F")).toBe("string");
    expect(typeof checkedPromptStory(form({ style: "oil" }), "F")).toBe("string");
    expect(typeof checkedPromptStory(form({ painter: "none" }), "F")).toBe("string");
    expect(typeof checkedPromptStory(form({ brief: "ก".repeat(601) }), "F")).toBe("string");
  });
  it("names the scene with an empty line", () => {
    const scenes = form().scenes;
    scenes[2] = { ...scenes[2], voice: " " };
    expect(checkedPromptStory(form({ scenes }), "F")).toMatch(/ฉากที่ 3/);
  });
  it("keeps the figure card on one scene, and only when a plan was priced", () => {
    const scenes = form().scenes.map((s) => ({ ...s, showFigure: true }));
    const none = checkedPromptStory(form({ scenes }), "F");
    expect(typeof none !== "string" && none.scenes.some((s) => s.showFigure)).toBe(false);
  });
});

const made = vi.hoisted(() => ({ create: vi.fn(), produce: vi.fn(), redraw: vi.fn(), after: vi.fn(), contact: { phone: "0812345678" } }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => made.after(f) }));
// the owner makes these clips (alone since 2026-10-17); `viewer.as` turns the caller into someone else
const OWNER = { owner: true, publish: true, connect: true, admin: true };
const viewer = vi.hoisted(() => ({ as: null as Record<string, unknown> | null }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => viewer.as ?? { kind: "unitos", agentId: "a1", name: "ตัวแทน", staff: OWNER } }));
vi.mock("@/lib/quote-video/contact", () => ({ getContact: async () => made.contact }));
vi.mock("@/lib/quote-video/voice-check", () => ({ voiceAsked: () => undefined, voiceRefusal: async () => null }));
vi.mock("@/lib/quote-video/make", () => ({
  createPromptStory: (...a: unknown[]) => made.create(...a),
  produce: (...a: unknown[]) => made.produce(...a),
  redrawPicture: (...a: unknown[]) => made.redraw(...a),
}));
vi.mock("@/lib/prompt-story/drafts", () => ({ draftsLastHour: async () => 0, saveDraft: async () => "d" }));
vi.mock("@/lib/prompt-story/writer", () => ({ writeStory: vi.fn(), SCREEN_MAX: 40, TITLE_MAX: 28 }));

const { makePromptStory, redrawPromptPicture, writePromptStory } = await import("@/app/studio/prompt-story/actions");

beforeEach(() => {
  viewer.as = null;
  for (const f of [made.create, made.produce, made.redraw, made.after]) f.mockReset();
  made.contact = { phone: "0812345678" };
  made.create.mockResolvedValue({ id: "v1" });
  made.redraw.mockResolvedValue({ ok: true });
});

describe("makePromptStory", () => {
  it("starts the clip and makes it after answering", async () => {
    expect(await makePromptStory(form(), "")).toEqual({ ok: true, id: "v1" });
    expect(made.create).toHaveBeenCalledTimes(1);
    expect(made.after).toHaveBeenCalledTimes(1);
  });
  it("asks for the agent's name and phone first", async () => {
    made.contact = { phone: "" };
    expect(await makePromptStory(form(), "")).toMatchObject({ ok: false, needContact: true });
    expect(made.create).not.toHaveBeenCalled();
  });
  it("passes a refusal through and makes nothing", async () => {
    made.create.mockResolvedValue({ refusal: "ฉากที่ 2 ใช้ไม่ได้" });
    expect(await makePromptStory(form(), "")).toEqual({ ok: false, error: "ฉากที่ 2 ใช้ไม่ได้" });
    expect(made.after).not.toHaveBeenCalled();
  });
  it("refuses a bad form before anything is held", async () => {
    expect((await makePromptStory(form({ style: "oil" }), "")).ok).toBe(false);
    expect(made.create).not.toHaveBeenCalled();
  });
});

describe("redrawPromptPicture", () => {
  it("hands the drawing and the cut to after", async () => {
    expect(await redrawPromptPicture(DRAFT, 1)).toEqual({ ok: true });
    expect(made.redraw.mock.calls[0].slice(1, 3)).toEqual([DRAFT, 1]);
    expect(typeof made.redraw.mock.calls[0][3]).toBe("function");
  });
  it("turns away a bad id or scene", async () => {
    expect((await redrawPromptPicture("x", 1)).ok).toBe(false);
    expect((await redrawPromptPicture(DRAFT, "1" as unknown as number)).ok).toBe(false);
    expect(made.redraw).not.toHaveBeenCalled();
  });
});

describe("anyone but the owner (owner chose ก, 2026-10-17)", () => {
  const others = [
    { kind: "unitos", agentId: "a2", name: "ตัวแทน", staff: null },
    { kind: "unitos", agentId: "s1", name: "ผู้ช่วย", staff: { owner: false, publish: true, connect: true, admin: true } },
    { kind: "member", agentId: "m1", name: "สมาชิก", staff: null },
  ];
  it("is told the tool is closed at every step, and nothing is written, held or drawn", async () => {
    for (const v of others) {
      viewer.as = v;
      expect(await writePromptStory({ brief: "ทุน 1 ล้าน", scenes: 3 })).toEqual({ ok: false, error: "ฟังก์ชันนี้ปิดใช้งานอยู่" });
      expect(await makePromptStory(form(), "")).toEqual({ ok: false, error: "ฟังก์ชันนี้ปิดใช้งานอยู่" });
      expect(await redrawPromptPicture(DRAFT, 1)).toEqual({ ok: false, error: "ฟังก์ชันนี้ปิดใช้งานอยู่" });
    }
    expect(made.create).not.toHaveBeenCalled();
    expect(made.redraw).not.toHaveBeenCalled();
    expect(made.after).not.toHaveBeenCalled();
  });
});
