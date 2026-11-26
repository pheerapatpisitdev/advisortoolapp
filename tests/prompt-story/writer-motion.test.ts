import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkMotion } from "@/lib/prompt-story/check";
import { pictureScenes, MOTION_KINDS, type PromptScene } from "@/lib/prompt-story/types";

const chat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/client", () => ({ chat: (...a: unknown[]) => chat(...a) }));
const { plainMotion, rewriteScene, writeStory } = await import("@/lib/prompt-story/writer");

const BRIEF = "ครอบครัวอายุ 40 ค่าห้อง 5000";
const sc = (motion: unknown, o: Record<string, unknown> = {}) => ({ voice: "วันนี้มาคุยเรื่องดูแลครอบครัว", screen: "ดูแลครอบครัว", picture: "", showFigure: false, device: null, motion, ...o });
const hook = { kind: "hook", lines: ["ดูแลครอบครัว"], key: 0, icon: "heart" };
const card = { kind: "card", tag: "ค่าห้อง", chips: ["วันละ", "ทุกปี"] };
const full = { kind: "full", lines: ["ห้องพักผู้ป่วย"], key: -1 };
const compare = { kind: "compare", title: "เทียบกัน", bad: { head: "ไม่มีประกัน", lines: ["จ่ายเอง", "เงินเก็บหมด"] }, good: { head: "มีประกัน", lines: ["ประกันช่วย", "เงินเก็บอยู่"] } };
const number = (value: number) => ({ kind: "number", value, unit: "บาท", tag: "ค่าห้องต่อวัน", bill: "ตามโจทย์" });
const reply = (scenes: unknown[]) => JSON.stringify({ onTopic: true, refusal: "", title: "ดูแลครอบครัว", caption: "คุยกันได้เลย", scenes });
const pic = { picture: "ห้องพักผู้ป่วยโรงพยาบาล" };

