import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// the actions are server code: the pieces are drawn here only for their markup
vi.mock("@/app/studio/prompt-story/actions", () => ({ redrawPromptPicture: vi.fn(), makePromptStory: vi.fn(), writePromptStory: vi.fn() }));
vi.mock("@/app/studio/quote-video/actions", () => ({ previewStoryFigure: vi.fn() }));

const { ScriptEditor } = await import("@/app/studio/prompt-story/ScriptEditor");
const { RedrawScenes } = await import("@/app/studio/prompt-story/RedrawScenes");

const scenes = [
  { voice: "ร้านเปิดทุกวัน", screen: "ร้านที่ไม่เคยปิด", picture: "ชายเปิดร้าน" },
  { voice: "เช่น ปีละ 45,200 บาท", screen: "x", picture: "ร้านกลับมาเปิด", showFigure: true },
];

describe("ScriptEditor", () => {
  const html = renderToStaticMarkup(createElement(ScriptEditor, { draft: { id: "d", title: "ร้านเราหยุดไม่ได้", caption: "ทักมาได้", scenes }, notes: [1], onChange: () => {} }));

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

describe("RedrawScenes", () => {
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
