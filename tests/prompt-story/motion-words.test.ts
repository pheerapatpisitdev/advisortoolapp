import { describe, expect, it } from "vitest";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { motionFieldLabel, motionReason, motionReasons } from "@/lib/prompt-story/motion-words";
import type { MotionLayout, PromptStoryInput } from "@/lib/prompt-story/types";

/**
 * A โมชันกราฟิก layout's fault in the agent's words (final review, Important 2): the box named as the editor labels it,
 * never checkMotion's English path; and the premium card scene's hidden layout never blocks the clip (Important 3).
 */

const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const hook: MotionLayout = { kind: "hook", lines: ["ดูแลครอบครัว"], key: 0, icon: "heart" };
const emptyCompare: MotionLayout = { kind: "compare", title: "เทียบกัน", bad: { head: "", lines: ["จ่ายเอง", "เงินหมด"] }, good: { head: "มีแผน", lines: ["แผนช่วย", "เงินอยู่"] } };
const scene = (over: Record<string, unknown> = {}) => ({ voice: "วันนี้มาคุยเรื่องครอบครัวค่ะ", screen: "ดูแลครอบครัว", picture: "", motion: hook, ...over });
const form = (scenes: unknown[], over: Record<string, unknown> = {}) => ({
  draftId: DRAFT, brief: "ครอบครัวอายุ 40 ค่าห้อง 5000", title: "ดูแลครอบครัว", caption: "", scenes, style: "paper", painter: "standard", design: "motion", ...over,
});
const figure = { plan: "LIFEPROTECT", variant: "WLF19H", sex: "M", age: 35, sumAssured: 1_000_000 };

describe("motionFieldLabel: the boxes as MotionFields names them", () => {
  it("names every slot a reason can point at", () => {
    const cases: [string, MotionLayout["kind"] | undefined, string][] = [
      ["tag", "card", "ป้ายบน"], ["chips[0]", "card", "ป้ายที่ 1"], ["chips[1]", "card", "ป้ายที่ 2"], ["chips", "card", "ป้าย"],
      ["unit", "number", "หน่วย"], ["tag", "number", "ป้ายบน"], ["bill", "number", "หัวใบเสร็จ"], ["value", "number", "ตัวเลข"],
      ["title", "compare", "หัวข้อ"], ["bad.head", "compare", "ฝั่งแรก (✕)"], ["bad.lines[1]", "compare", "ฝั่งแรก (✕) บรรทัด 2"],
      ["good.head", "compare", "ฝั่งสอง (✓)"], ["good.lines[0]", "compare", "ฝั่งสอง (✓) บรรทัด 1"], ["good", "compare", "ฝั่งสอง (✓)"],
      ["lines[0]", "check", "หัวข้อบรรทัด 1"], ["lines[1]", "check", "หัวข้อบรรทัด 2"], ["ticks[2]", "check", "ข้อ 3"], ["photo", "check", "ภาพวงกลม"],
      ["lines[1]", "hook", "บรรทัดที่ 2"], ["lines[0]", "full", "บรรทัดที่ 1"], ["lines[0]", undefined, "บรรทัดที่ 1"], ["key", "hook", "คำเน้น"], ["icon", "hook", "ไอคอน"],
      ["kind", undefined, ""],
    ];
    for (const [path, kind, want] of cases) expect(motionFieldLabel(path, kind), `${kind} ${path}`).toBe(want);
  });

  it("turns checkMotion's reason into แบบฉาก and the box; other reasons pass as they are", () => {
    expect(motionReason("motion.bad.head: ว่างอยู่", "compare")).toBe("แบบฉาก ฝั่งแรก (✕): ว่างอยู่");
    expect(motionReason("motion.lines[0]: ตัวเลข 99999 ไม่อยู่ในโจทย์หรือแผน", "hook")).toBe("แบบฉาก บรรทัดที่ 1: ตัวเลข 99999 ไม่อยู่ในโจทย์หรือแผน");
    expect(motionReason("motion: ไม่มีรูปแบบภาพ")).toBe("แบบฉาก: ไม่มีรูปแบบภาพ");
    expect(motionReason("motion.kind: ไม่รู้จักรูปแบบภาพนี้")).toBe("แบบฉาก: ไม่รู้จักรูปแบบภาพนี้");
    expect(motionReason("voice: มีคำต้องห้าม")).toBe("voice: มีคำต้องห้าม");
    expect(motionReasons(["motion.bad.head: ว่างอยู่", "motion.good.lines[1]: ว่างอยู่", "motion.bad.head: ว่างอยู่"], "compare"))
      .toBe("แบบฉาก ฝั่งแรก (✕): ว่างอยู่ · แบบฉาก ฝั่งสอง (✓) บรรทัด 2: ว่างอยู่");
  });
});

