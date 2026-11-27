import { describe, expect, it } from "vitest";
import { allowedFor, checkMotion, checkScene, deviceAllowed } from "@/lib/prompt-story/check";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import type { MotionLayout } from "@/lib/prompt-story/types";

const brief = "ค่ารักษา 68,000 บาท";
const ok = (m: unknown, b = brief) => checkMotion(m, allowedFor(b), deviceAllowed(b));

const layouts: MotionLayout[] = [
  { kind: "hook", lines: ["ลูกป่วยบ่อย", "ค่ารักษาพุ่ง"], key: 1, icon: "fever" },
  { kind: "hook", lines: ["เปิดเรื่อง"], key: -1, icon: "shield" },
  { kind: "card", tag: "ค่ารักษา", chips: ["โรงพยาบาล", "ยา"] },
  { kind: "number", value: 68000, unit: "บาท", tag: "ค่ารักษา", bill: "ใบเสร็จ" },
  { kind: "compare", title: "เทียบกัน", bad: { head: "ไม่มี", lines: ["จ่ายเอง", "เงินหาย"] }, good: { head: "มี", lines: ["มีคนช่วย", "สบายใจ"] } },
  { kind: "check", lines: ["เช็กก่อน", "สบายใจ"], ticks: ["ดูสิทธิ์", "ดูวงเงิน", "ดูเงื่อนไข"], photo: true },
  { kind: "full", lines: ["ภาพเต็ม"], key: -1 },
];

describe("checkMotion", () => {
  it.each(layouts)("passes a $kind layout and returns it equal", (m) => {
    expect(ok(m)).toEqual(m);
  });
  it("trims and single-spaces, and drops unknown keys", () => {
    const r = ok({ kind: "card", tag: "  ค่า   รักษา ", chips: [" ก ", "ข"], extra: 1 });
    expect(r).toEqual({ kind: "card", tag: "ค่า รักษา", chips: ["ก", "ข"] });
  });
  it("fails a number whose value the brief does not give, naming motion.value", () => {
    const m = layouts[3];
    expect(Array.isArray(ok(m, "ลูกป่วยบ่อย"))).toBe(true);
    expect((ok(m, "ลูกป่วยบ่อย") as string[]).join(" ")).toContain("motion.value");
  });
  it("fails a hook of 4 lines, a chip of 17 letters, an empty string, a bad icon, a bad key", () => {
    expect(ok({ ...layouts[0], lines: ["ก", "ข", "ค", "ง"] })).toBeInstanceOf(Array);
    expect(ok({ kind: "card", tag: "ก", chips: ["ก".repeat(17), "ข"] })).toBeInstanceOf(Array);
    expect(ok({ kind: "card", tag: "ก", chips: ["ก".repeat(16), "ข"] })).not.toBeInstanceOf(Array);
    expect(ok({ kind: "card", tag: "  ", chips: ["ก", "ข"] })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[0], icon: "star" })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[0], key: 2 })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[0], key: -2 })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[6], lines: [] })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[6], lines: ["ก", "ข", "ค"] })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[5], photo: "yes" })).toBeInstanceOf(Array);
    expect(ok({ ...layouts[5], ticks: ["ก", "ข"] })).toBeInstanceOf(Array);
    expect(ok({ kind: "nope" })).toBeInstanceOf(Array);
    expect(ok(null)).toBeInstanceOf(Array);
  });
  it("fails a forbidden word in a tick", () => {
    const r = ok({ ...layouts[5], ticks: ["ดูสิทธิ์", "เบี้ย", "ดูเงื่อนไข"] });
    expect(Array.isArray(r) && r.join(" ")).toContain("motion.");
  });
  it("fails a stray number in a compare line", () => {
    const m = { ...layouts[4], bad: { head: "ไม่มี", lines: ["จ่าย 99,999", "เงินหาย"] } };
    const r = ok(m);
    expect(Array.isArray(r) && r.join(" ")).toContain("99999");
  });
});

describe("checkScene with a motion layout", () => {
  it("passes a hook scene with no picture words", () => {
    const a = allowedFor(brief);
    expect(checkScene({ voice: "วันนี้มาคุยกัน", screen: "เริ่ม", picture: "", motion: layouts[0] }, a, deviceAllowed(brief))).toEqual([]);
  });
  it("reports a failing layout", () => {
    const a = allowedFor(brief);
    const r = checkScene({ voice: "ก", screen: "ข", picture: "", motion: { kind: "hook", lines: [], key: -1, icon: "fever" } }, a);
    expect(r.join(" ")).toContain("motion.");
  });
});

const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const form = (scenes: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
  draftId: DRAFT, brief, title: "ดูแลครอบครัว", caption: "ทักมาคุยกัน", scenes,
  style: "cartoon", painter: "standard", ...over,
});
const base = (o: Record<string, unknown> = {}) => ({ voice: "ประโยค", screen: "คำบนจอ", picture: "a family", ...o });

describe("checkedPromptStory with motion", () => {
  const scenes = (second: Record<string, unknown>) => [base(), base(second), base()];
  it("drops design classic and keeps motion", () => {
    expect((checkedPromptStory(form(scenes({}), { design: "classic" }), "F") as { design?: string }).design).toBeUndefined();
    expect((checkedPromptStory(form(scenes({}), { design: "motion" }), "F") as { design?: string }).design).toBe("motion");
  });
  it("accepts a motion hook scene with empty picture words and keeps its layout", () => {
    const v = checkedPromptStory(form(scenes({ picture: "", motion: layouts[0] }), { design: "motion" }), "F");
    expect(typeof v).toBe("object");
    expect((v as { scenes: { motion?: unknown }[] }).scenes[1].motion).toEqual(layouts[0]);
  });
  it("refuses a card scene with empty picture words", () => {
    expect(typeof checkedPromptStory(form(scenes({ picture: "", motion: layouts[2] }), { design: "motion" }), "F")).toBe("string");
  });
  it("refuses a scene whose layout fails, naming the scene", () => {
    const r = checkedPromptStory(form(scenes({ motion: { ...layouts[3], value: 12345 } }), { design: "motion" }), "F");
    expect(typeof r).toBe("string");
    expect(r as string).toContain("ฉากที่ 2");
  });
  it("drops a motion field when design is not motion, and still needs picture words", () => {
    const v = checkedPromptStory(form(scenes({ motion: layouts[0] })), "F") as { scenes: { motion?: unknown }[] };
    expect(v.scenes[1].motion).toBeUndefined();
    expect(typeof checkedPromptStory(form(scenes({ picture: "", motion: layouts[0] })), "F")).toBe("string");
  });
});
