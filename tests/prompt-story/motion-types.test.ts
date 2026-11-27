import { describe, expect, it } from "vitest";
import { pictureCount, missingPicture } from "@/lib/prompt-story/editor-state";
import { MOTION_KINDS, paints, pictureScenes, type MotionLayout, type PromptScene } from "@/lib/prompt-story/types";

const sc = (motion?: MotionLayout, more: Partial<PromptScene> = {}): PromptScene => ({ voice: "v", screen: "s", picture: "p", ...(motion ? { motion } : {}), ...more });
const hook: MotionLayout = { kind: "hook", lines: ["a"], key: 0, icon: "fever" };
const card: MotionLayout = { kind: "card", tag: "t", chips: ["a", "b"] };
const number: MotionLayout = { kind: "number", value: 1, unit: "u", tag: "t", bill: "b" };
const compare: MotionLayout = { kind: "compare", title: "t", bad: { head: "h", lines: ["a", "b"] }, good: { head: "h", lines: ["a", "b"] } };
const check = (photo: boolean): MotionLayout => ({ kind: "check", lines: ["a", "b"], ticks: ["a", "b", "c"], photo });
const none = new Set<number>();

describe("paints", () => {
  it("never paints a device or a library part", () => {
    expect(paints(sc(card, { device: {} as never }), "motion")).toBe(false);
    expect(paints(sc(undefined, { device: {} as never }))).toBe(false);
    expect(paints(sc(card, { asset: "x" }), "motion")).toBe(false);
    expect(paints(sc(undefined, { asset: "x" }))).toBe(false);
  });
  it("paints every other scene in หน้าตาเดิม, a figure scene too", () => {
    expect(paints(sc())).toBe(true);
    expect(paints(sc(hook))).toBe(true);
    expect(paints(sc(undefined, { showFigure: true }))).toBe(true);
  });
  it("in motion paints only card, full, a check with a photo, or a scene with no layout", () => {
    expect(paints(sc(hook), "motion")).toBe(false);
    expect(paints(sc(card), "motion")).toBe(true);
    expect(paints(sc({ kind: "full", lines: ["a"], key: 0 }), "motion")).toBe(true);
    expect(paints(sc(number), "motion")).toBe(false);
    expect(paints(sc(compare), "motion")).toBe(false);
    expect(paints(sc(check(false)), "motion")).toBe(false);
    expect(paints(sc(check(true)), "motion")).toBe(true);
    expect(paints(sc(card, { showFigure: true }), "motion")).toBe(false);
    expect(paints(sc(), "motion")).toBe(true);
  });
});

describe("what a motion script is charged", () => {
  const scenes = [sc(hook), sc(card), sc(number), sc(compare), sc(check(true))];
  it("counts only the painted scenes", () => {
    expect(pictureScenes({ scenes, design: "motion" })).toBe(2);
    expect(pictureScenes({ scenes })).toBe(5);
    expect(pictureCount(scenes, none, undefined, "motion")).toBe(2);
    expect(pictureCount(scenes, none)).toBe(5);
  });
  it("asks for picture words only where a scene paints", () => {
    const blank = scenes.map((s) => ({ ...s, picture: "" }));
    expect(missingPicture(blank, none)).toBe(0);
    expect(missingPicture(blank, none, undefined, "motion")).toBe(1);
    expect(missingPicture([blank[0], blank[2]], none, undefined, "motion")).toBeNull();
  });
});

describe("MOTION_KINDS", () => {
  it("lists the layouts by their Thai names, in order", () => {
    expect(MOTION_KINDS.map((k) => k.name)).toEqual(["เปิดเรื่อง", "ภาพการ์ด", "ตัวเลขใหญ่", "เทียบสองฝั่ง", "เช็กลิสต์", "ภาพเต็มจอ"]);
    expect(MOTION_KINDS.map((k) => k.id)).toEqual(["hook", "card", "number", "compare", "check", "full"]);
  });
});