describe("checkedPromptStory's refusal of a layout", () => {
  it("names the empty box in Thai, never the field's path", () => {
    const r = checkedPromptStory(form([scene(), scene({ motion: emptyCompare }), scene()]), "F");
    expect(r).toBe("ฉากที่ 2: แบบฉาก ฝั่งแรก (✕): ว่างอยู่");
    expect(r).not.toContain("motion");
  });

  it("names every failing box of the scene, not only the first", () => {
    const two: MotionLayout = { ...emptyCompare, good: { head: "มีแผน", lines: ["แผนช่วย", ""] } };
    const r = checkedPromptStory(form([scene(), scene({ motion: two }), scene()]), "F");
    expect(r).toBe("ฉากที่ 2: แบบฉาก ฝั่งแรก (✕): ว่างอยู่ · แบบฉาก ฝั่งสอง (✓) บรรทัด 2: ว่างอยู่");
    const figures = checkedPromptStory(form([scene({ motion: { kind: "hook", lines: ["ค่าห้อง 99999", "ก".repeat(23)], key: 0, icon: "heart" } }), scene(), scene()]), "F");
    expect(figures).toBe("ฉากที่ 1: แบบฉาก บรรทัดที่ 1: ตัวเลข 99999 ไม่อยู่ในโจทย์หรือแผน · แบบฉาก บรรทัดที่ 2: ยาวเกิน 22 ตัวอักษร");
  });
});

describe("the premium card scene in โมชันกราฟิก", () => {
  it("is accepted with a layout left empty under it, and kept without the layout", () => {
    const v = checkedPromptStory(form([scene(), scene({ showFigure: true, motion: emptyCompare }), scene()], { figure }), "F");
    if (typeof v === "string") throw new Error(v);
    expect(v.scenes[1].showFigure).toBe(true);
    expect(v.scenes[1]).not.toHaveProperty("motion");
    expect(v.scenes[0].motion).toEqual(hook);
  });

  it("a layout on a scene asking for the card with no plan priced is still checked", () => {
    expect(checkedPromptStory(form([scene(), scene({ showFigure: true, motion: emptyCompare }), scene()]), "F")).toBe("ฉากที่ 2: แบบฉาก ฝั่งแรก (✕): ว่างอยู่");
  });
});

describe("picture words on a scene that paints nothing", () => {
  it("are dropped in โมชันกราฟิก (the editor shows no box for them), never a refusal", () => {
    const v = checkedPromptStory(form([scene({ picture: "ห้องพัก 3 ห้อง" }), scene(), scene()]), "F") as PromptStoryInput;
    expect(typeof v).toBe("object");
    expect(v.scenes[0].picture).toBe("");
  });

  it("are kept as they are in หน้าตาเดิม", () => {
    const v = checkedPromptStory(form([scene({ picture: "ห้องพัก" }), scene({ picture: "บ้าน" }), scene({ picture: "ครอบครัว" })], { design: undefined }), "F") as PromptStoryInput;
    expect(v.scenes.map((s) => s.picture)).toEqual(["ห้องพัก", "บ้าน", "ครอบครัว"]);
    expect(v.scenes[0]).not.toHaveProperty("motion");
  });
});
