import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/studio/quote-video/actions", () => ({
  makeStoryVideo: vi.fn(), myCost: vi.fn(), myVideos: vi.fn(), previewStoryFigure: vi.fn(), previewStoryHealth: vi.fn(),
  previewStoryPension: vi.fn(), voiceQuota: vi.fn(),
}));
vi.mock("@/app/studio/prompt-story/actions", () => ({ redrawPromptPicture: vi.fn(), makePromptStory: vi.fn(), writePromptStory: vi.fn(), rewritePromptScene: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));

const { PromptStoryBoard, StyleChips } = await import("@/app/studio/prompt-story/PromptStoryBoard");
const { readDesign, designArg, writeArgs, makeArgs, staleWords } = await import("@/lib/prompt-story/form-design");
const { PICTURE_STYLES } = await import("@/lib/prompt-story/types");

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
  it("in motion: the fourteen styles in one group, in the form's order, headed สไตล์ภาพ AI, with no sub-labels and no paper band", () => {
    // the heading, then at once the one radiogroup of every style
    const at = html.indexOf('<p class="text-sm font-semibold">สไตล์ภาพ AI</p><div class="flex flex-wrap gap-2" role="radiogroup" aria-label="สไตล์รูป">');
    expect(at).toBeGreaterThan(-1);
    expect(html.match(/สไตล์ภาพ AI/g)).toHaveLength(1);
    const group = html.slice(at, html.indexOf("</div>", at));
    const names = [...group.matchAll(/role="radio"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(names).toEqual(PICTURE_STYLES.map((s) => s.name));
    expect(names).toHaveLength(14);
    for (const gone of ["หน้าตาที่ระบบวาด", "ภาพวาดโดย AI", "แถบกระดาษ"]) expect(html, gone).not.toContain(gone);
  });

  it("in หน้าตาเดิม: today's two labelled groups and the paper band's line, byte for byte", () => {
    const classic = renderToStaticMarkup(createElement(StyleChips, { design: "classic", style: "paper", onPick: () => {} }));
    // the style section of the form before โมชันกราฟิก's ruling, rendered in หน้าตาเดิม
    expect(createHash("sha256").update(classic).digest("hex")).toBe("cc7473cd4c79b818dad90e120694cc002c70d3cfe5a0e1bb0cbbe223287ed646");
    expect(classic).toContain(">หน้าตาที่ระบบวาด<");
    expect(classic).toContain(">คำบนจอใช้แถบกระดาษเรียบ ภาพวาดโดย AI<");
  });
});

describe("the price before a script", () => {
  it("is not shown at all: the line above สร้างคลิป comes with the draft, priced by its own scenes (pictureCount)", () => {
    expect(html).not.toContain("ยอดตอนกดสร้างคลิป");
    expect(html).not.toMatch(/รูป \d+ ×/);
  });
});

describe("the notice when the form changed after the script", () => {
  it("names the look the clip will be made in when the design changed", () => {
    expect(staleWords("motion", "classic")).toBe("บทนี้เขียนสำหรับโมชันกราฟิก คลิปจะทำเป็นโมชันกราฟิก กด “เขียนใหม่” ถ้าจะใช้หน้าตาเดิม");
    expect(staleWords("classic", "motion")).toBe("บทนี้เขียนสำหรับหน้าตาเดิม คลิปจะทำเป็นหน้าตาเดิม กด “เขียนใหม่” ถ้าจะใช้โมชันกราฟิก");
  });
  it("is today's words when only the brief or another choice changed", () => {
    expect(staleWords("motion", "motion")).toBe("แก้โจทย์หรือตัวเลือกหลังเขียนบทแล้ว คลิปจะทำจากบทนี้ กด “เขียนใหม่” ถ้าอยากให้เขียนตามที่แก้");
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
