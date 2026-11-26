import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { checkMotion } from "@/lib/prompt-story/check";
import {
  addLine, dropLine, editMotionAt, MOTION_GAP, motionAside, motionDefault, motionGapAt, motionGaps, needLayoutWords, NUMBER_NEEDS, pictureCount, starLine, toKindAt, toMotion,
  type MotionDraft,
} from "@/lib/prompt-story/editor-state";
import { MOTION_KINDS, MOTION_LIMITS, type MotionLayout, type PromptScene } from "@/lib/prompt-story/types";

// the actions are server code: the editor is drawn here only for its markup
vi.mock("@/app/studio/prompt-story/actions", () => ({ rewritePromptScene: vi.fn() }));
const { ScriptEditor } = await import("@/app/studio/prompt-story/ScriptEditor");
const { MotionPreview, previewTime } = await import("@/app/studio/prompt-story/MotionPreview");

/** โมชันกราฟิก in the script editor (Task 8): a layout per scene, its fields, and a small preview */

const U1 = "11111111-1111-4111-8111-111111111111";
const room = { layout: "room" as const, title: ["ค่าห้อง", "ต่อคืน"] as [string, string], plan: 5500, real: 6000, planName: "Silver" };
const scene = (over: Partial<PromptScene> = {}): PromptScene => ({ voice: "ลูกป่วยต้องนอนโรงพยาบาล", screen: "ลูกป่วย ค่ารักษาเท่าไหร่", picture: "แม่กอดลูกบนเตียง", ...over });
const hook: MotionLayout = { kind: "hook", lines: ["ลูกป่วยหนึ่งครั้ง", "ค่ารักษาเท่าไหร่"], key: 1, icon: "fever" };
const card: MotionLayout = { kind: "card", tag: "เด็กเล็กป่วยบ่อย", chips: ["ไข้หวัด", "ปอดอักเสบ"] };
const number: MotionLayout = { kind: "number", value: 68000, unit: "บาท", tag: "ค่ารักษาเฉลี่ย", bill: "ใบเสร็จโรงพยาบาล" };
const compare: MotionLayout = { kind: "compare", title: "มีแผนกับไม่มีแผน", bad: { head: "ไม่มีแผน", lines: ["จ่ายเองทั้งหมด", "เงินเก็บหาย"] }, good: { head: "มีแผน", lines: ["แผนดูแลให้", "เงินเก็บอยู่ครบ"] } };
const check: MotionLayout = { kind: "check", lines: ["เลือกแผนให้ลูก", "ดูสามข้อนี้"], ticks: ["วงเงินพอ", "ห้องพักพอ", "ต่ออายุได้"], photo: true };

