import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/studio/quote-video/actions", () => ({
  makeStoryVideo: vi.fn(), myCost: vi.fn(), myVideos: vi.fn(), previewStoryFigure: vi.fn(), previewStoryHealth: vi.fn(),
  previewStoryPension: vi.fn(), voiceQuota: vi.fn(),
}));
vi.mock("@/app/studio/prompt-story/actions", () => ({ redrawPromptPicture: vi.fn(), makePromptStory: vi.fn(), writePromptStory: vi.fn(), rewritePromptScene: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));

const { PromptStoryBoard } = await import("@/app/studio/prompt-story/PromptStoryBoard");
const { readDesign, designArg, writeArgs, makeArgs } = await import("@/lib/prompt-story/form-design");

const base = { initial: [], cost: null, prices: {} as never, quota: null, pages: [], eleven: [] };
const html = renderToStaticMarkup(createElement(PromptStoryBoard, base));
const chip = (words: string) => new RegExp(`<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*>${words.replace(/[()]/g, "\\$&")}</button>`).exec(html)?.[1];

describe("the form's look choice", () => {
  it("titles the step and offers both looks in a radiogroup, motion chosen", () => {
    expect(html).toContain("หน้าตาคลิป และสไตล์รูป");
    expect(html).toContain('role="radiogroup" aria-label="หน้าตาคลิป"');
    expect(chip("โมชันกราฟิก (ใหม่)")).toBe("true");
    expect(chip("หน้าตาเดิม")).toBe("false");
  });
  it("puts the style groups under สไตล์ภาพ AI in motion", () => {
    expect(html).toContain("สไตล์ภาพ AI");
  });
});

describe("the remembered design", () => {
  it("is motion with nothing stored or anything else stored; classic only when classic", () => {
    expect(readDesign(undefined)).toBe("motion");
    expect(readDesign("x")).toBe("motion");
    expect(readDesign("classic")).toBe("classic");
    expect(readDesign("motion")).toBe("motion");
  });
  it("sends design to the server only for motion", () => {
    expect(designArg("motion")).toBe("motion");
    expect(designArg("classic")).toBeUndefined();
  });
});

describe("the write and make payloads", () => {
  const asked = { brief: "b", scenes: 5 as const, format: "free" as const, figure: null };
  it("write carries design: motion by default and no design for หน้าตาเดิม", () => {
    expect(writeArgs({ ...asked, design: "motion" })).toEqual({ brief: "b", scenes: 5, format: "free", design: "motion" });
    expect("design" in writeArgs({ ...asked, design: "classic" })).toBe(false);
  });
  it("make carries the design the script was written with", () => {
    expect(makeArgs("motion")).toEqual({ design: "motion" });
    expect(makeArgs("classic")).toEqual({});
  });
});
