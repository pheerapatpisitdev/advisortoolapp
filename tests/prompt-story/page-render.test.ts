import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// the actions are server code: the pieces are drawn here only for their markup
vi.mock("@/app/studio/prompt-story/actions", () => ({ redrawPromptPicture: vi.fn(), makePromptStory: vi.fn(), writePromptStory: vi.fn(), rewritePromptScene: vi.fn() }));
vi.mock("@/app/studio/quote-video/actions", () => ({ previewStoryFigure: vi.fn() }));

const { ScriptEditor } = await import("@/app/studio/prompt-story/ScriptEditor");
const { RedrawScenes } = await import("@/app/studio/prompt-story/RedrawScenes");

const scenes = [
  { voice: "ร้านเปิดทุกวัน", screen: "ร้านที่ไม่เคยปิด", picture: "ชายเปิดร้าน" },
  { voice: "เช่น ปีละ 45,200 บาท", screen: "x", picture: "ร้านกลับมาเปิด", showFigure: true },
];

describe("ScriptEditor", () => {
  const html = renderToStaticMarkup(createElement(ScriptEditor, { draft: { id: "d", title: "ร้านเราหยุดไม่ได้", caption: "ทักมาได้", scenes }, notes: [1], onChange: () => {}, forDevice: new Set<number>() }));

  it("has a box for every scene's voice, screen words and picture, and for the title", () => {
    expect(html).toContain("บทพูดฉาก 2");
    expect(html).toContain("คำบนจอฉาก 1");
    expect(html).toContain("ภาพฉาก 2");
    expect(html).toContain("ร้านเราหยุดไม่ได้");
  });

  it("shuts the screen words of the scene that shows the premium, and says which scenes were made plain", () => {
    expect(html).toContain("การ์ดเบี้ยจริง (ระบบวาด)");
    expect(html).toMatch(/<input[^>]*aria-label="คำบนจอฉาก 2"[^>]*disabled=""/);
    expect(html).not.toMatch(/<input[^>]*aria-label="คำบนจอฉาก 1"[^>]*disabled=""/);
    expect(html).toContain("ฉากที่ 2");
  });
});

describe("ScriptEditor with devices", () => {
  const room = { layout: "room" as const, title: ["ค่าห้อง", "ต่อคืน"] as [string, string], plan: 5500, real: 6000, planName: "Silver" };
  const draft = {
    id: "d", title: "ค่าห้อง", caption: "", left: 1,
    scenes: [
      { voice: "ค่าห้องจริงคืนละหกพัน", screen: "ค่าห้องจริง", picture: "", device: room },
      { voice: "แผนจ่ายไม่ถึง", screen: "แผนจ่ายไม่ถึง", picture: "", device: { ...room, real: 7000 } },
      { voice: "ทางออก", screen: "ทางออก", picture: "" },
    ],
  };
  const html = renderToStaticMarkup(createElement(ScriptEditor, { draft, notes: [], onChange: () => {}, forDevice: new Set([5500, 6000]) }));

  it("names a passing device, its words editable and its figures shown, with no picture box", () => {
    expect(html).toContain("ค่าห้องต่อคืน");
    expect(html).toMatch(/<input[^>]*aria-label="หัวข้อ บรรทัด 1 ฉาก 1"[^>]*value="ค่าห้อง"/);
    expect(html).toContain("แผนจ่าย 5,500");
    expect(html).not.toContain("aria-label=\"ภาพฉาก 1\"");
  });

  it("hides the screen words of a device scene (the device draws its heading), even one that showed the premium", () => {
    const shown = renderToStaticMarkup(createElement(ScriptEditor, {
      draft: { ...draft, scenes: [{ ...draft.scenes[0], showFigure: true }, ...draft.scenes.slice(1)] }, notes: [], onChange: () => {}, forDevice: new Set([5500, 6000]),
    }));
    for (const out of [html, shown]) {
      expect(out).not.toContain("aria-label=\"คำบนจอฉาก 1\"");
      expect(out).toContain("ฉากนี้ใช้หัวข้อของอุปกรณ์แทนคำบนจอ");
      expect(out).not.toContain("การ์ดเบี้ยจริง (ระบบวาด)");
      // a device that fails is drawn as a picture: its screen words stay
      expect(out).toContain("aria-label=\"คำบนจอฉาก 2\"");
    }
  });

  it("says why a device fails, and that the scene will be a picture", () => {
    expect(html).toContain("อุปกรณ์นี้ใช้ไม่ได้: ค่าห้องจริง ตัวเลข 7,000 ไม่อยู่ในโจทย์หรือแผน, ฉากนี้จะใช้ภาพ AI");
    expect(html).toContain("aria-label=\"ภาพฉาก 2\"");
  });

  it("asks for the first missing picture words, counts pictures and devices, and the rewrites left", () => {
    expect(html).toContain("ใส่คำบรรยายภาพของฉากที่ 2");
    expect(html).not.toContain("ใส่คำบรรยายภาพของฉากที่ 1");
    expect(html).toContain("ภาพ AI 2 ฉาก · อุปกรณ์ 1 ฉาก");
    expect(html).toContain("เขียนฉากนี้ใหม่ได้อีก 1 ครั้ง (ฟรี นับแม้เขียนไม่สำเร็จ)");
    expect(html).toContain("เขียนฉากนี้ใหม่ (เหลือ 1)");
    expect(html).toContain('aria-label="เขียนฉาก 3 ใหม่ (เหลือ 1)"');
    expect(html).toMatch(/<div role="group" aria-label="ตัวเลขของอุปกรณ์ ฉาก 1 \(แก้ไม่ได้\)"/);
  });

  it("shuts เขียนฉากนี้ใหม่ when none are left", () => {
    const none = renderToStaticMarkup(createElement(ScriptEditor, { draft: { ...draft, left: 0 }, notes: [], onChange: () => {}, forDevice: new Set([5500, 6000]) }));
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>เขียนฉากใหม่ครบแล้ว<\/button>/);
  });
});

describe("RedrawScenes", () => {
  it("has no button for a device scene, and nothing when every scene is a device", () => {
    const html = renderToStaticMarkup(createElement(RedrawScenes, { id: "v", scenes: 3, devices: [1], price: "1", onStarted: () => {} }));
    expect(html).toContain("วาดฉาก 1 ใหม่");
    expect(html).not.toContain("วาดฉาก 2 ใหม่");
    expect(html).toContain("วาดฉาก 3 ใหม่");
    expect(renderToStaticMarkup(createElement(RedrawScenes, { id: "v", scenes: 2, devices: [0, 1], price: "1", onStarted: () => {} }))).toBe("");
  });

  it("has one button a scene, with the picture's price", () => {
    const html = renderToStaticMarkup(createElement(RedrawScenes, { id: "v", scenes: 5, price: "1", onStarted: () => {} }));
    for (const n of [1, 2, 3, 4, 5]) expect(html).toContain(`วาดฉาก ${n} ใหม่`);
    expect(html).not.toContain("วาดฉาก 6 ใหม่");
    expect(html).toContain("฿1 ต่อรูป");
  });

  it("says nothing costs for the owner", () => {
    expect(renderToStaticMarkup(createElement(RedrawScenes, { id: "v", scenes: 3, price: null, onStarted: () => {} }))).toContain("ไม่เสียเงิน");
  });
});