describe("motionDefault", () => {
  it("a big number takes the figure the scene says, from the brief's and the plan's", () => {
    const m = motionDefault("number", scene({ voice: "ค่ารักษา 68,000 บาท" }), [68000, 5]);
    expect(m).toMatchObject({ kind: "number", value: 68000, unit: "บาท" });
  });

  it("a big number takes the first figure when the scene says none, and refuses when there is none at all", () => {
    expect(motionDefault("number", scene(), [5, 68000])).toMatchObject({ kind: "number", value: 5 });
    expect(motionDefault("number", scene(), [])).toBe(NUMBER_NEEDS);
    expect(NUMBER_NEEDS).toBe("ตัวเลขใหญ่ต้องมีตัวเลขในโจทย์หรือแผน");
    // never a value the check refuses: not nought, not a fraction
    expect(motionDefault("number", scene(), [0, 1.5])).toBe(NUMBER_NEEDS);
  });

  it("a hook and a full screen are the screen words, broken into lines the check takes", () => {
    // 24 letters: one line would be over 22, so it breaks at the space
    const h = motionDefault("hook", scene(), []);
    expect(h).toEqual({ kind: "hook", lines: ["ลูกป่วย", "ค่ารักษาเท่าไหร่"], key: -1, icon: "heart" });
    expect(motionDefault("full", scene({ screen: "ทักมาคุยกันได้" }), [])).toEqual({ kind: "full", lines: ["ทักมาคุยกันได้"], key: -1 });
    expect(checkMotion(h, new Set(), new Set())).toEqual(h);
    // 40 letters, the most the screen holds: no line over 22, nothing past the layout's line count
    const long = scene({ screen: "ค่ารักษาพยาบาล ของลูกน้อย แพงขึ้นทุกปีนะ" });
    for (const kind of ["hook", "full"] as const) {
      const m = motionDefault(kind, long, []) as Extract<MotionLayout, { kind: "hook" | "full" }>;
      expect(m.lines.length).toBeLessThanOrEqual(kind === "hook" ? 3 : 2);
      for (const l of m.lines) expect([...l].length).toBeLessThanOrEqual(MOTION_LIMITS.line);
      expect(Array.isArray(checkMotion(m, new Set(), new Set()))).toBe(false);
    }
  });

  it("a card's tag is the screen words, its chips their first two words or empty", () => {
    expect(motionDefault("card", scene(), [])).toEqual({ kind: "card", tag: "ลูกป่วย ค่ารักษาเท่าไหร่", chips: ["ลูกป่วย", "ค่ารักษาเท่าไหร่"] });
    expect(motionDefault("card", scene({ screen: "ค่าห้องแพงขึ้น" }), [])).toEqual({ kind: "card", tag: "ค่าห้องแพงขึ้น", chips: ["", ""] });
  });

  it("compare and check start from the screen words, the rest left for the agent, in the right counts", () => {
    expect(motionDefault("compare", scene(), [])).toEqual({
      kind: "compare", title: "ลูกป่วย ค่ารักษาเท่าไหร่", bad: { head: "", lines: ["", ""] }, good: { head: "", lines: ["", ""] },
    });
    expect(motionDefault("check", scene(), [])).toEqual({ kind: "check", lines: ["ลูกป่วย", "ค่ารักษาเท่าไหร่"], ticks: ["", "", ""], photo: false });
    expect(motionDefault("check", scene({ screen: "เลือกแผนให้ลูก" }), [])).toEqual({ kind: "check", lines: ["เลือกแผนให้ลูก", ""], ticks: ["", "", ""], photo: false });
  });

  it("the first scene whose layout still has an empty box shuts สร้างคลิป, as the server would refuse it; the premium card's hidden layout never does", () => {
    const empty = motionDefault("compare", scene(), []) as MotionLayout;
    expect(motionGapAt([scene({ motion: hook }), scene({ motion: card })], "motion")).toBeNull();
    expect(motionGapAt([scene({ motion: hook }), scene({ motion: empty }), scene({ motion: { ...card, tag: " " } })], "motion")).toBe(1);
    // the premium card draws the figure: the server drops the layout under it (checkedPromptStory)
    expect(motionGapAt([scene({ motion: empty, showFigure: true }), scene({ motion: hook })], "motion")).toBeNull();
    // หน้าตาเดิม draws no layout at all
    expect(motionGapAt([scene({ motion: empty })])).toBeNull();
    expect(needLayoutWords(2)).toBe(`ฉากที่ 2 ${MOTION_GAP}`);
    expect(MOTION_GAP).toBe("ยังมีช่องว่าง ใส่ให้ครบก่อนกดสร้างคลิป");
  });

  it("counts the words still to write, which the server would refuse", () => {
    expect(motionGaps(motionDefault("compare", scene(), []) as MotionLayout)).toBe(6);
    expect(motionGaps(motionDefault("check", scene({ screen: "เลือกแผนให้ลูก" }), []) as MotionLayout)).toBe(4);
    for (const m of [hook, card, number, compare, check]) expect(motionGaps(m)).toBe(0);
    expect(motionGaps({ ...card, chips: ["ไข้หวัด", " "] } as MotionLayout)).toBe(1);
  });
});