describe("writer: โมชันกราฟิก layouts", () => {
  it("the motion prompt names every kind, the icons and asks for motion", async () => {
    const ask = vi.fn().mockResolvedValue("x");
    await writeStory({ brief: BRIEF, scenes: 5, design: "motion", ask });
    const sys = ask.mock.calls[0][0] as string;
    expect(sys).toContain('"motion"');
    for (const k of MOTION_KINDS) expect(sys).toContain(`"kind":"${k.id}"`);
    for (const k of MOTION_KINDS) expect(sys).toContain(k.name);
    for (const i of ["fever", "hospital", "money", "heart", "shield", "home"]) expect(sys).toContain(i);
    expect(sys).toContain("ฉากแรกต้องเป็น hook");
    expect(sys).toContain("<<<BRIEF_DATA>>>");
    expect(sys).toContain("ห้ามมีคำเหล่านี้");
    expect(sys).toContain("ไม่เกิน 3 ฉาก");
  });

  it("without a design the prompt is today's, byte for byte", async () => {
    const out: string[] = [];
    const ask = async (s: string, u: string) => { out.push(s, u); return "x"; };
    await writeStory({ brief: BRIEF, scenes: 5, ask });
    await rewriteScene({ brief: BRIEF, scenes: [0, 1, 2].map(() => ({ voice: "ก", screen: "ข", picture: "ค" })), scene: 1, ask });
    const all = out.join("\n=====\n");
    expect(createHash("sha256").update(all).digest("hex")).toBe("fcc2a020b00651ee4fa5e4715bf0b3c6c8e601d0d20c7d75874ef4903a43baca");
    expect(all).not.toContain('"motion"');
  });

  it("valid layouts come back on the scenes", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(hook), sc(card, pic), sc(number(5000)), sc(compare), sc(full, pic)]));
    const r = await writeStory({ brief: BRIEF, scenes: 5, design: "motion", ask });
    if (!r.ok) throw new Error("not ok");
    expect(ask).toHaveBeenCalledTimes(1);
    expect(r.notes).toEqual([]);
    expect(r.scenes.map((s) => s.motion?.kind)).toEqual(["hook", "card", "number", "compare", "full"]);
  });

  it("a number the brief lacks is asked again with motion.value, then becomes plainMotion", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(hook), sc(number(12345), { screen: "ค่าห้องแพง" }), sc(compare)]));
    const r = await writeStory({ brief: BRIEF, scenes: 3, design: "motion", ask });
    if (!r.ok) throw new Error("not ok");
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1].join("\n")).toContain("motion.value");
    expect(r.notes).toEqual([1]);
    expect(r.scenes[1].motion).toEqual({ kind: "hook", lines: ["ช่วยให้ครอบครัว", "ไปต่อได้"], key: -1, icon: "heart" });
    expect(checkMotion(r.scenes[1].motion, new Set(), new Set())).toEqual(r.scenes[1].motion);
    expect(r.scenes[0].motion?.kind).toBe("hook");
  });

  it("a scene with no layout is asked again too, and a good retry is kept", async () => {
    const ask = vi.fn().mockResolvedValueOnce(reply([sc(hook), sc(undefined), sc(compare)])).mockResolvedValueOnce(reply([sc(hook), sc(number(5000)), sc(compare)]));
    const r = await writeStory({ brief: BRIEF, scenes: 3, design: "motion", ask });
    if (!r.ok) throw new Error("not ok");
    expect(r.notes).toEqual([]);
    expect(r.scenes[1].motion).toMatchObject({ kind: "number", value: 5000 });
  });

  it("four painted scenes in five leave at most three painted, the last turned free", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(hook), sc(card, pic), sc(full, pic), sc(card, pic), sc(full, pic)]));
    const r = await writeStory({ brief: BRIEF, scenes: 5, design: "motion", ask });
    if (!r.ok) throw new Error("not ok");
    expect(pictureScenes({ scenes: r.scenes, design: "motion" })).toBe(3);
    expect(r.scenes[4].motion).toEqual(plainMotion(r.scenes[4].screen));
    expect(r.scenes[4].picture).toBe("");
    expect(Array.isArray(checkMotion(r.scenes[4].motion, new Set(), new Set()))).toBe(false);
    expect(r.scenes[4].voice).toBe("วันนี้มาคุยเรื่องดูแลครอบครัว");
    expect(r.scenes[3].motion?.kind).toBe("card");
  });

  it("a painted layout needs picture words; a hook does not", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(hook), sc(card), sc(compare)]));
    await writeStory({ brief: BRIEF, scenes: 3, design: "motion", ask });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1].join("\n")).toContain("ฉากที่ 2");
    expect(ask.mock.calls[1].join("\n")).not.toContain("ฉากที่ 1:");
  });

  it("plainMotion always passes checkMotion: wrapped on spaces, cut clear of combining marks", () => {
    const spaced = "ช่วยให้ครอบครัว ไปต่อได้ อย่างมั่นคง";
    expect([...spaced].length).toBeLessThanOrEqual(40);
    const a = plainMotion(spaced);
    expect(Array.isArray(checkMotion(a, new Set(), new Set()))).toBe(false);
    if (a.kind !== "hook") throw new Error("kind");
    for (const l of a.lines) expect([...l].length).toBeLessThanOrEqual(22);
    const long = "ครอบครัวที่มั่นคงปลอดภัยทุกวันเวลานี้ดี".slice(0, 30);
    const b = plainMotion(long);
    expect(Array.isArray(checkMotion(b, new Set(), new Set()))).toBe(false);
    if (b.kind !== "hook") throw new Error("kind");
    for (const l of b.lines.slice(0, -1)) expect([...l].length).toBeLessThanOrEqual(22);
    b.lines.slice(1).forEach((l) => expect(l).not.toMatch(/^[ัิ-ฺ็-๎]/));
    // a cut that would land before a mark moves back
    const marked = "ก".repeat(21) + "ิ" + "ข".repeat(5);
    const c = plainMotion(marked);
    if (c.kind !== "hook") throw new Error("kind");
    expect(c.lines[1].startsWith("ิ")).toBe(false);
    expect(Array.isArray(checkMotion(c, new Set(), new Set()))).toBe(false);
  });

  it("the model: Sonnet 5 first for motion, the video-script lane for หน้าตาเดิม", async () => {
    chat.mockReset();
    chat.mockResolvedValue({ text: "x" });
    await writeStory({ brief: BRIEF, scenes: 5, design: "motion" });
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({
      tier: "small", task: "prompt-story-script", json: true, prefer: "claude-sonnet-5", within: ["gemini-3.7-flash", "gpt-5"], effort: "low",
      maxTokens: 3150, timeoutMs: 60_000,
    }));
    chat.mockClear();
    await writeStory({ brief: BRIEF, scenes: 12 });
    const old = chat.mock.calls[0][0] as Record<string, unknown>;
    expect(old.prefer).toBeUndefined();
    expect(old.within).toBeUndefined();
    expect(old.effort).toBeUndefined();
    chat.mockClear();
    await writeStory({ brief: BRIEF, scenes: 12, design: "motion" });
    expect(chat.mock.calls[0][0]).toMatchObject({ maxTokens: 6300, timeoutMs: 72_000 });
  });

  describe("rewriteScene", () => {
    const draft: PromptScene[] = [
      { voice: "หนึ่งค่ะ", screen: "เปิด", picture: "", motion: { kind: "hook", lines: ["เปิด"], key: -1, icon: "heart" } },
      { voice: "สองค่ะ", screen: "กลาง", picture: "", motion: { kind: "hook", lines: ["กลาง"], key: -1, icon: "heart" } },
      { voice: "สามค่ะ", screen: "ท้าย", picture: "", motion: { kind: "hook", lines: ["ท้าย"], key: -1, icon: "heart" } },
    ];
    beforeEach(() => chat.mockReset());
    it("returns a scene with a checked motion", async () => {
      const ask = vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ ...number(5000), tag: "  ค่าห้อง  " }) }));
      const r = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 1, design: "motion", ask });
      expect(r.ok && r.scene.motion).toEqual({ kind: "number", value: 5000, unit: "บาท", tag: "ค่าห้อง", bill: "ตามโจทย์" });
      expect(ask.mock.calls[0][0]).toContain('"motion"');
    });
    it("a layout that fails twice is refused", async () => {
      const ask = vi.fn().mockResolvedValue(JSON.stringify({ scene: sc(number(12345)) }));
      const r = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 1, design: "motion", ask });
      expect(r.ok).toBe(false);
      expect(ask.mock.calls[1].join("\n")).toContain("motion.value");
    });
  });
});