describe("the layout moves", () => {
  it("toMotion puts the layout on the scene in place of a device or a part, every word kept", () => {
    const s = scene({ device: room, asset: U1, showFigure: true });
    expect(toMotion(s, card)).toEqual({ voice: s.voice, screen: s.screen, picture: s.picture, showFigure: true, motion: card });
  });

  it("switching scene 1 hook → card → hook brings back the hook as the agent left it", () => {
    let d = { scenes: [scene({ motion: hook }), scene({ motion: number })] };
    d = editMotionAt(d, 0, { ...hook, lines: ["แก้แล้วบรรทัดแรก", "ค่ารักษาเท่าไหร่"] });
    const toCard = toKindAt(d, 0, "card", [68000]);
    if (typeof toCard === "string") throw new Error(toCard);
    expect(toCard.scenes[0].motion?.kind).toBe("card");
    const back = toKindAt(toCard, 0, "hook", [68000]);
    if (typeof back === "string") throw new Error(back);
    expect(back.scenes[0].motion).toEqual({ ...hook, lines: ["แก้แล้วบรรทัดแรก", "ค่ารักษาเท่าไหร่"] });
    // the card it left is kept too, and the other scene is untouched
    const again = toKindAt(back, 0, "card", [68000]);
    if (typeof again === "string") throw new Error(again);
    expect(again.scenes[0].motion).toEqual(toCard.scenes[0].motion);
    expect(again.scenes[1]).toBe(d.scenes[1]);
  });

  it("the same kind again changes nothing; a big number with no figure is refused and the layout stays", () => {
    const d = { scenes: [scene({ motion: hook })] };
    expect(toKindAt(d, 0, "hook", [])).toBe(d);
    expect(toKindAt(d, 0, "number", [])).toBe(NUMBER_NEEDS);
  });

  it("a device or a part gives way to a layout and is kept for อุปกรณ์", () => {
    const d: MotionDraft = { scenes: [scene({ device: room, picture: "" })] };
    const r = toKindAt(d, 0, "card", []);
    if (typeof r === "string") throw new Error(r);
    expect(r.scenes[0].device).toBeUndefined();
    expect(r.parked?.[0]).toEqual(room);
    // a layout that paints begins its picture words from the screen words
    expect(r.scenes[0].picture).toBe("ลูกป่วย ค่ารักษาเท่าไหร่");
    const part = toKindAt({ scenes: [scene({ asset: U1 })] }, 0, "hook", []);
    if (typeof part === "string") throw new Error(part);
    expect(part.scenes[0].asset).toBeUndefined();
  });

  it("motionAside takes the layout off for a device or a part, and the layout comes back after", () => {
    const d = motionAside({ scenes: [scene({ motion: compare })] }, 0);
    expect(d.scenes[0].motion).toBeUndefined();
    const back = toKindAt({ ...d, scenes: [{ ...d.scenes[0], device: room }] }, 0, "compare", []);
    if (typeof back === "string") throw new Error(back);
    expect(back.scenes[0].motion).toEqual(compare);
    expect(back.scenes[0].device).toBeUndefined();
  });

  it("turning the check's round picture on asks for picture words, begun from the screen words", () => {
    const d = { scenes: [scene({ picture: "", motion: { ...check, photo: false } as MotionLayout })] };
    const on = editMotionAt(d, 0, check);
    expect(on.scenes[0].picture).toBe("ลูกป่วย ค่ารักษาเท่าไหร่");
    expect(pictureCount(on.scenes, new Set(), undefined, "motion")).toBe(1);
    expect(pictureCount(d.scenes, new Set(), undefined, "motion")).toBe(0);
  });

  it("the gold line toggles, lines are added up to the layout's count and taken away with the gold kept on its line", () => {
    const h = hook as Extract<MotionLayout, { kind: "hook" }>;
    expect(starLine(h, 0).key).toBe(0);
    expect(starLine(h, 1).key).toBe(-1);
    const three = addLine(h);
    expect(three.lines).toEqual([...h.lines, ""]);
    expect(addLine(three)).toBe(three);
    expect(dropLine(three, 0)).toEqual({ ...h, lines: ["ค่ารักษาเท่าไหร่", ""], key: 0 });
    expect(dropLine(three, 1).key).toBe(-1);
    expect(dropLine({ ...h, lines: ["หนึ่งบรรทัด"], key: 0 }, 0).lines).toEqual(["หนึ่งบรรทัด"]);
    const full = { kind: "full" as const, lines: ["หนึ่ง", "สอง"], key: -1 };
    expect(addLine(full)).toBe(full);
  });
});

/** the same draft before and after Task 8, a layout on scene 1 too: drawn without a design, not one byte differs */
const OLD = {
  id: "d", title: "ค่าห้อง", caption: "ทักมาได้", left: 2,
  scenes: [
    { voice: "ร้านเปิดทุกวัน", screen: "ร้านที่ไม่เคยปิด", picture: "ชายเปิดร้าน", motion: { kind: "hook" as const, lines: ["ร้านที่ไม่เคยปิด"], key: 0, icon: "home" as const } },
    { voice: "เช่น ปีละ 5,500 บาท", screen: "x", picture: "ร้านกลับมาเปิด", showFigure: true },
    { voice: "ค่าห้องจริงคืนละหกพัน", screen: "ค่าห้องจริง", picture: "", device: room },
    { voice: "แผนจ่ายไม่ถึง", screen: "แผนจ่ายไม่ถึง", picture: "", device: { ...room, real: 7000 } },
    { voice: "ภาพจากคลัง", screen: "บ้าน", picture: "", asset: U1 },
    { voice: "ปิดท้าย", screen: "ทักมา", picture: "" },
  ],
};

describe("ScriptEditor without a design", () => {
  const html = renderToStaticMarkup(createElement(ScriptEditor, { draft: OLD, notes: [1], onChange: () => {}, forDevice: new Set([5500, 6000]), assets: [{ id: U1, name: "บ้านหลังเล็ก" }] }));

  it("is exactly the editor it was", () => {
    expect(html).toContain('aria-label="ภาพของฉาก 1"');
    expect(html).not.toContain("แบบของฉาก");
    expect(html).not.toContain("ตัวอย่างฉาก");
    expect(createHash("sha256").update(html).digest("hex").slice(0, 16)).toBe("489028bd3c41a82c");
  });
});

describe("ScriptEditor in โมชันกราฟิก", () => {
  const draft = {
    id: "d", title: "ลูกป่วย", caption: "", left: 3,
    scenes: [
      scene({ motion: hook, picture: "" }),
      scene({ motion: card }),
      scene({ voice: "ค่ารักษา 68,000 บาท", motion: number, picture: "" }),
      scene({ motion: compare, picture: "" }),
      scene({ motion: check }),
      scene({ voice: "ค่าห้องจริงคืนละหกพัน", device: room, picture: "" }),
      scene({ voice: "เช่น ปีละ 5,500 บาท", showFigure: true, motion: hook, picture: "" }),
      scene({ motion: { kind: "full", lines: ["ทักมาคุยกันได้"], key: 0 }, picture: "" }),
    ],
  };
  const html = renderToStaticMarkup(createElement(ScriptEditor, { draft, notes: [], onChange: () => {}, forDevice: new Set([68000, 5500, 6000]), design: "motion" }));

  it("names each scene's choice แบบของฉาก, the six layouts then อุปกรณ์ and ภาพจากคลัง, the scene's own checked", () => {
    expect(html).toContain('aria-label="แบบของฉาก 1"');
    expect(html).not.toContain("ภาพของฉาก 1");
    for (const k of MOTION_KINDS) expect(html.match(new RegExp(`>${k.name}<`, "g"))?.length).toBeGreaterThanOrEqual(draft.scenes.length);
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>เปิดเรื่อง</);
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>ค่าห้องต่อคืน</);
    expect(html).not.toMatch(/>ภาพ AI</);
  });

  it("counts AI pictures and the scenes the system draws", () => {
    // card, check with its photo, and the full screen paint; the rest are drawn free
    expect(html).toContain("ภาพ AI 3 ฉาก · แบบฉากที่ระบบวาด 5 ฉาก (ไม่คิดค่ารูป)");
    expect(html).toContain("เขียนฉากนี้ใหม่ได้อีก 3 ครั้ง");
    // the full screen has no picture words: it is the one asked for
    expect(html).toContain("ใส่คำบรรยายภาพของฉากที่ 8");
  });

  it("shows each layout's fields with the mockup's labels and the layout's limits", () => {
    for (const label of ["ป้ายบน", "ป้ายที่ 1", "ป้ายที่ 2", "คำบรรยายภาพ", "ตัวเลข (มาจากโจทย์ แก้ไม่ได้)", "หน่วย", "หัวใบเสร็จ", "หัวข้อ", "ฝั่งแรก (✕)", "ฝั่งสอง (✓)", "ข้อ 1", "ข้อ 2", "ข้อ 3", "ภาพวงกลม", "★ คำเน้น"]) {
      expect(html, label).toContain(label);
    }
    expect(html).toMatch(/<input[^>]*aria-label="บรรทัดที่ 1 ฉาก 1"[^>]*maxLength="22"[^>]*value="ลูกป่วยหนึ่งครั้ง"|<input[^>]*maxLength="22"[^>]*aria-label="บรรทัดที่ 1 ฉาก 1"/);
    expect(html).toMatch(/<input[^>]*aria-label="ป้ายที่ 1 ฉาก 2"[^>]*maxLength="16"/);
    expect(html).toMatch(/<input[^>]*aria-label="ตัวเลข \(มาจากโจทย์ แก้ไม่ได้\) ฉาก 3"[^>]*readOnly=""[^>]*value="68,000"/);
    expect(html).toMatch(/<input[^>]*aria-label="ข้อ 1 ฉาก 5"[^>]*maxLength="28"/);
    // the gold line of the hook is its second, pressed
    expect(html).toMatch(/aria-pressed="true"[^>]*>★ คำเน้น</);
    // the check's round picture is on: its picture words are asked
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>มี</);
    expect(html).toContain('aria-label="คำบรรยายภาพวงกลม ฉาก 5"');
    expect(html).toContain('aria-label="คำบรรยายภาพ ฉาก 2"');
    // no screen words box for a scene with a layout
    expect(html).not.toContain('aria-label="คำบนจอฉาก 1"');
    // every layout here is written in full
    expect(html).not.toContain("ยังมีช่องว่าง");
  });

  it("the premium scene shows the system's card in place of its fields and preview", () => {
    expect(html.match(/การ์ดเบี้ยจริง \(ระบบวาด\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('aria-label="บรรทัดที่ 1 ฉาก 7"');
  });

  it("the premium scene's layout chips are shut (the card is its drawing); อุปกรณ์ and ภาพจากคลัง answer as before", () => {
    const group = (n: number) => new RegExp(`aria-label="แบบของฉาก ${n}">(.*?)</div>`).exec(html)?.[1] ?? "";
    const seven = group(7);
    for (const k of MOTION_KINDS) {
      expect(seven, k.name).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*>${k.name}</button>`));
      expect(seven, k.name).toMatch(new RegExp(`<button[^>]*aria-checked="false"[^>]*>${k.name}</button>`));
    }
    expect(seven).not.toMatch(/disabled=""[^>]*>อุปกรณ์</);
    expect(seven).not.toMatch(/disabled=""[^>]*>ภาพจากคลัง</);
    // every other scene's chips answer
    expect(group(1)).not.toContain('disabled=""');
  });

  it("has a preview beside every scene, a device's said in words, in Prompt", () => {
    expect(html).toContain('aria-label="ภาพตัวอย่างฉาก 1"');
    expect(html).toContain("ระบบวาดตอนสร้างคลิป");
    expect(html.match(/>ตัวอย่างฉาก</g)).toHaveLength(draft.scenes.length);
    expect(html).toContain("https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;800&amp;display=swap");
  });
});

describe("MotionPreview", () => {
  it("held still, shows the scene's words at its still time", () => {
    const out = renderToStaticMarkup(createElement(MotionPreview, { scene: scene({ motion: hook }), size: "portrait", still: true }));
    expect(out).toContain("ลูกป่วยหนึ่งครั้ง");
    expect(out).toContain("ค่ารักษาเท่าไหร่");
    expect(out).toContain("font-family:Prompt");
    // the count has run to the figure by then
    expect(renderToStaticMarkup(createElement(MotionPreview, { scene: scene({ motion: number }), size: "square", still: true }))).toContain(">68,000<");
  });

  it("plays the scene's 4 seconds, holds where every word is in, then plays again", () => {
    expect(previewTime(0)).toBe(0);
    expect(previewTime(2)).toBe(2);
    expect(previewTime(3.9)).toBeCloseTo(3.4);
    expect(previewTime(5.1)).toBeCloseTo(3.4);
    expect(previewTime(5.2 + 1)).toBeCloseTo(1);
  });

  it("draws at the frame's size, scaled to the box", () => {
    const out = renderToStaticMarkup(createElement(MotionPreview, { scene: scene({ motion: card }), size: "landscape", still: true }));
    expect(out).toContain("width:1920px");
    expect(out).toMatch(/transform:scale\(0\.0\d+\)/);
  });

  it("says a device or a part is drawn when the clip is made", () => {
    for (const s of [scene({ device: room }), scene({ asset: U1 })]) {
      const out = renderToStaticMarkup(createElement(MotionPreview, { scene: s, size: "portrait", still: true }));
      expect(out).toContain("ระบบวาดตอนสร้างคลิป");
      expect(out).not.toContain("font-family:Prompt");
    }
  });
});
